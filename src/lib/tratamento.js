import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { criarEscada } from './supports.js';
import { criarCortaChamas } from './pontas.js';
import { DN } from '../data/plant.js';

/**
 * ===========================================================================
 *  TRATAMENTO DE AGUA E DE EFLUENTE  (Fase 15)
 * ===========================================================================
 *  Pecas da ETA (cabeca de poco, filtro pressurizado, abrandador, tanque de
 *  salmoura, castelo d'agua) e da ETE (separador agua-oleo, decantador
 *  circular). O tamanho vem de data/agua.js; a proporcao das partes e de
 *  catalogo [ESTIMADO]. Origem no piso, no centro da pegada.
 */

const SEG = 32;

function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cil(r, h, mat, seg = SEG) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.castShadow = true;
  return m;
}

/** Barra redonda de a ate b (contraventamento, tubo curto). */
function barra(a, b, r, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const m = cil(r, va.distanceTo(vb), mat, 8);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

const PINTURA = new THREE.MeshStandardMaterial({ color: 0x2f6aa8, metalness: 0.35, roughness: 0.5, name: 'pintura-azul' });
const FIBRA = new THREE.MeshStandardMaterial({ color: 0x33415f, roughness: 0.4, name: 'fibra' });
const PEAD = new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.75, name: 'pead' });
const PAINEL = new THREE.MeshStandardMaterial({ color: 0xc9ccc8, metalness: 0.3, roughness: 0.6, name: 'painel-eletrico' });
const AGUA_CLARA = new THREE.MeshStandardMaterial({
  color: 0x4f8f90, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.85, name: 'agua-clarificada',
});

/**
 * Cabeca de poco tubular: laje de protecao sanitaria, boca do revestimento
 * com tampa flangeada, saida da bomba submersa com valvula descendo para a
 * linha enterrada, e o quadro de comando num poste.
 */
export function criarCabecaPoco({ lado = 2 } = {}) {
  const g = new THREE.Group();
  g.name = 'poco';
  const laje = caixa(lado, 0.25, lado, MAT.concreto);
  laje.position.y = 0.025;
  g.add(laje);
  const tubo = cil(0.11, 0.6, MAT.acoCarbono, 16);
  tubo.position.y = 0.15 + 0.3;
  g.add(tubo);
  const tampa = cil(0.19, 0.06, MAT.flange, 16);
  tampa.position.y = 0.78;
  g.add(tampa);
  // saida da bomba: sobe da tampa, vai para +x e desce para a linha enterrada
  g.add(barra([0, 0.8, 0], [0, 1.0, 0], 0.045, MAT.acoCarbono));
  g.add(barra([0, 1.0, 0], [0.7, 1.0, 0], 0.045, MAT.acoCarbono));
  g.add(barra([0.7, 1.0, 0], [0.7, 0.15, 0], 0.045, MAT.acoCarbono));
  const valvula = caixa(0.16, 0.2, 0.16, MAT.atuador);
  valvula.position.set(0.35, 1.0, 0);
  g.add(valvula);
  // quadro de comando da bomba, num poste no canto da laje
  const xp = -lado / 2 + 0.25, zp = -lado / 2 + 0.25;
  const poste = caixa(0.08, 1.7, 0.08, MAT.acoCarbono);
  poste.position.set(xp, 0.15 + 0.85, zp);
  g.add(poste);
  const quadro = caixa(0.5, 0.6, 0.22, PAINEL);
  quadro.position.set(xp + 0.3, 1.35, zp);
  g.add(quadro);
  return { grupo: g, altura: 1.7 };
}

/**
 * Vaso vertical sobre pes, tampos elipticos 2:1, boca de visita no topo e
 * os bocais de entrada (em cima) e de saida (embaixo) para +x. Serve ao
 * filtro de areia (aco pintado) e a coluna do abrandador (fibra, pes curtos).
 */
