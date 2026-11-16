import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { PLINTO } from './supports.js';

/**
 * ===========================================================================
 *  APOIOS DE TUBULACAO  (Fase 5)
 * ===========================================================================
 *  Tubo nao flutua. Fora do rack, todo trecho horizontal precisa de apoio a
 *  cada vao admissivel (data/rotas.js, VAO_ADMISSIVEL), e todo riser alto
 *  precisa de guia. Aqui ficam as pecas e a regra de onde elas cabem:
 *
 *    poste      coluna de aco do piso ao fundo do tubo, com sapata — ou,
 *               para tubo baixo, so um berco de concreto
 *    guia       mao-francesa curta presa ao costado do vaso ao lado do riser
 *    estai      cabo do vent esbelto a ancoragens no piso
 *    funil      boca do dreno fechado
 *
 *  Onde nao cabe apoio (piso ocupado por equipamento, faixa de saque, area de
 *  guindaste, outro tubo passando por baixo), a funcao diz que nao cabe — e a
 *  tubulacao registra o trecho como vao livre, que a auditoria mostra.
 */

const IGNORAR = /rotulo|cota|escala/;

/** Caixa em planta das malhas de um grupo, sem etiquetas e cotas. */
export function pegadaDe(grupo) {
  const caixa = new THREE.Box3();
  grupo.updateWorldMatrix(true, true);
  grupo.traverse((o) => {
    if (!o.isMesh) return;
    for (let n = o; n && n !== grupo.parent; n = n.parent) if (IGNORAR.test(n.name)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    caixa.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return { x0: caixa.min.x, x1: caixa.max.x, z0: caixa.min.z, z1: caixa.max.z, y1: caixa.max.y };
}

function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Poste de apoio. `yApoio` e o fundo do tubo; `eixo` e a direcao em que o
 * tubo corre ('x' ou 'z') — a travessa do topo fica perpendicular a ele.
 */
export function criarPoste({ x, z, yApoio, eixo }) {
  const g = new THREE.Group();
  g.name = 'apoio';
  if (yApoio - PLINTO < 0.35) {
    // Berco: bloco de concreto ate o tubo.
    const b = caixa(0.3, yApoio + 0.2, 0.3, MAT.concreto);
    b.position.set(x, (yApoio - 0.2) / 2, z);
    g.add(b);
    return g;
  }
  const sap = caixa(0.4, 0.2 + PLINTO, 0.4, MAT.concreto);
  sap.position.set(x, (PLINTO - 0.2) / 2, z);
  g.add(sap);
  const h = yApoio - PLINTO - 0.03;
  const col = caixa(0.1, h, 0.1, MAT.acoCarbono);
  col.position.set(x, PLINTO + h / 2, z);
  g.add(col);
  const trav = eixo === 'x' ? caixa(0.12, 0.06, 0.4, MAT.acoCarbono) : caixa(0.4, 0.06, 0.12, MAT.acoCarbono);
  trav.position.set(x, yApoio - 0.03, z);
  g.add(trav);
  return g;
}

/** Guia do riser presa ao costado: barra do tubo ate a parede do vaso. */
export function criarGuia(pTubo, rTubo, centroVaso, rVaso) {
  const radial = new THREE.Vector3(pTubo.x - centroVaso.x, 0, pTubo.z - centroVaso.z);
  const d = radial.length();
  radial.normalize();
  const comp = Math.max(0.05, d - rTubo - rVaso);
  const m = caixa(comp, 0.06, 0.06, MAT.acoCarbono);
  const meio = new THREE.Vector3(centroVaso.x, pTubo.y, centroVaso.z).addScaledVector(radial, rVaso + comp / 2);
  m.position.copy(meio);
  m.rotation.y = -Math.atan2(radial.z, radial.x);
  m.name = 'guia';
  return m;
}

/** Cabo de estai do ponto `a` (no tubo) a ancoragem `b` (no piso). */
export function criarEstai(a, b) {
  const g = new THREE.Group();
  g.name = 'estai';
  const d = new THREE.Vector3().subVectors(b, a);
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, d.length(), 6), MAT.acoCarbono);
  cabo.position.copy(a).addScaledVector(d, 0.5);
  cabo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.add(cabo);
  const ancora = caixa(0.3, 0.2 + PLINTO, 0.3, MAT.concreto);
  ancora.position.set(b.x, (PLINTO - 0.2) / 2, b.z);
  g.add(ancora);
  return g;
}

/** Funil do dreno fechado: boca no piso, tubo do sistema de drenagem oleosa. */
export function criarFunil({ x, z, yBoca }) {
  const g = new THREE.Group();
  g.name = 'funil-dreno';
  const funil = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, yBoca - PLINTO, 20, 1, true), MAT.acoCarbono);
  funil.position.set(x, PLINTO + (yBoca - PLINTO) / 2, z);
  funil.material = funil.material.clone();
  funil.material.side = THREE.DoubleSide;
  g.add(funil);
  const base = caixa(0.35, 0.2 + PLINTO, 0.35, MAT.concreto);
  base.position.set(x, (PLINTO - 0.2) / 2, z);
  g.add(base);
  return g;
}

