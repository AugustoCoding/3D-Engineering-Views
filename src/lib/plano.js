/**
 * ===========================================================================
 *  GEOMETRIA NO PLANO DO CHAO  (x, z)
 * ===========================================================================
 *  Contas da implantacao: distancia entre blocos, entre bloco e via, e o par
 *  de pontos que realiza essa distancia. Ficam aqui, e nao duplicadas, porque
 *  quem MEDE (src/dev/implantacao.js) e quem DESENHA a cota (src/site/) tem de
 *  chegar ao mesmo numero — calculo duplicado diverge.
 *
 *  Retangulo alinhado aos eixos: { x0, x1, z0, z1 }. Ponto: [x, z].
 *  Sem three.js, para rodar no Node.
 */

/** Bloco de src/data/site.js ({ x: [a, b], z: [c, d] }) para retangulo. */
export const ret = (b) => ({ x0: b.x[0], x1: b.x[1], z0: b.z[0], z1: b.z[1] });

export const centro = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

/** Distancia de borda a borda entre dois retangulos (0 se encostam ou cruzam). */
export function distRetRet(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

/**
 * Par de pontos, um em cada retangulo, cuja distancia e `distRetRet`. Num eixo
 * em que os dois se sobrepoem, os dois pontos ficam no meio da sobreposicao,
 * e a cota sai perpendicular as bordas — como se cota em planta.
 */
export function pontosMaisProximos(a, b) {
  const eixo = (a0, a1, b0, b1) => {
    if (a1 <= b0) return [a1, b0];
    if (b1 <= a0) return [a0, b1];
    const m = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
    return [m, m];
  };
  const [px, qx] = eixo(a.x0, a.x1, b.x0, b.x1);
  const [pz, qz] = eixo(a.z0, a.z1, b.z0, b.z1);
  return [[px, pz], [qx, qz]];
}

/** Folga do retangulo ate o limite do lote (por dentro), e de qual lado. */
export function folgaLimite(r, lote) {
  const [cx, cz] = centro(r);
  const lados = [
    { lado: 'oeste', d: r.x0 - lote.x0, de: [r.x0, cz], ate: [lote.x0, cz] },
    { lado: 'leste', d: lote.x1 - r.x1, de: [r.x1, cz], ate: [lote.x1, cz] },
    { lado: 'norte', d: r.z0 - lote.z0, de: [cx, r.z0], ate: [cx, lote.z0] },
    { lado: 'sul', d: lote.z1 - r.z1, de: [cx, r.z1], ate: [cx, lote.z1] },
  ];
  return lados.sort((a, b) => a.d - b.d)[0];
}

export function distPontoRet([x, z], r) {
  const dx = Math.max(0, r.x0 - x, x - r.x1);
  const dz = Math.max(0, r.z0 - z, z - r.z1);
  return Math.hypot(dx, dz);
}

export function distPontoSeg([x, z], [ax, az], [bx, bz]) {
  const vx = bx - ax, vz = bz - az;
  const L2 = vx * vx + vz * vz;
  const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
  return Math.hypot(x - (ax + t * vx), z - (az + t * vz));
}

/** Cruzamento proprio de dois segmentos (encostar a ponta nao conta). */
export function segCruzaSeg(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Segmento entra no interior do retangulo, recuado de `folga` (tocar nao conta). */
export function segEntraRet(p, q, r, folga = 0) {
  const e = { x0: r.x0 + folga, x1: r.x1 - folga, z0: r.z0 + folga, z1: r.z1 - folga };
  if (e.x0 >= e.x1 || e.z0 >= e.z1) return false;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
    if (x > e.x0 && x < e.x1 && z > e.z0 && z < e.z1) return true;
  }
  return false;
}

export function distRetSeg(r, p, q) {
  if (segEntraRet(p, q, r)) return 0;
  const cantos = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
  return Math.min(
    distPontoRet(p, r), distPontoRet(q, r),
    ...cantos.map((c) => distPontoSeg(c, p, q)),
  );
}

/** Polilinha em pares de pontos consecutivos. */
export const segmentos = (pts) => pts.slice(1).map((q, i) => [pts[i], q]);

/** Distancia do bloco a BORDA da via (eixo menos meia largura). */
export function distRetVia(r, via) {
  const d = Math.min(...segmentos(via.pontos).map(([p, q]) => distRetSeg(r, p, q)));
  return Math.max(0, d - via.largura / 2);
}

/** Direcao unitaria de a para b, em planta. */
export function dirPlana(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  return [dx / L, dz / L];
}

/** Lado direito de quem anda em `d` (x leste, z sul). */
export const direita = ([dx, dz]) => [-dz, dx];

/**
 * Polilinha deslocada `o` para a direita, com esquina em meia-esquadria (so
 * curva de 90°, que e o que vias, corredores e calcadas tem). E a faixa de
 * cada linha num pipeway (Fase 7) e a mao de direcao no trafego (Fase 9).
 */
export function deslocar(pts, o) {
  return pts.map((p, i) => {
    const rin = i > 0 ? direita(dirPlana(pts[i - 1], p)) : null;
    const rout = i < pts.length - 1 ? direita(dirPlana(p, pts[i + 1])) : null;
    let r;
    if (rin && rout && Math.abs(rin[0] * rout[0] + rin[1] * rout[1]) < 0.5) r = [rin[0] + rout[0], rin[1] + rout[1]];
    else r = rout ?? rin;
    return [p[0] + o * r[0], p[1] + o * r[1]];
  });
}

/**
 * Troca cada vertice da polilinha por um arco tangente de raio `raio` — ou
 * menor, quando os trechos vizinhos nao comportam a tangente (cada vertice
 * usa ate metade do trecho; a ponta, o trecho inteiro). E o caminho de um
 * veiculo que esterca em vez de girar no lugar (Fase 19). Vertice quase
 * reto fica como esta; as pontas nao mudam.
 */
export function suavizar(pts, raio, passo = 6) {
  if (pts.length < 3 || !(raio > 0)) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p = pts[i], p1 = pts[i + 1];
    const L0 = Math.hypot(p[0] - p0[0], p[1] - p0[1]), L1 = Math.hypot(p1[0] - p[0], p1[1] - p[1]);
    if (L0 < 1e-6 || L1 < 1e-6) continue;
    const d0 = [(p[0] - p0[0]) / L0, (p[1] - p0[1]) / L0], d1 = [(p1[0] - p[0]) / L1, (p1[1] - p[1]) / L1];
    const ang = Math.acos(Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1])));
    if (ang < 0.01 || ang > Math.PI - 0.01) { out.push(p); continue; }
    const tMax = Math.min(i === 1 ? L0 : L0 / 2, i === pts.length - 2 ? L1 : L1 / 2);
    let r = raio, t = r * Math.tan(ang / 2);
    if (t > tMax) { t = tMax; r = t / Math.tan(ang / 2); }
    const A = [p[0] - d0[0] * t, p[1] - d0[1] * t];
    const s = Math.sign(d0[0] * d1[1] - d0[1] * d1[0]);
    const c = [A[0] - d0[1] * s * r, A[1] + d0[0] * s * r];
    const a0 = Math.atan2(A[1] - c[1], A[0] - c[0]);
    const n = Math.max(2, Math.ceil((ang * 180) / Math.PI / passo));
    for (let j = 0; j <= n; j++) {
      const a = a0 + (s * ang * j) / n;
      out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
  }
  out.push(pts.at(-1));
  return out;
}

