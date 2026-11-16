import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { triplanar } from './texturas.js';

/**
 * ===========================================================================
 *  PORTARIA E PONTO DE ONIBUS  (Fase 15)
 * ===========================================================================
 *  Guarita envidracada, cobertura da praca (como a de pedagio), catraca,
 *  cancela de braco e abrigo de onibus. Primitivas: a posicao e as medidas
 *  vem de site.js (PRACA_PORTARIA, ONIBUS); aqui so a forma. Origem no piso,
 *  [ADOTADO] proporcoes de catalogo.
 */

function caixa(dx, dy, dz, mat, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

const PAREDE = triplanar(new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 }), 'concreto', 2);
const ALUMINIO = new THREE.MeshStandardMaterial({ color: 0x5b6168, metalness: 0.7, roughness: 0.35 });
const VIDRO = new THREE.MeshStandardMaterial({
  color: 0xbfe0f0, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide,
});
const AMARELO = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
const PRETO = new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.6 });
const VERMELHO = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
const BRANCO = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
const MADEIRA = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
const LUZ = new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff2cc, emissiveIntensity: 0.8 });

/** Textura de texto em canvas (sRGB, senao sai lavada). */
function texturaTexto(linhas, { largura = 1024, altura = 128, fundo = '#1f4e79', cor = '#ffffff', fonte = 'bold' } = {}) {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  const g = c.getContext('2d');
  if (fundo) { g.fillStyle = fundo; g.fillRect(0, 0, largura, altura); }
  g.fillStyle = cor;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = linhas.length;
  linhas.forEach((t, i) => {
    const fs = Math.min(altura / n * 0.7, largura / (t.length * 0.62));
    g.font = `${fonte} ${fs}px sans-serif`;
    g.fillText(t, largura / 2, (altura * (i + 0.5)) / n);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Guarita envidracada: peitoril de 1 m, vidro ate 2,6 m nos quatro lados
 * (o porteiro ve quem chega e quem sai), porta no lado `porta` ('-z' = norte),
 * laje com beiral e, dentro, o balcao com o monitor voltado para a entrada.
 *   largura (x) e comprimento (z) da planta, origem no centro, no piso
 */
export function criarGuarita({ largura, comprimento, porta = '-z' }) {
  const g = new THREE.Group();
  g.name = 'guarita';
  const e = 0.12, hp = 1.0, hv = 2.6, hl = 0.2;
  const hx = largura / 2, hz = comprimento / 2;
  const piso = caixa(largura, 0.15, comprimento, PAREDE);
  piso.position.y = 0.075 - 0.05;
  g.add(piso);
  // peitoril, com o vao da porta
  const lados = {
    '-z': { w: largura, d: e, x: 0, z: -hz + e / 2 }, '+z': { w: largura, d: e, x: 0, z: hz - e / 2 },
    '-x': { w: e, d: comprimento, x: -hx + e / 2, z: 0 }, '+x': { w: e, d: comprimento, x: hx - e / 2, z: 0 },
  };
  const vaoPorta = 0.9;
  for (const [lado, L] of Object.entries(lados)) {
    const emX = L.w > L.d;
    if (lado === porta) {
      // dois pedacos de peitoril, a porta entre eles
      const resto = ((emX ? L.w : L.d) - vaoPorta) / 2;
      for (const s of [-1, 1]) {
        const p = caixa(emX ? resto : L.w, hp, emX ? L.d : resto, PAREDE);
        p.position.set(L.x + (emX ? s * (vaoPorta + resto) / 2 : 0), hp / 2, L.z + (emX ? 0 : s * (vaoPorta + resto) / 2));
        g.add(p);
      }
      const folha = caixa(emX ? vaoPorta : 0.05, 2.1, emX ? 0.05 : vaoPorta, ALUMINIO);
      folha.position.set(L.x, 1.05, L.z);
      g.add(folha);
    } else {
      const p = caixa(L.w, hp, L.d, PAREDE);
      p.position.set(L.x, hp / 2, L.z);
      g.add(p);
    }
    // vidro do peitoril ao teto (acima da porta, so a bandeira)
    const y0 = lado === porta ? 2.1 : hp;
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(emX ? L.w - 0.1 : L.d - 0.1, hv - y0), VIDRO);
    vidro.position.set(L.x, (y0 + hv) / 2, L.z);
    if (!emX) vidro.rotation.y = Math.PI / 2;
    g.add(vidro);
  }
  // montantes nos cantos e a cada ~1,2 m
  const montante = (x, z) => {
    const m = caixa(0.06, hv - hp, 0.06, ALUMINIO, false);
    m.position.set(x, (hp + hv) / 2, z);
    g.add(m);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) montante(sx * (hx - 0.03), sz * (hz - 0.03));
  for (let z = -hz + 1.2; z < hz - 0.6; z += 1.2) { montante(-hx + 0.03, z); montante(hx - 0.03, z); }
  // laje com beiral
  const laje = caixa(largura + 0.8, hl, comprimento + 0.8, PAREDE);
  laje.position.y = hv + hl / 2;
  g.add(laje);
  // balcao no lado da entrada (+x) e o monitor
  const balcao = caixa(0.45, 0.06, comprimento - 0.6, MADEIRA, false);
  balcao.position.set(hx - e - 0.25, 0.95, 0);
  g.add(balcao);
  const frente = caixa(0.04, 0.85, comprimento - 0.6, PAREDE, false);
  frente.position.set(hx - e - 0.47, 0.5, 0);
  g.add(frente);
  const monitor = caixa(0.05, 0.32, 0.5, PRETO, false);
  monitor.position.set(hx - e - 0.3, 1.18, 0.3);
  g.add(monitor);
  // a camera nao atravessa o vidro nem a porta (fechada: e o porteiro quem
  // abre); caixas no referencial da guarita (Fase 16)
  const colisores = [
    { x0: -hx, x1: hx, z0: -hz, z1: -hz + e }, { x0: -hx, x1: hx, z0: hz - e, z1: hz },
    { x0: -hx, x1: -hx + e, z0: -hz, z1: hz }, { x0: hx - e, x1: hx, z0: -hz, z1: hz },
  ].map((c) => ({ ...c, y0: 0, y1: hv }));
  colisores.push({ x0: -hx - 0.4, x1: hx + 0.4, y0: hv, y1: hv + hl, z0: -hz - 0.4, z1: hz + 0.4 });
  return { grupo: g, altura: hv + hl, colisores };
}

/**
 * Cobertura da praca da portaria: laje metalica sobre pilares, com a faixa
 * do letreiro nos dois lados longos e luminarias por baixo.
 *   ret       planta da cobertura { x0, x1, z0, z1 }
 *   pilares   [[x, z]] em coordenada de mundo
 *   yBase     piso dos pilares; alturaLivre acima dele
 */
export function criarCoberturaPortaria({ ret: r, pilares, yBase, alturaLivre, espessura = 0.9, letreiro = ['PORTARIA'] }) {
  const g = new THREE.Group();
  g.name = 'cobertura-portaria';
  const lx = r.x1 - r.x0, lz = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const y0 = yBase + alturaLivre;
  // emissiveMap apagado de dia: o modo noite (site/noite.js) acende pelo nome
  const texFaixa = texturaTexto(letreiro, { largura: 2048, altura: 160 });
  const faixa = new THREE.MeshStandardMaterial({ map: texFaixa, roughness: 0.6, emissive: 0xffffff, emissiveMap: texFaixa, emissiveIntensity: 0, name: 'letreiro-portaria' });
  const metal = triplanar(new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.5, roughness: 0.45 }), 'telhaX', 1);
  const forro = new THREE.MeshStandardMaterial({ color: 0xdedfe0, roughness: 0.8 });
  // BoxGeometry: +x, -x, +y, -y, +z, -z — letreiro nos lados longos (z)
  const laje = new THREE.Mesh(new THREE.BoxGeometry(lx, espessura, lz), [forro, forro, metal, forro, faixa, faixa]);
  laje.position.set(cx, y0 + espessura / 2, cz);
  laje.castShadow = true;
  g.add(laje);
  for (const [x, z] of pilares) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, alturaLivre + 0.1, 16), MAT.acoCarbono);
    p.position.set(x, yBase - 0.05 + (alturaLivre + 0.1) / 2, z);
    p.castShadow = true;
    g.add(p);
    const base = caixa(0.6, 0.2, 0.6, PAREDE);
    base.position.set(x, yBase + 0.05, z);
    g.add(base);
  }
  // luminarias em linhas sobre as pistas, coladas ao forro
  for (let x = r.x0 + 2; x <= r.x1 - 2 + 1e-6; x += 4) {
    for (const z of [cz - lz / 4, cz + lz / 4]) {
      const l = caixa(1.2, 0.06, 0.3, LUZ, false);
      l.position.set(x, y0 - 0.03, z);
      g.add(l);
    }
  }
  return { grupo: g };
}

