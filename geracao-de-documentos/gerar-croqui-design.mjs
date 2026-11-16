/**
 * ============================================================================
 *  CROQUI EDITAVEL  —  prancha A4 (.dc.html) para o Design do Claude
 * ============================================================================
 *
 *    node geracao-de-documentos/gerar-croqui-design.mjs --saida <pasta> --logo <url> R-01 V-01
 *    node geracao-de-documentos/gerar-croqui-design.mjs --carimbos <arquivo.json> --logo <url>
 *
 *    --sem-bocais       sem a tabela de bocais e sem os rotulos N1, N2... (os
 *                       bocais continuam desenhados)
 *    --sem-plataforma   sem a plataforma e a cota dela
 *
 *  A MESMA folha do gerar-croqui.mjs — mesma geometria, mesmo carimbo, mesma
 *  escala automatica — mas cada peca do desenho sai como um elemento proprio,
 *  posicionado em px: o costado, cada bocal, cada rotulo, cada cota, cada
 *  linha de chamada. No Design, qualquer um deles se arrasta a mao sem
 *  desmontar o resto. O SVG unico do gerador original nao permite isso: o
 *  editor o trata como um bloco so.
 *
 *  Correcoes em relacao ao gerar-croqui.mjs (o original nao foi tocado):
 *    - a saia e os bercos descem ate o piso; ficavam flutuando a altura da
 *      fundacao acima dele (a maquete 3D ja os apoia no piso);
 *    - as cotas de altura da vista frontal entram 2 mm: o rotulo "Altura
 *      total" cruzava a moldura;
 *    - a cota da saia sai do costado: o rotulo encostava na linha da saia;
 *    - as cotas de diametro sobem acima dos rotulos de bocal (no TK-01 o
 *      rotulo N5 sumia atras de "O int.");
 *    - bocal que aponta a menos de 60 graus do observador nao e desenhado
 *      naquela vista (o README ja dizia isso; o limite era 75 graus e
 *      deixava tocos dentro do costado);
 *    - bocais que caem no mesmo ponto de uma vista levam um rotulo so
 *      ("N3 / N4"), em vez de dois sobrepostos;
 *    - bocal de tampo encoberto pelo acionamento do agitador nao e desenhado;
 *    - a abertura de acesso da saia so aparece se couber nela;
 *    - a hachura do demister para no costado;
 *    - 1:40 entra entre as escalas, e o TK-01 deixa de sair em 1:50.
 *
 *  --carimbos grava, para cada equipamento do processo, a moldura e o carimbo
 *  prontos (HTML posicionado), para as folhas montadas a partir de imagem.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { EQUIPAMENTOS, DN } from '../src/data/plant.js';
import { EXTRAS } from '../src/data/plant-extra.js';
import { perfilTampo } from '../src/lib/profiles.js';
import { nivelDeVolume } from '../src/lib/vessel.js';
import { IDENT, assinaturas } from './identificacao.js';

/* ==========================================================================
 *  Folha e conversao mm -> px
 * ======================================================================= */
const FOLHA = { L: 210, A: 297 };
const MARGEM = 8;
const CARIMBO_A = 32;
const PX = 96 / 25.4;                       // 1 mm em CSS px
const LARGURA_PX = 794, ALTURA_PX = 1123;   // A4 a 96 px/pol

const p2 = (v) => Number((v * PX).toFixed(2));
const n = (v) => Number(v.toFixed(3));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const fmt = (v, d = 2) => v.toFixed(d).replace('.', ',');

/* ==========================================================================
 *  Metrica de texto — larguras Helvetica (= Arial), por 1000 em.
 *  Cada rotulo vira uma caixa do tamanho exato do texto: o fundo branco que
 *  substitui o halo do SVG nao pode cobrir mais do que o proprio texto.
 * ======================================================================= */
const LARG = {
  helv: '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584',
  hebo: '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584',
};
for (const k of Object.keys(LARG)) LARG[k] = LARG[k].split(',').map(Number);
const ESPECIAIS = { 'Ø': 778, 'ø': 611, '—': 1000, '–': 556, '·': 278, 'º': 365, '°': 400 };

function larguraTexto(t, fs, negrito, espaco = 0) {
  let w = 0;
  for (const c of String(t)) {
    if (ESPECIAIS[c]) { w += ESPECIAIS[c]; continue; }
    const base = c.normalize('NFD')[0];
    const code = base.charCodeAt(0);
    w += (code >= 32 && code < 127) ? LARG[negrito ? 'hebo' : 'helv'][code - 32] : 556;
  }
  return (w / 1000) * fs + espaco * [...String(t)].length;
}

/** Estilo de cada classe de texto do croqui original (tamanhos em mm). */
const TXT = {
  cotatxt: { fs: 2.5, halo: true },
  bocal: { fs: 2.4, b: true, halo: true },
  vista: { fs: 3.6, b: true, ls: 0.4, halo: true },
  cb: { fs: 2.9 },
  cbb: { fs: 3.1, b: true },
  cs: { fs: 2.6 },
  logo: { fs: 3.2, b: true },
  legt: { fs: 2.8, b: true, ls: 0.3 },
  leg: { fs: 2.4, b: true },
  legs: { fs: 2.3 },
};

/** Tracos: as mesmas classes do SVG original, como atributos. */
const TRACO = {
  g: { stroke: '#000', 'stroke-width': 0.32, 'stroke-linejoin': 'round' },
  fina: { stroke: '#000', 'stroke-width': 0.18 },
  leve: { stroke: '#555', 'stroke-width': 0.11 },
  iso: { stroke: '#000', 'stroke-width': 0.16, 'stroke-dasharray': '2.4 1.1' },
  centro: { stroke: '#000', 'stroke-width': 0.14, 'stroke-dasharray': '5 1.2 0.7 1.2' },
  nivel: { stroke: '#000', 'stroke-width': 0.22, 'stroke-dasharray': '3 1.4' },
  interface: { stroke: '#000', 'stroke-width': 0.22, 'stroke-dasharray': '1.2 1.2' },
  cota: { stroke: '#000', 'stroke-width': 0.18 },
  chamada: { stroke: '#000', 'stroke-width': 0.12, 'stroke-dasharray': '1.4 1' },
  seta: { fill: '#000', stroke: 'none' },
  piso: { stroke: '#000', 'stroke-width': 0.5 },
  hach: { stroke: '#000', 'stroke-width': 0.12 },
  quadro: { stroke: '#000', 'stroke-width': 0.5 },
  branco: { fill: '#fff', stroke: 'none' },
  camisa: { fill: '#bdbdbd', stroke: 'none' },
};
const attrs = (cls) => Object.entries({ fill: 'none', ...TRACO[cls] })
  .map(([k, v]) => `${k}="${v}"`).join(' ');

/* ==========================================================================
 *  Elementos da prancha
 *  Um GRUPO e um conjunto de tracos que se move junto (um bocal, uma cota) e
 *  vira um <svg> do tamanho do seu contorno. Um TEXTO e sempre um elemento
 *  proprio: e o que mais se ajusta a mao.
 * ======================================================================= */
