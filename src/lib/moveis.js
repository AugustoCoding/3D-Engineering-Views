import * as THREE from 'three';
import { criarBombaCentrifuga } from './bomba.js';
import { giroflex } from './ambiente.js';

/**
 * ===========================================================================
 *  MOVEIS E EQUIPAMENTOS DE INTERIOR  (Fase 16)
 * ===========================================================================
 *  Cada peca tem a origem no piso, no centro da pegada, e a FRENTE em +z (o
 *  lado de quem usa: a cadeira da mesa, a porta do armario, a boca da
 *  capela). Devolve { grupo, w, d, h }: pegada de w (x) por d (z) e altura.
 *  Quem tem lugar de gente (Fase 20) devolve tambem `lugares`: { x, z, rumo,
 *  postura ('sentado' | 'em-pe'), acao } no referencial da peca — onde fica
 *  o quadril de quem senta (ou os pes de quem fica em pe) e para onde olha
 *  (rumo como o rotation.y: 0 = olhando +z).
 *  Quem compoe (site/interiores.js) encosta o fundo na parede girando a
 *  frente para dentro da sala.
 *
 *  Medidas de catalogo [ADOTADO]: mesa de escritorio de 1,4 x 0,7 m a
 *  0,74 m (NBR 13966), bancada de laboratorio a 0,90 m, capela de 1,5 m,
 *  armario de 0,9 x 0,45 x 2,0 m, porta-palete de 2,7 m por baia com palete
 *  PBR de 1,2 x 1,0 m, armario de vestiario de 0,4 m por porta, cubiculo de
 *  media tensao de 0,8 m. Nada projeta nem recebe sombra: o interior fica
 *  sob a laje, e o que importa nele e o arranjo.
 */

const CORES = {
  madeira: 0xb48d63, branco: 0xeceae5, cinza: 0x8a9096, claro: 0xc9ccc8, grafite: 0x3a3f45, preto: 0x1f2225,
  estofado: 0x2e3d52, epoxi: 0x17191b, azul: 0x2f6aa8, laranja: 0xd9822b, sacaria: 0xe6dcc3, palete: 0xa3825a,
  amarelo: 0xf2b42a, vermelho: 0xc0392b, maquina: 0x4c7a5c, locker: 0x5b7fa3, papelao: 0xb98b55, colchao: 0x5e9e8a,
  pead: 0x3f6fb5, frasco: 0x9fc6d6,
};
const MAT = Object.fromEntries(Object.entries(CORES).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, name: `movel-${k}` })]));
MAT.aco = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.6, roughness: 0.4, name: 'movel-aco' });
MAT.inox = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.75, roughness: 0.25, name: 'movel-inox' });
MAT.vidro = new THREE.MeshStandardMaterial({
  color: 0xbfe0f0, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide, name: 'movel-vidro',
});
MAT.luz = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.9, name: 'luminaria' });

/* Tela de computador e do videowall: um sinotico desenhado em canvas (fundo
 * escuro, linhas de processo, vasos e numeros), emissivo. Sem documento
 * (Node), uma tela escura lisa. */
function texturaSinotico(largura, altura, semente) {
  const cv = document.createElement('canvas');
  cv.width = largura;
  cv.height = altura;
  const g = cv.getContext('2d');
  g.fillStyle = '#0e1b2a';
  g.fillRect(0, 0, largura, altura);
  let s = semente;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.lineWidth = Math.max(1, largura / 160);
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = ['#3fa7d6', '#9bd36a', '#f2c230', '#e0e6ec'][k % 4];
    g.beginPath();
    let x = r() * largura * 0.2, y = (0.15 + 0.7 * r()) * altura;
    g.moveTo(x, y);
    for (let i = 0; i < 4; i++) {
      x += (0.1 + 0.25 * r()) * largura;
      g.lineTo(x, y);
      y = (0.15 + 0.7 * r()) * altura;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const w = (0.05 + 0.05 * r()) * largura, h = (0.12 + 0.2 * r()) * altura;
    g.fillStyle = '#5b6f84';
    g.fillRect(r() * (largura - w), r() * (altura - h), w, h);
  }
  g.fillStyle = '#9bd36a';
  g.font = `${Math.round(altura / 14)}px monospace`;
  for (let k = 0; k < 5; k++) g.fillText((20 + 180 * r()).toFixed(1), r() * largura * 0.85, (0.1 + 0.85 * r()) * altura);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TELAS = [];
function matTela(i) {
  if (!TELAS[i]) {
    TELAS[i] = typeof document === 'undefined'
      ? new THREE.MeshStandardMaterial({ color: 0x0e1b2a, name: 'tela' })
      : new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: 0xffffff, emissiveMap: texturaSinotico(256, 160, 97 + i * 31), emissiveIntensity: 0.85, name: `tela-${i}`,
      });
  }
  return TELAS[i];
}

