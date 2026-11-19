import * as THREE from 'three';
import * as SITE from '../data/site.js';
import { PORTAS, LARGURA_ACESSO, ENTRADA_GARAGEM } from '../data/entorno.js';
import { GARAGEM } from '../lib/predio.js';
import {
  VIAS, CALCADAS, BLOCOS, LOTE, CHAO, TRAVESSIA, LARGURA_CALCADA, MEIO_FIO_LARGURA,
} from '../data/site.js';
import {
  ret, segmentos, distPontoSeg, esquinasDasVias, contornarEsquinas, arredondarCurvas, cortarTravessias,
  arcoEsquina, naEsquina,
} from '../lib/plano.js';
import {
  Y, ALTURA_MEIO_FIO, faixa, placa, anelVia, fileteEsquina, travessiaElevada, meioFioAoLongo, placaArredondada,
  materialChao, deslocarSuave, faixaCentral,
} from '../lib/terreno.js';

/**
 * ===========================================================================
 *  CHAO DA PLANTA
 * ===========================================================================
 *  Gramado, brita, vias, calcadas, travessias e meio-fio, como a Fase 13
 *  aprovou em planta. Sem operacao de poligono: a via e a soma de faixas,
 *  curvas e arredondamentos de esquina, todos no MESMO material e na MESMA
 *  altura — a sobreposicao entre eles nao aparece (o que pisca e superficie
 *  de material diferente quase na mesma altura). As camadas de materiais
 *  diferentes ficam a 4 cm ou mais umas das outras (lib/terreno.js, Y), e a
 *  pintura usa deslocamento de profundidade.
 *
 *    gramado   o lote inteiro (Y.lote)
 *    brita     regra CHAO: 15 m em volta do que pega fogo, 3 m das
 *              utilidades, cantos redondos (Y.brita)
 *    via       eixo com a curva no raio da esquina, mais a pista acrescentada
 *              em cada esquina em T (Y.via)
 *    calcada   15 cm acima da pista (Y.calcada), contornando as esquinas, e
 *              cortada onde cruza a via: ali entra a travessia elevada
 *    meio-fio  so onde a pista encosta no gramado: a calcada ja e o meio-fio
 *              dela, e na brita a borda fica no nivel do chao (sarjeta)
 */

const expandir = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
const dentroRet = (x, z, r, f = 0) => x > r.x0 - f && x < r.x1 + f && z > r.z0 - f && z < r.z1 + f;