function novaPrancha() {
  const els = [];        // na ordem de desenho
  const textos = [];     // por cima de tudo, como o halo do original
  let G = null;

  const pontos = (pts) => { if (!G) throw new Error('primitiva fora de grupo'); G.pts.push(...pts); };
  const prim = (svg, pts) => { pontos(pts); G.prims.push(svg); };

  const api = {
    grupo(nome, fn) {
      const ant = G;
      G = { tipo: 'svg', nome, prims: [], pts: [] };
      els.push(G);
      fn();
      G = ant;
    },
    linha(x1, y1, x2, y2, cls = 'g') {
      prim(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs(cls)}></line>`,
        [[x1, y1], [x2, y2]]);
    },
    ret(x, y, w, h, cls = 'g') {
      prim(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs(cls)}></rect>`,
        [[x, y], [x + w, y + h]]);
    },
    circ(cx, cy, r, cls = 'g') {
      prim(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs(cls)}></circle>`,
        [[cx - r, cy - r], [cx + r, cy + r]]);
    },
    caminho(d, cls = 'g') { prim(`<path d="${d}" ${attrs(cls)}></path>`, pontosDoCaminho(d)); },
    /** SVG pronto, com os pontos (em mm) que definem o seu contorno. */
    bruto(svg, pts) { prim(svg, pts); },
    /** cls: nome de classe de TXT ou o proprio estilo {fs, b, ls, halo}.
     *  centro: (x, y) e o centro do texto, e nao a linha de base. */
    texto(nome, x, y, t, cls, { anchor = 'start', rot = false, centro = false } = {}) {
      textos.push({ nome, x, y, t, cls, anchor, rot, centro });
    },
    imagem(nome, src, x, y, w, h) { els.push({ tipo: 'img', nome, src, x, y, w, h }); },
    html() { return [...els.map(htmlElemento), ...textos.map(htmlTexto)].filter(Boolean).join('\n'); },
  };
  return api;
}

/** Pontos de um path com M, L, l, A e z — o que os geradores emitem. */
function pontosDoCaminho(d) {
  const tk = d.match(/[MLlAz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const pts = [];
  let i = 0, x = 0, y = 0, cmd = null;
  const num = () => parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[MLlAz]/.test(tk[i])) { cmd = tk[i++]; if (cmd === 'z') continue; }
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 'l') { x += num(); y += num(); pts.push([x, y]); }
    else if (cmd === 'A') {
      const rx = num(); num(); num(); num(); num();
      const x2 = num(), y2 = num();
      const mx = (x + x2) / 2, my = (y + y2) / 2;
      pts.push([x2, y2], [mx - rx, my - rx], [mx + rx, my + rx]);
      x = x2; y = y2;
    } else i++;
  }
  return pts;
}

function htmlElemento(el) {
  if (el.tipo === 'img') {
    return `<img data-nome="${escAttr(el.nome)}" src="${escAttr(el.src)}" alt="${escAttr(el.nome)}" `
      + `style="position: absolute; left: ${p2(el.x)}px; top: ${p2(el.y)}px; width: ${p2(el.w)}px; `
      + `height: ${p2(el.h)}px; object-fit: contain">`;
  }
  if (!el.prims.length) return '';
  const pad = 0.6;
  const xs = el.pts.map((p) => p[0]), ys = el.pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) + pad - x0, h = Math.max(...ys) + pad - y0;
  return `<svg data-nome="${escAttr(el.nome)}" style="position: absolute; left: ${p2(x0)}px; `
    + `top: ${p2(y0)}px; width: ${p2(w)}px; height: ${p2(h)}px; overflow: visible" `
    + `viewBox="${n(x0)} ${n(y0)} ${n(w)} ${n(h)}" fill="none">${el.prims.join('')}</svg>`;
}

/**
 * Texto do SVG (x, y na linha de base; text-anchor) -> caixa HTML.
 * Com line-height 1,2 em, a linha de base da Arial fica a 0,9465 em do topo.
 * O texto girado de -90 graus gira em torno do proprio centro, que fica a
 * 0,3465 em a esquerda do ponto de ancoragem.
 */
function htmlTexto(t) {
  const s = typeof t.cls === 'string' ? TXT[t.cls] : t.cls;
  const fs = s.fs, ls = s.ls ?? 0;
  const w = larguraTexto(t.t, fs, s.b, ls);
  const pad = s.halo ? 0.35 : 0.15;
  const W = w + 2 * pad, H = fs * 1.2;
  const meio = t.anchor === 'middle' ? t.x : t.anchor === 'end' ? t.x - w / 2 : t.x + w / 2;
  let left, top;
  if (t.centro) {
    left = t.x - W / 2; top = t.y - H / 2;
  } else if (t.rot) {
    const cx = t.x - 0.3465 * fs, cy = t.y;
    left = cx - W / 2; top = cy - H / 2;
  } else {
    left = meio - W / 2; top = t.y - 0.9465 * fs;
  }
  const align = t.rot || t.centro ? 'center' : ({ start: 'left', middle: 'center', end: 'right' })[t.anchor];
  const css = [
    'position: absolute', `left: ${p2(left)}px`, `top: ${p2(top)}px`,
    `width: ${p2(W)}px`, `height: ${p2(H)}px`, 'box-sizing: border-box',
    `padding: 0 ${p2(pad)}px`, `font-size: ${p2(fs)}px`, `line-height: ${p2(H)}px`,
    s.b ? 'font-weight: 700' : '', ls ? `letter-spacing: ${p2(ls)}px` : '',
    'white-space: nowrap', `text-align: ${align}`,
    s.halo ? 'background: #ffffff' : '', t.rot ? 'transform: rotate(-90deg)' : '',
  ].filter(Boolean).join('; ');
  return `<div data-nome="${escAttr(t.nome)}" style="${css}">${esc(t.t)}</div>`;
}

/* ==========================================================================
 *  Moldura e carimbo — comuns a todas as folhas
 * ======================================================================= */
function moldura(P) {
  P.grupo('Moldura', () => P.ret(MARGEM, MARGEM, FOLHA.L - 2 * MARGEM, FOLHA.A - 2 * MARGEM, 'quadro'));
}

function carimbo(P, { nome, tag, escala, cotas, logo }) {
  const x = MARGEM, y = FOLHA.A - MARGEM - CARIMBO_A, w = FOLHA.L - 2 * MARGEM, h = CARIMBO_A;
  const wLogo = 34, wDir = 40;
  const yb = y + h * 0.58;
  P.grupo('Carimbo · quadro', () => {
    P.ret(x, y, w, h, 'quadro');
    P.linha(x + wLogo, y, x + wLogo, y + h, 'quadro');
    P.linha(x + w - wDir, y, x + w - wDir, y + h, 'quadro');
    P.linha(x + wLogo, yb, x + w, yb, 'quadro');
  });

  if (logo) {
    const cw = wLogo - 5, ch = h - 8, razao = 1404 / 768;
    let lw = cw, lh = cw / razao;
    if (lh > ch) { lh = ch; lw = ch * razao; }
    P.imagem('Carimbo · logotipo', logo, x + (wLogo - lw) / 2, y + (h - lh) / 2, lw, lh);
  } else {
    P.texto('Carimbo · empresa', x + wLogo / 2, y + h / 2, IDENT.empresa, 'logo', { anchor: 'middle' });
  }

  const xc = x + wLogo + (w - wLogo - wDir) / 2;
  const T = (nm, xx, yy, t, cls, anchor = 'middle') => P.texto(`Carimbo · ${nm}`, xx, yy, t, cls, { anchor });
  T('projeto', xc, y + 5.6, `Projeto: ${IDENT.projeto}`, 'cb');
  T('localidade', xc, y + 10.2, `Localidade: ${IDENT.localidadeCurta ?? IDENT.localidade}`, 'cb');
  T('equipamento', xc, y + 15.4, `Equipamento: ${nome} — ${tag}`, 'cbb');
  const ass = assinaturas(tag);
  T('desenhado', x + wLogo + 2.5, yb + 4.0, `Desenhado por: ${ass.desenhadoPor}`, 'cs', 'start');
  T('revisado', x + wLogo + 2.5, yb + 7.9, `Revisado por: ${ass.revisadoPor}`, 'cs', 'start');
  T('aprovado', x + wLogo + 2.5, yb + 11.8, `Aprovado por: ${ass.aprovadoPor}`, 'cs', 'start');
  const xd = x + w - wDir / 2;
  T('escala', xd, y + 5.6, escala, 'cs');
  T('cotas', xd, y + 10.2, cotas, 'cs');
  T('revisão', xd, y + 15.4, `Revisão ${IDENT.revisao}`, 'cs');
  T('data (rótulo)', xd, yb + 5.5, 'Data:', 'cbb');
  T('data', xd, yb + 10.0, IDENT.data, 'cs');
}

/* ==========================================================================
 *  A folha de um equipamento
 * ======================================================================= */