export function criarVasoPressao({ D, H, pes = 0.5, fibra = false }) {
  const g = new THREE.Group();
  g.name = fibra ? 'coluna-abrandador' : 'filtro-areia';
  const R = D / 2;
  const mat = fibra ? FIBRA : PINTURA;
  const yLt = pes + R / 2;                       // linha de tangencia de baixo
  const costado = cil(R, H, mat);
  costado.position.y = yLt + H / 2;
  costado.receiveShadow = true;
  g.add(costado);
  for (const [y, s] of [[yLt, -1], [yLt + H, 1]]) {
    const tampo = new THREE.Mesh(new THREE.SphereGeometry(R, SEG, 10, 0, Math.PI * 2,
      s > 0 ? 0 : Math.PI / 2, Math.PI / 2), mat);
    tampo.scale.y = 0.5;
    tampo.position.y = y;
    tampo.castShadow = true;
    g.add(tampo);
  }
  // pes: tres cantoneiras soldadas no tampo de baixo, com chapa de base
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    const rp = R * 0.8;
    const pe = caixa(0.07, yLt + 0.05, 0.07, MAT.acoCarbono);
    pe.position.set(Math.cos(a) * rp, (yLt + 0.05) / 2, Math.sin(a) * rp);
    g.add(pe);
    const base = caixa(0.18, 0.02, 0.18, MAT.acoCarbono);
    base.position.set(Math.cos(a) * rp, 0.01, Math.sin(a) * rp);
    g.add(base);
  }
  // boca de visita no topo e bocais para +x
  const boca = cil(Math.min(0.22, R * 0.4), 0.15, mat, 16);
  boca.position.y = yLt + H + R / 2 - 0.02;
  g.add(boca);
  const rb = Math.max(0.03, R * 0.07);
  for (const y of [yLt + H - 0.15, yLt + 0.2]) {
    g.add(barra([R * 0.9, y, 0], [R + 0.25, y, 0], rb, MAT.acoCarbono));
    const fl = cil(rb * 1.8, 0.03, MAT.flange, 12);
    fl.rotation.z = Math.PI / 2;
    fl.position.set(R + 0.25, y, 0);
    g.add(fl);
  }
  return { grupo: g, altura: yLt + H + R / 2 + 0.13 };
}

/** Tanque de salmoura do abrandador: polietileno com tampa. */
export function criarTanqueSalmoura({ D, H }) {
  const g = new THREE.Group();
  g.name = 'salmoura';
  const corpo = cil(D / 2, H, PEAD);
  corpo.position.y = H / 2;
  g.add(corpo);
  const tampa = cil(D / 2 + 0.02, 0.05, PEAD);
  tampa.position.y = H + 0.025;
  g.add(tampa);
  return { grupo: g, altura: H + 0.05 };
}

/**
 * Castelo d'agua: quatro pernas de aco contraventadas em X a cada lance,
 * plataforma de grade com guarda-corpo sob a cuba, cuba cilindrica de
 * fundo plano com teto conico e escada de marinheiro ate a plataforma.
 */
export function criarCastelo({ D, H, fundo }) {
  const g = new THREE.Group();
  g.name = 'castelo';
  const R = D / 2;
  const a = R + 0.2;                              // meio lado do quadrado das pernas
  const cantos = [[-a, -a], [a, -a], [a, a], [-a, a]];
  for (const [x, z] of cantos) {
    const perna = caixa(0.16, fundo, 0.16, MAT.acoCarbono);
    perna.position.set(x, fundo / 2, z);
    g.add(perna);
    const sapata = caixa(0.6, 0.4, 0.6, MAT.concreto);
    sapata.position.set(x, 0, z);
    g.add(sapata);
  }
  // contraventamento: anel horizontal e X em cada face, lances de ~3 m
  const lances = Math.max(2, Math.round(fundo / 3));
  for (let k = 0; k < lances; k++) {
    const y0 = (fundo * k) / lances, y1 = (fundo * (k + 1)) / lances;
    for (let i = 0; i < 4; i++) {
      const [xa, za] = cantos[i], [xb, zb] = cantos[(i + 1) % 4];
      g.add(barra([xa, y1, za], [xb, y1, zb], 0.04, MAT.acoCarbono));
      g.add(barra([xa, y0 + 0.3, za], [xb, y1, zb], 0.02, MAT.acoCarbono));
      g.add(barra([xb, y0 + 0.3, zb], [xa, y1, za], 0.02, MAT.acoCarbono));
    }
  }
  const lp = R + 0.6;
  const plataforma = caixa(2 * lp, 0.08, 2 * lp, MAT.grade);
  plataforma.position.y = fundo;
  g.add(plataforma);
  for (const h of [0.55, 1.1]) {
    for (const [x, z, dx, dz] of [[0, -lp, 2 * lp, 0.04], [0, lp, 2 * lp, 0.04], [-lp, 0, 0.04, 2 * lp], [lp, 0, 0.04, 2 * lp]]) {
      const rail = caixa(dx, 0.04, dz, MAT.guardaCorpo);
      rail.position.set(x, fundo + h, z);
      g.add(rail);
    }
  }
  for (const [x, z] of [[-lp, -lp], [lp, -lp], [lp, lp], [-lp, lp]]) {
    const poste = caixa(0.05, 1.1, 0.05, MAT.guardaCorpo);
    poste.position.set(x, fundo + 0.55, z);
    g.add(poste);
  }
  const cuba = cil(R, H, PINTURA);
  cuba.position.y = fundo + 0.04 + H / 2;
  cuba.receiveShadow = true;
  g.add(cuba);
  const teto = new THREE.Mesh(new THREE.ConeGeometry(R * 1.03, R / 3, SEG), PINTURA);
  teto.position.y = fundo + 0.04 + H + R / 6;
  teto.castShadow = true;
  g.add(teto);
  // escada por fora da plataforma, no lado +x
  g.add(criarEscada({ yBase: 0, yTopo: fundo + 0.04, raio: lp + 0.15, angulo: 0, largura: 0.5 }));
  return { grupo: g, altura: fundo + 0.04 + H + R / 3 };
}