/** Ponto do segmento a-b mais perto de p, e o parametro dele. */
export function projetarNoSeg([x, z], [ax, az], [bx, bz]) {
  const vx = bx - ax, vz = bz - az;
  const L2 = vx * vx + vz * vz;
  const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
  return { p: [ax + t * vx, az + t * vz], t };
}

/**
 * Rede de polilinhas (as calcadas): no em cada vertice e em cada cruzamento,
 * aresta ao longo delas. `conectores` sao retangulos que ligam entre si os
 * nos a ate 1 m deles, pela distancia de Manhattan — a laje de processo, onde
 * se anda pelos corredores. Devolve os componentes e o caminho mais curto
 * entre dois pontos quaisquer (entrando na rede pelo ponto mais perto dela).
 */
export function redeDePolilinhas(polilinhas, { conectores = [], tol = 0.05 } = {}) {
  const segs = [];
  for (const pl of polilinhas) for (const [a, b] of segmentos(pl.pontos)) segs.push({ id: pl.id, a, b, ts: [0, 1] });
  // cortes: cruzamento e ponta de um segmento sobre outro
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], o = segs[j];
      const r = [s.b[0] - s.a[0], s.b[1] - s.a[1]], q = [o.b[0] - o.a[0], o.b[1] - o.a[1]];
      const den = r[0] * q[1] - r[1] * q[0];
      if (Math.abs(den) < 1e-9) continue;          // paralelos: so se tocam pela ponta, que ja e no
      const w = [o.a[0] - s.a[0], o.a[1] - s.a[1]];
      const t = (w[0] * q[1] - w[1] * q[0]) / den, u = (w[0] * r[1] - w[1] * r[0]) / den;
      const es = tol / Math.hypot(...r), eo = tol / Math.hypot(...q);
      if (t < -es || t > 1 + es || u < -eo || u > 1 + eo) continue;
      s.ts.push(Math.max(0, Math.min(1, t)));
      o.ts.push(Math.max(0, Math.min(1, u)));
    }
  }
  const nos = [];                                   // { p, viz: [[k, d]] }
  const no = (p) => {
    let k = nos.findIndex((n) => Math.hypot(n.p[0] - p[0], n.p[1] - p[1]) <= tol);
    if (k < 0) { k = nos.length; nos.push({ p, viz: [] }); }
    return k;
  };
  const arestas = [];                               // { i, j, a, b, id }
  const ligar = (i, j, d) => { nos[i].viz.push([j, d]); nos[j].viz.push([i, d]); };
  for (const s of segs) {
    const ts = [...new Set(s.ts.map((t) => +t.toFixed(6)))].sort((p, q) => p - q);
    const pts = ts.map((t) => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]);
    const ks = pts.map(no);
    for (let k = 1; k < ks.length; k++) {
      if (ks[k] === ks[k - 1]) continue;
      const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      ligar(ks[k - 1], ks[k], d);
      arestas.push({ i: ks[k - 1], j: ks[k], a: pts[k - 1], b: pts[k], id: s.id });
    }
  }
  for (const c of conectores) {
    const perto = nos.map((n, k) => [n, k]).filter(([n]) => distPontoRet(n.p, c) <= 1);
    for (let a = 0; a < perto.length; a++) {
      for (let b = a + 1; b < perto.length; b++) {
        const [na, ka] = perto[a], [nb, kb] = perto[b];
        ligar(ka, kb, Math.abs(na.p[0] - nb.p[0]) + Math.abs(na.p[1] - nb.p[1]));
      }
    }
  }

  /** Componentes conexos: listas de ids de polilinha. */
  function componentes() {
    const comp = new Array(nos.length).fill(-1);
    let n = 0;
    for (let k = 0; k < nos.length; k++) {
      if (comp[k] >= 0) continue;
      const pilha = [k];
      comp[k] = n;
      while (pilha.length) {
        for (const [j] of nos[pilha.pop()].viz) if (comp[j] < 0) { comp[j] = n; pilha.push(j); }
      }
      n++;
    }
    const ids = Array.from({ length: n }, () => new Set());
    for (const a of arestas) ids[comp[a.i]].add(a.id);
    return ids.map((s) => [...s]).filter((l) => l.length);
  }

  /** Onde o ponto entra na rede: a aresta mais perto e o pe da perpendicular. */
  function entrar(p) {
    let melhor = null;
    for (const a of arestas) {
      const { p: q } = projetarNoSeg(p, a.a, a.b);
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (!melhor || d < melhor.d) melhor = { d, q, a };
    }
    return melhor;
  }

  /** Caminho pela rede de p a q, entrando e saindo pela perpendicular:
   *  comprimento e, desde a Fase 20, os pontos (quem anda por ele). */
  function caminho(p, q) {
    const A = entrar(p), B = entrar(q);
    const dist = new Array(nos.length).fill(Infinity);
    const prev = new Array(nos.length).fill(-1);
    const parcial = (E, k) => Math.hypot(E.q[0] - nos[k].p[0], E.q[1] - nos[k].p[1]);
    dist[A.a.i] = parcial(A, A.a.i);
    dist[A.a.j] = parcial(A, A.a.j);
    const feito = new Set();
    for (;;) {
      let k = -1;
      for (let i = 0; i < nos.length; i++) if (!feito.has(i) && dist[i] < Infinity && (k < 0 || dist[i] < dist[k])) k = i;
      if (k < 0) break;
      feito.add(k);
      for (const [j, d] of nos[k].viz) if (dist[k] + d < dist[j]) { dist[j] = dist[k] + d; prev[j] = k; }
    }
    const fins = [B.a.i, B.a.j].map((k) => [k, dist[k] + parcial(B, k)]).sort((u, v) => u[1] - v[1]);
    let rede = fins[0][1];
    const meio = [];
    for (let k = fins[0][0]; k >= 0; k = prev[k]) meio.unshift(nos[k].p);
    let pontos = [p, A.q, ...meio, B.q, q];
    if (A.a === B.a && Math.hypot(A.q[0] - B.q[0], A.q[1] - B.q[1]) <= rede) {
      rede = Math.hypot(A.q[0] - B.q[0], A.q[1] - B.q[1]);
      pontos = [p, A.q, B.q, q];
    }
    return { total: A.d + rede + B.d, entrada: A.q, saida: B.q, pontos };
  }

  return { nos, arestas, componentes, entrar, caminho };
}

