import * as THREE from 'three';
import { Y } from './terreno.js';

/**
 * ===========================================================================
 *  PECAS DE SEGURANCA  (Fase 8)
 * ===========================================================================
 *  Equipamento de emergencia, com as cores da NBR 7195 (vermelho para
 *  combate a incendio, verde para seguranca e emergencia), e as pecas da
 *  camada de projeto: zona classificada, faixa de rota de fuga e placa do
 *  ponto de encontro. Origem no piso, no centro; a composicao posiciona.
 */

const SEG = 20;
const VERMELHO = new THREE.MeshStandardMaterial({ color: 0xc8261e, metalness: 0.3, roughness: 0.5 });
const VERDE = new THREE.MeshStandardMaterial({ color: 0x1f8a4c, metalness: 0.3, roughness: 0.5 });
const METAL = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.8, roughness: 0.35 });
const BRANCO = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
const LARANJA = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.7, side: THREE.DoubleSide });
const CONCRETO = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.95 });

function cil(r, h, mat, y = h / 2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, SEG), mat);
  m.position.y = y;
  m.castShadow = true;
  return m;
}
function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  return m;
}
// topo 5 cm acima da laje e 10 cm acima da placa do bloco: rente, piscaria
function base(lado = 0.6, y0 = Y.lote - 0.05, y1 = Y.bloco + 0.1) {
  const b = caixa(lado, y1 - y0, lado, CONCRETO);
  b.position.y = (y0 + y1) / 2;
  return b;
}

/** Hidrante de coluna: corpo, duas saidas de 2½" e a tampa. */
export function criarHidrante() {
  const g = new THREE.Group();
  g.name = 'hidrante';
  g.add(base());
  g.add(cil(0.1, 0.85, VERMELHO, Y.bloco + 0.08 + 0.425));
  const topo = cil(0.13, 0.12, VERMELHO, Y.bloco + 0.08 + 0.9);
  g.add(topo);
  for (const s of [-1, 1]) {
    const saida = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), METAL);
    saida.rotation.z = Math.PI / 2;
    saida.position.set(s * 0.15, Y.bloco + 0.08 + 0.62, 0);
    g.add(saida);
  }
  return { grupo: g, raio: 0.3 };
}

/** Canhao monitor: tubo de subida, giro e esguicho apontado 30° acima. */
export function criarMonitor() {
  const g = new THREE.Group();
  g.name = 'canhao-monitor';
  g.add(base(0.9));
  const y0 = Y.bloco + 0.08;
  g.add(cil(0.08, 1.3, VERMELHO, y0 + 0.65));
  g.add(cil(0.12, 0.15, METAL, y0 + 1.35));
  const esg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.9, 14), VERMELHO);
  esg.rotation.z = -Math.PI / 2 + Math.PI / 6;
  esg.position.set(0.38, y0 + 1.6, 0);
  esg.castShadow = true;
  g.add(esg);
  // ponta do esguicho e direcao do jato (Fase 27, site/animacoes.js), no local
  const a = Math.PI / 6;
  g.userData.bocal = { p: [0.38 + 0.45 * Math.cos(a), y0 + 1.6 + 0.45 * Math.sin(a), 0], dir: [Math.cos(a), Math.sin(a), 0] };
  return { grupo: g, raio: 0.45 };
}

/**
 * Camera de seguranca (CFTV) num poste de 6 m (Fase 27, item 25): braco no
 * topo e a camera numa cabeca que gira (`userData.varredura`, fora da
 * fusao; site/animacoes.js), mirando `olhar` (rumo em planta, rad).
 */
