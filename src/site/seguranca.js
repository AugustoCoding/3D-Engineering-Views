import * as THREE from 'three';
import { rotulo, cota } from '../lib/dimensions.js';
import {
  criarHidrante, criarMonitor, criarLavaOlhos, criarExtintor, criarBiruta, criarCameraCftv,
  criarZonaEsfera, criarZonaCaixa, criarFaixaFuga, criarPlacaEncontro,
} from '../lib/seguranca.js';
import { Y } from '../lib/terreno.js';
import { BLOCOS, VIAS, CALCADAS, TANQUES, LARGURA_CALCADA, vetorBarlavento, VENTO, LOTE, PORTOES } from '../data/site.js';
import * as SITE from '../data/site.js';
import { esquinasDasVias, retangulosDaEsquina } from '../lib/plano.js';
import { EXTRAS } from '../data/plant-extra.js';
import { BACIA } from '../data/entorno.js';
import {
  ZONAS, IGNICAO, COBERTURA, ALVOS, ANEIS_HIDRANTE, MONITORES, BIRUTAS, ROTAS_FUGA,
} from '../data/seguranca.js';
import { medidasDePlanta } from './implantacao.js';

/**
 * ===========================================================================
 *  SEGURANCA — combate, emergencia e a camada de projeto  (Fase 8)
 * ===========================================================================
 *  O equipamento nao e posto a mao: cada regra de data/seguranca.js diz o
 *  alcance e quem tem de ser coberto, e aqui se escolhe, entre os pontos
 *  livres (fora de via, calcada, equipamento, tubo baixo e poste), o menor
 *  conjunto que cobre todos — guloso, o candidato que mais falta cobre
 *  primeiro. A auditoria mede de volta a cobertura, o choque, a fonte de
 *  ignicao em zona e a rota de fuga.
 *
 *  O alcance e medido em planta, em linha reta: o percurso real e maior,
 *  entao a escolha usa 85 % dele e a auditoria, o alcance inteiro.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f1 = (v) => v.toFixed(1).replace('.', ',');
const bloco = (id) => BLOCOS.find((b) => b.id === id);
const ret = (b) => ({ x0: b.x[0], x1: b.x[1], z0: b.z[0], z1: b.z[1] });
const expandir = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
const sobrepoe = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const dentro = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const plano = (c) => ({ x0: c.min.x, x1: c.max.x, z0: c.min.z, z1: c.max.z });
const MARGEM_ESCOLHA = 0.85;

/** Retangulos das vias e calcadas: piso de passagem, nada fica nele. */
function passagens() {
  const out = [];
  const add = (pts, largura) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const m = largura / 2;
      out.push({ x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m });
    }
  };
  for (const v of VIAS) add(v.pontos, v.largura);
  // a pista que o arredondamento das esquinas acrescenta (Fase 14)
  out.push(...esquinasDasVias(VIAS, SITE).flatMap((k) => retangulosDaEsquina(k)));
  for (const c of CALCADAS) add(c.pontos, LARGURA_CALCADA);
  return out;
}

/** Retangulos em planta dos segmentos de tubo abaixo de `yMax`. */
function tubosBaixos(caminhos, yMax, folga) {
  const out = [];
  for (const c of caminhos) {
    const r = (c.r ?? c.od / 2) + folga;
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i];
      if (Math.min(a.y, b.y) - r > yMax) continue;
      out.push({ x0: Math.min(a.x, b.x) - r, x1: Math.max(a.x, b.x) + r, z0: Math.min(a.z, b.z) - r, z1: Math.max(a.z, b.z) + r });
    }
  }
  return out;
}

