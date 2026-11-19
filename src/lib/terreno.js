import * as THREE from 'three';
import { triplanar } from './texturas.js';

/**
 * ===========================================================================
 *  CHAO DA IMPLANTACAO — placas, faixas, linhas e setas no terreno
 * ===========================================================================
 *  Tudo aqui deita no terreno, que fica em y = -0,25 (core/scene.js), abaixo
 *  do piso da laje de processo (y = 0). Cada camada tem a SUA altura, com
 *  pelo menos 4 cm de diferenca: vistas de 200 m, duas superficies a 1 cm uma
 *  da outra ja disputam o z-buffer e o chao cintila quando a camera anda —
 *  o mesmo problema que o PLINTO resolveu sob os equipamentos.
 */
export const Y = {
  lote: -0.21,       // piso do terreno cercado: gramado
  brita: -0.17,      // faixa de brita em volta do que pega fogo
  via: -0.13,
  linha: -0.07,      // rotas e limites desenhados sobre o resto
  bloco: -0.05,      // topo das placas de cada bloco
  calcada: 0.02,     // pista + meio-fio de 15 cm (Fase 14): a calcada e alta
};
export const ALTURA_MEIO_FIO = Y.calcada - Y.via;

const materiais = new Map();
/** Material por cor, com textura procedural opcional: tex = [nome, metros]. */
function mat(cor, extra = {}, tex = null) {
  const chave = `${cor}-${JSON.stringify(extra)}-${tex}`;
  if (!materiais.has(chave)) {
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.95, metalness: 0, ...extra });
    materiais.set(chave, tex ? triplanar(m, tex[0], tex[1]) : m);
  }
  return materiais.get(chave);
}

/**
 * Placa retangular com topo em `y`, descendo `espessura` — a face de baixo
 * fica enterrada no terreno, nunca rente a ele.
 */
/** Placa no chao; `cor` pode ser um material pronto, quando quem chama o troca. */
export function placa(r, y, cor, espessura = 0.2, tex = null) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(r.x1 - r.x0, espessura, r.z1 - r.z0),
    cor instanceof THREE.Material ? cor : mat(cor, {}, tex),
  );
  m.position.set((r.x0 + r.x1) / 2, y - espessura / 2, (r.z0 + r.z1) / 2);
  m.receiveShadow = true;
  return m;
}

/**
 * Faixa de largura constante ao longo de uma polilinha (via, calcada). Um
 * quadrado em cada vertice fecha o canto que dois retangulos deixariam aberto.
 */
export function faixa(pontos, largura, y, cor, espessura = 0.06, tex = null, { pontas = true } = {}) {
  const g = new THREE.Group();
  const m = cor instanceof THREE.Material ? cor : mat(cor, {}, tex);
  for (let i = 1; i < pontos.length; i++) {
    const [ax, az] = pontos[i - 1];
    const [bx, bz] = pontos[i];
    const comp = Math.hypot(bx - ax, bz - az);
    const s = new THREE.Mesh(new THREE.BoxGeometry(comp, espessura, largura), m);
    s.position.set((ax + bx) / 2, y - espessura / 2, (az + bz) / 2);
    s.rotation.y = -Math.atan2(bz - az, bx - ax);
    s.receiveShadow = true;
    g.add(s);
  }
  // Junta: quadrado na esquina de 90° e na ponta (fecha o canto vivo); disco
  // no vertice de curva, onde o quadrado sobraria para fora como um dente.
  // Ponta cortada (`pontas: false`) termina reta, sem quadrado: e a calcada
  // que para na borda da pista, onde comeca a travessia.
  const [pIni, pFim] = Array.isArray(pontas) ? pontas : [pontas, pontas];
  pontos.forEach(([x, z], i) => {
    const ponta = i === 0 || i === pontos.length - 1;
    if ((i === 0 && !pIni) || (i === pontos.length - 1 && !pFim)) return;
    let curva = false;
    if (!ponta) {
      const [ax, az] = pontos[i - 1], [bx, bz] = pontos[i + 1];
      const d1 = [x - ax, z - az], d2 = [bx - x, bz - z];
      const cos = (d1[0] * d2[0] + d1[1] * d2[1]) / (Math.hypot(...d1) * Math.hypot(...d2) || 1);
      curva = cos > 0.2;
    }
    const geo = curva
      ? new THREE.CylinderGeometry(largura / 2, largura / 2, espessura, 24)
      : new THREE.BoxGeometry(largura, espessura, largura);
    const c = new THREE.Mesh(geo, m);
    c.position.set(x, y - espessura / 2, z);
    c.receiveShadow = true;
    g.add(c);
  });
  return g;
}

