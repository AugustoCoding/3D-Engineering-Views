import * as THREE from 'three';
import { perfilTampo, alturaTampo } from './profiles.js';
import { MAT } from '../core/materials.js';

const SEG = 96; // segmentos de revolucao — 96 deixa o cilindro visualmente liso

/**
 * ===========================================================================
 *  COSTADO DE VASO DE PRESSAO  (casca com espessura real)
 * ===========================================================================
 *
 *  O perfil percorre um circuito fechado:
 *
 *      apice inf. ext -> tampo inf. ext -> costado ext -> tampo sup. ext
 *      -> apice sup. -> tampo sup. int -> costado int -> tampo inf. int
 *
 *  Fechar o circuito e o que da PAREDE COM ESPESSURA. Sem isso, cortar o
 *  vaso em secao mostraria uma casca infinitamente fina (errado, e feio).
 *
 *  Origem local do vaso:  y = 0 na LINHA DE TANGENCIA INFERIOR.
 *  O tampo inferior ocupa y < 0.
 */
export function criarCostado(g) {
  const R = g.Di / 2 + g.espessura; // raio EXTERNO
  const Ri = g.Di / 2;              // raio INTERNO
  const t = g.espessura;
  const aba = g.abaReta ?? 0;

  const hFundo = alturaTampo(g.tampoFundo, R);
  const hTopo = alturaTampo(g.tampoTopo, R);

  const pts = [];

  // --- 1. tampo inferior, superficie EXTERNA (apice -> tangencia) ---
  const fundoExt = perfilTampo(g.tampoFundo, R, { inset: 0 });
  for (let i = fundoExt.length - 1; i >= 0; i--) {
    pts.push(new THREE.Vector2(fundoExt[i].x, -fundoExt[i].y - aba));
  }

  // --- 2. costado, superficie EXTERNA (sobe) ---
  pts.push(new THREE.Vector2(R, -aba));
  pts.push(new THREE.Vector2(R, g.Ltan + aba));

  // --- 3. tampo superior, superficie EXTERNA (tangencia -> apice) ---
  const topoExt = perfilTampo(g.tampoTopo, R, { inset: 0 });
  for (const p of topoExt) {
    pts.push(new THREE.Vector2(p.x, p.y + g.Ltan + aba));
  }

  // --- 4. tampo superior, superficie INTERNA (apice -> tangencia) ---
  const topoInt = perfilTampo(g.tampoTopo, R, { inset: t });
  for (let i = topoInt.length - 1; i >= 0; i--) {
    pts.push(new THREE.Vector2(topoInt[i].x, topoInt[i].y + g.Ltan + aba));
  }

  // --- 5. costado, superficie INTERNA (desce) ---
  pts.push(new THREE.Vector2(Ri, g.Ltan + aba));
  pts.push(new THREE.Vector2(Ri, -aba));

  // --- 6. tampo inferior, superficie INTERNA (tangencia -> apice) ---
  const fundoInt = perfilTampo(g.tampoFundo, R, { inset: t });
  for (const p of fundoInt) {
    pts.push(new THREE.Vector2(p.x, -p.y - aba));
  }

  const geo = new THREE.LatheGeometry(pts, SEG);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, MAT.inox);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'costado';

  return {
    mesh,
    R, Ri, t,
    hFundo: hFundo + aba,
    hTopo: hTopo + aba,
    topoY: g.Ltan + aba + hTopo,
    fundoY: -aba - hFundo,
    alturaTotal: g.Ltan + 2 * aba + hTopo + hFundo,
  };
}

/* ===========================================================================
 *  VOLUME INTERNO  —  integracao pelo metodo dos discos
 * ===========================================================================
 *  Em vez de o nivel de liquido ser um numero digitado na mao, ele e DERIVADO
 *  do volume util pela geometria real do vaso (incluindo a curvatura do tampo
 *  inferior). Assim, se o diametro ou o tipo de tampo mudar, o nivel se
 *  recalcula sozinho e continua correspondendo ao volume declarado.
 * ======================================================================== */

/** Interpola o raio do perfil de tampo a uma profundidade `h` da tangencia. */
function raioEmAltura(perfil, h) {
  if (h <= 0) return perfil[0].x;
  const hMax = perfil[perfil.length - 1].y;
  if (h >= hMax) return 0;
  for (let i = 0; i < perfil.length - 1; i++) {
    const a = perfil[i], b = perfil[i + 1];
    if (h >= a.y && h <= b.y) {
      const f = b.y === a.y ? 0 : (h - a.y) / (b.y - a.y);
      return a.x + f * (b.x - a.x);
    }
  }
  return 0;
}

