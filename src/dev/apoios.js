import * as THREE from 'three';

/**
 * ===========================================================================
 *  AUDITORIA DOS APOIOS DOS EQUIPAMENTOS  (Fase 25)
 * ===========================================================================
 *  Pedido do autor: "os apoios dos equipamentos no chao (se nao tem nada
 *  flutuando, desconexo...)" e "veja tambem se os apoios estao bem
 *  conectados aos equipamentos, nao so ao chao".
 *
 *  Em cada equipamento, um grafo de contato entre as malhas dele: duas
 *  malhas se tocam se algum ponto de uma (vertices e pontos a cada 2 cm
 *  sobre as arestas — a aresta que fura a outra passa rente a superficie
 *  dela) fica a ate TOL de um triangulo da outra. As raizes sao as malhas
 *  que descem ao piso (fundacao, sapata, plinto). A busca parte delas: o que
 *  nao for alcancado nao chega ao chao por nenhuma cadeia de contato —
 *  APOIO_SOLTO, com a folga ate a malha alcancada mais perto. Caixa nao
 *  serve: a perna a 5 cm do costado cabe na caixa do vaso.
 *
 *  Abre com ?semfusao (a fusao junta pecas de unidades diferentes) ou sem —
 *  o grupo de cada equipamento guarda as malhas dele dos dois jeitos.
 *  As bombas (BC, BD, BV, BT, BAR) ficam com a auditoria de contato da
 *  sessao na nuvem (lib/bomba.js e dela).
 */
const TOL = 0.015;            // m: o que e "encostar"
const PASSO = 0.02;           // m: pontos sobre as arestas
const PISO = 0.12;            // m: malha cuja base fica abaixo disto desce ao piso (plinto = 0,10)

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3();
const tri = new THREE.Triangle();

/** Triangulos de uma malha no mundo, numa grade de celulas de `cel` m. */
function triangulos(o, cel = 0.5) {
  const g = o.geometry, pos = g.attributes.position, idx = g.index;
  const n = idx ? idx.count / 3 : pos.count / 3;
  const ts = [];
  for (let i = 0; i < n; i++) {
    const k = (j) => (idx ? idx.getX(3 * i + j) : 3 * i + j);
    const a = new THREE.Vector3().fromBufferAttribute(pos, k(0)).applyMatrix4(o.matrixWorld);
    const b = new THREE.Vector3().fromBufferAttribute(pos, k(1)).applyMatrix4(o.matrixWorld);
    const c = new THREE.Vector3().fromBufferAttribute(pos, k(2)).applyMatrix4(o.matrixWorld);
    ts.push({ a, b, c, box: new THREE.Box3().setFromPoints([a, b, c]).expandByScalar(TOL) });
  }
  const grade = new Map();
  const chave = (x, y, z) => `${x},${y},${z}`;
  ts.forEach((t, i) => {
    const m = t.box.min, M = t.box.max;
    for (let x = Math.floor(m.x / cel); x <= Math.floor(M.x / cel); x++)
      for (let y = Math.floor(m.y / cel); y <= Math.floor(M.y / cel); y++)
        for (let z = Math.floor(m.z / cel); z <= Math.floor(M.z / cel); z++) {
          const c = chave(x, y, z);
          if (!grade.has(c)) grade.set(c, []);
          grade.get(c).push(i);
        }
  });
  return { ts, grade, cel, chave };
}

/** Pontos de prova de uma malha: vertices e pontos a cada PASSO nas arestas. */
function pontos(o) {
  const g = o.geometry, pos = g.attributes.position, idx = g.index;
  const n = idx ? idx.count / 3 : pos.count / 3;
  const ps = [], vistas = new Set();
  const v = (k) => new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
  for (let i = 0; i < n; i++) {
    const ks = [0, 1, 2].map((j) => (idx ? idx.getX(3 * i + j) : 3 * i + j));
    for (let j = 0; j < 3; j++) {
      const k0 = ks[j], k1 = ks[(j + 1) % 3];
      const ch = k0 < k1 ? `${k0}-${k1}` : `${k1}-${k0}`;
      if (vistas.has(ch)) continue;
      vistas.add(ch);
      const a = v(k0), b = v(k1), L = a.distanceTo(b), m = Math.max(1, Math.ceil(L / PASSO));
      for (let s = 0; s <= m; s++) ps.push(a.clone().lerp(b, s / m));
    }
  }
  return ps;
}