/**
 * Linha tracejada no chao. `LineDashedMaterial` sem `computeLineDistances()`
 * sai continua, sem aviso — ja aconteceu nas cotas.
 */
export function linhaTracejada(pontos, y, cor, { traco = 4, vao = 3 } = {}) {
  const geo = new THREE.BufferGeometry().setFromPoints(
    pontos.map(([x, z]) => new THREE.Vector3(x, y, z)),
  );
  const l = new THREE.Line(geo, new THREE.LineDashedMaterial({
    color: cor, dashSize: traco, gapSize: vao, transparent: true, opacity: 0.9,
  }));
  l.computeLineDistances();
  return l;
}

/**
 * Seta plana deitada no chao, apontando para (dx, dz) a partir de (x, z).
 * Serve para o norte e para o vento.
 */
export function setaPlana({ x, z, dx, dz, comprimento = 16, largura = 3, y = Y.linha, cor = 0xffffff }) {
  const L = comprimento, w = largura;
  const forma = new THREE.Shape();
  forma.moveTo(0, -w / 2);
  forma.lineTo(L * 0.62, -w / 2);
  forma.lineTo(L * 0.62, -w * 1.4);
  forma.lineTo(L, 0);
  forma.lineTo(L * 0.62, w * 1.4);
  forma.lineTo(L * 0.62, w / 2);
  forma.lineTo(0, w / 2);
  forma.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), mat(cor, { side: THREE.DoubleSide }));
  // A forma nasce no plano XY apontando para +X; deita no XZ e gira para (dx, dz).
  m.rotation.order = 'YXZ';
  m.rotation.x = -Math.PI / 2;
  m.rotation.y = -Math.atan2(dz, dx);
  m.position.set(x, y, z);
  return m;
}

/**
 * Mureta de contencao no perimetro de um retangulo, sobre o piso (y = 0).
 * Nasce 2 cm dentro da laje, para a face de baixo nao ficar coplanar com ela.
 * Onde ha acesso, uma RAMPA de cada lado deixa a roda passar sem abrir a
 * mureta — abrir faria o derrame escapar justamente pelo acesso.
 *
 *   rampas: [{ lado: 'oeste'|'leste'|'norte'|'sul', centro, largura }]
 */
export function mureta(r, { altura = 0.15, largura = 0.2, rampas = [] } = {}) {
  const g = new THREE.Group();
  g.name = 'mureta';
  const m = mat(0x8c9096, {}, ['concreto', 2]);
  const yBase = -0.02;
  const h = altura - yBase;
  const lados = {
    norte: { a: [r.x0, r.z0], b: [r.x1, r.z0], dentro: [0, 1] },
    sul: { a: [r.x0, r.z1], b: [r.x1, r.z1], dentro: [0, -1] },
    oeste: { a: [r.x0, r.z0], b: [r.x0, r.z1], dentro: [1, 0] },
    leste: { a: [r.x1, r.z0], b: [r.x1, r.z1], dentro: [-1, 0] },
  };
  for (const [nome, L] of Object.entries(lados)) {
    const emX = L.a[1] === L.b[1];
    const comp = emX ? L.b[0] - L.a[0] : L.b[1] - L.a[1];
    const [dx, dz] = L.dentro;
    const s = new THREE.Mesh(
      emX ? new THREE.BoxGeometry(comp, h, largura) : new THREE.BoxGeometry(largura, h, comp),
      m,
    );
    s.position.set(
      (L.a[0] + L.b[0]) / 2 + dx * largura / 2, yBase + h / 2, (L.a[1] + L.b[1]) / 2 + dz * largura / 2,
    );
    s.castShadow = true;
    g.add(s);

    // rampas: cunha por dentro e por fora, ao longo da largura do acesso
    for (const rp of rampas.filter((x) => x.lado === nome)) {
      for (const sentido of [1, -1]) {           // 1 = para dentro da laje
        const run = sentido === 1 ? 0.9 : 1.4;   // por fora desce ate a via
        const queda = sentido === 1 ? altura : altura + 0.2;
        const forma = new THREE.Shape();
        forma.moveTo(0, 0);
        forma.lineTo(run, 0);
        forma.lineTo(0, queda);
        forma.closePath();
        const geo = new THREE.ExtrudeGeometry(forma, { depth: rp.largura, bevelEnabled: false });
        geo.translate(0, -queda + altura, -rp.largura / 2);
        const cunha = new THREE.Mesh(geo, m);
        // a cunha nasce apontando +X; gira para o sentido do lado
        const ang = Math.atan2(dz * sentido, dx * sentido);
        cunha.rotation.y = -ang;
        const off = sentido === 1 ? largura : 0;
        const px = emX ? rp.centro : L.a[0] + dx * off;
        const pz = emX ? L.a[1] + dz * off : rp.centro;
        cunha.position.set(px, 0, pz);
        cunha.castShadow = true;
        g.add(cunha);
      }
    }
  }
  return g;
}

