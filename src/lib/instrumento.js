import * as THREE from 'three';
import { DN } from '../data/plant.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  INSTRUMENTOS DE CAMPO  (Fase 6)
 * ===========================================================================
 *  So o que fica na planta: o elemento primario e o transmissor. O
 *  controlador de cada malha (LIC, TIC...) mora no sistema de controle, na
 *  sala de controle — a ficha do instrumento diz para onde o sinal vai e em
 *  que valvula a malha atua.
 *
 *  Cada peca nasce com a ligacao ao processo na origem e o corpo para +Y
 *  (ou, nas de linha, com a linha em X). Quem chama posiciona e orienta.
 *  Medidas [ESTIMADO], de catalogo: o que importa e a escala certa ao lado do
 *  equipamento e o tipo reconhecivel.
 */

const SEG = 20;

function cil(r, h, mat, eixo = 'y') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, SEG), mat);
  if (eixo === 'x') m.rotation.z = Math.PI / 2;
  if (eixo === 'z') m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}

/** Caixa de eletronica com visor: o "transmissor" que todo mundo reconhece. */
function cabecote(g, y) {
  const corpo = cil(0.055, 0.08, MAT.instrumento, 'z');
  corpo.position.set(0, y, 0);
  const visor = cil(0.045, 0.012, MAT.atuador, 'z');
  visor.position.set(0, y, 0.045);
  g.add(corpo, visor);
}

/**
 * Transmissor de pressao ou de pressao diferencial, montado direto na tomada.
 * `dp`: com manifold de tres valvulas e dois diafragmas.
 */
export function criarTransmissor({ dp = false } = {}) {
  const g = new THREE.Group();
  g.name = 'transmissor';
  const tomada = cil(0.012, 0.1, MAT.inox);
  tomada.position.y = 0.05;
  g.add(tomada);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(dp ? 0.12 : 0.07, 0.07, 0.07), MAT.inox);
  sensor.position.y = 0.135;
  g.add(sensor);
  if (dp) {
    const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.05), MAT.acoCarbono);
    manifold.position.y = 0.09;
    g.add(manifold);
  }
  cabecote(g, 0.21);
  return g;
}

/** Poco termometrico com cabecote: haste para dentro (-Y), cabecote fora. */
export function criarPoco({ comprimento = 0.25 } = {}) {
  const g = new THREE.Group();
  g.name = 'poco-termometrico';
  const haste = cil(0.011, comprimento, MAT.inox);
  haste.position.y = -comprimento / 2;
  g.add(haste);
  const niple = cil(0.016, 0.1, MAT.inox);
  niple.position.y = 0.05;
  g.add(niple);
  cabecote(g, 0.15);
  return g;
}

/** Radar de nivel sem contato, sobre um bocal no tampo. */
export function criarRadar() {
  const g = new THREE.Group();
  g.name = 'radar';
  const fl = cil(0.075, 0.02, MAT.flange);
  fl.position.y = 0.01;
  g.add(fl);
  const pescoco = cil(0.03, 0.08, MAT.inox);
  pescoco.position.y = 0.06;
  g.add(pescoco);
  const caixa = cil(0.065, 0.12, MAT.instrumento);
  caixa.position.y = 0.16;
  g.add(caixa);
  const tampa = new THREE.Mesh(new THREE.SphereGeometry(0.065, SEG, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.instrumento);
  tampa.position.y = 0.22;
  g.add(tampa);
  return g;
}

/**
 * Placa de orificio entre flanges, com o transmissor de diferencial acima,
 * ligado pelas duas tomadas. Linha em X; origem no eixo do tubo.
 */
export function criarPlacaOrificio({ dn }) {
  const d = DN[dn];
  const g = new THREE.Group();
  g.name = 'placa-orificio';
  for (const s of [-1, 1]) {
    const f = cil(d.fl / 2, d.esp, MAT.flange, 'x');
    f.position.x = s * (d.esp / 2 + 0.004);
    g.add(f);
  }
  const placa = cil(d.fl / 2 * 0.95, 0.006, MAT.inox, 'x');
  g.add(placa);
  const aba = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07, 0.04), MAT.inox);
  aba.position.y = d.fl / 2 + 0.03;
  g.add(aba);
  // tomadas dos flanges ate o transmissor
  const yT = d.fl / 2 + 0.18;
  for (const s of [-1, 1]) {
    const t = cil(0.006, yT - d.od / 2, MAT.inox);
    t.position.set(s * 0.03, d.od / 2 + (yT - d.od / 2) / 2, 0);
    g.add(t);
  }
  const tx = criarTransmissor({ dp: true });
  tx.position.y = yT - 0.08;
  g.add(tx);
  return { grupo: g, comprimento: 2 * d.esp + 0.02 };
}