function peca(nome) {
  const g = new THREE.Group();
  g.name = nome;
  return g;
}
function bx(g, w, h, d, mat, x = 0, y = h / 2, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  g.add(m);
  return m;
}
function cl(g, r, h, mat, x, y, z, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  g.add(m);
  return m;
}
function plano(g, w, h, mat, x, y, z, giroY = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = giroY;
  g.add(m);
  return m;
}

/** Monitor de 0,55 m na mesa, olhando para +z. */
function monitor(g, x, y, z, tela = 0, larg = 0.55) {
  bx(g, 0.18, 0.02, 0.14, MAT.grafite, x, y + 0.01, z);
  bx(g, 0.04, 0.16, 0.03, MAT.grafite, x, y + 0.1, z - 0.03);
  bx(g, larg, 0.34, 0.03, MAT.grafite, x, y + 0.34, z);
  plano(g, larg - 0.03, 0.31, matTela(tela), x, y + 0.34, z + 0.016);
}

export function criarCadeira() {
  const g = peca('cadeira');
  bx(g, 0.62, 0.04, 0.06, MAT.preto, 0, 0.05, 0);
  bx(g, 0.06, 0.04, 0.62, MAT.preto, 0, 0.05, 0);
  cl(g, 0.03, 0.36, MAT.aco, 0, 0.25, 0);
  bx(g, 0.48, 0.07, 0.48, MAT.estofado, 0, 0.46, 0);
  bx(g, 0.46, 0.5, 0.06, MAT.estofado, 0, 0.78, -0.22);
  return { grupo: g, w: 0.62, d: 0.62, h: 1.03 };
}

/** Mesa de 1,4 x 0,7 m com monitor e a cadeira na frente (+z). */
export function criarEstacao({ monitores = 1 } = {}) {
  const g = peca('estacao');
  const w = 1.4, dm = 0.7, dc = 0.75;
  const z0 = -(dm + dc) / 2 + dm / 2;              // centro da mesa
  bx(g, w, 0.03, dm, MAT.madeira, 0, 0.74, z0);
  for (const sx of [-1, 1]) bx(g, 0.05, 0.725, dm - 0.1, MAT.grafite, sx * (w / 2 - 0.05), 0.3625, z0);
  for (let i = 0; i < monitores; i++) monitor(g, (i - (monitores - 1) / 2) * 0.58, 0.755, z0 - 0.15, i);
  const c = criarCadeira();
  c.grupo.rotation.y = Math.PI;
  c.grupo.position.set(0, 0, z0 + dm / 2 + 0.3);
  g.add(c.grupo);
  return { grupo: g, w, d: dm + dc, h: 1.2, lugares: [{ x: 0, z: z0 + dm / 2 + 0.3, rumo: Math.PI, postura: 'sentado', acao: 'digitar' }] };
}

/** Mesa de reuniao L x W com cadeiras dos dois lados e nas cabeceiras. */
export function criarMesaReuniao({ L = 3, W = 1.2 } = {}) {
  const g = peca('mesa-reuniao');
  bx(g, L, 0.04, W, MAT.madeira, 0, 0.74, 0);
  bx(g, 0.1, 0.72, W * 0.5, MAT.grafite, -L / 2 + 0.4, 0.36, 0);
  bx(g, 0.1, 0.72, W * 0.5, MAT.grafite, L / 2 - 0.4, 0.36, 0);
  const n = Math.max(1, Math.floor(L / 0.8));
  const lugares = [];
  const lugar = (x, z, giro) => {
    const c = criarCadeira(); c.grupo.position.set(x, 0, z); c.grupo.rotation.y = giro; g.add(c.grupo);
    lugares.push({ x, z, rumo: giro, postura: 'sentado', acao: 'conversar' });
  };
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n);
    lugar(x, W / 2 + 0.3, Math.PI);
    lugar(x, -W / 2 - 0.3, 0);
  }
  lugar(-L / 2 - 0.3, 0, Math.PI / 2);
  lugar(L / 2 + 0.3, 0, -Math.PI / 2);
  return { grupo: g, w: L + 1.3, d: W + 1.3, h: 1.03, lugares };
}

/** Bancada de laboratorio encostada: gabinete, tampo de epoxi, prateleira de
 *  frascos em cima e, se `pia`, cuba de inox com torneira. */