export function criarSeguranca({ todos, tubulacao, instrumentacao, entorno, pipeways, alivio }) {
  const grupo = new THREE.Group();
  grupo.name = 'seguranca';
  const camada = new THREE.Group();
  camada.name = 'camada-seguranca';
  camada.visible = false;                         // liga no HUD
  grupo.add(camada);
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  camada.add(rotulos);
  const achados = [];
  const achar = (regra, peca, detalhe) => achados.push({ regra, peca, detalhe });
  const doEntorno = Object.fromEntries(entorno.objetos.map((o) => [o.nome, o.grupo]));
  const centroDe = (g) => { const c = new THREE.Box3().setFromObject(g).getCenter(V(0, 0, 0)); return [c.x, c.z]; };

  /* ======================================================================
   *  1. Alvos de cada regra
   * =================================================================== */
  const ehBomba = (tag) => /^bomba/.test(EXTRAS[tag]?.tipo ?? '');
  const bombasFora = pipeways.objetos.filter((o) => /^B/.test(o.nome));
  const alvosDe = {
    processo: () => Object.entries(todos).map(([tag, e]) => ({ nome: tag, p: centroDe(e.grupo) })),
    tanques: () => TANQUES.map((t) => ({ nome: t.id, p: [t.x, t.z] })),
    carga: () => ['braco-1', 'braco-2'].map((n) => ({ nome: n, p: centroDe(doEntorno[n]) })),
    bombas: () => [
      ...Object.keys(todos).filter(ehBomba).map((tag) => ({ nome: tag, p: centroDe(todos[tag].grupo) })),
      // a bomba de tolueno de fora; as de agua da torre nao pedem lava-olhos
      ...bombasFora.filter((o) => o.nome === 'BT-01').map((o) => ({ nome: o.nome, p: centroDe(o.grupo) })),
    ],
    filtros: () => ['F-01', 'F-02'].map((tag) => ({ nome: tag, p: centroDe(todos[tag].grupo) })),
    'bombas-fora': () => bombasFora.map((o) => ({ nome: o.nome, p: centroDe(o.grupo) })),
    caldeira: () => [{ nome: 'caldeira', p: centroDe(doEntorno.caldeira) }],
  };
  const alvos = (regra) => ALVOS[regra].flatMap((k) => alvosDe[k]());

  /* ======================================================================
   *  2. Onde cabe uma peca: fora de passagem, equipamento, tubo e poste
   * =================================================================== */
  const vias = passagens();
  const obst = [];
  obst.push(...tubulacao.ocupados);
  obst.push(...tubosBaixos(tubulacao.tubos, 2.6, 0.3));
  obst.push(...tubosBaixos(pipeways.caminhos, 2.6, 0.3));
  instrumentacao.grupo.traverse((o) => {
    if (!o.isMesh) return;
    const c = new THREE.Box3().setFromObject(o);
    if (c.min.y < 2.5) obst.push(expandir(plano(c), 0.2));
  });
  for (const o of entorno.objetos) {
    if (/^bacia/.test(o.nome)) continue;
    obst.push(plano(new THREE.Box3().setFromObject(o.grupo)));
  }
  pipeways.grupo.traverse((o) => {
    if (/^poste-pipeway|^apoio$|^caixa-inspecao|^base-/.test(o.name)) obst.push(plano(new THREE.Box3().setFromObject(o)));
  });
  for (const o of pipeways.objetos) obst.push(o.pegada);
  // a mureta da bacia
  const tq = bloco(BACIA.bloco);
  const rb = { x0: tq.x[0] + BACIA.recuo, x1: tq.x[1] - BACIA.recuo, z0: tq.z[0] + BACIA.recuo, z1: tq.z[1] - BACIA.recuo };
  for (const m of [
    { ...rb, z1: rb.z0 + BACIA.largura }, { ...rb, z0: rb.z1 - BACIA.largura },
    { ...rb, x1: rb.x0 + BACIA.largura }, { ...rb, x0: rb.x1 - BACIA.largura },
  ]) obst.push(m);
  const pecas = [];                                // { x, z, raio }
  const livre = (x, z, raio) => {
    const pe = { x0: x - raio, x1: x + raio, z0: z - raio, z1: z + raio };
    const pf = expandir(pe, COBERTURA.folga);
    return !vias.some((v) => sobrepoe(pe, expandir(v, 0.3)))
      && !obst.some((o) => sobrepoe(pf, o))
      && !pecas.some((p) => Math.hypot(p.x - x, p.z - z) < p.raio + raio + COBERTURA.folga);
  };

  /** Escolha gulosa: cobre cada alvo `minimo` vezes, `espaco` m entre pecas. */
  function escolher(candidatos, lista, alcance, minimo, espaco, raio) {
    const conta = lista.map(() => 0);
    const escolhidos = [];
    const R = alcance * MARGEM_ESCOLHA;
    for (;;) {
      let melhor = null;
      for (const c of candidatos) {
        if (escolhidos.some((e) => Math.hypot(e[0] - c[0], e[1] - c[1]) < espaco)) continue;
        if (!livre(c[0], c[1], raio)) continue;
        let s = 0, dist = 0;
        lista.forEach((a, i) => {
          const d = Math.hypot(a.p[0] - c[0], a.p[1] - c[1]);
          if (d <= R && conta[i] < minimo) { s++; dist += d; }
        });
        if (s && (!melhor || s > melhor.s || (s === melhor.s && dist < melhor.dist))) melhor = { c, s, dist };
      }
      if (!melhor) break;
      escolhidos.push(melhor.c);
      pecas.push({ x: melhor.c[0], z: melhor.c[1], raio });
      lista.forEach((a, i) => { if (Math.hypot(a.p[0] - melhor.c[0], a.p[1] - melhor.c[1]) <= R) conta[i]++; });
    }
    return escolhidos;
  }

  const grade = (r, passo) => {
    const out = [];
    for (let x = r.x0; x <= r.x1 + 1e-6; x += passo) for (let z = r.z0; z <= r.z1 + 1e-6; z += passo) out.push([x, z]);
    return out;
  };
  const isbl = ret(bloco('ISBL'));
  const naLaje = grade(expandir(isbl, -0.8), 1.0);
  const emVolta = (centros, raio, passo = 1.0) => centros.flatMap((c) => grade({ x0: c[0] - raio, x1: c[0] + raio, z0: c[1] - raio, z1: c[1] + raio }, passo))
    .filter(([x, z]) => !dentro(x, z, expandir(isbl, 0.5)));

  /* ======================================================================
   *  3. Equipamento de combate e emergencia (sempre a vista)
   * =================================================================== */
  const itens = [];                                // { tipo, nome, x, z, grupo, regra }
  function por(tipo, nome, x, z, peca, ficha, y = 0) {
    peca.grupo.position.set(x, y, z);
    peca.grupo.name = nome;
    peca.grupo.userData.ficha = ficha;
    grupo.add(peca.grupo);
    itens.push({ tipo, nome, x, z, raio: peca.raio, grupo: peca.grupo });
  }
  const fichaRegra = (titulo, sub, regra, extra = {}) => ({
    titulo, subtitulo: sub,
    grupos: [{ nome: 'Regra (adotado)', dados: { 'Alcance': `${f1(regra.alcance)} m`, 'Fonte': regra.fonte, ...extra } }],
  });

  // Primeiro as pecas de lugar fixo; depois as de cobertura, que desviam delas.
  // --- canhoes monitores do parque de tanques ---
  MONITORES.forEach(({ x, z }, i) => {
    if (!livre(x, z, 0.45)) achar('PECA_x_OBJETO', `Canhão M-0${i + 1}`, 'posição ocupada ou em via');
    pecas.push({ x, z, raio: 0.45 });
    // o esguicho fica virado para o meio do parque que ele protege (Fase 27:
    // o jato do teste sai para la, nao para as costas)
    const mon = criarMonitor();
    const tq = BLOCOS.find((b) => b.id === 'TANQUES');
    mon.grupo.rotation.y = Math.atan2(-((tq.z[0] + tq.z[1]) / 2 - z), (tq.x[0] + tq.x[1]) / 2 - x);
    por('monitor', `M-0${i + 1}`, x, z, mon,
      fichaRegra(`Canhão monitor M-0${i + 1}`, 'Parque de tanques', COBERTURA.monitor));
  });

  // --- cameras de seguranca (Fase 27, item 25) [ADOTADO]: uma em cada canto
  // do lote, 3 m para dentro da cerca e mirando o meio dele, e uma de cada
  // lado do portao principal; se o lugar esta tomado, anda para dentro
  {
    const cx = (LOTE.x[0] + LOTE.x[1]) / 2, cz = (LOTE.z[0] + LOTE.z[1]) / 2;
    const portao = PORTOES.find((p) => p.id === 'principal');
    const lugares = [
      ...[[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => ({ x: LOTE.x[i] + (i ? -3 : 3), z: LOTE.z[j] + (j ? -3 : 3), alvo: [cx, cz] })),
      ...(portao ? [-9, 9].map((dx) => ({ x: portao.x + dx, z: portao.z - 3, alvo: [portao.x, portao.z + 6] })) : []),
    ];
    lugares.forEach(({ x, z, alvo }, i) => {
      const d = [alvo[0] - x, alvo[1] - z], L = Math.hypot(...d), u = [d[0] / L, d[1] / L];
      let k = 0;
      while (k < 12 && !livre(x + u[0] * k, z + u[1] * k, 0.4)) k++;
      if (k === 12) return;
      const px = x + u[0] * k, pz = z + u[1] * k;
      pecas.push({ x: px, z: pz, raio: 0.4 });
      por('cftv', `CFTV-0${i + 1}`, px, pz, criarCameraCftv({ olhar: Math.atan2(-u[1], u[0]) }),
        { titulo: `Câmera CFTV-0${i + 1}`, subtitulo: 'Vigilância patrimonial', grupos: [] });
    });
  }

  // --- birutas ---
  const [bx, bz] = vetorBarlavento(VENTO.de);
  const para = [-bx, -bz];
  for (const b of BIRUTAS) {
    let x, z, y = 0;
    if (b.onde === 'rack') {
      const R = tubulacao.rack;
      x = R.xs[R.xs.length - 1];
      z = R.z - R.largura / 2;
      y = Math.max(...R.niveis);
    } else {
      ({ x, z } = b);
      if (!livre(x, z, 0.3)) achar('PECA_x_OBJETO', 'Biruta', `(${f1(x)}; ${f1(z)}) ocupada ou em via`);
      pecas.push({ x, z, raio: 0.3 });
    }
    por('biruta', 'biruta', x, z, criarBiruta({ altura: b.altura, para }), {
      titulo: 'Biruta', subtitulo: 'Indica de onde vem o vento',
      grupos: [{ nome: 'Adotado', dados: {
        'Vento predominante': `de ${VENTO.rotulo} (${VENTO.de}°)`,
        'Por quê': 'Quem foge lê o vento antes de escolher o caminho e o ponto de encontro',
      } }],
    }, y);
  }

  // --- placas dos pontos de encontro ---
  for (const id of ['ENCONTRO-1', 'ENCONTRO-2']) {
    const b = bloco(id);
    pecas.push({ x: (b.x[0] + b.x[1]) / 2, z: (b.z[0] + b.z[1]) / 2, raio: 0.9 });
    por('placa', `placa-${id}`, (b.x[0] + b.x[1]) / 2, (b.z[0] + b.z[1]) / 2, criarPlacaEncontro(), {
      titulo: b.nome, subtitulo: id === 'ENCONTRO-1' ? 'A barlavento do vento de SE' : 'Alternativo, para vento de S',
      grupos: [{ nome: 'Adotado', dados: { 'Área': `${(b.x[1] - b.x[0]) * (b.z[1] - b.z[0])} m²` } }],
    }, Y.bloco);
  }

  // --- hidrantes: no acostamento de fora dos aneis e em volta da baia ---
  const candH = [];
  for (const id of ANEIS_HIDRANTE) {
    const v = VIAS.find((q) => q.id === id);
    const xs = v.pontos.map((p) => p[0]), zs = v.pontos.map((p) => p[1]);
    const off = v.largura / 2 + COBERTURA.hidrante.afastamento;
    const r = { x0: Math.min(...xs) - off, x1: Math.max(...xs) + off, z0: Math.min(...zs) - off, z1: Math.max(...zs) + off };
    for (let x = r.x0; x <= r.x1; x += 1) candH.push([x, r.z0], [x, r.z1]);
    for (let z = r.z0; z <= r.z1; z += 1) candH.push([r.x0, z], [r.x1, z]);
  }
  {
    const d = expandir(ret(bloco('DESCARGA')), 2);
    for (let x = d.x0; x <= d.x1; x += 1) candH.push([x, d.z0], [x, d.z1]);
    for (let z = d.z0; z <= d.z1; z += 1) candH.push([d.x0, z], [d.x1, z]);
  }
  const alvosH = alvos('hidrante');
  const hs = escolher(candH, alvosH, COBERTURA.hidrante.alcance, COBERTURA.hidrante.minimo, 20, 0.3);
  hs.forEach(([x, z], i) => por('hidrante', `H-${String(i + 1).padStart(2, '0')}`, x, z, criarHidrante(),
    fichaRegra(`Hidrante H-${String(i + 1).padStart(2, '0')}`, 'Coluna com duas saídas de 2½"', COBERTURA.hidrante,
      { 'Cada alvo': `${COBERTURA.hidrante.minimo} hidrantes ao alcance` })));

  // --- chuveiros lava-olhos: na laje e junto das fontes de fora ---
  const alvosL = alvos('lavaOlhos');
  const candL = [...naLaje, ...emVolta(alvosL.filter((a) => !dentro(a.p[0], a.p[1], isbl)).map((a) => a.p), 8)];
  escolher(candL, alvosL, COBERTURA.lavaOlhos.alcance, 1, 6, 0.4).forEach(([x, z], i) => {
    por('lavaOlhos', `LO-${String(i + 1).padStart(2, '0')}`, x, z, criarLavaOlhos(),
      fichaRegra(`Chuveiro e lava-olhos LO-${String(i + 1).padStart(2, '0')}`, 'Emergência — respingo de tolueno ou ácido',
        COBERTURA.lavaOlhos));
  });

  // --- extintores ---
  const alvosE = alvos('extintor');
  const candE = [...naLaje, ...emVolta(alvosE.filter((a) => !dentro(a.p[0], a.p[1], isbl)).map((a) => a.p), 8)];
  escolher(candE, alvosE, COBERTURA.extintor.alcance, 1, 4, 0.25).forEach(([x, z], i) => {
    por('extintor', `EX-${String(i + 1).padStart(2, '0')}`, x, z, criarExtintor(),
      fichaRegra(`Extintor EX-${String(i + 1).padStart(2, '0')}`, 'Pó BC, 12 kg (estimado)', COBERTURA.extintor));
  });

  /* ======================================================================
   *  4. Camada de projeto: zonas, distancias e rotas de fuga
   * =================================================================== */
  const zonas = [];                                // { nome, zona, tipo: 'esfera'|'caixa', c, r | caixa }
  const esfera = (nome, c, r, z) => { zonas.push({ nome, zona: z, tipo: 'esfera', c, r }); camada.add(criarZonaEsfera(c, r, z)); };
  const caixaZ = (nome, cx, z, op) => { zonas.push({ nome, zona: z, tipo: 'caixa', caixa: cx }); camada.add(criarZonaCaixa(cx, z, op)); };
  const ZR = ZONAS.respiro;
  // respiro no topo de cada tanque
  for (const t of TANQUES) {
    const { R, yFundo } = doEntorno[t.id].userData.tanque;
    const topo = V(t.x, Y.bloco + yFundo + t.H + R / 16 + 0.3, t.z);
    esfera(`respiro ${t.id}`, topo, ZR.zona1, 1);
    esfera(`respiro ${t.id}`, topo, ZR.zona2, 2);
  }
  // vent, respiro do TK-01, exaustao das bombas de vacuo e descarga das PSVs
  for (const p of [...tubulacao.pontas.filter((q) => q.id !== 'AR'), ...(alivio?.pontas ?? [])]) {
    esfera(`ponta ${p.id}`, p.pos, ZR.zona1, 1);
    esfera(`ponta ${p.id}`, p.pos, ZR.zona2, 2);
  }
  // dentro do dique, ate o topo da mureta
  caixaZ('bacia', { ...rb, y0: Y.bloco, y1: Y.bloco + ZONAS.bacia.altura }, 2, 0.14);
  // descarga: conexao do caminhao, na ponta de cada braco
  const ZD = ZONAS.descarga;
  const conexoes = ['braco-1', 'braco-2'].map((n) => {
    const g = doEntorno[n];
    g.updateWorldMatrix(true, true);
    return g.localToWorld(V(2.6, 1.95, 0));
  });
  for (const c of conexoes) { esfera('conexão do caminhão', c, ZD.zona1, 1); esfera('conexão do caminhão', c, ZD.zona2, 2); }
  {
    const xs = conexoes.map((c) => c.x), zs = conexoes.map((c) => c.z);
    caixaZ('camada da descarga', { x0: Math.min(...xs) - ZD.alcanceCamada, x1: Math.max(...xs) + ZD.alcanceCamada,
      z0: Math.min(...zs) - ZD.alcanceCamada, z1: Math.max(...zs) + ZD.alcanceCamada, y0: Y.bloco, y1: Y.bloco + ZD.camada }, 2, 0.12);
  }
  // area de processo
  const ZP = ZONAS.processo;
  caixaZ('área de processo', { ...expandir(isbl, ZP.alcance), y0: 0, y1: ZP.altura }, 2, 0.05);
  caixaZ('camada da área de processo', { ...expandir(isbl, ZP.alcanceCamada), y0: Y.lote, y1: ZP.camada }, 2, 0.1);
  for (const [txt, p] of [
    ['Zona 2 — área de processo (API RP 505, ilustrativa)', V(isbl.x1 + ZP.alcance, ZP.altura + 0.3, isbl.z0 - ZP.alcance)],
    ['Zona 2 — dentro do dique', V(rb.x1, Y.bloco + 1.4, rb.z1)],
    ['Zonas 1 e 2 — descarga de caminhão', conexoes[0].clone().add(V(0, 4.8, 0))],
  ]) {
    const l = rotulo(txt, 'linha-label');
    l.position.copy(p);
    rotulos.add(l);
  }

  // distancias de separacao no chao, com a regra
  for (const m of medidasDePlanta()) {
    const a = V(m.p[0], 0.35, m.p[1]), b = V(m.q[0], 0.35, m.q[1]);
    const ok = !m.regra || m.d >= m.regra.min - 1e-6;
    const txt = m.regra ? `${m.texto} m — ${m.regra.fonte}` : m.texto;
    const c = cota(a, b, txt, { classe: 'cota-label', tick: 1.5 });
    c.traverse((o) => { if (o.material && !o.isCSS2DObject) o.material = new THREE.LineBasicMaterial({ color: ok ? 0x7cf0a8 : 0xff5a4f }); });
    camada.add(c);
  }

  // rotas de fuga
  const comprimentos = {};
  for (const r of ROTAS_FUGA) {
    camada.add(criarFaixaFuga(r.pontos));
    let L = 0;
    for (let i = 1; i < r.pontos.length; i++) L += Math.hypot(r.pontos[i][0] - r.pontos[i - 1][0], r.pontos[i][1] - r.pontos[i - 1][1]);
    comprimentos[r.id] = L;
    const l = rotulo(`${r.id} → ${bloco(r.para).nome} (${Math.round(L)} m)`, 'linha-label');
    l.position.set(r.pontos[0][0], 1.2, r.pontos[0][1]);
    rotulos.add(l);
  }

  /* ======================================================================
   *  5. Auditoria
   * =================================================================== */
  const cobertura = {};
  const medir = (regra, tipo, minimo) => {
    const pontos = itens.filter((i) => i.tipo === tipo);
    const lista = alvos(regra);
    let piorFolga = Infinity;
    for (const a of lista) {
      const ds = pontos.map((p) => Math.hypot(p.x - a.p[0], p.z - a.p[1])).sort((u, w) => u - w);
      const n = ds.filter((d) => d <= COBERTURA[regra].alcance).length;
      if (n < minimo) achar('SEM_COBERTURA', `${a.nome}`, `${regra}: ${n} de ${minimo} ao alcance de ${f1(COBERTURA[regra].alcance)} m (mais perto a ${f1(ds[minimo - 1] ?? Infinity)} m)`);
      piorFolga = Math.min(piorFolga, COBERTURA[regra].alcance - (ds[minimo - 1] ?? Infinity));
    }
    cobertura[regra] = { pecas: pontos.length, alvos: lista.length, folgaMin: +piorFolga.toFixed(1) };
  };
  medir('hidrante', 'hidrante', COBERTURA.hidrante.minimo);
  medir('monitor', 'monitor', COBERTURA.monitor.minimo);
  medir('lavaOlhos', 'lavaOlhos', 1);
  medir('extintor', 'extintor', 1);

  // peca em via ou calcada
  for (const it of itens) {
    if (it.tipo === 'biruta' && it.grupo.position.y > 1) continue;      // a do rack fica no alto
    const pe = { x0: it.x - it.raio, x1: it.x + it.raio, z0: it.z - it.raio, z1: it.z + it.raio };
    if (vias.some((v) => sobrepoe(pe, v))) achar('PECA_NA_VIA', it.nome, `(${f1(it.x)}; ${f1(it.z)})`);
  }

  // fonte de ignicao dentro de zona
  const dentroZona = (p, z) => (z.tipo === 'esfera' ? p.distanceTo(z.c) < z.r
    : p.x > z.caixa.x0 && p.x < z.caixa.x1 && p.z > z.caixa.z0 && p.z < z.caixa.z1 && p.y > z.caixa.y0 && p.y < z.caixa.y1);
  for (const b of BLOCOS.filter((q) => IGNICAO.includes(q.categoria))) {
    const r = ret(b);
    for (const z of zonas) {
      const cx = z.tipo === 'esfera' ? { x0: z.c.x - z.r, x1: z.c.x + z.r, z0: z.c.z - z.r, z1: z.c.z + z.r } : z.caixa;
      if (sobrepoe(r, cx)) achar('IGNICAO_NA_ZONA', b.nome, `dentro da zona ${z.zona} (${z.nome})`);
    }
  }

  // rota de fuga: livre, sem voltar a zona depois de sair, chega ao destino
  const obstRota = [];
  for (const o of entorno.objetos) {
    if (/^bacia|^laje-descarga|^cobertura/.test(o.nome)) continue;
    obstRota.push({ nome: o.nome, r: plano(new THREE.Box3().setFromObject(o.grupo)) });
  }
  pipeways.grupo.traverse((o) => {
    if (/^poste-pipeway|^apoio$|^base-/.test(o.name)) obstRota.push({ nome: 'pipeway', r: plano(new THREE.Box3().setFromObject(o)) });
  });
  for (const r of tubosBaixos(pipeways.caminhos, 2.1, 0)) obstRota.push({ nome: 'tubo baixo', r });
  for (const it of itens) if (!(it.tipo === 'biruta' && it.grupo.position.y > 1)) obstRota.push({ nome: it.nome, r: expandir({ x0: it.x, x1: it.x, z0: it.z, z1: it.z }, it.raio) });
  for (const r of ROTAS_FUGA) {
    const origem = ret(bloco(r.de));
    const destino = ret(bloco(r.para));         // chegou: la dentro e o ponto de encontro
    let saiu = false, bateu = null, voltou = null;
    for (let i = 1; i < r.pontos.length; i++) {
      const [ax, az] = r.pontos[i - 1], [bx2, bz2] = r.pontos[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx2 - ax, bz2 - az) / 0.5));
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx2 - ax) * k) / n, z = az + ((bz2 - az) * k) / n;
        const p = V(x, 0.3, z);
        const naZona = zonas.some((q) => dentroZona(p, q));
        if (!naZona) saiu = true;
        else if (saiu && !voltou) voltou = `(${f1(x)}; ${f1(z)})`;
        if (!bateu && !dentro(x, z, expandir(origem, 0.5)) && !dentro(x, z, destino)) {
          const o = obstRota.find((q) => dentro(x, z, expandir(q.r, 0.4)));
          if (o) bateu = `${o.nome} em (${f1(x)}; ${f1(z)})`;
        }
      }
    }
    if (bateu) achar('ROTA_BLOQUEADA', r.id, bateu);
    if (voltou) achar('ROTA_POR_ZONA', r.id, `volta a uma zona classificada em ${voltou}`);
    const fim = r.pontos[r.pontos.length - 1];
    if (!dentro(fim[0], fim[1], ret(bloco(r.para)))) achar('ROTA_SEM_DESTINO', r.id, `não termina em ${r.para}`);
  }

  const contagem = Object.fromEntries(['hidrante', 'monitor', 'lavaOlhos', 'extintor', 'biruta']
    .map((t) => [t, itens.filter((i) => i.tipo === t).length]));
  return { grupo, camada, rotulos, achados, cobertura, contagem, rotas: comprimentos, itens };
}