export function criarCameraCftv({ altura = 6, olhar = 0 }) {
  const g = new THREE.Group();
  g.name = 'cftv';
  g.add(base(0.5));
  g.add(cil(0.06, altura, METAL, altura / 2));
  const braco = caixa(0.5, 0.06, 0.06, METAL);
  braco.position.set(0.25, altura - 0.1, 0);
  g.add(braco);
  const cabeca = new THREE.Group();
  cabeca.name = 'cftv-cabeca';
  cabeca.userData.girante = true;
  cabeca.userData.varredura = { rumo: olhar, amplitude: 0.9 };
  const corpo = caixa(0.36, 0.14, 0.14, BRANCO_CAM);
  corpo.position.set(0.16, -0.12, 0);
  const viseira = caixa(0.42, 0.02, 0.18, BRANCO_CAM);
  viseira.position.set(0.16, -0.04, 0);
  const lente = cil(0.045, 0.02, PRETO_CAM, 0);
  lente.rotation.z = Math.PI / 2;
  lente.position.set(0.35, -0.12, 0);
  const pe = cil(0.025, 0.12, METAL, -0.06);
  cabeca.add(corpo, viseira, lente, pe);
  cabeca.position.set(0.5, altura - 0.1, 0);
  cabeca.rotation.y = olhar;
  g.add(cabeca);
  return { grupo: g, raio: 0.3 };
}
const BRANCO_CAM = new THREE.MeshStandardMaterial({ color: 0xe9ebec, roughness: 0.5 });
const PRETO_CAM = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.2, metalness: 0.4 });

/** Chuveiro de emergencia com lava-olhos e placa verde. */
export function criarLavaOlhos() {
  const g = new THREE.Group();
  g.name = 'lava-olhos';
  g.add(base(0.5));
  const y0 = Y.bloco + 0.08;
  // o poste sobe ate o alto da placa (Fase 25): terminava em 2,25 m e a
  // placa, de 2,35 a 2,65 m, ficava solta no ar acima dele
  g.add(cil(0.035, 2.65, VERDE, y0 + 1.325));
  const braco = caixa(0.5, 0.05, 0.05, VERDE);
  braco.position.set(0.25, y0 + 2.2, 0);
  g.add(braco);
  const ducha = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.05, 0.12, 16), VERDE);
  ducha.position.set(0.5, y0 + 2.12, 0);
  g.add(ducha);
  const bacia = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.1, 16), VERDE);
  bacia.position.set(0.2, y0 + 1.0, 0);
  g.add(bacia);
  const placa = caixa(0.02, 0.3, 0.3, VERDE);
  placa.position.set(-0.05, y0 + 2.5, 0);
  g.add(placa);
  return { grupo: g, raio: 0.4 };
}

/** Extintor sobre suporte de piso, com placa vermelha no alto. */
export function criarExtintor() {
  const g = new THREE.Group();
  g.name = 'extintor';
  const y0 = Y.bloco + 0.02;
  const sup = caixa(0.35, 0.04, 0.3, VERMELHO);
  sup.position.y = y0 + 0.02;
  g.add(sup);
  g.add(cil(0.09, 0.55, VERMELHO, y0 + 0.32));
  g.add(cil(0.03, 0.08, METAL, y0 + 0.63));
  const haste = caixa(0.04, 1.6, 0.04, METAL);
  haste.position.set(0, y0 + 0.8, -0.13);
  g.add(haste);
  const placa = caixa(0.3, 0.3, 0.02, VERMELHO);
  placa.position.set(0, y0 + 1.7, -0.12);
  g.add(placa);
  return { grupo: g, raio: 0.25 };
}

/**
 * Biruta num mastro: o cone aponta PARA onde o vento vai (`para`, vetor
 * unitario em planta).
 */
export function criarBiruta({ altura, para }) {
  const g = new THREE.Group();
  g.name = 'biruta';
  g.add(cil(0.05, altura, METAL, altura / 2));
  const L = 1.4;
  const cone = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const r0 = 0.22 - i * 0.03, r1 = 0.22 - (i + 1) * 0.03;
    const anel = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L / 5, 16, 1, true), i % 2 ? BRANCO : LARANJA);
    anel.rotation.z = -Math.PI / 2;
    anel.position.x = 0.1 + (i + 0.5) * (L / 5);
    cone.add(anel);
  }
  cone.position.y = altura - 0.15;
  // inclina 15° para baixo, como numa brisa de 2 m/s
  cone.rotation.set(0, Math.atan2(-para[1], para[0]), -Math.PI / 12);
  // anda com o vento (Fase 27, site/vento.js): fora da fusao
  cone.name = 'biruta-cone';
  cone.userData.girante = true;
  cone.userData.rumo = { y: cone.rotation.y, z: cone.rotation.z };
  g.add(cone);
  return { grupo: g, raio: 0.2 };
}