export function criarBancadaLab({ L = 2.4, pia = false, prateleira = true } = {}) {
  const g = peca('bancada-lab');
  const d = 0.75;
  bx(g, L, 0.86, d - 0.1, MAT.branco, 0, 0.43, 0.05 - 0.05);
  bx(g, L, 0.04, d, MAT.epoxi, 0, 0.88, 0);
  bx(g, L, 0.25, 0.02, MAT.epoxi, 0, 1.02, -d / 2 + 0.01);
  // sem prateleira e a bancada que fica embaixo da janela
  if (prateleira) {
    bx(g, L, 0.03, 0.28, MAT.claro, 0, 1.55, -d / 2 + 0.14);
    for (let i = 0; i < Math.floor(L / 0.3); i++) cl(g, 0.04, 0.2 + 0.05 * (i % 3), MAT.frasco, -L / 2 + 0.2 + i * 0.3, 1.67 + 0.025 * (i % 3), -d / 2 + 0.12, 8);
  }
  if (pia) {
    bx(g, 0.5, 0.03, 0.4, MAT.inox, L / 2 - 0.45, 0.9, 0.05);
    cl(g, 0.015, 0.3, MAT.inox, L / 2 - 0.45, 1.05, -0.2, 8);
  }
  return { grupo: g, w: L, d, h: prateleira ? 1.8 : 1.15, lugares: [{ x: 0, z: d / 2 + 0.35, rumo: Math.PI, postura: 'em-pe', acao: 'bancada' }] };
}

/** Bancada central dupla (ilha), com o rack de reagentes no meio. */
export function criarIlhaLab({ L = 3 } = {}) {
  const g = peca('ilha-lab');
  const d = 1.5;
  bx(g, L, 0.86, d - 0.2, MAT.branco, 0, 0.43, 0);
  bx(g, L, 0.04, d, MAT.epoxi, 0, 0.88, 0);
  for (const y of [1.25, 1.6]) bx(g, L - 0.2, 0.03, 0.3, MAT.claro, 0, y, 0);
  for (const sx of [-1, 1]) bx(g, 0.04, 0.8, 0.04, MAT.aco, sx * (L / 2 - 0.15), 1.3, 0);
  for (let i = 0; i < Math.floor((L - 0.4) / 0.25); i++) cl(g, 0.035, 0.18, MAT.frasco, -L / 2 + 0.3 + i * 0.25, 1.36, (i % 2 ? 0.07 : -0.07), 8);
  // em pe dos dois lados, um a cada 1,2 m de bancada
  const lugares = [];
  const n = Math.max(1, Math.floor(L / 1.2));
  for (const sz of [-1, 1]) for (let i = 0; i < n; i++) lugares.push({ x: -L / 2 + (i + 0.5) * (L / n), z: sz * (d / 2 + 0.35), rumo: sz > 0 ? Math.PI : 0, postura: 'em-pe', acao: 'bancada' });
  return { grupo: g, w: L, d, h: 1.75, lugares };
}

/** Capela de exaustao: gabinete, camara com guilhotina de vidro e o duto. */
export function criarCapela() {
  const g = peca('capela');
  const w = 1.5, d = 0.9;
  bx(g, w, 0.86, d - 0.1, MAT.branco, 0, 0.43, 0);
  bx(g, w, 0.04, d, MAT.epoxi, 0, 0.88, 0);
  bx(g, w, 1.25, 0.05, MAT.branco, 0, 1.53, -d / 2 + 0.025);
  for (const sx of [-1, 1]) bx(g, 0.08, 1.25, d, MAT.branco, sx * (w / 2 - 0.04), 1.53, 0);
  bx(g, w, 0.35, d, MAT.branco, 0, 2.33, 0);
  plano(g, w - 0.16, 0.7, MAT.vidro, 0, 1.6, d / 2 - 0.02);
  cl(g, 0.15, 0.6, MAT.aco, 0, 2.8, -0.1);
  return { grupo: g, w, d, h: 3.1, lugares: [{ x: 0, z: d / 2 + 0.35, rumo: Math.PI, postura: 'em-pe', acao: 'bancada' }] };
}

/** Armario de duas portas (ou alto de vestiario, se `portas` > 2). */
export function criarArmario({ L = 0.9, d = 0.45, h = 2.0, cor = 'claro' } = {}) {
  const g = peca('armario');
  bx(g, L, h, d, MAT[cor], 0, h / 2, 0);
  const n = Math.max(2, Math.round(L / 0.45));
  for (let i = 1; i < n; i++) bx(g, 0.01, h - 0.1, 0.01, MAT.grafite, -L / 2 + (i * L) / n, h / 2, d / 2 + 0.005);
  for (let i = 0; i < n; i++) bx(g, 0.02, 0.15, 0.02, MAT.aco, -L / 2 + ((i + 0.5) * L) / n + (i % 2 ? -0.12 : 0.12) * (L / n / 0.45), h * 0.5, d / 2 + 0.015);
  return { grupo: g, w: L, d, h };
}

