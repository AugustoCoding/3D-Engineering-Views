import * as THREE from 'three';

/**
 * ===========================================================================
 *  ROTEADOR DE TUBULACAO  (Fase 5)
 * ===========================================================================
 *  Uma rota e escrita como num isometrico, por PASSOS ortogonais, e nunca por
 *  coordenada digitada: "sobe ate a elevacao lateral do rack, entra na faixa
 *  da linha, corre em X ate o destino, desce". Cada passo e 'eixo:valor':
 *
 *    x:B   y:A+0.5   z:B-1.2    coordenada do ponto de chegada (B) ou de
 *                               saida (A) — o bocal afastado da sua folga —
 *                               com deslocamento opcional
 *    y:1.25                     valor absoluto (cota de passagem na saia)
 *    x:d+0.6                    deslocamento a partir de onde se esta
 *    y:rack   z:rack            a faixa da linha no rack (BOP + raio)
 *    y:lat                      elevacao lateral do nivel: quem entra ou sai
 *                               do rack em Z corre acima de quem corre em X
 *    z:bordaA  z:bordaB         fora do rack, do lado da origem/destino —
 *                               por onde sobe o riser que vai alem da lateral
 *
 *  A saida (folga ao longo do bocal) e a chegada vem sozinhas; a chegada
 *  anda primeiro no eixo que nao e o do bocal, para o ultimo trecho reto
 *  entrar alinhado com ele. Se o equipamento muda de lugar, a rota acompanha.
 *
 *  O RACK sai das rotas: cada linha que corre nele ganha uma faixa (posicao
 *  em Z) no seu nivel; duas linhas que nunca dividem o mesmo trecho de X
 *  dividem a faixa. A largura sai do numero de faixas, e os porticos sao
 *  postos onde nenhuma linha cruza a estrutura.
 */

const EPS = 1e-6;
const NUM = /^-?\d+(\.\d+)?$/;
const REF = /^(A|B)([+-]\d+(\.\d+)?)?$/;
const DELTA = /^d([+-]\d+(\.\d+)?)$/;

/**
 * Valor de um passo. `ctx`: { faixa: { y, yLat, z }, rack: { z, largura,
 * folgaBorda } }.
 */
function valor(eixo, tok, cur, pA, pB, ctx) {
  if (NUM.test(tok)) return Number(tok);
  let m = tok.match(REF);
  if (m) return (m[1] === 'A' ? pA : pB)[eixo] + (m[2] ? Number(m[2]) : 0);
  m = tok.match(DELTA);
  if (m) return cur[eixo] + Number(m[1]);
  const { faixa, rack } = ctx;
  if (tok === 'rack') {
    if (!faixa) throw new Error('rota usa o rack sem faixa');
    if (eixo === 'y') return faixa.y;
    if (eixo === 'z') return faixa.z;
  }
  if (tok === 'lat' && eixo === 'y') {
    if (!faixa) throw new Error('rota usa a lateral sem faixa');
    return faixa.yLat;
  }
  if ((tok === 'bordaA' || tok === 'bordaB') && eixo === 'z') {
    const p = tok === 'bordaA' ? pA : pB;
    const lado = Math.sign(p.z - rack.z) || 1;
    return rack.z + lado * (rack.largura / 2 + rack.folgaBorda);
  }
  throw new Error(`passo de rota desconhecido: ${eixo}:${tok}`);
}

/** Distancia ao longo de `dir` ate a coordenada pedida ('y:1.25', 'y:B'). */
function saidaAte(A, tok, pB, ctx) {
  const [eixo, t] = tok.split(':');
  const alvo = valor(eixo, t, A.pos, A.pos, pB, ctx);
  const d = A.dir[eixo];
  if (Math.abs(d) < 0.5) throw new Error(`saida '${tok}' fora do eixo do bocal`);
  return (alvo - A.pos[eixo]) / d;
}

