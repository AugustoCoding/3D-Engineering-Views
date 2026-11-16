/**
 * ============================================================================
 *  CROQUI  —  SVG A4 retrato, duas vistas
 * ============================================================================
 *
 *    node geracao-de-documentos/gerar-croqui.mjs R-01     (vaso vertical)
 *    node geracao-de-documentos/gerar-croqui.mjs V-02     (vaso horizontal)
 *
 *  O desenho e projetado a partir de src/data/plant.js, usando o mesmo perfil
 *  de tampo (src/lib/profiles.js) da maquete 3D. Nenhum numero e digitado aqui.
 *
 *  DUAS ORIENTACOES:
 *    vertical   -> VISTA FRONTAL e VISTA LATERAL (duas elevacoes a 90 graus).
 *                  Cada bocal e projetado pela sua posicao angular; um bocal
 *                  que aponta para o observador nao e desenhado naquela vista.
 *    horizontal -> VISTA LONGITUDINAL e VISTA TRANSVERSAL, que e o par usual
 *                  de um tambor deitado: o comprimento numa, a secao na outra.
 *
 *  GENERICO: cada elemento so e desenhado se o equipamento tiver o dado
 *  correspondente. Um vaso sem agitador nao declara `agitador`, e o croqui sai
 *  sem acionamento — sem `if` espalhado por quem cadastra equipamento.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EQUIPAMENTOS, DN } from '../src/data/plant.js';
import { perfilTampo } from '../src/lib/profiles.js';
import { nivelDeVolume } from '../src/lib/vessel.js';
import { IDENT } from './identificacao.js';

const aqui = dirname(fileURLToPath(import.meta.url));

/* ==========================================================================
 *  Equipamento
 * ======================================================================= */
const args = process.argv.slice(2);

/**
 * Croqui LIMPO, sem cotas.
 *
 * Nem toda folha serve para a mesma coisa. A cotada e o documento de
 * fabricacao; a limpa serve para apresentacao, para o P&I e para o relatorio,
 * onde a linha de cota so disputa espaco com o desenho. Sao a MESMA geometria,
 * gerada do mesmo dado — nao ha versao que possa envelhecer sozinha.
 */
const SEM_COTAS = args.includes('--sem-cotas');

const TAG = args.find((a) => !a.startsWith('--')) || 'R-01';
const EQ = EQUIPAMENTOS[TAG];
if (!EQ) {
  console.error(`Equipamento "${TAG}" nao existe em src/data/plant.js.`);
  console.error(`Disponiveis: ${Object.keys(EQUIPAMENTOS).join(', ')}`);
  process.exit(1);
}
const g = EQ.geom;
const HORIZ = g.orientacao === 'horizontal';

/** Bocais desenhados: processo e boca de visita. Instrumentacao fica fora. */
const BOCAIS = EQ.bocais.filter((b) => !b.instrumento);

/* ==========================================================================
 *  Folha
 * ======================================================================= */
const FOLHA = { L: 210, A: 297 };
const MARGEM = 8;
const CARIMBO_A = 32;
const LEGENDA_A = 8 + Math.ceil(BOCAIS.length / 2) * 3.2 + 8;
const Y_PISO_BASE = FOLHA.A - CARIMBO_A - MARGEM - 13;
const Y_TETO = MARGEM + LEGENDA_A;
const ALTURA_DISP = Y_PISO_BASE - Y_TETO - 6;

/* ==========================================================================
 *  Geometria derivada
 * ======================================================================= */
const R = g.Di / 2 + g.espessura;
const ISO = g.isolamento ?? 0;
const Riso = R + ISO;
const ABA = g.abaReta ?? 0;
const H_TAMPO = perfilTampo(g.tampoTopo, R).at(-1).y;
const H_TAMPO_F = perfilTampo(g.tampoFundo, R).at(-1).y;

/* --- vertical --- */
const yTopo = g.Ltan + ABA + H_TAMPO;
const yFundo = -ABA - H_TAMPO_F;
const H_MOTOR = g.agitador ? 1.9 : 0;
const H_BOCAL_TOPO = EQ.bocais.some((b) => b.face === 'topo') ? ISO + 0.30 : 0;

/* --- horizontal --- */
const MEIO_COMP = g.Ltan / 2 + ABA + H_TAMPO;      // meia-largura da vista longitudinal
const TOPO_H = (g.alturaEixo ?? 0) + Riso + (EQ.bocais.some((b) => b.face === 'topo') ? 0.30 : 0);

const TOPO_MUNDO = HORIZ ? TOPO_H : g.saiaAltura + yTopo + Math.max(H_MOTOR, H_BOCAL_TOPO);

const MEIA_LARGURA = HORIZ ? MEIO_COMP : Math.max(
  Riso,
  g.plataforma ? Riso + g.plataforma.largura : 0,
  g.camisa ? R + g.camisa.folga : 0,
  g.fundacaoLado / 2,
);

/* ==========================================================================
 *  ESCALA E LAYOUT AUTOMATICOS
 *  Testa as escalas normalizadas e usa a maior em que o equipamento, mais a
 *  faixa reservada as cotas, cabe na folha. Sem isso, R-01 (12 m) e V-02
 *  (2,3 m) precisariam de dois geradores.
 * ======================================================================= */
const ESCALAS = [5, 10, 20, 25, 50, 75, 100, 200, 500];

/* Reservas laterais em mm de papel, a partir da borda do equipamento. Nao sao
 * simetricas: a vista frontal leva as cotas de altura a esquerda e so a da
 * saia a direita. */
/* Sem cotas, a faixa reservada a elas some e o equipamento pode crescer na
 * folha. O que sobra e so o necessario para o rotulo do bocal, que fica do
 * lado de fora do contorno. Por isso as duas versoes costumam sair em escalas
 * diferentes — e o carimbo de cada uma informa a sua. */