/** Grelha de caixa coletora sobre o piso: moldura e barras de aco. */
export function grelha({ x, z, lado }) {
  const g = new THREE.Group();
  g.name = 'caixa-coletora';
  // o vao escuro e pintura no piso: deslocamento de profundidade, nunca pisca
  const fundo = new THREE.Mesh(new THREE.BoxGeometry(lado, 0.05, lado),
    mat(0x15181c, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  fundo.position.set(x, 0.005, z);
  g.add(fundo);
  const aco = mat(0x7f858d, { metalness: 0.7, roughness: 0.5 });
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, lado), aco);
    b.position.set(x - lado / 2 + (i * lado) / n, 0.045, z);
    g.add(b);
  }
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(lado + 0.12, 0.03, 0.06), aco);
  for (const s of [-1, 1]) {
    const mz = moldura.clone();
    mz.position.set(x, 0.045, z + s * (lado / 2 + 0.03));
    g.add(mz);
  }
  return g;
}

/** Retangulo desenhado no chao (linha continua), com hachura diagonal opcional. */
export function contorno(r, y, cor, { hachura = 0 } = {}) {
  const g = new THREE.Group();
  const matL = new THREE.LineBasicMaterial({ color: cor });
  const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1], [r.x0, r.z0]]
    .map(([x, z]) => new THREE.Vector3(x, y, z));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matL));
  if (hachura > 0) {
    // diagonais a 45°, recortadas pelo retangulo
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    for (let s = hachura; s < w + d; s += hachura) {
      const a = [r.x0 + Math.min(s, w), r.z0 + Math.max(0, s - w)];
      const b = [r.x0 + Math.max(0, s - d), r.z0 + Math.min(s, d)];
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(b[0], y, b[1])]),
        matL,
      ));
    }
  }
  return g;
}

/** Circulo cheio no chao (pegada de tanque, ponto de encontro). */
export function disco({ x, z, raio, y = Y.bloco + 0.02, cor }) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, 0.06, 40), mat(cor));
  m.position.set(x, y - 0.03, z);
  m.receiveShadow = true;
  return m;
}

/* ===========================================================================
 *  VIAS DE VERDADE (Fase 7): meio-fio, faixa central, faixa de pedestre,
 *  vagas e cerca.
 * ======================================================================== */

/** Distancia em planta do ponto (x, z) ao segmento a-b. */
function distSeg2(x, z, [ax, az], [bx, bz]) {
  const vx = bx - ax, vz = bz - az;
  const L2 = vx * vx + vz * vz;
  const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
  return Math.hypot(ax + t * vx - x, az + t * vz - z);
}

/**
 * Corre ao longo de um segmento em passos de `passo` e devolve os trechos
 * [s0, s1] onde `livre(x, z)` vale. Serve para o meio-fio abrir onde outra
 * via ou uma calcada cruza.
 */
function trechosLivres(a, b, livre, passo = 0.25) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const out = [];
  let ini = null;
  for (let s = 0; s <= L + 1e-6; s += passo) {
    const t = s / L;
    const ok = livre(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (ok && ini === null) ini = s;
    if (!ok && ini !== null) { if (s - ini > 0.3) out.push([ini, s]); ini = null; }
  }
  if (ini !== null && L - ini > 0.3) out.push([ini, L]);
  return { L, out };
}