/**
 * Catraca de tripe e, ao lado, o portao de acessibilidade, atravessando a
 * calcada. Origem no meio da calcada; a calcada corre em Z, a passagem e
 * em X (largura da calcada `largura`).
 */
export function criarCatraca({ largura = 2 } = {}) {
  const g = new THREE.Group();
  g.name = 'catraca';
  const h = largura / 2;
  // pedestal da catraca no lado -x, deixando 0,55 m de passagem
  const pedestal = caixa(0.32, 1.0, 0.45, ALUMINIO);
  pedestal.position.set(-h + 0.35, 0.5, 0);
  g.add(pedestal);
  const tampo = caixa(0.36, 0.04, 0.5, PRETO, false);
  tampo.position.set(-h + 0.35, 1.02, 0);
  g.add(tampo);
  // o braco do tripe que fecha a passagem (os outros dois ficam para baixo)
  const braco = caixa(0.52, 0.04, 0.04, ALUMINIO, false);
  braco.position.set(-h + 0.35 + 0.16 + 0.26, 0.9, 0);
  g.add(braco);
  for (const s of [-1, 1]) {
    const b = caixa(0.04, 0.4, 0.04, ALUMINIO, false);
    b.position.set(-h + 0.55, 0.72, s * 0.12);
    b.rotation.x = s * 0.6;
    g.add(b);
  }
  // portao de acessibilidade (0,9 m) do outro lado, com os dois montantes
  for (const x of [h - 0.1, h - 1.05]) {
    const m = caixa(0.06, 1.1, 0.06, ALUMINIO, false);
    m.position.set(x, 0.55, 0);
    g.add(m);
  }
  const barra = caixa(0.9, 0.05, 0.04, AMARELO, false);
  barra.position.set(h - 0.575, 0.95, 0);
  g.add(barra);
  return { grupo: g };
}

