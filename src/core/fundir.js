import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ===========================================================================
 *  FUSAO DE DETALHE ESTATICO  (Fase 10)
 * ===========================================================================
 *  A planta tinha ~4 700 malhas visiveis, e o custo do quadro era o numero de
 *  chamadas de desenho, nao de triangulos: cada parafuso de flange, degrau de
 *  escada, mourao de cerca e barra de trelica era uma chamada, duas com a
 *  sombra. Aqui, dentro de cada PECA, as partes do mesmo material viram uma
 *  malha so — com a matriz de cada uma gravada nos vertices.
 *
 *  O que NAO se funde, para nada mudar de comportamento:
 *    - (ate 16/11/2026, tambem o que tinha ficha propria — bocal, valvula,
 *      linha —, para o clique achar a ficha certa. O clique saiu da maquete:
 *      agora a ficha so separa onde se pede, com `fichas: 'filhos'` — os
 *      objetos do entorno, que o codigo ainda procura um a um pela caixa —,
 *      e o resto se funde na peca inteira: ~1 000 chamadas de desenho a menos);
 *    - camada do HUD (`camada-*`) e grupo que nasce oculto: idem, para
 *      ligar e desligar inteiro;
 *    - o que se mexe (agitador, tambor, pessoa, veiculo) e o que e instanciado;
 *    - a TAG pintada, as linhas e as etiquetas (nao sao malha).
 *  O material e o mesmo objeto de antes: o corte e o realce continuam.
 *
 *  A auditoria mede a cena ja fundida. Para medir peca por peca (uma parte
 *  boiando dentro de um grupo fundido nao apareceria), abra com ?semfusao.
 *
 *  E antes de fundir, sombra so onde importa: peca com menos de 15 cm de raio
 *  (parafuso, degrau, faixa no chao) para de projetar sombra — ninguem a ve,
 *  e cada uma custava uma chamada a mais no mapa de sombra.
 */

const RAIO_SEM_SOMBRA = 0.15;
const NAO_FUNDIR = /^(tag-pintada|pessoa|caminhao|carro|ceu)/;

/* O que nasce oculto e alguem acende depois (o desenho da vista de planta, a
 * camada de seguranca) tambem e unidade: fundido no pai, o visible do grupo
 * deixaria de valer e as setas de caimento ficavam sempre a vista. */
function ehUnidade(o, raiz, fichas) {
  const comFicha = fichas === 'filhos' && o.parent === raiz && o.userData?.ficha;
  return o !== raiz && (comFicha || /^camada-/.test(o.name) || o.userData?.unidade || !o.visible);
}

function animado(o) {
  return o.userData?.girante || o.userData?.animar || o.userData?.rodas?.length;
}

/** Sombra so para o que e grande o bastante para se ver. */
export function podarSombras(raiz) {
  let n = 0;
  const s = new THREE.Vector3();
  raiz.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.isInstancedMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(s);
    if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < RAIO_SEM_SOMBRA) { o.castShadow = false; n++; }
  });
  return n;
}

/**
 * Funde, dentro de `raiz`, as malhas de mesmo material. Devolve quantas
 * malhas havia e quantas ficaram. `fichas: 'filhos'`: cada filho direto de
 * `raiz` que tenha ficha fica uma unidade a parte (fundida por dentro).
 */
export function fundir(raiz, girantes = new Set(), { fichas = null } = {}) {
  let antes = 0, depois = 0;
  raiz.updateWorldMatrix(true, true);
  const inv = raiz.matrixWorld.clone().invert();
  const baldes = new Map();
  const unidades = [];

  (function coletar(no) {
    for (const f of no.children) {
      if (NAO_FUNDIR.test(f.name) || girantes.has(f) || animado(f) || f.isInstancedMesh || f.isCSS2DObject) continue;
      if (ehUnidade(f, raiz, fichas)) { unidades.push(f); continue; }
      if (f.isMesh && f.visible && !f.morphTargetInfluences && !Array.isArray(f.material)) {
        const g = f.geometry;
        const attrs = Object.keys(g.attributes).sort().join(',');
        // o que nasce no piso (berco, perna, sapata) so se funde com o que nasce
        // no piso: e assim que a auditoria reconhece apoio
        if (!g.boundingBox) g.computeBoundingBox();
        const piso = g.boundingBox.clone().applyMatrix4(f.matrixWorld).min.y < 0.4;
        const chave = `${f.material.uuid}|${f.castShadow}|${f.receiveShadow}|${attrs}|${f.renderOrder}|${piso}`;
        if (!baldes.has(chave)) baldes.set(chave, []);
        baldes.get(chave).push(f);
      }
      if (f.children.length && !f.isMesh) coletar(f);
      else if (f.isMesh && f.children.length) coletar(f);   // filhos de malha (aro da roda, tinta)
    }
  }(raiz));

  for (const lista of baldes.values()) {
    antes += lista.length;
    if (lista.length < 2) { depois += lista.length; continue; }
    const geos = lista.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      // espelhado inverte a ordem dos vertices: a face sumiria por dentro
      if (m.matrixWorld.determinant() < 0) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i += 3) {
          for (const nome of Object.keys(g.attributes)) {
            const a = g.attributes[nome];
            for (let c = 0; c < a.itemSize; c++) {
              const t = a.array[(i + 1) * a.itemSize + c];
              a.array[(i + 1) * a.itemSize + c] = a.array[(i + 2) * a.itemSize + c];
              a.array[(i + 2) * a.itemSize + c] = t;
            }
          }
        }
      }
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      g.groups = [];
      return g;
    });
    const fundida = mergeGeometries(geos, false);
    if (!fundida) { depois += lista.length; continue; }
    fundida.computeBoundingSphere();
    fundida.computeBoundingBox();
    const m0 = lista[0];
    const nova = new THREE.Mesh(fundida, m0.material);
    nova.name = `fundida-${m0.name || m0.parent?.name || 'peca'}`;
    nova.castShadow = m0.castShadow;
    nova.receiveShadow = m0.receiveShadow;
    nova.renderOrder = m0.renderOrder;
    raiz.add(nova);
    for (const m of lista) {
      // filhos de malha (aro, tinta) sobem para a raiz antes de a malha sair
      for (const c of [...m.children]) raiz.attach(c);
      m.parent?.remove(m);
      m.geometry.dispose();
    }
    depois += 1;
  }
  for (const u of unidades) {
    const r = fundir(u, girantes);
    antes += r.antes;
    depois += r.depois;
  }
  return { antes, depois };
}
