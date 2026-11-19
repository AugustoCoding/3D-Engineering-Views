import * as THREE from 'three';
import { DN } from '../data/plant.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  VALVULAS DE CONTROLE  (Fase 6)
 * ===========================================================================
 *  Globo com atuador pneumatico de diafragma, que e o elemento final de quase
 *  toda malha do P&ID, e a de tres vias (V-14, V-15, V-16), com duas portas
 *  em linha e uma de ramal. E, desde a Fase 18, a gaveta de bloqueio manual
 *  e a raquete do limite de bateria.
 *
 *  Referencial local: a linha corre em X, a haste do atuador sobe em Y; o
 *  ramal da de tres vias sai em Z. `orientar` leva X ao eixo da linha e Y a
 *  haste, no mundo. O centro do corpo fica na origem — quem chama poe a
 *  valvula sobre o eixo do tubo, e o tubo passa por dentro dela.
 *
 *  Medidas [ESTIMADO]: face a face pela ISA-75.08.01 (classe 300); corpo,
 *  castelo, arcada e diafragma proporcionais ao flange, como em catalogo de
 *  valvula globo de 1" a 4". Valvula do mesmo DN da linha.
 */

/* Face a face, m — ISA-75.08.01, globo, classe 300 (32 interpolado). */
const FACE_A_FACE = {
  15: 0.19, 25: 0.197, 32: 0.215, 40: 0.235, 50: 0.267, 65: 0.292, 80: 0.318,
  100: 0.368, 150: 0.473,
};

const SEG = 24;

function cilindro(r, h, eixo, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, SEG), mat);
  if (eixo === 'x') m.rotation.z = Math.PI / 2;
  if (eixo === 'z') m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}

/** Corpo comum: castelo, arcada, diafragma e posicionador, acima de y = 0. */
function atuador(grupo, d, rb) {
  const fl = d.fl;
  const hCastelo = rb * 0.4 + 0.08;
  const castelo = cilindro(rb * 0.5, hCastelo, 'y', MAT.acoCarbono);
  castelo.position.y = rb * 0.8 + hCastelo / 2;
  grupo.add(castelo);

  const yArcada = rb * 0.8 + hCastelo;
  const hArcada = 0.12 + 0.6 * fl;
  for (const s of [-1, 1]) {
    const barra = new THREE.Mesh(new THREE.BoxGeometry(0.025, hArcada, 0.025), MAT.acoCarbono);
    barra.position.set(s * rb * 0.45, yArcada + hArcada / 2, 0);
    grupo.add(barra);
  }
  const haste = cilindro(0.008, hArcada, 'y', MAT.inox);
  haste.position.y = yArcada + hArcada / 2;
  grupo.add(haste);

  // Diafragma: duas calotas conicas presas pela borda.
  const ra = 0.1 + 0.6 * fl;
  const hCaixa = 0.07;
  const yCaixa = yArcada + hArcada;
  const baixo = new THREE.Mesh(new THREE.CylinderGeometry(ra, ra * 0.35, hCaixa, SEG), MAT.atuador);
  baixo.position.y = yCaixa + hCaixa / 2;
  const cima = new THREE.Mesh(new THREE.CylinderGeometry(ra * 0.35, ra, hCaixa, SEG), MAT.atuador);
  cima.position.y = yCaixa + hCaixa * 1.5 + 0.01;
  const borda = cilindro(ra * 1.03, 0.02, 'y', MAT.atuador);
  borda.position.y = yCaixa + hCaixa + 0.005;
  for (const m of [baixo, cima]) m.castShadow = true;
  grupo.add(baixo, cima, borda);

  // Posicionador: a caixinha ao lado da arcada que recebe o sinal do
  // controlador, presa a uma das barras dela por um suporte de chapa (a
  // montagem lateral da IEC 60534-6-1, "NAMUR"). Fica na frente da barra
  // +x, afastado o bastante para a alavanca de realimentacao, e o suporte
  // vai da face da barra ate as costas da caixa — antes ela ficava no ar, a
  // uns 4 cm da arcada (Fase 25, __auditarContato).
  const POS = { larg: 0.09, alt: 0.12, prof: 0.07, folga: 0.06, chapa: 0.006 };   // m [ESTIMADO]
  const xBarra = rb * 0.45, yPos = yArcada + hArcada * 0.5;
  const zCostas = 0.0125 + POS.folga;                          // a barra tem 25 mm
  const pos = new THREE.Mesh(new THREE.BoxGeometry(POS.larg, POS.alt, POS.prof), MAT.instrumento);
  pos.position.set(xBarra, yPos, zCostas + POS.prof / 2);
  grupo.add(pos);
  const suporte = new THREE.Mesh(new THREE.BoxGeometry(POS.chapa, POS.alt * 0.8, zCostas), MAT.acoCarbono);
  suporte.position.set(xBarra, yPos, zCostas / 2);
  grupo.add(suporte);

  return { altura: yCaixa + hCaixa * 2 + 0.01, raioAtuador: ra };
}