/**
 * Arco de circunferencia em planta, de a0 a a1 graus (0° = leste, 90° = sul,
 * no referencial da maquete), em passos de ate `passo` graus, pontas
 * incluidas. Curva de via e de calcada sai daqui, nunca digitada ponto a ponto.
 */
export function arco(cx, cz, r, a0, a1, passo = 6) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / passo));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [+(cx + r * Math.cos(a)).toFixed(3), +(cz + r * Math.sin(a)).toFixed(3)];
  });
}

/**
 * Esquinas da rede viaria: o canto concavo entre a ponta de uma via e a
 * lateral de outra (T) e o canto de dentro de uma via que vira 90°. O canto
 * que ja tem outra pista dentro (a ilha entre duas pistas) nao e esquina.
 * Raio pelo menor veiculo que faz a curva — `esquina` em VEICULOS — ou pela
 * excecao de ESQUINAS (com motivo). A mesma conta serve a auditoria (cabe?
 * invade bloco?) e ao desenho do chao (Fase 14).
 *
 *   c        canto, onde as bordas das duas vias se cruzam
 *   u1, u2   direcoes ao longo das duas bordas, saindo do canto
 *   r        raio do meio-fio; o centro do arco e c + r(u1 + u2)
 *   regiao   pontos (0,5 m) da pista que o arredondamento acrescenta
 *   juncao   (canto de curva) outra via nasce nesse vertice: ele nao vira
 *            curva — so ganha o arredondamento de dentro, como uma esquina
 *            em T; a curva cortaria o pe da via que nasce ali
 *
 *  A esquina em T so conta o trecho RETO da outra via: se ela vira curva
 *  logo adiante, o arredondamento encostaria numa borda que ja nao esta la.
 */
