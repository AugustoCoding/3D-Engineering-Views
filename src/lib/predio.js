import * as THREE from 'three';
import { triplanar } from './texturas.js';

/**
 * ===========================================================================
 *  PREDIO  (Fase 7; oco desde a Fase 16)
 * ===========================================================================
 *  Casca de alvenaria com a fachada pintada em canvas: parede com espessura,
 *  janelas de vidro de verdade (vao recortado nas duas faces), vao de porta
 *  com as duas folhas abrindo para dentro, piso, forro, laje de cobertura com
 *  platibanda ou telhado de galpao e, com mais de um pavimento, laje entre
 *  eles com a escada. O que vai dentro (paredes internas, moveis) e de
 *  site/interiores.js; aqui so a casca e o que ela oferece a quem mobilia
 *  (`userData.interno`), a quem anda (`userData.colisores`) e a quem anima as
 *  portas (`userData.portas`).
 *
 *  Nada de textura externa — o HTML entregue precisa continuar autocontido e
 *  leve, e uma fachada de 30 m em canvas pesa poucos kB na memoria de video.
 *  Canvas sem `colorSpace = SRGBColorSpace` sai lavado (armadilha ja paga).
 *
 *  Lados: '+x' leste, '-x' oeste, '+z' sul, '-z' norte. Cada parede e
 *  desenhada no plano local XY, com a face de fora em z = 0 olhando +z e o x
 *  crescendo para a direita de quem olha de fora; o giro a leva ao lado.
 */

const PX = 20;                       // pixels por metro de fachada
export const PE_DIREITO = 3.5;
// [ADOTADO] bloco de 14 cm com reboco dos dois lados; laje de cobertura e
// entrepiso macicos; porta de duas folhas de 0,9 m (passa maca e carrinho)
export const PAREDE = 0.2;
const LAJE = 0.25, ENTREPISO = 0.2;
export const PORTA = { largura: 1.8, altura: 2.3 };
const LARGURA_PORTAO = 4, LARGURA_DOCA = 3;
// portao de garagem (27/10, o autor: o caminhao entra no armazem e e
// carregado la dentro): vao de 5 x 5,5 m para caminhao de 2,6 m de largura e
// ate 4,4 m de altura (limites do CONTRAN), com porta de enrolar [ADOTADO]
export const GARAGEM = { largura: 5, altura: 5.5 };
const GALVANIZADO = new THREE.MeshStandardMaterial({ color: 0xa9b1b8, metalness: 0.6, roughness: 0.45, name: 'galvanizado' });
// escada reta [ADOTADO, NBR 9050/9077]: espelho ate 18 cm, piso de 28 cm, 1,2 m de
// largura, e 1,5 m da parede do fundo ate o primeiro degrau (1,2 m livres para chegar)
export const ESCADA = { espelhoMax: 0.18, piso: 0.28, largura: 1.2, recuo: 1.5 };
const EIXO_Y = new THREE.Vector3(0, 1, 0);

/**
 * Vaos de uma fachada, em metros a partir da borda esquerda (de quem olha de
 * fora) e do piso: porta, janelas, portoes, docas e garagens. A pintura e a
 * geometria leem daqui — uma conta so. `garagens`: centros, em metros da
 * borda esquerda (o portao fica na faixa por onde o caminhao chega).
 */
export function vaosDaFachada({ largura, altura, pavimentos = 1, galpao = false, janelas = true, porta = false, portoes = 0, docas = 0, garagens = [] }) {
  const v = { porta: null, janelas: [], portoes: [], docas: [], garagens: [] };
  // vaos ocupados por portas: as janelas desviam deles
  const ocupados = [];
  for (const xc of garagens) {
    v.garagens.push({ x0: xc - GARAGEM.largura / 2, x1: xc + GARAGEM.largura / 2, y0: 0, y1: GARAGEM.altura });
    ocupados.push([xc - GARAGEM.largura / 2 - 0.5, xc + GARAGEM.largura / 2 + 0.5]);
  }
  if (porta) {
    // no meio da fachada; com garagem no meio, no ponto livre mais perto dele
    let xp = largura / 2;
    const tapa = (x) => ocupados.some(([o0, o1]) => x + 1.2 > o0 && x - 1.2 < o1);
    for (let d = 0; tapa(xp) && d < largura / 2; d += 0.5) xp = [largura / 2 + d, largura / 2 - d].find((x) => !tapa(x) && x > 1.5 && x < largura - 1.5) ?? xp;
    v.porta = { x0: xp - PORTA.largura / 2, x1: xp + PORTA.largura / 2, y0: 0, y1: PORTA.altura };
    ocupados.push([xp - 1.2, xp + 1.2]);
  }
  const posicoes = (n, l) => Array.from({ length: n }, (_, i) => ((i + 1) * largura) / (n + 1) - l / 2);
  for (const x of posicoes(portoes, LARGURA_PORTAO)) {
    v.portoes.push({ x0: x, x1: x + LARGURA_PORTAO, y0: 0, y1: 4.5 });
    ocupados.push([x - 0.5, x + LARGURA_PORTAO + 0.5]);
  }
  for (const x of posicoes(docas, LARGURA_DOCA)) {
    v.docas.push({ x0: x, x1: x + LARGURA_DOCA, y0: 1.2, y1: 4.3 });     // porta da doca a 1,2 m
    ocupados.push([x - 0.5, x + LARGURA_DOCA + 0.5]);
  }
  const livre = (a, b) => !ocupados.some(([o0, o1]) => b > o0 && a < o1);
  if (janelas) {
    if (galpao) {
      // faixa de janelas alta, que e o que ilumina galpao
      for (let x = 1; x + 2 < largura; x += 3) v.janelas.push({ x0: x, x1: x + 2, y0: altura - 1.2, y1: altura - 0.4 });
    } else {
      for (let p = 0; p < pavimentos; p++) {
        const y0 = p * PE_DIREITO + 1.0;
        for (let x = 0.8; x + 1.6 < largura - 0.6; x += 2.8) {
          if (livre(x, x + 1.6)) v.janelas.push({ x0: x, x1: x + 1.6, y0, y1: y0 + 1.3 });
        }
      }
    }
  }
  return v;
}