export function criarChao() {
  const grupo = new THREE.Group();
  grupo.name = 'chao';
  const esquinas = esquinasDasVias(VIAS, SITE);
  // pecas de arredondamento: as esquinas em T e o canto de dentro do vertice
  // onde outra via nasce (que nao vira curva — lib/plano.js, juncao)
  const emT = esquinas.filter((k) => k.tipo === 'T' || k.juncao);
  const af = MEIO_FIO_LARGURA + LARGURA_CALCADA / 2;

  const matVia = materialChao(0x3b3f44, ['asfalto', 4]);
  const matCalcada = materialChao(0xa3a9ae, ['calcada', 2]);
  const matGrama = materialChao(0x8a8a74, ['grama', 4]);
  const matBrita = materialChao(0x8e8c85, ['brita', 3]);

  /* --------------------------------------------------- gramado e brita */
  grupo.add(placa(ret(LOTE), Y.lote, matGrama, 0.04));
  const britas = [];
  for (const regra of CHAO.brita) {
    for (const b of BLOCOS.filter((q) => regra.categorias.includes(q.categoria))) {
      const r = expandir(ret(b), regra.faixa);
      britas.push(r);
      // o de `piso` e o proprio piso do bloco, crescido (site/implantacao.js)
      if (!regra.piso) grupo.add(placaArredondada(r, regra.faixa, Y.brita, matBrita));
    }
  }

  /* -------------------------------------------------------------- vias */
  const eixos = [];
  for (const v of VIAS) {
    if (v.circulo) { grupo.add(anelVia(v.circulo, Y.via, matVia)); continue; }
    const pts = arredondarCurvas(v, esquinas);
    eixos.push({ v, pts });
    grupo.add(faixa(pts, v.largura, Y.via, matVia, 0.06));
  }
  for (const k of emT) grupo.add(fileteEsquina(k, Y.via, matVia));
  for (const v of VIAS.filter((q) => q.tipo === 'principal' && !q.curva || q.id === 'publica')) {
    grupo.add(faixaCentral(v, VIAS));
  }

  /* ------------------------------------------ calcadas e travessias */
  const pedacos = [];
  const travessias = [];
  const espessura = Y.calcada - Y.lote + 0.02;       // a lateral da calcada e o meio-fio dela
  for (const c of CALCADAS) {
    const pts = contornarEsquinas(c.pontos, esquinas, af);
    const { pecas, travessias: tr } = cortarTravessias(pts, VIAS);
    for (const p of pecas) {
      pedacos.push(p.pontos);
      grupo.add(faixa(p.pontos, LARGURA_CALCADA, Y.calcada, matCalcada, espessura, null,
        { pontas: [!p.cortadaIni, !p.cortadaFim] }));
    }
    travessias.push(...tr.map((t) => ({ ...t, calcada: c.id })));
  }
  // calcada de acesso: da porta de cada predio ate a rede (PORTAS, entorno.js)
  for (const a of PORTAS) {
    // sem a ponta redonda na porta: ela entrava no predio, 2 cm acima do piso dele
    if (a.acesso) grupo.add(faixa(a.acesso, LARGURA_ACESSO, Y.calcada, matCalcada, espessura, null, { pontas: [false, true] }));
  }
  // patio de concreto entre o fim da via de servico e o portao do armazem
  grupo.add(faixa(ENTRADA_GARAGEM.patio, GARAGEM.largura + 1, Y.calcada, matCalcada, espessura, null, { pontas: [false, false] }));
  for (const t of travessias) {
    grupo.add(travessiaElevada({
      x: t.x, z: t.z, dv: t.dv, largura: t.largura, plataforma: TRAVESSIA.plataforma, rampa: TRAVESSIA.rampa,
      yVia: Y.via, yTopo: Y.calcada, material: matVia,
    }));
  }

  /* ---------------------------------------------------------- meio-fio */
  const meiaVia = (v, x, z) => (v.circulo
    ? Math.abs(Math.hypot(x - v.circulo.x, z - v.circulo.z) - v.circulo.raio) < v.largura / 2 + 0.05
    : eixos.find((e) => e.v === v).pts.some((p, i, a) => i > 0 && distPontoSeg([x, z], a[i - 1], p) < v.largura / 2 + 0.05));
  const naTravessia = (x, z) => travessias.some((t) => {
    const dx = x - t.x, dz = z - t.z;
    const ao = Math.abs(dx * t.dv[0] + dz * t.dv[1]);           // no sentido do trafego
    const tr = Math.abs(-dx * t.dv[1] + dz * t.dv[0]);           // na travessia
    return ao < TRAVESSIA.plataforma / 2 + TRAVESSIA.rampa + 0.1 && tr < t.largura / 2 + 0.3;
  });
  const naCalcada = (x, z) => pedacos.some((pts) => pts.some((p, i) => i > 0
    && distPontoSeg([x, z], pts[i - 1], p) < LARGURA_CALCADA / 2 + MEIO_FIO_LARGURA + 0.05));
  const blocosR = BLOCOS.filter((b) => b.categoria !== 'verde').map(ret);
  const livrePara = (propria) => (x, z) => !naCalcada(x, z)
    && !VIAS.some((v) => v !== propria && meiaVia(v, x, z))
    && !emT.some((k) => naEsquina([x, z], k))
    && !naTravessia(x, z)
    && !britas.some((r) => dentroRet(x, z, r))
    && !blocosR.some((r) => dentroRet(x, z, r, 0.1));
  const lm = MEIO_FIO_LARGURA;
  const opt = { yVia: Y.via, altura: ALTURA_MEIO_FIO, largura: lm };
  for (const { v, pts } of eixos) {
    for (const s of [1, -1]) grupo.add(meioFioAoLongo(deslocarSuave(pts, s * (v.largura / 2 + lm / 2)), livrePara(v), opt));
  }
  for (const v of VIAS.filter((q) => q.circulo)) {
    const { x, z, raio } = v.circulo;
    for (const R of [raio - v.largura / 2 - lm / 2, raio + v.largura / 2 + lm / 2]) {
      const linha = Array.from({ length: 97 }, (_, i) => [x + R * Math.cos((i / 96) * 2 * Math.PI), z + R * Math.sin((i / 96) * 2 * Math.PI)]);
      grupo.add(meioFioAoLongo(linha, livrePara(v), opt));
    }
  }
  for (const k of emT) {
    // pelo lado do gramado do arredondamento; das vias dele nao se exclui nada
    const vias = k.vias.map((id) => VIAS.find((v) => v.id === id));
    const livre = (x, z) => !naCalcada(x, z) && !VIAS.some((v) => !vias.includes(v) && meiaVia(v, x, z))
      && !naTravessia(x, z) && !britas.some((r) => dentroRet(x, z, r)) && !blocosR.some((r) => dentroRet(x, z, r, 0.1));
    grupo.add(meioFioAoLongo(arcoEsquina(k, k.r - lm / 2, 4), livre, opt));
  }

  return { grupo, esquinas, travessias, calcadas: pedacos };
}