/** Densimetro de linha (tubo vibrante): corpo sob a linha, cabecote em cima. */
export function criarDensimetro({ dn }) {
  const d = DN[dn];
  const g = new THREE.Group();
  g.name = 'densimetro';
  const L = 0.5;
  for (const s of [-1, 1]) {
    const f = cil(d.fl / 2, d.esp, MAT.flange, 'x');
    f.position.x = s * (L / 2 - d.esp / 2);
    g.add(f);
  }
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.28, 0.14), MAT.inox);
  caixa.position.y = -0.1;
  caixa.castShadow = true;
  g.add(caixa);
  cabecote(g, d.od / 2 + 0.12);
  const haste = cil(0.015, 0.08, MAT.inox);
  haste.position.y = d.od / 2 + 0.04;
  g.add(haste);
  return { grupo: g, comprimento: L };
}

/**
 * Capilar de selo remoto que acompanha o costado (Fase 18): sai do selo
 * `a`, vai a `folga` m do costado (centro `centro`, raio `raio`), corre
 * vertical rente a ele, com abracadeira a cada 1,2 m, e entra no selo `b`.
 * Reto no ar, a meio metro do vaso, parecia um fio pendurado.
 */
export function criarCapilarAoLongo({ a, b, centro, raio, folga = 0.06 }) {
  const g = new THREE.Group();
  g.name = 'capilar';
  const fora = (p) => {
    const d = new THREE.Vector3(p.x - centro.x, 0, p.z - centro.z).normalize();
    return new THREE.Vector3(centro.x, p.y, centro.z).addScaledVector(d, raio + folga);
  };
  const pa = fora(a), pb = fora(b).setY(b.y);
  // desce (ou sobe) no angulo de `a`; se `b` esta noutro angulo, contorna rente ao costado
  const meio = pa.clone().setY(b.y);
  const pts = [a, pa, meio];
  if (meio.distanceTo(pb) > 0.02) {
    const a0 = Math.atan2(meio.z - centro.z, meio.x - centro.x), a1 = Math.atan2(pb.z - centro.z, pb.x - centro.x);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let i = 1; i <= 8; i++) {
      const t = a0 + (da * i) / 8;
      pts.push(new THREE.Vector3(centro.x + Math.cos(t) * (raio + folga), b.y, centro.z + Math.sin(t) * (raio + folga)));
    }
  }
  pts.push(b);
  for (let i = 1; i < pts.length; i++) {
    const d = new THREE.Vector3().subVectors(pts[i], pts[i - 1]);
    if (d.length() < 1e-3) continue;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, d.length(), 6), MAT.inox);
    m.position.copy(pts[i - 1]).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    g.add(m);
  }
  const y0 = Math.min(pa.y, meio.y), y1 = Math.max(pa.y, meio.y);
  for (let y = y0 + 0.6; y < y1 - 0.3; y += 1.2) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), MAT.acoCarbono);
    c.position.copy(pa).setY(y);
    g.add(c);
  }
  return g;
}

/**
 * Tomada de processo (Fase 25): luva flangeada soldada na chapa do vaso, que
 * atravessa camisa e isolamento ate o instrumento. Sem ela o transmissor
 * ficava pousado no isolamento, a 5–7 cm da chapa (__auditarContato). DN 50
 * [ESTIMADO]: o bocal usual de selo remoto de nivel.
 */
export function criarTomada(a, b, dn = 50) {
  const g = new THREE.Group();
  g.name = 'tomada';
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  if (L < 1e-3) return g;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const luva = cil(DN[dn].od / 2, L, MAT.acoCarbono);
  luva.position.copy(a).addScaledVector(d, 0.5);
  luva.quaternion.copy(q);
  const flange = cil(DN[dn].fl / 2, DN[dn].esp, MAT.flange);
  flange.position.copy(b).addScaledVector(d, -DN[dn].esp / (2 * L));
  flange.quaternion.copy(q);
  g.add(luva, flange);
  return g;
}

/** Capilar de selo remoto, de um ponto a outro. */
export function criarCapilar(a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, d.length(), 6), MAT.inox);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  m.name = 'capilar';
  return m;
}