/** Flange de extremidade, face no plano x = xFace, olhando para fora. */
function flange(grupo, d, xFace, sinal, eixo = 'x') {
  const f = cilindro(d.fl / 2, d.esp, eixo, MAT.flange);
  const p = xFace - sinal * d.esp / 2;
  if (eixo === 'x') f.position.x = p; else f.position.z = p;
  grupo.add(f);
}

/**
 * Leva o referencial local (X = linha, Y = haste) ao mundo.
 * @param {THREE.Object3D} obj
 * @param {THREE.Vector3} centro  centro do corpo, sobre o eixo do tubo
 * @param {THREE.Vector3} eixo    direcao da linha
 * @param {THREE.Vector3} haste   direcao do atuador (perpendicular ao eixo)
 */
export function orientar(obj, centro, eixo, haste) {
  const x = eixo.clone().normalize();
  const y = haste.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  obj.position.copy(centro);
  return obj;
}

/**
 * Valvula de seguranca de mola (API 526): entrada por baixo, saida de lado,
 * castelo da mola acima e capuz com alavanca de teste. Referencial: a face do
 * flange de entrada na origem, olhando para -Y (o bocal do vaso vem de
 * baixo); a saida olha para +X. Medidas [ESTIMADO] pelo 4P6 (centro a face
 * de ~240 mm na entrada e na saida), em escala com o DN de entrada.
 * Devolve { grupo, saida: { pos, dir }, raio }.
 */
export function criarPSV({ dnEntrada, dnSaida }) {
  const de = DN[dnEntrada], ds = DN[dnSaida];
  const s = de.od / DN[100].od;
  const cf = 0.24 * s;
  const g = new THREE.Group();
  g.name = 'psv';
  const corpo = MAT.acoCarbono;
  const pintura = new THREE.MeshStandardMaterial({ color: 0xb3332b, metalness: 0.3, roughness: 0.5, name: 'psv' });
  const flangeE = cilindro(de.fl / 2, 0.03, 'y', corpo);
  flangeE.position.y = 0.015;
  g.add(flangeE);
  const pesc = cilindro(de.od / 2, cf * 0.8, 'y', corpo);
  pesc.position.y = 0.03 + cf * 0.4;
  g.add(pesc);
  const bojo = new THREE.Mesh(new THREE.SphereGeometry(Math.max(de.od, ds.od) * 0.7, SEG, 16), corpo);
  bojo.position.y = cf;
  bojo.castShadow = true;
  g.add(bojo);
  const saida = cilindro(ds.od / 2, cf - 0.03, 'x', corpo);
  saida.position.set((cf - 0.03) / 2, cf, 0);
  g.add(saida);
  const flangeS = cilindro(ds.fl / 2, 0.03, 'x', corpo);
  flangeS.position.set(cf - 0.015, cf, 0);
  g.add(flangeS);
  // castelo da mola, afinando para cima, e o capuz com a alavanca
  const hc = 0.55 * s;
  const castelo = new THREE.Mesh(new THREE.CylinderGeometry(de.od * 0.32, de.od * 0.5, hc, SEG), pintura);
  castelo.position.y = cf + de.od * 0.4 + hc / 2;
  castelo.castShadow = true;
  g.add(castelo);
  const yCap = cf + de.od * 0.4 + hc;
  const capuz = cilindro(de.od * 0.22, 0.12 * s, 'y', pintura);
  capuz.position.y = yCap + 0.06 * s;
  g.add(capuz);
  const alavanca = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.02, 0.02), corpo);
  alavanca.position.set(-0.1 * s, yCap + 0.1 * s, 0);
  alavanca.rotation.z = -0.35;
  g.add(alavanca);
  return { grupo: g, saida: { pos: [cf, cf, 0], dir: [1, 0, 0] }, raio: Math.max(de.fl, ds.fl) / 2, altura: yCap + 0.12 * s };
}

