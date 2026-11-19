import * as THREE from 'three';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  LUMINARIAS DA AREA DE PROCESSO  (Fase 26)
 * ===========================================================================
 *  Luminaria a prova de explosao (Ex d) de aluminio fundido, e o que a
 *  prende: braco com bracadeira na coluna do pipe rack, poste preso ao
 *  montante do guarda-corpo, e o mastro de projetores. Nada solto: toda
 *  luminaria chega a uma estrutura por bracadeira ou solda, e o eletroduto
 *  vai dela ate a caixa de junçao, que fica presa na mesma estrutura.
 *
 *  Cada luminaria leva `userData.luminaria = { fluxo, facho, dir, ex,
 *  emergencia }` (combinado com a sessao da nuvem): `fluxo` em lm saindo da
 *  luminaria, `facho` o angulo total a 50 % da intensidade maxima, `dir` no
 *  mundo. `registrarDirecao()` acerta o `dir` depois de a peca estar no
 *  lugar. A lente tem o material `luminaria`: a noite acende pelo nome.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CIMA = V(0, 1, 0);

function malha(geo, mat, sombra = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

/** Tubo (cilindro) de a ate b. */
function tubo(a, b, r, mat) {
  const d = b.clone().sub(a);
  const m = malha(new THREE.CylinderGeometry(r, r, d.length(), 10), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(CIMA, d.normalize());
  return m;
}

/**
 * Luminaria Ex pendente, voltada para baixo, com a origem no topo do cubo de
 * entrada (onde se rosqueia o eletroduto). [ADOTADO] luminaria LED Ex d de
 * campo: corpo de 300 mm com aletas, globo de vidro com grade.
 */
export function criarLuminariaEx({ fluxo, facho, ex = true, emergencia = false }) {
  const g = new THREE.Group();
  g.name = 'luminaria-ex';
  // cubo de entrada (rosca do eletroduto) e o corpo com aletas
  const cubo = malha(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), MAT.aluminioFundido);
  cubo.position.y = -0.035;
  g.add(cubo);
  const corpo = malha(new THREE.CylinderGeometry(0.11, 0.15, 0.13, 20), MAT.aluminioFundido);
  corpo.position.y = -0.07 - 0.065;
  g.add(corpo);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    const aleta = malha(new THREE.BoxGeometry(0.3, 0.09, 0.008), MAT.aluminioFundido, false);
    aleta.position.y = -0.07 - 0.065;
    aleta.rotation.y = a;
    g.add(aleta);
  }
  // globo (a lente que acende) e a grade de protecao
  const globo = malha(new THREE.SphereGeometry(0.1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.lente, false);
  globo.position.y = -0.2;
  g.add(globo);
  for (let i = 0; i < 4; i++) {
    const arame = malha(new THREE.TorusGeometry(0.104, 0.005, 4, 18, Math.PI), MAT.aluminioFundido, false);
    arame.position.y = -0.2;
    arame.rotation.set(Math.PI, (i / 4) * Math.PI, 0);
    g.add(arame);
  }
  g.userData.luminaria = { fluxo, facho, dir: [0, -1, 0], ex, emergencia };
  return g;
}

/** Acerta `dir` no mundo depois de a luminaria estar no lugar. */
export function registrarDirecao(lum, dirLocal = V(0, -1, 0)) {
  lum.updateWorldMatrix(true, false);
  const d = dirLocal.clone().transformDirection(lum.matrixWorld);
  lum.userData.luminaria.dir = [d.x, d.y, d.z].map((v) => +v.toFixed(4));
}

/**
 * Na coluna do pipe rack: bracadeira em volta do perfil, braco horizontal
 * saindo da face `n` (unitario, horizontal) com a luminaria pendurada na
 * ponta, e o eletroduto subindo pela face ate a viga do primeiro nivel
 * (onde corre a bandeja de cabos), com a caixa de junçao no caminho.
 * Montada no referencial da face (+z para fora, origem no eixo da coluna)
 * e girada para `n`.
 *   centro  ponto do eixo da coluna na altura do braco
 *   lado    largura do perfil (m); yViga, fundo da viga
 */
export function criarNaColuna({ centro, n, lado, yViga, braco, luminaria }) {
  const g = new THREE.Group();
  g.name = 'luminaria-coluna';
  const meio = lado / 2, e = 0.012, larg = lado + 2 * e;
  // bracadeira: quatro chapas abracando o perfil
  for (const [w, d, x, z] of [[larg, e, 0, meio + e / 2], [larg, e, 0, -meio - e / 2], [e, lado, meio + e / 2, 0], [e, lado, -meio - e / 2, 0]]) {
    const ch = malha(new THREE.BoxGeometry(w, 0.06, d), MAT.aluminioFundido, false);
    ch.position.set(x, 0, z);
    g.add(ch);
  }
  // braco de tubo de 1" saindo da bracadeira; a luminaria na ponta
  g.add(tubo(V(0, 0, meio + e), V(0, 0, meio + braco), 0.017, MAT.eletroduto));
  const lum = criarLuminariaEx(luminaria);
  lum.position.set(0, -0.017, meio + braco);
  g.add(lum);
  // eletroduto pela face ate a viga (entra no braco por uma curva curta) e
  // a caixa de junçao 0,3 m acima do braco, encostada na face
  const rE = 0.013, zE = meio + e + rE, xE = 0.055;
  g.add(tubo(V(xE, 0, zE), V(xE, yViga - centro.y, zE), rE, MAT.eletroduto));
  g.add(tubo(V(xE, 0, zE), V(0.015, 0, zE), rE, MAT.eletroduto));
  const caixa = malha(new THREE.BoxGeometry(0.12, 0.12, 0.1), MAT.aluminioFundido);
  caixa.position.set(xE, 0.3, meio + e + 0.05);
  g.add(caixa);
  g.position.copy(centro);
  g.quaternion.setFromUnitVectors(V(0, 0, 1), n);
  registrarDirecao(lum);
  return { grupo: g, luminaria: lum };
}

/**
 * Num montante do guarda-corpo: poste de tubo de 1 1/2" encostado nele por
 * fora, do piso da plataforma ate `altura`, preso por duas bracadeiras; no
 * topo um braco para dentro com a luminaria. O cabo desce por dentro do
 * poste ate a caixa de junçao junto do piso. Referencial: +z para fora,
 * origem no pe do montante, girado para `fora`.
 *   p     pe do montante no piso (mundo); fora, normal horizontal para fora
 *   rMontante  raio (ou meia largura) do montante
 */
export function criarNoGuardaCorpo({ p, fora, rMontante, altura, braco, luminaria }) {
  const g = new THREE.Group();
  g.name = 'luminaria-guarda-corpo';
  const rP = 0.024, zP = rMontante + rP;
  g.add(tubo(V(0, 0, zP), V(0, altura, zP), rP, MAT.eletroduto));
  for (const h of [0.3, 0.95]) {
    // abraca o montante e o poste juntos
    const z0 = -rMontante - 0.01, z1 = zP + rP + 0.01;
    const b = malha(new THREE.BoxGeometry(0.06, 0.04, z1 - z0), MAT.aluminioFundido, false);
    b.position.set(0, h, (z0 + z1) / 2);
    g.add(b);
  }
  // braco para dentro, a luminaria na ponta
  g.add(tubo(V(0, altura - 0.02, zP), V(0, altura - 0.02, zP - braco), 0.017, MAT.eletroduto));
  const lum = criarLuminariaEx(luminaria);
  lum.position.set(0, altura - 0.037, zP - braco);
  g.add(lum);
  // caixa de junçao no pe do poste, por fora
  const caixa = malha(new THREE.BoxGeometry(0.12, 0.12, 0.1), MAT.aluminioFundido);
  caixa.position.set(0, 0.25, zP + rP + 0.05);
  g.add(caixa);
  g.position.copy(p);
  g.quaternion.setFromUnitVectors(V(0, 0, 1), fora);
  registrarDirecao(lum);
  return { grupo: g, luminaria: lum };
}

/**
 * Mastro de projetores: base de concreto, poste conico de aco galvanizado e
 * cruzeta no topo com os projetores mirando os `alvos` (mundo). Origem no
 * pe do mastro, `yChao` a cota do terreno. [ADOTADO] mastro de 16 m,
 * projetores LED Ex de ~20 klm.
 */
export function criarMastro({ x, z, yChao, altura, alvos, projetor }) {
  const g = new THREE.Group();
  g.name = 'mastro-iluminacao';
  const base = malha(new THREE.BoxGeometry(0.9, 0.6, 0.9), MAT.concreto);
  base.position.set(x, yChao + 0.15, z);                       // 0,3 m enterrado, 0,3 m fora
  g.add(base);
  const y0 = yChao + 0.45;
  const poste = malha(new THREE.CylinderGeometry(0.09, 0.17, altura - y0, 14), MAT.eletroduto);
  poste.position.set(x, (altura + y0) / 2, z);
  g.add(poste);
  const flange = malha(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), MAT.eletroduto);
  flange.position.set(x, y0 + 0.015, z);
  g.add(flange);
  // cruzeta perpendicular a direcao media dos alvos
  const media = alvos.reduce((s, a) => s.add(V(a.x - x, 0, a.z - z).normalize()), V()).normalize();
  const lado = V(-media.z, 0, media.x);
  const larg = 0.6 * alvos.length;
  const cz = malha(new THREE.BoxGeometry(0.08, 0.08, larg), MAT.acoCarbono);
  cz.position.set(x, altura + 0.04, z).addScaledVector(media, 0.12);
  cz.quaternion.setFromUnitVectors(V(0, 0, 1), lado);
  g.add(cz);
  g.add(tubo(V(x, altura - 0.05, z), V(x, altura + 0.04, z).addScaledVector(media, 0.12), 0.05, MAT.acoCarbono));
  const luminarias = [];
  alvos.forEach((alvo, i) => {
    const s = (i - (alvos.length - 1) / 2) * 0.6;
    const piv = V(x, altura + 0.04, z).addScaledVector(media, 0.12).addScaledVector(lado, s);
    const pj = new THREE.Group();
    pj.name = 'projetor';
    // corpo com a face de luz voltada para +z local; garfo nas laterais
    const corpo = malha(new THREE.BoxGeometry(0.42, 0.32, 0.14), MAT.aluminioFundido);
    pj.add(corpo);
    const vidro = malha(new THREE.BoxGeometry(0.36, 0.26, 0.01), MAT.lente, false);
    vidro.position.z = 0.072;
    pj.add(vidro);
    for (const sx of [-1, 1]) {
      const garfo = malha(new THREE.BoxGeometry(0.02, 0.2, 0.06), MAT.acoCarbono, false);
      garfo.position.set(sx * 0.22, 0.04, -0.02);
      pj.add(garfo);
    }
    pj.position.copy(piv).add(V(0, 0.2, 0));
    const d = alvo.clone().sub(pj.position).normalize();
    pj.quaternion.setFromUnitVectors(V(0, 0, 1), d);
    // garfo ate a cruzeta: a haste que liga o projetor a ela
    g.add(tubo(piv, pj.position.clone().add(V(0, -0.1, 0)), 0.02, MAT.acoCarbono));
    pj.userData.luminaria = { ...projetor, dir: [d.x, d.y, d.z].map((v) => +v.toFixed(4)), ex: true, emergencia: false };
    g.add(pj);
    luminarias.push(pj);
  });
  // topo (mundo), para o balizamento da noite: a fusao esvazia o grupo
  g.userData.topo = [x, altura + 0.45, z];
  return { grupo: g, luminarias };
}