/**
 * Caixas das pecas de um grupo, uma por malha (sem etiquetas e cotas), com a
 * faixa de altura: um poste baixo cabe sob a plataforma de um vaso ou sob um
 * trocador elevado, que a pegada inteira do grupo proibiria.
 */
export function obstaculosDe(grupo, folga = 0.1) {
  const out = [];
  grupo.updateWorldMatrix(true, true);
  grupo.traverse((o) => {
    if (!o.isMesh) return;
    for (let n = o; n && n !== grupo.parent; n = n.parent) if (IGNORAR.test(n.name)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    out.push({ x0: b.min.x - folga, x1: b.max.x + folga, z0: b.min.z - folga, z1: b.max.z + folga, y0: b.min.y, y1: b.max.y });
  });
  return out;
}

/**
 * Regra de piso livre para um apoio de lado `lado` em (x, z), sob um tubo
 * cujo fundo esta em `yApoio`.
 *   ocupados   retangulos { x0, x1, z0, z1 } onde nao se apoia nada; com
 *              { y0, y1 }, so se o poste chega a essa faixa de altura
 *   tubos      [{ pts, r, id }] — nenhum outro tubo pode passar entre o piso
 *              e o apoio naquela vertical
 *   id         o tubo apoiado (nao conta como obstaculo)
 */
export function apoioCabe({ x, z, yApoio, lado = 0.4 }, ocupados, tubos, id) {
  const m = lado / 2;
  const caixaApoio = { x0: x - m, x1: x + m, z0: z - m, z1: z + m };
  if (ocupados.some((o) => caixaApoio.x0 < o.x1 && o.x0 < caixaApoio.x1
    && caixaApoio.z0 < o.z1 && o.z0 < caixaApoio.z1
    && (o.y0 ?? -Infinity) < yApoio && (o.y1 ?? Infinity) > 0)) return false;
  for (const t of tubos) {
    if (t.id === id) continue;
    for (let i = 1; i < t.pts.length; i++) {
      const a = t.pts[i - 1], b = t.pts[i];
      if (Math.min(a.y, b.y) - t.r > yApoio) continue;        // passa por cima
      // distancia em planta do ponto ao segmento
      const ax = b.x - a.x, az = b.z - a.z;
      const L2 = ax * ax + az * az;
      const s = L2 < 1e-9 ? 0 : THREE.MathUtils.clamp(((x - a.x) * ax + (z - a.z) * az) / L2, 0, 1);
      const dx = a.x + s * ax - x, dz = a.z + s * az - z;
      if (Math.hypot(dx, dz) < m + t.r + 0.05) return false;
    }
  }
  return true;
}
