import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { criarEscada } from './supports.js';
import { triplanar } from './texturas.js';

/**
 * ===========================================================================
 *  TANQUE ATMOSFERICO DE ARMAZENAGEM  (Fase 7)
 * ===========================================================================
 *  API 650: costado cilindrico sobre base anelar de concreto, teto conico
 *  autoportante com caimento de 1:16, escada de marinheiro com gaiola ate o
 *  teto e um trecho de guarda-corpo na borda, onde ela chega.
 *  Origem no centro, no piso; o costado sobe de y = 0.
 */
export function criarTanque({ D, H, cor = 0xe9e8e3, faixa = null }) {
  const g = new THREE.Group();
  g.name = 'tanque';
  const R = D / 2;
  const SEG = 48;

  // base anelar: 0,3 m acima do piso, 0,3 m enterrada
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.5, 0.6, SEG), MAT.concreto);
  base.position.y = 0;
  base.receiveShadow = true;
  g.add(base);

  // Chapa pintada com a costura de cada curso de 2,4 m.
  const matCostado = triplanar(new THREE.MeshStandardMaterial({ color: cor, metalness: 0.4, roughness: 0.55 }), 'chapa', 2.4);
  const costado = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, SEG), matCostado);
  costado.position.y = 0.3 + H / 2;
  costado.castShadow = true;
  costado.receiveShadow = true;
  g.add(costado);
  if (faixa) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.002, R * 1.002, 0.8, SEG, 1, true),
      new THREE.MeshStandardMaterial({ color: faixa, roughness: 0.6 }));
    f.position.y = 0.3 + H - 0.6;
    g.add(f);
  }

  const hTeto = R / 16;
  const teto = new THREE.Mesh(new THREE.ConeGeometry(R * 1.01, hTeto, SEG), matCostado);
  teto.position.y = 0.3 + H + hTeto / 2;
  teto.castShadow = true;
  g.add(teto);

  // escada ate o teto e guarda-corpo de 40° na borda, onde ela chega
  const yTeto = 0.3 + H;
  g.add(criarEscada({ yBase: 0, yTopo: yTeto, raio: R + 0.35, angulo: 0, largura: 0.6 }));
  const arco = THREE.MathUtils.degToRad(40);
  for (const h of [0.55, 1.1]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.02, 6, 24, arco), MAT.guardaCorpo);
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = -arco / 2;
    rail.position.y = yTeto + h;
    g.add(rail);
  }
  for (const a of [-arco / 2, 0, arco / 2]) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), MAT.guardaCorpo);
    poste.position.set(Math.cos(a) * (R - 0.1), yTeto + 0.55, Math.sin(a) * (R - 0.1));
    g.add(poste);
  }
  // Fundo do costado (topo da base anelar): onde os bocais se medem.
  return { grupo: g, altura: yTeto + hTeto, R, yFundo: 0.3 };
}
