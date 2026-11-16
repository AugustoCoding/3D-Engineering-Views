import * as THREE from 'three';
import { BLOCOS } from '../data/site.js';
import { Y } from '../lib/terreno.js';

/**
 * ===========================================================================
 *  AUDITORIA DO ENTORNO  (Fase 7)
 * ===========================================================================
 *  "Nada flutua nem afunda no terreno", e cada coisa fica no bloco dela:
 *
 *    FLUTUA        a peca nao chega ao piso do bloco (fundo acima dele)
 *    AFUNDA        a peca inteira fica abaixo do piso
 *    FORA_DO_BLOCO a pegada sai do bloco aprovado na Fase 3
 *    SOBREPOSICAO  duas pecas do mesmo bloco ocupando o mesmo chao
 *
 *  E os pipeways (site/pipeways.js mede ao montar): travessia baixa sobre
 *  via, poste na via, vao sem apoio, tubo contra objeto e contra tubo, rota
 *  contra o caminho minimo, succao com ponto alto, torta em bolsao.
 *
 *  Mede-se a caixa da cena, como nas outras auditorias. No console:
 *  __auditarEntorno().
 */
export function auditarEntorno({ objetos, pipeways }) {
  const achados = [...(pipeways?.achados ?? [])];
  const add = (regra, peca, detalhe) => achados.push({ regra, peca, detalhe });
  const blocos = Object.fromEntries(BLOCOS.map((b) => [b.id, b]));
  const caixas = objetos.map((o) => ({ ...o, c: new THREE.Box3().setFromObject(o.grupo) }));

  for (const o of caixas) {
    const { c } = o;
    const piso = o.piso ?? Y.bloco;
    if (c.min.y > piso + 0.05) add('FLUTUA', o.nome, `fundo a ${(c.min.y - piso).toFixed(2)} m do piso`);
    if (c.max.y < piso + 0.01) add('AFUNDA', o.nome, `topo a ${(c.max.y - piso).toFixed(2)} m do piso`);
    const b = blocos[o.bloco];
    if (b && (c.min.x < b.x[0] - 0.3 || c.max.x > b.x[1] + 0.3 || c.min.z < b.z[0] - 0.3 || c.max.z > b.z[1] + 0.3)) {
      add('FORA_DO_BLOCO', o.nome, `sai do bloco ${o.bloco}`);
    }
  }
  // Sobreposicao em planta dentro do mesmo bloco. Coberturas abrigam coisas
  // por baixo e a bacia envolve os tanques: essas nao contam.
  const abriga = (o) => /^cobertura|^bacia|^laje-descarga/.test(o.nome);
  for (let i = 0; i < caixas.length; i++) {
    for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i], b = caixas[j];
      if (a.bloco !== b.bloco || abriga(a) || abriga(b)) continue;
      const f = 0.05;
      if (a.c.min.x < b.c.max.x - f && b.c.min.x < a.c.max.x - f && a.c.min.z < b.c.max.z - f && b.c.min.z < a.c.max.z - f) {
        add('SOBREPOSICAO', `${a.nome} × ${b.nome}`, `no bloco ${a.bloco}`);
      }
    }
  }
  const porRegra = {};
  for (const a of achados) (porRegra[a.regra] ??= []).push(a);
  return { total: achados.length, porRegra, achados };
}