function texturaFachada({ largura, altura, cor, vaos, faixa, sinal }) {
  const w = Math.max(64, Math.min(2048, Math.round(largura * PX)));
  const h = Math.max(32, Math.min(512, Math.round(altura * PX)));
  const kx = w / largura, ky = h / altura;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const Y = (m) => h - m * ky;                      // metros acima do piso -> pixel

  g.fillStyle = cor;
  g.fillRect(0, 0, w, h);
  // reboco: grao fino e manchas leves, com semente pela largura (estavel)
  let s = Math.round(largura * 1000) || 1;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < (w * h) / 6; k++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
  for (let k = 0; k < 6; k++) {
    g.fillStyle = 'rgba(80,70,60,0.05)';
    g.fillRect(r() * w, h * 0.55 + r() * h * 0.45, w * 0.15 * r(), h * 0.4);
  }
  g.fillStyle = 'rgba(0,0,0,0.16)';                 // rodape
  g.fillRect(0, Y(0.4), w, 0.4 * ky);
  if (faixa) {
    g.fillStyle = faixa;
    g.fillRect(0, Y(altura - 0.4), w, 0.5 * ky);
  }
  // Fachada cega (sala de controle para o processo, casa de cubiculos):
  // venezianas altas de ventilacao a cada 4 m — a parede lisa de 16 m
  // parecia inacabada (Fase 18)
  if (!vaos.janelas.length && !vaos.portoes.length && !vaos.docas.length && altura > 3) {
    // o letreiro grande ocupa o meio da fachada: nao pinta veneziana embaixo dele
    const meiaPlaca = sinal ? sinal.largura / 2 + 0.3 : 0;
    for (let x = 1.4; x + 1.4 < largura - 1.0; x += 4) {
      if (vaos.porta && x + 1.4 > vaos.porta.x0 - 0.3 && x < vaos.porta.x1 + 0.3) continue;
      if (x + 1.4 > largura / 2 - meiaPlaca && x < largura / 2 + meiaPlaca) continue;
      const y1 = altura - 0.55, y0 = y1 - 0.6;
      g.fillStyle = '#7d848b';
      g.fillRect(x * kx, Y(y1), 1.4 * kx, (y1 - y0) * ky);
      g.strokeStyle = 'rgba(30,34,38,0.55)';
      g.lineWidth = Math.max(1, ky * 0.03);
      for (let yy = y0 + 0.1; yy < y1; yy += 0.1) {
        g.beginPath(); g.moveTo(x * kx, Y(yy)); g.lineTo((x + 1.4) * kx, Y(yy)); g.stroke();
      }
    }
  }
  // contorno das janelas (o vao e recortado na geometria; a pintura so faz
  // a moldura, que se ve de longe)
  g.fillStyle = '#c9c6bf';
  for (const j of vaos.janelas) g.fillRect((j.x0 - 0.06) * kx, Y(j.y1 + 0.06), (j.x1 - j.x0 + 0.12) * kx, (j.y1 - j.y0 + 0.12) * ky);
  g.fillStyle = '#4f6475';
  for (const j of vaos.janelas) g.fillRect(j.x0 * kx, Y(j.y1), (j.x1 - j.x0) * kx, (j.y1 - j.y0) * ky);
  for (const p of vaos.portoes) {
    g.fillStyle = '#8b939b';
    g.fillRect(p.x0 * kx, Y(p.y1), LARGURA_PORTAO * kx, p.y1 * ky);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let yy = 0.3; yy < p.y1; yy += 0.3) {
      g.beginPath(); g.moveTo(p.x0 * kx, Y(yy)); g.lineTo(p.x1 * kx, Y(yy)); g.stroke();
    }
  }
  // marco de chapa em volta do portao de garagem (o vao e recortado)
  g.fillStyle = '#4a5058';
  for (const q of vaos.garagens) g.fillRect((q.x0 - 0.15) * kx, Y(q.y1 + 0.15), (q.x1 - q.x0 + 0.3) * kx, (q.y1 + 0.15) * ky);
  for (const d of vaos.docas) {
    g.fillStyle = '#6f777f';
    g.fillRect(d.x0 * kx, Y(d.y1), LARGURA_DOCA * kx, (d.y1 - d.y0) * ky);
    g.fillStyle = '#222';
    g.fillRect(d.x0 * kx, Y(d.y0 + 0.1), LARGURA_DOCA * kx, 0.15 * ky);      // para-choque
  }
  // o nome nao e pintado aqui: vai numa placa propria, nitida (placaDeNome)

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Onde e de que tamanho vai o nome numa fachada: sobre a porta (grande, se
 * o letreiro e desta fachada; senao, uma plaquinha) ou, sem porta, o
 * letreiro grande acima das janelas do ultimo pavimento (cada uma vai ate
 * 2,3 m do piso dele) ou dos portoes e docas (ate 4,5 m), abaixo da
 * platibanda ou da faixa alta do galpao. Devolve { fs, y, largura } em
 * metros (altura da letra, meio da placa, largura da placa) ou null. A
 * pintura (venezianas) e a placa leem daqui.
 */
function letreiroDaFachada({ largura, altura, pavimentos, galpao, vaos, nome, letreiro, icone }) {
  if (!nome) return null;
  let fs, y;
  if (vaos.porta && !vaos.garagens.length) {
    fs = letreiro ? 0.5 : 0.28;
    y = letreiro ? 3.15 : 2.7;
  } else if (letreiro || vaos.garagens.length) {
    const y0 = galpao ? (vaos.garagens.length ? GARAGEM.altura + 0.4 : vaos.portoes.length || vaos.docas.length ? 4.6 : 2.45) : (pavimentos - 1) * PE_DIREITO + 2.45;
    const y1 = galpao ? altura - 1.3 : altura - 0.25;
    fs = Math.min(0.75, (y1 - y0) / (ALTURA_PLACA + 0.1));
    y = y0 + (ALTURA_PLACA / 2) * fs;
  } else return null;
  // nao passa da largura da fachada; a largura cresce com a letra
  const w1 = medidasPlaca(nome, 1, icone).W / PX_PLACA;
  fs = Math.min(fs, (largura - 0.4) / w1);
  return { fs, y, largura: w1 * fs };
}

