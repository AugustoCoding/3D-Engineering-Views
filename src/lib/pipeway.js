import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { Y } from './terreno.js';

/**
 * ===========================================================================
 *  PIPEWAY — estrutura da interligacao fora dos limites  (Fase 7)
 * ===========================================================================
 *  Pecas do corredor de tubos entre blocos. Quem decide onde vai cada uma e
 *  site/pipeways.js, a partir do corredor e das vias; aqui so o desenho:
 *
 *    poste      coluna unica no eixo do corredor, com travessa em balanco por
 *               nivel e o topo dela no fundo dos tubos (BOP), como no rack.
 *               Coluna unica porque o acostamento tem 3 m: um portico de
 *               1,4 m nao cabe nele a 1 m das duas bordas
 *    ponte      duas trelicas Pratt nos lados do corredor, banzo inferior no
 *               nivel mais baixo e travessas a cada painel: o tubo atravessa
 *               a via apoiado a cada ~3 m, e a via passa por baixo livre
 *    bandeja    cantoneira continua sob as linhas pequenas, que nao vencem o
 *               vao entre postes sozinhas (como no rack)
 *    caixa      caixa de inspecao da drenagem enterrada, com tampa
 *    luva       passagem de tubo na mureta da bacia
 *
 *  A sapata desce ate o piso do lote e sobe ao do bloco: o mesmo poste serve
 *  no acostamento (lote) e dentro de um bloco ou da bacia.
 */

const PERFIL = 0.2;           // coluna W 200 [ESTIMADO]
const VIGA_H = 0.18;
const VIGA_L = 0.12;
const Y_SAPATA = Y.bloco + 0.15;

function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Barra entre dois pontos. */
function barra(a, b, lado, mat = MAT.acoCarbono) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(lado, d.length(), lado), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

function sapata(x, z, lado) {
  const y0 = Y.lote - 0.1;
  const s = caixa(lado, Y_SAPATA - y0, lado, MAT.concreto);
  s.position.set(x, (Y_SAPATA + y0) / 2, z);
  s.castShadow = false;
  return s;
}

/**
 * Poste do pipeway: coluna unica no eixo do corredor (o meio do
 * acostamento, longe das duas bordas) com travessa em balanco por nivel. Na
 * cabeceira de ponte e um pilar em martelo: a travessa do nivel mais baixo
 * recebe o banzo inferior das trelicas, e o montante de ponta delas leva o
 * superior — a coluna nao sobe alem do nivel, onde passariam os tubos.
 * @param {object} p
 *   x, z        coluna em planta
 *   bracos      um por direcao de tubo que passa (dois na esquina):
 *               { lateral: [x, z] transversal, desloc: centro da travessa
 *               ao longo dela, largura }
 *   niveis      BOPs que o poste carrega
 *   topo        topo da coluna (o nivel mais alto)
 */
export function criarPostePipeway({ x, z, bracos, niveis, topo, sapataLado = 0.5 }) {
  const g = new THREE.Group();
  g.name = 'poste-pipeway';
  g.add(sapata(x, z, sapataLado));
  const col = caixa(PERFIL, topo - Y_SAPATA, PERFIL, MAT.acoCarbono);
  col.position.set(x, (topo + Y_SAPATA) / 2, z);
  g.add(col);
  for (const { lateral: lat, desloc, largura } of bracos) {
    const emX = Math.abs(lat[0]) > 0.5;          // travessa ao longo de X
    const cx = x + lat[0] * desloc, cz = z + lat[1] * desloc;
    for (const bop of niveis) {
      const comp = largura + PERFIL;
      const v = emX ? caixa(comp, VIGA_H, VIGA_L, MAT.acoCarbono) : caixa(VIGA_L, VIGA_H, comp, MAT.acoCarbono);
      v.position.set(cx, bop - VIGA_H / 2, cz);
      g.add(v);
    }
    // mao-francesa sob a travessa mais baixa, nos dois balancos
    const bop = Math.min(...niveis);
    for (const s of [-1, 1]) {
      const ponta = desloc + s * largura * 0.4;
      if (Math.abs(ponta) < 0.25) continue;
      const a = new THREE.Vector3(x, bop - 0.2 - Math.min(0.9, Math.abs(ponta)), z);
      const b = new THREE.Vector3(x + lat[0] * ponta, bop - VIGA_H, z + lat[1] * ponta);
      g.add(barra(a, b, 0.06));
    }
  }
  return g;
}

/**
 * Ponte de tubos entre dois porticos de cabeceira.
 * @param {object} p
 *   a, b        centros em planta dos porticos de cabeceira
 *   lateral     vetor transversal ao corredor
 *   largura     largura do corredor
 *   niveis      BOPs das travessas
 *   ySup        topo do banzo superior
 *   painel      vao maximo entre travessas
 */