/** Geometria interna do vaso, pronta para integrar. */
function envelopeInterno(g) {
  const Ri = g.Di / 2;
  const esp = g.espessura;
  const aba = g.abaReta ?? 0;
  const pFundo = perfilTampo(g.tampoFundo, Ri + esp, { inset: esp, seg: 48 });
  const pTopo = perfilTampo(g.tampoTopo, Ri + esp, { inset: esp, seg: 48 });
  const hFundo = pFundo[pFundo.length - 1].y;
  const hTopo = pTopo[pTopo.length - 1].y;

  return {
    yBase: -aba - hFundo,
    yTopo: g.Ltan + aba + hTopo,
    raio(y) {
      if (y >= -aba && y <= g.Ltan + aba) return Ri;
      if (y < -aba) return raioEmAltura(pFundo, -aba - y);
      return raioEmAltura(pTopo, y - (g.Ltan + aba));
    },
  };
}

/** Volume interno acumulado do fundo ate a altura `y` (m3). */
export function volumeInterno(g, y, N = 800) {
  const env = envelopeInterno(g);
  const fim = Math.min(y, env.yTopo);
  if (fim <= env.yBase) return 0;
  const dy = (fim - env.yBase) / N;
  let V = 0;
  for (let i = 0; i < N; i++) {
    const r = env.raio(env.yBase + (i + 0.5) * dy);
    V += Math.PI * r * r * dy;
  }
  return V;
}

/** Volume interno total do vaso (m3). */
export function volumeTotalInterno(g) {
  return volumeInterno(g, envelopeInterno(g).yTopo);
}

/** Altura de liquido que corresponde a um volume dado — por bisseccao. */
export function nivelParaVolume(g, alvo) {
  const env = envelopeInterno(g);
  let lo = env.yBase, hi = env.yTopo;
  for (let i = 0; i < 60; i++) {
    const meio = (lo + hi) / 2;
    if (volumeInterno(g, meio) < alvo) lo = meio; else hi = meio;
  }
  return (lo + hi) / 2;
}

/**
 * Nivel de liquido de um vaso HORIZONTAL, medido a partir do fundo.
 *
 *   costado: L · [ R²·acos((R−h)/R) − (R−h)·sqrt(2Rh−h²) ]   (segmento circular)
 *   tampos : (b/R)·(pi/3)·h²·(3R−h)   — os dois meio-elipsoides somados
 *
 * A formula do costado e a area do segmento circular vezes o comprimento; a
 * dos tampos e o analogo elipsoidal da calota esferica.
 */
export function nivelHorizontal(g, alvo) {
  const Ri = g.Di / 2;
  const b = Ri / 2;                       // semi-eixo axial do tampo 2:1
  const L = g.Ltan + 2 * (g.abaReta ?? 0);
  const vol = (h) => {
    if (h <= 0) return 0;
    const hh = Math.min(h, 2 * Ri);
    const d = Ri - hh;
    const A = Ri * Ri * Math.acos(Math.max(-1, Math.min(1, d / Ri)))
      - d * Math.sqrt(Math.max(0, 2 * Ri * hh - hh * hh));
    return L * A + (b / Ri) * (Math.PI / 3) * hh * hh * (3 * Ri - hh);
  };
  let lo = 0, hi = 2 * Ri;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (vol(m) < alvo) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Nivel de liquido de QUALQUER vaso, escolhendo o solver pela orientacao.
 *
 *  Existe para que croqui, datasheet e maquete nao possam divergir: antes o
 *  calculo estava duplicado, e o datasheet do V-02 chegou a reportar o nivel
 *  vertical (0,84 m) de um vaso deitado cujo nivel real e 0,29 m.
 *
 *  Vertical  -> altura acima da linha de tangencia inferior.
 *  Horizontal-> altura acima do fundo do costado.
 */
export function nivelDeVolume(g, alvo) {
  return g.orientacao === 'horizontal'
    ? nivelHorizontal(g, alvo)
    : nivelParaVolume(g, alvo);
}

/**
 * Camada de isolamento termico — mesma geometria do costado, "inflada" pela
 * espessura do isolamento. Opaca (a chapa de aluminio de campo); a camada se
 * desliga no painel de exibicao.
 *
 * `semFaixa: [y0, y1]` deixa uma faixa do costado descoberta — a de uma
 * camisa de resfriamento, cuja parede ja fica na temperatura da agua e nao
 * precisa (nem deve) ser isolada. Sai entao um grupo com as duas partes.
 */
export function criarIsolamento(g, esp, { semFaixa = null } = {}) {
  const R = g.Di / 2 + g.espessura + esp;
  const aba = g.abaReta ?? 0;

  const fundo = [];
  const pf = perfilTampo(g.tampoFundo, R, { inset: 0 });
  for (let i = pf.length - 1; i >= 0; i--) {
    fundo.push(new THREE.Vector2(pf[i].x, -pf[i].y - aba));
  }
  const topo = perfilTampo(g.tampoTopo, R, { inset: 0 })
    .map((p) => new THREE.Vector2(p.x, p.y + g.Ltan + aba));

  const malha = (pts) => {
    const geo = new THREE.LatheGeometry(pts, SEG);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, MAT.isolamento);
    m.name = 'isolamento';
    return m;
  };

  if (!semFaixa) {
    return malha([...fundo, new THREE.Vector2(R, -aba), new THREE.Vector2(R, g.Ltan + aba), ...topo]);
  }
  const [y0, y1] = semFaixa;
  const grupo = new THREE.Group();
  grupo.add(malha([...fundo, new THREE.Vector2(R, -aba), new THREE.Vector2(R, y0)]));
  grupo.add(malha([new THREE.Vector2(R, y1), new THREE.Vector2(R, g.Ltan + aba), ...topo]));
  return grupo;
}