/**
 * Ordem da chegada: bocal vertical recebe pelo alto (ou por baixo) depois de
 * andar no plano; bocal horizontal recebe na cota dele, primeiro no eixo
 * transversal, por ultimo no proprio eixo.
 */
function ordemDeChegada(dir) {
  if (Math.abs(dir.y) > 0.7) return ['x', 'z', 'y'];
  return Math.abs(dir.x) < Math.abs(dir.z) ? ['y', 'x', 'z'] : ['y', 'z', 'x'];
}

/** Tira pontos repetidos e os do meio de trechos colineares. */
function limpar(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length && out[out.length - 1].distanceTo(p) < 1e-4) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const u = new THREE.Vector3().subVectors(out[i], out[i - 1]).normalize();
    const v = new THREE.Vector3().subVectors(out[i + 1], out[i]).normalize();
    if (u.dot(v) > 1 - 1e-6) out.splice(i, 1);
  }
  return out;
}

/**
 * Vertices de uma rota.
 * @param {object} A  { pos, dir, sai }   sai: numero ou 'eixo:valor'
 * @param {object} B  { pos, dir, chega }
 * @param {string[]} passos
 * @param {object} ctx  { faixa, rack }
 * @param {object} op   { queda }: inclinacao dos trechos horizontais (m/m),
 *                      para linha que tem de descer o tempo todo; a descida
 *                      final ate o bocal absorve o que se perdeu.
 */
export function tracar(A, B, passos, ctx, { queda = 0 } = {}) {
  const pB = B.pos.clone().addScaledVector(B.dir, B.chega);
  const sai = typeof A.sai === 'string' ? Math.max(0, saidaAte(A, A.sai, pB, ctx)) : A.sai;
  const pA = A.pos.clone().addScaledVector(A.dir, sai);

  const pts = [A.pos.clone(), pA.clone()];
  const cur = pA.clone();
  const mover = (eixo, v) => {
    const d = Math.abs(v - cur[eixo]);
    cur[eixo] = v;
    if (queda && eixo !== 'y') cur.y -= queda * d;
    pts.push(cur.clone());
  };
  for (const passo of passos) {
    const [eixo, tok] = passo.split(':');
    mover(eixo, valor(eixo, tok, cur, pA, pB, ctx));
  }
  for (const eixo of ordemDeChegada(B.dir)) {
    // com queda, a chegada por bocal horizontal desce antes o que os trechos
    // horizontais que faltam ainda vao descer: acaba na cota do bocal, sem
    // voltar a subir (ponto baixo)
    const extra = queda && eixo === 'y' ? queda * (Math.abs(pB.x - cur.x) + Math.abs(pB.z - cur.z)) : 0;
    mover(eixo, pB[eixo] + extra);
  }
  pts.push(B.pos.clone());
  return limpar(pts);
}

/** Trecho de X que a rota percorre na cota da faixa — o que ela ocupa no rack. */
export function trechoNoRack(pts, y) {
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (Math.abs(a.y - y) < EPS && Math.abs(b.y - y) < EPS && Math.abs(a.z - b.z) < EPS) {
      x0 = Math.min(x0, a.x, b.x);
      x1 = Math.max(x1, a.x, b.x);
    }
  }
  return x0 <= x1 ? [x0, x1] : null;
}

/**
 * Faixas do rack por coloracao de intervalos, nivel a nivel.
 *
 * Desde a Fase 11 o rack tem 7 m, com as bombas sob as bordas e o corredor
 * de manutencao no meio. As faixas ocupam so a largura do corredor
 * (`R.larguraFaixas`): sobre a fila de bombas, o riser de descarga de cada
 * bomba furaria a linha que corresse ali. Dentro dessa largura cada linha vai
 * para o lado de onde vem — `lado` -1 (norte), +1 (sul) — e so a que liga um
 * lado ao outro (lado 0) fica no meio: a travessia lateral fica curta.
 * @param {object[]} linhas  [{ id, nivel, od, x0, x1, lado }]
 * @param {object} R         regras do rack (data/arranjo.js)
 * @returns {{ faixas: Map, largura: number, x0: number, x1: number, larguras: number[] }}
 */