/** Faixa central tracejada (3 m de traco, 6 m de ciclo), fora dos cruzamentos. */
export function faixaCentral(via, vias) {
  const g = new THREE.Group();
  g.name = 'faixa-central';
  const m = mat(0xf2f2ee);
  const outras = vias.filter((v) => v !== via);
  const livre = (x, z) => !outras.some((o) => o.pontos.some((p, i) => i > 0
    && distSeg2(x, z, o.pontos[i - 1], p) <= o.largura / 2 + 1));
  for (let i = 1; i < via.pontos.length; i++) {
    const [ax, az] = via.pontos[i - 1], [bx, bz] = via.pontos[i];
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let s = 1.5; s + 3 < L; s += 6) {
      const x = ax + ux * (s + 1.5), z = az + uz * (s + 1.5);
      if (!livre(x, z)) continue;
      const d = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.12), m);
      d.position.set(x, Y.via, z);           // 4 cm acima da via, embutido
      d.rotation.y = -Math.atan2(uz, ux);
      g.add(d);
    }
  }
  return g;
}

/** Vagas a 90° em duas fileiras, frente a frente, com corredor no meio. */
/**
 * Geometria das vagas: duas fileiras em volta do corredor central, faixas a
 * cada `largura` m. Uma conta so para as faixas pintadas e para os carros
 * estacionados (Fase 9). Centro de cada vaga e o lado do corredor (+1/-1 em z).
 */
export function vagasDe(r, { largura = 2.5, comprimento = 5, corredor = 6, passagem = 0 } = {}) {
  const meio = (r.z0 + r.z1) / 2;
  const fileiras = [meio - corredor / 2 - comprimento, meio + corredor / 2];
  const linhasX = [];
  for (let x = r.x0 + 1; x <= r.x1 - 1 - passagem + 1e-6; x += largura) linhasX.push(x);
  const centros = [];
  fileiras.forEach((z0, i) => {
    for (let k = 1; k < linhasX.length; k++) {
      centros.push({ x: (linhasX[k - 1] + linhasX[k]) / 2, z: z0 + comprimento / 2, corredor: i === 0 ? 1 : -1 });
    }
  });
  return { fileiras, linhasX, centros, comprimento };
}

export function vagas(r, VAGA = {}) {
  const g = new THREE.Group();
  g.name = 'vagas';
  const m = mat(0xf2f2ee);
  const yv = Y.bloco;                              // 4 cm acima do piso do bloco
  const { fileiras, linhasX, comprimento } = vagasDe(r, VAGA);
  for (const z0 of fileiras) {
    for (const x of linhasX) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, comprimento), m);
      l.position.set(x, yv, z0 + comprimento / 2);
      g.add(l);
    }
  }
  return g;
}

/**
 * Cerca de tela no perimetro, com mourao a cada `vao` m e abertura nos
 * portoes, onde fica uma folha de correr encostada.
 *   r: retangulo do lote   portoes: [{ x, z }]
 */
export function cerca(r, portoes, { altura = 2.4, vao = 3, larguraPortao = 8 } = {}) {
  const g = new THREE.Group();
  g.name = 'cerca';
  const mMourao = mat(0x6f7378);
  const mTela = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const lados = [
    [[r.x0, r.z0], [r.x1, r.z0]], [[r.x1, r.z0], [r.x1, r.z1]],
    [[r.x1, r.z1], [r.x0, r.z1]], [[r.x0, r.z1], [r.x0, r.z0]],
  ];
  // cada portao com a sua largura (o de pedestre e estreito)
  const largura = (p) => p.largura ?? larguraPortao;
  const noPortao = (x, z) => portoes.some((p) => Math.hypot(p.x - x, p.z - z) < largura(p) / 2);
  for (const [a, b] of lados) {
    const { L, out } = trechosLivres(a, b, (x, z) => !noPortao(x, z), 0.5);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (const [s0, s1] of out) {
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(s1 - s0, altura), mTela);
      const sm = (s0 + s1) / 2;
      tela.position.set(a[0] + ux * sm, Y.lote + altura / 2, a[1] + uz * sm);
      tela.rotation.y = -Math.atan2(uz, ux);
      g.add(tela);
      for (let s = s0; s <= s1 + 1e-6; s += Math.min(vao, s1 - s0)) {
        const mo = new THREE.Mesh(new THREE.BoxGeometry(0.08, altura + 0.3, 0.08), mMourao);
        mo.position.set(a[0] + ux * s, Y.lote - 0.3 + (altura + 0.3) / 2, a[1] + uz * s);
        g.add(mo);
      }
    }
  }
  // folha de correr de cada portao, encostada ao lado da abertura — do lado
  // em que ela nao cobre a abertura de outro portao
  for (const p of portoes.filter((q) => q.folha !== false)) {
    const lado = lados.find(([a, b]) => distSeg2(p.x, p.z, a, b) < 1);
    if (!lado) continue;
    const [a, b] = lado;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const w = largura(p);
    const livre = (sg) => portoes.every((o) => o === p
      || Math.hypot(p.x + (sg * (b[0] - a[0]) * w) / L - o.x, p.z + (sg * (b[1] - a[1]) * w) / L - o.z) >= (w + largura(o)) / 2);
    const sg = livre(1) ? 1 : -1;
    const ux = (sg * (b[0] - a[0])) / L, uz = (sg * (b[1] - a[1])) / L;
    const folha = new THREE.Mesh(new THREE.BoxGeometry(w, altura - 0.2, 0.06), mMourao);
    folha.position.set(p.x + ux * w, Y.lote + altura / 2, p.z + uz * w);
    folha.rotation.y = -Math.atan2(uz, ux);
    folha.position.x += -uz * 0.4;
    folha.position.z += ux * 0.4;
    g.add(folha);
  }
  return g;
}