/** Globo com atuador. Devolve { grupo, comprimento, altura, raioAtuador }. */
export function criarValvulaGlobo({ dn }) {
  const d = DN[dn];
  const L = FACE_A_FACE[dn] ?? 0.15 + 2.2 * d.od;
  const g = new THREE.Group();
  g.name = 'valvula';

  const rb = Math.max(0.045, d.fl * 0.38);
  const corpo = new THREE.Mesh(new THREE.SphereGeometry(rb, SEG, 16), MAT.acoCarbono);
  corpo.castShadow = true;
  g.add(corpo);
  const pescoco = cilindro(d.od * 0.62, L - 2 * d.esp, 'x', MAT.acoCarbono);
  g.add(pescoco);
  flange(g, d, L / 2, 1);
  flange(g, d, -L / 2, -1);

  const a = atuador(g, d, rb);
  return { grupo: g, comprimento: L, altura: a.altura, raioAtuador: a.raioAtuador };
}

/**
 * Tres vias: duas portas em linha (X) e o ramal em Z, para o lado `ladoRamal`
 * (+1 ou -1). A porta de ramal e a comum — a saida da de mistura, a entrada
 * da que divide.
 */
export function criarValvulaTresVias({ dn, ladoRamal = 1 }) {
  const d = DN[dn];
  const L = 1.25 * (FACE_A_FACE[dn] ?? 0.15 + 2.2 * d.od);
  const g = new THREE.Group();
  g.name = 'valvula-tres-vias';

  const rb = Math.max(0.055, d.fl * 0.45);
  const corpo = new THREE.Mesh(new THREE.SphereGeometry(rb, SEG, 16), MAT.acoCarbono);
  corpo.castShadow = true;
  g.add(corpo);
  g.add(cilindro(d.od * 0.62, L - 2 * d.esp, 'x', MAT.acoCarbono));
  flange(g, d, L / 2, 1);
  flange(g, d, -L / 2, -1);

  const ramal = cilindro(d.od * 0.62, L / 2 - d.esp, 'z', MAT.acoCarbono);
  ramal.position.z = ladoRamal * (L / 4 - d.esp / 2);
  g.add(ramal);
  flange(g, d, ladoRamal * L / 2, ladoRamal, 'z');

  const a = atuador(g, d, rb);
  return { grupo: g, comprimento: L, altura: a.altura, raioAtuador: a.raioAtuador };
}

/* Gaveta classe 150, face a face pela ASME B16.10 [ADOTADO, catalogo]. */
// raquete pintada de amarelo: ve-se de longe se a linha esta aberta ou cega
const PINTURA_RAQUETE = new THREE.MeshStandardMaterial({ color: 0xd8a32b, roughness: 0.55, name: 'raquete' });
const FACE_GAVETA = { 15: 0.108, 25: 0.127, 32: 0.14, 40: 0.165, 50: 0.178, 65: 0.19, 80: 0.203, 100: 0.229, 150: 0.267, 200: 0.292, 250: 0.33 };