export function arranjarRack(linhas, R) {
  const faixas = new Map();
  const larguras = [];
  let x0 = Infinity, x1 = -Infinity;
  const W = R.larguraMin;
  const F = R.larguraFaixas ?? W;

  // As menores primeiro: ficam mais perto do lado de onde vem a travessia,
  // que nelas e curta — o vao admissivel delas e o menor. (A regra antiga, a
  // pesada junto a coluna, perdeu o sentido: as faixas ficam sobre o
  // corredor, longe das colunas.)
  // No meio (linhas que cruzam e cabecais) vale a ordem de antes, a maior
  // primeiro: e ela que poe vapor e condensado do lado para onde viram no
  // pipeway leste, rumo a caldeira.
  const fatiar = (lista, crescente = true) => {
    const slots = [];   // { od, ocupados: [[x0, x1]], ids }
    const s = crescente ? 1 : -1;
    for (const l of [...lista].sort((a, b) => s * (a.od - b.od) || a.x0 - b.x0)) {
      let slot = slots.find((s) => s.ocupados.every(([a, b]) => l.x1 + 0.6 < a || l.x0 - 0.6 > b));
      if (!slot) { slot = { od: 0, ocupados: [], ids: [] }; slots.push(slot); }
      slot.ocupados.push([l.x0, l.x1]);
      slot.od = Math.max(slot.od, l.od);
      slot.ids.push(l.id);
    }
    return slots;
  };
  // Passo entre faixas vizinhas: os dois raios mais a folga.
  const empilhar = (slots, z0, sentido) => {
    let z = z0;
    slots.forEach((s, k) => {
      z += sentido * (k ? (slots[k - 1].od + s.od) / 2 + R.folgaTubos : s.od / 2);
      s.z = z;
    });
    return slots.length ? Math.abs(z - z0) + slots[slots.length - 1].od / 2 : 0;
  };

  R.niveis.forEach((bop, i) => {
    const nivel = i + 1;
    const doNivel = linhas.filter((l) => l.nivel === nivel);
    for (const l of doNivel) { x0 = Math.min(x0, l.x0); x1 = Math.max(x1, l.x1); }
    const norte = fatiar(doNivel.filter((l) => l.lado < 0));
    const sul = fatiar(doNivel.filter((l) => l.lado > 0));
    const meio = fatiar(doNivel.filter((l) => !l.lado), false);
    const usadoN = empilhar(norte, R.z - F / 2, 1);
    const usadoS = empilhar(sul, R.z + F / 2, -1);
    const usadoM = empilhar(meio, 0, 1);
    if (meio.length) {
      const c = (meio[0].z + meio[meio.length - 1].z) / 2;
      for (const s of meio) s.z += R.z - c;
    }
    larguras.push(usadoN + usadoS + usadoM + 2 * R.margem);
    for (const s of [...norte, ...sul, ...meio]) {
      for (const id of s.ids) {
        const l = doNivel.find((q) => q.id === id);
        faixas.set(id, {
          nivel,
          z: s.z,
          y: bop + l.od / 2,          // tubo apoiado na viga pelo fundo (BOP)
          yLat: bop + R.lateral,
        });
      }
    }
  });

  return { faixas, larguras, largura: Math.max(W, ...larguras), x0, x1 };
}

/** Faixa provisoria: so a cota importa para medir o trecho de X. */
export function faixaProvisoria(R, nivel, od) {
  const bop = R.niveis[nivel - 1];
  return { nivel, z: R.z, y: bop + od / 2, yLat: bop + R.lateral };
}

/**
 * Intervalos de X onde nao pode haver portico: onde alguma linha cruza o
 * plano das colunas ou a cota de uma viga dentro do rack. Trecho que corre
 * em X, apoiado, nao conta — e para isso que a viga existe.
 */