/* ----------------------------------------------------------------------------
 *  Camada de projeto
 * ------------------------------------------------------------------------- */
const COR_ZONA = { 0: 0xd62828, 1: 0xff8c1a, 2: 0xffd21a };

function translucido(cor, opacidade) {
  return new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthWrite: false, side: THREE.DoubleSide });
}

/** Esfera de zona classificada em volta de um ponto. */
export function criarZonaEsfera(centro, raio, zona) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(raio, 24, 16), translucido(COR_ZONA[zona], zona === 1 ? 0.22 : 0.12));
  m.position.copy(centro);
  m.renderOrder = 2;
  g.add(m);
  return g;
}

/** Caixa de zona classificada (x0..x1, y0..y1, z0..z1), com as arestas. */
export function criarZonaCaixa({ x0, x1, y0, y1, z0, z1 }, zona, opacidade = 0.1) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(geo, translucido(COR_ZONA[zona], opacidade));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.renderOrder = 2;
  g.add(m);
  const ar = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: COR_ZONA[zona], transparent: true, opacity: 0.7 }));
  ar.position.copy(m.position);
  g.add(ar);
  return g;
}

/**
 * Faixa verde de rota de fuga pintada no chao, com setas a cada `passo` m.
 * Na cota do piso dos blocos (o mais alto do terreno): sobre a via fica 13 cm
 * acima, invisivel de longe; abaixo dele, o bloco de chegada a esconderia.
 */
export function criarFaixaFuga(pontos, { largura = 1.2, y = Y.bloco + 0.025, passo = 6 } = {}) {
  const g = new THREE.Group();
  g.name = 'rota-fuga';
  const verde = new THREE.MeshBasicMaterial({ color: 0x22b35a, transparent: true, opacity: 0.85, depthWrite: false });
  const branco = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
  const seta = new THREE.Shape();
  seta.moveTo(0.45, 0); seta.lineTo(-0.15, 0.4); seta.lineTo(-0.15, 0.18); seta.lineTo(-0.45, 0.18);
  seta.lineTo(-0.45, -0.18); seta.lineTo(-0.15, -0.18); seta.lineTo(-0.15, -0.4); seta.closePath();
  const geoSeta = new THREE.ShapeGeometry(seta);
  for (let i = 1; i < pontos.length; i++) {
    const [ax, az] = pontos[i - 1], [bx, bz] = pontos[i];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3) continue;
    const faixa = new THREE.Mesh(new THREE.PlaneGeometry(L + largura, largura), verde);
    faixa.rotation.set(-Math.PI / 2, 0, -Math.atan2(bz - az, bx - ax));
    faixa.position.set((ax + bx) / 2, y, (az + bz) / 2);
    faixa.renderOrder = 1;
    g.add(faixa);
    for (let s = passo / 2; s < L; s += passo) {
      const m = new THREE.Mesh(geoSeta, branco);
      m.rotation.set(-Math.PI / 2, 0, -Math.atan2(bz - az, bx - ax));
      m.position.set(ax + ((bx - ax) * s) / L, y + 0.01, az + ((bz - az) * s) / L);
      m.renderOrder = 2;
      g.add(m);
    }
  }
  return g;
}

/** Placa verde do ponto de encontro, em dois postes. */
export function criarPlacaEncontro(texto = 'PONTO DE ENCONTRO') {
  const g = new THREE.Group();
  g.name = 'placa-encontro';
  for (const s of [-1, 1]) {
    const p = cil(0.04, 2.4, METAL, 1.2);
    p.position.x = s * 0.7;
    g.add(p);
  }
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 192;
  const c = cv.getContext('2d');
  c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, 512, 192);
  c.fillStyle = '#ffffff';
  c.font = 'bold 54px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const [l1, ...resto] = texto.split(' ');
  c.fillText(l1, 256, 62);
  c.fillText(resto.join(' '), 256, 132);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const placa = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.64, 0.04),
    [VERDE, VERDE, VERDE, VERDE, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), VERDE]);
  placa.position.y = 2.2;
  g.add(placa);
  return { grupo: g, raio: 0.9 };
}
