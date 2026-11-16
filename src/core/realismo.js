import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * ===========================================================================
 *  OCLUSAO DE AMBIENTE (GTAO)
 * ===========================================================================
 *  Escurece onde a luz difusa nao chega: o tubo sobre o apoio, o pe do vaso
 *  na laje, a junta entre duas pecas. E o que tira a cara de maquete de
 *  plastico. Custa um segundo desenho da cena (normais e profundidade), entao:
 *
 *    - liga e desliga no HUD;
 *    - desliga sozinho se, depois de aquecer, o quadro medio passar de
 *      1/28 s — num notebook fraco a maquete continua fluida;
 *    - fica suspenso no corte (o material de normais nao tem o plano de
 *      corte, e escureceria em volta da secao) e na vista de planta (de 300 m
 *      nao se ve).
 *
 *  Com pos-processamento o tone mapping vai para o OutputPass, no fim; o ceu
 *  passa a compensar isso sozinho (uniforme `compor`, core/scene.js).
 */
export function criarRealismo(cena, { aoMudar } = {}) {
  const { renderer, scene, camera } = cena;
  const ceu = scene.getObjectByName('ceu');
  const tam = renderer.getSize(new THREE.Vector2());
  const alvo = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, alvo);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, tam.x, tam.y);
  // Espessura suposta de 5 cm (Fase 25): com 1,5 m o GTAO tratava o tubo
  // fino (DN 25 a 100) como um bloco cheio atras dele mesmo e o pintava quase
  // de preto — o aluminio da NBR 6493 parecia piche (medido: com a oclusao
  // zerada o mesmo tubo saia claro). Raio de 0,5 m: ainda pega a junta de
  // tubo e apoio, o pe do vaso na laje e o canto da bandeja.
  gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.0, thickness: 0.05, scale: 1.0, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.8;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  let querido = true;                              // o que o usuario escolheu
  let suspenso = false;                            // corte, planta ou dentro de predio
  const motivos = new Set();
  let ativo = false;
  function aplicar() {
    const v = querido && !suspenso;
    if (v === ativo) return;
    ativo = v;
    if (ceu) {
      ceu.material.uniforms.compor.value = v;
      ceu.material.uniforms.exposicao.value = renderer.toneMappingExposure;
    }
    cena.trocarRenderizacao(v ? () => composer.render() : null);
  }

  window.addEventListener('resize', () => {
    const t = renderer.getSize(new THREE.Vector2());
    composer.setSize(t.x, t.y);
    gtao.setSize(t.x, t.y);
  });

  // medida do quadro: aquece 2 s, mede 3 s; lento demais, desliga
  let tempo = 0, quadros = 0, medido = false;
  cena.antesDeRenderizar.push((dt) => {
    if (medido || !ativo || document.hidden) return;
    tempo += dt;
    if (tempo < 2) return;
    quadros++;
    if (tempo < 5) return;
    medido = true;
    const medio = (tempo - 2) / quadros;
    if (medio > 1 / 28) {
      querido = false;
      aplicar();
      console.info(`oclusão de ambiente desligada: quadro médio de ${(medio * 1000).toFixed(0)} ms`);
      aoMudar?.(false);
    }
  });

  aplicar();
  return {
    ligar(v) { querido = v; aplicar(); },
    // cada motivo suspende por si: o corte nao religa o que o interior desligou
    suspender(v, motivo = 'vista') {
      if (v) motivos.add(motivo); else motivos.delete(motivo);
      suspenso = motivos.size > 0;
      aplicar();
    },
    get ativo() { return ativo; },
    composer, gtao,
  };
}