export function esquinasDasVias(VIAS, { VEICULOS, ESQUINAS = [] }) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const veic = (v) => VEICULOS[v.veiculo ?? 'caminhao'];
  const raio = (A, B, c) => {
    const ex = ESQUINAS.find((e) => Math.hypot(e.em[0] - c[0], e.em[1] - c[1]) < 0.5);
    return ex ? ex.r : Math.min(veic(A).esquina, veic(B).esquina);
  };
  const retas = VIAS.filter((v) => !v.circulo);
  const perp = (a, b) => Math.abs(dot(a, b)) < 0.1;
  const pontas = retas.flatMap((v) => [{ v, p: v.pontos[0] }, { v, p: v.pontos[v.pontos.length - 1] }]);
  // vertice de 90° de cada via: vira curva, a nao ser que outra via nasca nele
  const curvas = new Map();                         // `${id}:${x},${z}` -> { R, juncao }
  const kv = (v, p) => `${v.id}:${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  for (const A of retas) {
    const n = A.pontos.length;
    const fechada = Math.hypot(A.pontos[0][0] - A.pontos[n - 1][0], A.pontos[0][1] - A.pontos[n - 1][1]) < 1e-6;
    for (let i = fechada ? 0 : 1; i < n - 1; i++) {
      const p = A.pontos[i];
      const ant = A.pontos[i > 0 ? i - 1 : n - 2], prox = A.pontos[i + 1];
      if (!perp(dirPlana(ant, p), dirPlana(p, prox))) continue;
      const juncao = pontas.some((e) => e.v !== A && Math.hypot(e.p[0] - p[0], e.p[1] - p[1]) < A.largura / 2 + 0.5);
      curvas.set(kv(A, p), { R: veic(A).esquina + A.largura / 2, juncao });
    }
  }
  // quanto da via B e reta a partir do pe, no sentido do segmento [p, q]
  const reto = (B, p, q, pe, s) => {
    const fim = s > 0 ? q : p;
    const disp = Math.hypot(fim[0] - pe[0], fim[1] - pe[1]);
    const cv = curvas.get(kv(B, fim));
    return cv && !cv.juncao ? disp - cv.R : disp;
  };
  const cantos = [];
  for (const A of retas) {
    const n = A.pontos.length;
    for (const [ponta, viz] of [[A.pontos[0], A.pontos[1]], [A.pontos[n - 1], A.pontos[n - 2]]]) {
      const dA = dirPlana(ponta, viz);
      const compA = Math.hypot(viz[0] - ponta[0], viz[1] - ponta[1]);
      for (const B of retas) {
        if (B === A) continue;
        for (const [p, q] of segmentos(B.pontos)) {
          const { p: pe } = projetarNoSeg(ponta, p, q);
          if (Math.hypot(pe[0] - ponta[0], pe[1] - ponta[1]) > B.largura / 2 + 0.01) continue;
          const dB = dirPlana(p, q);
          if (!perp(dA, dB)) continue;
          for (const s of [1, -1]) {
            const disp = s > 0 ? Math.hypot(q[0] - pe[0], q[1] - pe[1]) : Math.hypot(pe[0] - p[0], pe[1] - p[1]);
            if (disp < 0.01) continue;
            const u = [s * dB[0], s * dB[1]];
            const c = [pe[0] + dA[0] * (B.largura / 2) + u[0] * (A.largura / 2), pe[1] + dA[1] * (B.largura / 2) + u[1] * (A.largura / 2)];
            cantos.push({
              nome: `${A.id} × ${B.id}`, tipo: 'T', vias: [A, B], r: raio(A, B, c), c,
              u1: dA, u2: u, livre1: compA - B.largura / 2, livre2: reto(B, p, q, pe, s) - A.largura / 2,
            });
          }
        }
      }
    }
    // canto de dentro onde a propria via vira 90° (o anel e fechado)
    const fechada = Math.hypot(A.pontos[0][0] - A.pontos[n - 1][0], A.pontos[0][1] - A.pontos[n - 1][1]) < 1e-6;
    for (let i = fechada ? 0 : 1; i < n - 1; i++) {
      const p = A.pontos[i];
      const ant = A.pontos[i > 0 ? i - 1 : n - 2], prox = A.pontos[i + 1];
      const d1 = dirPlana(ant, p), d2 = dirPlana(p, prox);
      if (!perp(d1, d2)) continue;
      const h = A.largura / 2;
      cantos.push({
        nome: `${A.id} (curva)`, tipo: 'curva', vias: [A], r: veic(A).esquina, vertice: p,
        juncao: curvas.get(kv(A, p))?.juncao ?? false,
        c: [p[0] - d1[0] * h + d2[0] * h, p[1] - d1[1] * h + d2[1] * h],
        u1: [-d1[0], -d1[1]], u2: d2,
        livre1: Math.hypot(p[0] - ant[0], p[1] - ant[1]) - h, livre2: Math.hypot(prox[0] - p[0], prox[1] - p[1]) - h,
      });
    }
  }
  const vistos = new Set();
  const naFaixa = (pt, v) => segmentos(v.pontos).some(([a, b]) => distPontoSeg(pt, a, b) < v.largura / 2 - 0.01);
  const out = [];
  for (const k of cantos) {
    const chave = `${k.c[0].toFixed(1)},${k.c[1].toFixed(1)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    // a pista que o arredondamento acrescenta: o quadrado r x r no canto,
    // fora do circulo de raio r
    const o = [k.c[0] + k.r * (k.u1[0] + k.u2[0]), k.c[1] + k.r * (k.u1[1] + k.u2[1])];
    const regiao = [];
    for (let i = 0.25; i < k.r; i += 0.5) {
      for (let j = 0.25; j < k.r; j += 0.5) {
        const pt = [k.c[0] + k.u1[0] * i + k.u2[0] * j, k.c[1] + k.u1[1] * i + k.u2[1] * j];
        if (Math.hypot(pt[0] - o[0], pt[1] - o[1]) > k.r) regiao.push(pt);
      }
    }
    if (VIAS.some((v) => !k.vias.includes(v) && regiao.some((pt) => naFaixa(pt, v)))) continue;
    out.push({ ...k, vias: k.vias.map((v) => v.id), centro: o, regiao });
  }
  return out;
}