/**
 * Cancela: coluna com o motor e o braco listrado, de `comprimento` m, que
 * gira em torno do eixo da coluna para subir (`braco.rotation.z`, ate ~85°).
 * O braco aponta para +x; a coluna fica na origem.
 */
export function criarCancela({ comprimento = 4.7 } = {}) {
  const g = new THREE.Group();
  g.name = 'cancela';
  const coluna = caixa(0.32, 1.05, 0.32, AMARELO);
  coluna.position.y = 0.525;
  g.add(coluna);
  for (let k = 0; k < 3; k++) {
    const f = caixa(0.33, 0.08, 0.33, PRETO, false);
    f.position.y = 0.2 + k * 0.3;
    g.add(f);
  }
  const braco = new THREE.Group();
  braco.name = 'braco-cancela';
  // gira: fica fora da fusao das malhas paradas (core/fundir.js)
  braco.userData.girante = true;
  braco.position.set(0, 0.92, 0);
  const n = Math.round(comprimento / 0.5);
  for (let i = 0; i < n; i++) {
    const s = caixa(comprimento / n, 0.07, 0.07, i % 2 ? BRANCO : VERMELHO, false);
    s.position.set(0.12 + (i + 0.5) * (comprimento / n), 0, 0);
    braco.add(s);
  }
  g.add(braco);
  return { grupo: g, braco };
}

