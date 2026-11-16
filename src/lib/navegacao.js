/**
 * ===========================================================================
 *  GRADE DE NAVEGACAO A PE  (Fase 20)
 * ===========================================================================
 *  Celulas de `passo` m num retangulo. Livre e o que o chamador diz que e
 *  livre (as salas de um predio, a laje) ou aberto (o vao de uma porta, que
 *  atravessa a parede), menos o que bloqueia (moveis, equipamento), sempre
 *  com a folga do corpo (`raio`). O caminho sai de A* em oito vizinhos e e
 *  esticado por linha de visada: a pessoa anda reto ate onde enxerga livre,
 *  nao em zigue-zague de grade. Tudo no plano (x, z).
 */

const dentro = ([x, z], r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;

export function criarGrade({ ret, livres, abertos = [], bloqueios = [], passo = 0.25, raio = 0.3 }) {
  const nx = Math.max(1, Math.ceil((ret.x1 - ret.x0) / passo));
  const nz = Math.max(1, Math.ceil((ret.z1 - ret.z0) / passo));
  const ok = new Uint8Array(nx * nz);
  const centro = (i, k) => [ret.x0 + (i + 0.5) * passo, ret.z0 + (k + 0.5) * passo];
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx; i++) {
      const c = centro(i, k);
      let l = livres.some((r) => dentro(c, r, -raio)) || abertos.some((r) => dentro(c, r));
      if (l && bloqueios.some((r) => dentro(c, r, raio))) l = false;
      ok[k * nx + i] = l ? 1 : 0;
    }
  }
  const celula = ([x, z]) => [Math.floor((x - ret.x0) / passo), Math.floor((z - ret.z0) / passo)];
  const valida = (i, k) => i >= 0 && k >= 0 && i < nx && k < nz;
  const livreCel = (i, k) => valida(i, k) && ok[k * nx + i] === 1;
  const livre = (p) => { const [i, k] = celula(p); return livreCel(i, k); };

  // a reta de p (que pode estar dentro da folga de um movel: o assento) ate
  // a celula nao pode atravessar OUTRO movel — o administrativo da ADM saia
  // da cadeira atravessando o armario vizinho de 40 cm (Fase 28)
  const atravessa = (p, c) => {
    const q = centro(...c), L = Math.hypot(q[0] - p[0], q[1] - p[1]), m = Math.ceil(L / 0.05);
    return bloqueios.some((r) => !dentro(p, r) && Array.from({ length: m }, (_, s) => s / m)
      .some((u) => dentro([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u], r)));
  };

  /** Celula livre mais perto de p (espiral ate `ate` m) a que se chega em
   *  linha reta sem atravessar movel, ou null. */
  function maisPerto(p, ate = 3) {
    const [i0, k0] = celula(p);
    if (livreCel(i0, k0)) return [i0, k0];
    const n = Math.ceil(ate / passo);
    let melhor = null;
    for (let r = 1; r <= n && !melhor; r++) {
      for (let di = -r; di <= r; di++) {
        for (let dk = -r; dk <= r; dk++) {
          if (Math.max(Math.abs(di), Math.abs(dk)) !== r || !livreCel(i0 + di, k0 + dk)) continue;
          if (atravessa(p, [i0 + di, k0 + dk])) continue;
          const d = Math.hypot(di, dk);
          if (!melhor || d < melhor.d) melhor = { d, c: [i0 + di, k0 + dk] };
        }
      }
    }
    return melhor?.c ?? null;
  }

  /** Linha de visada livre de a a b (amostra a cada meio passo). */
  function visada(a, b) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / (passo / 2)));
    for (let j = 0; j <= n; j++) if (!livre([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n])) return false;
    return true;
  }

  /** Pontos de a a b pela grade (a e b entram como estao), ou null. */
  function caminho(a, b) {
    const ca = maisPerto(a), cb = maisPerto(b);
    if (!ca || !cb) return null;
    const ini = ca[1] * nx + ca[0], fim = cb[1] * nx + cb[0];
    const g = new Float64Array(nx * nz).fill(Infinity), de = new Int32Array(nx * nz).fill(-1);
    const fechado = new Uint8Array(nx * nz);
    const h = (id) => Math.hypot((id % nx) - cb[0], Math.floor(id / nx) - cb[1]);
    // heap binario de [f, id]
    const heap = [];
    const sobe = (j) => { while (j > 0) { const p = (j - 1) >> 1; if (heap[p][0] <= heap[j][0]) break; [heap[p], heap[j]] = [heap[j], heap[p]]; j = p; } };
    const desce = (j) => {
      for (;;) {
        const l = 2 * j + 1, r = l + 1;
        let m = j;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === j) return;
        [heap[m], heap[j]] = [heap[j], heap[m]]; j = m;
      }
    };
    g[ini] = 0;
    heap.push([h(ini), ini]);
    const viz = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const [, id] = heap[0];
      const ult = heap.pop();
      if (heap.length) { heap[0] = ult; desce(0); }
      if (fechado[id]) continue;
      fechado[id] = 1;
      if (id === fim) break;
      const i = id % nx, k = Math.floor(id / nx);
      for (const [di, dk, c] of viz) {
        const ii = i + di, kk = k + dk;
        if (!livreCel(ii, kk)) continue;
        // diagonal so com os dois vizinhos retos livres (nao corta quina)
        if (di && dk && (!livreCel(i + di, k) || !livreCel(i, k + dk))) continue;
        const j = kk * nx + ii;
        if (fechado[j] || g[id] + c >= g[j]) continue;
        g[j] = g[id] + c;
        de[j] = id;
        heap.push([g[j] + h(j), j]);
        sobe(heap.length - 1);
      }
    }
    if (!fechado[fim]) return null;
    const cel = [];
    for (let id = fim; id >= 0; id = de[id]) cel.unshift(centro(id % nx, Math.floor(id / nx)));
    // esticar: de cada ponto, ate o mais distante que se enxerga
    const pts = [a, ...cel, b];
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !visada(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  return { livre, caminho, maisPerto: (p) => { const c = maisPerto(p); return c ? centro(c[0], c[1]) : null; }, visada };
}
