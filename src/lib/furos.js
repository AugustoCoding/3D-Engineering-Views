import * as THREE from 'three';

/**
 * ===========================================================================
 *  FUROS NA CHAPA (27/10, pedido do autor: pelo visor da boca de visita
 *  tem de dar para ver o vaso por dentro)
 * ===========================================================================
 *  O costado, a camisa e o isolamento sao cascas inteiras (lathe): nao tem
 *  furo onde o bocal entra. Recortar a malha de cada vaso seria geometria
 *  sob medida; aqui o furo e um cilindro no mundo — o vao livre do pescoco
 *  do bocal, do lado de dentro da chapa ate a ponta dele — e o shader dos
 *  materiais de chapa descarta o que cai dentro. Vale para a cena fundida
 *  (a posicao e a do mundo) e para o corte.
 *
 *  Quem marca e o bocal (`userData.furo`, no referencial dele: eixo +Y,
 *  base na origem); `registrarFuros` le as marcas depois de tudo posto.
 */

const MAX = 4;
const CENTROS = { value: Array.from({ length: MAX }, () => new THREE.Vector4()) };   // base xyz, raio
const EIXOS = { value: Array.from({ length: MAX }, () => new THREE.Vector4()) };     // direcao xyz, comprimento
const N = { value: 0 };

/** Encadeia o descarte no shader do material (depois de outro onBeforeCompile). */
export function furar(material) {
  if (typeof document === 'undefined') return material;
  const antes = material.onBeforeCompile;
  const chave = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (sh, r) => {
    antes?.call(material, sh, r);
    sh.uniforms.uFurosC = CENTROS;
    sh.uniforms.uFurosE = EIXOS;
    sh.uniforms.uNFuros = N;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosFuro;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPosFuro = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPosFuro;
        uniform vec4 uFurosC[${MAX}];
        uniform vec4 uFurosE[${MAX}];
        uniform int uNFuros;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${MAX}; i++) {
          if (i >= uNFuros) break;
          vec3 d = vPosFuro - uFurosC[i].xyz;
          float t = dot(d, uFurosE[i].xyz);
          if (t > 0.0 && t < uFurosE[i].w && length(d - t * uFurosE[i].xyz) < uFurosC[i].w) discard;
        }`);
  };
  material.customProgramCacheKey = () => `${chave ? chave() : ''}|furo`;
  material.needsUpdate = true;
  return material;
}

/** Le as marcas `userData.furo` dos bocais ja postos e acende os furos. */
export function registrarFuros(raiz) {
  raiz.updateMatrixWorld(true);
  const furos = [];
  raiz.traverse((o) => {
    const f = o.userData.furo;
    if (!f) return;
    const base = o.localToWorld(new THREE.Vector3(0, f.de, 0));
    const eixo = new THREE.Vector3(0, 1, 0).transformDirection(o.matrixWorld);
    furos.push({ base, eixo, raio: f.raio, comprimento: f.ate - f.de });
  });
  if (furos.length > MAX) throw new Error(`furos.js: ${furos.length} furos, o shader tem lugar para ${MAX}`);
  furos.forEach((f, i) => {
    CENTROS.value[i].set(f.base.x, f.base.y, f.base.z, f.raio);
    EIXOS.value[i].set(f.eixo.x, f.eixo.y, f.eixo.z, f.comprimento);
  });
  N.value = furos.length;
  return furos;
}