function gerarFolha(TAG, logo, { semBocais = false, semPlataforma = false } = {}) {
  const EQ = EQUIPAMENTOS[TAG];
  if (!EQ) throw new Error(`Equipamento "${TAG}" nao existe em src/data/plant.js.`);
  const g = EQ.geom;
  const HORIZ = g.orientacao === 'horizontal';
  const BOCAIS = EQ.bocais.filter((b) => !b.instrumento);
  const PLATAFORMA = semPlataforma ? null : g.plataforma;
  const P = novaPrancha();
  const { linha, ret, circ, caminho } = P;

  // Sem tabela de bocais, o desenho ganha a faixa que ela ocupava no topo.
  const LEGENDA_A = semBocais ? 4 : 8 + Math.ceil(BOCAIS.length / 2) * 3.2 + 8;
  const Y_PISO_BASE = FOLHA.A - CARIMBO_A - MARGEM - 13;
  const Y_TETO = MARGEM + LEGENDA_A;
  const ALTURA_DISP = Y_PISO_BASE - Y_TETO - 6;

  /* --- geometria derivada (identica ao gerador original) --- */
  const R = g.Di / 2 + g.espessura;
  const ISO = g.isolamento ?? 0;
  // Com camisa, o isolamento veste a camisa, nao o costado.
  const Riso = R + (g.camisa?.folga ?? 0) + ISO;
  const ABA = g.abaReta ?? 0;
  const H_TAMPO = perfilTampo(g.tampoTopo, R).at(-1).y;
  const H_TAMPO_F = perfilTampo(g.tampoFundo, R).at(-1).y;
  const yTopo = g.Ltan + ABA + H_TAMPO;
  const yFundo = -ABA - H_TAMPO_F;
  const H_MOTOR = g.agitador ? 1.9 : 0;
  const H_BOCAL_TOPO = EQ.bocais.some((b) => b.face === 'topo') ? ISO + 0.30 : 0;
  const MEIO_COMP = g.Ltan / 2 + ABA + H_TAMPO;
  const TOPO_H = (g.alturaEixo ?? 0) + Riso + (EQ.bocais.some((b) => b.face === 'topo') ? 0.30 : 0);
  const TOPO_MUNDO = HORIZ ? TOPO_H : g.saiaAltura + yTopo + Math.max(H_MOTOR, H_BOCAL_TOPO);
  const MEIA_LARGURA = HORIZ ? MEIO_COMP : Math.max(
    Riso,
    PLATAFORMA ? Riso + PLATAFORMA.largura : 0,
    g.camisa ? R + g.camisa.folga : 0,
    g.fundacaoLado / 2,
  );

  /* --- escala e layout automaticos; 1:40 entra na lista --- */
  const ESCALAS = [5, 10, 20, 25, 40, 50, 75, 100, 200, 500];
  const RES = HORIZ
    ? { aEsq: 15, aDir: 8, bEsq: 8, bDir: 12 }
    : { aEsq: 16.5, aDir: 6, bEsq: 13, bDir: 13 };
  const MEIO_PISO_TRANSV = 1.6;

  function tentarLayout(escala) {
    const mm = 1000 / escala;
    if (TOPO_MUNDO * mm + 12 > ALTURA_DISP) return null;
    if (HORIZ) {
      const hA = MEIO_COMP * mm, hB = Riso * MEIO_PISO_TRANSV * mm + 2;
      const cxA = MARGEM + RES.aEsq + hA;
      const cxB = FOLHA.L - MARGEM - RES.bDir - hB;
      if ((cxB - hB - RES.bEsq) - (cxA + hA + RES.aDir) < 4) return null;
      return { escala, mm, cx: { frontal: cxA, lateral: cxB } };
    }
    const borda = MEIA_LARGURA * mm;
    const cxF = MARGEM + borda + RES.aEsq;
    const cxL = FOLHA.L - MARGEM - borda - RES.bDir;
    if ((cxL - borda - RES.bEsq) - (cxF + borda * 0.62 + RES.aDir) < 4) return null;
    return { escala, mm, cx: { frontal: cxF, lateral: cxL } };
  }
  const LAYOUT = ESCALAS.map(tentarLayout).find(Boolean)
    ?? { escala: 500, mm: 2, cx: { frontal: 60, lateral: 150 } };
  const ESCALA = LAYOUT.escala, MM = LAYOUT.mm, CX = LAYOUT.cx;
  const BORDA = HORIZ ? Riso * MM : MEIA_LARGURA * MM;
  const COTA1 = BORDA + 7;
  /* Cotas de altura da vista frontal: 2 mm mais para dentro que no original,
   * onde o rotulo de "Altura total" cruzava a moldura. */
  const COTA_TT = BORDA + 5, COTA_TOT = BORDA + 11.5;

  const FOLGA_V = Math.max(0, ALTURA_DISP - (TOPO_MUNDO * MM + 12));
  const Y_PISO = Y_PISO_BASE - FOLGA_V / 2;
  const Y_EIXO = Y_PISO - (g.alturaEixo ?? 0) * MM;
  const px = (vista, xm) => CX[vista] + xm * MM;
  const py = (ym) => Y_PISO - ym * MM;
  const pv = (v) => Y_EIXO - v * MM;
  const NOME_VISTA = HORIZ
    ? { frontal: 'longitudinal', lateral: 'transversal' }
    : { frontal: 'frontal', lateral: 'lateral' };

  /* --- cotas: linha + setas num elemento, rotulo noutro, chamadas a parte --- */
  function cotaV(nome, x, pa, pb, rotulo) {
    P.grupo(`Cota ${nome}`, () => {
      linha(x, pa, x, pb, 'cota');
      for (const p of [pa, pb]) {
        const s = p === pa ? 1 : -1;
        caminho(`M${n(x)},${n(p)} l-1,${n(1.9 * s)} l2,0 z`, 'seta');
      }
    });
    P.texto(`Rótulo da cota ${nome}`, x - 1.6, (pa + pb) / 2, rotulo, 'cotatxt', { anchor: 'middle', rot: true });
  }
  function cotaH(nome, y, xa, xb, rotulo) {
    P.grupo(`Cota ${nome}`, () => {
      linha(xa, y, xb, y, 'cota');
      for (const x of [xa, xb]) {
        const s = x === xa ? 1 : -1;
        caminho(`M${n(x)},${n(y)} l${n(1.9 * s)},-1 l0,2 z`, 'seta');
      }
    });
    P.texto(`Rótulo da cota ${nome}`, (xa + xb) / 2, y - 1.4, rotulo, 'cotatxt', { anchor: 'middle' });
  }
  function chamadaH(nome, xObj, xCota, y) {
    const dir = Math.sign(xCota - xObj) || 1;
    P.grupo(`Chamada · ${nome}`, () => linha(xObj + dir * 1.0, y, xCota + dir * 1.6, y, 'chamada'));
  }
  function chamadaV(nome, x, yObj, yCota) {
    const dir = Math.sign(yCota - yObj) || 1;
    P.grupo(`Chamada · ${nome}`, () => linha(x, yObj + dir * 1.0, x, yCota + dir * 1.6, 'chamada'));
  }

  const NIVEL = g.volumeUtil ? nivelDeVolume(g, g.volumeUtil) : null;
  const INTERFACE = g.volumeFasePesada ? nivelDeVolume(g, g.volumeFasePesada) : null;

  /* ------------------------------------------------------------------ */
  /*  Vaso vertical                                                      */
  /* ------------------------------------------------------------------ */
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
  /** Saia ate o piso, como na maquete 3D; o original parava fundacaoAltura acima dele. */
  function saiaV(vista) {
    const rs = R * 0.995;
    const yTop = py(g.saiaAltura + yFundo * 0.35);
    const yBase = py(0);
    for (const s of [-1, 1]) linha(px(vista, s * rs), yBase, px(vista, s * rs), yTop, 'g');
    const lb = g.baseAnelLargura * MM;
    ret(px(vista, -rs) - lb / 2, yBase - 1.2, 2 * rs * MM + lb, 1.2, 'g');
  }
  /** Abertura de acesso da saia — so se couber abaixo do tampo de fundo. */
  function aberturaSaiaV(vista) {
    const awm = Math.min(0.7, g.Di * 0.35), ahm = Math.min(1.1, g.saiaAltura * 0.5);
    if (0.25 + ahm * 0.65 + awm / 2 > g.saiaAltura + yFundo - 0.05) return;
    const aw = awm * MM, ah = ahm * MM;
    const xa = px(vista, 0) - aw / 2, ya = py(0.25) - ah;
    caminho(`M${n(xa)},${n(ya + ah)} L${n(xa)},${n(ya + ah * 0.35)} `
      + `A ${n(aw / 2)} ${n(aw / 2)} 0 0 1 ${n(xa + aw)},${n(ya + ah * 0.35)} `
      + `L${n(xa + aw)},${n(ya + ah)}`, 'g');
  }
  /**
   * Acionamento com as medidas da maquete 3D (src/lib/agitator.js), de baixo
   * para cima: flange de montagem, lanterna do selo, redutor, motor e tampa do
   * ventilador — 1,67 m acima do tampo. Nao vem do relatorio: e estimado.
   */
  const ACION = {
    flange: { w: 0.68, h: 0.05 },
    selo: { wb: 0.40, wt: 0.32, h: 0.34 },
    redutor: { w: 0.62, h: 0.50 },
    motor: { w: 0.42, h: 0.62 },
    vent: { wb: 0.38, wt: 0.34, h: 0.16 },
  };
  const H_ACION = Object.values(ACION).reduce((s, p) => s + p.h, 0);
  function agitadorV(vista) {
    const cx = px(vista, 0);
    let y = g.saiaAltura + yTopo;
    const bloco = (w, h) => { ret(cx - (w / 2) * MM, py(y + h), w * MM, h * MM, 'g'); y += h; };
    const tronco = (wb, wt, h) => {
      caminho(`M${n(cx - (wb / 2) * MM)},${n(py(y))} L${n(cx - (wt / 2) * MM)},${n(py(y + h))} `
        + `L${n(cx + (wt / 2) * MM)},${n(py(y + h))} L${n(cx + (wb / 2) * MM)},${n(py(y))} z`, 'g');
      y += h;
    };
    bloco(ACION.flange.w, ACION.flange.h);
    tronco(ACION.selo.wb, ACION.selo.wt, ACION.selo.h);
    bloco(ACION.redutor.w, ACION.redutor.h);
    const yMotor = y;
    bloco(ACION.motor.w, ACION.motor.h);
    for (let i = 0; i < 5; i++) {
      const ya = py(yMotor + 0.12 + i * 0.1);
      linha(cx - 0.225 * MM, ya, cx + 0.225 * MM, ya, 'fina');
    }
    // caixa de ligacao, a +x: so aparece de perfil na vista frontal
    if (vista === 'frontal') ret(cx + 0.21 * MM, py(yMotor + 0.48), 0.13 * MM, 0.16 * MM, 'g');
    tronco(ACION.vent.wb, ACION.vent.wt, ACION.vent.h);
  }
  function camisaV(vista) {
    const c = g.camisa;
    const yBase = py(g.saiaAltura + c.base);
    const yTopoC = py(g.saiaAltura + c.base + c.altura);
    for (const s of [-1, 1]) {
      const xi = px(vista, s * R), xo = px(vista, s * (R + c.folga));
      // O vao preenchido: em escala pequena ele mede 1 mm e, so com as
      // linhas, a camisa se confunde com a parede.
      ret(Math.min(xi, xo), yTopoC, Math.abs(xo - xi), yBase - yTopoC, 'camisa');
      linha(xo, yBase, xo, yTopoC, 'g');
      linha(xi, yBase, xo, yBase, 'g');
      linha(xi, yTopoC, xo, yTopoC, 'g');
    }
  }
  /**
   * Demister: pastilha de malha (hachura cruzada, recortada no costado) sobre
   * um anel de suporte soldado a parede.
   */
  function demisterV(vista) {
    const d = g.demister;
    const y0 = py(g.saiaAltura + g.Ltan + ABA - d.abaixoDoTopo);
    const h = d.espessura * MM;
    const x0 = px(vista, -g.Di / 2), x1 = px(vista, g.Di / 2);
    ret(x0, y0, x1 - x0, h, 'fina');
    for (let x = x0 - h + 1.2; x < x1; x += 1.2) {
      // sobe para a direita e desce para a direita, ambas cortadas na pastilha
      const a = Math.max(x, x0), b = Math.min(x + h, x1);
      if (b > a) {
        linha(a, y0 + h - (a - x), b, y0 + h - (b - x), 'hach');
        linha(a, y0 + (a - x), b, y0 + (b - x), 'hach');
      }
    }
    const aba = 0.03 * MM, esp = 0.015 * MM;
    ret(x0, y0 + h, aba, esp, 'g');
    ret(x1 - aba, y0 + h, aba, esp, 'g');
  }

  /** Bocal de casco a que um interno se refere (placa defletora). */
  const bocalPorId = (id) => EQ.bocais.find((b) => b.id === id);

  /**
   * Placa defletora em frente a um bocal lateral. Projetada como os bocais:
   * de perfil e uma chapa fina presa a parede por duas barras; de frente, um
   * retangulo.
   */
  function defletorV(vista) {
    const f = g.defletor, b = bocalPorId(f.bocal);
    const a = (b.ang * Math.PI) / 180, Ri = g.Di / 2, rp = Ri - f.afastamento;
    const proj = (r, t) => (vista === 'frontal'
      ? r * Math.cos(a) - t * Math.sin(a)
      : r * Math.sin(a) + t * Math.cos(a));
    const u1 = proj(rp, -f.largura / 2), u2 = proj(rp, f.largura / 2);
    let ua = Math.min(u1, u2), ub = Math.max(u1, u2);
    const deLado = ub - ua < 0.02;
    if (deLado) { const c = (ua + ub) / 2; ua = c - 0.004; ub = c + 0.004; }
    const yT = g.saiaAltura + b.y + f.altura / 2, yB = yT - f.altura;
    ret(px(vista, ua), py(yT), (ub - ua) * MM, f.altura * MM, 'g');
    if (deLado) {
      const uw = proj(Ri, 0), up = (ua + ub) / 2;
      for (const y of [yT - 0.03, yB + 0.03]) linha(px(vista, uw), py(y), px(vista, up), py(y), 'fina');
    }
  }

  /** Quebra-vortice em cruz, apoiado no fundo sobre a saida de liquido. */
  function quebraVorticeV(vista) {
    const q = g.quebraVortice;
    const yF = g.saiaAltura - ABA - perfilTampo(g.tampoFundo, g.Di / 2).at(-1).y;
    const cx = px(vista, 0), w = q.largura * MM;
    ret(cx - w / 2, py(yF + q.altura), w, q.altura * MM, 'g');
    linha(cx, py(yF + q.altura), cx, py(yF), 'g');     // a outra chapa, de topo
  }
  /**
   * Agitador por dentro, nas posicoes da maquete 3D (R-01.js, agitator.js,
   * internals.js): eixo ate 0,28 m acima da tangencia de fundo, turbinas
   * Rushton (disco 0,75 D, pas D/4 x D/5 na periferia) e as chicanas a 45
   * graus, que na elevacao aparecem como duas faixas rentes a parede.
   */
  function eixoV(vista) {
    const a = g.agitador, cx = px(vista, 0), re = (a.diamEixo / 2) * MM;
    const y0 = py(g.saiaAltura + yTopo), y1 = py(g.saiaAltura + 0.28);
    linha(cx - re, y0, cx - re, y1, 'fina');
    linha(cx + re, y0, cx + re, y1, 'fina');
    linha(cx - re, y1, cx + re, y1, 'fina');
  }
  function turbinaV(vista, i) {
    const a = g.agitador, cx = px(vista, 0), D = a.Dimp;
    const y = py(g.saiaAltura + a.alturaPrimeiro + i * a.espacamento);
    const hPa = (D / 5) * MM, cubo = a.diamEixo * 1.8 * MM;
    linha(cx - 0.375 * D * MM, y, cx + 0.375 * D * MM, y, 'g');
    ret(cx - cubo / 2, y - hPa * 0.55, cubo, hPa * 1.1, 'g');
    for (const s of [-1, 1]) {
      const xi = cx + s * (D / 4) * MM, xo = cx + s * (D / 2) * MM;
      ret(Math.min(xi, xo), y - hPa / 2, Math.abs(xo - xi), hPa, 'g');
    }
  }
  function chicanaV(vista, s) {
    const c = g.chicanas, Ri = g.Di / 2, k = Math.SQRT1_2;
    const xi = px(vista, s * k * (Ri - c.folgaParede - c.largura));
    const xo = px(vista, s * k * (Ri - c.folgaParede));
    const yTopoC = NIVEL !== null ? NIVEL + 0.6 : g.Ltan - 0.4;
    ret(Math.min(xi, xo), py(g.saiaAltura + yTopoC), Math.abs(xo - xi), (yTopoC - 0.4) * MM, 'fina');
  }

  function plataformaV(vista, s) {
    const p = PLATAFORMA;
    const y = py(g.saiaAltura + p.elevacao), hg = p.guardaCorpo * MM;
    const xi = px(vista, s * Riso), xo = px(vista, s * (Riso + p.largura));
    linha(xi, y, xo, y, 'g');
    linha(xi, y + 0.7, xo, y + 0.7, 'fina');
    linha(xi, y - hg, xo, y - hg, 'fina');
    for (const f of [0.34, 0.67, 1.0]) {
      const xm = xi + (xo - xi) * f;
      linha(xm, y, xm, y - hg, 'fina');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Vaso horizontal                                                    */
  /* ------------------------------------------------------------------ */
  function cascoH(raio, cls = 'g') {
    const cx = px('frontal', 0);
    const meio = g.Ltan / 2;
    const pe = perfilTampo(g.tampoFundo, raio);
    const pd = perfilTampo(g.tampoTopo, raio);
    for (const s of [1, -1]) {
      const pts = [];
      for (let i = pe.length - 1; i >= 0; i--) pts.push([-meio - ABA - pe[i].y, s * pe[i].x]);
      pts.push([-meio - ABA, s * raio], [meio + ABA, s * raio]);
      for (const p of pd) pts.push([meio + ABA + p.y, s * p.x]);
      caminho(pts.map(([u, v], i) => `${i ? 'L' : 'M'}${n(cx + u * MM)},${n(pv(v))}`).join(''), cls);
    }
    for (const s of [-1, 1]) {
      linha(cx + s * (meio + ABA) * MM, pv(raio), cx + s * (meio + ABA) * MM, pv(-raio), 'leve');
    }
  }
  /** Bercos ate o piso; no original paravam fundacaoAltura acima dele. */
  function bercoH(s) {
    const cx = px('frontal', 0), meio = g.Ltan / 2;
    const w = g.bercos.largura * MM;
    const yTopoB = pv(-R * 0.75);
    const yBase = py(0);
    const x = cx + s * (meio - g.bercos.fracao * g.Ltan) * MM;
    linha(x - w / 2, yTopoB, x - w / 2, yBase, 'g');
    linha(x + w / 2, yTopoB, x + w / 2, yBase, 'g');
    linha(x - w / 2, yBase, x + w / 2, yBase, 'g');
  }
  function blocoH(s) {
    const cx = px('frontal', 0), meio = g.Ltan / 2;
    const x = cx + s * (meio - g.bercos.fracao * g.Ltan) * MM;
    const wf = g.fundacaoLargura * MM, hf = g.fundacaoAltura * MM;
    ret(x - wf / 2, py(0), wf, hf, 'g');
    for (let i = 1; i < 4; i++) {
      const xx = x - wf / 2 + (i * wf) / 4;
      linha(xx, py(0) + hf, Math.min(xx + hf, x + wf / 2), py(0) + hf - Math.min(hf, x + wf / 2 - xx), 'hach');
    }
  }
  function bercoTransversal() {
    const cx = px('lateral', 0);
    const a = Math.PI / 3;
    const yBase = py(0);
    for (const s of [-1, 1]) {
      const xTop = cx + s * R * Math.sin(a) * MM;
      linha(xTop, pv(-R * Math.cos(a)), xTop, yBase, 'g');
    }
    linha(cx - R * Math.sin(a) * MM, yBase, cx + R * Math.sin(a) * MM, yBase, 'g');
  }
  function blocoTransversal() {
    const cx = px('lateral', 0);
    const wf = g.fundacaoLargura * 2.2 * MM, hf = g.fundacaoAltura * MM;
    ret(cx - wf / 2, py(0), wf, hf, 'g');
    for (let i = 1; i < 6; i++) {
      const xx = cx - wf / 2 + (i * wf) / 6;
      linha(xx, py(0) + hf, Math.min(xx + hf, cx + wf / 2), py(0) + hf - Math.min(hf, cx + wf / 2 - xx), 'hach');
    }
  }
  function nivelH(vista, h, cls) {
    const Ri = g.Di / 2;
    const v = h - Ri;
    const meia = Math.sqrt(Math.max(0, Ri * Ri - v * v));
    if (vista === 'frontal') linha(px(vista, -g.Ltan / 2 - ABA), pv(v), px(vista, g.Ltan / 2 + ABA), pv(v), cls);
    else linha(px(vista, -meia), pv(v), px(vista, meia), pv(v), cls);
  }

  /* ------------------------------------------------------------------ */
  /*  Bocais                                                             */
  /* ------------------------------------------------------------------ */
  /** Um bocal que aponta a menos de 60 graus do observador e desenhado na outra vista. */
  const ENCURT_MIN = 0.5;
  let axiais = [], laterais = [];

  function bocalLateralV(vista, b) {
    const a = (b.ang * Math.PI) / 180;
    const comp = vista === 'frontal' ? Math.cos(a) : Math.sin(a);
    const encurt = Math.abs(comp);
    if (encurt < ENCURT_MIN) return null;
    const d = DN[b.dn];
    const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;
    const visita = b.dn >= 500;
    const sai = comp >= 0 ? 1 : -1;
    const yb = py(b.y + g.saiaAltura);
    const rParede = b.camisa && g.camisa ? R + g.camisa.folga : R;
    const x0 = px(vista, sai * rParede * encurt);
    const igual = laterais.find((o) => o.sai === sai && Math.abs(o.yb - yb) < Math.max(o.rF, rF)
      && Math.abs(o.x0 - x0) < 1);
    if (igual) return { mesclar: igual.marca };
    const x1 = x0 + sai * (ISO + (visita ? 0.22 : 0.16)) * MM * encurt;
    P.grupo(`Bocal ${b.id} · vista ${NOME_VISTA[vista]}`, () => {
      linha(x0, yb - rT, x1, yb - rT, 'g');
      linha(x0, yb + rT, x1, yb + rT, 'g');
      ret(sai > 0 ? x1 : x1 - eF, yb - rF, eF, rF * 2, 'g');
      if (visita) ret(sai > 0 ? x1 + eF : x1 - 2 * eF, yb - rF, eF, rF * 2, 'g');
    });
    const marca = { x: x1 + sai * eF * (visita ? 2 : 1), y: yb, sai };
    laterais.push({ sai, yb, x0, rF, marca });
    return marca;
  }

  function bocalAxialV(vista, b, ehTopo) {
    const a = (b.ang * Math.PI) / 180;
    const r = b.r ?? 0;
    const xm = vista === 'frontal' ? r * Math.cos(a) : r * Math.sin(a);
    const d = DN[b.dn];
    const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;
    // Encoberto pelo acionamento do agitador: no R-01, o N4 na vista lateral
    // caia dentro do redutor, com o rotulo sobre o motor.
    if (ehTopo && g.agitador && Math.abs(xm) * MM + rF < (ACION.redutor.w / 2) * MM) return null;
    const colide = axiais.find((o) => o.ehTopo === ehTopo && Math.abs(o.x - px(vista, xm)) < o.rF + rF);
    if (colide) return { mesclar: colide.marca };

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
    P.grupo(`Bocal ${b.id} · vista ${NOME_VISTA[vista]}`, () => {
      linha(x - rT, y0, x - rT, y1, 'g');
      linha(x + rT, y0, x + rT, y1, 'g');
      ret(x - rF, s < 0 ? y1 - eF : y1, rF * 2, eF, 'g');
    });
    const marca = { x, y: y1 + s * eF, s };
    axiais.push({ x, rF, ehTopo, marca });
    return marca;
  }

  function bocalRadialH(vista, b) {
    const d = DN[b.dn];
    const rT = (d.od / 2) * MM, rF = (d.fl / 2) * MM, eF = d.esp * MM;
    const ehTopo = b.face === 'topo';
    const s = ehTopo ? -1 : 1;
    const u = (b.u ?? g.Ltan / 2) - g.Ltan / 2;
    const x = vista === 'frontal' ? px(vista, u) : px(vista, 0);
    if (vista === 'lateral') {
      const colide = axiais.find((o) => o.ehTopo === ehTopo);
      if (colide) return { mesclar: colide.marca };
    }
    const y0 = pv(ehTopo ? R : -R);
    const y1 = y0 + s * (ISO + 0.22) * MM;
    P.grupo(`Bocal ${b.id} · vista ${NOME_VISTA[vista]}`, () => {
      linha(x - rT, y0, x - rT, y1, 'g');
      linha(x + rT, y0, x + rT, y1, 'g');
      ret(x - rF, s < 0 ? y1 - eF : y1, rF * 2, eF, 'g');
    });
    const marca = { x, y: y1 + s * eF, s };
    if (vista === 'lateral') axiais.push({ x, rF, ehTopo, marca });
    return marca;
  }

  function bocalTampoH(vista, b) {
    if (vista === 'lateral') return null;
    const dir = b.face === 'tampo-dir' ? 1 : -1;
    const v = b.v ?? 0;
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
    P.grupo(`Bocal ${b.id} · vista ${NOME_VISTA[vista]}`, () => {
      linha(x0, y - rT, x1, y - rT, 'g');
      linha(x0, y + rT, x1, y + rT, 'g');
      ret(dir > 0 ? x1 : x1 - eF, y - rF, eF, rF * 2, 'g');
    });
    return { x: x1 + dir * eF, y, sai: dir };
  }

  /** Topo dos rotulos de bocal de topo na vista frontal: as cotas de diametro ficam acima. */
  let topoRotulos = Infinity;

  function desenharBocais(vista) {
    const marcas = [];
    for (const b of BOCAIS) {
      let r;
      if (HORIZ) r = b.face.startsWith('tampo') ? bocalTampoH(vista, b) : bocalRadialH(vista, b);
      else if (b.face === 'lateral') r = bocalLateralV(vista, b);
      else r = bocalAxialV(vista, b, b.face === 'topo');
      if (!r) continue;
      if (r.mesclar) { r.mesclar.ids.push(b.id); continue; }
      r.ids = [b.id];
      marcas.push(r);
    }
    if (semBocais) return;
    const niveis = [];
    for (const r of marcas) {
      const dx = r.sai !== undefined ? r.sai * 2.6 : 0;
      let dy = r.s !== undefined ? r.s * 3.2 : -1.6;
      if (r.s !== undefined) {
        let nv = 0;
        while (niveis.some((m) => m.n === nv && m.s === r.s && Math.abs(m.x - r.x) < 7)) nv++;
        niveis.push({ x: r.x, n: nv, s: r.s });
        dy += r.s * nv * 3.4;
      }
      const rotulo = r.ids.join(' / ');
      const y = r.y + dy;
      if (vista === 'frontal' && r.s === -1) topoRotulos = Math.min(topoRotulos, y - TXT.bocal.fs * 0.75);
      P.texto(`Rótulo ${rotulo} · vista ${NOME_VISTA[vista]}`, r.x + dx, y, rotulo, 'bocal',
        { anchor: r.sai === -1 ? 'end' : r.sai === 1 ? 'start' : 'middle' });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Vistas                                                             */
  /* ------------------------------------------------------------------ */
  function montarVista(vista, titulo) {
    axiais = []; laterais = [];
    const V = `Vista ${NOME_VISTA[vista]}`;
    if (HORIZ) {
      if (vista === 'frontal') {
        if (g.bercos) {
          for (const s of [-1, 1]) {
            P.grupo(`${V} · berço ${s < 0 ? 'esquerdo' : 'direito'}`, () => bercoH(s));
            P.grupo(`${V} · fundação ${s < 0 ? 'esquerda' : 'direita'}`, () => blocoH(s));
          }
        }
        P.grupo(`${V} · costado`, () => cascoH(R));
        if (ISO > 0) P.grupo(`${V} · isolamento`, () => cascoH(Riso, 'iso'));
        P.grupo(`${V} · linha de centro`, () =>
          linha(px(vista, -MEIO_COMP - 0.1), Y_EIXO, px(vista, MEIO_COMP + 0.1), Y_EIXO, 'centro'));
      } else {
        if (g.bercos) {
          P.grupo(`${V} · berço`, bercoTransversal);
          P.grupo(`${V} · fundação`, blocoTransversal);
        }
        P.grupo(`${V} · costado`, () => circ(px(vista, 0), Y_EIXO, R * MM, 'g'));
        if (ISO > 0) P.grupo(`${V} · isolamento`, () => circ(px(vista, 0), Y_EIXO, Riso * MM, 'iso'));
        P.grupo(`${V} · linha de centro horizontal`, () =>
          linha(px(vista, -Riso - 0.1), Y_EIXO, px(vista, Riso + 0.1), Y_EIXO, 'centro'));
        P.grupo(`${V} · linha de centro vertical`, () =>
          linha(px(vista, 0), pv(Riso + 0.1), px(vista, 0), pv(-Riso - 0.1), 'centro'));
      }
      if (NIVEL !== null) P.grupo(`${V} · nível`, () => nivelH(vista, NIVEL, 'nivel'));
      if (INTERFACE !== null) P.grupo(`${V} · interface`, () => nivelH(vista, INTERFACE, 'interface'));
    } else {
      P.grupo(`${V} · fundação`, () => fundacaoV(vista));
      P.grupo(`${V} · saia`, () => saiaV(vista));
      P.grupo(`${V} · abertura da saia`, () => aberturaSaiaV(vista));
      P.grupo(`${V} · costado`, () => cascoV(vista, R, 'g'));
      if (g.camisa) P.grupo(`${V} · camisa`, () => camisaV(vista));
      if (ISO > 0) P.grupo(`${V} · isolamento`, () => cascoV(vista, Riso, 'iso'));
      if (g.demister) P.grupo(`${V} · demister`, () => demisterV(vista));
      if (g.defletor) P.grupo(`${V} · placa defletora`, () => defletorV(vista));
      if (g.quebraVortice) P.grupo(`${V} · quebra-vórtice`, () => quebraVorticeV(vista));
      if (NIVEL !== null && vista === 'lateral') {
        P.grupo(`${V} · nível`, () => {
          const yl = py(g.saiaAltura + NIVEL);
          linha(px(vista, -g.Di / 2), yl, px(vista, g.Di / 2), yl, 'nivel');
        });
      }
      if (g.agitador) P.grupo(`${V} · acionamento do agitador`, () => agitadorV(vista));
      if (g.agitador) {
        if (g.chicanas) {
          for (const s of [-1, 1]) {
            P.grupo(`${V} · chicana ${s < 0 ? 'esquerda' : 'direita'}`, () => chicanaV(vista, s));
          }
        }
        P.grupo(`${V} · eixo do agitador`, () => eixoV(vista));
        for (let i = 0; i < g.agitador.nImpelidores; i++) {
          P.grupo(`${V} · turbina Rushton ${i + 1}`, () => turbinaV(vista, i));
        }
      }
      if (PLATAFORMA) {
        for (const s of [-1, 1]) {
          P.grupo(`${V} · plataforma ${s < 0 ? 'esquerda' : 'direita'}`, () => plataformaV(vista, s));
        }
      }
      P.grupo(`${V} · linha de centro`, () =>
        linha(px(vista, 0), py(TOPO_MUNDO + 0.4), px(vista, 0), py(-0.4), 'centro'));
    }

    desenharBocais(vista);

    const meioPiso = HORIZ
      ? (vista === 'frontal' ? MEIO_COMP : Riso * MEIO_PISO_TRANSV)
      : g.fundacaoLado / 2;
    P.grupo(`${V} · piso`, () => linha(px(vista, -meioPiso) - 2, py(0), px(vista, meioPiso) + 2, py(0), 'piso'));
    P.texto(`${V} · título`, px(vista, 0), Y_PISO + g.fundacaoAltura * MM + 5.5, titulo, 'vista', { anchor: 'middle' });
  }

  /* ------------------------------------------------------------------ */
  /*  Cotas                                                              */
  /* ------------------------------------------------------------------ */
  /**
   * Com acionamento, a altura total vai do piso ao topo do motor, e uma
   * cadeia ao lado mostra de que ela e feita: saia, T/T, tampo e acionamento.
   * Sem a cadeia, "Altura total" parava no tampo e o motor ficava sem cota.
   */
  function cotasEmCadeia() {
    const v = 'frontal';
    const yTT = g.saiaAltura + g.Ltan;
    const yH = g.saiaAltura + yTopo;
    const yA = yH + H_ACION;
    const xC = px(v, 0) - COTA_TT, xT = px(v, 0) - COTA_TOT;

    chamadaH('piso', px(v, -g.fundacaoLado / 2), xT, py(0));
    chamadaH('tangente inferior', px(v, -R), xC, py(g.saiaAltura));
    chamadaH('tangente superior', px(v, -R), xC, py(yTT));
    chamadaH('topo do tampo', px(v, -ACION.flange.w / 2), xC, py(yH));
    chamadaH('topo do acionamento', px(v, -ACION.vent.wt / 2), xT, py(yA));

    cotaV('saia', xC, py(0), py(g.saiaAltura), `Saia ${fmt(g.saiaAltura)} m`);
    cotaV('T/T', xC, py(g.saiaAltura), py(yTT), `T/T ${fmt(g.Ltan)} m`);
    cotaV('tampo superior', xC, py(yTT), py(yH), `${fmt(yH - yTT)} m`);
    cotaV('acionamento', xC, py(yH), py(yA), `Acion. ${fmt(H_ACION)} m`);
    cotaV('altura total', xT, py(0), py(yA), `Altura total ${fmt(yA)} m (acionamento estimado)`);
  }

  function cotasVertical() {
    const v = 'frontal';
    const yTT = g.saiaAltura + g.Ltan;
    const xTT = px(v, 0) - COTA_TT, xTot = px(v, 0) - COTA_TOT;

    if (g.camisa) {
      // A direita da frontal, que ficou livre: altura da camisa.
      const c = g.camisa;
      const xc = px(v, Riso) + 6;
      chamadaH('camisa (base)', px(v, R + c.folga), xc, py(g.saiaAltura + c.base));
      chamadaH('camisa (topo)', px(v, R + c.folga), xc, py(g.saiaAltura + c.base + c.altura));
      cotaV('camisa', xc, py(g.saiaAltura + c.base), py(g.saiaAltura + c.base + c.altura),
        `Camisa de aquecimento ${fmt(c.altura)} m`);
    }

    if (g.agitador) {
      cotasEmCadeia();
    } else {
      chamadaH('T/T inferior', px(v, -R), xTT, py(g.saiaAltura));
      chamadaH('T/T superior', px(v, -R), xTT, py(yTT));
      cotaV('T/T', xTT, py(g.saiaAltura), py(yTT), `T/T ${fmt(g.Ltan)} m`);

      chamadaH('altura total (piso)', px(v, -g.fundacaoLado / 2), xTot, py(0));
      chamadaH('altura total (topo)', px(v, 0), xTot, py(g.saiaAltura + yTopo));
      cotaV('altura total', xTot, py(0), py(g.saiaAltura + yTopo), `Altura total ${fmt(g.saiaAltura + yTopo)} m`);

      // Fora do costado: no original ficava a 0,62 da borda, e quando a fundacao
      // era larga isso caia sobre a propria saia.
      const xSaia = px(v, R) + 7;
      chamadaH('saia (piso)', px(v, g.fundacaoLado / 2), xSaia, py(0));
      chamadaH('saia (tangente)', px(v, R), xSaia, py(g.saiaAltura));
      cotaV('saia', xSaia, py(0), py(g.saiaAltura), `Saia ${fmt(g.saiaAltura)} m`);
    }

    // Acima do topo E dos rotulos de bocal.
    const yD1 = Math.min(py(TOPO_MUNDO) - 5, topoRotulos - 3), yD2 = yD1 - 6;
    chamadaV('Ø int. esquerda', px(v, -g.Di / 2), py(yTT), yD1);
    chamadaV('Ø int. direita', px(v, g.Di / 2), py(yTT), yD1);
    cotaH('Ø int.', yD1, px(v, -g.Di / 2), px(v, g.Di / 2), `Ø int. ${fmt(g.Di)} m`);
    if (ISO > 0) {
      chamadaV('Ø ext. esquerda', px(v, -Riso), py(yTT), yD2);
      chamadaV('Ø ext. direita', px(v, Riso), py(yTT), yD2);
      cotaH('Ø ext.', yD2, px(v, -Riso), px(v, Riso), `Ø ext. c/ isolamento ${fmt(2 * Riso)} m`);
    }

    const L = 'lateral';
    if (NIVEL !== null) {
      const x = px(L, 0) + COTA1;
      chamadaH('nível (fundo)', px(L, R), x, py(g.saiaAltura));
      chamadaH('nível (superfície)', px(L, g.Di / 2), x, py(g.saiaAltura + NIVEL));
      cotaV('nível', x, py(g.saiaAltura), py(g.saiaAltura + NIVEL), `Nível ${fmt(NIVEL)} m`);
    }
    if (PLATAFORMA) {
      const xp = px(L, 0) - COTA1;
      const yPlat = g.saiaAltura + PLATAFORMA.elevacao;
      chamadaH('plataforma', px(L, -Riso - PLATAFORMA.largura), xp, py(yPlat));
      chamadaH('plataforma (piso)', px(L, -g.fundacaoLado / 2), xp, py(0));
      cotaV('plataforma', xp, py(0), py(yPlat), `Plataforma ${fmt(yPlat)} m`);
    }
    if (g.demister) {
      const xd = px(L, 0) + COTA1;
      const yd = g.saiaAltura + g.Ltan + ABA - g.demister.abaixoDoTopo;
      chamadaH('demister', px(L, g.Di / 2), xd, py(yd));
      chamadaH('demister (tangente)', px(L, R), xd, py(g.saiaAltura + g.Ltan));
      cotaV('demister', xd, py(yd), py(g.saiaAltura + g.Ltan), `Demister ${fmt(g.demister.abaixoDoTopo)} m`);
    }
  }

  /**
   * Chamadas que nomeiam os internos, a direita da vista frontal: um ponto no
   * interno, a linha de chamada e o nome. Os textos ficam em alturas fixas
   * acima da tangencia de fundo, para nao cruzarem a cota da saia.
   */
  function chamadasInternas() {
    const v = 'frontal';
    const xT = px(v, R) + 9;
    const item = (nome, xo, yo, yTxt) => {
      P.grupo(`Chamada · ${nome}`, () => {
        circ(xo, yo, 0.35, 'seta');
        linha(xo, yo, xT - 1.5, yTxt, 'fina');
        linha(xT - 1.5, yTxt, xT - 0.4, yTxt, 'fina');
      });
      P.texto(`Nome · ${nome}`, xT, yTxt + 0.9, nome, 'cotatxt', { anchor: 'start' });
    };
    const base = g.saiaAltura;
    if (g.demister) {
      const yPad = base + g.Ltan + ABA - g.demister.abaixoDoTopo - g.demister.espessura / 2;
      item('Eliminador de névoa (demister)', px(v, g.Di * 0.28), py(yPad), py(yPad + 0.17));
    }
    if (g.defletor) {
      const b = bocalPorId(g.defletor.bocal);
      const u = (g.Di / 2 - g.defletor.afastamento) * Math.cos((b.ang * Math.PI) / 180);
      item('Placa defletora de entrada', px(v, u), py(base + b.y + g.defletor.altura / 2 - 0.04),
        py(base + b.y + 0.14));
    }
    if (g.quebraVortice) {
      const yF = base - ABA - perfilTampo(g.tampoFundo, g.Di / 2).at(-1).y;
      item('Quebra-vórtice', px(v, g.quebraVortice.largura / 2), py(yF + g.quebraVortice.altura),
        py(base + 0.35));
    }
  }

  function cotasHorizontal() {
    const v = 'frontal', Ri = g.Di / 2;
    const meio = g.Ltan / 2;
    const y1 = py(TOPO_MUNDO) - 5, y2 = py(TOPO_MUNDO) - 11;
    chamadaV('T/T esquerda', px(v, -meio), pv(Riso), y1);
    chamadaV('T/T direita', px(v, meio), pv(Riso), y1);
    cotaH('T/T', y1, px(v, -meio), px(v, meio), `T/T ${fmt(g.Ltan)} m`);
    chamadaV('comprimento esquerda', px(v, -MEIO_COMP), pv(0), y2);
    chamadaV('comprimento direita', px(v, MEIO_COMP), pv(0), y2);
    cotaH('comprimento total', y2, px(v, -MEIO_COMP), px(v, MEIO_COMP), `Comprimento total ${fmt(2 * MEIO_COMP)} m`);

    const xe = px(v, -MEIO_COMP) - 7;
    chamadaH('eixo', px(v, -MEIO_COMP), xe, Y_EIXO);
    chamadaH('eixo (piso)', px(v, -meio), xe, py(0));
    cotaV('eixo', xe, py(0), Y_EIXO, `Eixo ${fmt(g.alturaEixo)} m`);

    const L = 'lateral';
    const yd = py(TOPO_MUNDO) - 5;
    chamadaV('Ø int. esquerda', px(L, -Ri), pv(0), yd);
    chamadaV('Ø int. direita', px(L, Ri), pv(0), yd);
    cotaH('Ø int.', yd, px(L, -Ri), px(L, Ri), `Ø int. ${fmt(g.Di)} m`);

    const xn = px(L, 0) + COTA1;
    if (NIVEL !== null) {
      chamadaH('nível (superfície)', px(L, Ri * 0.5), xn, pv(NIVEL - Ri));
      chamadaH('nível (fundo)', px(L, 0), xn, pv(-Ri));
      cotaV('nível', xn, pv(-Ri), pv(NIVEL - Ri), `Nível ${fmt(NIVEL)} m`);
    }
    if (INTERFACE !== null) {
      const xi = px(L, 0) - COTA1;
      chamadaH('interface', px(L, -Ri * 0.4), xi, pv(INTERFACE - Ri));
      chamadaH('interface (fundo)', px(L, 0), xi, pv(-Ri));
      cotaV('interface', xi, pv(-Ri), pv(INTERFACE - Ri), `Interface ${fmt(INTERFACE)} m`);
    }
  }

  function legenda() {
    const x = MARGEM + 3, y0 = MARGEM + 5.5;
    const col = 95, linhas = Math.ceil(BOCAIS.length / 2);
    P.texto('Tabela de bocais · título', x, y0, 'TABELA DE BOCAIS', 'legt');
    P.grupo('Tabela de bocais · fio', () => linha(x, y0 + 1.4, x + 2 * col - 6, y0 + 1.4, 'fina'));
    BOCAIS.forEach((b, i) => {
      const c = i < linhas ? 0 : 1, l = i % linhas;
      const xx = x + c * col, yy = y0 + 5.0 + l * 3.2;
      P.texto(`Tabela · ${b.id}`, xx, yy, b.id, 'leg');
      P.texto(`Tabela · ${b.id} DN`, xx + 9, yy, `DN ${b.dn}`, 'legs');
      P.texto(`Tabela · ${b.id} serviço`, xx + 20, yy, b.servico, 'legs');
    });
  }

  /* --- montagem --- */
  moldura(P);
  montarVista('frontal', HORIZ ? 'VISTA LONGITUDINAL' : 'VISTA FRONTAL');
  montarVista('lateral', HORIZ ? 'VISTA TRANSVERSAL' : 'VISTA LATERAL');
  if (HORIZ) cotasHorizontal(); else cotasVertical();
  if (!HORIZ && (g.defletor || g.quebraVortice)) chamadasInternas();
  if (!semBocais) legenda();
  carimbo(P, { nome: EQ.nome, tag: EQ.tag, escala: `Escala 1:${ESCALA}`, cotas: 'Cotas em metros', logo });

  return { EQ, ESCALA, corpo: P.html() };
}

/* ==========================================================================
 *  Arquivo .dc.html
 * ======================================================================= */
function prancha(titulo, corpo) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(titulo)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
</style>
</helmet>
<div data-nome="Folha A4" style="position: relative; width: ${LARGURA_PX}px; height: ${ALTURA_PX}px; overflow: hidden; background: #ffffff; font-family: Arial, Helvetica, sans-serif; color: #000000">
${corpo}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${LARGURA_PX},"height":${ALTURA_PX}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}

/* ==========================================================================
 *  Linha de comando
 * ======================================================================= */
const args = process.argv.slice(2);
const opt = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null; };
const LOGO = opt('--logo');
const SAIDA = opt('--saida');
const CARIMBOS = opt('--carimbos');
const tags = args.filter((a) => /^[A-Z]{1,3}-\d{2}$/.test(a));
const OPCOES = {
  semBocais: args.includes('--sem-bocais'),          // sem tabela e sem rotulos de bocal
  semPlataforma: args.includes('--sem-plataforma'),  // sem plataforma e sua cota
};

if (SAIDA) {
  mkdirSync(SAIDA, { recursive: true });
  for (const tag of tags) {
    const { EQ, ESCALA, corpo } = gerarFolha(tag, LOGO, OPCOES);
    const arq = join(SAIDA, `${tag}.dc.html`);
    writeFileSync(arq, prancha(`Croqui ${tag} — ${EQ.nome}`, corpo), 'utf8');
    console.log(`OK  ${arq}  (1:${ESCALA})`);
  }
}

/* Moldura + carimbo prontos, para as folhas montadas sobre imagem. */
if (CARIMBOS) {
  const todos = { ...EXTRAS, ...EQUIPAMENTOS };
  const pedidos = JSON.parse(opt('--folhas') ?? 'null')
    ?? Object.keys(todos).map((t) => ({ tag: t }));
  const saida = {};
  for (const f of pedidos) {
    const eq = todos[f.tag];
    if (!eq) throw new Error(`Equipamento "${f.tag}" desconhecido.`);
    const P = novaPrancha();
    moldura(P);
    carimbo(P, {
      nome: eq.nome, tag: eq.tag, logo: LOGO,
      escala: f.escala ?? 'Sem escala', cotas: f.cotas ?? 'Cotas em metros',
    });
    saida[f.tag] = { nome: eq.nome, html: P.html() };
  }
  writeFileSync(CARIMBOS, JSON.stringify(saida, null, 1), 'utf8');
  console.log(`OK  ${CARIMBOS}  (${Object.keys(saida).length} carimbos)`);
}

/**
 * Folhas montadas sobre imagem (croquis que nao vem de plant.js): a imagem
 * de cada vista, os tracos e rotulos de cota como elementos proprios, ja em
 * metros, e o titulo da vista. O arquivo de folhas e o mapa imagem -> url do
 * upload vem do preparo das imagens.
 */
const FOLHAS_IMAGEM = opt('--folhas-imagem');
if (FOLHAS_IMAGEM && SAIDA) {
  const todos = { ...EXTRAS, ...EQUIPAMENTOS };
  const folhas = JSON.parse(readFileSync(FOLHAS_IMAGEM, 'utf8'));
  const blobs = JSON.parse(readFileSync(opt('--blobs'), 'utf8'));
  for (const f of folhas) {
    const eq = todos[f.tag];
    const P = novaPrancha();
    moldura(P);
    f.vistas.forEach((v, k) => {
      const V = `Vista ${k + 1}`;
      const [x, y, w, h] = v.img;
      P.imagem(`${V} · desenho`, blobs[v.arq], x, y, w, h);
      const [s, tx, ty] = v.transf;
      v.tracos.forEach((tr, i) => {
        const at = Object.entries(tr.at).map(([a, val]) => `${a}="${val}"`).join(' ');
        P.grupo(`${V} · traço de cota ${i + 1}`, () => P.bruto(
          `<path d="${tr.d}" ${at} transform="matrix(${n(s)} 0 0 ${n(s)} ${n(tx)} ${n(ty)})"></path>`,
          tr.pts));
      });
      for (const r of v.rotulos) {
        P.texto(`${V} · cota ${r.t}`, r.x, r.y, r.t, { fs: r.fs, halo: false }, { rot: r.rot, centro: true });
      }
      P.texto(`${V} · título`, v.tituloX, v.tituloY, v.titulo, 'vista', { anchor: 'middle' });
    });
    carimbo(P, { nome: eq.nome, tag: eq.tag, logo: LOGO, escala: 'Sem escala', cotas: 'Cotas em metros' });
    const arq = join(SAIDA, `${f.tag}.dc.html`);
    writeFileSync(arq, prancha(`Croqui ${f.tag} — ${eq.nome}`, P.html()), 'utf8');
    console.log(`OK  ${arq}`);
  }
}

if (!SAIDA && !CARIMBOS) {
  console.error('Uso: --saida <pasta> TAG...  e/ou  --carimbos <arquivo.json> [--folhas <json>]  [--logo <url>]');
  process.exit(1);
}