const RES = SEM_COTAS
  ? { aEsq: 7, aDir: 5, bEsq: 7, bDir: 7 }
  : (HORIZ
    ? { aEsq: 15, aDir: 8, bEsq: 8, bDir: 12 }
    : { aEsq: 16.5, aDir: 6, bEsq: 13, bDir: 13 });

/* A linha de piso da vista transversal e MAIS LARGA que o vaso: ela vai a
 * Riso x 1,6 de cada lado, mais 2 mm de sobra (ver montarVista). O layout
 * precisa reservar essa largura, senao a linha vaza da moldura. O defeito
 * existia desde sempre e ficava escondido porque a faixa reservada as cotas
 * absorvia a diferenca por acaso; ao gerar a folha sem cotas, apareceu. */
const MEIO_PISO_TRANSV = 1.6;

function tentarLayout(escala) {
  const mm = 1000 / escala;
  if (TOPO_MUNDO * mm + 12 > ALTURA_DISP) return null;

  if (HORIZ) {
    // Vista A = longitudinal (larga) · Vista B = transversal (estreita)
    const hA = MEIO_COMP * mm, hB = Riso * MEIO_PISO_TRANSV * mm + 2;
    const cxA = MARGEM + RES.aEsq + hA;
    const cxB = FOLHA.L - MARGEM - RES.bDir - hB;
    if ((cxB - hB - RES.bEsq) - (cxA + hA + RES.aDir) < 4) return null;
    return { escala, mm, borda: hA, cx: { frontal: cxA, lateral: cxB } };
  }

  const borda = MEIA_LARGURA * mm;
  const cxF = MARGEM + borda + RES.aEsq;
  const cxL = FOLHA.L - MARGEM - borda - RES.bDir;
  if ((cxL - borda - RES.bEsq) - (cxF + borda * 0.62 + RES.aDir) < 4) return null;
  return { escala, mm, borda, cx: { frontal: cxF, lateral: cxL } };
}

const LAYOUT = ESCALAS.map(tentarLayout).find(Boolean)
  ?? { escala: 500, mm: 2, borda: 10, cx: { frontal: 60, lateral: 150 } };

const ESCALA = LAYOUT.escala;
const MM = LAYOUT.mm;
const CX = LAYOUT.cx;
const BORDA = HORIZ ? Riso * MM : MEIA_LARGURA * MM;
const COTA1 = BORDA + 7;
const COTA2 = BORDA + 13.5;

/**
 * Centraliza o desenho na altura util. Um vaso deitado usa pouca altura, e
 * ancorado ao rodape deixava dois tercos da folha em branco no topo.
 * Para vasos verticais, que ja preenchem a folha, a folga e quase nula.
 */
const FOLGA_V = Math.max(0, ALTURA_DISP - (TOPO_MUNDO * MM + 12));
const Y_PISO = Y_PISO_BASE - FOLGA_V / 2;

/** Altura do eixo do vaso horizontal, em coordenada de papel. */
const Y_EIXO = Y_PISO - (g.alturaEixo ?? 0) * MM;

const px = (vista, xm) => CX[vista] + xm * MM;
const py = (ym) => Y_PISO - ym * MM;
/** Vertical a partir do eixo, para vaso horizontal. */
const pv = (v) => Y_EIXO - v * MM;

/* ==========================================================================
 *  Primitivas
 * ======================================================================= */
const E = [];
const n = (v) => Number(v.toFixed(3));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (v, d = 2) => v.toFixed(d).replace('.', ',');

const linha = (x1, y1, x2, y2, cls = 'g') =>
  E.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${cls}"/>`);
const ret = (x, y, w, h, cls = 'g') =>
  E.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="${cls}"/>`);
const circ = (cx, cy, r, cls = 'g') =>
  E.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" class="${cls}"/>`);
const caminho = (d, cls = 'g') => E.push(`<path d="${d}" class="${cls}"/>`);
const texto = (x, y, t, cls = 'txt', extra = '') =>
  E.push(`<text x="${n(x)}" y="${n(y)}" class="${cls}" ${extra}>${esc(t)}</text>`);

/* ==========================================================================
 *  Cotas
 * ======================================================================= */
function cotaV(x, pa, pb, rotulo) {
  linha(x, pa, x, pb, 'cota');
  for (const p of [pa, pb]) {
    const s = p === pa ? 1 : -1;
    caminho(`M${n(x)},${n(p)} l-1,${n(1.9 * s)} l2,0 z`, 'seta');
  }
  const ym = (pa + pb) / 2;
  texto(x - 1.6, ym, rotulo, 'cotatxt',
    `transform="rotate(-90 ${n(x - 1.6)} ${n(ym)})" text-anchor="middle"`);
}

function cotaH(y, xa, xb, rotulo) {
  linha(xa, y, xb, y, 'cota');
  for (const x of [xa, xb]) {
    const s = x === xa ? 1 : -1;
    caminho(`M${n(x)},${n(y)} l${n(1.9 * s)},-1 l0,2 z`, 'seta');
  }
  texto((xa + xb) / 2, y - 1.4, rotulo, 'cotatxt', 'text-anchor="middle"');
}

/** Linha de chamada: do ponto cotado ate um pouco alem da linha de cota. */
function chamadaH(xObj, xCota, y) {
  const dir = Math.sign(xCota - xObj) || 1;
  linha(xObj + dir * 1.0, y, xCota + dir * 1.6, y, 'chamada');
}
function chamadaV(x, yObj, yCota) {
  const dir = Math.sign(yCota - yObj) || 1;
  linha(x, yObj + dir * 1.0, x, yCota + dir * 1.6, 'chamada');
}