/**
 * Valvula gaveta de bloqueio, haste ascendente: corpo, castelo, arcada,
 * haste e volante no alto. Referencial como as outras (linha em X, haste em
 * Y). Volante e altura de catalogo [ESTIMADO]: Ø ~ 0,06 + 1,2 x OD e o topo
 * da haste a ~4 x OD + 0,25 m do eixo, com a gaveta aberta.
 * Devolve { grupo, comprimento, alturaVolante, raioVolante }.
 */
export function criarValvulaGaveta({ dn }) {
  const d = DN[dn];
  const L = FACE_GAVETA[dn] ?? 0.1 + 1.3 * d.od;
  const g = new THREE.Group();
  g.name = 'valvula-gaveta';
  const hc = d.fl * 0.55;                         // meia altura do corpo
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(L - 2 * d.esp, 2 * hc, d.fl * 0.5), MAT.acoCarbono);
  corpo.castShadow = true;
  g.add(corpo);
  flange(g, d, L / 2, 1);
  flange(g, d, -L / 2, -1);
  const hCastelo = d.fl * 0.7;
  const castelo = cilindro(d.fl * 0.28, hCastelo, 'y', MAT.acoCarbono);
  castelo.position.y = hc + hCastelo / 2;
  g.add(castelo);
  const yArcada = hc + hCastelo;
  const topo = Math.max(yArcada + 0.12, 0.25 + 4 * d.od);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, topo - yArcada, 0.02), MAT.acoCarbono);
    b.position.set(s * d.fl * 0.2, (yArcada + topo) / 2, 0);
    g.add(b);
  }
  const haste = cilindro(0.008 + 0.04 * d.od, topo - yArcada + 0.08, 'y', MAT.inox);
  haste.position.y = (yArcada + topo) / 2 + 0.04;
  g.add(haste);
  const rv = Math.min(0.4, 0.06 + 1.2 * d.od) / 2;
  const volante = new THREE.Mesh(new THREE.TorusGeometry(rv, 0.012 + 0.03 * d.od, 8, 28), MAT.atuador);
  volante.rotation.x = Math.PI / 2;
  volante.position.y = topo;
  volante.castShadow = true;
  g.add(volante);
  for (let i = 0; i < 3; i++) {
    const raio = new THREE.Mesh(new THREE.BoxGeometry(2 * rv, 0.012, 0.012), MAT.atuador);
    raio.position.y = topo;
    raio.rotation.y = (i * Math.PI) / 3;
    g.add(raio);
  }
  return { grupo: g, comprimento: L, alturaVolante: topo, raioVolante: rv };
}

/**
 * Raquete (figura 8, ASME B16.48) entre um par de flanges: o anel espacador
 * no eixo da linha, deixando passar, e o disco cego girado para fora, acima
 * dele — virar a raquete isola a linha com certeza (a gaveta pode passar).
 * Referencial: linha em X, o cego para +Y. Devolve { grupo, comprimento }.
 */
export function criarRaquete({ dn }) {
  const d = DN[dn];
  const g = new THREE.Group();
  g.name = 'raquete';
  const t = Math.max(0.012, 0.08 * d.od);         // espessura da chapa [ESTIMADO, classe 150]
  const r = d.fl * 0.36;                          // diametro da face ressaltada
  flange(g, d, t / 2 + d.esp, 1);
  flange(g, d, -t / 2 - d.esp, -1);
  const pintura = PINTURA_RAQUETE;
  const anel = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, r * 0.2, 8, 24), pintura);
  anel.rotation.y = Math.PI / 2;
  g.add(anel);
  const cego = cilindro(r, t, 'x', pintura);
  cego.position.y = 2.1 * r + 0.02;
  g.add(cego);
  const alma = new THREE.Mesh(new THREE.BoxGeometry(t, 0.5 * r, r * 0.4), pintura);
  alma.position.y = 1.05 * r + 0.01;
  g.add(alma);
  return { grupo: g, comprimento: t + 2 * d.esp };
}