/** Estante de aco com caixas de papelao. */
export function criarEstante({ L = 1.2, d = 0.5, h = 2.2, niveis = 5 } = {}) {
  const g = peca('estante');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.04, h, 0.04, MAT.aco, sx * (L / 2 - 0.02), h / 2, sz * (d / 2 - 0.02));
  for (let k = 0; k < niveis; k++) {
    const y = 0.1 + (k * (h - 0.2)) / (niveis - 1);
    bx(g, L, 0.025, d, MAT.cinza, 0, y, 0);
    if (k === niveis - 1) continue;
    const vao = (h - 0.2) / (niveis - 1);
    const nCx = 2 + (k % 2);
    for (let i = 0; i < nCx; i++) bx(g, L / nCx - 0.06, vao * 0.7, d - 0.08, MAT.papelao, -L / 2 + (i + 0.5) * (L / nCx), y + 0.012 + vao * 0.35, 0);
  }
  return { grupo: g, w: L, d, h };
}

/** Palete PBR de 1,2 x 1,0 m com sacaria empilhada em `camadas`. */
export function criarPaleteSacaria({ camadas = 5 } = {}) {
  const g = peca('palete-sacaria');
  bx(g, 1.2, 0.14, 1.0, MAT.palete, 0, 0.07, 0);
  for (let k = 0; k < camadas; k++) {
    for (const sx of [-1, 1]) bx(g, 0.57, 0.14, 0.95, MAT.sacaria, sx * 0.3, 0.14 + 0.07 + k * 0.15, (k % 2 ? 0.01 : -0.01));
  }
  return { grupo: g, w: 1.2, d: 1.0, h: 0.14 + camadas * 0.15 };
}

/** Porta-palete de uma baia: dois quadros azuis, longarinas laranja em cada
 *  nivel e dois paletes de sacaria por nivel (o do chao tambem). */
export function criarPortaPalete({ L = 2.7, d = 1.1, h = 4.6, niveis = 3 } = {}) {
  const g = peca('porta-palete');
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) bx(g, 0.08, h, 0.08, MAT.azul, sx * (L / 2 - 0.04), h / 2, sz * (d / 2 - 0.04));
    for (let y = 0.4; y < h; y += 0.8) bx(g, 0.04, 0.04, d - 0.1, MAT.azul, sx * (L / 2 - 0.04), y, 0);
  }
  const passo = (h - 0.2) / niveis;
  for (let k = 0; k <= niveis; k++) {
    const y = k * passo;
    if (k > 0) for (const sz of [-1, 1]) bx(g, L, 0.1, 0.05, MAT.laranja, 0, y - 0.05, sz * (d / 2 - 0.04));
    if (k === niveis) break;
    for (const sx of [-1, 1]) {
      const p = criarPaleteSacaria({ camadas: Math.max(2, Math.floor((passo - 0.35) / 0.15)) });
      p.grupo.position.set(sx * (L / 4 + 0.02), y + (k ? 0 : 0.01), 0);
      g.add(p.grupo);
    }
  }
  return { grupo: g, w: L, d, h };
}

/** Empilhadeira a combustao: chassi, contrapeso, protetor do operador, torre
 *  e garfos para +z. */
export function criarEmpilhadeira() {
  const g = peca('empilhadeira');
  bx(g, 1.1, 0.7, 1.6, MAT.amarelo, 0, 0.55, -0.4);
  bx(g, 1.1, 0.5, 0.45, MAT.grafite, 0, 0.75, -1.25);
  for (const sx of [-1, 1]) {
    for (const z of [0.25, -1.0]) {
      const r = cl(g, 0.28, 0.25, MAT.preto, sx * 0.5, 0.28, z, 14);
      r.rotation.z = Math.PI / 2;
    }
    bx(g, 0.05, 1.4, 0.05, MAT.grafite, sx * 0.5, 1.6, 0.2);
    bx(g, 0.05, 1.4, 0.05, MAT.grafite, sx * 0.5, 1.6, -0.8);
    bx(g, 0.09, 2.2, 0.09, MAT.grafite, sx * 0.3, 1.1, 0.5);
    bx(g, 0.1, 0.05, 1.1, MAT.aco, sx * 0.3, 0.08, 1.05);
  }
  bx(g, 1.1, 0.04, 1.05, MAT.grafite, 0, 2.3, -0.3);
  bx(g, 0.5, 0.08, 0.45, MAT.estofado, 0, 1.0, -0.6);
  giroflex(g, 0.4, 2.32, -0.7);                    // no protetor do operador (Fase 27)
  return { grupo: g, w: 1.15, d: 3.2, h: 2.5 };
}

/** Ponte rolante: viga principal de `vao` ao longo de x a `y`, cabeceiras,
 *  carro com talha e gancho, e as vigas de rolamento ao longo de z
 *  (`trilho` m) nas duas paredes. Origem no piso, no meio do vao. */