/* ==========================================================================
/* ==========================================================================
 *  NIVEIS DE LIQUIDO
 *  Calculados em src/lib/vessel.js, o mesmo modulo que a maquete 3D usa.
 *  Ficavam duplicados aqui, e a copia do datasheet chegou a reportar o nivel
 *  vertical de um vaso deitado. Fonte unica resolve a classe do problema.
 * ======================================================================= */
const NIVEL = g.volumeUtil ? nivelDeVolume(g, g.volumeUtil) : null;
const INTERFACE = g.volumeFasePesada ? nivelDeVolume(g, g.volumeFasePesada) : null;

/* ==========================================================================
 *  DESENHO — VASO VERTICAL
 * ======================================================================= */
function silhuetaV(raio) {
  const pts = [];
  const pf = perfilTampo(g.tampoFundo, raio);
  for (let i = pf.length - 1; i >= 0; i--) pts.push([pf[i].x, -pf[i].y - ABA]);
  pts.push([raio, -ABA], [raio, g.Ltan + ABA]);
  for (const p of perfilTampo(g.tampoTopo, raio)) pts.push([p.x, p.y + g.Ltan + ABA]);
  return pts;
}

function cascoV(vista, raio, cls) {
  const pts = silhuetaV(raio);
  for (const s of [1, -1]) {
    caminho(pts.map(([x, y], i) =>
      `${i ? 'L' : 'M'}${n(px(vista, s * x))},${n(py(y + g.saiaAltura))}`).join(''), cls);
  }
}

function fundacaoV(vista) {
  const w = g.fundacaoLado * MM, h = g.fundacaoAltura * MM;
  const x = px(vista, -g.fundacaoLado / 2), y = py(0);
  ret(x, y, w, h, 'g');
  for (let i = 1; i < 7; i++) {
    const xx = x + (i * w) / 7;
    linha(xx, y + h, Math.min(xx + h, x + w), y + h - Math.min(h, x + w - xx), 'hach');
  }
}

function saiaV(vista) {
  const rs = R * 0.995;
  const yTop = py(g.saiaAltura + yFundo * 0.35);
  const yBase = py(g.fundacaoAltura);
  for (const s of [-1, 1]) linha(px(vista, s * rs), yBase, px(vista, s * rs), yTop, 'g');
  const lb = g.baseAnelLargura * MM;
  ret(px(vista, -rs) - lb / 2, yBase - 1.2, 2 * rs * MM + lb, 1.2, 'g');
  const aw = Math.min(0.7, g.Di * 0.35) * MM, ah = Math.min(1.1, g.saiaAltura * 0.5) * MM;
  const xa = px(vista, 0) - aw / 2, ya = py(g.fundacaoAltura + 0.25) - ah;
  caminho(`M${n(xa)},${n(ya + ah)} L${n(xa)},${n(ya + ah * 0.35)} `
    + `A ${n(aw / 2)} ${n(aw / 2)} 0 0 1 ${n(xa + aw)},${n(ya + ah * 0.35)} `
    + `L${n(xa + aw)},${n(ya + ah)}`, 'g');
}

function agitadorV(vista) {
  if (!g.agitador) return;
  const cx = px(vista, 0), yF = py(g.saiaAltura + yTopo);
  const wRed = 0.62 * MM, hRed = 0.52 * MM, wMot = 0.46 * MM, hMot = 0.92 * MM;
  ret(cx - 0.20 * MM, yF - 0.18 * MM, 0.40 * MM, 0.18 * MM, 'g');
  ret(cx - wRed / 2, yF - 0.18 * MM - hRed, wRed, hRed, 'g');
  ret(cx - wMot / 2, yF - 0.18 * MM - hRed - hMot, wMot, hMot, 'g');
}

/**
 * Camisa de troca termica, em corte.
 *
 * Desenhada como o anel que ela e: duas faixas verticais rentes ao costado,
 * fechadas em cima e embaixo. Nao e enfeite — num cristalizador encamisado a
 * camisa E o trocador de calor, e a altura dela sai da area de troca do
 * dimensionamento (A = pi x D x altura). Sem ela no croqui, o desenho de um
 * CR-01 ficaria indistinguivel do de um tanque qualquer.
 */
function camisaV(vista) {
  if (!g.camisa) return;
  const c = g.camisa;
  const yBase = py(g.saiaAltura + c.base);
  const yTopoC = py(g.saiaAltura + c.base + c.altura);
  for (const s of [-1, 1]) {
    const xi = px(vista, s * R);
    const xo = px(vista, s * (R + c.folga));
    linha(xo, yBase, xo, yTopoC, 'g');
    linha(xi, yBase, xo, yBase, 'g');
    linha(xi, yTopoC, xo, yTopoC, 'g');
  }
}

function demisterV(vista) {
  if (!g.demister) return;
  const d = g.demister;
  const y0 = py(g.saiaAltura + g.Ltan + ABA - d.abaixoDoTopo);
  const h = d.espessura * MM;
  const x0 = px(vista, -g.Di / 2), x1 = px(vista, g.Di / 2);
  ret(x0, y0, x1 - x0, h, 'fina');
  for (let x = x0 + 1.2; x < x1; x += 1.2) linha(x, y0 + h, x + h, y0, 'hach');
}

function plataformaV(vista) {
  if (!g.plataforma) return;
  const p = g.plataforma;
  const y = py(g.saiaAltura + p.elevacao), hg = p.guardaCorpo * MM;
  for (const s of [-1, 1]) {
    const xi = px(vista, s * Riso), xo = px(vista, s * (Riso + p.largura));
    linha(xi, y, xo, y, 'g');
    linha(xi, y + 0.7, xo, y + 0.7, 'fina');
    linha(xi, y - hg, xo, y - hg, 'fina');
    for (const f of [0.34, 0.67, 1.0]) {
      const xm = xi + (xo - xi) * f;
      linha(xm, y, xm, y - hg, 'fina');
    }
  }
}