/**
 * Arco concentrico ao de uma esquina, de raio `rho`: de o - rho u2 a
 * o - rho u1 (o = centro do arredondamento). E o eixo da calcada que contorna
 * a esquina (rho = r - afastamento) e o eixo da via que faz a curva
 * (rho = r + meia largura).
 */
export function arcoEsquina({ centro: o, u1, u2 }, rho, passo = 6) {
  const a0 = (Math.atan2(-u2[1], -u2[0]) * 180) / Math.PI;
  let a1 = (Math.atan2(-u1[1], -u1[0]) * 180) / Math.PI;
  while (a1 - a0 > 180) a1 -= 360;
  while (a1 - a0 < -180) a1 += 360;
  return arco(o[0], o[1], rho, a0, a1, passo);
}

/**
 * Polilinha que passa pelo canto `c + af (u1 + u2)` de uma esquina (a calcada
 * encostada nas duas vias) troca o canto vivo pelo arco que contorna o
 * arredondamento. Vale para vertice do meio e para ponta.
 */
export function contornarEsquinas(pontos, esquinas, af) {
  const out = [];
  pontos.forEach((p, i) => {
    const k = esquinas.find((e) => e.tipo === 'T'
      && Math.hypot(p[0] - (e.c[0] + af * (e.u1[0] + e.u2[0])), p[1] - (e.c[1] + af * (e.u1[1] + e.u2[1]))) < 0.3);
    if (!k) { out.push(p); return; }
    let arcoPts = arcoEsquina(k, k.r - af);
    // no sentido da polilinha: comeca pelo lado do ponto anterior
    const ant = out.length ? out[out.length - 1] : (pontos[i + 1] ?? p);
    const d0 = Math.hypot(arcoPts[0][0] - ant[0], arcoPts[0][1] - ant[1]);
    const d1 = Math.hypot(arcoPts.at(-1)[0] - ant[0], arcoPts.at(-1)[1] - ant[1]);
    const anteriorPerto = out.length ? d0 > d1 : d0 < d1;
    if (anteriorPerto) arcoPts = arcoPts.reverse();
    out.push(...arcoPts);
  });
  return out;
}

