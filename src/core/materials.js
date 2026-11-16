import * as THREE from 'three';
import { triplanar } from '../lib/texturas.js';
import { furar } from '../lib/furos.js';

/**
 * Biblioteca central de materiais PBR.
 *
 * Todos os materiais sao registrados em `TODOS` para que o corte (clipping
 * plane) possa ser aplicado de uma vez em toda a cena, e para que o realce
 * de selecao consiga achar a versao "acesa" de cada material.
 */

const TODOS = [];

function reg(mat) {
  mat.clippingPlanes = [];
  mat.clipShadows = true;
  TODOS.push(mat);
  return mat;
}

export const MAT = {
  // Aco inox 316L — costado, tampos, internos
  inox: reg(new THREE.MeshStandardMaterial({
    color: 0xb9c0c9, metalness: 0.92, roughness: 0.34, side: THREE.DoubleSide, name: 'inox',
  })),

  // Aco carbono — saia, estruturas, flanges
  acoCarbono: reg(new THREE.MeshStandardMaterial({
    color: 0x7f858d, metalness: 0.85, roughness: 0.55, side: THREE.DoubleSide, name: 'aco-carbono',
  })),

  // Chapa de aluminio do isolamento (acabamento externo). Opaca, como em campo
  // (27/10, o autor: a capa translucida parecia uma pelicula, com a TAG
  // flutuando nela); o vaso por dentro se ve desligando a camada, no corte
  // ou pelo visor da boca de visita.
  isolamento: reg(new THREE.MeshStandardMaterial({
    color: 0xc4c8cc, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide, name: 'isolamento',
  })),

  // Tubulacao de utilidades / serpentina
  cobre: reg(new THREE.MeshStandardMaterial({
    color: 0xa8683f, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide, name: 'serpentina',      // cobre de verdade (era turquesa)
  })),

  // Motor eletrico / acionamento
  motor: reg(new THREE.MeshStandardMaterial({
    color: 0x35536b, metalness: 0.35, roughness: 0.55, name: 'motor',      // azul de motor de campo, desbotado (Fase 25)
  })),

  redutor: reg(new THREE.MeshStandardMaterial({
    color: 0x3d4753, metalness: 0.5, roughness: 0.55, name: 'redutor',
  })),

  // Piso de grade / plataforma
  grade: reg(new THREE.MeshStandardMaterial({
    color: 0x7c8287, metalness: 0.6, roughness: 0.6, side: THREE.DoubleSide, name: 'grade',      // piso de grade galvanizado
  })),

  // Guarda-corpo (amarelo seguranca)
  guardaCorpo: reg(new THREE.MeshStandardMaterial({
    color: 0xd9a441, metalness: 0.4, roughness: 0.55, name: 'guarda-corpo',
  })),

  // Concreto da fundacao
  concreto: reg(new THREE.MeshStandardMaterial({
    color: 0x8e8e88, metalness: 0.0, roughness: 0.95, name: 'concreto',
  })),

  // Bocais / flanges
  flange: reg(new THREE.MeshStandardMaterial({
    color: 0x99a0a8, metalness: 0.88, roughness: 0.42, side: THREE.DoubleSide, name: 'flange',
  })),

  // Liquido dentro do reator (visivel no corte)
  liquido: reg(new THREE.MeshStandardMaterial({
    color: 0xc4763f, metalness: 0.1, roughness: 0.15, transparent: true,
    opacity: 0.42, side: THREE.DoubleSide, name: 'liquido',
  })),

  // Fases do decantador V-02: a distincao de cor e o que mostra a interface.
  tolueno: reg(new THREE.MeshStandardMaterial({
    color: 0xe0b455, metalness: 0.05, roughness: 0.18, transparent: true,
    opacity: 0.40, side: THREE.DoubleSide, name: 'tolueno',
  })),

  agua: reg(new THREE.MeshStandardMaterial({
    color: 0x4f9fd8, metalness: 0.05, roughness: 0.12, transparent: true,
    opacity: 0.52, side: THREE.DoubleSide, name: 'agua',
  })),

  // Atuador pneumatico de valvula: azul de fabricante, para se achar na planta.
  atuador: reg(new THREE.MeshStandardMaterial({
    color: 0x3f5e7d, metalness: 0.3, roughness: 0.5, name: 'atuador',      // azul-acinzentado de atuador de diafragma
  })),

  // Caixa de transmissor e cabecote de instrumento.
  instrumento: reg(new THREE.MeshStandardMaterial({
    color: 0xdfe3e8, metalness: 0.3, roughness: 0.4, name: 'instrumento',
  })),

  // Vidro de visor (boca de visita, capo do filtro rotativo): ve-se o de dentro.
  visor: reg(new THREE.MeshStandardMaterial({
    color: 0x5d7c90, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3,
    depthWrite: false, side: THREE.DoubleSide, name: 'vidro-visor',
  })),

  // Iluminacao da laje (Fase 26): corpo de luminaria Ex de aluminio
  // fundido, eletroduto galvanizado e a lente — esta com o nome que a noite
  // acende (site/noite.js, regra `luminaria`).
  aluminioFundido: reg(new THREE.MeshStandardMaterial({
    color: 0x8f959b, metalness: 0.55, roughness: 0.5, name: 'aluminio-fundido',
  })),
  eletroduto: reg(new THREE.MeshStandardMaterial({
    color: 0xa7abaf, metalness: 0.7, roughness: 0.45, name: 'eletroduto',
  })),
  lente: reg(new THREE.MeshStandardMaterial({
    color: 0xe9ece6, metalness: 0.1, roughness: 0.25, emissive: 0x000000, name: 'luminaria',
  })),
};