export function criarPonteRolante({ vao, trilho, y }) {
  const g = peca('ponte-rolante');
  for (const sx of [-1, 1]) bx(g, 0.3, 0.45, trilho, MAT.grafite, sx * (vao / 2 - 0.15), y - 0.25, 0);
  // o que anda (Fase 27, item 23; site/animacoes.js): a ponte ao longo dos
  // trilhos (z) e o carro com a talha ao longo da viga (x); fora da fusao
  const ponte = peca('ponte-movel');
  ponte.userData.girante = true;
  ponte.userData.curso = { z: Math.max(0, trilho / 2 - 1.2), x: Math.max(0, vao / 2 - 1.3) };
  for (const sx of [-1, 1]) bx(ponte, 0.35, 0.3, 1.8, MAT.amarelo, sx * (vao / 2 - 0.4), y + 0.1, 0);
  bx(ponte, vao - 0.6, 0.6, 0.4, MAT.amarelo, 0, y + 0.2, 0);
  const carro = peca('carro-talha');
  bx(carro, 0.9, 0.45, 0.9, MAT.grafite, 0, y - 0.2, 0);
  cl(carro, 0.012, 1.8, MAT.aco, 0, y - 1.3, 0, 6);
  bx(carro, 0.12, 0.25, 0.08, MAT.amarelo, 0, y - 2.3, 0);
  carro.position.x = 0.6;
  ponte.add(carro);
  g.add(ponte);
  return { grupo: g, w: vao, d: trilho, h: y + 0.5 };
}

/** Bancada de oficina de aco com morsa e painel de ferramentas atras. */
export function criarBancadaOficina({ L = 2 } = {}) {
  const g = peca('bancada-oficina');
  const d = 0.75;
  bx(g, L, 0.05, d, MAT.madeira, 0, 0.88, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.05, 0.86, 0.05, MAT.grafite, sx * (L / 2 - 0.05), 0.43, sz * (d / 2 - 0.05));
  bx(g, L - 0.1, 0.03, d - 0.1, MAT.grafite, 0, 0.15, 0);
  bx(g, 0.2, 0.15, 0.25, MAT.azul, L / 2 - 0.25, 0.98, 0.15);
  bx(g, L, 0.8, 0.02, MAT.claro, 0, 1.5, -d / 2 + 0.01);
  for (let i = 0; i < Math.floor(L / 0.25); i++) bx(g, 0.03, 0.18 + 0.06 * (i % 3), 0.02, MAT.vermelho, -L / 2 + 0.15 + i * 0.25, 1.55, -d / 2 + 0.03);
  return { grupo: g, w: L, d, h: 1.9, lugares: [{ x: 0, z: d / 2 + 0.35, rumo: Math.PI, postura: 'em-pe', acao: 'bancada' }] };
}

/** Torno mecanico: barramento sobre dois pes, cabecote e contraponta. */
export function criarTorno() {
  const g = peca('torno');
  for (const sx of [-1, 1]) bx(g, 0.5, 0.75, 0.6, MAT.maquina, sx * 0.75, 0.375, 0);
  bx(g, 2.2, 0.25, 0.35, MAT.maquina, 0, 0.88, -0.05);
  bx(g, 0.55, 0.5, 0.55, MAT.maquina, -0.85, 1.25, -0.05);
  bx(g, 0.3, 0.3, 0.3, MAT.maquina, 0.85, 1.15, -0.05);
  bx(g, 0.35, 0.18, 0.45, MAT.grafite, 0.1, 1.1, 0.05);
  return { grupo: g, w: 2.2, d: 0.9, h: 1.5 };
}

/** Furadeira de coluna. */
export function criarFuradeira() {
  const g = peca('furadeira');
  bx(g, 0.5, 0.08, 0.6, MAT.maquina, 0, 0.04, 0);
  cl(g, 0.05, 1.7, MAT.aco, 0, 0.9, -0.15);
  bx(g, 0.35, 0.18, 0.35, MAT.maquina, 0, 0.75, 0.05);
  bx(g, 0.3, 0.4, 0.55, MAT.maquina, 0, 1.6, 0);
  return { grupo: g, w: 0.6, d: 0.7, h: 1.85 };
}

/** Console de operacao: `posicoes` mesas de 1,6 m em linha, tres monitores
 *  em cada, a cadeira do operador na frente (+z). */