/** Eixo da via com cada canto de 90° trocado pela curva do raio da esquina. */
export function arredondarCurvas(via, esquinas) {
  const h = via.largura / 2;
  const out = [];
  via.pontos.forEach((p) => {
    const k = esquinas.find((e) => e.tipo === 'curva' && !e.juncao && e.vias[0] === via.id
      && Math.hypot(e.vertice[0] - p[0], e.vertice[1] - p[1]) < 1e-6);
    if (!k) { out.push(p); return; }
    let a = arcoEsquina(k, k.r + h);
    const ant = out.length ? out[out.length - 1] : null;
    if (ant && Math.hypot(a[0][0] - ant[0], a[0][1] - ant[1]) > Math.hypot(a.at(-1)[0] - ant[0], a.at(-1)[1] - ant[1])) a = a.reverse();
    out.push(...a);
  });
  // via fechada (anel): a primeira ponta tambem e canto; fecha no arco
  const fechada = Math.hypot(via.pontos[0][0] - via.pontos.at(-1)[0], via.pontos[0][1] - via.pontos.at(-1)[1]) < 1e-6;
  if (fechada && out.length > 2) {
    const k = esquinas.find((e) => e.tipo === 'curva' && !e.juncao && e.vias[0] === via.id
      && Math.hypot(e.vertice[0] - via.pontos[0][0], e.vertice[1] - via.pontos[0][1]) < 1e-6);
    if (k) {
      // o canto da ponta entrou duas vezes (inicio e fim): fica so no fim
      const n = arcoEsquina(k, k.r + h).length;
      out.splice(0, n);
      out.push(out[0]);
    }
  }
  return out;
}