/**
 * Pista em anel (retorno do onibus): coroa circular deitada com o topo em
 * `y`. Um poligono de faixas deixaria dente em cada vertice — o quadrado
 * que fecha a esquina de 90° sobra para fora numa curva continua.
 */
export function anelVia({ x, z, raio, largura }, y, cor, tex = null) {
  const geo = new THREE.RingGeometry(raio - largura / 2, raio + largura / 2, 64, 1);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, cor instanceof THREE.Material ? cor : mat(cor, {}, tex));
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/* ===========================================================================
 *  CHAO DE VERDADE (Fase 14): esquina arredondada, travessia elevada,
 *  meio-fio ao longo de uma linha e placa de cantos redondos.
 * ======================================================================== */

/**
 * Linha deslocada `o` para a esquerda de quem anda nela (x leste, z sul),
 * com a junta em meia-esquadria em qualquer angulo — a linha do meio-fio de
 * uma curva.
 */
export function deslocarSuave(pts, o) {
  const n = (a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [dz / L, -dx / L];
  };
  return pts.map((p, i) => {
    const n1 = i > 0 ? n(pts[i - 1], p) : null, n2 = i < pts.length - 1 ? n(p, pts[i + 1]) : null;
    let m = n1 && n2 ? [n1[0] + n2[0], n1[1] + n2[1]] : (n1 ?? n2);
    const L = Math.hypot(m[0], m[1]) || 1;
    m = [m[0] / L, m[1] / L];
    const cos = n1 && n2 ? Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]) : 1;
    return [p[0] + (o * m[0]) / cos, p[1] + (o * m[1]) / cos];
  });
}

/**
 * Pista que o arredondamento de uma esquina acrescenta: o quadrado r x r no
 * canto `c`, entre as bordas `u1` e `u2`, menos o quarto de circulo de raio r
 * (centro c + r(u1 + u2)). Mesma altura e material da via: a sobreposicao com
 * ela nao aparece.
 */