/* Grao de cada material, projetado pela posicao no mundo (lib/texturas.js):
 * a sapata e a fundacao tem o mesmo concreto, a saia e o rack o mesmo aco. */
triplanar(MAT.concreto, 'concreto', 2);
triplanar(MAT.acoCarbono, 'aco', 3);
triplanar(MAT.flange, 'aco', 3);
triplanar(MAT.inox, 'inox', 1.5);
triplanar(MAT.grade, 'grade', 0.3, { vazado: 'gradeFuro' });   // ve-se atraves de perto (Fase 25)
triplanar(MAT.isolamento, 'isolamento', 1.2);
// tinta de campo nas pecas pintadas (Fase 25): sem ela, plastico liso
for (const m of [MAT.motor, MAT.redutor, MAT.atuador, MAT.guardaCorpo]) triplanar(m, 'tinta', 1.5);

/* As chapas de vaso (costado, camisa, capa do isolamento) abrem onde ha
 * boca de visita com visor (lib/furos.js). */
for (const m of [MAT.inox, MAT.acoCarbono, MAT.isolamento]) furar(m);

/* -------------------------------------------------------------------------
 * Corte (secao) — aplica o plano de clipping em toda a biblioteca de uma vez
 * ---------------------------------------------------------------------- */
export function aplicarCorte(planos) {
  for (const m of TODOS) {
    m.clippingPlanes = planos;
    m.needsUpdate = true;
  }
}

/* -------------------------------------------------------------------------
 * Realce de selecao — cada material base ganha UMA copia "acesa", cacheada.
 * Assim o realce nao aloca material novo a cada clique.
 * ---------------------------------------------------------------------- */
const cacheRealce = new WeakMap();

export function versaoRealcada(base) {
  // predio tem um material por face (fachada desenhada em cada lado)
  if (Array.isArray(base)) return base.map(versaoRealcada);
  if (cacheRealce.has(base)) return cacheRealce.get(base);
  const c = base.clone();
  c.emissive = new THREE.Color(0x2f7fd4);
  c.emissiveIntensity = 0.55;
  c.name = base.name + '-realce';
  TODOS.push(c);
  c.clippingPlanes = base.clippingPlanes;
  cacheRealce.set(base, c);
  return c;
}