/**
 * Camisa de troca termica: parede externa e aneis de fechamento soldados ao
 * costado, com o vao anular aberto — no corte aparece o canal da agua.
 *
 *   R      raio externo do costado
 *   base   inicio da camisa, a partir da tangencia inferior
 *   folga  largura do vao anular
 */
export function criarCamisa({ R, base, altura, folga, esp = 0.008 }) {
  const rExt = R + folga + esp;
  const topo = base + altura;
  const pts = [
    new THREE.Vector2(R, base),
    new THREE.Vector2(rExt, base),
    new THREE.Vector2(rExt, topo),
    new THREE.Vector2(R, topo),
    new THREE.Vector2(R, topo - esp),
    new THREE.Vector2(rExt - esp, topo - esp),
    new THREE.Vector2(rExt - esp, base + esp),
    new THREE.Vector2(R, base + esp),
    new THREE.Vector2(R, base),
  ];
  const geo = new THREE.LatheGeometry(pts, SEG);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT.acoCarbono);
  mesh.name = 'camisa';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Camada de liquido de um vaso HORIZONTAL, entre duas alturas medidas a partir
 * do fundo. E um segmento circular extrudado ao longo do eixo.
 *
 * Serve para mostrar as DUAS fases do decantador: chamando duas vezes, com
 * materiais diferentes, a interface agua/organico aparece sozinha.
 *
 * Origem local: y = 0 no eixo do vaso, z = 0 no meio do comprimento.
 */
export function criarLiquidoHorizontal(g, hDe, hAte, material, seg = 40) {
  const Ri = g.Di / 2 - 0.004;                 // recuo para nao brigar com a parede
  const L = g.Ltan + 2 * (g.abaReta ?? 0);
  const y1 = Math.max(-Ri, hDe - g.Di / 2);
  const y2 = Math.min(Ri, hAte - g.Di / 2);
  if (y2 <= y1) return null;

  const ang = (y) => Math.asin(THREE.MathUtils.clamp(y / Ri, -1, 1));
  const t1 = ang(y1), t2 = ang(y2);

  const forma = new THREE.Shape();
  forma.moveTo(-Ri * Math.cos(t1), y1);
  forma.lineTo(Ri * Math.cos(t1), y1);
  for (let i = 1; i <= seg; i++) {             // lado direito, subindo
    const t = t1 + (i / seg) * (t2 - t1);
    forma.lineTo(Ri * Math.cos(t), Ri * Math.sin(t));
  }
  forma.lineTo(-Ri * Math.cos(t2), y2);
  for (let i = 1; i <= seg; i++) {             // lado esquerdo, descendo
    const t = t2 - (i / seg) * (t2 - t1);
    forma.lineTo(-Ri * Math.cos(t), Ri * Math.sin(t));
  }
  forma.closePath();

  const geo = new THREE.ExtrudeGeometry(forma, { depth: L, bevelEnabled: false });
  geo.translate(0, 0, -L / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'liquido-horizontal';
  return mesh;
}

/**
 * Volume de liquido — so aparece quando o corte esta ligado. E o que faz o
 * modelo "explicar" o processo em vez de so mostrar uma casca de metal.
 */
export function criarLiquido(g, nivel) {
  const Ri = g.Di / 2;
  const aba = g.abaReta ?? 0;
  const folga = 0.004; // recuo para nao brigar com a parede (z-fighting)
  const r = Ri - folga;

  const pts = [];
  const fundo = perfilTampo(g.tampoFundo, Ri - folga, { inset: 0 });
  for (let i = fundo.length - 1; i >= 0; i--) {
    pts.push(new THREE.Vector2(fundo[i].x, -fundo[i].y - aba));
  }
  pts.push(new THREE.Vector2(r, -aba));
  pts.push(new THREE.Vector2(r, nivel));
  pts.push(new THREE.Vector2(0, nivel)); // superficie livre do liquido

  const geo = new THREE.LatheGeometry(pts, SEG);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT.liquido);
  mesh.name = 'liquido';
  return mesh;
}
