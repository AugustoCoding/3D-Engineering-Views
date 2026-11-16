import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { texturaBandeira } from './texturas.js';
import { TEMPO_VENTO } from './ambiente.js';

/**
 * ===========================================================================
 *  MASTRO DE BANDEIRA  (Fase 27, item 24)
 * ===========================================================================
 *  Mastro de aco de `altura` m sobre base de concreto, com a bandeira presa
 *  pela tralha (a borda junto do mastro) e tremulando no shader: a onda anda
 *  da tralha para a ponta e cresce para a ponta, no relogio do vento
 *  (lib/ambiente.js, TEMPO_VENTO). A bandeira fica a sotavento: `para` e o
 *  vetor do vento em planta. [ADOTADO] mastro de 9 m, bandeira de 1,8 x
 *  1,26 m (proporcao 10:7 da bandeira nacional, Lei 5.700).
 */
export function criarMastroBandeira({ altura = 9, bandeira, para, fase = 0 }) {
  const g = new THREE.Group();
  g.name = 'mastro-bandeira';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 16), MAT.concreto);
  base.position.y = -0.05;
  g.add(base);
  const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, altura, 12), MAT.inox);
  mastro.position.y = 0.2 + altura / 2;
  mastro.castShadow = true;
  g.add(mastro);
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), MAT.inox);
  pomo.position.y = 0.2 + altura + 0.05;
  g.add(pomo);

  // a bandeira: plano com a tralha em x = 0, segmentado para ondular
  const L = 1.8, H = 1.26;
  const geo = new THREE.PlaneGeometry(L, H, 18, 6).translate(L / 2 + 0.04, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ map: texturaBandeira(bandeira), side: THREE.DoubleSide, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uVentoT = TEMPO_VENTO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uVentoT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float u = transformed.x / ${(L + 0.04).toFixed(2)};
        float onda = sin(transformed.x * 3.4 - uVentoT * 5.2 + ${fase.toFixed(2)}) + 0.35 * sin(transformed.x * 7.1 - uVentoT * 8.3 + transformed.y * 2.0);
        transformed.z += onda * 0.16 * u;
        transformed.y -= 0.08 * u * u;`);
  };
  mat.customProgramCacheKey = () => 'bandeira';
  const pano = new THREE.Mesh(geo, mat);
  pano.position.y = 0.2 + altura - H / 2 - 0.15;
  // a bandeira aponta para onde o vento vai
  pano.rotation.y = Math.atan2(-para[1], para[0]);
  pano.castShadow = true;
  pano.name = 'bandeira';
  g.add(pano);
  return g;
}