/** Menor distancia de algum ponto de `ps` (dentro de `caixa`) a um triangulo de `T`. */
function folga(ps, T, caixa, ate = Infinity) {
  let min = ate;
  for (const p of ps) {
    if (!caixa.containsPoint(p)) continue;
    const lista = T.grade.get(T.chave(Math.floor(p.x / T.cel), Math.floor(p.y / T.cel), Math.floor(p.z / T.cel)));
    if (!lista) continue;
    for (const i of lista) {
      const t = T.ts[i];
      if (!t.box.containsPoint(p)) continue;
      tri.set(t.a, t.b, t.c);
      const d = tri.closestPointToPoint(p, _p).distanceTo(p);
      if (d < min) { min = d; if (min <= TOL) return min; }
    }
  }
  return min;
}

export function auditarApoios(todos, { excluir = /^(BC|BD|BV|BT|BAR)-/ } = {}) {
  const achados = [], resumo = {};
  const t0 = performance.now();
  for (const [tag, e] of Object.entries(todos)) {
    if (excluir.test(tag)) continue;
    e.grupo.updateWorldMatrix(true, true);
    const ms = [];
    e.grupo.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes.position) return;
      for (let p = o; p; p = p.parent) if (p.visible === false) return;
      // o que esta dentro do vaso (liquido, internos) nao apoia nem e apoiado
      if (/liquido|internos/.test(`${o.name} ${o.parent?.name} ${o.material?.name}`)) return;
      const box = new THREE.Box3().setFromObject(o);
      ms.push({ o, box, nome: `${o.name || o.parent?.name || '?'} [${o.material?.name || o.geometry.type}]` });
    });
    const n = ms.length;
    const T = ms.map((m) => triangulos(m.o));
    const P = ms.map((m) => pontos(m.o));
    const viz = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const bi = ms[i].box.clone().expandByScalar(TOL), bj = ms[j].box.clone().expandByScalar(TOL);
      if (!bi.intersectsBox(bj)) continue;
      const comum = bi.clone().intersect(bj);
      if (folga(P[i], T[j], comum) <= TOL || folga(P[j], T[i], comum) <= TOL) { viz[i].push(j); viz[j].push(i); }
    }
    const raiz = ms.map((m, i) => i).filter((i) => ms[i].box.min.y <= PISO);
    const visto = new Set(raiz), fila = [...raiz];
    while (fila.length) { const i = fila.pop(); for (const j of viz[i]) if (!visto.has(j)) { visto.add(j); fila.push(j); } }
    const soltos = ms.map((m, i) => i).filter((i) => !visto.has(i));
    for (const i of soltos) {
      // folga ate a malha ja alcancada mais perto (so entre caixas proximas)
      let min = Infinity, quem = null;
      for (const j of visto) {
        if (ms[i].box.distanceToPoint(ms[j].box.getCenter(_c)) > 3 && !ms[i].box.clone().expandByScalar(0.5).intersectsBox(ms[j].box)) continue;
        const comum = ms[i].box.clone().expandByScalar(0.5).intersect(ms[j].box.clone().expandByScalar(0.5));
        const d = Math.min(folga(P[i], T[j], comum, min), folga(P[j], T[i], comum, min));
        if (d < min) { min = d; quem = ms[j].nome; }
      }
      const c = ms[i].box.getCenter(_c);
      achados.push({ regra: 'APOIO_SOLTO', tag, peca: ms[i].nome, folga: Number.isFinite(min) ? +(min * 100).toFixed(1) : null, perto: quem,
        onde: [c.x, c.y, c.z].map((v) => +v.toFixed(2)) });
    }
    resumo[tag] = { malhas: n, raizes: raiz.length, soltas: soltos.length };
  }
  return { total: achados.length, achados, resumo, ms: Math.round(performance.now() - t0), tol: `${TOL * 100} cm` };
}