export function proibidosNoRack(caminhos, rack, R) {
  const zN = rack.z - rack.largura / 2;
  const zS = rack.z + rack.largura / 2;
  const topo = R.niveis[R.niveis.length - 1];
  const out = [];
  for (const { pts, r } of caminhos) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (Math.abs(a.y - b.y) < EPS && Math.abs(a.z - b.z) < EPS) continue;   // corre em X
      const [xa, xb] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
      const [ya, yb] = [Math.min(a.y, b.y) - r, Math.max(a.y, b.y) + r];
      const [za, zb] = [Math.min(a.z, b.z) - r, Math.max(a.z, b.z) + r];
      if (yb < 0 || ya > topo + 0.2) continue;
      const cruzaColuna = [zN, zS].some((zc) => za <= zc + 0.15 && zb >= zc - 0.15);
      const dentro = zb >= zN - 0.15 && za <= zS + 0.15;
      const cruzaViga = dentro && R.niveis.some((bop) => ya <= bop && yb >= bop - 0.3);
      if (cruzaColuna || cruzaViga) out.push([xa - r - 0.3, xb + r + 0.3]);
    }
  }
  return out;
}

/**
 * Porticos do rack de x0 a x1, com vao maximo `vaoMax`, fora dos intervalos
 * proibidos. Guloso: cada portico vai o mais longe que pode.
 *
 * `desejados` (Fase 12): X das linhas que cruzam o rack de lado num vao
 * maior que o admissivel. Cada uma ganha um portico a 0,4–1,0 m dela — e
 * dele que sai a mao-francesa que a apoia (a pratica de "virar no portico");
 * no proprio X o portico nao cabe, a coluna furaria a linha — a nao ser
 * que a travessia passe acima do ultimo nivel (`rente`): ai a coluna acaba
 * antes e ela pousa sobre a viga.
 */
export function porticosDoRack(x0, x1, proibidos, vaoMax, desejados = []) {
  const livre = (x) => !proibidos.some(([a, b]) => x > a && x < b);
  const PASSO = 0.05;
  const procura = (de, ate) => {
    const s = Math.sign(ate - de) || 1;
    for (let x = de; s > 0 ? x <= ate + EPS : x >= ate - EPS; x += s * PASSO) if (livre(x)) return x;
    return null;
  };
  const OFFS = [0.4, -0.4, 0.5, -0.5, 0.6, -0.6, 0.7, -0.7, 0.8, -0.8, 0.9, -0.9, 1.0, -1.0];
  const fixos = [];
  const lista = desejados.map((d) => (typeof d === 'number' ? { x: d } : d)).sort((a, b) => a.x - b.x);
  for (const d of lista) {
    if (fixos.some((f) => Math.abs(f - d.x) >= (d.rente ? 0 : 0.35) && Math.abs(f - d.x) <= 1.0)) continue;
    const offs = d.rente ? [0, 0.1, -0.1, 0.2, -0.2, ...OFFS] : OFFS;
    const x = offs.map((o) => d.x + o).find((q) => q >= x0 && q <= x1 && livre(q) && !fixos.some((f) => Math.abs(f - q) < 1.2));
    if (x !== undefined) fixos.push(x);
  }
  fixos.sort((a, b) => a - b);

  const xs = [procura(x0, x0 + 1.5) ?? x0];
  let forcados = 0;
  const fim = procura(x1, x1 - 1.5) ?? x1;
  const marcos = [...fixos.filter((f) => f > xs[0] + 0.5 && f < fim - 0.5), fim];
  for (const m of marcos) {
    // enche o vao ate o proximo marco com porticos gulosos
    while (m - xs[xs.length - 1] > vaoMax) {
      const ult = xs[xs.length - 1];
      const alvo = Math.min(ult + vaoMax, m - 0.5);
      let p = procura(alvo, ult + 1);
      if (p === null) { p = alvo; forcados++; }
      xs.push(p);
    }
    if (m > xs[xs.length - 1] + 0.5) xs.push(m);
  }
  return { xs, forcados, fixos };
}