export function criarPontePipeway({ a, b, lateral, largura, niveis, ySup, painel }) {
  const g = new THREE.Group();
  g.name = 'ponte-pipeway';
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.ceil(L / painel));
  const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const yInf = Math.min(...niveis) - VIGA_H / 2;
  const P = (t, s, y) => new THREE.Vector3(
    a[0] + d[0] * t + lateral[0] * s, y, a[1] + d[1] * t + lateral[1] * s,
  );
  const h = largura / 2;
  for (const s of [-h, h]) {
    // banzos
    g.add(barra(P(0, s, yInf), P(L, s, yInf), VIGA_H));
    g.add(barra(P(0, s, ySup), P(L, s, ySup), 0.14));
    for (let k = 0; k <= n; k++) {
      const t = (k * L) / n;
      g.add(barra(P(t, s, yInf), P(t, s, ySup), 0.1));
      if (k < n) {
        // Pratt: diagonais descendo para o meio do vao
        const t1 = ((k + 1) * L) / n;
        if (k < n / 2) g.add(barra(P(t, s, ySup), P(t1, s, yInf), 0.08));
        else g.add(barra(P(t, s, yInf), P(t1, s, ySup), 0.08));
      }
    }
  }
  // travessas: uma por nivel em cada painel; contraventamento no alto
  for (let k = 1; k < n; k++) {
    const t = (k * L) / n;
    for (const bop of niveis) g.add(barra(P(t, -h, bop - VIGA_H / 2), P(t, h, bop - VIGA_H / 2), VIGA_H));
    g.add(barra(P(t, -h, ySup), P(t, h, ySup), 0.1));
  }
  for (let k = 0; k < n; k++) {
    const t0 = (k * L) / n, t1 = ((k + 1) * L) / n;
    g.add(barra(P(t0, -h, ySup), P(t1, h, ySup), 0.05));
  }
  g.userData.yInf = yInf - VIGA_H / 2;
  g.userData.paineis = n;
  return g;
}

/** Bandeja (cantoneira continua) entre dois pontos, com o topo em `y`. */
export function criarBandeja(p0, p1, largura, y) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
  const L = Math.hypot(dx, dz);
  const emX = Math.abs(dx) > Math.abs(dz);
  const m = emX ? caixa(L, 0.05, largura, MAT.acoCarbono) : caixa(largura, 0.05, L, MAT.acoCarbono);
  m.position.set((p0[0] + p1[0]) / 2, y - 0.025, (p0[1] + p1[1]) / 2);
  m.name = 'bandeja';
  return m;
}

/** Caixa de inspecao: concreto ate a geratriz do tubo, tampa de ferro fundido. */
export function criarCaixaInspecao({ x, z, yTopo, profundidade, lado = 0.9 }) {
  const g = new THREE.Group();
  g.name = 'caixa-inspecao';
  const c = caixa(lado, profundidade + 0.1, lado, MAT.concreto);
  c.position.set(x, yTopo + 0.05 - (profundidade + 0.1) / 2, z);
  g.add(c);
  const tampa = caixa(lado * 0.7, 0.03, lado * 0.7,
    new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.6, roughness: 0.6 }));
  tampa.position.set(x, yTopo + 0.065, z);
  g.add(tampa);
  return g;
}

/**
 * Tanque horizontal sobre dois bercos, eixo em X, origem no piso sob o
 * centro. Bocal de topo no meio do casco.
 */
export function criarTanqueHorizontal({ D, L, altura }) {
  const g = new THREE.Group();
  g.name = 'tanque-horizontal';
  const R = D / 2;
  const yEixo = altura + R;
  const mat = MAT.acoCarbono;
  const casco = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 32), mat);
  casco.rotation.z = Math.PI / 2;
  casco.position.y = yEixo;
  casco.castShadow = true;
  g.add(casco);
  for (const s of [-1, 1]) {
    const tampo = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    tampo.scale.set(1, 0.5, 1);
    tampo.rotation.z = -s * Math.PI / 2;
    tampo.position.set(s * L / 2, yEixo, 0);
    tampo.castShadow = true;
    g.add(tampo);
    const berco = caixa(0.2, altura + R * 0.6, D * 0.8, MAT.concreto);
    berco.position.set(s * L * 0.3, (altura + R * 0.6) / 2, 0);
    g.add(berco);
  }
  return { grupo: g, bocais: { C: { pos: [0, yEixo + R, 0], dir: [0, 1, 0] } } };
}

/** Luva de passagem na mureta: anel em volta do tubo, ao longo de `dir`. */
export function criarLuva(pos, dir, od) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(od / 2 + 0.05, od / 2 + 0.05, 0.35, 20), MAT.acoCarbono);
  m.position.copy(pos);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  m.name = 'luva';
  return m;
}
