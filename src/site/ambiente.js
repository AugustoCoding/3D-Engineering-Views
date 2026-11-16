import * as THREE from 'three';
import {
  partesArvore, partesArbusto, partesPoste, partesCarro, grupoDe, instanciar, RAIO_COPA, GIROFLEX,
  partesPostePedestre, partesPosteEstacionamento, partesLuminariaTeto, partesArandela, partesProjetorParede, partesPostePerimetro, partesLuminariaPipeway, luminariasDoPoste,
  criarCaminhaoTanque, criarCaminhaoBau, criarOnibus, criarPlacaEmpresa,
} from '../lib/ambiente.js';
import { criarPessoa, PASSADA } from '../lib/human.js';
import { vagasDe, Y } from '../lib/terreno.js';
import { ret, dirPlana, direita, deslocar, distRetRet, esquinasDasVias, retangulosDaEsquina, distPontoSeg as distPontoSegAcesso, suavizar, arco, redeDePolilinhas, distPontoRet as distPontoRetT } from '../lib/plano.js';
import { PAPEIS } from '../data/rotinas.js';
import * as SITE from '../data/site.js';
import { BLOCOS, VIAS, LOTE, LARGURA_CALCADA, TRAVESSIA, CHAO, VEICULOS, GIRO_CAMINHAO, CALCADAS as CALCADAS_SITE } from '../data/site.js';
import { VAGA, PORTAS, LARGURA_ACESSO, PREDIOS, retDoPredio, CERCA } from '../data/entorno.js';
import { ALVOS, LUMINARIAS, REGRAS, areasDeLuz, ladosDaCerca, emEmergencia } from '../data/iluminacao.js';
import { passoPorAlvo, passoDeArea, prepararLuminarias, iluminancia, estatistica, fecha } from '../lib/fotometria.js';
import { ARVORES, CARROS, PLACA, PESSOAS, TRAFEGO, CALCADAS, CANTEIROS, PORTARIA_TRAFEGO } from '../data/ambiente.js';

/**
 * ===========================================================================
 *  AMBIENTACAO E TRAFEGO  (Fase 9)
 * ===========================================================================
 *  Arvores, postes e carros parados em InstancedMesh — uma chamada de
 *  desenho por parte, nao por peca. Cada peca vai onde a regra pede e o
 *  lugar esta livre: fora de via e calcada, de predio, de pipeway e do
 *  equipamento de emergencia; arvore longe de area de risco; poste nunca
 *  sob ponte de tubos.
 *
 *  O trafego anda sobre as vias e calcadas de site.js, na mao direita.
 *  `atualizar(dt)` roda no laco da cena enquanto a animacao esta ligada.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f1 = (v) => v.toFixed(1).replace('.', ',');
const bloco = (id) => BLOCOS.find((b) => b.id === id);
const expandir = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
const sobrepoe = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const dentro = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const quadrado = (x, z, r) => ({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });
const plano = (c) => ({ x0: c.min.x, x1: c.max.x, z0: c.min.z, z1: c.max.z });

/** Sorteio com semente: a mesma maquete em toda maquina. */
function sorteio(semente) {
  let s = semente >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Retangulos de uma polilinha com largura. */
function faixas(pts, largura) {
  const m = largura / 2;
  return pts.slice(1).map((q, i) => {
    const p = pts[i];
    return { x0: Math.min(p[0], q[0]) - m, x1: Math.max(p[0], q[0]) + m, z0: Math.min(p[1], q[1]) - m, z1: Math.max(p[1], q[1]) + m };
  });
}

/**
 * Percurso parametrizado pelo comprimento: posicao e rumo em `s`. A posicao
 * e a media de tres pontos (corta a quina da curva) e o rumo, a corda de 3 m
 * em volta — o veiculo faz a curva em vez de girar no lugar.
 */
function percurso(pontos) {
  const acum = [0];
  for (let i = 1; i < pontos.length; i++) acum.push(acum[i - 1] + Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]));
  const L = acum[acum.length - 1];
  const em = (s) => {
    s = Math.max(0, Math.min(L, s));
    // busca binaria: a previsao do trafego (Fase 19) chama isto muitas vezes
    let lo = 1, hi = acum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (acum[m] < s) lo = m + 1; else hi = m; }
    const i = lo;
    const t = (s - acum[i - 1]) / Math.max(acum[i] - acum[i - 1], 1e-9);
    return [pontos[i - 1][0] + (pontos[i][0] - pontos[i - 1][0]) * t, pontos[i - 1][1] + (pontos[i][1] - pontos[i - 1][1]) * t];
  };
  const pose = (s) => {
    // corda de 3 m em volta; perto da ponta ela encolhe, para o rumo ser o
    // do fim do caminho (na troca de frente para re, sem pulo — Fase 19)
    const h = Math.max(0.05, Math.min(1.5, s, L - s));
    const a = em(s - h), b = em(s + h), c = em(s);
    const p = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    const rumo = Math.atan2(b[0] - a[0], b[1] - a[1]);  // frente em +Z
    return { x: p[0], z: p[1], rumo };
  };
  return { L, em, pose, pontos };
}