export function criarConsole({ posicoes = 3 } = {}) {
  const g = peca('console');
  const wp = 1.6, dm = 0.9, dc = 0.8;
  const w = wp * posicoes, z0 = -(dm + dc) / 2 + dm / 2;
  bx(g, w, 0.05, dm, MAT.grafite, 0, 0.74, z0);
  bx(g, w, 0.7, 0.05, MAT.grafite, 0, 0.36, z0 - dm / 2 + 0.05);
  for (const sx of [-1, 1]) bx(g, 0.05, 0.72, dm, MAT.grafite, sx * (w / 2 - 0.025), 0.36, z0);
  for (let i = 0; i < posicoes; i++) {
    const x = -w / 2 + (i + 0.5) * wp;
    for (let k = -1; k <= 1; k++) monitor(g, x + k * 0.5, 0.765, z0 - 0.2 + Math.abs(k) * 0.05, (i * 3 + k + 1) % 4, 0.5);
    const c = criarCadeira();
    c.grupo.rotation.y = Math.PI;
    c.grupo.position.set(x, 0, z0 + dm / 2 + 0.35);
    g.add(c.grupo);
  }
  const lugares = Array.from({ length: posicoes }, (_, i) => ({ x: -w / 2 + (i + 0.5) * wp, z: z0 + dm / 2 + 0.35, rumo: Math.PI, postura: 'sentado', acao: 'digitar' }));
  return { grupo: g, w, d: dm + dc, h: 1.25, lugares };
}

/** Videowall na parede: grade de telas de 1,2 x 0,7 m de `y0` a `y0` + H. */
export function criarVideowall({ L = 4.8, H = 1.4, y0 = 1.0 } = {}) {
  const g = peca('videowall');
  const nx = Math.max(1, Math.floor(L / 1.2)), ny = Math.max(1, Math.floor(H / 0.7));
  const w = nx * 1.2, h = ny * 0.7;
  bx(g, w + 0.1, h + 0.1, 0.1, MAT.preto, 0, y0 + h / 2, 0);
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < ny; k++) plano(g, 1.17, 0.67, matTela((i + k * 2) % 4), -w / 2 + (i + 0.5) * 1.2, y0 + (k + 0.5) * 0.7, 0.052);
  }
  return { grupo: g, w: w + 0.1, d: 0.1, h: y0 + h + 0.05, y0 };
}

/** Quadro branco na parede, de 0,9 a 2,1 m. */
export function criarQuadro({ L = 2 } = {}) {
  const g = peca('quadro');
  bx(g, L, 1.2, 0.03, MAT.aco, 0, 1.5, 0);
  bx(g, L - 0.06, 1.14, 0.01, MAT.branco, 0, 1.5, 0.02);
  return { grupo: g, w: L, d: 0.04, h: 2.1, y0: 0.9 };
}

/** Mesa de refeitorio com os dois bancos presos (4 a 6 lugares). */
export function criarMesaRefeitorio() {
  const g = peca('mesa-refeitorio');
  bx(g, 1.8, 0.04, 0.8, MAT.branco, 0, 0.75, 0);
  for (const sz of [-1, 1]) bx(g, 1.8, 0.04, 0.3, MAT.madeira, 0, 0.45, sz * 0.65);
  for (const sx of [-1, 1]) {
    bx(g, 0.06, 0.73, 0.06, MAT.aco, sx * 0.7, 0.37, 0);
    bx(g, 0.05, 0.05, 1.55, MAT.aco, sx * 0.7, 0.2, 0);
    for (const sz of [-1, 1]) bx(g, 0.05, 0.43, 0.05, MAT.aco, sx * 0.7, 0.22, sz * 0.65);
  }
  // tres de cada lado, no banco, de frente para a mesa
  const lugares = [];
  for (const sz of [-1, 1]) for (const x of [-0.55, 0, 0.55]) lugares.push({ x, z: sz * 0.65, rumo: sz > 0 ? Math.PI : 0, postura: 'sentado', acao: 'comer' });
  return { grupo: g, w: 1.8, d: 1.6, h: 0.77, lugares };
}

/** Balcao de distribuicao (buffet) de inox com protetor de vidro. */
export function criarBuffet({ L = 4 } = {}) {
  const g = peca('buffet');
  const d = 0.8;
  bx(g, L, 0.88, d, MAT.inox, 0, 0.44, 0);
  for (let i = 0; i < Math.floor(L / 0.6); i++) bx(g, 0.5, 0.04, 0.35, MAT.aco, -L / 2 + 0.35 + i * 0.6, 0.9, 0);
  for (const sx of [-1, 1]) bx(g, 0.03, 0.45, 0.03, MAT.inox, sx * (L / 2 - 0.05), 1.11, 0.1);
  bx(g, L, 0.01, 0.45, MAT.vidro, 0, 1.34, 0.1);
  return { grupo: g, w: L, d, h: 1.35 };
}

/** Banco de armarios de vestiario, 0,4 m por porta. */
export function criarArmariosVestiario({ L = 2.4 } = {}) {
  const g = peca('armarios-vestiario');
  const n = Math.max(1, Math.floor(L / 0.4)), w = n * 0.4, d = 0.5, h = 1.9;
  bx(g, w, h, d, MAT.locker, 0, h / 2, 0);
  for (let i = 0; i < n; i++) {
    bx(g, 0.01, h - 0.08, 0.01, MAT.grafite, -w / 2 + i * 0.4, h / 2, d / 2 + 0.005);
    for (const y of [0.6, 1.5]) bx(g, 0.25, 0.02, 0.01, MAT.grafite, -w / 2 + (i + 0.5) * 0.4, y, d / 2 + 0.006);
  }
  return { grupo: g, w, d, h };
}