/* Placa de nome (27/10, pedidos do autor: pintado na fachada, a 20 px/m,
 * o letreiro ficava pixelado; a chapa lisa com o texto ficou feia). Placa de
 * sinalizacao de fachada: chapa de cantos arredondados afastada 2 cm da
 * parede, com o pictograma do uso num quadrado da cor dele, o nome em branco
 * e um filete da mesma cor embaixo; levemente acesa, para se ler na sombra.
 * Canvas proprio a PX_PLACA px por metro de letra. [ADOTADO] */
const PX_PLACA = 200;
const ALTURA_PLACA = 1.7;                     // altura da placa / altura da letra
const FONTE_PLACA = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const PLACA_CORPO = new THREE.MeshStandardMaterial({ color: 0x1b2531, metalness: 0.4, roughness: 0.5, name: 'placa-corpo' });

/* Pictogramas, num quadrado unitario, em branco sobre a cor do uso. */
const ICONES = {
  controle: { cor: '#2f80ed', desenho(c) {
    c.strokeRect(0.17, 0.22, 0.66, 0.44);
    c.beginPath(); c.moveTo(0.27, 0.55); c.lineTo(0.39, 0.43); c.lineTo(0.5, 0.5); c.lineTo(0.62, 0.33); c.lineTo(0.73, 0.4); c.stroke();
    c.beginPath(); c.moveTo(0.5, 0.66); c.lineTo(0.5, 0.77); c.moveTo(0.33, 0.79); c.lineTo(0.67, 0.79); c.stroke();
  } },
  laboratorio: { cor: '#17a589', desenho(c) {
    c.beginPath(); c.moveTo(0.42, 0.2); c.lineTo(0.42, 0.42); c.lineTo(0.23, 0.79); c.lineTo(0.77, 0.79); c.lineTo(0.58, 0.42); c.lineTo(0.58, 0.2); c.stroke();
    c.beginPath(); c.moveTo(0.35, 0.2); c.lineTo(0.65, 0.2); c.stroke();
    c.beginPath(); c.moveTo(0.33, 0.6); c.lineTo(0.67, 0.6); c.lineTo(0.77, 0.79); c.lineTo(0.23, 0.79); c.closePath(); c.fill();
  } },
  oficina: { cor: '#e67e22', desenho(c) {
    c.beginPath();
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2, r = k % 4 < 2 ? 0.33 : 0.25;
      c.lineTo(0.5 + r * Math.cos(a + 0.1), 0.5 + r * Math.sin(a + 0.1));
    }
    c.closePath(); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(0.5, 0.5, 0.11, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-over';
  } },
  armazem: { cor: '#c9971c', desenho(c) {
    c.strokeRect(0.2, 0.36, 0.6, 0.44);
    c.beginPath(); c.moveTo(0.2, 0.36); c.lineTo(0.3, 0.2); c.lineTo(0.7, 0.2); c.lineTo(0.8, 0.36); c.stroke();
    c.fillRect(0.45, 0.36, 0.1, 0.16);
  } },
  brigada: { cor: '#c0392b', desenho(c) {
    c.fillRect(0.4, 0.18, 0.2, 0.64); c.fillRect(0.18, 0.4, 0.64, 0.2);
  } },
  adm: { cor: '#3d6fb6', desenho(c) {
    c.strokeRect(0.28, 0.17, 0.44, 0.66);
    for (const y of [0.29, 0.43, 0.57]) for (const x of [0.37, 0.55]) c.fillRect(x, y, 0.08, 0.07);
    c.fillRect(0.45, 0.71, 0.1, 0.12);
  } },
  refeitorio: { cor: '#2e9e5b', desenho(c) {
    c.beginPath();
    for (const x of [0.29, 0.36, 0.43]) { c.moveTo(x, 0.18); c.lineTo(x, 0.38); }
    c.moveTo(0.29, 0.38); c.quadraticCurveTo(0.36, 0.48, 0.43, 0.38);
    c.moveTo(0.36, 0.44); c.lineTo(0.36, 0.82);
    c.stroke();
    c.beginPath(); c.moveTo(0.63, 0.18); c.quadraticCurveTo(0.78, 0.32, 0.72, 0.52); c.lineTo(0.66, 0.52); c.lineTo(0.66, 0.82); c.lineTo(0.6, 0.82); c.lineTo(0.6, 0.2); c.closePath(); c.fill();
  } },
  incendio: { cor: '#c0392b', desenho(c) {
    c.beginPath(); c.moveTo(0.5, 0.84);
    c.bezierCurveTo(0.26, 0.84, 0.22, 0.6, 0.36, 0.44);
    c.bezierCurveTo(0.38, 0.56, 0.44, 0.6, 0.48, 0.58);
    c.bezierCurveTo(0.42, 0.4, 0.5, 0.26, 0.6, 0.16);
    c.bezierCurveTo(0.6, 0.34, 0.8, 0.42, 0.76, 0.62);
    c.bezierCurveTo(0.74, 0.76, 0.64, 0.84, 0.5, 0.84);
    c.fill();
  } },
  energia: { cor: '#d9a404', desenho(c) {
    c.beginPath(); c.moveTo(0.58, 0.14); c.lineTo(0.28, 0.55); c.lineTo(0.47, 0.55); c.lineTo(0.4, 0.86); c.lineTo(0.72, 0.42); c.lineTo(0.53, 0.42); c.closePath(); c.fill();
  } },
  agua: { cor: '#2a8fd0', desenho(c) {
    c.beginPath(); c.moveTo(0.5, 0.15);
    c.bezierCurveTo(0.42, 0.3, 0.27, 0.47, 0.27, 0.6);
    c.arc(0.5, 0.6, 0.23, Math.PI, 0, true);
    c.bezierCurveTo(0.73, 0.47, 0.58, 0.3, 0.5, 0.15);
    c.fill();
  } },
};