export function criarAmbiente({ entorno, pipeways, seguranca, tubulacao, chao }) {
  const grupo = new THREE.Group();
  grupo.name = 'ambiente';
  const achados = [];
  const achar = (regra, peca, detalhe) => achados.push({ regra, peca, detalhe });
  const lote = ret({ x: LOTE.x, z: LOTE.z });
  const isbl = ret(bloco('ISBL'));

  /* ======================================================================
   *  1. Lugar livre
   * =================================================================== */
  const vias = [...VIAS.flatMap((v) => faixas(v.pontos, v.largura)),
    ...esquinasDasVias(VIAS, SITE).flatMap((k) => retangulosDaEsquina(k))];
  const calcadas = CALCADAS.flatMap((c) => faixas(c.pontos, LARGURA_CALCADA));
  const predios = entorno.objetos.filter((o) => !/^bacia|^laje-descarga/.test(o.nome))
    .map((o) => plano(new THREE.Box3().setFromObject(o.grupo)));
  const estruturas = [];
  pipeways.grupo.traverse((o) => { if (o.isMesh) estruturas.push(plano(new THREE.Box3().setFromObject(o))); });
  const emergencia = seguranca.itens.map((i) => quadrado(i.x, i.z, i.raio + 0.5));
  const ocupados = [];
  const livre = (pe, { copa = null, alto = false } = {}) => !vias.some((v) => sobrepoe(pe, v))
    && !calcadas.some((c) => sobrepoe(pe, c))
    && !predios.some((p) => sobrepoe(pe, expandir(p, 0.3)))
    && !emergencia.some((e) => sobrepoe(pe, e))
    && !ocupados.some((o) => sobrepoe(pe, o))
    && !sobrepoe(pe, expandir(isbl, 1))
    && !(copa && estruturas.some((s) => sobrepoe(copa, s)))
    && !(alto && estruturas.some((s) => sobrepoe(pe, expandir(s, 1.0))));

  /* ======================================================================
   *  2. Arvores
   * =================================================================== */
  const rnd = sorteio(9);
  const riscos = BLOCOS.filter((b) => ARVORES.riscos.includes(b.categoria)).map(ret);
  const mArv = [];
  for (const f of ARVORES.fileiras) {
    const r = ret(bloco(f.bloco));
    // bloco com placa (Y.bloco) ou a faixa verde, que e o gramado do chao
    const yPe = bloco(f.bloco).categoria === 'verde' ? Y.lote : Y.bloco;
    const linhas = f.bordas
      ? f.bordas.map((b) => (b === 'norte' ? r.z0 + f.margem : r.z1 - f.margem))
      : [r.z0 + f.margem, r.z1 - f.margem];
    linhas.forEach((z, j) => {
      const x0 = r.x0 + f.margem + (f.alternar && j % 2 ? f.passo / 2 : 0);
      for (let x = x0; x <= r.x1 - f.margem + 1e-6; x += f.passo) {
        const esc = ARVORES.escala[0] + rnd() * (ARVORES.escala[1] - ARVORES.escala[0]);
        const tronco = quadrado(x, z, 0.5);
        const copa = quadrado(x, z, RAIO_COPA * esc);
        if (riscos.some((q) => distRetRet(q, tronco) < ARVORES.afastamentoRisco)) continue;
        if (!livre(tronco, { copa })) continue;
        ocupados.push(tronco);
        mArv.push(new THREE.Matrix4().compose(V(x, yPe, z),
          new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rnd() * Math.PI * 2), V(esc, esc, esc)));
      }
    });
  }
  /* Alinhamento ao longo das calcadas e bosque nos gramados (Fase 14): so no
   * gramado (fora da brita da regra CHAO e de bloco), longe de risco, com
   * espaco entre troncos. */
  const britas = CHAO.brita.flatMap((rg) => BLOCOS.filter((b) => rg.categorias.includes(b.categoria))
    .map((b) => expandir(ret(b), rg.faixa)));
  const blocosR = BLOCOS.map(ret);
  const frente = ret(ARVORES.frente);
  const troncos = [];
  /* Na frente do letreiro (Fase 15) nao se planta: a faixa de ARVORES.vista m
   * diante dele, da largura do letreiro mais a copa de cada lado. */
  const vistas = entorno.objetos.map((o) => o.grupo.userData.planta).filter((pl) => pl?.letreiro).map(({ ret: r, letreiro: l }) => {
    const meia = (l.endsWith('x') ? r.z1 - r.z0 : r.x1 - r.x0) / 4 + RAIO_COPA;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, d = ARVORES.vista;
    return {
      '+x': { x0: r.x1, x1: r.x1 + d, z0: cz - meia, z1: cz + meia }, '-x': { x0: r.x0 - d, x1: r.x0, z0: cz - meia, z1: cz + meia },
      '+z': { x0: cx - meia, x1: cx + meia, z0: r.z1, z1: r.z1 + d }, '-z': { x0: cx - meia, x1: cx + meia, z0: r.z0 - d, z1: r.z0 },
    }[l];
  });
  // nem na calcada de acesso a porta dos predios (o tronco a 1 m da borda dela)
  const acessos = PORTAS.filter((a) => a.acesso).map((a) => a.acesso);
  const naAcesso = (x, z) => acessos.some((pts) => pts.some((p, i) => i > 0 && distPontoSegAcesso([x, z], pts[i - 1], p) < LARGURA_ACESSO / 2 + 1));
  function plantar(x, z, folgaPiso) {
    if (!(dentro(x, z, lote) || dentro(x, z, frente))) return false;
    if (naAcesso(x, z)) return false;
    if (vistas.some((v) => dentro(x, z, v))) return false;
    const tronco = quadrado(x, z, 0.5);
    if (britas.some((r) => dentro(x, z, r))) return false;
    if (blocosR.some((r) => sobrepoe(tronco, expandir(r, 1)))) return false;
    if (riscos.some((q) => distRetRet(q, tronco) < ARVORES.afastamentoRisco)) return false;
    if (troncos.some(([a, b]) => Math.hypot(a - x, b - z) < ARVORES.espaco)) return false;
    const esc = ARVORES.escala[0] + rnd() * (ARVORES.escala[1] - ARVORES.escala[0]);
    if (!livre(quadrado(x, z, 0.5 + folgaPiso), { copa: quadrado(x, z, RAIO_COPA * esc) })) return false;
    troncos.push([x, z]);
    ocupados.push(tronco);
    mArv.push(new THREE.Matrix4().compose(V(x, Y.lote, z),
      new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rnd() * Math.PI * 2), V(esc, esc, esc)));
    return true;
  }
  for (const [x, z] of mArv.map((m) => { const p = new THREE.Vector3().setFromMatrixPosition(m); return [p.x, p.z]; })) troncos.push([x, z]);
  const al = ARVORES.alinhamento;
  for (const c of CALCADAS) {
    for (let i = 1; i < c.pontos.length; i++) {
      const a = c.pontos[i - 1], b = c.pontos[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < al.passo) continue;
      const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      const off = LARGURA_CALCADA / 2 + al.afastamento;
      for (let s = al.passo / 2; s < L; s += al.passo) {
        for (const lado of [1, -1]) plantar(a[0] + d[0] * s - d[1] * off * lado, a[1] + d[1] * s + d[0] * off * lado, 1.0);
      }
    }
  }
  const bq = ARVORES.bosque;
  const rb = sorteio(77);
  for (const r of [lote, frente]) {
    for (let x = r.x0 + bq.passo / 2; x < r.x1; x += bq.passo) {
      for (let z = r.z0 + bq.passo / 2; z < r.z1; z += bq.passo) {
        const dx = (rb() - 0.5) * 2 * bq.sorteio, dz = (rb() - 0.5) * 2 * bq.sorteio;
        if (rb() < (bq.vazias ?? 0)) continue;
        plantar(x + dx, z + dz, bq.folga);
      }
    }
  }
  /* Canteiros: arbustos em volta dos predios de gente, menos na frente da
   * porta (a mesma porta que site/entorno.js desenhou na fachada). */
  const mArb = [];
  for (const o of entorno.objetos) {
    const pl = o.grupo.userData.planta;
    if (!pl || !CANTEIROS.usos.includes(pl.uso)) continue;
    const { ret: r } = pl;
    const a = CANTEIROS.afastamento;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const faces = {
      '-z': [[r.x0, r.z0 - a], [r.x1, r.z0 - a]], '+z': [[r.x0, r.z1 + a], [r.x1, r.z1 + a]],
      '-x': [[r.x0 - a, r.z0], [r.x0 - a, r.z1]], '+x': [[r.x1 + a, r.z0], [r.x1 + a, r.z1]],
    };
    const livres = new Set([pl.porta, pl.portoes, pl.docas].filter(Boolean));
    for (const [lado, [p, q]] of Object.entries(faces)) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let s = CANTEIROS.passo / 2; s < L; s += CANTEIROS.passo) {
        const x = p[0] + ((q[0] - p[0]) * s) / L, z = p[1] + ((q[1] - p[1]) * s) / L;
        if (livres.has(lado) && Math.hypot(x - (lado.endsWith('x') ? x : cx), z - (lado.endsWith('z') ? z : cz)) < CANTEIROS.vaoPorta) continue;
        // a 0,8 m da parede o arbusto (0,45 m de raio) fica fora da folga de
        // 0,3 m do proprio predio: so via, calcada e o resto o barram
        const pe = quadrado(x, z, 0.45);
        if (!livre(pe)) continue;
        ocupados.push(pe);
        mArb.push(new THREE.Matrix4().compose(V(x, Y.bloco, z),
          new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rnd() * Math.PI * 2), V(1, 0.8 + rnd() * 0.4, 1)));
      }
    }
  }
  if (mArb.length) {
    const ras = sorteio(55);
    const arbustos = instanciar(partesArbusto(), mArb, mArb.map(() => [0x3f6b2e, 0x4c7a34, 0x5a7f3a][Math.floor(ras() * 3)]), false);
    arbustos.name = 'arbustos';
    grupo.add(arbustos);
  }
  // um verde por arvore: copa de mesma especie, mas nao de fabrica
  const VERDES = [0x4a6b35, 0x55763c, 0x3f5f30, 0x5f7f45, 0x667a42, 0x48663a];
  const ra = sorteio(33);
  const arvores = instanciar(partesArvore(), mArv, mArv.map(() => VERDES[Math.floor(ra() * VERDES.length)]));
  arvores.name = 'arvores';
  grupo.add(arvores);

  /* ======================================================================
   *  3. Iluminacao fora da laje (Fase 26, bloco 1: via, calcada e
   *     estacionamento). O passo sai do alvo (data/iluminacao.js) pela
   *     conta de lib/fotometria.js; a auditoria mede o que ficou.
   * =================================================================== */
  const luzes = { via: [], pedestre: [], estacionamento: [], patio: [], teto: [], perimetro: [], arandela: [], pipeway: [] };   // matrizes de cada tipo
  const exMatrizes = new Set();                     // as que levam luminaria Ex
  // o que nao fechou na colocacao vai para __auditarIluminacao, nao para a
  // auditoria do ambiente
  // Poste que nao coube nao e achado: o que conta e a luz medida; vai no
  // resumo da auditoria, para saber onde olhar.
  const achadosLuz = [], semLugar = [];
  grupo.userData.achadosLuz = achadosLuz;
  grupo.userData.semLugar = semLugar;
  const passoMemo = new Map();
  // maior passo, em m, que fecha o alvo numa faixa reta como esta
  const passoDe = (tipo, largura, lados, recuo, alvo, passos) => {
    const k = `${tipo}|${largura}|${lados}|${recuo}|${alvo.Em}|${alvo.Uo}`;
    if (!passoMemo.has(k)) {
      const L = LUMINARIAS[tipo], braco = L.braco ?? 0;
      const H = L.altura;
      const tentar = [];
      for (let S = Math.round(passos[0] * H); S >= Math.round(passos[1] * H); S--) tentar.push(S);
      const r = passoPorAlvo({ largura, lados, alt: H, dLat: largura / 2 + recuo - braco, incl: L.inclinacao, luminaria: L, alvo, passos: tentar });
      if (!r) achadosLuz.push({ regra: 'PASSO_SEM_ALVO', peca: `${tipo} ${largura} m`, detalhe: `nenhum passo entre ${tentar.at(-1)} e ${tentar[0]} m fecha Em ${alvo.Em} / Uo ${alvo.Uo}` });
      passoMemo.set(k, r?.passo ?? tentar.at(-1));
    }
    return passoMemo.get(k);
  };
  // um poste na posicao s de um percurso, a `offs` m do eixo (o primeiro
  // que couber), do lado que `lados` pedir; anda ate `desvioMax` m ao
  // longo para achar lugar. Devolve a matriz posta, ou null.
  const porUm = (pc, s, lados, { offs, desvioMax, raioPe, tipo, foraDoLote = 0, evitar }) => {
    for (const lado of lados) {
      for (const off of offs) {
        for (let k = 0; k <= desvioMax; k += 1) {
          for (const sg of k ? [1, -1] : [1]) {
            const t = s + sg * k;
            if (t < 0 || t > pc.L) continue;
            const [cx, cz] = pc.em(t), [ax, az] = pc.em(Math.max(0, t - 0.5)), [bx, bz] = pc.em(Math.min(pc.L, t + 0.5));
            const d = dirPlana([ax, az], [bx, bz]), r = direita(d);
            const x = cx + lado * r[0] * off, z = cz + lado * r[1] * off;
            const pe = quadrado(x, z, raioPe);
            if (!dentro(x, z, expandir(lote, foraDoLote)) || !livre(pe, { alto: true }) || evitar?.(x, z)) continue;
            ocupados.push(pe);
            // a frente do poste (+Z dele) para o eixo da faixa (o do
            // perimetro fica do lado da cerca, com o braco para dentro)
            const rumo = Math.atan2(cx - x, cz - z);
            const m = new THREE.Matrix4().compose(V(x, Y.lote, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rumo), V(1, 1, 1));
            luzes[tipo].push(m);
            return m;
          }
        }
      }
    }
    return null;
  };
  // postes ao longo de uma polilinha: um em cada ponta e o vao dividido
  // por igual, nunca maior que o passo — com o primeiro a meio passo, a
  // ponta do caminho so recebia luz de um lado (Uo 0,03 na calcada do
  // armazem). Polilinha fechada (anel): sem a ponta repetida.
  const aoLongo = (pontos, passo, op) => {
    const pc = percurso(pontos);
    const [p0, pN] = [pontos[0], pontos.at(-1)];
    const fechada = Math.hypot(p0[0] - pN[0], p0[1] - pN[1]) < 0.01;
    const nv = Math.max(1, Math.ceil(pc.L / passo));
    for (let n = 0; n < (fechada ? nv : nv + 1); n++) {
      const s = (n * pc.L) / nv;
      if (!porUm(pc, s, op.ladosDe(n), op)) semLugar.push(`${op.tipo} a ${s.toFixed(0)} m de (${pontos[0].map(f1).join('; ')})`);
    }
  };
  const opVia = (v) => ({ offs: REGRAS.via.recuos.map((r) => v.largura / 2 + r), desvioMax: REGRAS.via.desvioMax, raioPe: 0.35, tipo: 'via', foraDoLote: 30 });
  const opPedestre = (largura) => ({ offs: [largura / 2 + REGRAS.calcada.afastamento], desvioMax: REGRAS.calcada.desvioMax, raioPe: 0.2, tipo: 'pedestre' });

  // vias: um lado (tenta os dois), ou alternado na principal
  for (const [ids, alvo] of [[REGRAS.via.vias, ALVOS.via], [REGRAS.publica.vias, ALVOS.publica]]) {
    for (const id of ids) {
      const v = VIAS.find((q) => q.id === id);
      if (!v) continue;
      const lados = REGRAS.via.doisLados.includes(id) ? 2 : 1;
      const recuos = REGRAS.via.recuos;
      const passo = passoDe('via', v.largura, lados, recuos[1], alvo, REGRAS.via.passos);
      aoLongo(v.pontos, passo, { ...opVia(v), ladosDe: (n) => (lados === 2 ? (n % 2 ? [-1, 1] : [1, -1]) : [1, -1]) });
    }
  }
  // caminhos fora de via: poste de pedestre ao lado
  for (const c of CALCADAS_SITE.filter((q) => q.caminho)) {
    const R = REGRAS.calcada;
    const passo = passoDe('pedestre', LARGURA_CALCADA, 1, R.afastamento, ALVOS.calcada, R.passos);
    aoLongo(c.pontos, passo, { ...opPedestre(LARGURA_CALCADA), ladosDe: () => [1, -1] });
  }
  // Area com postes nas duas bordas do lado maior (estacionamento, patio,
  // tanques): `fora` > 0 os poe fora do retangulo, < 0 dentro dele; as
  // cabecas viram para dentro. Quantos por fila: o MENOR numero que fecha o
  // alvo NA AREA (um no meio, depois as duas pontas e o vao por igual) —
  // pelo passo maximo, a area pequena saia com o triplo do alvo.
  const porArea = (r, tipo, alvo, pts, { fora, desvioMax, ex = false, filtro }) => {
    const L = LUMINARIAS[tipo], emX = r.x1 - r.x0 >= r.z1 - r.z0;
    const [a0, a1] = emX ? [r.x0, r.x1] : [r.z0, r.z1];
    // as duas filas: posicao no eixo curto e o giro que vira a frente (+Z) para dentro
    const filas = emX
      ? [{ c: r.z0 - fora, rumo: 0 }, { c: r.z1 + fora, rumo: Math.PI }]
      : [{ c: r.x0 - fora, rumo: Math.PI / 2 }, { c: r.x1 + fora, rumo: -Math.PI / 2 }];
    const margem = Math.max(0, -fora);
    const ao = (n) => {
      const a = a0 + margem, b = a1 - margem;
      return n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, k) => a + (k * (b - a)) / (n - 1));
    };
    const pose = (f, t) => new THREE.Matrix4().compose(emX ? V(t, Y.lote, f.c) : V(f.c, Y.lote, t),
      new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), f.rumo), V(1, 1, 1));
    const locais = luminariasDoPoste(tipo, L);
    const fontes = (n) => filas.flatMap((f) => ao(n).flatMap((t) => {
      const m = pose(f, t);
      return locais.map((l) => ({ ...L, p: l.p.clone().applyMatrix4(m), dir: l.dir.clone().transformDirection(m) }));
    }));
    const nMax = Math.max(2, Math.ceil((a1 - a0) / L.altura) + 1);
    // com o que ja se pos em volta: a luz da via ao lado sobe o Em sem subir
    // o Emin, e a descarga que fechava sozinha caia para Uo 0,37 junto
    const jaPostas = Object.entries(luzes).flatMap(([tp, ms]) => ms.flatMap((m) => luminariasDoPoste(tp, LUMINARIAS[tp])
      .map((l) => ({ ...LUMINARIAS[tp], p: l.p.clone().applyMatrix4(m), dir: l.dir.clone().transformDirection(m) }))));
    // onde cada mastro de n por fila cabe de verdade (sem marcar ainda): o
    // numero que fecha no papel e perde um mastro para obstaculo nao fecha
    const caber = (n) => filas.flatMap((f) => ao(n).map((t0) => {
      for (let k = 0; k <= desvioMax; k++) {
        for (const sg of k ? [1, -1] : [1]) {
          const t = t0 + sg * k, [x, z] = emX ? [t, f.c] : [f.c, t];
          const pe = quadrado(x, z, 0.4);
          if (dentro(x, z, lote) && livre(pe, { alto: true })) return { m: pose(f, t), pe };
        }
      }
      return { falta: `${tipo} em (${f1(emX ? t0 : f.c)}; ${f1(emX ? f.c : t0)})` };
    }));
    let escolha = null;
    for (let n = 1; n <= nMax && !escolha; n++) {
      const postos = caber(n).filter((q) => q.m);
      const faltam = caber(n).filter((q) => q.falta).map((q) => q.falta);
      const lums = prepararLuminarias([...jaPostas, ...postos.flatMap(({ m }) => locais.map((l) => ({ ...L, p: l.p.clone().applyMatrix4(m), dir: l.dir.clone().transformDirection(m) })))]);
      const st = estatistica(pts.map((q) => iluminancia(q, lums, { filtro })));
      if (fecha(st, alvo) || n === nMax) { escolha = postos; semLugar.push(...faltam); }
    }
    for (const { m, pe } of escolha) {
      ocupados.push(pe);
      luzes[tipo].push(m);
      if (ex) exMatrizes.add(m);
    }
  };
  // estacionamento: dentro, nas faixas fora das fileiras de vagas;
  // patios e tanques: fora, com projetores (Ex onde ha tolueno)
  const areas = areasDeLuz();
  for (const id of REGRAS.estacionamento.blocos) {
    const R = REGRAS.estacionamento, a = areas.find((q) => q.tipo === 'estacionamento' && q.id === id);
    porArea(ret(bloco(id)), 'estacionamento', a.alvo, a.pts, { fora: -R.margem, desvioMax: R.desvioMax });
  }
  for (const pt of REGRAS.patios.filter((q) => !q.fachada)) {
    const a = areas.find((q) => q.id === pt.id);
    porArea(a.ret, 'patio', a.alvo, a.pts, { fora: pt.fora, desvioMax: REGRAS.patio.desvioMax, ex: pt.ex, filtro: a.filtro });
  }
  // cobertura da portaria: grade nx × nz de luminarias de embutir no forro
  // (a face 1 cm abaixo dele: os 5 m livres ficam), a menor que fecha
  for (const cb of REGRAS.coberturas) {
    const c = SITE.PRACA_PORTARIA.cobertura, a = areas.find((q) => q.tipo === 'portaria');
    const y0 = Y.via + c.alturaLivre, L = LUMINARIAS.teto;
    const grade = (nx, nz) => {
      const out = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        out.push(new THREE.Matrix4().makeTranslation(c.x[0] + ((i + 0.5) * (c.x[1] - c.x[0])) / nx, y0, c.z[0] + ((j + 0.5) * (c.z[1] - c.z[0])) / nz));
      }
      return out;
    };
    const locais = luminariasDoPoste('teto', L);
    let escolha = null;
    for (let n = 2; n <= 12 && !escolha; n++) {
      const nz = Math.max(1, Math.round((n * (c.z[1] - c.z[0])) / (c.x[1] - c.x[0])));
      const ms = grade(n, nz);
      const jaPostas = Object.entries(luzes).flatMap(([tp, mm]) => mm.flatMap((m) => luminariasDoPoste(tp, LUMINARIAS[tp])
        .map((l) => ({ ...LUMINARIAS[tp], p: l.p.clone().applyMatrix4(m), dir: l.dir.clone().transformDirection(m) }))));
      const lums = prepararLuminarias([...jaPostas, ...ms.flatMap((m) => locais.map((l) => ({ ...L, p: l.p.clone().applyMatrix4(m), dir: l.dir.clone() })))]);
      // debaixo do forro so chega a luz de quem esta abaixo dele
      const st = estatistica(a.pts.map((q) => iluminancia(q, lums, { filtro: a.filtro })));
      if (fecha(st, ALVOS[cb.alvo])) escolha = ms;
    }
    if (!escolha) achadosLuz.push({ regra: 'PASSO_SEM_ALVO', peca: 'cobertura da portaria', detalhe: 'nem 12 luminarias por fila fecham o alvo' });
    luzes.teto.push(...(escolha ?? grade(12, 7)));
  }

  // perimetro: poste de 6 m a 1 m por dentro da cerca, braco para dentro;
  // o passo sai do alvo na faixa de 3 m; nunca no vao de um portao
  const noPortao = (x, z) => SITE.PORTOES.some((g) => Math.hypot(x - g.x, z - g.z) < (g.largura ?? CERCA.larguraPortao) / 2 + 2);
  const RP = REGRAS.perimetro, LP = LUMINARIAS.perimetro;
  const opPerimetro = (lado) => ({ offs: [-(RP.faixa / 2 - RP.recuo)], desvioMax: RP.desvioMax, raioPe: 0.25, tipo: 'perimetro', evitar: noPortao, lados: [lado.dentro] });
  {
    const tentar = [];
    for (let S = Math.round(RP.passos[0] * LP.altura); S >= Math.round(RP.passos[1] * LP.altura); S--) tentar.push(S);
    const r = passoPorAlvo({ largura: RP.faixa, alt: LP.altura, dLat: LP.braco - (RP.faixa / 2 - RP.recuo), luminaria: LP, alvo: ALVOS.perimetro, passos: tentar });
    for (const lado of ladosDaCerca()) aoLongo(lado.pontos, r?.passo ?? tentar.at(-1), { ...opPerimetro(lado), ladosDe: () => [lado.dentro] });
  }
  const fachadas = [];                              // projetores de parede ja postos (cada um com seu eixo)
  // arandela sobre cada porta, voltada para fora (PORTAS, entorno.js)
  const NORMAL = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
  for (const pt of PORTAS) {
    const [nx, nz] = NORMAL[pt.lado];
    luzes.arandela.push(new THREE.Matrix4().compose(V(pt.porta[0], Y.bloco + LUMINARIAS.arandela.altura, pt.porta[1]),
      new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(nx, nz)), V(1, 1, 1)));
  }
  // patio colado num predio (o de expedicao): projetores na fachada voltada
  // para ele, o menor numero que fecha o alvo, espalhados no trecho da
  // parede de frente para o patio
  for (const a of areas.filter((q) => q.fachada)) {
    const pr = PREDIOS.find((q) => q.bloco === a.fachada), r = retDoPredio(pr), L = LUMINARIAS.fachada;
    const c = [(a.ret.x0 + a.ret.x1) / 2, (a.ret.z0 + a.ret.z1) / 2];
    // a parede de frente para o patio: das que tem o patio do lado de fora,
    // a de que ele esta mais longe (o centro dele quase na linha de uma
    // parede lateral nao faz dela a da frente)
    const lados = [['+x', c[0] - r.x1], ['-x', r.x0 - c[0]], ['+z', c[1] - r.z1], ['-z', r.z0 - c[1]]]
      .filter(([, d]) => d > 0).sort((u, w) => w[1] - u[1]);
    const lado = lados[0][0], [nx, nz] = NORMAL[lado], emX = lado[1] === 'z';
    // trecho comum entre a parede e o patio, ao longo dela, 1 m das pontas
    const [p0, p1] = emX ? [Math.max(r.x0, a.ret.x0) + 1, Math.min(r.x1, a.ret.x1) - 1] : [Math.max(r.z0, a.ret.z0) + 1, Math.min(r.z1, a.ret.z1) - 1];
    const naParede = lado === '+x' ? r.x1 : lado === '-x' ? r.x0 : lado === '+z' ? r.z1 : r.z0;
    const giro = Math.atan2(nx, nz);
    const pose = (t) => new THREE.Matrix4().compose(emX ? V(t, Y.bloco + L.altura, naParede) : V(naParede, Y.bloco + L.altura, t),
      new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), giro), V(1, 1, 1));
    // pontos de mira: o patio em n faixas ao longo da parede (o patio todo,
    // inclusive o que passa da ponta dela), cada projetor no meio da sua, a
    // 70 % da profundidade [ADOTADO; a 55 % o canto do fundo, alem da ponta
    // da parede, ficava com Uo 0,28]
    const [q0, q1] = emX ? [a.ret.x0, a.ret.x1] : [a.ret.z0, a.ret.z1], MIRA = 0.7;
    const longe = lado === '+x' ? a.ret.x1 - r.x1 : lado === '-x' ? r.x0 - a.ret.x0 : lado === '+z' ? a.ret.z1 - r.z1 : r.z0 - a.ret.z0;
    const projetores = (n) => Array.from({ length: n }, (_, k) => {
      const t = n === 1 ? (p0 + p1) / 2 : p0 + (k * (p1 - p0)) / (n - 1);
      const m = pose(t), ao = q0 + ((k + 0.5) * (q1 - q0)) / n, fundo = naParede + Math.sign(nx + nz) * MIRA * longe;
      const alvo = emX ? V(ao, a.pts[0][1], fundo) : V(fundo, a.pts[0][1], ao);
      const origem = V(0, 0, 0.55).applyMatrix4(m);
      const dirLocal = alvo.sub(origem).normalize().applyAxisAngle(V(0, 1, 0), -giro);
      return { m, L: { ...L, dir: dirLocal } };
    });
    const jaPostas = Object.entries(luzes).flatMap(([tp, ms]) => ms.flatMap((m) => luminariasDoPoste(tp, LUMINARIAS[tp])
      .map((l) => ({ ...LUMINARIAS[tp], p: l.p.clone().applyMatrix4(m), dir: l.dir.clone().transformDirection(m) }))));
    let escolha = null;
    for (let n = 1; n <= 4 && !escolha; n++) {
      const pj = projetores(n);
      const lums = prepararLuminarias([...jaPostas, ...pj.flatMap(({ m, L: Lk }) => luminariasDoPoste('fachada', Lk)
        .map((l) => ({ ...L, p: l.p.clone().applyMatrix4(m), dir: l.dir.clone().transformDirection(m) })))]);
      const st = estatistica(a.pts.map((q) => iluminancia(q, lums)));
      if (fecha(st, a.alvo) || n === 4) escolha = pj;
    }
    // cada um com o seu eixo: um grupo por projetor (sao poucos)
    for (const { m, L: Lk } of escolha) {
      const g = instanciar(partesProjetorParede(Lk), [m]);
      g.name = 'projetor-fachada';
      const [l] = luminariasDoPoste('fachada', Lk);
      g.userData.luminarias = [{ tipo: 'fachada', p: l.p.clone().applyMatrix4(m).toArray(), dir: l.dir.clone().transformDirection(m).toArray(),
        fluxo: L.fluxo, facho: L.facho, perfil: L.perfil, ex: false, emergencia: false }];
      grupo.add(g);
      fachadas.push(...g.userData.luminarias.map((q) => ({ ...q, p: V(...q.p), dir: V(...q.dir) })));
    }
  }

  // Mede e adensa (ROTEIRO, Fase 26): cada area, com tudo o que ja se pos
  // (a calcada ao lado da via conta com a luz da via); enquanto nao fecha o
  // alvo, um poste a mais do tipo da area junto do ponto mais escuro — ate
  // `REGRAS.adensarMax` por area. O estacionamento ja sai pela area.
  // luminaria na coluna de pipeway mais perto do ponto escuro (que ainda nao
  // tenha), na altura de `folga` abaixo do nivel mais baixo, braco para o
  // eixo da area
  const colunasUsadas = new Set();
  const naColuna = (x, z, [ex, ez]) => {
    const LPw = LUMINARIAS.pipeway;
    const c = (pipeways.postes ?? []).filter((q, i) => !colunasUsadas.has(i) && Math.hypot(q.x - x, q.z - z) <= REGRAS.pipewayAlcance)
      .map((q) => ({ q, d: Math.hypot(q.x - x, q.z - z) })).sort((u, w) => u.d - w.d)[0];
    if (!c) return null;
    colunasUsadas.add(pipeways.postes.indexOf(c.q));
    const y = Math.min(...c.q.niveis) - LPw.folga;
    const m = new THREE.Matrix4().compose(V(c.q.x, y, c.q.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(ex - c.q.x, ez - c.q.z)), V(1, 1, 1));
    luzes.pipeway.push(m);
    return m;
  };
  const fontesDe = (tipo, m) => luminariasDoPoste(tipo, LUMINARIAS[tipo]).map((l) => ({
    ...LUMINARIAS[tipo], p: l.p.clone().applyMatrix4(m).toArray(), dir: l.dir.clone().transformDirection(m).toArray() }));
  const todas = [...Object.entries(luzes).flatMap(([tipo, ms]) => ms.flatMap((m) => fontesDe(tipo, m))), ...fachadas.map((q) => ({ ...q, p: q.p.toArray(), dir: q.dir.toArray() }))];
  // patio (area retangular): um mastro a mais por fora da borda, no lugar
  // livre mais perto do ponto escuro, de frente para o meio do patio (o de
  // expedicao: o canto alem da ponta da parede do armazem)
  for (const a of areas.filter((q) => q.ret && q.fachada)) {
    const r = a.ret, c = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2], f = 1.5;
    for (let it = 0; it < REGRAS.adensarMax; it++) {
      const lums = prepararLuminarias(todas);
      const Es = a.pts.map((q) => iluminancia(q, lums, { filtro: a.filtro }));
      const st = estatistica(Es);
      if (fecha(st, a.alvo)) break;
      const [x, , z] = a.pts[Es.indexOf(st.Emin)];
      const cands = [];
      for (let t = r.x0; t <= r.x1; t += 1) cands.push([t, r.z0 - f], [t, r.z1 + f]);
      for (let t = r.z0; t <= r.z1; t += 1) cands.push([r.x0 - f, t], [r.x1 + f, t]);
      const ok = cands.sort((u, w) => Math.hypot(u[0] - x, u[1] - z) - Math.hypot(w[0] - x, w[1] - z))
        .find(([px, pz]) => dentro(px, pz, lote) && livre(quadrado(px, pz, 0.4), { alto: true }));
      if (!ok) { semLugar.push(`adensar ${a.tipo} ${a.id} em (${f1(x)}; ${f1(z)})`); break; }
      ocupados.push(quadrado(ok[0], ok[1], 0.4));
      const m = new THREE.Matrix4().compose(V(ok[0], Y.lote, ok[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(c[0] - ok[0], c[1] - ok[1])), V(1, 1, 1));
      luzes.patio.push(m);
      todas.push(...fontesDe('patio', m));
    }
  }
  for (const a of areas) {
    if (!a.linha || a.emergencia) continue;
    const pc = percurso(a.linha.pontos);
    const op = a.poste === 'via' ? { ...opVia(a.linha), foraDoLote: 30 }
      : a.poste === 'perimetro' ? opPerimetro({ dentro: a.dentro }) : opPedestre(a.linha.largura);
    for (let it = 0; it < REGRAS.adensarMax; it++) {
      const lums = prepararLuminarias(todas);
      const Es = a.pts.map((q) => iluminancia(q, lums, { filtro: a.filtro }));
      const st = estatistica(Es);
      if (fecha(st, a.alvo)) break;
      // o ponto mais escuro, projetado na polilinha
      const [x, , z] = a.pts[Es.indexOf(st.Emin)];
      let sMelhor = 0, dMelhor = Infinity;
      for (let t = 0; t <= pc.L; t += 1) { const [px, pz] = pc.em(t), d = Math.hypot(px - x, pz - z); if (d < dMelhor) { dMelhor = d; sMelhor = t; } }
      const m = porUm(pc, sMelhor, op.lados ?? [1, -1], op);
      if (m) { todas.push(...fontesDe(a.poste, m)); continue; }
      // sem lugar para poste (sob pipeway): luminaria na coluna do pipeway
      const mp = a.poste !== 'perimetro' && naColuna(x, z, pc.em(sMelhor));
      if (!mp) { semLugar.push(`adensar ${a.tipo} ${a.id} em (${f1(x)}; ${f1(z)})`); break; }
      todas.push(...fontesDe('pipeway', mp));
    }
  }

  // Emergencia (NBR 10898): o menor conjunto de luminarias ja postas que, no
  // fluxo de emergencia, fecha toda rota de fuga — escolha gulosa pelo
  // ganho (quanto cada uma leva os pontos ate o alvo). Ganham o kit.
  const emergMatrizes = new Set();
  {
    const rotas = areas.filter((a) => a.emergencia), alvoE = ALVOS.emergencia.Emin;
    const pts = rotas.flatMap((a) => a.pts);
    const cands = Object.entries(luzes).flatMap(([tp, ms]) => ms.map((m) => ({ m,
      lums: prepararLuminarias(emEmergencia(fontesDe(tp, m).map((f) => ({ ...f, emergencia: true })))) })));
    // contribuicao de cada candidata em cada ponto, uma vez so
    for (const c of cands) c.e = Float32Array.from(pts, (q) => iluminancia(q, c.lums));
    const E = new Float32Array(pts.length);
    for (;;) {
      let melhor = null, ganho = 0;
      for (const c of cands) {
        if (emergMatrizes.has(c.m)) continue;
        let g = 0;
        for (let i = 0; i < pts.length; i++) if (E[i] < alvoE) g += Math.min(alvoE, E[i] + c.e[i]) - E[i];
        if (g > ganho) { ganho = g; melhor = c; }
      }
      if (!melhor || ganho < 1e-3) break;
      emergMatrizes.add(melhor.m);
      for (let i = 0; i < pts.length; i++) E[i] += melhor.e[i];
      if (E.every((e) => e >= alvoE)) break;
    }
    // trecho que nenhuma luminaria alcanca: poste de pedestre ao lado da
    // rota, ja no circuito de emergencia, no ponto mais escuro de cada vez
    for (const a of rotas) {
      const pc = percurso(a.linha.pontos), op = opPedestre(a.linha.largura);
      for (let it = 0; it < 12; it++) {
        const lumsE = prepararLuminarias(emEmergencia(Object.entries(luzes).flatMap(([tp, ms]) => ms.filter((m) => emergMatrizes.has(m))
          .flatMap((m) => fontesDe(tp, m).map((f) => ({ ...f, emergencia: true }))))));
        const Es = a.pts.map((q) => iluminancia(q, lumsE));
        const st = estatistica(Es);
        if (fecha(st, a.alvo)) break;
        const [x, , z] = a.pts[Es.indexOf(st.Emin)];
        let sM = 0, dM = Infinity;
        for (let t = 0; t <= pc.L; t += 1) { const [px, pz] = pc.em(t), d = Math.hypot(px - x, pz - z); if (d < dM) { dM = d; sM = t; } }
        const m = porUm(pc, sM, [1, -1], op);
        if (!m) { semLugar.push(`emergencia ${a.id} em (${f1(x)}; ${f1(z)})`); break; }
        emergMatrizes.add(m);
      }
    }
  }

  // grupos instanciados; cada um leva as luminarias no mundo
  // (`userData.luminarias`: a interface da Fase 26, lida pela auditoria e
  // pela noite). O de via mantem o nome 'postes'.
  const PARTES = { via: partesPoste, pedestre: partesPostePedestre, estacionamento: partesPosteEstacionamento, patio: partesPosteEstacionamento, teto: partesLuminariaTeto,
    perimetro: partesPostePerimetro, arandela: partesArandela, pipeway: partesLuminariaPipeway };
  const NOMES = { via: 'postes', pedestre: 'postes-pedestre', estacionamento: 'postes-estacionamento', patio: 'postes-patio', teto: 'luminarias-portaria',
    perimetro: 'postes-perimetro', arandela: 'arandelas', pipeway: 'luminarias-pipeway' };
  for (const tipo of Object.keys(luzes)) {
    const L = LUMINARIAS[tipo], ms = luzes[tipo];
    const g = instanciar(PARTES[tipo](L), ms);
    g.name = NOMES[tipo];
    const locais = luminariasDoPoste(tipo, L);
    g.userData.luminarias = ms.flatMap((m) => locais.map((l) => ({
      tipo, p: l.p.clone().applyMatrix4(m).toArray(), dir: l.dir.clone().transformDirection(m).toArray(),
      fluxo: L.fluxo, facho: L.facho, perfil: L.perfil, ex: exMatrizes.has(m), emergencia: emergMatrizes.has(m),
      fluxoEmergencia: L.fluxo * REGRAS.emergencia.fracao,
      ...(['teto', 'arandela', 'pipeway'].includes(tipo) ? {} : { base: [m.elements[12], m.elements[14]] }),
    })));
    grupo.add(g);
  }
  const mPoste = Object.values(luzes).flat();

  /* ======================================================================
   *  4. Carros estacionados, placa e pessoas paradas
   * =================================================================== */
  const est = ret(bloco('ESTAC'));
  const vg = vagasDe(est, VAGA);
  // vagas da fileira norte, da ponta leste: as dos carros que chegam e saem
  const fileiraNorte = vg.centros.filter((c) => c.corredor > 0).sort((a, b) => b.x - a.x);
  const reservadas = PORTARIA_TRAFEGO.carros.vagas.map((i) => fileiraNorte[i]);
  const mCarro = [], cores = [];
  const rc = sorteio(21);
  for (const c of vg.centros) {
    if (reservadas.includes(c)) continue;
    if (rc() > CARROS.ocupacao) continue;
    mCarro.push(new THREE.Matrix4().compose(V(c.x + (rc() - 0.5) * 0.2, Y.bloco, c.z),
      new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), c.corredor > 0 ? 0 : Math.PI), V(1, 1, 1)));
    cores.push(CARROS.cores[Math.floor(rc() * CARROS.cores.length)]);
  }
  const carros = instanciar(partesCarro(), mCarro, cores);
  carros.name = 'carros-estacionados';
  grupo.add(carros);

  const placa = criarPlacaEmpresa(PLACA);
  placa.position.set(PLACA.x, Y.lote, PLACA.z);
  placa.userData.ficha = {
    titulo: 'Benzoic Industries', subtitulo: 'Placa da entrada',
    grupos: [{ nome: 'Planta de ácido benzóico', dados: { 'Produto': 'Ácido benzóico' } }],
  };
  if (!livre(quadrado(PLACA.x, PLACA.z, 3))) achar('PECA_x_OBJETO', 'Placa da empresa', 'posição ocupada');
  grupo.add(placa);

  // roupa por funcao: EPI na area industrial, uniforme na portaria
  const PELES = [0xe0b394, 0xc89a7a, 0xa47554, 0x7d5338, 0x5c3a24];
  const rp = sorteio(57);
  const pele = () => PELES[Math.floor(rp() * PELES.length)];
  const VESTE = {
    operador: (p) => ({ roupa: p.cor, calca: 0xd88a2c, pele: pele(), capacete: 0xf4f4f0, colete: null }),
    motorista: (p) => ({ roupa: p.cor, calca: 0x2f3a4a, pele: pele(), capacete: 0xffd24a, colete: 0xd8f03a }),
    vigia: (p) => ({ roupa: p.cor, calca: p.cor, pele: pele(), capacete: null }),
  };
  for (const p of PESSOAS) {
    // o ponto livre mais perto, numa espiral de 0,5 m
    // quem fica dentro de predio (o porteiro na guarita) nao procura lugar
    let pos = p.dentro ? [p.x, p.z, Y.bloco + (p.piso ?? 0)] : null;
    for (let r = 0; r <= 4 && !pos; r += 0.5) {
      for (let a = 0; a < Math.PI * 2 && !pos; a += Math.PI / 6) {
        const x = p.x + r * Math.cos(a), z = p.z + r * Math.sin(a);
        const naLaje = dentro(x, z, isbl);
        const pe = quadrado(x, z, 0.3);
        // na laje, o mapa de ocupacao da tubulacao (equipamento, rack, apoios)
        const ok = naLaje
          ? !tubulacao.ocupados.some((q) => !tubulacao.corredores.includes(q) && sobrepoe(pe, q)) && !emergencia.some((e) => sobrepoe(pe, e))
          : !predios.some((q) => sobrepoe(pe, q)) && !estruturas.some((s) => sobrepoe(pe, s)) && !emergencia.some((e) => sobrepoe(pe, e));
        if (ok) pos = [x, z, naLaje ? 0 : Y.bloco];
        if (r === 0) break;
      }
    }
    if (!pos) { achar('PECA_x_OBJETO', `Pessoa (${p.onde})`, 'sem lugar livre'); continue; }
    const { grupo: op } = criarPessoa(VESTE[p.onde](p));
    op.position.set(pos[0], pos[2], pos[1]);
    op.rotation.y = p.rumo ?? rnd() * Math.PI * 2;
    op.name = `pessoa-${p.onde}`;
    grupo.add(op);
  }

  /* ======================================================================
   *  5. Trafego animado
   * =================================================================== */
  const vel = (x, z) => (dentro(x, z, lote) ? TRAFEGO.velocidade.dentro : TRAFEGO.velocidade.fora);
  const atores = [];
  /* Fase 19: cada veiculo segue o caminho com as quinas trocadas por arcos
   * do raio dele — o do eixo no giro minimo do veiculo de projeto (site.js) —
   * e tem medida (comprimento, largura) e prioridade, para a fila e a
   * preferencia. [ADOTADO] */
  const RAIO = {
    carro: VEICULOS.carro.raioInterno + VEICULOS.carro.largura / 2,
    caminhao: GIRO_CAMINHAO,
    onibus: VEICULOS.onibus.raioInterno + VEICULOS.onibus.largura / 2,
  };
  // quem esta na via publica tem a vez sobre quem entra nela [ADOTADO]
  const PRIO = { onibus: 5, passagem: 4, caminhao: 3, carro: 2 };
  const caminho = (pontos, tipo) => percurso(suavizar(pontos, RAIO[tipo]));

  // caminhoes: ida, espera na baia/doca, volta, fora de cena — e de novo
  /** Duracao de um percurso: pela velocidade de cada trecho, ou a dada. */
  const tempoDe = (p, v = null) => { let t = 0; for (let s = 0; s < p.L; s += 1) { const q = p.em(s); t += 1 / (v ?? vel(q[0], q[1])); } return t; };
  for (const c of TRAFEGO.caminhoes) {
    // ida de frente, manobra de re ate onde para, saida de frente (data/ambiente.js)
    const ida = caminho(c.ida, 'caminhao'), manobra = caminho(c.manobra, 'caminhao'), saida = caminho(c.saida, 'caminhao');
    const cam = c.tipo === 'tanque' ? criarCaminhaoTanque() : criarCaminhaoBau();
    cam.grupo.userData.ficha = {
      titulo: c.tipo === 'tanque' ? 'Caminhão-tanque de tolueno' : 'Caminhão de produto',
      subtitulo: c.tipo === 'tanque' ? 'Tolueno de reposição para o TQ-01/02 (ONU 1294)' : 'Ácido benzóico ensacado, carregado dentro do armazém',
      grupos: [{ nome: 'Tráfego (adotado)', dados: {
        'Percurso': `${f1(ida.L)} m pela rota de caminhão de site.js`,
        'Velocidade': '15 km/h dentro da cerca, 40 km/h fora, 5 km/h de ré',
        'Manobra': c.tipo === 'tanque' ? 'Passa do entroncamento e entra de ré na baia' : 'Vira no pátio de manobra e entra de ré no armazém',
        'Parada': `${c.espera} s ${c.tipo === 'tanque' ? 'na baia de descarga' : 'dentro do armazém'}`,
      } }],
    };
    grupo.add(cam.grupo);
    // duracao de cada fase, pela velocidade de cada trecho
    const tempo = (p) => { let t = 0; for (let s = 0; s < p.L; s += 1) { const q = p.em(s); t += 1 / vel(q[0], q[1]); } return t; };
    const fases = [
      { tipo: 'espera', T: c.espera, p: manobra, s: manobra.L, re: true },
      { tipo: 'anda', T: tempo(saida), p: saida },
      { tipo: 'fora', T: c.fora },
      { tipo: 'anda', T: tempo(ida), p: ida },
      { tipo: 'anda', T: tempoDe(manobra, TRAFEGO.re), p: manobra, v: TRAFEGO.re, re: true },
    ];
    const ciclo = fases.reduce((s, f) => s + f.T, 0);
    cam.grupo.userData.pontos = cam.pontos;           // pontos de trabalho (site/operacoes.js)
    atores.push({ g: cam.grupo, fases, ciclo, t: c.inicio * ciclo, s: 0, fase: -1, raioRoda: 0.5,
      dim: [cam.comprimento, 2.5], prio: PRIO.caminhao, tipoV: 'caminhao', chave: c.tipo });
  }

  const DIM_CARRO = [4.4, 1.8];
  // carros de passagem na via publica, nos dois sentidos
  const pub = VIAS.find((v) => v.id === TRAFEGO.carros.via);
  for (let i = 0; i < TRAFEGO.carros.n; i++) {
    const sentido = i % 2 ? [...pub.pontos].reverse() : pub.pontos;
    const p = percurso(deslocar(sentido, pub.largura / 4));
    const g = grupoDe(partesCarro(), CARROS.cores[(i * 3 + 1) % CARROS.cores.length]);
    g.name = 'carro';
    grupo.add(g);
    atores.push({ g, laco: p, v: TRAFEGO.velocidade.fora, s: (i / TRAFEGO.carros.n) * p.L, raioRoda: 0.32,
      dim: DIM_CARRO, prio: PRIO.passagem, tipoV: 'carro' });
  }

  // pessoas nas calcadas, indo e voltando — gente da administracao, a
  // caminho do predio: roupa comum, sem capacete
  const CAMISAS = [0x3d6e9e, 0xe8e4dc, 0x8a1c1c, 0x2f5d3a, 0x6d5a8a, 0xd9a441];
  const CALCAS = [0x2f3a4a, 0x22262b, 0x5a4a3a, 0x3b4f6e];
  const CABELOS = [0x2a211b, 0x15110e, 0x6b4a2b, 0x8a8580];
  const rw = sorteio(77);
  const um = (lista) => lista[Math.floor(rw() * lista.length)];
  for (const pp of TRAFEGO.pessoas) {
    const ida = percurso(deslocar(pp.pontos, 0.45));
    const volta = percurso(deslocar([...pp.pontos].reverse(), 0.45));
    const pessoa = criarPessoa({ roupa: um(CAMISAS), calca: um(CALCAS), pele: pele(), capacete: null, cabelo: um(CABELOS) });
    const g = pessoa.grupo;
    g.name = 'pessoa-andando';
    g.userData.animar = pessoa.animar;
    g.userData.fase = rw() * Math.PI * 2;
    g.userData.ritmo = 0;
    grupo.add(g);
    const T = ida.L / TRAFEGO.velocidade.pessoa;
    const fases = [
      { tipo: 'anda', T, p: ida, pessoa: true }, { tipo: 'espera', T: TRAFEGO.pausa, p: ida, s: ida.L },
      { tipo: 'anda', T, p: volta, pessoa: true }, { tipo: 'espera', T: TRAFEGO.pausa, p: volta, s: volta.L },
    ];
    const ciclo = fases.reduce((s, f) => s + f.T, 0);
    atores.push({ g, fases, ciclo, t: pp.inicio * ciclo, pessoa: true, dim: [0.5, 0.5] });
  }

  /* ----------------------------------------------------------------
   *  Portaria e onibus (Fase 15): carros que entram, estacionam e saem; o
   *  onibus que da a volta no retorno e para no abrigo; os passageiros. Cada
   *  veiculo e uma lista de fases (anda, espera, fora) num ciclo; a cancela
   *  le onde eles estao (`veiculos`).
   * ---------------------------------------------------------------- */
  const PT = PORTARIA_TRAFEGO;
  const veiculos = [];
  const anda = (pontos, v = null, extra = {}) => { const { veiculo = 'carro', ...resto } = extra; const p = caminho(pontos, veiculo); return { tipo: 'anda', T: tempoDe(p, v), p, v, ...resto }; };
  const espera = (T, f) => ({ tipo: 'espera', T, p: f.p, s: f.p.L, re: f.re });
  const pc = PT.carros;
  const carrosFunc = [];
  reservadas.forEach((vaga, i) => {
    if (!vaga) return;
    const zC = pc.corredor;
    const chega = anda(pc.chegada);
    const entra = anda(pc.entra);
    // Na vaga e para fora dela, em arco de esterco todo (Fase 19: o rumo
    // pulava 64° na troca de re para frente). O corredor de 6 m pede raio de
    // 4 m no eixo do carro, da faixa (zC - 1,5) ao meio da vaga — o carro de
    // projeto faz ~5,5 m; e a manobra lenta de vaga. [ADOTADO]
    // a re acaba na faixa de saida (zC + 1,5): quem chega pela outra passa
    // arcos em passos de 1,5°, e a re sai 1 m reta da vaga antes de virar
    const rv = zC - 1.5 - vaga.z, rs = zC + 1.5 - vaga.z - 1;
    const estaciona = anda([pc.entra.at(-1), [vaga.x + rv, zC - 1.5], ...arco(vaga.x + rv, vaga.z, rv, 90, 180, 1.5).slice(1)], pc.devagar);
    const re = anda([[vaga.x, vaga.z], ...arco(vaga.x - rs, vaga.z + 1, rs, 0, 90, 1.5)], pc.devagar, { re: true });
    const manobra = anda([[vaga.x - rs, zC + 1.5], pc.sai[0]], pc.devagar);
    const sai = anda(pc.sai);
    const parte = anda(pc.partida);
    const fases = [
      { tipo: 'fora', T: pc.fora[i] }, chega, espera(PT.cancela.liberar, chega), entra, estaciona,
      espera(pc.parado[i], estaciona), re, manobra, sai, espera(2, sai), parte,
    ];
    const g = grupoDe(partesCarro(), CARROS.cores[(i * 2 + 3) % CARROS.cores.length]);
    g.name = 'carro-funcionario';
    grupo.add(g);
    const a = { g, fases, ciclo: fases.reduce((s, f) => s + f.T, 0), t: 0, s: 0, fase: -1, raioRoda: 0.32, meio: pc.meio,
      dim: DIM_CARRO, prio: PRIO.carro, tipoV: 'carro' };
    atores.push(a);
    veiculos.push(a);
    carrosFunc.push(a);
  });
  // Um ciclo so para os carros de funcionario (Fase 19): com esperas
  // diferentes, os ciclos se defasavam ate duas manobras coincidirem nas
  // vagas vizinhas. Completo com tempo fora de cena, o defasamento entre
  // eles fica fixo — o que a auditoria ve em dez minutos vale sempre.
  const cicloFunc = Math.max(...carrosFunc.map((a) => a.ciclo));
  for (const a of carrosFunc) {
    if (a.ciclo < cicloFunc) a.fases.push({ tipo: 'fora', T: cicloFunc - a.ciclo });
    a.ciclo = cicloFunc;
  }

  const po = PT.onibus;
  const bus = criarOnibus();
  bus.grupo.userData.ficha = {
    titulo: 'Ônibus dos operários', subtitulo: 'Fretado — entra pela portaria e para no abrigo',
    grupos: [{ nome: 'Tráfego (adotado)', dados: { 'Parada': `${po.parada} s no ponto`, 'Desembarcam': `${po.descem}`, 'Embarcam': `${po.sobem}` } }],
  };
  grupo.add(bus.grupo);
  const ob = { veiculo: 'onibus' };
  const bChega = anda(po.chegada, null, ob), bAte = anda(po.ate, null, ob), bSai = anda(po.sai, null, ob), bParte = anda(po.partida, null, ob);
  const fasesBus = [
    { tipo: 'fora', T: po.fora }, bChega, espera(PT.cancela.liberar, bChega), bAte, espera(po.parada, bAte),
    bSai, espera(2, bSai), bParte,
  ];
  const cicloBus = fasesBus.reduce((s, f) => s + f.T, 0);
  const t0Bus = po.inicio * cicloBus;
  const busAtor = { g: bus.grupo, fases: fasesBus, ciclo: cicloBus, t: t0Bus, s: 0, fase: -1, raioRoda: 0.5, meio: po.meio,
    dim: [bus.comprimento, 2.6], prio: PRIO.onibus, tipoV: 'onibus', chave: 'onibus' };
  atores.push(busAtor);
  veiculos.push(busAtor);
  // instante (no ciclo) em que o onibus para no abrigo: fora, chegada,
  // cancela e ate o ponto (somava tambem a espera no ponto, e quem descia
  // saia pela porta com o onibus indo embora — achado da Fase 19)
  const tParada = fasesBus.slice(0, 4).reduce((s, f) => s + f.T, 0);
  // passageiros: no mesmo ciclo e no mesmo instante inicial do onibus
  const ab = po.abrigo;
  const [px, pz] = po.porta;
  const cam = po.caminho;                         // do lado do abrigo ate a porta do vestiario
  const desce = [[px, pz], [cam[0][0], pz], ...cam.slice(1)];
  // quem vai esperar segue pela calcada ate o abrigo (antes passava pela
  // linha da porta, dentro da baia, e o onibus chegava por cima — Fase 19)
  const vemEspera = [...[...cam].reverse(), [(ab.x[0] + ab.x[1]) / 2 + 2, (ab.z[0] + ab.z[1]) / 2]];
  const embarca = [vemEspera.at(-1), [px + 0.8, pz], [px, pz + 0.6]];
  const passageiro = (fasesP) => {
    const tot = fasesP.reduce((s, f) => s + f.T, 0);
    if (tot < cicloBus) fasesP.push({ tipo: 'fora', T: cicloBus - tot });
    const pessoa = criarPessoa({ roupa: 0x3d6e9e, calca: 0x2f3a4a, pele: pele(), capacete: null, cabelo: um(CABELOS) });
    const g = pessoa.grupo;
    g.name = 'passageiro';
    g.userData.animar = pessoa.animar;
    g.userData.fase = rw() * Math.PI * 2;
    g.userData.ritmo = 0;
    grupo.add(g);
    // o relogio do passageiro e o do onibus: se o onibus espera na fila,
    // quem desce e quem espera no abrigo esperam junto
    atores.push({ g, fases: fasesP, ciclo: cicloBus, t: t0Bus, pessoa: true, dim: [0.5, 0.5], mestre: busAtor });
  };
  for (let k = 0; k < po.descem; k++) {
    const p = percurso(desce);
    passageiro([{ tipo: 'fora', T: tParada + 2 + k * 1.5 }, { tipo: 'anda', T: p.L / TRAFEGO.velocidade.pessoa, p, pessoa: true }]);
  }
  const fimDescida = tParada + 2 + po.descem * 1.5;
  for (let k = 0; k < po.sobem; k++) {
    const vem = percurso(vemEspera.map(([x, z], i, arr) => (i === arr.length - 1 ? [x - k * 1.6, z] : [x, z])));
    const vai = percurso([[vemEspera.at(-1)[0] - k * 1.6, vemEspera.at(-1)[1]], ...embarca.slice(1)]);
    const Tvem = vem.L / TRAFEGO.velocidade.pessoa;
    const chegaAbrigo = tParada - 15 - k * 3;     // chegam antes do onibus e esperam
    const ini = chegaAbrigo - Tvem;
    const saiAbrigo = fimDescida + 1 + k * 1.5;
    passageiro([
      { tipo: 'fora', T: Math.max(0, ini) },
      { tipo: 'anda', T: Tvem, p: vem, pessoa: true },
      { tipo: 'espera', T: saiAbrigo - chegaAbrigo, p: vem, s: vem.L },
      { tipo: 'anda', T: vai.L / TRAFEGO.velocidade.pessoa, p: vai, pessoa: true },
    ]);
  }

  /* Troca de turno (Fase 27, item 14): quem desce do onibus troca de roupa
   * no vestiario e sai de macacao para a area (a rampa da laje mais perto,
   * pela rede de calcadas — so cruza via na travessia); quem embarca veio da
   * area de macacao, trocou e sai de roupa comum para o abrigo. Mesmo
   * relogio do onibus (o operador some ao entrar na laje e no vestiario). */
  {
    const T = po.turno, isblR = ret(bloco('ISBL'));
    const redeT = redeDePolilinhas(CALCADAS, { conectores: [isblR] });
    const porta = cam.at(-1);
    const rampa = redeT.nos.filter((n) => distPontoRetT(n.p, isblR) <= 1)
      .map((n) => ({ p: n.p, L: redeT.caminho(porta, n.p).total })).filter((q) => Number.isFinite(q.L)).sort((u, v) => u.L - v.L)[0];
    if (rampa) {
      const ida = percurso(redeT.caminho(porta, rampa.p).pontos), volta = percurso([...ida.pontos].reverse());
      const Tida = ida.L / TRAFEGO.velocidade.pessoa;
      const R = PAPEIS.find((q) => q.papel === 'operador').roupa;
      // pedaco de um percurso, de s0 a s1 (m)
      const pedaco = (pc, s0, s1) => {
        const acum = [0];
        for (let i = 1; i < pc.pontos.length; i++) acum.push(acum[i - 1] + Math.hypot(pc.pontos[i][0] - pc.pontos[i - 1][0], pc.pontos[i][1] - pc.pontos[i - 1][1]));
        return percurso([pc.em(s0), ...pc.pontos.filter((_, i) => acum[i] > s0 + 1e-6 && acum[i] < s1 - 1e-6), pc.em(s1)]);
      };
      // a caminhada (de Tida s, mais longa que meio ciclo do onibus) pode
      // passar do fim do ciclo: o fim dela vai para o comeco do ciclo
      const andar = (ini, pc) => {
        const v = TRAFEGO.velocidade.pessoa, sobra = ini + Tida - cicloBus;
        if (sobra <= 0) return [{ tipo: 'fora', T: ini }, { tipo: 'anda', T: Tida, p: pc, pessoa: true }];
        const corte = (cicloBus - ini) * v;
        return [{ tipo: 'anda', T: sobra, p: pedaco(pc, corte, pc.L), pessoa: true }, { tipo: 'fora', T: ini - sobra },
          { tipo: 'anda', T: cicloBus - ini, p: pedaco(pc, 0, corte), pessoa: true }];
      };
      const operario = (fasesP) => {
        const tot = fasesP.reduce((s2, f) => s2 + f.T, 0);
        if (tot < cicloBus) fasesP.push({ tipo: 'fora', T: cicloBus - tot });
        const pessoa = criarPessoa({ roupa: R.roupa, calca: R.calca, pele: pele(), capacete: R.capacete });
        const g = pessoa.grupo;
        g.name = 'passageiro-turno';
        g.userData.animar = pessoa.animar;
        g.userData.fase = rw() * Math.PI * 2;
        g.userData.ritmo = 0;
        grupo.add(g);
        atores.push({ g, fases: fasesP, ciclo: cicloBus, t: t0Bus, pessoa: true, dim: [0.5, 0.5], mestre: busAtor });
      };
      const Tdesce = percurso(desce).L / TRAFEGO.velocidade.pessoa;
      // chegam: desceram, trocaram, vao a area
      for (let k = 0; k < po.descem; k++) {
        const ini = (tParada + 2 + k * 1.5 + Tdesce + T.troca) % cicloBus;
        operario(andar(ini, ida));
      }
      // saem: da area ao vestiario, a tempo de trocar e ir ao abrigo
      for (let k = 0; k < po.sobem; k++) {
        const vem = percurso(vemEspera.map(([x, z], i, arr) => (i === arr.length - 1 ? [x - k * 1.6, z] : [x, z])));
        const chegaAbrigo = tParada - 15 - k * 3;
        const saiVestiario = chegaAbrigo - vem.L / TRAFEGO.velocidade.pessoa;
        const ini = (((saiVestiario - T.troca - Tida) % cicloBus) + cicloBus) % cicloBus;
        operario(andar(ini, volta));
      }
    } else {
      achar('PECA_x_OBJETO', 'Troca de turno', 'sem caminho do vestiário à laje');
    }
  }

  /* Cancela: sobe quando um veiculo esta a `aproximacao` m dela (ou debaixo
   * dela) na pista dela, desce quando ele passa. O braco gira a 85° em 1,5 s. */
  const cancelas = (entorno.cancelas ?? []).map((c) => ({ ...c, angulo: 0 }));
  const naPista = (c, x) => (c.sentido > 0 ? x > c.x && x < c.x + c.comprimento : x < c.x && x > c.x - c.comprimento);
  function alvoCancela(c) {
    return veiculos.some((a) => a.g.visible && naPista(c, a.g.position.x)
      && Math.abs(a.g.position.z - c.z) < a.meio + PT.cancela.aproximacao);
  }
  function moverCancelas(dt) {
    const w = PT.cancela.angulo / PT.cancela.abre;
    for (const c of cancelas) {
      const alvo = alvoCancela(c) ? PT.cancela.angulo : 0;
      c.angulo += Math.max(-w * dt, Math.min(w * dt, alvo - c.angulo));
      c.braco.rotation.z = c.angulo;
    }
  }

  // cota do piso onde o ator esta: laje, bloco, calcada ou via — e, para o
  // veiculo, a travessia elevada: sobe a rampa e desce do outro lado
  // a faixa verde e gramado no nivel do chao: quem a cruza segue na via
  const blocos = BLOCOS.filter((b) => b.categoria !== 'verde').map(ret);
  const travessias = chao?.travessias ?? [];
  function cotaTravessia(x, z) {
    let y = Y.via;
    for (const t of travessias) {
      const dx = x - t.x, dz = z - t.z;
      const ao = Math.abs(dx * t.dv[0] + dz * t.dv[1]);
      if (Math.abs(-dx * t.dv[1] + dz * t.dv[0]) > t.largura / 2) continue;
      const meia = TRAVESSIA.plataforma / 2;
      if (ao <= meia) y = Math.max(y, Y.calcada);
      else if (ao < meia + TRAVESSIA.rampa) y = Math.max(y, Y.calcada - ((ao - meia) / TRAVESSIA.rampa) * (Y.calcada - Y.via));
    }
    return y;
  }
  function posicionar(g, p, s, pessoa, re = false) {
    const q = p.pose(s);
    let y = pessoa ? Y.calcada : cotaTravessia(q.x, q.z);
    if (dentro(q.x, q.z, isbl)) y = 0;
    // o pedestre segue na calcada mesmo quando ela passa pela faixa verde
    else if (!pessoa && blocos.some((b) => dentro(q.x, q.z, b))) y = Y.bloco;
    g.position.set(q.x, y, q.z);
    g.rotation.y = q.rumo + (re ? Math.PI : 0);
    // luz de re acesa so na re (Fase 27, item 18)
    if (g.userData.luzRe) g.userData.luzRe.emissiveIntensity = re ? 2.2 : 0;
  }

  /** Gira as rodas pelo que o veiculo andou: o pneu nao escorrega. */
  function rodar(a, d) {
    for (const r of a.g.userData.rodas ?? []) r.rotation.x += d / a.raioRoda;
  }

  /**
   * Passo da pessoa: a fase do ciclo avanca pela distancia (dois passos de
   * PASSADA por ciclo), e a intensidade sobe e desce em 0,3 s ao comecar e
   * parar de andar, em vez de a perna congelar no meio do passo.
   */
  function passo(g, d, andando, dt) {
    const u = g.userData;
    u.fase += (Math.PI * d) / PASSADA;
    u.ritmo += ((andando ? 1 : 0) - u.ritmo) * Math.min(1, dt / 0.3);
    u.animar(u.fase, u.ritmo);
  }

  /* FILA E PREFERENCIA (Fase 19). Antes de andar, o veiculo olha a faixa a
   * frente dele (no sentido em que anda, de frente ou de re): do tamanho
   * dele mais a folga e o que anda em 0,6 s, da largura dele mais a do outro.
   * Tendo alguem ali, para — e o relogio dele para junto, para a fase nao
   * acabar com ele no meio do caminho. Quando dois se barram (cruzamento),
   * passa o de maior prioridade: onibus, caminhao, carro de passagem, carro
   * de funcionario. Pedestre andando tem a vez (ninguem passa por cima); o
   * passageiro nao barra o proprio onibus (andam no mesmo relogio). */
  const moveis = atores.filter((a) => a.dim);
  atores.forEach((a, i) => { a.id = i; });
  function faseEm(a, t) {
    for (const f of a.fases ?? []) { if (t < f.T) return f; t -= f.T; }
    return null;
  }
  const faseAgora = (a) => faseEm(a, a.t);
  const andando = (a) => a.laco || faseAgora(a)?.tipo === 'anda';
  function naFrente(a, b) {
    const f = a.laco ? null : faseAgora(a);
    const r = a.g.rotation.y, s = f?.re ? -1 : 1;
    const d = [s * Math.sin(r), s * Math.cos(r)];
    const [La, Wa] = a.dim;
    const v = a.laco ? a.v : (f?.v ?? TRAFEGO.velocidade.dentro);
    // so precisa de folga ate onde a fase dele vai: no fim de uma re, quem
    // espera logo atras nao o impede de terminar
    const resta = f ? f.p.L - a.s : Infinity;
    const alcance = Math.min(La / 2 + (La > 6 ? 2.5 : 1.5) + v * 0.6, La / 2 + resta + 0.2);
    const rx = b.g.position.x - a.g.position.x, rz = b.g.position.z - a.g.position.z;
    const ao = rx * d[0] + rz * d[1];
    if (ao <= 0) return false;
    const lat = Math.abs(-rx * d[1] + rz * d[0]);
    const rb = b.g.rotation.y;
    const cos = Math.abs(Math.sin(rb) * d[0] + Math.cos(rb) * d[1]), sen = Math.sqrt(Math.max(0, 1 - cos * cos));
    const [Lb, Wb] = b.dim;
    const folga = ao - ((Lb / 2) * cos + (Wb / 2) * sen);
    if (folga >= alcance || lat >= Wa / 2 + (Lb / 2) * sen + (Wb / 2) * cos + 0.3) return 0;
    return folga < La / 2 + 0.8 ? 2 : 1;           // 2: colado, ninguem passa
  }
  /* Previsao dos proximos HORIZONTE s (Fase 19): o corredor so ve quem ja
   * esta na frente; quem chega pela lateral (entroncamento, entrada de via)
   * so aparece colado, e ai nenhum dos dois passa. Cada um vira uma capsula
   * do tamanho dele, nas poses que o caminho dele da a cada 0,5 s; parado
   * (espera) fica onde esta. A decisao so olha a geometria e a prioridade,
   * nunca se o outro parou no passo anterior: assim ela era de um passo para
   * o outro, e os dois paravam e andavam juntos ate se encostar. */
  // folga de 0,5 m: a capsula arredonda a quina, que fica ate ~0,5 m fora
  // dela num caminhao de 2,5 m de largura [ADOTADO]
  const HORIZONTE = 4, PASSO_PREV = 0.5, FOLGA_PREV = 0.5;
  let quadro = 0;
  function previsto(b) {
    if (b.prev?.quadro === quadro) return b.prev.poses;
    const aqui = { x: b.g.position.x, z: b.g.position.z, rumo: b.g.rotation.y };
    const f = b.laco ? null : faseAgora(b);
    const p = b.laco ?? (f?.tipo === 'anda' ? f.p : null);
    let poses = [aqui];
    if (p) {
      const re = f?.re ? Math.PI : 0;
      const q = p.em(b.s);
      const v = b.laco ? b.v : (f.pessoa ? TRAFEGO.velocidade.pessoa : (f.v ?? vel(q[0], q[1])));
      poses = [];
      for (let t = 0; t <= HORIZONTE + 1e-6; t += PASSO_PREV) {
        const s = b.laco ? (b.s + v * t) % p.L : Math.min(p.L, b.s + v * t);
        const o = p.pose(s);
        poses.push({ x: o.x, z: o.z, rumo: o.rumo + re });
      }
    }
    b.prev = { quadro, poses };
    return poses;
  }
  /** Distancia entre as capsulas de a e b nas poses dadas (menos os raios). */
  function folgaCapsulas(a, pa, b, pb) {
    const seg = (o, L, W) => {
      const h = Math.max(0, L / 2 - W / 2), dx = Math.sin(o.rumo) * h, dz = Math.cos(o.rumo) * h;
      return [[o.x - dx, o.z - dz], [o.x + dx, o.z + dz]];
    };
    const [p1, p2] = seg(pa, a.dim[0], a.dim[1]), [q1, q2] = seg(pb, b.dim[0], b.dim[1]);
    const d = Math.min(distPontoSegAcesso(p1, q1, q2), distPontoSegAcesso(p2, q1, q2), distPontoSegAcesso(q1, p1, p2), distPontoSegAcesso(q2, p1, p2));
    return d - a.dim[1] / 2 - b.dim[1] / 2;
  }
  /** Primeiro passo da previsao em que x chega onde y esta agora (ou Infinity). */
  function cruza(x, posesX, y, poseY) {
    for (let k = 1; k < posesX.length; k++) if (folgaCapsulas(x, posesX[k], y, poseY) < FOLGA_PREV) return k;
    return Infinity;
  }
  function choquePrevisto(a, b, folga = FOLGA_PREV) {
    const pa = previsto(a), pb = previsto(b);
    const n = Math.max(pa.length, pb.length);
    for (let k = 1; k < n; k++) {
      if (folgaCapsulas(a, pa[Math.min(k, pa.length - 1)], b, pb[Math.min(k, pb.length - 1)]) < folga) return true;
    }
    return false;
  }
  /** Os dois andam para o mesmo lado (no sentido do movimento, de re ou nao). */
  function mesmoSentido(a, b) {
    const sentido = (x) => { const f = x.laco ? null : faseAgora(x); const r = x.g.rotation.y + (f?.re ? Math.PI : 0); return [Math.sin(r), Math.cos(r)]; };
    const [p, q] = [sentido(a), sentido(b)];
    return p[0] * q[0] + p[1] * q[1] > 0.5;
  }
  /* Linha de parada (Fase 19): quem vai entrar na via publica — e ainda nao
   * entrou — espera a brecha antes do meio-fio. Parando com o nariz na
   * pista (o caminhao-tanque, saindo da via leste), ele fechava quem vinha
   * do outro lado, e um esperava o outro. */
  const principal = VIAS.find((v) => v.id === TRAFEGO.carros.via);
  const naPrincipal = (o, a) => {
    const fx = o.x + Math.sin(o.rumo) * a.dim[0] / 2, fz = o.z + Math.cos(o.rumo) * a.dim[0] / 2;
    return principal.pontos.some((p, i) => i > 0 && distPontoSegAcesso([fx, fz], principal.pontos[i - 1], p) < principal.largura / 2);
  };
  // `cede`: a quem o veiculo esta dando a vez (para depurar)
  function bloqueado(a) {
    const va = a.laco ? a.v : TRAFEGO.velocidade.fora;
    a.cede = null;
    const ceder = (b) => { a.cede = b; return true; };
    for (const b of moveis) {
      // o carro de passagem conta mesmo na margem em que some: ele esta la
      if (b === a || (!b.g.visible && !b.laco) || b.mestre === a) continue;
      const n = naFrente(a, b);
      // colado: a capsula do outro, a frente, a menos de 0,4 m — ninguem passa
      if (n && folgaCapsulas(a, previsto(a)[0], b, previsto(b)[0]) < 0.4) return ceder(b);
      const bParado = !b.pessoa && !andando(b);
      // fila (o corredor so vale para isto): o da frente esta parado, e
      // gente, ou anda no mesmo sentido. Cruzamento e pista oposta ficam com
      // a previsao: virando, o corredor e largo e ve quem passa do outro lado.
      if (n && (b.pessoa || bParado || mesmoSentido(a, b))) return ceder(b);
      // longe demais para se encontrarem no horizonte
      const longe = Math.hypot(b.g.position.x - a.g.position.x, b.g.position.z - a.g.position.z);
      if (longe > (va + TRAFEGO.velocidade.fora) * HORIZONTE + (a.dim[0] + b.dim[0]) / 2) continue;
      // contra quem esta parado (o vizinho de vaga), so quase o toque barra:
      // carro estaciona a 0,35 m do outro, e a folga cheia prendia quem
      // estaciona
      if (!choquePrevisto(a, b, bParado ? 0.15 : FOLGA_PREV)) continue;
      // vao se encontrar. Espera quem chega onde o outro esta parado, ou cruza
      // com gente. Quem vem atras no mesmo sentido segue o da frente (nunca o
      // contrario). Depois, quem atrapalha o outro primeiro — o caminho do
      // outro passa antes por onde ele esta — termina de passar, e o outro
      // espera: o caminhao com o nariz na pista nao para ali. No empate, a
      // prioridade.
      if (b.pessoa || bParado) return ceder(b);
      if (naFrente(b, a) && mesmoSentido(a, b)) continue;
      // entrada na via publica: quem vai entrar espera; quem esta nela segue
      const entrando = (x) => { const p = previsto(x); return !naPrincipal(p[0], x) && p.some((o) => naPrincipal(o, x)); };
      // (vale para todo veiculo que esta nela agora, nao so o de passagem)
      const naVia = (x) => naPrincipal(previsto(x)[0], x);
      if (naVia(b) && entrando(a)) return ceder(b);
      if (naVia(a) && entrando(b)) continue;
      const kEle = cruza(a, previsto(a), b, previsto(b)[0]);   // ele, onde esta, no meu caminho
      const kEu = cruza(b, previsto(b), a, previsto(a)[0]);    // eu, onde estou, no dele
      if (kEle < kEu) return ceder(b);
      if (kEu < kEle) continue;
      if (b.prio > a.prio || (b.prio === a.prio && b.id < a.id)) return ceder(b);
    }
    return false;
  }
  /** Quem vai entrar em cena espera fora dela se o ponto de entrada esta ocupado. */
  function entradaOcupada(a, f) {
    const [x, z] = f.p.em(0);
    // o carro de passagem conta mesmo na margem em que some (ele esta la)
    return moveis.some((b) => b !== a && !b.pessoa && (b.g.visible || b.laco)
      && Math.hypot(b.g.position.x - x, b.g.position.z - z) < (a.dim[0] + b.dim[0]) / 2 + 2);
  }
  /** Re so comeca com o caminho dela livre — de quem esta nele e de quem
   *  vai passar por ele nos proximos 15 m: quem manobra espera na vaga. */
  function reOcupada(a, f) {
    const meu = [];
    for (let s = 0; s <= f.p.L; s += 1) meu.push(f.p.em(s));
    for (const b of moveis) {
      if (b === a || b.pessoa || !b.g.visible) continue;
      const lim = (a.dim[1] + b.dim[0]) / 2 + 0.5;
      const dele = [[b.g.position.x, b.g.position.z]];
      const fb = b.laco ? null : faseAgora(b);
      const pb = b.laco ?? (fb?.tipo === 'anda' ? fb.p : null);
      if (pb) for (let s = b.s; s <= b.s + 15 && s <= pb.L; s += 1) dele.push(pb.em(s));
      if (meu.some(([x, z]) => dele.some(([u, w]) => Math.hypot(u - x, w - z) < lim))) return true;
    }
    return false;
  }
  // o carro de passagem aparece e some a MARGEM_LACO m das pontas da via publica
  const MARGEM_LACO = 5;

  let relogioGiroflex = 0;
  function atualizar(dt) {
    // giroflex: o facho girando passa pela vista ~1,5 vez por segundo
    relogioGiroflex += dt;
    GIROFLEX.emissiveIntensity = Math.sin(relogioGiroflex * Math.PI * 3) > 0.55 ? 3.5 : 0.25;
    quadro++;
    for (const a of atores) {
      if (a.laco) {
        const barrado = bloqueado(a);
        a.passoT = barrado ? 0 : dt;
        const d = barrado ? 0 : a.v * dt;
        a.s = (a.s + d) % a.laco.L;
        a.g.visible = a.s > MARGEM_LACO && a.s < a.laco.L - MARGEM_LACO;
        posicionar(a.g, a.laco, a.s, false);
        rodar(a, d);
        continue;
      }
      // retido pelo passeio (Fase 22): fora de cena, com o relogio parado,
      // ate a hora de entrar para a camera o ver chegar
      if (a.retido) { a.passoT = 0; a.g.visible = false; continue; }
      // quem segue outro relogio anda o que ele andou; veiculo barrado espera
      let passoT = a.mestre ? (a.mestre.passoT ?? dt) : dt;
      const f0 = !a.pessoa && a.fase >= 0 ? faseAgora(a) : null;
      if (f0?.tipo === 'anda' && a.g.visible && bloqueado(a)) passoT = 0;
      // vai comecar a andar (a fase troca neste passo): entra em cena so com
      // o ponto de entrada livre, e comeca a re so com o caminho dela livre.
      // Olha a fase em que vai entrar — no passo seguinte ja teria andado.
      if (!a.pessoa && a.fase >= 0 && passoT > 0) {
        const fN = faseEm(a, (a.t + passoT) % a.ciclo);
        if (fN !== f0 && fN?.tipo === 'anda') {
          if (!a.g.visible && entradaOcupada(a, fN)) { a.passoT = 0; continue; }
          if (fN.re && reOcupada(a, fN)) passoT = 0;
        }
      }
      a.passoT = passoT;
      a.t = (a.t + passoT) % a.ciclo;
      let t = a.t, f = null, i = 0;
      for (; i < a.fases.length; i++) { if (t < a.fases[i].T) { f = a.fases[i]; break; } t -= a.fases[i].T; }
      if (!f) continue;
      if (i !== a.fase) { a.fase = i; a.s = 0; }
      a.g.visible = f.tipo !== 'fora';
      if (f.tipo === 'espera') {
        posicionar(a.g, f.p, f.s, a.pessoa, f.re);
        if (a.pessoa) passo(a.g, 0, false, dt);
      } else if (f.tipo === 'anda') {
        const q = f.p.em(a.s);
        const d = (f.pessoa ? TRAFEGO.velocidade.pessoa : (f.v ?? vel(q[0], q[1]))) * a.passoT;
        a.s += d;
        posicionar(a.g, f.p, Math.min(a.s, f.p.L), a.pessoa, f.re);
        if (a.pessoa) passo(a.g, d, true, dt);
        else rodar(a, d);
      }
    }
  }
  /** O ator como estaria no instante t do relogio dele, andando sem ser
   *  barrado: o passeio (Fase 22) pula de parada e o poe no lugar. A
   *  distancia na fase sai da mesma velocidade do passo normal, integrada a
   *  cada 0,05 s (fora do lote o carro anda mais depressa). */
  function posicionarEm(a, t) {
    a.retido = false;
    a.passoT = 0;
    a.t = ((t % a.ciclo) + a.ciclo) % a.ciclo;
    let r = a.t, i = 0;
    for (; i < a.fases.length && r >= a.fases[i].T; i++) r -= a.fases[i].T;
    const f = a.fases[i];
    if (!f) return;
    a.fase = i; a.s = 0;
    a.g.visible = f.tipo !== 'fora';
    if (f.tipo === 'espera') posicionar(a.g, f.p, f.s, a.pessoa, f.re);
    else if (f.tipo === 'anda') {
      for (let tau = 0; tau < r; tau += 0.05) {
        const q = f.p.em(Math.min(a.s, f.p.L));
        a.s += (f.pessoa ? TRAFEGO.velocidade.pessoa : (f.v ?? vel(q[0], q[1]))) * Math.min(0.05, r - tau);
      }
      posicionar(a.g, f.p, Math.min(a.s, f.p.L), a.pessoa, f.re);
    }
  }
  const atualizarAtores = atualizar;
  function atualizarTudo(dt) {
    atualizarAtores(dt);
    moverCancelas(dt);
  }
  atualizarTudo(0);

  /* ======================================================================
   *  6. Auditoria
   * =================================================================== */
  const destinos = [...[ret(bloco('DESCARGA')), ret(bloco('ARMAZEM'))].map((r) => expandir(r, 8)), est];
  const abrigoR = ret(PT.onibus.abrigo);
  for (const a of atores) {
    const ps = a.laco ? [a.laco] : a.fases.filter((f) => f.p).map((f) => f.p);
    for (const p of ps) {
      for (let s = 0; s <= p.L; s += 1) {
        const [x, z] = p.em(s);
        if (a.pessoa) {
          if (!calcadas.some((c) => dentro(x, z, expandir(c, 0.3))) && !dentro(x, z, abrigoR)) { achar('PEDESTRE_FORA_DA_CALCADA', a.g.name, `(${f1(x)}; ${f1(z)})`); break; }
        } else if (!vias.some((v) => dentro(x, z, expandir(v, 0.5))) && !destinos.some((d) => dentro(x, z, d))) {
          achar('VEICULO_FORA_DA_VIA', a.g.name, `(${f1(x)}; ${f1(z)})`);
          break;
        }
      }
    }
  }
  for (const m of mArv) {
    const p = V().setFromMatrixPosition(m);
    if (riscos.some((q) => distRetRet(q, quadrado(p.x, p.z, 0.5)) < ARVORES.afastamentoRisco)) achar('ARVORE_PERTO_DE_RISCO', 'árvore', `(${f1(p.x)}; ${f1(p.z)})`);
  }

  /* CANCELA_SOBRE_VEICULO: simula dez minutos do trafego e confere que, com
   * um veiculo debaixo do braco, a cancela esta em cima. Depois volta tudo ao
   * comeco. */
  /* Fase 19, no mesmo passo de 0,1 s, por veiculo a vista:
   *   VEICULO_SALTO      andou mais de 3 m num passo (teletransporte)
   *   VEICULO_GIRO       o rumo mudou mais que o raio de giro dele permite
   *                      (com folga de 50 %: a pose suaviza em 3 m)
   *   VEICULO_x_VEICULO  as caixas de dois veiculos se tocam
   *   VEICULO_x_PESSOA   veiculo andando por cima de alguem (parado, com
   *                      gente encostada na porta, nao conta)
   *   VEICULO_PRESO      mais de 60 s parado na fila: impasse */
  {
    const salvo = atores.map((a) => ({ t: a.t, s: a.s, fase: a.fase }));
    const veic = moveis.filter((a) => !a.pessoa);
    const antes = veic.map((a) => ({ x: a.g.position.x, z: a.g.position.z, r: a.g.rotation.y, vis: a.g.visible, preso: 0 }));
    const paradas = [];
    grupo.traverse((o) => { if (/^pessoa-(operador|motorista|vigia)/.test(o.name)) paradas.push(o); });
    const conta = {};
    const vistos = new Set();
    const marcar = (regra, peca, det) => { conta[regra] = (conta[regra] ?? 0) + 1; if (conta[regra] <= 4) achar(regra, peca, det); };
    const caixa = (x, z, r, L, W) => ({ c: [x, z], f: [Math.sin(r), Math.cos(r)], l: [Math.cos(r), -Math.sin(r)], hl: L / 2 - 0.1, hw: W / 2 - 0.1 });
    const sep = (A, B, ax) => {
      const pr = (C) => Math.abs(C.f[0] * ax[0] + C.f[1] * ax[1]) * C.hl + Math.abs(C.l[0] * ax[0] + C.l[1] * ax[1]) * C.hw;
      return Math.abs((B.c[0] - A.c[0]) * ax[0] + (B.c[1] - A.c[1]) * ax[1]) > pr(A) + pr(B);
    };
    const toca = (A, B) => ![A.f, A.l, B.f, B.l].some((ax) => sep(A, B, ax));
    const caixaDe = (a) => caixa(a.g.position.x, a.g.position.z, a.g.rotation.y, a.dim[0], a.dim[1]);
    let ruim = 0;
    for (let k = 0; k < 6000; k++) {
      atualizarTudo(0.1);
      for (const c of cancelas) {
        const sob = veiculos.some((a) => a.g.visible && naPista(c, a.g.position.x) && Math.abs(a.g.position.z - c.z) < a.meio + 0.3);
        if (sob && c.angulo < (80 * Math.PI) / 180 && ruim++ < 3) {
          achar('CANCELA_SOBRE_VEICULO', `cancela de ${c.pista}`, `braço a ${Math.round((c.angulo * 180) / Math.PI)}° com veículo debaixo, t = ${f1(k * 0.1)} s`);
        }
      }
      const onde = (p) => `(${f1(p.x)}; ${f1(p.z)}), t = ${f1(k * 0.1)} s`;
      const andou = veic.map((a, i) => {
        const p = a.g.position, q = antes[i];
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (a.g.visible && q.vis) {
          let dr = Math.abs(a.g.rotation.y - q.r) % (Math.PI * 2);
          dr = Math.min(dr, Math.PI * 2 - dr);
          if (d > 3) marcar('VEICULO_SALTO', a.g.name, `${f1(d)} m num passo, em ${onde(p)}`);
          else if (dr > 0.02 && dr > (d / RAIO[a.tipoV]) * 1.5 + 0.02) marcar('VEICULO_GIRO', a.g.name, `${Math.round((dr * 180) / Math.PI)}° em ${f1(d)} m, em ${onde(p)}`);
          const deveria = a.laco || faseAgora(a)?.tipo === 'anda';
          q.preso = deveria && d < 1e-4 ? q.preso + 0.1 : 0;
          if (q.preso > 60 && q.preso < 60.15) marcar('VEICULO_PRESO', a.g.name, `parado na fila há 60 s em ${onde(p)}`);
        }
        Object.assign(q, { x: p.x, z: p.z, r: a.g.rotation.y, vis: a.g.visible });
        return d;
      });
      for (let i = 0; i < veic.length; i++) {
        const A = veic[i];
        if (!A.g.visible) continue;
        const cA = caixaDe(A);
        for (let j = i + 1; j < veic.length; j++) {
          const B = veic[j];
          if (!B.g.visible || !toca(cA, caixaDe(B))) continue;
          const par = `${A.g.name}×${B.g.name}`;
          if (!vistos.has(par)) { vistos.add(par); marcar('VEICULO_x_VEICULO', par, `${onde(A.g.position)}; o outro em (${f1(B.g.position.x)}; ${f1(B.g.position.z)}), fase ${B.fase}`); }
        }
        if (andou[i] < 0.01) continue;
        for (const b of [...moveis.filter((m) => m.pessoa && m.g.visible).map((m) => m.g), ...paradas]) {
          if (!toca(cA, caixa(b.position.x, b.position.z, 0, 0.5, 0.5))) continue;
          const par = `${A.g.name}×${b.name}`;
          if (!vistos.has(par)) { vistos.add(par); marcar('VEICULO_x_PESSOA', par, `${onde(A.g.position)}; pessoa em (${f1(b.position.x)}; ${f1(b.position.z)})`); }
        }
      }
    }
    atores.forEach((a, i) => Object.assign(a, salvo[i], { passoT: undefined }));
    for (const c of cancelas) { c.angulo = 0; c.braco.rotation.z = 0; }
    atualizarTudo(0);
  }

  /* Pessoa de longe (Fase 17): cada uma e animada, fica fora da fusao e
   * custa ~18 chamadas de desenho; a mais de LONGE_PESSOA m ela e um ponto
   * de poucos pixels, e passa para a camada 1, que a camera nao desenha. Na
   * vista geral sao ~200 chamadas a menos. [ADOTADO] */
  const LONGE_PESSOA = 120;
  const pessoasLonge = [];
  (function achar(no) {
    for (const f of no.children) {
      if (/^(pessoa|passageiro)/.test(f.name)) {
        const malhas = [];
        f.traverse((m) => { if (m.isMesh) malhas.push(m); });
        pessoasLonge.push({ raiz: f, malhas, longe: false });
      } else achar(f);
    }
  }(grupo));
  const pw = new THREE.Vector3();
  function distanciaPessoas(camera) {
    for (const it of pessoasLonge) {
      it.raiz.getWorldPosition(pw);
      const longe = pw.distanceTo(camera.position) > LONGE_PESSOA;
      if (longe === it.longe) continue;
      it.longe = longe;
      for (const m of it.malhas) m.layers.set(longe ? 1 : 0);
    }
  }

  const resumo = { arvores: mArv.length, postes: mPoste.length, carros: mCarro.length, atores: atores.length };
  // `atores` so para depurar no console (window.__maquete.ambiente)
  /** Gente de fora deste modulo (as rotinas da Fase 20) que os veiculos
   *  respeitam como pedestre: { g, dim, pessoa: true }. */
  const pedestres = (lista) => { for (const p of lista) moveis.push(p); };
  return { grupo, achados, resumo, atualizar: atualizarTudo, distanciaPessoas, atores, pedestres, posicionarEm,
    depurar: { naFrente, previsto, folgaCapsulas, cruza, mesmoSentido, faseAgora } };
}
