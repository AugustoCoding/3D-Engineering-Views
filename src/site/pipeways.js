import * as THREE from 'three';
import { tuboPorCaminho } from '../lib/pipe.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { rotulo } from '../lib/dimensions.js';
import { tracar } from '../lib/rota.js';
import { criarPoste } from '../lib/apoios.js';
import { criarBombaCentrifuga } from '../lib/bomba.js';
import {
  criarPostePipeway, criarPontePipeway, criarBandeja, criarCaixaInspecao, criarTanqueHorizontal, criarLuva,
} from '../lib/pipeway.js';
import { linhaTracejada, placa, Y } from '../lib/terreno.js';
import { dirPlana, direita, deslocar, esquinasDasVias, retangulosDaEsquina } from '../lib/plano.js';
import * as SITE from '../data/site.js';
import { MAT } from '../core/materials.js';
import { matCodigo } from '../equipment/tubulacao.js';
import { DN } from '../data/plant.js';
import { VIAS, BLOCOS, TANQUES, CALCADAS, LARGURA_CALCADA } from '../data/site.js';
import { CHUVA } from '../data/agua.js';
import { RACK } from '../data/arranjo.js';
import { VAO_ADMISSIVEL, DN_MIN_SEM_BANDEJA, DESTINOS, CODIGOS_MAQUETE, CABECAIS } from '../data/rotas.js';
import { pedacoDeSuccao, npshDaBomba, correnteDeUtilidade } from '../lib/hidraulica.js';
import { CODIGOS } from '../data/pid.js';
import { BACIA } from '../data/entorno.js';
import {
  PIPEWAY, CORREDORES, LINHAS_OSBL, RAMAIS_OSBL, BOMBAS_OSBL, TANQUE_ALIMENTACAO, BOCAIS_TANQUE,
  TE_SUCCAO, PAREDES, DRENAGEM, ACESSOS, LIMITES,
} from '../data/pipeways.js';

/**
 * ===========================================================================
 *  PIPEWAYS — interligacao fora dos limites de bateria  (Fase 7)
 * ===========================================================================
 *  Composicao: le data/pipeways.js e combina as primitivas.
 *
 *    1. cada linha que sai de uma flange de limite segue a arvore de
 *       corredores na faixa que tinha no rack (deslocamento lateral
 *       constante, curvas aninhadas: duas linhas nunca se cruzam numa curva);
 *    2. as bombas e o tanque que o P&ID nao traz sao postos sob o ponto onde
 *       a linha para — a descarga sobe reta ate ela;
 *    3. o roteador (lib/rota.js) leva cada linha da parada ao bocal;
 *    4. os postes vao a cada vao do rack, fora das vias e dos obstaculos; onde
 *       o corredor cruza uma via, ponte trelicada entre dois porticos;
 *    5. tudo medido: altura livre sobre via, poste na via, vao sem apoio,
 *       tubo contra objeto e contra tubo, rota contra o caminho minimo,
 *       succao sem ponto alto. Achados vao para __auditarEntorno().
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f1 = (v) => v.toFixed(1).replace('.', ',');
const f2 = (v) => v.toFixed(2).replace('.', ',');
const nomeCodigo = (c) => CODIGOS[c] ?? CODIGOS_MAQUETE[c] ?? c;


/** Tira pontos repetidos e os do meio de trechos colineares. */
function limpar(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length && out[out.length - 1].distanceTo(p) < 1e-4) continue;
    out.push(p.clone());
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const u = new THREE.Vector3().subVectors(out[i], out[i - 1]).normalize();
    const v = new THREE.Vector3().subVectors(out[i + 1], out[i]).normalize();
    if (u.dot(v) > 1 - 1e-6) out.splice(i, 1);
  }
  return out;
}

function comprimento(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
  return L;
}

/** Intervalos [a, b] fundidos e ordenados. */
function fundir(ints) {
  const s = ints.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const [a, b] of s) {
    if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
}

const dentroDe = (t, ints) => ints.find(([a, b]) => t > a + 1e-6 && t < b - 1e-6);
const sobrepoe = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const expandir = (r, m) => ({ ...r, x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });

/** Retangulos das vias e das rampas de veiculo. */
function areasDeVia() {
  const out = [];
  for (const v of VIAS) {
    for (let i = 1; i < v.pontos.length; i++) {
      const [ax, az] = v.pontos[i - 1], [bx, bz] = v.pontos[i];
      const m = v.largura / 2;
      out.push({ id: v.id, x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m });
    }
  }
  for (const a of ACESSOS) out.push({ id: a.id, x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1 });
  // a pista acrescentada nas esquinas arredondadas (Fase 14)
  // (a curva do eixo acrescenta a mesma pista no canto de dentro)
  for (const k of esquinasDasVias(VIAS, SITE)) {
    for (const r of retangulosDaEsquina(k)) out.push({ id: `esquina ${k.nome}`, ...r });
  }
  return out;
}

/** Caixas em planta das malhas de um grupo (uma por malha). */
function caixasDasMalhas(grupo) {
  const out = [];
  grupo.updateWorldMatrix(true, true);
  grupo.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    out.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return out;
}

const plano = (c) => ({ x0: c.min.x, x1: c.max.x, z0: c.min.z, z1: c.max.z });