/* ==========================================================================
 *  DESENHO — VASO HORIZONTAL
 * ======================================================================= */

/** Contorno longitudinal: tampo esquerdo, costado, tampo direito. */
function cascoH(raio) {
  const cx = px('frontal', 0);
  const meio = g.Ltan / 2;
  const pe = perfilTampo(g.tampoFundo, raio);
  const pd = perfilTampo(g.tampoTopo, raio);
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = pe.length - 1; i >= 0; i--) pts.push([-meio - ABA - pe[i].y, s * pe[i].x]);
    pts.push([-meio - ABA, s * raio], [meio + ABA, s * raio]);
    for (const p of pd) pts.push([meio + ABA + p.y, s * p.x]);
    caminho(pts.map(([u, v], i) => `${i ? 'L' : 'M'}${n(cx + u * MM)},${n(pv(v))}`).join(''), 'g');
  }
  // linhas de tangencia dos tampos
  for (const s of [-1, 1]) {
    linha(cx + s * (meio + ABA) * MM, pv(raio), cx + s * (meio + ABA) * MM, pv(-raio), 'leve');
  }
}

/** Berços de sustentação, na vista longitudinal. */
function bercosH() {
  if (!g.bercos) return;
  const cx = px('frontal', 0), meio = g.Ltan / 2;
  const w = g.bercos.largura * MM;
  const yTopoB = pv(-R * 0.75);
  const yBase = py(g.fundacaoAltura);
  for (const s of [-1, 1]) {
    const u = s * (meio - g.bercos.fracao * g.Ltan);
    const x = cx + u * MM;
    linha(x - w / 2, yTopoB, x - w / 2, yBase, 'g');
    linha(x + w / 2, yTopoB, x + w / 2, yBase, 'g');
    linha(x - w / 2, yBase, x + w / 2, yBase, 'g');
    // bloco de concreto
    const wf = g.fundacaoLargura * MM, hf = g.fundacaoAltura * MM;
    ret(x - wf / 2, py(0), wf, hf, 'g');
    for (let i = 1; i < 4; i++) {
      const xx = x - wf / 2 + (i * wf) / 4;
      linha(xx, py(0) + hf, Math.min(xx + hf, x + wf / 2), py(0) + hf - Math.min(hf, x + wf / 2 - xx), 'hach');
    }
  }
}

/** Berço na vista transversal: abraça a parte inferior do costado. */
function bercoTransversal() {
  if (!g.bercos) return;
  const cx = px('lateral', 0);
  const a = Math.PI / 3;                          // contato de ~120 graus
  const yBase = py(g.fundacaoAltura);
  for (const s of [-1, 1]) {
    const xTop = cx + s * R * Math.sin(a) * MM;
    const yTop = pv(-R * Math.cos(a));
    linha(xTop, yTop, xTop, yBase, 'g');
  }
  linha(cx - R * Math.sin(a) * MM, yBase, cx + R * Math.sin(a) * MM, yBase, 'g');
  const wf = g.fundacaoLargura * 2.2 * MM, hf = g.fundacaoAltura * MM;
  ret(cx - wf / 2, py(0), wf, hf, 'g');
  for (let i = 1; i < 6; i++) {
    const xx = cx - wf / 2 + (i * wf) / 6;
    linha(xx, py(0) + hf, Math.min(xx + hf, cx + wf / 2), py(0) + hf - Math.min(hf, cx + wf / 2 - xx), 'hach');
  }
}

/** Niveis de liquido e de interface, medidos a partir do fundo do vaso. */
function niveisH(vista) {
  const Ri = g.Di / 2;
  const desenhar = (h, cls) => {
    if (h === null || h <= 0) return;
    const v = h - Ri;                             // altura relativa ao eixo
    const meia = Math.sqrt(Math.max(0, Ri * Ri - v * v));
    if (vista === 'frontal') {
      linha(px(vista, -g.Ltan / 2 - ABA), pv(v), px(vista, g.Ltan / 2 + ABA), pv(v), cls);
    } else {
      linha(px(vista, -meia), pv(v), px(vista, meia), pv(v), cls);
    }
  };
  desenhar(NIVEL, 'nivel');
  desenhar(INTERFACE, 'interface');
}

/* ==========================================================================
 *  BOCAIS
 * ======================================================================= */
let axiaisDesenhados = [];

/** Vaso vertical, bocal radial no costado. */
function bocalLateralV(vista, b) {
  const a = (b.ang * Math.PI) / 180;
  const comp = vista === 'frontal' ? Math.cos(a) : Math.sin(a);
  const encurt = Math.abs(comp);
  if (encurt < 0.25) return null;
  const d = DN[b.dn];
  const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;
  const visita = b.dn >= 500;
  const sai = comp >= 0 ? 1 : -1;
  const yb = py(b.y + g.saiaAltura);
  const x0 = px(vista, sai * R * encurt);
  const x1 = x0 + sai * (ISO + (visita ? 0.22 : 0.16)) * MM * encurt;
  linha(x0, yb - rT, x1, yb - rT, 'g');
  linha(x0, yb + rT, x1, yb + rT, 'g');
  ret(sai > 0 ? x1 : x1 - eF, yb - rF, eF, rF * 2, 'g');
  if (visita) ret(sai > 0 ? x1 + eF : x1 - 2 * eF, yb - rF, eF, rF * 2, 'g');
  return { x: x1 + sai * eF * (visita ? 2 : 1), y: yb, sai };
}