/**
 * Abrigo de onibus: piso na altura da calcada, quatro colunas, fundo de
 * vidro, banco, telhado inclinado para tras com beiral sobre a calcada e a
 * placa. Origem no centro do piso; a frente (o onibus) e +z... ou o lado
 * `frente` (+z ou -z).
 */
export function criarAbrigo({ comprimento, profundidade, beiral = 1.4, altura = 2.7, frente = 1, placa = ['PONTO DE ÔNIBUS'] }) {
  const g = new THREE.Group();
  g.name = 'abrigo';
  const hz = profundidade / 2, hx = comprimento / 2;
  const s = frente;                                   // +1: a frente e +z
  // piso na altura da calcada, enterrado ate o gramado (sem fresta embaixo)
  const piso = caixa(comprimento, 0.3, profundidade, PAREDE);
  piso.position.y = -0.15;
  g.add(piso);
  for (const x of [-hx + 0.15, hx - 0.15]) {
    for (const z of [-hz + 0.15, hz - 0.15]) {
      const c = caixa(0.1, altura, 0.1, ALUMINIO);
      c.position.set(x, altura / 2, z);
      g.add(c);
    }
  }
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(comprimento - 0.3, altura - 0.4), VIDRO);
  fundo.position.set(0, altura / 2 + 0.2, -s * (hz - 0.15));
  g.add(fundo);
  // telhado: do fundo ate o beiral sobre a calcada, caindo para tras
  const prof = profundidade + beiral;
  const telha = caixa(comprimento + 0.4, 0.08, prof, triplanar(new THREE.MeshStandardMaterial({ color: 0x5f7f99, metalness: 0.4, roughness: 0.5 }), 'telhaZ', 1));
  telha.position.set(0, altura + 0.15, s * (beiral / 2));
  telha.rotation.x = s * 0.06;
  g.add(telha);
  // banco junto do fundo
  const assento = caixa(comprimento - 1, 0.06, 0.4, MADEIRA);
  assento.position.set(0, 0.45, -s * (hz - 0.55));
  g.add(assento);
  for (let x = -hx + 1; x <= hx - 1 + 1e-6; x += (comprimento - 2) / 3) {
    const p = caixa(0.06, 0.45, 0.35, ALUMINIO, false);
    p.position.set(x, 0.225, -s * (hz - 0.55));
    g.add(p);
  }
  // placa no alto, num dos lados
  const texPlaca = texturaTexto(placa, { largura: 512, altura: 160, fundo: '#1f4e79' });
  const mat = new THREE.MeshStandardMaterial({ map: texPlaca, emissive: 0xffffff, emissiveMap: texPlaca, emissiveIntensity: 0, name: 'letreiro-abrigo' });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), mat);
  pl.position.set(-hx + 0.15, altura - 0.4, s * (hz + 0.02));
  pl.rotation.y = s > 0 ? 0 : Math.PI;
  g.add(pl);
  return { grupo: g };
}

/**
 * Pintura de chao com texto (`texto`) num retangulo de `largura` x
 * `comprimento`, deitada, lida de quem anda no sentido `rumo` (rad, frente em
 * +z). Deslocamento de profundidade: nunca pisca com a calcada.
 */
export function pinturaChao({ texto, largura, comprimento, cor = '#f2c230' }) {
  const tex = texturaTexto([texto], { largura: 1024, altura: Math.round(1024 * largura / comprimento), fundo: null, cor });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(comprimento, largura), new THREE.MeshStandardMaterial({
    map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));
  m.rotation.x = -Math.PI / 2;
  m.name = 'pintura-chao';
  return m;
}

/** Faixa pintada no chao (deslocamento de profundidade), ao longo de uma polilinha. */
export function faixaPintada(pontos, largura, y, cor = 0xf2c230) {
  const g = new THREE.Group();
  g.name = 'faixa-pintada';
  const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  for (let i = 1; i < pontos.length; i++) {
    const [ax, az] = pontos[i - 1], [bx, bz] = pontos[i];
    const L = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, largura), mat);
    m.rotation.order = 'YXZ';
    m.rotation.x = -Math.PI / 2;
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    m.position.set((ax + bx) / 2, y, (az + bz) / 2);
    g.add(m);
  }
  return g;
}