/**
 * Corta a calcada onde ela cruza uma via reta: o trecho sobre a pista vira
 * travessia elevada. Devolve os pedacos de calcada (com a marca de quais
 * pontas foram cortadas) e as travessias (centro no eixo da via, direcao do
 * trafego e largura da pista).
 */
export function cortarTravessias(pontos, vias) {
  const cortes = [];                                 // { i, t0, t1 } por segmento
  const travessias = [];
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1], b = pontos[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (const v of vias) {
      if (v.circulo) continue;
      for (const [p, q] of segmentos(v.pontos)) {
        if (!segCruzaSeg(a, b, p, q)) continue;
        const qp = [q[0] - p[0], q[1] - p[1]];
        const Lv = Math.hypot(qp[0], qp[1]);
        const dv = [qp[0] / Lv, qp[1] / Lv];
        const s = ((p[0] - a[0]) * qp[1] - (p[1] - a[1]) * qp[0]) / (d[0] * qp[1] - d[1] * qp[0]);
        const sen = Math.abs(d[0] * dv[1] - d[1] * dv[0]) || 1;
        const meia = v.largura / 2 / sen;
        cortes.push({ i, s0: s - meia, s1: s + meia });
        travessias.push({ x: a[0] + d[0] * s, z: a[1] + d[1] * s, dv, largura: v.largura / sen, via: v.id });
      }
    }
  }
  // remonta os pedacos
  const pecas = [];
  let atual = { pontos: [pontos[0]], cortadaIni: false, cortadaFim: false };
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1], b = pontos[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const cs = cortes.filter((c) => c.i === i).sort((x, y) => x.s0 - y.s0);
    for (const c of cs) {
      atual.pontos.push([a[0] + d[0] * Math.max(0, c.s0), a[1] + d[1] * Math.max(0, c.s0)]);
      atual.cortadaFim = true;
      if (atual.pontos.length > 1) pecas.push(atual);
      atual = { pontos: [[a[0] + d[0] * Math.min(L, c.s1), a[1] + d[1] * Math.min(L, c.s1)]], cortadaIni: true, cortadaFim: false };
    }
    atual.pontos.push(b);
  }
  if (atual.pontos.length > 1) pecas.push(atual);
  return { pecas, travessias };
}