/** Vaso vertical, bocal de tampo. */
function bocalAxialV(vista, b, ehTopo) {
  const a = (b.ang * Math.PI) / 180;
  const r = b.r ?? 0;
  const xm = vista === 'frontal' ? r * Math.cos(a) : r * Math.sin(a);
  const d = DN[b.dn];
  const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;
  // Dois bocais de tampo podem se projetar quase no mesmo ponto desta vista
  // mesmo estando separados no equipamento; desenhar os dois sobrepostos
  // produz um bocal so com duas etiquetas.
  const colide = axiaisDesenhados.some((o) => o.ehTopo === ehTopo
    && Math.abs(o.x - px(vista, xm)) < o.rF + rF);
  if (colide) return null;
  axiaisDesenhados.push({ x: px(vista, xm), rF, ehTopo });

  const pf = perfilTampo(ehTopo ? g.tampoTopo : g.tampoFundo, R);
  let ys = pf.at(-1).y;
  for (let i = 0; i < pf.length - 1; i++) {
    const A = pf[i], B = pf[i + 1];
    if (Math.abs(xm) <= A.x && Math.abs(xm) >= B.x) {
      const f = A.x === B.x ? 0 : (A.x - Math.abs(xm)) / (A.x - B.x);
      ys = A.y + f * (B.y - A.y);
      break;
    }
  }
  const base = ehTopo ? g.Ltan + ABA + ys : -ABA - ys;
  const s = ehTopo ? -1 : 1;
  const x = px(vista, xm), y0 = py(base + g.saiaAltura), y1 = y0 + s * (ISO + 0.24) * MM;
  linha(x - rT, y0, x - rT, y1, 'g');
  linha(x + rT, y0, x + rT, y1, 'g');
  ret(x - rF, s < 0 ? y1 - eF : y1, rF * 2, eF, 'g');
  return { x, y: y1 + s * eF, s };
}

/** Vaso horizontal: bocal no topo ou no fundo do costado. */
function bocalRadialH(vista, b) {
  const d = DN[b.dn];
  const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;
  const ehTopo = b.face === 'topo';
  const s = ehTopo ? -1 : 1;                        // no papel, para cima e -y
  const u = (b.u ?? g.Ltan / 2) - g.Ltan / 2;
  const x = vista === 'frontal' ? px(vista, u) : px(vista, 0);

  // Na transversal, bocais de topo (ou de fundo) em posicoes diferentes ao
  // longo do eixo caem todos no mesmo ponto: desenha-se so o primeiro.
  if (vista === 'lateral') {
    const colide = axiaisDesenhados.some((o) => o.ehTopo === ehTopo);
    if (colide) return null;
    axiaisDesenhados.push({ x, rF, ehTopo });
  }

  const y0 = pv(ehTopo ? R : -R);
  const y1 = y0 + s * (ISO + 0.22) * MM;
  linha(x - rT, y0, x - rT, y1, 'g');
  linha(x + rT, y0, x + rT, y1, 'g');
  ret(x - rF, s < 0 ? y1 - eF : y1, rF * 2, eF, 'g');
  return { x, y: y1 + s * eF, s };
}

/** Vaso horizontal: bocal num dos tampos (aponta ao longo do eixo). */
function bocalTampoH(vista, b) {
  const dir = b.face === 'tampo-dir' ? 1 : -1;
  const v = b.v ?? 0;
  // Na transversal esse bocal aponta para o observador: nao se desenha.
  if (vista === 'lateral') return null;
  const d = DN[b.dn];
  const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;

  const pf = perfilTampo(dir > 0 ? g.tampoTopo : g.tampoFundo, R);
  let uSup = pf.at(-1).y;
  for (let i = 0; i < pf.length - 1; i++) {
    const A = pf[i], B = pf[i + 1];
    if (Math.abs(v) <= A.x && Math.abs(v) >= B.x) {
      const f = A.x === B.x ? 0 : (A.x - Math.abs(v)) / (A.x - B.x);
      uSup = A.y + f * (B.y - A.y);
      break;
    }
  }
  const u0 = dir * (g.Ltan / 2 + ABA + uSup);
  const x0 = px('frontal', u0), x1 = x0 + dir * (ISO + 0.22) * MM;
  const y = pv(v);
  linha(x0, y - rT, x1, y - rT, 'g');
  linha(x0, y + rT, x1, y + rT, 'g');
  ret(dir > 0 ? x1 : x1 - eF, y - rF, eF, rF * 2, 'g');
  return { x: x1 + dir * eF, y, sai: dir };
}

/* ==========================================================================
 *  MONTAGEM DAS VISTAS
 * ======================================================================= */
function desenharBocais(vista) {
  const marcas = [];
  for (const b of BOCAIS) {
    let r;
    if (HORIZ) {
      r = b.face.startsWith('tampo') ? bocalTampoH(vista, b) : bocalRadialH(vista, b);
    } else if (b.face === 'lateral') {
      r = bocalLateralV(vista, b);
    } else {
      r = bocalAxialV(vista, b, b.face === 'topo');
    }
    if (!r) continue;
    let dx = r.sai !== undefined ? r.sai * 2.6 : 0;
    let dy = r.s !== undefined ? r.s * 3.2 : -1.6;
    if (r.s !== undefined) {
      let nv = 0;
      while (marcas.some((m) => m.n === nv && Math.abs(m.x - r.x) < 7)) nv++;
      marcas.push({ x: r.x, n: nv });
      dy += r.s * nv * 3.4;
    }
    texto(r.x + dx, r.y + dy, b.id, 'bocal',
      `text-anchor="${r.sai === -1 ? 'end' : r.sai === 1 ? 'start' : 'middle'}"`);
  }
}