export function criarPipeways({ tubulacao, entorno }) {
  const grupo = new THREE.Group();
  grupo.name = 'pipeways';
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  const rotulosPlanta = new THREE.Group();
  rotulosPlanta.name = 'pipeways-planta';
  grupo.add(rotulos);
  rotulosPlanta.visible = false;               // so na vista de planta
  grupo.add(rotulosPlanta);
  const achados = [];
  const achar = (regra, peca, detalhe) => achados.push({ regra, peca, detalhe });
  const objetos = [];                             // equipamento de fora: auditoria e selecao
  const vias = areasDeVia();
  const doEntorno = Object.fromEntries(entorno.objetos.map((o) => [o.nome, o.grupo]));

  /* ======================================================================
   *  1. Corredores e linhas ao longo deles
   * =================================================================== */
  const corr = Object.fromEntries(CORREDORES.map((c) => [c.id, c]));
  function cadeia(id) {
    const c = corr[id];
    const proprios = (base) => c.pontos.map((p, k) => ({ p: [...p], corr: id, k: base + k }));
    let pts;
    if (!c.de) pts = proprios(0);
    else if (c.de.startsWith('LB:')) {
      const lb = LIMITES[c.de.slice(3)];
      pts = [{ p: [lb.x, RACK.z], corr: id, k: -1, lb: true }, ...proprios(0)];
    } else pts = [...cadeia(c.de), ...proprios(0)];
    return pts;
  }
  // cada trecho e identificado pelo corredor dono e o indice do ponto final
  const chaveTrecho = (a, b) => `${b.corr}:${b.k}`;

  const trechos = new Map();                      // chave -> { a, b, linhas, inicioLB, corr }
  const linhas = [];
  const limitePor = Object.fromEntries((tubulacao.limites ?? []).map((l) => [l.id, l]));

  for (const L of LINHAS_OSBL) {
    const ch = cadeia(L.corredor);
    const proprio = ch.filter((q) => q.corr === L.corredor && !q.lb);
    const fimIdx = L.parada != null ? ch.indexOf(proprio[L.parada]) : ch.length - 1;
    const pts2 = ch.slice(0, fimIdx + 1);
    const d0 = dirPlana(pts2[0].p, pts2[1].p);
    let y, od, dn, fluido, mat, o, inicio = null, fichaOrig = null;
    if (L.de === 'LB') {
      const lim = limitePor[L.linha];
      if (!lim) { achar('LIMITE_FALTANDO', `Linha ${L.linha}`, 'a flange de limite não existe'); continue; }
      ({ dn, od, fluido, mat } = lim);
      y = lim.pos.y;
      const r0 = direita(d0);
      o = (lim.pos.x - pts2[0].p[0]) * r0[0] + (lim.pos.z - pts2[0].p[1]) * r0[1];
      inicio = lim.pos.clone();
      fichaOrig = lim.ficha;
    } else {
      dn = L.dn; od = DN[dn].od; fluido = L.fluido; mat = matCodigo(fluido);
      y = RACK.niveis[(L.nivel ?? 1) - 1] + od / 2;
      o = 0;
    }
    const plan = deslocar(pts2.map((q) => q.p), o);
    const corredor = plan.map(([x, z]) => V(x, y, z));
    if (inicio) corredor[0] = inicio.clone();
    const linha = {
      id: L.linha, spec: L, dn, od, fluido, mat, y, o, corredor, cadeia: pts2, fichaOrig,
      bop: y - od / 2, pequena: dn < DN_MIN_SEM_BANDEJA,
    };
    linhas.push(linha);
    for (let i = 1; i < pts2.length; i++) {
      const k = chaveTrecho(pts2[i - 1], pts2[i]);
      if (!trechos.has(k)) {
        trechos.set(k, { chave: k, a: pts2[i - 1].p, b: pts2[i].p, linhas: [], inicioLB: !!pts2[i - 1].lb, corr: pts2[i].corr });
      }
      trechos.get(k).linhas.push(linha);
    }
  }
  const linhaPor = Object.fromEntries(linhas.map((l) => [l.id, l]));
  const parada = (id) => { const l = linhaPor[id]; return l.corredor[l.corredor.length - 1]; };
  const dirFinal = (l) => {
    const c = l.corredor, n = c.length;
    return new THREE.Vector3().subVectors(c[n - 1], c[n - 2]).setY(0).normalize();
  };

  /* ======================================================================
   *  2. Equipamento de fora: bombas e tanque de alimentacao
   * =================================================================== */
  const ancoras = {};
  const pecas = new THREE.Group();
  pecas.name = 'equipamento-osbl';
  grupo.add(pecas);
  const GIRO = { '-z': -Math.PI / 2, '+z': Math.PI / 2, '-x': 0, '+x': Math.PI };

  function flange(pos, dir, dn, comp, ficha) {
    const b = criarBocal({ dn, comprimento: comp });
    orientarPara(b, pos, dir);
    if (ficha) b.userData.ficha = ficha;
    pecas.add(b);
    return pos.clone().addScaledVector(dir, comp);
  }

  function pad(g, nome) {
    const c = new THREE.Box3().setFromObject(g);
    const r = { x0: c.min.x - 0.3, x1: c.max.x + 0.3, z0: c.min.z - 0.3, z1: c.max.z + 0.3 };
    const p = placa(r, Y.bloco, MAT.concreto, Y.bloco - Y.lote + 0.1);
    p.name = `base-${nome}`;
    pecas.add(p);
    return r;
  }

  for (const b of BOMBAS_OSBL) {
    const alvo = parada(b.sob);
    const bp = criarBombaCentrifuga(b.geom);
    const g = bp.raiz;
    g.rotation.y = GIRO[b.succaoPara];
    const D = bp.bocais.find((n) => n.id === 'D');
    const face = V(...D.pos).addScaledVector(V(...D.dir), D.comprimento).applyAxisAngle(V(0, 1, 0), g.rotation.y);
    g.position.set(alvo.x + b.dx - face.x, Y.bloco, alvo.z - face.z);
    g.name = b.tag;
    g.userData.ficha = {
      titulo: b.tag, subtitulo: b.nome,
      grupos: [{ nome: 'Proposta da maquete — fora do P&ID (estimado)', dados: b.ficha }],
    };
    pecas.add(g);
    g.updateWorldMatrix(true, true);
    for (const n of bp.bocais) {
      const pos = g.localToWorld(V(...n.pos));
      const dir = V(...n.dir).applyAxisAngle(V(0, 1, 0), g.rotation.y);
      ancoras[`${b.tag}.${n.id}`] = { pos: flange(pos, dir, n.dn, n.comprimento), dir, dn: n.dn, tipo: 'bocal' };
    }
    const r = pad(g, b.tag);
    objetos.push({ nome: b.tag, grupo: g, pegada: r });
    const lbl = rotulo(b.tag, 'tag-label');
    lbl.position.set((r.x0 + r.x1) / 2, Y.bloco + 1.6, (r.z0 + r.z1) / 2);
    rotulos.add(lbl);
  }

  {
    const t = TANQUE_ALIMENTACAO;
    const alvo = parada(t.sob);
    const ta = criarTanqueHorizontal(t);
    ta.grupo.position.set(alvo.x, Y.bloco, alvo.z);
    ta.grupo.name = t.tag;
    ta.grupo.userData.ficha = {
      titulo: t.tag, subtitulo: 'Tanque de água de alimentação da caldeira',
      grupos: [{ nome: 'Proposta da maquete (estimado)', dados: {
        'Dimensões': `Ø ${f1(t.D)} × ${f1(t.L)} m`,
        'Reserva': '≈ 20 min de vapor (2 637 kg/h)',
        'Recebe': 'Retorno de condensado (COND) do processo',
      } }],
    };
    pecas.add(ta.grupo);
    ta.grupo.updateWorldMatrix(true, true);
    const c = ta.bocais.C;
    const pos = ta.grupo.localToWorld(V(...c.pos));
    ancoras['TQ-AA.C'] = { pos: flange(pos, V(0, 1, 0), linhaPor.COND.dn, 0.15), dir: V(0, 1, 0), tipo: 'bocal' };
    objetos.push({ nome: t.tag, grupo: ta.grupo, pegada: plano(new THREE.Box3().setFromObject(ta.grupo)) });
  }

  /* ======================================================================
   *  3. Ancoras no entorno
   * =================================================================== */
  const yS = ancoras['BT-01.S'].pos.y;
  const yDT = linhaPor.DT.y;
  const LADO = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] };
  function bocalTanque(id, lado, y, dn) {
    const t = TANQUES.find((q) => q.id === id);
    const { R } = doEntorno[id].userData.tanque;
    const [lx, lz] = LADO[lado];
    const dir = V(lx, 0, lz);
    const pos = V(t.x + lx * R, y, t.z + lz * R);
    return { pos: flange(pos, dir, dn, 0.2), dir, dn, tipo: 'bocal', objeto: id };
  }
  for (const [id, bs] of Object.entries(BOCAIS_TANQUE)) {
    const { yFundo } = doEntorno[id].userData.tanque;
    for (const [k, b] of Object.entries(bs)) ancoras[`${id}.${k}`] = bocalTanque(id, b.lado, Y.bloco + yFundo + b.altura, b.dn);
  }
  // Saida para a bomba no eixo da succao dela: a linha corre reta, sem
  // ponto alto. Enchimento no nivel do pipeway, pelo alto do costado.
  for (const id of ['TQ-01', 'TQ-02']) {
    ancoras[`${id}.S`] = bocalTanque(id, '+z', yS, 40);
    ancoras[`${id}.F`] = bocalTanque(id, '-z', yDT, 80);
  }
  {
    const tg = doEntorno.torre;
    tg.updateWorldMatrix(true, true);
    const R = tg.userData.bocais.R;
    const dir = V(...R.dir);
    ancoras['TORRE.R'] = { pos: flange(tg.localToWorld(V(...R.pos)), dir, linhaPor.CWR.dn, 0.25), dir, tipo: 'bocal', objeto: 'torre' };
    const zFace = tg.position.z + tg.userData.bacia.face;
    for (const [k, tag] of [['S1', 'BAR-01A'], ['S2', 'BAR-01B']]) {
      const s = ancoras[`${tag}.S`].pos;
      ancoras[`TORRE.${k}`] = { pos: flange(V(s.x, s.y, zFace), V(0, 0, 1), 200, 0.2), dir: V(0, 0, 1), tipo: 'bocal', objeto: 'torre' };
    }
  }
  {
    const cg = doEntorno.caldeira;
    cg.updateWorldMatrix(true, true);
    const b = cg.userData.bocais.V;
    const dir = V(...b.dir);
    ancoras['CALDEIRA.V'] = { pos: flange(cg.localToWorld(V(...b.pos)), dir, linhaPor.STM.dn, 0.25), dir, tipo: 'bocal', objeto: 'caldeira' };
  }
  {
    // A linha 28 atravessa a parede norte do armazem numa luva com flange.
    const p = parada('28');
    const pos = V(p.x, p.y, PAREDES.ARMAZEM);
    grupo.add(criarLuva(pos, V(0, 0, 1), linhaPor['28'].od));
    ancoras['ARMAZEM.P'] = { pos: flange(pos, V(0, 0, -1), linhaPor['28'].dn, 0.1), dir: V(0, 0, -1), tipo: 'bocal', objeto: 'predio-ARMAZEM' };
  }
  for (const k of [1, 2]) {
    const bg = doEntorno[`braco-${k}`];
    bg.updateWorldMatrix(true, true);
    const b = bg.userData.bocais.S;
    const dir = V(...b.dir).applyAxisAngle(V(0, 1, 0), bg.rotation.y);
    ancoras[`BRACO-${k}.S`] = { pos: flange(bg.localToWorld(V(...b.pos)), dir, 80, 0.15), dir, tipo: 'bocal', objeto: `braco-${k}` };
  }
  {
    const s = ancoras['BRACO-1.S'].pos;
    ancoras['BRACO-1.T'] = { pos: V(s.x, s.y, linhaPor.DT.corredor[0].z), tipo: 'te' };
    const c = parada('CWS');
    ancoras['TE-CWS'] = { pos: V(c.x, Y.bloco + 1.6, c.z), dir: V(0, 1, 0), tipo: 'te' };
    const bs = ancoras['BT-01.S'].pos;
    ancoras['TE-SUC'] = { pos: V(bs.x, yS, TE_SUCCAO.z), tipo: 'te' };
  }
  function ancora(spec) {
    if (spec.includes('@')) {
      const [id, k] = spec.split('@');
      const l = linhaPor[id];
      const alvo = corr[l.spec.corredor].pontos[Number(k)];
      const i = l.cadeia.findIndex((q) => q.corr === l.spec.corredor && q.p[0] === alvo[0] && q.p[1] === alvo[1]);
      return { pos: l.corredor[i].clone(), tipo: 'te' };
    }
    const a = ancoras[spec];
    if (!a) throw new Error(`pipeways: destino desconhecido ${spec}`);
    return { ...a, pos: a.pos.clone(), dir: a.dir?.clone() };
  }
  /** Te: a linha chega pelo eixo horizontal de onde ela vem. */
  function dirDoTe(te, de) {
    const dx = de.x - te.x, dz = de.z - te.z;
    return Math.abs(dx) > Math.abs(dz) ? V(Math.sign(dx), 0, 0) : V(0, 0, Math.sign(dz) || 1);
  }

  /* ======================================================================
   *  4. Caminhos completos: corredor + chegada pelo roteador
   * =================================================================== */
  const caminhos = [];                            // { id, pts, dn, od, succao, linha, terminais }
  for (const l of linhas) {
    const L = l.spec;
    let pts = l.corredor.map((p) => p.clone());
    const terminais = [];
    if (L.ate) {
      const A = ancora(L.ate);
      if (A.tipo === 'te') A.dir = A.dir ?? V(0, 1, 0);
      A.sai = A.tipo === 'bocal' && !A.objeto?.startsWith?.('predio') ? 0.3 : 0;
      if (L.ate.startsWith('BT-') || L.ate.startsWith('TQ-AA')) A.sai = 0;
      const B = { pos: pts[pts.length - 1].clone(), dir: dirFinal(l), chega: 0 };
      const tp = tracar(A, B, L.passos ?? [], {});
      pts = [...pts, ...tp.reverse().slice(1)];
      l.chegada = tp;
      terminais.push(A.objeto);
    }
    if (L.de && L.de !== 'LB') {
      const A = ancora(L.de);
      A.sai = 0.3;
      const d0 = new THREE.Vector3().subVectors(pts[1], pts[0]).setY(0).normalize();
      const B = { pos: pts[0].clone(), dir: d0.negate(), chega: 0 };
      const tp = tracar(A, B, L.passosDe ?? [], {});
      pts = [...tp, ...pts.slice(1)];
      l.saida = tp;
      terminais.push(A.objeto);
    }
    l.pts = limpar(pts);
    caminhos.push({ id: l.id, pts: l.pts, dn: l.dn, od: l.od, linha: l.id, terminais, tipo: 'linha' });
  }
  const ramais = [];
  for (const R of RAMAIS_OSBL) {
    const A = ancora(R.de);
    A.sai = A.tipo === 'bocal' ? 0.3 : 0;
    if (R.de.startsWith('BAR-') || R.de.startsWith('BT-')) A.sai = 0;
    const B = ancora(R.para);
    if (B.tipo === 'te') { B.dir = dirDoTe(B.pos, A.pos); B.chega = 0; } else B.chega = 0.3;
    const pts = limpar(tracar(A, B, R.passos ?? [], {}));
    const r = { id: R.id, spec: R, pts, dn: R.dn, od: DN[R.dn].od, linha: R.linha, succao: !!R.succao, mat: matCodigo(R.fluido),
      terminais: [A.objeto, B.objeto], tipo: 'ramal' };
    ramais.push(r);
    caminhos.push(r);
  }

  /* ======================================================================
   *  5. Obstaculos para poste
   * =================================================================== */
  const obstaculos = [];                          // { nome, r, alto }: alto = so atrapalha poste alto
  for (const o of entorno.objetos) {
    if (/^bacia|^laje-descarga/.test(o.nome)) continue;
    const c = new THREE.Box3().setFromObject(o.grupo);
    obstaculos.push({ nome: o.nome, r: plano(c), alto: /^cobertura/.test(o.nome) });
  }
  // a mureta da bacia: quatro faixas finas, por dentro do retangulo
  const bloTq = BLOCOS.find((b) => b.id === BACIA.bloco);
  const rb = { x0: bloTq.x[0] + BACIA.recuo, x1: bloTq.x[1] - BACIA.recuo, z0: bloTq.z[0] + BACIA.recuo, z1: bloTq.z[1] - BACIA.recuo };
  const e = BACIA.largura;
  const muretas = [
    { x0: rb.x0, x1: rb.x1, z0: rb.z0, z1: rb.z0 + e }, { x0: rb.x0, x1: rb.x1, z0: rb.z1 - e, z1: rb.z1 },
    { x0: rb.x0, x1: rb.x0 + e, z0: rb.z0, z1: rb.z1 }, { x0: rb.x1 - e, x1: rb.x1, z0: rb.z0, z1: rb.z1 },
  ];
  for (const m of muretas) obstaculos.push({ nome: 'mureta da bacia', r: m });
  // calcada (Fase 13): o pe fica na faixa de servico, nunca na faixa livre;
  // onde o corredor cruza a calcada, a ponte vence as duas
  for (const c of CALCADAS) {
    for (let i = 1; i < c.pontos.length; i++) {
      const [ax, az] = c.pontos[i - 1], [bx, bz] = c.pontos[i];
      const m = LARGURA_CALCADA / 2;
      obstaculos.push({ nome: `calçada ${c.id}`, calcada: true,
        r: { x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m } });
    }
  }
  for (const o of objetos) obstaculos.push({ nome: o.nome, r: o.pegada });
  // tubo baixo e riser atrapalham poste
  for (const c of caminhos) {
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i];
      const vertical = Math.abs(a.y - b.y) > 0.5 && Math.hypot(a.x - b.x, a.z - b.z) < 1e-3;
      if (!vertical && Math.max(a.y, b.y) > 3) continue;
      const h = c.od / 2;
      obstaculos.push({ nome: `linha ${c.id}`, r: { x0: Math.min(a.x, b.x) - h, x1: Math.max(a.x, b.x) + h,
        z0: Math.min(a.z, b.z) - h, z1: Math.max(a.z, b.z) + h }, tubo: c });
    }
  }

  /* ======================================================================
   *  6. Postes, pontes e bandejas
   *  Poste de coluna unica no eixo do corredor; so e obrigatorio onde o
   *  corredor vira, ramifica ou termina — ponto colinear (onde uma linha
   *  para) nao pede poste. O resto vai a cada vao do rack, fora das vias
   *  (com folga) e dos obstaculos. Onde o corredor passa sobre via, ponte.
   * =================================================================== */
  const S2 = PIPEWAY.sapata / 2;
  const postes = [];
  const pontes = [];
  const estrutura = new THREE.Group();
  estrutura.name = 'estrutura-pipeways';
  grupo.add(estrutura);
  const porCorredor = {};
  const kv = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const vertices = new Map();                     // ponto -> { eixos, n, lb }
  for (const T of trechos.values()) {
    const eixo = Math.abs(T.b[0] - T.a[0]) > Math.abs(T.b[1] - T.a[1]) ? 'x' : 'z';
    for (const [p, lb] of [[T.a, T.inicioLB], [T.b, false]]) {
      const v = vertices.get(kv(p)) ?? { eixos: new Set(), n: 0, lb: false, portico: false };
      v.eixos.add(eixo); v.n++; v.lb ||= lb;
      // a primeira virada depois do limite de bateria fica sobre o ultimo
      // portico do rack (rotas.js, xPortico): ele apoia, nao ha poste
      if (p === T.b && T.inicioLB) v.portico = true;
      vertices.set(kv(p), v);
    }
  }
  const exigido = (p) => {
    const v = vertices.get(kv(p));
    return !v.lb && !v.portico && (v.n !== 2 || v.eixos.size > 1);
  };

  for (const T of trechos.values()) {
    const d = dirPlana(T.a, T.b);
    const r = direita(d);
    const L = Math.hypot(T.b[0] - T.a[0], T.b[1] - T.a[1]);
    const lo = Math.min(...T.linhas.map((l) => l.o - l.od / 2));
    const hi = Math.max(...T.linhas.map((l) => l.o + l.od / 2));
    const oc = (lo + hi) / 2;
    const w = Math.max(0.6, hi - lo + 0.4);
    const niveis = [...new Set(T.linhas.map((l) => +l.bop.toFixed(3)))].sort((p, q) => p - q);
    const topo = Math.max(...niveis);
    const P = (t, s = 0) => [T.a[0] + d[0] * t + r[0] * s, T.a[1] + d[1] * t + r[1] * s];
    /** Trecho de t em que o retangulo q (expandido) encosta na faixa lateral [l0, l1]. */
    const naFaixa = (q, folga, l0, l1) => {
      const qq = expandir(q, folga);
      const cantos = [[qq.x0, qq.z0], [qq.x1, qq.z0], [qq.x0, qq.z1], [qq.x1, qq.z1]];
      const ls = cantos.map(([x, z]) => (x - T.a[0]) * r[0] + (z - T.a[1]) * r[1]);
      const ts = cantos.map(([x, z]) => (x - T.a[0]) * d[0] + (z - T.a[1]) * d[1]);
      if (Math.max(...ls) <= l0 + 0.01 || Math.min(...ls) >= l1 - 0.01) return null;
      return [Math.min(...ts), Math.max(...ts)];
    };
    const proibido = [];
    const travessias = [];
    for (const v of vias) {
      const f = naFaixa(v, PIPEWAY.folgaVia + S2, -S2, S2);
      if (f) proibido.push(f);
      const c = naFaixa(v, 0, lo, hi);           // os tubos passam sobre a via
      if (c && c[1] > 0 && c[0] < L) travessias.push({ via: v.id, t: c });
    }
    for (const ob of obstaculos) {
      const f = naFaixa(ob.r, PIPEWAY.folgaObjeto + S2, -S2, S2);
      if (f) proibido.push(f);
    }
    const forb = fundir(proibido);
    const ajustar = (t, max = 1.5) => {
      const i = dentroDe(t, forb);
      if (!i) return t;
      const cand = [i[0], i[1]].filter((c) => c >= -1e-6 && c <= L + 1e-6 && Math.abs(c - t) <= max);
      return cand.length ? cand.sort((p, q) => Math.abs(p - t) - Math.abs(q - t))[0] : null;
    };

    const ts = [];
    for (const [t, p] of [[0, T.a], [L, T.b]]) {
      if (!exigido(p)) continue;
      const tt = ajustar(t);
      if (tt == null) achar('POSTE_NA_VIA', corr[T.corr].nome, `esquina (${f1(p[0])}; ${f1(p[1])}) cai em via ou obstáculo`);
      else ts.push({ t: tt, fixo: true });
    }
    const vaosPonte = [];
    for (const tv of travessias) {
      const iv = forb.find(([a, b]) => a <= tv.t[0] + 1e-6 && b >= tv.t[1] - 1e-6);
      if (!iv) continue;
      let [t0, t1] = [Math.max(0, iv[0]), Math.min(L, iv[1])];
      // sai do rack, ou da virada sobre o ultimo portico dele: o portico apoia
      if ((T.inicioLB || vertices.get(kv(T.a))?.portico) && t0 <= 1e-6) continue;
      // cabeceira junto de um poste obrigatorio: usa o proprio poste
      for (const p of ts) {
        if (p.t <= t0 && t0 - p.t < 1.5) t0 = p.t;
        if (p.t >= t1 && p.t - t1 < 1.5) t1 = p.t;
      }
      const ja = vaosPonte.find((vp) => Math.abs(vp.t0 - t0) < 0.3 && Math.abs(vp.t1 - t1) < 0.3);
      if (ja) { ja.vias.add(tv.via); continue; }
      ts.push({ t: t0, cabeceira: true }, { t: t1, cabeceira: true });
      vaosPonte.push({ t0, t1, vias: new Set([tv.via]) });
    }
    ts.sort((p, q) => p.t - q.t);
    const unicos = [];
    for (const p of ts) {
      const u = unicos[unicos.length - 1];
      if (u && Math.abs(u.t - p.t) < 0.3) { u.cabeceira ||= p.cabeceira; continue; }
      unicos.push({ ...p });
    }
    // Pontas sem poste (saida do rack, parada colinear) contam como apoio
    // para o vao: o rack de um lado, o trecho vizinho do outro.
    const base = [...unicos];
    if (!base.length || base[0].t > 1e-6) base.unshift({ t: 0, virtual: true });
    if (base[base.length - 1].t < L - 1e-6) base.push({ t: L, virtual: true });
    const ehPonte = (p, q) => vaosPonte.some((vp) => Math.abs(vp.t0 - p) < 0.3 && Math.abs(vp.t1 - q) < 0.3);
    const finais = [];
    for (let i = 0; i < base.length; i++) {
      finais.push(base[i]);
      if (i === base.length - 1) break;
      const p = base[i].t, q = base[i + 1].t;
      if (ehPonte(p, q) || q - p <= PIPEWAY.vaoMax + 1e-6) continue;
      const n = Math.ceil((q - p) / PIPEWAY.vaoMax);
      for (let k = 1; k < n; k++) {
        const t = ajustar(p + (k * (q - p)) / n, (q - p) / n / 2);
        if (t != null) finais.push({ t });
      }
    }
    finais.sort((p, q) => p.t - q.t);
    for (let i = 1; i < finais.length; i++) {
      const p = finais[i - 1].t, q = finais[i].t;
      if (ehPonte(p, q) || q - p <= PIPEWAY.vaoMax + 0.05) continue;
      achar('VAO_LIVRE', corr[T.corr].nome, `${f1(q - p)} m sem poste (máx. ${f1(PIPEWAY.vaoMax)}) perto de (${f1(P(p)[0])}; ${f1(P(p)[1])})`);
    }
    const ySup = topo + PIPEWAY.alturaTrelica;
    for (const p of finais) {
      if (p.virtual) continue;
      const [x, z] = P(p.t);
      postes.push({ x, z, bracos: [{ lateral: r, desloc: oc, largura: w }], niveis, topo, ySup,
        cabeceira: !!p.cabeceira, corr: T.corr });
    }
    for (const vp of vaosPonte) {
      const ponte = criarPontePipeway({ a: P(vp.t0, oc), b: P(vp.t1, oc), lateral: r, largura: w, niveis, ySup, painel: PIPEWAY.vaoPonte });
      const livre = ponte.userData.yInf - Y.via;
      const sobre = [...vp.vias].map((v) => v.replace('rampa-', 'rampa ')).join(' e ');
      ponte.userData.ficha = {
        titulo: 'Ponte de tubos', subtitulo: `${corr[T.corr].nome} — sobre ${sobre}`,
        grupos: [{ nome: 'Travessia (adotado)', dados: {
          'Vão': `${f1(vp.t1 - vp.t0)} m, ${ponte.userData.paineis} painéis`,
          'Altura livre': `${f2(livre)} m (mín. ${f1(PIPEWAY.alturaLivre)} m — IT 06 do CBPMESP)`,
          'Estrutura': 'Treliça Pratt nos dois lados, sobre pilares em martelo; travessa a cada painel',
        } }],
      };
      if (livre < PIPEWAY.alturaLivre) achar('TRAVESSIA_BAIXA', `Ponte sobre ${sobre}`, `altura livre ${f2(livre)} m`);
      if (vp.t1 - vp.t0 > 30) achar('PONTE_LONGA', `Ponte sobre ${sobre}`, `${f1(vp.t1 - vp.t0)} m`);
      pontes.push({ t0: vp.t0, t1: vp.t1, via: sobre, corr: T.corr, livre });
      (porCorredor[T.corr] ??= new THREE.Group()).add(ponte);
    }
    // bandeja das linhas pequenas, por nivel
    for (const bop of niveis) {
      const peq = T.linhas.filter((l) => l.pequena && Math.abs(l.bop - bop) < 1e-3);
      if (!peq.length) continue;
      const o0 = Math.min(...peq.map((l) => l.o)) - 0.08, o1 = Math.max(...peq.map((l) => l.o)) + 0.08;
      const ext = Math.max(...T.linhas.map((l) => Math.abs(l.o))) + 0.1;
      const t0 = T.inicioLB ? 0 : -ext, t1 = L + ext;
      (porCorredor[T.corr] ??= new THREE.Group()).add(
        criarBandeja(P(t0, (o0 + o1) / 2), P(t1, (o0 + o1) / 2), o1 - o0, bop),
      );
    }
  }

  // Postes de trechos que se encontram (esquina, ramificacao) viram um so.
  const unidos = [];
  for (const p of postes) {
    const u = unidos.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.5);
    if (!u) { unidos.push({ ...p, bracos: p.bracos.map((b) => ({ ...b })) }); continue; }
    const b = p.bracos[0];
    const igual = u.bracos.find((q) => Math.abs(q.lateral[0] * b.lateral[0] + q.lateral[1] * b.lateral[1]) > 0.99);
    if (!igual) u.bracos.push({ ...b });
    else {
      // mesmo eixo (segue reto, ou vira para o lado oposto): a travessa cobre os dois
      const s = igual.lateral[0] * b.lateral[0] + igual.lateral[1] * b.lateral[1];
      const lo = Math.min(igual.desloc - igual.largura / 2, s * b.desloc - b.largura / 2);
      const hi = Math.max(igual.desloc + igual.largura / 2, s * b.desloc + b.largura / 2);
      igual.desloc = (lo + hi) / 2; igual.largura = hi - lo;
    }
    u.cabeceira ||= p.cabeceira;
    u.niveis = [...new Set([...u.niveis, ...p.niveis])].sort((a, c) => a - c);
    u.topo = Math.max(u.topo, p.topo);
    u.ySup = Math.max(u.ySup, p.ySup);
  }
  for (const p of unidos) {
    const g = criarPostePipeway({
      x: p.x, z: p.z, bracos: p.bracos, niveis: p.niveis, topo: p.topo, sapataLado: PIPEWAY.sapata,
    });
    (porCorredor[p.corr] ??= new THREE.Group()).add(g);
    // poste na via: a sapata contra a via com folga
    const pe = { x0: p.x - S2, x1: p.x + S2, z0: p.z - S2, z1: p.z + S2 };
    const v = vias.find((q) => sobrepoe(pe, expandir(q, PIPEWAY.folgaVia - 0.01)));
    if (v) achar('POSTE_NA_VIA', corr[p.corr].nome, `coluna em (${f1(p.x)}; ${f1(p.z)}) a menos de ${f1(PIPEWAY.folgaVia)} m de ${v.id}`);
  }
  for (const [id, g] of Object.entries(porCorredor)) {
    g.name = `pipeway-${id}`;
    const c = corr[id];
    const comp = [...trechos.values()].filter((t) => t.corr === id)
      .reduce((s, t) => s + Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]), 0);
    const lin = [...new Set([...trechos.values()].filter((t) => t.corr === id).flatMap((t) => t.linhas.map((l) => l.id)))];
    const pts = pontes.filter((p) => p.corr === id);
    g.userData.ficha = {
      titulo: c.nome, subtitulo: 'Pipeway elevado — interligação fora dos limites de bateria',
      grupos: [{ nome: 'Geometria (sai do corredor e das vias)', dados: {
        'Comprimento': `${f1(comp)} m`,
        'Linhas': lin.join(', '),
        'Postes': String(unidos.filter((p) => p.corr === id).length),
        'Pontes sobre via': pts.length ? pts.map((p) => p.via).join(', ') : 'nenhuma',
        'Níveis': 'os do rack: 5,2 m (processo) e 7,0 m (utilidades)',
        'Vão máximo': `${f1(PIPEWAY.vaoMax)} m, como no rack`,
      } }],
    };
    estrutura.add(g);
  }

  /* ======================================================================
   *  7. Tubos, tes, luvas, etiquetas e apoio dos trechos soltos
   * =================================================================== */
  const tubos = new THREE.Group();
  tubos.name = 'linhas-osbl';
  grupo.add(tubos);
  // Ponto sobre a polilinha do corredor da linha (apoiado nos postes dele).
  const noCorredor = (l, p) => l.corredor.some((c0, i) => {
    const c1 = l.corredor[i + 1];
    return c1 && Math.abs(p.y - c0.y) < 1e-3
      && p.x >= Math.min(c0.x, c1.x) - 1e-3 && p.x <= Math.max(c0.x, c1.x) + 1e-3
      && p.z >= Math.min(c0.z, c1.z) - 1e-3 && p.z <= Math.max(c0.z, c1.z) + 1e-3;
  });
  const apoios = new THREE.Group();
  apoios.name = 'apoios-osbl';
  grupo.add(apoios);

  /** Pedacos de um trecho horizontal que ficam fora do corredor. */
  function foraDoCorredor(a, b, linha) {
    if (!linha) return [[a, b]];
    const n = Math.max(2, Math.ceil(a.distanceTo(b) / 0.25));
    const out = [];
    let ini = null;
    for (let k = 0; k <= n; k++) {
      const dentro = noCorredor(linha, a.clone().lerp(b, k / n));
      if (!dentro && ini == null) ini = Math.max(0, k - 1) / n;
      if (dentro && ini != null) { out.push([a.clone().lerp(b, ini), a.clone().lerp(b, k / n)]); ini = null; }
    }
    if (ini != null) out.push([a.clone().lerp(b, ini), b.clone()]);
    return out;
  }

  function apoiar(c, linha) {
    const vao = VAO_ADMISSIVEL[c.dn] ?? 3;
    const trechosSoltos = [];
    for (let i = 1; i < c.pts.length; i++) {
      if (Math.abs(c.pts[i - 1].y - c.pts[i].y) > 1e-3) continue;
      trechosSoltos.push(...foraDoCorredor(c.pts[i - 1], c.pts[i], linha));
    }
    for (const [a, b] of trechosSoltos) {
      const Lh = a.distanceTo(b);
      if (Lh <= vao + 1e-6) continue;
      const n = Math.ceil(Lh / vao);
      const eixo = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
      for (let k = 1; k < n; k++) {
        let p = a.clone().lerp(b, k / n);
        const pe = (q) => ({ x0: q.x - 0.25, x1: q.x + 0.25, z0: q.z - 0.25, z1: q.z + 0.25 });
        const bate = (q) => obstaculos.some((o) => o.tubo !== c && !o.alto && sobrepoe(pe(q), expandir(o.r, 0.05)))
          || vias.some((v) => sobrepoe(pe(q), v));
        if (bate(p)) {
          const passo = Lh / n / 2;
          const alt = [-1, 1].map((s) => a.clone().lerp(b, (k + (s * passo) / Lh * n * 0.9) / n)).find((q) => !bate(q));
          if (!alt) { achar('VAO_LIVRE', `Linha ${c.id}`, `trecho de ${f1(Lh)} m sem lugar para apoio (DN ${c.dn}, vão ${f1(vao)} m)`); continue; }
          p = alt;
        }
        apoios.add(criarPoste({ x: p.x, z: p.z, yApoio: p.y - c.od / 2, eixo }));
      }
    }
  }

  const travessiasDe = (pts, od) => {
    const out = new Set();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = Math.max(2, Math.ceil(a.distanceTo(b) / 0.5));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().lerp(b, k / n);
        for (const v of vias) {
          if (p.x > v.x0 && p.x < v.x1 && p.z > v.z0 && p.z < v.z1) {
            out.add(v.id);
            const livre = p.y - od / 2 - Y.via;
            if (livre < PIPEWAY.alturaLivre) achar('TRAVESSIA_BAIXA', `Linha sobre ${v.id}`, `${f2(livre)} m livres`);
          }
        }
      }
    }
    return [...out];
  };

  for (const c of caminhos) {
    const l = c.tipo === 'linha' ? linhaPor[c.id] : null;
    const mat = l ? l.mat : c.mat;
    const tubo = tuboPorCaminho(c.pts, { dn: c.dn, mat });
    const L = comprimento(c.pts);
    const cruza = travessiasDe(c.pts, c.od);
    if (l) {
      const destino = DESTINOS[c.id] ?? l.spec.ate;
      tubo.name = `osbl-${c.id}`;
      tubo.userData.linha = c.id;
      tubo.userData.ficha = {
        titulo: c.id === 'DT' ? 'Descarga de tolueno' : /^\d/.test(c.id) ? `Linha ${c.id}` : `Cabeçal ${c.id}`,
        subtitulo: l.spec.de === 'LB' ? `Limite de bateria → ${destino}` : 'Baia de descarga → TQ-01 e TQ-02',
        grupos: [{ nome: 'Interligação fora da laje (adotado)', dados: {
          'Fluido': `${l.fluido} — ${nomeCodigo(l.fluido)}`,
          'Diâmetro': `DN ${c.dn}`,
          'Comprimento': `${f1(L)} m`,
          'Pipeway': corr[l.spec.corredor].nome,
          'Nível': `${f1(l.bop)} m (fundo do tubo)`,
          'Travessias de via': cruza.length ? cruza.join(', ') : 'nenhuma',
          ...(l.spec.linha === 'DT' ? { 'Bomba': 'A do caminhão (tomada de força)' } : {}),
        } }],
      };
      // etiqueta no meio do trecho mais longo do corredor
      let k = 1, maior = 0;
      for (let i = 1; i < l.corredor.length; i++) {
        const dd = l.corredor[i].distanceTo(l.corredor[i - 1]);
        if (dd > maior) { maior = dd; k = i; }
      }
      const lbl = rotulo(c.id, 'linha-num');
      lbl.position.copy(l.corredor[k - 1]).lerp(l.corredor[k], 0.5).add(V(0, c.od + 0.25, 0));
      rotulos.add(lbl);
      apoiar(c, l);
      // rota contra o caminho minimo (Manhattan entre as pontas)
      const p0 = c.pts[0], p1 = c.pts[c.pts.length - 1];
      const M = Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y) + Math.abs(p0.z - p1.z);
      if (L > PIPEWAY.fatorRota * M + 2) achar('ROTA_LONGA', `Linha ${c.id}`, `${f1(L)} m contra ${f1(M)} m do caminho mínimo`);
      if (/^TORTA/.test(l.fluido)) {
        const ymin = Math.min(...c.pts.slice(1, -1).map((p) => p.y));
        if (ymin < Math.min(p0.y, p1.y) - 0.01) achar('PONTO_BAIXO', `Linha ${c.id}`, 'torta para num bolsão');
      }
    } else {
      tubo.name = `osbl-${c.id}`;
      tubo.userData.ficha = {
        titulo: c.spec.servico, subtitulo: `Ramal da linha ${c.linha}`,
        grupos: [{ nome: 'Interligação (adotado)', dados: {
          'Fluido': `${c.spec.fluido} — ${nomeCodigo(c.spec.fluido)}`, 'Diâmetro': `DN ${c.dn}`,
          'Comprimento': `${f1(L)} m`,
          ...(c.succao ? { 'Sucção': 'Afogada e reta, sem ponto alto' } : {}),
        } }],
      };
      apoiar(c, null);
      if (c.succao) {
        const yMax = Math.max(...c.pts.map((p) => p.y));
        if (yMax > Math.max(c.pts[0].y, c.pts[c.pts.length - 1].y) + 0.02) achar('SUCCAO_ALTA', c.spec.servico, 'ponto alto na sucção');
      }
    }
    tubos.add(tubo);
  }

  /* NPSH das bombas de fora (Fase 23): a BT-01 aspira dos TQ-01/02, as
   * BAR-01 da bacia da torre. Tanque e bacia nao tem nivel modelado: a
   * superficie fica na boca de succao — o nivel minimo [ADOTADO] —, a 1 bar
   * como os vasos atmosfericos do processo. A BT-01 vale pelo pior tanque:
   * o TQ-01 entra no te do coletor e segue pela succao do TQ-02. */
  const npsh = {};
  {
    const ramal = (id) => ramais.find((r) => r.id === id);
    // o resto de uma polilinha a partir do ponto P (o te)
    const cauda = (pts, P) => {
      let k = 0, dmin = Infinity;
      for (let i = 1; i < pts.length; i++) {
        const d = new THREE.Line3(pts[i - 1], pts[i]).closestPointToPoint(P, true, V()).distanceTo(P);
        if (d < dmin) { dmin = d; k = i; }
      }
      return [P.clone(), ...pts.slice(k)];
    };
    const cw = (id) => correnteDeUtilidade('CW', CABECAIS.find((c) => c.id === 'CWS').vazao, id);
    const casos = {
      'BT-01': [
        { tanque: 'TQ-02', partes: [{ r: ramal('SUC-TQ02') }] },
        { tanque: 'TQ-01', partes: [{ r: ramal('SUC-TQ01') }, { r: ramal('SUC-TQ02'), deTe: true }] },
      ],
      'BAR-01A': [{ tanque: 'torre', partes: [{ r: ramal('SUC-A') }] }],
      'BAR-01B': [{ tanque: 'torre', partes: [{ r: ramal('SUC-B') }] }],
    };
    for (const b of BOMBAS_OSBL) {
      const eixo = ancoras[`${b.tag}.S`];
      let pior = null;
      for (const caso of casos[b.tag] ?? []) {
        if (caso.partes.some((p) => !p.r)) continue;
        const te = caso.partes[0].r.pts.at(-1);
        const pedacos = caso.partes.map(({ r, deTe }) => {
          const pts = deTe ? cauda(r.pts, te) : r.pts;
          const S = r.linha === '30' ? 'S-30' : null;
          return pedacoDeSuccao({ S, c: S ? null : cw('CWS'), servico: 'succao', dn: r.dn, material: 'CS40', pts, rotulo: r.id });
        });
        const z = caso.partes[0].r.pts[0].y;
        const res = npshDaBomba({ tag: b.tag, tipo: 'bomba-centrifuga', geom: b.geom, origem: { tag: caso.tanque, bocal: 'S', z, P: 1 }, pedacos,
          zEixo: eixo.pos.y, torre: /^BAR-/.test(b.tag) });
        if (!pior || res.disponivel < pior.disponivel) pior = res;
      }
      if (pior) npsh[b.tag] = pior;
    }
  }

  // tes
  for (const nome of ['TE-CWS', 'TE-SUC', 'BRACO-1.T']) {
    const a = ancoras[nome];
    const od = nome === 'TE-CWS' ? DN[200].od : nome === 'TE-SUC' ? DN[40].od : DN[80].od;
    const te = new THREE.Mesh(new THREE.SphereGeometry(od * 0.75, 16, 12), MAT.acoCarbono);
    te.position.copy(a.pos);
    tubos.add(te);
  }
  {
    const te = new THREE.Mesh(new THREE.SphereGeometry(DN[80].od * 0.75, 16, 12), MAT.acoCarbono);
    te.position.copy(ancora('DT@1').pos);
    tubos.add(te);
  }
  // luva onde a succao atravessa a mureta da bacia
  for (const c of ramais.filter((r) => r.succao)) {
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i];
      for (const m of muretas) {
        const zc = (m.z0 + m.z1) / 2;
        if ((a.z - zc) * (b.z - zc) < 0 && a.x > m.x0 && a.x < m.x1) {
          const t = (zc - a.z) / (b.z - a.z);
          tubos.add(criarLuva(a.clone().lerp(b, t), new THREE.Vector3().subVectors(b, a), c.od));
        }
      }
    }
  }

  /* ======================================================================
   *  8. Drenagem fechada enterrada ate a ETE
   * =================================================================== */
  {
    const dr = DRENAGEM;
    const od = DN[dr.dn].od;
    let y = -dr.profundidade - od / 2;
    const pts = [];
    dr.pontos.forEach(([x, z], i) => {
      if (i > 0) y -= dr.caimento * Math.hypot(x - dr.pontos[i - 1][0], z - dr.pontos[i - 1][1]);
      pts.push(V(x, y, z));
    });
    const tubo = tuboPorCaminho(pts, { dn: dr.dn, mat: matCodigo('DR') });
    const L = comprimento(pts);
    tubo.name = 'drenagem-ete';
    tubo.userData.ficha = {
      titulo: 'Drenagem fechada', subtitulo: `Caixa coletora → ${dr.destino}`,
      grupos: [{ nome: 'Enterrada, por gravidade (adotado)', dados: {
        'Diâmetro (estimado)': `DN ${dr.dn} — chuva de ${CHUVA.intensidade} mm/h na laje ≈ ${Math.round(CHUVA.vazao)} m³/h (agua.js)`,
        'Comprimento': `${f1(L)} m`, 'Caimento': `${f1(dr.caimento * 100)} %`,
        'Desnível': `${f2(pts[0].y - pts[pts.length - 1].y)} m`,
        'Recebe': 'Caixa coletora da laje e o dreno da linha 07 (S-07)',
      } }],
    };
    grupo.add(tubo);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const cx = criarCaixaInspecao({ x: p.x, z: p.z, yTopo: Y.bloco, profundidade: Y.bloco - (p.y - od / 2) + 0.1 });
      cx.userData.ficha = { titulo: 'Caixa de inspeção', subtitulo: 'Drenagem fechada → ETE',
        grupos: [{ nome: 'Adotado', dados: { 'Profundidade': `${f2(Y.bloco - (p.y - od / 2))} m até a geratriz inferior` } }] };
      grupo.add(cx);
    }
    rotulosPlanta.add(linhaTracejada(dr.pontos, Y.linha + 0.01, 0x9c7a5b, { traco: 2, vao: 1.5 }));
  }

  /* ======================================================================
   *  9. Choques: tubo contra objeto do entorno e contra outro tubo
   * =================================================================== */
  const malhas = [];
  for (const o of entorno.objetos) {
    if (/^bacia|^laje-descarga/.test(o.nome)) continue;
    for (const b of caixasDasMalhas(o.grupo)) malhas.push({ nome: o.nome, b });
  }
  for (const o of objetos) for (const b of caixasDasMalhas(o.grupo)) malhas.push({ nome: o.nome, b });
  const amostras = (c, passo = 0.25) => {
    const out = [];
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i];
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / passo));
      for (let k = 0; k <= n; k++) out.push(a.clone().lerp(b, k / n));
    }
    const p0 = c.pts[0], p1 = c.pts[c.pts.length - 1];
    return out.filter((p) => p.distanceTo(p0) > 0.6 && p.distanceTo(p1) > 0.6);
  };
  for (const c of caminhos) {
    const vistos = new Set();
    for (const p of amostras(c)) {
      for (const m of malhas) {
        if (vistos.has(m.nome) || c.terminais.includes(m.nome)) continue;
        if (m.b.clone().expandByScalar(c.od / 2 - 0.01).containsPoint(p)) {
          vistos.add(m.nome);
          achar('TUBO_x_OBJETO', `${c.tipo === 'linha' ? 'Linha' : 'Ramal'} ${c.id}`, `atravessa ${m.nome} em (${f1(p.x)}; ${f1(p.y)}; ${f1(p.z)})`);
        }
      }
      // mureta: so a succao atravessa (com luva); o resto passa por cima
      if (!c.succao && p.y < Y.bloco + BACIA.altura + c.od / 2) {
        for (const m of muretas) {
          if (p.x > m.x0 - c.od / 2 && p.x < m.x1 + c.od / 2 && p.z > m.z0 - c.od / 2 && p.z < m.z1 + c.od / 2) {
            if (!vistos.has('mureta')) achar('TUBO_x_OBJETO', `Linha ${c.id}`, 'atravessa a mureta da bacia sem luva');
            vistos.add('mureta');
          }
        }
      }
    }
  }
  const pontosNos = Object.values(ancoras).filter((a) => a.tipo === 'te').map((a) => a.pos);
  pontosNos.push(ancora('DT@1').pos);
  const distSeg = (p, a, b) => {
    const ab = new THREE.Vector3().subVectors(b, a);
    const t = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(p, a).dot(ab) / Math.max(ab.lengthSq(), 1e-12), 0, 1);
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  };
  for (let i = 0; i < caminhos.length; i++) {
    for (let j = i + 1; j < caminhos.length; j++) {
      const A = caminhos[i], B = caminhos[j];
      let achou = false;
      for (const p of amostras(A, 0.2)) {
        if (achou) break;
        if (pontosNos.some((q) => q.distanceTo(p) < 0.6)) continue;
        for (let k = 1; k < B.pts.length && !achou; k++) {
          if (distSeg(p, B.pts[k - 1], B.pts[k]) < (A.od + B.od) / 2 + 0.01) {
            achou = true;
            achar('TUBO_x_TUBO', `${A.id} × ${B.id}`, `em (${f1(p.x)}; ${f1(p.y)}; ${f1(p.z)})`);
          }
        }
      }
    }
  }

  // Coluna contra tubo: nenhum tubo pode passar pela coluna abaixo do topo.
  const distSegPlano = (p, a, b) => distSeg(V(p[0], 0, p[1]), V(a.x, 0, a.z), V(b.x, 0, b.z));
  for (const p of unidos) {
    for (const c of caminhos) {
      for (let k = 1; k < c.pts.length; k++) {
        const a = c.pts[k - 1], b = c.pts[k];
        if (Math.min(a.y, b.y) - c.od / 2 > p.topo - 0.01) continue;
        if (Math.max(a.y, b.y) + c.od / 2 < Y.bloco + 0.2) continue;
        if (distSegPlano([p.x, p.z], a, b) < 0.1 + c.od / 2) {
          achar('POSTE_x_TUBO', `${c.tipo === 'linha' ? 'Linha' : 'Ramal'} ${c.id}`, `passa pela coluna em (${f1(p.x)}; ${f1(p.z)})`);
        }
      }
    }
  }

  const resumo = {
    linhas: linhas.length, ramais: ramais.length, postes: unidos.length, pontes: pontes.length,
    alturaLivreMin: pontes.length ? Math.min(...pontes.map((p) => p.livre)) : null,
    comprimento: caminhos.reduce((s, c) => s + comprimento(c.pts), 0),
  };
  // postes (coluna, topo e niveis): a iluminacao da Fase 26 prende luminaria
  // neles onde nao cabe poste por baixo do pipeway
  return { grupo, rotulos, rotulosPlanta, achados, objetos, resumo, caminhos, pontes, npsh,
    postes: unidos.map(({ x, z, topo, niveis, corr }) => ({ x, z, topo, niveis, corr })) };
}