const TAMPA = new THREE.MeshStandardMaterial({ color: 0x3d4247, metalness: 0.6, roughness: 0.45, name: 'tampa' });
const AGUA_ESCURA = new THREE.MeshStandardMaterial({ color: 0x34433f, roughness: 0.1, metalness: 0.3, name: 'agua-enterrada' });

/**
 * Caixa de concreto enterrada com laje por cima (separador, equalizacao):
 * so a laje aparece, 0,15 m acima do piso, com as tampas de inspecao; as
 * paredes, o fundo e a lamina ficam abaixo (aparecem no corte). `nivel` e
 * a cota da lamina e `fundo` a do piso interno, negativas, em m.
 * tampas: [[x, z, lado], ...] no referencial da caixa.
 */
export function criarCaixaEnterrada({ comprimento, largura, fundo, nivel, tampas = [] }) {
  const g = new THREE.Group();
  g.name = 'caixa-enterrada';
  const e = 0.25, topo = 0.15;
  for (const [w, d, x, z] of [[comprimento, e, 0, -largura / 2 + e / 2], [comprimento, e, 0, largura / 2 - e / 2],
    [e, largura, -comprimento / 2 + e / 2, 0], [e, largura, comprimento / 2 - e / 2, 0]]) {
    const parede = caixa(w, topo - fundo + 0.3, d, MAT.concreto);
    parede.position.set(x, (topo + fundo - 0.3) / 2, z);
    g.add(parede);
  }
  const piso = caixa(comprimento, 0.3, largura, MAT.concreto);
  piso.position.y = fundo - 0.15;
  g.add(piso);
  const lamina = new THREE.Mesh(new THREE.BoxGeometry(comprimento - 2 * e, 0.02, largura - 2 * e), AGUA_ESCURA);
  lamina.position.y = nivel;
  g.add(lamina);
  const laje = caixa(comprimento, 0.2, largura, MAT.concreto);
  laje.position.y = topo - 0.1;
  g.add(laje);
  for (const [x, z, l] of tampas) {
    const t = caixa(l, 0.04, l, TAMPA);
    t.position.set(x, topo + 0.02, z);
    g.add(t);
  }
  return { grupo: g, altura: topo + 0.04, topo };
}

/**
 * Separador agua-oleo gravitacional (API 421), enterrado: a drenagem chega
 * por gravidade a ~1,6 m do piso. Dentro, a chicana de entrada (espalha o
 * jato), o tubo coletor de oleo rotativo e a chicana de saida, que desce
 * abaixo da lamina e segura o oleo; por cima, a laje com uma tampa sobre
 * cada um e o respiro com corta-chamas (vapor de tolueno). A agua entra
 * pela ponta -x e sai pela +x; quem compoe gira o grupo para a entrada
 * ficar do lado da drenagem.
 */