function montarVista(vista, titulo) {
  axiaisDesenhados = [];

  if (HORIZ) {
    if (vista === 'frontal') {
      bercosH();
      cascoH(R);
      if (ISO > 0) cascoH(Riso);
      linha(px(vista, -MEIO_COMP - 0.1), Y_EIXO, px(vista, MEIO_COMP + 0.1), Y_EIXO, 'centro');
    } else {
      bercoTransversal();
      circ(px(vista, 0), Y_EIXO, R * MM, 'g');
      if (ISO > 0) circ(px(vista, 0), Y_EIXO, Riso * MM, 'iso');
      linha(px(vista, -Riso - 0.1), Y_EIXO, px(vista, Riso + 0.1), Y_EIXO, 'centro');
      linha(px(vista, 0), pv(Riso + 0.1), px(vista, 0), pv(-Riso - 0.1), 'centro');
    }
    niveisH(vista);
  } else {
    fundacaoV(vista);
    saiaV(vista);
    cascoV(vista, R, 'g');
    camisaV(vista);
    if (ISO > 0) cascoV(vista, Riso, 'iso');
    demisterV(vista);
    if (NIVEL !== null && vista === 'lateral') {
      const yl = py(g.saiaAltura + NIVEL);
      linha(px(vista, -g.Di / 2), yl, px(vista, g.Di / 2), yl, 'nivel');
    }
    agitadorV(vista);
    plataformaV(vista);
    linha(px(vista, 0), py(TOPO_MUNDO + 0.4), px(vista, 0), py(-0.4), 'centro');
  }

  desenharBocais(vista);

  // O titulo fica ABAIXO da fundacao, que desce alem da linha de piso.
  const yTitulo = Y_PISO + g.fundacaoAltura * MM + 5.5;
  texto(px(vista, 0), yTitulo, titulo, 'vista', 'text-anchor="middle"');
  const meioPiso = HORIZ
    ? (vista === 'frontal' ? MEIO_COMP : Riso * MEIO_PISO_TRANSV)
    : g.fundacaoLado / 2;
  linha(px(vista, -meioPiso) - 2, py(0), px(vista, meioPiso) + 2, py(0), 'piso');
}

/* ==========================================================================
 *  COTAS POR VISTA
 * ======================================================================= */
function cotasVertical() {
  const v = 'frontal';
  const yTT = g.saiaAltura + g.Ltan;
  const xTT = px(v, 0) - COTA1, xTot = px(v, 0) - COTA2;

  chamadaH(px(v, -R), xTT, py(g.saiaAltura));
  chamadaH(px(v, -R), xTT, py(yTT));
  cotaV(xTT, py(g.saiaAltura), py(yTT), `T/T ${fmt(g.Ltan)} m`);

  chamadaH(px(v, -g.fundacaoLado / 2), xTot, py(0));
  chamadaH(px(v, 0), xTot, py(g.saiaAltura + yTopo));
  cotaV(xTot, py(0), py(g.saiaAltura + yTopo), `Altura total ${fmt(g.saiaAltura + yTopo)} m`);

  const xSaia = px(v, 0) + BORDA * 0.62;
  chamadaH(px(v, g.fundacaoLado / 2), xSaia, py(0));
  chamadaH(px(v, R), xSaia, py(g.saiaAltura));
  cotaV(xSaia, py(0), py(g.saiaAltura), `Saia ${fmt(g.saiaAltura)} m`);

  const yD1 = TOPO_MUNDO + 5 / MM, yD2 = TOPO_MUNDO + 11 / MM;
  chamadaV(px(v, -g.Di / 2), py(yTT), py(yD1));
  chamadaV(px(v, g.Di / 2), py(yTT), py(yD1));
  cotaH(py(yD1), px(v, -g.Di / 2), px(v, g.Di / 2), `Ø int. ${fmt(g.Di)} m`);
  if (ISO > 0) {
    chamadaV(px(v, -Riso), py(yTT), py(yD2));
    chamadaV(px(v, Riso), py(yTT), py(yD2));
    cotaH(py(yD2), px(v, -Riso), px(v, Riso), `Ø ext. c/ isolamento ${fmt(2 * Riso)} m`);
  }

  const L = 'lateral';
  if (NIVEL !== null) {
    const x = px(L, 0) + COTA1;
    chamadaH(px(L, R), x, py(g.saiaAltura));
    chamadaH(px(L, g.Di / 2), x, py(g.saiaAltura + NIVEL));
    cotaV(x, py(g.saiaAltura), py(g.saiaAltura + NIVEL), `Nível ${fmt(NIVEL)} m`);
  }
  if (g.plataforma) {
    const xp = px(L, 0) - COTA1;
    const yPlat = g.saiaAltura + g.plataforma.elevacao;
    chamadaH(px(L, -Riso - g.plataforma.largura), xp, py(yPlat));
    chamadaH(px(L, -g.fundacaoLado / 2), xp, py(0));
    cotaV(xp, py(0), py(yPlat), `Plataforma ${fmt(yPlat)} m`);
  }
  if (g.demister) {
    const xd = px(L, 0) + COTA1;
    const yd = g.saiaAltura + g.Ltan + ABA - g.demister.abaixoDoTopo;
    chamadaH(px(L, g.Di / 2), xd, py(yd));
    chamadaH(px(L, R), xd, py(g.saiaAltura + g.Ltan));
    cotaV(xd, py(yd), py(g.saiaAltura + g.Ltan), `Demister ${fmt(g.demister.abaixoDoTopo)} m`);
  }
}