/** Banco de vestiario. */
export function criarBanco({ L = 2 } = {}) {
  const g = peca('banco');
  bx(g, L, 0.04, 0.35, MAT.madeira, 0, 0.45, 0);
  for (const sx of [-1, 1]) bx(g, 0.05, 0.43, 0.3, MAT.aco, sx * (L / 2 - 0.15), 0.215, 0);
  return { grupo: g, w: L, d: 0.35, h: 0.47 };
}

/** Fileira de `n` boxes de chuveiro de 0,9 x 0,9 m. */
export function criarChuveiros({ n = 4 } = {}) {
  const g = peca('chuveiros');
  const w = n * 0.9, d = 0.9;
  bx(g, w, 0.04, d, MAT.claro, 0, 0.02, 0);
  for (let i = 0; i <= n; i++) bx(g, 0.04, 2.0, d, MAT.branco, -w / 2 + i * 0.9, 1.0, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * 0.9;
    cl(g, 0.012, 0.3, MAT.inox, x, 2.0, -d / 2 + 0.15, 6).rotation.x = Math.PI / 2;
    cl(g, 0.07, 0.03, MAT.inox, x, 1.98, -d / 2 + 0.3, 10);
  }
  return { grupo: g, w, d, h: 2.05 };
}

/** Maca de atendimento, deitada ao longo de x. */
export function criarMaca() {
  const g = peca('maca');
  const w = 1.9, d = 0.65;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.04, 0.75, 0.04, MAT.aco, sx * (w / 2 - 0.08), 0.375, sz * (d / 2 - 0.06));
  bx(g, w, 0.05, d, MAT.aco, 0, 0.75, 0);
  bx(g, w - 0.05, 0.1, d - 0.05, MAT.colchao, 0, 0.82, 0);
  bx(g, 0.35, 0.08, d - 0.15, MAT.branco, -w / 2 + 0.25, 0.9, 0);
  return { grupo: g, w, d, h: 0.95 };
}

/** Fileira de `n` cubiculos de media tensao de 0,8 m. */
export function criarCubiculos({ n = 4 } = {}) {
  const g = peca('cubiculos');
  const w = n * 0.8, d = 0.8, h = 2.2;
  bx(g, w, h, d, MAT.claro, 0, h / 2, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * 0.8;
    bx(g, 0.01, h - 0.1, 0.01, MAT.grafite, x - 0.4, h / 2, d / 2 + 0.005);
    bx(g, 0.18, 0.12, 0.01, MAT.preto, x, 1.6, d / 2 + 0.006);
    bx(g, 0.06, 0.06, 0.02, i % 3 ? MAT.vermelho : MAT.maquina, x - 0.15, 1.35, d / 2 + 0.01);
    bx(g, 0.03, 0.2, 0.03, MAT.aco, x + 0.28, 1.1, d / 2 + 0.015);
  }
  return { grupo: g, w, d, h };
}

/** Painel eletrico de parede (quadro de comando). */
export function criarPainel({ L = 1.2 } = {}) {
  const g = peca('painel');
  bx(g, L, 2.0, 0.5, MAT.claro, 0, 1.0, 0);
  bx(g, 0.01, 1.9, 0.01, MAT.grafite, 0, 1.0, 0.255);
  bx(g, 0.3, 0.2, 0.01, MAT.preto, -L / 4, 1.55, 0.256);
  for (let i = 0; i < 4; i++) bx(g, 0.05, 0.05, 0.02, i % 2 ? MAT.maquina : MAT.vermelho, L / 4 - 0.15 + i * 0.1, 1.3, 0.26);
  return { grupo: g, w: L, d: 0.5, h: 2.0 };
}

/** Conjunto motobomba sobre base: centrifuga com o eixo ao longo de x;
 *  com `diesel`, o motor a combustao com radiador e escape no lugar do
 *  eletrico. Vermelho, se de incendio. */