export function criarSeparadorAguaOleo({ comprimento, largura, lamina, nivel }) {
  const fundo = nivel - lamina;
  const xE = -comprimento / 2 + 1, xC = comprimento / 2 - 1.4, xS = comprimento / 2 - 0.8;
  const { grupo: g, topo } = criarCaixaEnterrada({
    comprimento, largura, fundo, nivel, tampas: [[xE - 0.5, 0, 0.7], [xC, 0, 0.7], [xS + 0.4, 0, 0.6]],
  });
  g.name = 'separador';
  const li = largura - 0.5;
  for (const x of [xE, xS]) {
    const ch = caixa(0.15, topo - 0.2 - (fundo + 0.3), li, MAT.concreto);
    ch.position.set(x, (topo - 0.2 + fundo + 0.3) / 2, 0);
    g.add(ch);
  }
  g.add(barra([xC, nivel, -li / 2], [xC, nivel, li / 2], 0.08, MAT.acoCarbono));
  // respiro de DN 100 com corta-chamas, 3 m acima da laje, no meio do canal
  g.add(barra([0, topo, 0], [0, topo + 3, 0], DN[100].od / 2, MAT.acoCarbono));
  const cc = criarCortaChamas({ dn: 100 });
  cc.position.set(0, topo + 3, 0);
  g.add(cc);
  return { grupo: g, altura: topo + 3.5 };
}

/* Ponte do raspador do decantador (Fase 27, item 22) [ADOTADO]: 3 cm/s na
 * borda, a faixa de raspador periferico (1 a 3 cm/s) — ~1 volta a cada
 * 15 min num decantador de ~5 m de raio. */
const VELOCIDADE_PONTE = 0.03;

/**
 * Decantador secundario circular: parede de concreto, calha vertedoura
 * junto a parede, poco central de alimentacao e a ponte do raspador
 * atravessando o diametro.
 */
export function criarDecantador({ D, H }) {
  const g = new THREE.Group();
  g.name = 'decantador';
  const R = D / 2, e = 0.15;
  const parede = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(R, -0.3), new THREE.Vector2(R + e, -0.3), new THREE.Vector2(R + e, H),
    new THREE.Vector2(R, H), new THREE.Vector2(R, -0.3),
  ], SEG * 2), MAT.concreto);
  parede.castShadow = true;
  parede.receiveShadow = true;
  g.add(parede);
  const fundo = cil(R + e, 0.3, MAT.concreto);
  fundo.position.y = -0.15 + 0.04;
  g.add(fundo);
  const calha = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(R - 0.3, H - 0.45), new THREE.Vector2(R, H - 0.45), new THREE.Vector2(R, H - 0.1),
    new THREE.Vector2(R - 0.3, H - 0.1), new THREE.Vector2(R - 0.3, H - 0.45),
  ], SEG * 2), MAT.concreto);
  g.add(calha);
  const agua = new THREE.Mesh(new THREE.CircleGeometry(R - 0.3, SEG), AGUA_CLARA);
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = H - 0.2;
  g.add(agua);
  const poco = cil(R * 0.25, 1.4, MAT.acoCarbono);
  poco.position.y = H - 0.6;
  g.add(poco);
  // ponte do raspador, apoiada nas paredes, com guarda-corpo de um lado;
  // gira em volta do poco central (Fase 27, item 22) a VELOCIDADE_PONTE na
  // borda — fora da fusao (girante), e quem anda o relogio e o main.js
  const giro = new THREE.Group();
  giro.name = 'ponte-raspador';
  giro.userData.girante = true;
  const ponte = caixa(2 * (R + e), 0.08, 0.7, MAT.grade);
  ponte.position.y = H + 0.15;
  giro.add(ponte);
  for (const h of [0.55, 1.1]) {
    const rail = caixa(2 * (R + e), 0.04, 0.04, MAT.guardaCorpo);
    rail.position.set(0, H + 0.15 + h, 0.33);
    giro.add(rail);
  }
  for (const x of [-(R + e) + 0.05, 0, R + e - 0.05]) {
    const poste = caixa(0.05, 1.1, 0.05, MAT.guardaCorpo);
    poste.position.set(x, H + 0.15 + 0.55, 0.33);
    giro.add(poste);
  }
  const motor = caixa(0.35, 0.3, 0.3, MAT.motor);
  motor.position.set(0, H + 0.34, -0.1);
  giro.add(motor);
  const w = VELOCIDADE_PONTE / (R + e);
  giro.userData.animarTempo = (t) => { giro.rotation.y = t * w; };
  g.add(giro);
  return { grupo: g, altura: H + 1.3 };
}