function cotasHorizontal() {
  const v = 'frontal', Ri = g.Di / 2;
  const meio = g.Ltan / 2;

  // Comprimento T/T e total, acima de TUDO — inclusive dos bocais de topo,
  // que sobem alem do costado e antes recebiam as cotas por cima.
  const y1 = py(TOPO_MUNDO) - 5, y2 = py(TOPO_MUNDO) - 11;
  chamadaV(px(v, -meio), pv(Riso), y1);
  chamadaV(px(v, meio), pv(Riso), y1);
  cotaH(y1, px(v, -meio), px(v, meio), `T/T ${fmt(g.Ltan)} m`);
  chamadaV(px(v, -MEIO_COMP), pv(0), y2);
  chamadaV(px(v, MEIO_COMP), pv(0), y2);
  cotaH(y2, px(v, -MEIO_COMP), px(v, MEIO_COMP), `Comprimento total ${fmt(2 * MEIO_COMP)} m`);

  // Altura do eixo, a esquerda
  const xe = px(v, -MEIO_COMP) - 7;
  chamadaH(px(v, -MEIO_COMP), xe, Y_EIXO);
  chamadaH(px(v, -meio), xe, py(0));
  cotaV(xe, py(0), Y_EIXO, `Eixo ${fmt(g.alturaEixo)} m`);

  // Vista transversal: diametro e niveis
  const L = 'lateral';
  const yd = py(TOPO_MUNDO) - 5;
  chamadaV(px(L, -Ri), pv(0), yd);
  chamadaV(px(L, Ri), pv(0), yd);
  cotaH(yd, px(L, -Ri), px(L, Ri), `Ø int. ${fmt(g.Di)} m`);

  const xn = px(L, 0) + COTA1;
  if (NIVEL !== null) {
    chamadaH(px(L, Ri * 0.5), xn, pv(NIVEL - Ri));
    chamadaH(px(L, 0), xn, pv(-Ri));
    cotaV(xn, pv(-Ri), pv(NIVEL - Ri), `Nível ${fmt(NIVEL)} m`);
  }
  if (INTERFACE !== null) {
    const xi = px(L, 0) - COTA1;
    chamadaH(px(L, -Ri * 0.4), xi, pv(INTERFACE - Ri));
    chamadaH(px(L, 0), xi, pv(-Ri));
    cotaV(xi, pv(-Ri), pv(INTERFACE - Ri), `Interface ${fmt(INTERFACE)} m`);
  }
}

/* ==========================================================================
 *  Logotipo
 * ======================================================================= */
function lerLogo() {
  if (!IDENT.logo) return null;
  const p = join(aqui, IDENT.logo);
  if (!existsSync(p)) {
    console.warn(`    aviso: logo nao encontrado em ${p} — usando texto`);
    return null;
  }
  const buf = readFileSync(p);
  let w = 0, h = 0, mime = 'image/png';
  if (buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) {
    w = buf.readUInt32BE(16); h = buf.readUInt32BE(20);
  } else if (buf[0] === 0xff && buf[1] === 0xd8) {
    mime = 'image/jpeg';
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  if (!w || !h) { w = 16; h = 9; }
  return { data: `data:${mime};base64,${buf.toString('base64')}`, w, h };
}
const LOGO = lerLogo();

/* ==========================================================================
 *  Carimbo e legenda
 * ======================================================================= */
function carimbo() {
  const x = MARGEM, y = FOLHA.A - MARGEM - CARIMBO_A, w = FOLHA.L - 2 * MARGEM, h = CARIMBO_A;
  ret(x, y, w, h, 'quadro');
  const wLogo = 34, wDir = 40;
  linha(x + wLogo, y, x + wLogo, y + h, 'quadro');
  linha(x + w - wDir, y, x + w - wDir, y + h, 'quadro');
  const yb = y + h * 0.58;
  linha(x + wLogo, yb, x + w, yb, 'quadro');

  if (LOGO) {
    const cw = wLogo - 5, ch = h - 8, razao = LOGO.w / LOGO.h;
    let lw = cw, lh = cw / razao;
    if (lh > ch) { lh = ch; lw = ch * razao; }
    const lx = x + (wLogo - lw) / 2, ly = y + (h - lh) / 2;
    ret(lx, ly, lw, lh, 'branco');
    E.push(`<image x="${n(lx)}" y="${n(ly)}" width="${n(lw)}" height="${n(lh)}" `
      + `preserveAspectRatio="xMidYMid meet" href="${LOGO.data}"/>`);
  } else {
    texto(x + wLogo / 2, y + h / 2, IDENT.empresa, 'logo', 'text-anchor="middle"');
  }

  const xc = x + wLogo + (w - wLogo - wDir) / 2;
  texto(xc, y + 5.6, `Projeto: ${IDENT.projeto}`, 'cb', 'text-anchor="middle"');
  texto(xc, y + 10.2, `Localidade: ${IDENT.localidadeCurta ?? IDENT.localidade}`,
    'cb', 'text-anchor="middle"');
  texto(xc, y + 15.4, `Equipamento: ${EQ.nome} — ${EQ.tag}`, 'cbb', 'text-anchor="middle"');

  texto(x + wLogo + 2.5, yb + 4.0, `Desenhado por: ${IDENT.desenhadoPor}`, 'cs');
  texto(x + wLogo + 2.5, yb + 7.9, `Revisado por: ${IDENT.revisadoPor}`, 'cs');
  texto(x + wLogo + 2.5, yb + 11.8, `Aprovado por: ${IDENT.aprovadoPor}`, 'cs');

  const xd = x + w - wDir / 2;
  texto(xd, y + 5.6, `Escala 1:${ESCALA}`, 'cs', 'text-anchor="middle"');
  texto(xd, y + 10.2, SEM_COTAS ? 'Desenho sem cotas' : 'Cotas em metros',
    'cs', 'text-anchor="middle"');
  texto(xd, y + 15.4, `Revisão ${IDENT.revisao}`, 'cs', 'text-anchor="middle"');
  texto(xd, yb + 5.5, 'Data:', 'cbb', 'text-anchor="middle"');
  texto(xd, yb + 10.0, IDENT.data, 'cs', 'text-anchor="middle"');
}

function legenda() {
  const x = MARGEM + 3, y0 = MARGEM + 5.5;
  const col = 95, linhas = Math.ceil(BOCAIS.length / 2);
  texto(x, y0, 'TABELA DE BOCAIS', 'legt');
  linha(x, y0 + 1.4, x + 2 * col - 6, y0 + 1.4, 'fina');
  BOCAIS.forEach((b, i) => {
    const c = i < linhas ? 0 : 1, l = i % linhas;
    const xx = x + c * col, yy = y0 + 5.0 + l * 3.2;
    texto(xx, yy, b.id, 'leg');
    texto(xx + 9, yy, `DN ${b.dn}`, 'legs');
    texto(xx + 20, yy, b.servico, 'legs');
  });
}

/* ==========================================================================
 *  Montagem final
 * ======================================================================= */
montarVista('frontal', HORIZ ? 'VISTA LONGITUDINAL' : 'VISTA FRONTAL');
montarVista('lateral', HORIZ ? 'VISTA TRANSVERSAL' : 'VISTA LATERAL');
if (!SEM_COTAS) { if (HORIZ) cotasHorizontal(); else cotasVertical(); }
legenda();
carimbo();
ret(MARGEM, MARGEM, FOLHA.L - 2 * MARGEM, FOLHA.A - 2 * MARGEM, 'quadro');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FOLHA.L}mm" height="${FOLHA.A}mm"
     viewBox="0 0 ${FOLHA.L} ${FOLHA.A}">