export function criarMotobomba({ potencia = 30, rotor = 0.18, dn = [150, 100], diesel = false, incendio = false } = {}) {
  const g = peca('motobomba');
  const b = criarBombaCentrifuga({ dnSuccao: dn[0], dnDescarga: dn[1], rotor, potencia });
  const L = Math.max(1.6, b.comprimento + (diesel ? 1.2 : 0.4)), d = Math.max(0.7, b.largura + 0.3);
  bx(g, L, 0.2, d, incendio ? MAT.vermelho : MAT.grafite, 0, 0.1, 0);
  b.raiz.position.set(-L / 2 + 0.2 + b.comprimento / 2, 0.2, 0);
  b.raiz.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  g.add(b.raiz);
  let escape = null;
  if (diesel) {
    const x = L / 2 - 0.55;
    bx(g, 0.9, 0.75, 0.6, MAT.vermelho, x, 0.6, 0);
    bx(g, 0.1, 0.7, 0.65, MAT.grafite, L / 2 - 0.05, 0.6, 0);
    cl(g, 0.06, 1.6, MAT.aco, x, 1.75, -0.2, 8);
    escape = [x, 2.55, -0.2];                     // topo do tubo: quem compoe o leva ao telhado
  }
  // face de cada bocal (succao na ponta -x, recalque em cima), no
  // referencial da motobomba: quem compoe liga os tubos nelas
  const bocais = Object.fromEntries(b.bocais.map((n) => [n.id, {
    dn: n.dn, dir: n.dir,
    face: n.pos.map((v, i) => v + n.dir[i] * n.comprimento + [b.raiz.position.x, b.raiz.position.y, 0][i]),
  }]));
  return { grupo: g, w: L, d, h: diesel ? 2.55 : b.altura + 0.2, bocais, escape };
}

/** Soprador de lobulos na cabine acustica, com o silenciador em cima. */
export function criarSoprador() {
  const g = peca('soprador');
  bx(g, 1.2, 1.2, 0.9, MAT.azul, 0, 0.6, 0);
  for (let i = 0; i < 5; i++) bx(g, 0.9, 0.02, 0.01, MAT.grafite, 0, 0.3 + i * 0.15, 0.455);
  cl(g, 0.12, 0.8, MAT.aco, 0.35, 1.6, -0.2, 10);
  return { grupo: g, w: 1.2, d: 0.9, h: 2.0 };
}

/** Estacao de dosagem: bombona de produto quimico e duas dosadoras. */
export function criarDosagem() {
  const g = peca('dosagem');
  cl(g, 0.3, 0.9, MAT.pead, -0.4, 0.45, 0, 14);
  bx(g, 0.7, 0.08, 0.5, MAT.grafite, 0.35, 0.04, 0);
  for (const x of [0.2, 0.5]) {
    bx(g, 0.18, 0.22, 0.22, MAT.amarelo, x, 0.19, 0);
    cl(g, 0.06, 0.12, MAT.grafite, x, 0.36, 0, 10);
  }
  return { grupo: g, w: 1.3, d: 0.65, h: 0.95 };
}

/** Balcao de recepcao (visitante em +z) com a cadeira e o monitor atras. */
export function criarRecepcao({ L = 2.4 } = {}) {
  const g = peca('recepcao');
  bx(g, L, 1.1, 0.12, MAT.madeira, 0, 0.55, 0.2);
  bx(g, L, 0.04, 0.35, MAT.branco, 0, 1.12, 0.2);
  bx(g, L, 0.03, 0.6, MAT.branco, 0, 0.74, -0.15);
  monitor(g, 0, 0.755, -0.25, 2);
  const c = criarCadeira();
  c.grupo.position.set(0, 0, -0.75);
  g.add(c.grupo);
  return { grupo: g, w: L, d: 1.6, h: 1.15 };
}

/** Longarina de espera com `n` assentos. */
export function criarLongarina({ n = 3 } = {}) {
  const g = peca('longarina');
  const w = n * 0.6;
  bx(g, w, 0.05, 0.05, MAT.aco, 0, 0.3, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * 0.6;
    bx(g, 0.5, 0.06, 0.48, MAT.estofado, x, 0.45, 0);
    bx(g, 0.5, 0.45, 0.05, MAT.estofado, x, 0.72, -0.22);
  }
  for (const sx of [-1, 1]) bx(g, 0.05, 0.42, 0.45, MAT.aco, sx * (w / 2 - 0.1), 0.21, 0);
  return { grupo: g, w, d: 0.55, h: 0.95 };
}

/** Luminaria de embutir de 1,2 x 0,3 m, acesa (origem na face de baixo). */
export function criarLuminaria({ galpao = false } = {}) {
  const g = peca('luminaria');
  if (galpao) {
    cl(g, 0.25, 0.25, MAT.aco, 0, 0.13, 0, 14);
    cl(g, 0.22, 0.01, MAT.luz, 0, 0.0, 0, 14);
    // haste curta: a luminaria fica acima da ponte rolante
    cl(g, 0.01, 0.4, MAT.aco, 0, 0.45, 0, 6);
    return { grupo: g, w: 0.5, d: 0.5, h: 0.65 };
  }
  bx(g, 1.2, 0.02, 0.3, MAT.luz, 0, 0.01, 0);
  return { grupo: g, w: 1.2, d: 0.3, h: 0.02 };
}