export function fileteEsquina({ c, u1, u2, r }, y, material, espessura = 0.06) {
  const o = [c[0] + r * (u1[0] + u2[0]), c[1] + r * (u1[1] + u2[1])];
  const pts = [c, [c[0] + r * u1[0], c[1] + r * u1[1]]];
  // arco de c + r u1 ate c + r u2, pelo lado do canto
  const a0 = Math.atan2(-u2[1], -u2[0]), a1 = Math.atan2(-u1[1], -u1[0]);
  let da = a1 - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  for (let i = 1; i < 16; i++) {
    const a = a0 + (da * i) / 16;
    pts.push([o[0] + r * Math.cos(a), o[1] + r * Math.sin(a)]);
  }
  pts.push([c[0] + r * u2[0], c[1] + r * u2[1]]);
  const forma = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(forma, { depth: espessura, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);                       // plano (x, -z) -> chao (x, z), extrudado para cima
  geo.translate(0, y - espessura, 0);
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

/**
 * Travessia elevada (CONTRAN): plataforma na altura da calcada sobre toda a
 * largura da pista, `plataforma` m no sentido do trafego, rampa de `rampa` m
 * dos dois lados e a faixa de pedestre pintada em cima.
 *   x, z     centro, no eixo da via
 *   dv       direcao do trafego (unitaria)
 *   largura  largura da pista (o comprimento da travessia)
 */
export function travessiaElevada({ x, z, dv, largura, plataforma = 5, rampa = 1.5, yVia, yTopo, material }) {
  const g = new THREE.Group();
  g.name = 'travessia-elevada';
  const h = yTopo - yVia;
  const ang = -Math.atan2(dv[1], dv[0]);
  // perfil no sentido do trafego — rampa, plataforma, rampa — extrudado na largura
  const L = plataforma / 2 + rampa;
  const perfil = new THREE.Shape([
    new THREE.Vector2(-L, 0), new THREE.Vector2(-plataforma / 2, h), new THREE.Vector2(plataforma / 2, h),
    new THREE.Vector2(L, 0),
  ]);
  const geo = new THREE.ExtrudeGeometry(perfil, { depth: largura, bevelEnabled: false });
  geo.translate(0, 0, -largura / 2);
  const corpo = new THREE.Mesh(geo, material);
  corpo.position.set(x, yVia, z);
  corpo.rotation.y = ang;
  corpo.receiveShadow = true;
  g.add(corpo);
  // zebra: barras no sentido do trafego, repetidas na largura; pintura com
  // deslocamento de profundidade (nunca disputa o z-buffer com a plataforma)
  const tinta = mat(0xf2f2ee, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  for (let t = -largura / 2 + 0.5; t <= largura / 2 - 0.5 + 1e-6; t += 0.8) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(plataforma - 1, 0.4), tinta);
    b.rotation.x = -Math.PI / 2;
    const p = new THREE.Group();
    p.add(b);
    p.position.set(x - dv[1] * t, yTopo + 0.002, z + dv[0] * t);
    p.rotation.y = ang;
    g.add(p);
  }
  return g;
}

/**
 * Meio-fio ao longo de uma linha (a do meio-fio, ja deslocada da pista):
 * pecas de `largura` x `altura` acima de `yVia`, so onde `livre(x, z)`.
 */
export function meioFioAoLongo(linha, livre, { yVia, altura = 0.15, largura = 0.15, base = 0.1 } = {}) {
  const g = new THREE.Group();
  g.name = 'meio-fio';
  const m = mat(0xb9bcbf, {}, ['concreto', 2]);
  for (let i = 1; i < linha.length; i++) {
    const a = linha[i - 1], b = linha[i];
    const { out } = trechosLivres(a, b, livre, 0.2);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (const [s0, s1] of out) {
      // um pouco mais comprida: nas curvas as pecas se encostam sem fresta
      const c = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0 + 0.04, altura + base, largura), m);
      const sm = (s0 + s1) / 2;
      c.position.set(a[0] + ux * sm, yVia - base + (altura + base) / 2, a[1] + uz * sm);
      c.rotation.y = -Math.atan2(uz, ux);
      c.receiveShadow = true;
      g.add(c);
    }
  }
  return g;
}

/** Placa de cantos arredondados (raio `raio`) com o topo em `y`. */
export function placaArredondada(r, raio, y, material, espessura = 0.04) {
  const f = new THREE.Shape();
  const { x0, x1 } = r;
  const z0 = -r.z1, z1 = -r.z0;                    // a forma nasce no plano (x, -z)
  const k = Math.min(raio, (x1 - x0) / 2, (z1 - z0) / 2);
  f.moveTo(x0 + k, z0);
  f.lineTo(x1 - k, z0); f.absarc(x1 - k, z0 + k, k, -Math.PI / 2, 0);
  f.lineTo(x1, z1 - k); f.absarc(x1 - k, z1 - k, k, 0, Math.PI / 2);
  f.lineTo(x0 + k, z1); f.absarc(x0 + k, z1 - k, k, Math.PI / 2, Math.PI);
  f.lineTo(x0, z0 + k); f.absarc(x0 + k, z0 + k, k, Math.PI, Math.PI * 1.5);
  const geo = new THREE.ExtrudeGeometry(f, { depth: espessura, bevelEnabled: false, curveSegments: 12 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y - espessura, 0);
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

/** Material do chao por cor e textura (o mesmo cache das faixas). */
export function materialChao(cor, tex = null, extra = {}) {
  return mat(cor, extra, tex);
}