<style>
  text { font-family: Arial, Helvetica, sans-serif; fill:#000; }
  .g        { fill:none; stroke:#000; stroke-width:.32; stroke-linejoin:round; }
  .fina     { fill:none; stroke:#000; stroke-width:.18; }
  .leve     { fill:none; stroke:#555; stroke-width:.11; }
  .iso      { fill:none; stroke:#000; stroke-width:.16; stroke-dasharray:2.4 1.1; }
  .centro   { fill:none; stroke:#000; stroke-width:.14; stroke-dasharray:5 1.2 .7 1.2; }
  .nivel    { fill:none; stroke:#000; stroke-width:.22; stroke-dasharray:3 1.4; }
  .interface{ fill:none; stroke:#000; stroke-width:.22; stroke-dasharray:1.2 1.2; }
  .cota     { fill:none; stroke:#000; stroke-width:.18; }
  .chamada  { fill:none; stroke:#000; stroke-width:.12; stroke-dasharray:1.4 1; }
  .seta     { fill:#000; stroke:none; }
  .piso     { fill:none; stroke:#000; stroke-width:.5; }
  .hach     { fill:none; stroke:#000; stroke-width:.12; }
  .quadro   { fill:none; stroke:#000; stroke-width:.5; }
  .branco   { fill:#fff; stroke:none; }
  .cotatxt, .bocal, .vista {
    paint-order: stroke; stroke:#fff; stroke-width:1.1px; stroke-linejoin:round;
  }
  .cotatxt { font-size:2.5px; }
  .bocal   { font-size:2.4px; font-weight:bold; }
  .vista   { font-size:3.6px; font-weight:bold; letter-spacing:.4px; }
  .cb      { font-size:2.9px; }
  .cbb     { font-size:3.1px; font-weight:bold; }
  .cs      { font-size:2.6px; }
  .logo    { font-size:3.2px; font-weight:bold; }
  .legt    { font-size:2.8px; font-weight:bold; letter-spacing:.3px; }
  .leg     { font-size:2.4px; font-weight:bold; }
  .legs    { font-size:2.3px; }
</style>
<rect x="0" y="0" width="${FOLHA.L}" height="${FOLHA.A}" fill="#fff"/>
${E.join('\n')}
</svg>
`;

/* Verificacao de transbordo: uma cota fora da moldura so apareceria no papel. */
const fora = [];
for (const el of E) {
  let m;
  const rx = /\b(?:x|cx|x1|x2)="(-?[\d.]+)"/g;
  while ((m = rx.exec(el))) {
    const v = parseFloat(m[1]);
    if (v < MARGEM - 0.5 || v > FOLHA.L - MARGEM + 0.5) fora.push(`x=${v} ${el.slice(0, 50)}`);
  }
  const ry = /\b(?:y|cy|y1|y2)="(-?[\d.]+)"/g;
  while ((m = ry.exec(el))) {
    const v = parseFloat(m[1]);
    if (v < MARGEM - 0.5 || v > FOLHA.A - MARGEM + 0.5) fora.push(`y=${v} ${el.slice(0, 50)}`);
  }
}

const dir = join(aqui, TAG);
mkdirSync(dir, { recursive: true });
const SUFIXO = SEM_COTAS ? '-croqui-sem-cotas' : '-croqui';
const saida = join(dir, `${TAG}${SUFIXO}.svg`);
writeFileSync(saida, svg, 'utf8');

console.log(`OK  ${saida}`);
console.log(`    ${HORIZ ? 'horizontal' : 'vertical'} · escala 1:${ESCALA} · ${BOCAIS.length} bocais`
  + (SEM_COTAS ? ' · sem cotas' : '')
  + (NIVEL !== null ? ` · nível ${NIVEL.toFixed(3)} m` : '')
  + (INTERFACE !== null ? ` · interface ${INTERFACE.toFixed(3)} m` : ''));
if (fora.length) {
  console.warn(`    ATENCAO: ${fora.length} coordenada(s) fora da moldura:`);
  for (const f of fora.slice(0, 5)) console.warn(`      - ${f}`);
} else {
  console.log('    tudo dentro da moldura');
}