/** Medidas da placa em pixels (a fs metros de letra): uma conta so para a placa e a fachada. */
function medidasPlaca(texto, fs, icone) {
  const px = Math.round(fs * PX_PLACA);
  const H = Math.round(px * ALTURA_PLACA);
  const pad = Math.round(px * 0.32);
  const tile = ICONES[icone] ? H - 2 * pad : 0;
  let textW = texto.length * 0.56 * px;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `600 ${px}px ${FONTE_PLACA}`;
    textW = c.measureText(texto).width;
  }
  const W = Math.min(4096, Math.ceil((tile ? pad + tile + pad * 1.1 : pad * 1.7) + textW + pad * 1.7));
  return { px, H, pad, tile, textW, W };
}

function placaDeNome(texto, fs, icone) {
  const g = new THREE.Group();
  g.name = 'letreiro';
  const { px, H, pad, tile, W } = medidasPlaca(texto, fs, icone);
  const w = W / PX_PLACA, h = H / PX_PLACA, raio = Math.min(h * 0.16, 0.1);

  // corpo: chapa extrudada de cantos redondos, com a borda chanfrada
  const forma = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2;
  forma.moveTo(x0 + raio, y0);
  forma.lineTo(x0 + w - raio, y0); forma.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + raio);
  forma.lineTo(x0 + w, y0 + h - raio); forma.quadraticCurveTo(x0 + w, y0 + h, x0 + w - raio, y0 + h);
  forma.lineTo(x0 + raio, y0 + h); forma.quadraticCurveTo(x0, y0 + h, x0, y0 + h - raio);
  forma.lineTo(x0, y0 + raio); forma.quadraticCurveTo(x0, y0, x0 + raio, y0);
  const corpo = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6,
  }), PLACA_CORPO);
  corpo.position.z = 0.026;                    // 2 cm de afastamento da parede
  corpo.castShadow = true;
  g.add(corpo);
  if (typeof document === 'undefined') return { grupo: g, w, h };

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  const r = raio * PX_PLACA;
  const arred = (x, y, l, a, rr) => {
    c.beginPath();
    c.moveTo(x + rr, y); c.arcTo(x + l, y, x + l, y + a, rr); c.arcTo(x + l, y + a, x, y + a, rr);
    c.arcTo(x, y + a, x, y, rr); c.arcTo(x, y, x + l, y, rr); c.closePath();
  };
  const ic = ICONES[icone];
  const destaque = ic?.cor ?? '#7f8c99';
  const filete = Math.round(H * 0.07);
  arred(0, 0, W, H, r);
  c.save();
  c.clip();
  const fundo = c.createLinearGradient(0, 0, 0, H);
  fundo.addColorStop(0, '#2a3a4c');
  fundo.addColorStop(1, '#1b2531');
  c.fillStyle = fundo;
  c.fillRect(0, 0, W, H);
  c.fillStyle = destaque;                       // filete embaixo
  c.fillRect(0, H - filete, W, filete);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.10)';
  c.lineWidth = Math.max(2, px * 0.02);
  arred(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth, r);
  c.stroke();
  let xTexto = pad * 1.7;
  if (ic) {
    const yT = (H - filete - tile) / 2;
    c.fillStyle = destaque;
    arred(pad, yT, tile, tile, tile * 0.18);
    c.fill();
    c.save();
    c.translate(pad, yT);
    c.scale(tile, tile);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#ffffff';
    c.lineWidth = 0.075;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    ic.desenho(c);
    c.restore();
    xTexto = pad + tile + pad * 1.1;
  }
  c.font = `600 ${px}px ${FONTE_PLACA}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillStyle = '#f4f6f8';
  c.fillText(texto, xTexto, (H - filete) / 2 + px * 0.04);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, alphaTest: 0.5, roughness: 0.45, metalness: 0.1,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18, name: `letreiro-${texto}`,
  });
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  frente.position.z = 0.026 + 0.03 + 0.006 + 0.001;
  g.add(frente);
  return { grupo: g, w, h };
}

/* Por dentro: sem sombra projetada nem recebida. A laje faria sombra no
 * interior inteiro, e o que se quer ver dentro e o arranjo, nao o escuro. */
function interno(m) {
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}
// Um pouco de emissao no reboco e mais no forro: sob a laje so chega a luz
// do ceu pelas janelas, e o forro, virado para baixo, ficava cinza-escuro.
const REBOCO = new THREE.MeshStandardMaterial({
  color: 0xeeebe4, roughness: 0.92, side: THREE.BackSide, emissive: 0xeeebe4, emissiveIntensity: 0.12, name: 'reboco-interno',
});
const REBOCO_VAO = new THREE.MeshStandardMaterial({ color: 0xe2ded6, roughness: 0.92, name: 'reboco-vao' });
// vidro fume: de fora le como janela (escuro, reflete o ceu); de dentro deixa ver
const VIDRO = new THREE.MeshStandardMaterial({
  color: 0x3f5a6a, metalness: 0.45, roughness: 0.05, transparent: true, opacity: 0.68,
  depthWrite: false, side: THREE.DoubleSide, name: 'vidro-janela',
});
// vidro fosco (Fase 18): deixa passar luz, nao a vista — vestiario e ambulatorio
export const VIDRO_FOSCO = new THREE.MeshStandardMaterial({
  color: 0xdfe6e8, roughness: 0.9, transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  emissive: 0xdfe6e8, emissiveIntensity: 0.15, name: 'vidro-fosco',
});
const FORRO = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.95, emissive: 0xf3f2ee, emissiveIntensity: 0.5, name: 'forro' });
const PISO = triplanar(new THREE.MeshStandardMaterial({ color: 0xd8d5ce, roughness: 0.65, name: 'piso-interno' }), 'piso', 2.4);
const FOLHA = new THREE.MeshStandardMaterial({ color: 0x5d6b78, metalness: 0.4, roughness: 0.5, name: 'folha-porta' });
const CONDENSADORA = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 0.3, roughness: 0.55, name: 'condensadora' });
const CORRIMAO = new THREE.MeshStandardMaterial({ color: 0x8d949b, metalness: 0.6, roughness: 0.4, name: 'corrimao' });

/**
 * Parede de comprimento L e altura H (do piso; desce 0,1 m para nao deixar
 * fresta), espessura E, com os buracos [{x0, x1, y0, y1, vidro}]. A face de
 * dentro e a mesma geometria vista por tras, recuada E: os buracos coincidem
 * sem conta nenhuma. Os vaos ganham as faces laterais e, os de janela, vidro
 * no meio da espessura.
 */
function paredeComVaos({ L, H, E, buracos, fora }) {
  const g = new THREE.Group();
  g.name = 'parede';
  const s = new THREE.Shape();
  s.moveTo(-L / 2, -0.1); s.lineTo(L / 2, -0.1); s.lineTo(L / 2, H); s.lineTo(-L / 2, H); s.closePath();
  for (const b of buracos) {
    const h = new THREE.Path();
    h.moveTo(b.x0 - L / 2, b.y0); h.lineTo(b.x1 - L / 2, b.y0); h.lineTo(b.x1 - L / 2, b.y1); h.lineTo(b.x0 - L / 2, b.y1); h.closePath();
    s.holes.push(h);
  }
  const geo = new THREE.ShapeGeometry(s);
  // UV: a fachada inteira (L x H) no canvas, como se ve de fora
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + L / 2) / L, pos.getY(i) / H);
  const ext = new THREE.Mesh(geo, fora);
  ext.castShadow = true;
  ext.receiveShadow = true;
  g.add(ext);
  const int = interno(new THREE.Mesh(geo, REBOCO));
  int.position.z = -E;
  g.add(int);
  for (const b of buracos) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, xc = (b.x0 + b.x1) / 2 - L / 2, yc = (b.y0 + b.y1) / 2;
    const tiras = [[0.02, h, xc - w / 2, yc], [0.02, h, xc + w / 2, yc], [w, 0.02, xc, b.y1]];
    if (b.y0 > 0) tiras.push([w, 0.02, xc, b.y0]);
    for (const [dx, dy, x, y] of tiras) {
      const t = interno(new THREE.Mesh(new THREE.BoxGeometry(dx, dy, E), REBOCO_VAO));
      t.position.set(x, y, -E / 2);
      g.add(t);
    }
    if (b.vidro) {
      const v = interno(new THREE.Mesh(new THREE.PlaneGeometry(w, h), VIDRO));
      v.position.set(xc, yc, -E / 2);
      g.add(v);
    }
  }
  return g;
}

/** Retangulo menos um buraco: ate quatro faixas que o cobrem. */
function menos(r, b) {
  if (!b) return [r];
  return [
    { x0: r.x0, x1: b.x0, z0: r.z0, z1: r.z1 }, { x0: b.x1, x1: r.x1, z0: r.z0, z1: r.z1 },
    { x0: b.x0, x1: b.x1, z0: r.z0, z1: b.z0 }, { x0: b.x0, x1: b.x1, z0: b.z1, z1: r.z1 },
  ].filter((q) => q.x1 - q.x0 > 1e-3 && q.z1 - q.z0 > 1e-3);
}

function placaHorizontal(q, y, esp, mat) {
  const m = interno(new THREE.Mesh(new THREE.BoxGeometry(q.x1 - q.x0, esp, q.z1 - q.z0), mat));
  m.position.set((q.x0 + q.x1) / 2, y - esp / 2, (q.z0 + q.z1) / 2);
  return m;
}

function forroEm(q, y) {
  const m = interno(new THREE.Mesh(new THREE.PlaneGeometry(q.x1 - q.x0, q.z1 - q.z0), FORRO));
  m.rotation.x = Math.PI / 2;                      // olhando para baixo
  m.position.set((q.x0 + q.x1) / 2, y, (q.z0 + q.z1) / 2);
  return m;
}

/**
 * Escada reta macica de um pavimento, subindo no sentido `dir` ([dx, dz]
 * unitario, ao longo de um eixo) a partir de `inicio` ([x, z] do meio do
 * primeiro degrau, na borda), com corrimao no lado `aberto` (+1/-1, a
 * direita/esquerda de quem sobe).
 */
function escadaReta({ inicio: [x0, z0], dir: [dx, dz], y0, sobe, largura, aberto }) {
  const g = new THREE.Group();
  g.name = 'escada';
  const n = Math.ceil(sobe / ESCADA.espelhoMax), e = sobe / n, pisada = ESCADA.piso;
  for (let i = 0; i < n; i++) {
    const h = (i + 1) * e;
    const d = interno(new THREE.Mesh(new THREE.BoxGeometry(dx ? pisada : largura, h, dz ? pisada : largura), REBOCO_VAO));
    d.position.set(x0 + dx * (i + 0.5) * pisada, y0 + h / 2, z0 + dz * (i + 0.5) * pisada);
    g.add(d);
  }
  // corrimao a 0,9 m da quina dos degraus, no lado aberto
  const lado = [-dz * aberto, dx * aberto];          // direita de quem sobe, se aberto = +1
  const off = largura / 2 - 0.05;
  const a = new THREE.Vector3(x0 + lado[0] * off, y0 + e + 0.9, z0 + lado[1] * off);
  const b = new THREE.Vector3(x0 + lado[0] * off + dx * n * pisada, y0 + sobe + 0.9, z0 + lado[1] * off + dz * n * pisada);
  const barra = (p, q, r) => {
    const m = interno(new THREE.Mesh(new THREE.CylinderGeometry(r, r, p.distanceTo(q), 8), CORRIMAO));
    m.position.copy(p).add(q).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(EIXO_Y, q.clone().sub(p).normalize());
    g.add(m);
  };
  barra(a, b, 0.025);
  for (const t of [0, 0.5, 1]) {
    const p = a.clone().lerp(b, t);
    barra(p.clone().setY(p.y - 0.9), p, 0.02);
  }
  return { grupo: g, comprimento: n * pisada, degraus: n, espelho: e };
}

/**
 * @param {object} p
 *   ret         { x0, x1, z0, z1 } do volume, no mundo
 *   base        cota do piso
 *   altura, pavimentos, cor, telhado ('laje' | 'galpao'), nome
 *   porta       lado da entrada; docas/portoes: { lado, n }; garagens: { lado, x: [centros] }
 *   letreiro    lado do nome grande (sem ele, vai sobre a porta)
 *   icone       pictograma da placa de nome (ICONES)
 *   semJanela   lados sem janela
 */
export function criarPredio(p) {
  const g = new THREE.Group();
  g.name = 'predio';
  const lx = p.ret.x1 - p.ret.x0, lz = p.ret.z1 - p.ret.z0;
  const cx = (p.ret.x0 + p.ret.x1) / 2, cz = (p.ret.z0 + p.ret.z1) / 2;
  const galpao = p.telhado === 'galpao';
  const E = PAREDE;
  const ri = { x0: p.ret.x0 + E, x1: p.ret.x1 - E, z0: p.ret.z0 + E, z1: p.ret.z1 - E };
  const colisores = [];
  const portas = [];
  const janelas = [];
  const fechados = [];                              // portoes e docas: pintados, mas ninguem os tapa
  const garagens = [];                              // portoes de garagem: abertos, o caminhao entra
  const portasEnrolar = [];                         // a cortina de cada um (Fase 21)

  /* ---------------------------------------------------------------- paredes */
  const LADOS = {
    '+z': { L: lx, o: [cx, p.ret.z1], giro: 0 },
    '-z': { L: lx, o: [cx, p.ret.z0], giro: Math.PI },
    '+x': { L: lz, o: [p.ret.x1, cz], giro: Math.PI / 2 },
    '-x': { L: lz, o: [p.ret.x0, cz], giro: -Math.PI / 2 },
  };
  for (const [lado, s] of Object.entries(LADOS)) {
    const opts = {
      largura: s.L, altura: p.altura, pavimentos: p.pavimentos, galpao,
      janelas: !(p.semJanela ?? []).includes(lado), porta: p.porta === lado,
      portoes: p.portoes?.lado === lado ? p.portoes.n : 0, docas: p.docas?.lado === lado ? p.docas.n : 0,
      garagens: p.garagens?.lado === lado ? p.garagens.x : [],
    };
    const vaos = vaosDaFachada(opts);
    // letreiro: neste lado vai o nome grande; sem letreiro, ele vai na porta
    const nomeAqui = p.porta === lado || p.letreiro === lado ? p.nome : null;
    const sinal = letreiroDaFachada({ ...opts, vaos, nome: nomeAqui, letreiro: (p.letreiro ?? p.porta) === lado, icone: p.icone });
    const fora = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      map: texturaFachada({ ...opts, vaos, cor: p.cor, faixa: p.faixa, sinal }),
    });
    const buracos = [...vaos.janelas.map((j) => ({ ...j, vidro: true })), ...(vaos.porta ? [vaos.porta] : []), ...vaos.garagens];
    const parede = paredeComVaos({ L: s.L, H: p.altura, E, buracos, fora });
    parede.position.set(s.o[0], p.base, s.o[1]);
    parede.rotation.y = s.giro;
    if (sinal) {
      const placa = placaDeNome(p.nome, sinal.fs, p.icone);
      placa.grupo.position.set(0, sinal.y, 0);
      parede.add(placa.grupo);
    }
    g.add(parede);

    // do referencial da parede para o mundo (x a partir da borda esquerda)
    const mundo = (x, y, z) => new THREE.Vector3(x - s.L / 2, y, z).applyAxisAngle(EIXO_Y, s.giro)
      .add(new THREE.Vector3(s.o[0], p.base, s.o[1]));
    const caixa = (x0, x1, y0, y1) => {
      const a = mundo(x0, y0, -E), b = mundo(x1, y1, 0);
      return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: a.y, y1: b.y, z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
    };
    for (const j of vaos.janelas) janelas.push({ lado, ...caixa(j.x0, j.x1, j.y0, j.y1) });
    for (const f of [...vaos.portoes, ...vaos.docas]) fechados.push({ lado, ...caixa(f.x0, f.x1, f.y0, f.y1) });
    for (const f of vaos.garagens) {
      garagens.push({ lado, ...caixa(f.x0, f.x1, f.y0, f.y1) });
      // porta de enrolar aberta: rolo na caixa sobre o vao, por dentro, e as
      // guias nas ombreiras; a ultima lamina aparece sob a verga
      const xc = (f.x0 + f.x1) / 2 - s.L / 2, w = f.x1 - f.x0;
      for (const [dx, dy, dz, x, y, z] of [
        [w + 0.5, 0.6, 0.6, xc, f.y1 + 0.35, -E - 0.3],
        [0.1, f.y1, 0.12, xc - w / 2 - 0.05, f.y1 / 2, -E - 0.06],
        [0.1, f.y1, 0.12, xc + w / 2 + 0.05, f.y1 / 2, -E - 0.06],
      ]) {
        const m = interno(new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), GALVANIZADO));
        m.position.set(x, y, z);
        parede.add(m);
      }
      // a cortina de laminas desce da verga (Fase 21: abre e fecha com o
      // caminhao): caixa de 1 m com o alto na origem, a altura e a escala
      const geo = new THREE.BoxGeometry(w, 1, 0.05);
      geo.translate(0, -0.5, 0);
      const cortina = interno(new THREE.Mesh(geo, GALVANIZADO));
      cortina.position.set(xc, f.y1, -E - 0.06);
      cortina.scale.y = 0.25;
      cortina.userData.animar = true;                 // fora da fusao: se mexe
      cortina.name = 'porta-de-enrolar';
      parede.add(cortina);
      portasEnrolar.push({ malha: cortina, aberta: 0.25, fechada: f.y1 });
    }
    // A parede colide menos nos vaos: a porta e as janelas (pedido do
    // o autor, 27/10 — a camera entra e sai pela janela). Recorte em
    // colunas: em cada faixa de x entre bordas de vao, o que sobra de cheio
    // em y vira uma caixa.
    const buracosC = [...vaos.janelas, ...(vaos.porta ? [vaos.porta] : []), ...vaos.garagens];
    const xs = [...new Set([0, s.L, ...buracosC.flatMap((b) => [b.x0, b.x1])])].sort((m, q) => m - q);
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1];
      if (xb - xa < 1e-4) continue;
      const cobrem = buracosC.filter((b) => b.x0 <= xa + 1e-6 && b.x1 >= xb - 1e-6).sort((m, q) => m.y0 - q.y0);
      let y = -0.1;
      for (const b of cobrem) {
        if (b.y0 > y + 1e-4) colisores.push(caixa(xa, xb, y, b.y0));
        y = Math.max(y, b.y1);
      }
      if (p.altura > y + 1e-4) colisores.push(caixa(xa, xb, y, p.altura));
    }
    const d = vaos.porta;
    if (!d) continue;
    // duas folhas, cada uma num pivo na ombreira; o sinal leva o giro para dentro
    const folhas = [];
    const wf = (d.x1 - d.x0) / 2 - 0.01;
    for (const [x, sinal] of [[d.x0, 1], [d.x1, -1]]) {
      const piv = new THREE.Group();
      piv.name = 'folha-porta';
      piv.userData.girante = true;                    // se mexe: fora da fusao
      piv.position.set(x - s.L / 2, 0.01, -E / 2);
      const f = interno(new THREE.Mesh(new THREE.BoxGeometry(wf, d.y1 - 0.03, 0.04), FOLHA));
      f.position.set((sinal * wf) / 2, (d.y1 - 0.03) / 2, 0);
      piv.add(f);
      parede.add(piv);
      folhas.push({ pivo: piv, sinal });
    }
    const a = mundo(d.x0, 0, -E), b = mundo(d.x1, d.y1, 0);
    portas.push({
      lado, folhas, centro: mundo((d.x0 + d.x1) / 2, 1.2, -E / 2),
      vao: { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) },
    });
  }

  /* ----------------------------------------------- pisos, entrepisos e escada */
  const yPiso = p.base + 0.05;
  g.add(placaHorizontal(ri, yPiso, 0.06, PISO));
  let escada = null;
  if (p.pavimentos > 1 && !galpao) {
    // Escada reta junto da parede longa que nao tem a porta, comecando na
    // ponta mais longe dela; o vao na laje e o da escada mais 0,3 m.
    const aoLongoX = lx >= lz;
    const portaNaLonga = aoLongoX ? /z$/.test(p.porta) : /x$/.test(p.porta);
    const ladoParede = portaNaLonga ? (p.porta[0] === '+' ? -1 : 1) : -1;   // -1: parede do lado menor (x0/z0)
    const portaEmCima = p.porta === (aoLongoX ? '+x' : '+z');
    const sentido = portaNaLonga ? 1 : (portaEmCima ? -1 : 1);              // sobe afastando-se da porta
    const n = Math.ceil(PE_DIREITO / ESCADA.espelhoMax);
    const comp = n * ESCADA.piso, larg = ESCADA.largura;
    const [a0, a1] = aoLongoX ? [ri.x0, ri.x1] : [ri.z0, ri.z1];
    const [b0, b1] = aoLongoX ? [ri.z0, ri.z1] : [ri.x0, ri.x1];
    const inicioA = sentido > 0 ? a0 + ESCADA.recuo : a1 - ESCADA.recuo;
    const meioB = ladoParede < 0 ? b0 + larg / 2 : b1 - larg / 2;
    const inicio = aoLongoX ? [inicioA, meioB] : [meioB, inicioA];
    const dir = aoLongoX ? [sentido, 0] : [0, sentido];
    // corrimao no lado da sala (o outro encosta na parede)
    const aberto = (aoLongoX ? -ladoParede * sentido : ladoParede * sentido);
    for (let k = 1; k < p.pavimentos; k++) {
      const y0k = yPiso + (k - 1) * PE_DIREITO;
      const es = escadaReta({ inicio, dir, y0: y0k, sobe: PE_DIREITO, largura: larg, aberto });
      g.add(es.grupo);
    }
    // o vao acaba onde acaba o ultimo degrau (dali em diante e a laje de
    // chegada) e comeca 0,15 m antes do primeiro
    const fimA = inicioA + sentido * comp;
    const vA = sentido > 0 ? [inicioA - 0.15, fimA] : [fimA, inicioA + 0.15];
    const vB = ladoParede < 0 ? [b0, b0 + larg + 0.1] : [b1 - larg - 0.1, b1];
    const vazio = aoLongoX ? { x0: vA[0], x1: vA[1], z0: vB[0], z1: vB[1] } : { x0: vB[0], x1: vB[1], z0: vA[0], z1: vA[1] };
    escada = { ret: vazio, pe: inicio, dir, degraus: n, comprimento: comp, largura: larg };
    for (let k = 1; k < p.pavimentos; k++) {
      const yk = yPiso + k * PE_DIREITO;
      for (const q of menos(ri, vazio)) {
        g.add(placaHorizontal(q, yk, ENTREPISO, PISO));
        g.add(forroEm(q, yk - ENTREPISO - 0.002));
        colisores.push({ x0: q.x0, x1: q.x1, y0: yk - ENTREPISO, y1: yk, z0: q.z0, z1: q.z1 });
      }
      // guarda-corpo em volta do vao, menos do lado da parede e da chegada
      const yG = yk + 1.1;
      const lados = aoLongoX
        ? [[vazio.x0, vazio.x1, ladoParede < 0 ? vazio.z1 : vazio.z0, 'x'], [sentido > 0 ? vazio.x0 : vazio.x1, null, null, 'zfim']]
        : [[vazio.z0, vazio.z1, ladoParede < 0 ? vazio.x1 : vazio.x0, 'z'], [sentido > 0 ? vazio.z0 : vazio.z1, null, null, 'xfim']];
      for (const [u0, u1, w, tipo] of lados) {
        let m;
        if (tipo === 'x') { m = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, 0.05, 0.05), CORRIMAO); m.position.set((u0 + u1) / 2, yG, w); }
        else if (tipo === 'z') { m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, u1 - u0), CORRIMAO); m.position.set(w, yG, (u0 + u1) / 2); }
        else if (tipo === 'zfim') { m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, vazio.z1 - vazio.z0), CORRIMAO); m.position.set(u0, yG, (vazio.z0 + vazio.z1) / 2); }
        else { m = new THREE.Mesh(new THREE.BoxGeometry(vazio.x1 - vazio.x0, 0.05, 0.05), CORRIMAO); m.position.set((vazio.x0 + vazio.x1) / 2, yG, u0); }
        g.add(interno(m));
        const v = new THREE.Vector3().copy(m.position);
        const geo = m.geometry.parameters;
        for (const t of [-0.5, 0, 0.5]) {
          const poste = interno(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.04), CORRIMAO));
          poste.position.set(v.x + t * (geo.width - 0.05), yk + 0.55, v.z + t * (geo.depth - 0.05));
          g.add(poste);
        }
      }
    }
  }

  /* ---------------------------------------------------------------- cobertura */
  const yTopo = p.base + p.altura;
  if (galpao) {
    // Duas aguas a 10 %, cumeeira no eixo maior, com beiral de 0,4 m. Por
    // dentro, o forro e a propria telha.
    const aoLongoX = lx >= lz;
    const vao = (aoLongoX ? lz : lx) + 0.8;
    const comp = (aoLongoX ? lx : lz) + 0.8;
    const hc = 0.1 * vao / 2;
    const forma = new THREE.Shape();
    forma.moveTo(-vao / 2, 0); forma.lineTo(vao / 2, 0); forma.lineTo(0, hc); forma.closePath();
    const geo = new THREE.ExtrudeGeometry(forma, { depth: comp, bevelEnabled: false });
    geo.translate(0, 0, -comp / 2);
    // Telha ondulada com a onda correndo morro abaixo, perpendicular a cumeeira.
    const telhado = new THREE.Mesh(geo, triplanar(
      new THREE.MeshStandardMaterial({ color: 0x8e979f, metalness: 0.5, roughness: 0.5 }), aoLongoX ? 'telhaX' : 'telhaZ', 1));
    if (aoLongoX) telhado.rotation.y = Math.PI / 2;
    telhado.position.set(cx, yTopo, cz);
    telhado.castShadow = true;
    g.add(telhado);
    colisores.push({ x0: p.ret.x0 - 0.4, x1: p.ret.x1 + 0.4, y0: yTopo, y1: yTopo + hc, z0: p.ret.z0 - 0.4, z1: p.ret.z1 + 0.4 });
  } else {
    // Laje com platibanda de 0,6 m e forro por baixo.
    const mat = triplanar(new THREE.MeshStandardMaterial({ color: 0xa8aaa6, roughness: 0.95 }), 'concreto', 2);
    // 1 cm para dentro da fachada: com a borda no plano da parede, as duas
    // faces disputavam o pixel no alto do predio (listras sob a platibanda)
    const laje = new THREE.Mesh(new THREE.BoxGeometry(lx - 0.02, LAJE, lz - 0.02), mat);
    laje.position.set(cx, yTopo - LAJE / 2, cz);
    laje.castShadow = true;
    laje.receiveShadow = true;
    g.add(laje);
    g.add(forroEm(ri, yTopo - LAJE - 0.002));
    const e = 0.15;
    // as curtas cabem entre as longas: sobrepostas no canto, as faces coplanares piscavam
    for (const [w, d, x, z] of [[lx, e, cx, p.ret.z0 + e / 2], [lx, e, cx, p.ret.z1 - e / 2],
      [e, lz - 2 * e, p.ret.x0 + e / 2, cz], [e, lz - 2 * e, p.ret.x1 - e / 2, cz]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), mat);
      m.position.set(x, yTopo + 0.3, z);
      m.castShadow = true;
      g.add(m);
    }
    colisores.push({ x0: p.ret.x0, x1: p.ret.x1, y0: yTopo - LAJE, y1: yTopo + 0.6, z0: p.ret.z0, z1: p.ret.z1 });
    // condensadoras do ar-condicionado sobre a laje, em fila no eixo maior
    const n = p.condensadoras ?? 0;
    for (let i = 0; i < n; i++) {
      const aoLongoX = lx >= lz;
      const s = ((i + 0.5) / n - 0.5) * (aoLongoX ? lx : lz) * 0.5;
      const x = aoLongoX ? cx + s : cx, z = aoLongoX ? cz : cz + s;
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.85), CONDENSADORA);
      caixa.position.set(x, yTopo + 0.45 + 0.1, z);
      caixa.castShadow = true;
      g.add(caixa);
      const grade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), CORRIMAO);
      grade.position.set(x, yTopo + 1.02, z);
      g.add(grade);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 1.0), mat);
      base.position.set(x, yTopo + 0.05, z);
      g.add(base);
    }
  }

  g.userData.colisores = colisores;
  g.userData.portas = portas;
  g.userData.portasEnrolar = portasEnrolar;
  // O que quem mobilia precisa: o vao livre por dentro, a cota de cada piso,
  // o pe-direito, a escada e onde fica cada porta e janela.
  g.userData.interno = {
    ret: ri, pisos: Array.from({ length: p.pavimentos }, (_, k) => yPiso + k * PE_DIREITO),
    // cota do forro de cada pavimento
    tetos: Array.from({ length: p.pavimentos }, (_, k) => (k < p.pavimentos - 1
      ? yPiso + (k + 1) * PE_DIREITO - ENTREPISO : yTopo - (galpao ? 0 : LAJE))),
    galpao, escada, portas, janelas, fechados, garagens, porta: p.porta, semJanela: p.semJanela ?? [],
  };
  return g;
}