/** Retangulo que contem a pista acrescentada por uma esquina (o quadrado r x r). */
export function retanguloDaEsquina({ c, u1, u2, r }) {
  const xs = [c[0], c[0] + r * (u1[0] + u2[0])], zs = [c[1], c[1] + r * (u1[1] + u2[1])];
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

/** O ponto esta na pista acrescentada pela esquina (dentro do quadrado, fora do circulo)? */
export function naEsquina(pt, { c, u1, u2, r }) {
  const i = (pt[0] - c[0]) * u1[0] + (pt[1] - c[1]) * u1[1];
  const j = (pt[0] - c[0]) * u2[0] + (pt[1] - c[1]) * u2[1];
  if (i <= 0 || j <= 0 || i >= r || j >= r) return false;
  return Math.hypot(i - r, j - r) > r;
}

/**
 * A pista acrescentada pela esquina em retangulos de `passo` m ao longo de
 * u1: em cada faixa, do canto ate onde o arco a deixa (o pedaco do quadrado
 * dentro do circulo e gramado, nao pista). Para quem so sabe medir
 * retangulo: poste de pipeway, peca de seguranca, arvore.
 */
export function retangulosDaEsquina({ c, u1, u2, r }, passo = 0.5) {
  const out = [];
  for (let i = 0; i < r - 1e-6; i += passo) {
    // largura no meio da faixa: na ponta de dentro a curva e quase vertical
    // e tomaria a faixa inteira de pista
    const im = Math.min(r, i + passo / 2);
    const jMax = r - Math.sqrt(Math.max(0, r * r - (r - im) ** 2));
    if (jMax < 0.1) continue;                      // lasca junto da tangente: nao conta
    const pts = [[i, 0], [Math.min(r, i + passo), 0], [i, jMax], [Math.min(r, i + passo), jMax]]
      .map(([a, b]) => [c[0] + u1[0] * a + u2[0] * b, c[1] + u1[1] * a + u2[1] * b]);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    out.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
  }
  return out;
}

/**
 * Retangulo crescido ate `faixa` m de cada lado, parando `folga` m antes de
 * qualquer pista (via reta ou anel): o piso de um bloco que se estende sem
 * cobrir a via ao lado dele.
 */
export function expandirAteVias(r, faixa, VIAS, folga = 0.3) {
  const naVia = ([x, z]) => VIAS.some((v) => (v.circulo
    ? Math.abs(Math.hypot(x - v.circulo.x, z - v.circulo.z) - v.circulo.raio) < v.largura / 2 + folga
    : segmentos(v.pontos).some(([a, b]) => distPontoSeg([x, z], a, b) < v.largura / 2 + folga)));
  const lado = (amostras) => {
    for (let d = faixa; d > 0; d -= 0.25) if (!amostras(d).some(naVia)) return d;
    return 0;
  };
  const passo = (a, b) => Array.from({ length: Math.ceil((b - a) / 0.5) + 1 }, (_, i) => Math.min(b, a + i * 0.5));
  const x0 = r.x0 - lado((d) => passo(r.z0, r.z1).map((z) => [r.x0 - d, z]));
  const x1 = r.x1 + lado((d) => passo(r.z0, r.z1).map((z) => [r.x1 + d, z]));
  const z0 = r.z0 - lado((d) => passo(r.x0, r.x1).map((x) => [x, r.z0 - d]));
  const z1 = r.z1 + lado((d) => passo(r.x0, r.x1).map((x) => [x, r.z1 + d]));
  return { x0, x1, z0, z1 };
}
