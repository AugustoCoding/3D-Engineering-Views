import * as THREE from 'three';
import { DN } from '../data/plant.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  BOCAIS FLANGEADOS
 * ===========================================================================
 *  Um bocal real = pescoco (tubo) + flange + face de assentamento + parafusos.
 *  Desenhar os quatro elementos e o que separa "um cilindro saindo do vaso"
 *  de algo que um projetista reconhece como bocal.
 *
 *  O grupo e construido apontando para +Y, com a base na origem. Quem chama
 *  decide posicao e direcao (ver `orientarPara`).
 */

const SEG = 32;

/** Numero de parafusos por DN — ASME B16.5 classe 150. */
const N_PARAFUSOS = { 15: 4, 25: 4, 32: 4, 40: 4, 50: 4, 65: 4, 80: 4, 100: 8, 150: 8, 200: 8, 250: 12, 300: 12, 500: 20 };

/** Tubo com parede real (lathe fechado), para o corte em secao ficar correto. */
function tuboComParede(rExt, rInt, altura, y0 = 0, mat = MAT.inox) {
  const pts = [
    new THREE.Vector2(rInt, y0),
    new THREE.Vector2(rExt, y0),
    new THREE.Vector2(rExt, y0 + altura),
    new THREE.Vector2(rInt, y0 + altura),
    new THREE.Vector2(rInt, y0),
  ];
  const geo = new THREE.LatheGeometry(pts, SEG);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/**
 * @param {object} p
 *   tampaCega  flange cego na ponta
 *   visor      tampa com visor de vidro (boca de visita): marca o furo do
 *              vao livre na chapa do vaso (lib/furos.js), para se ver dentro
 */
export function criarBocal({ dn, comprimento = 0.3, tampaCega = false, visor = false }) {
  const d = DN[dn];
  if (!d) throw new Error(`DN ${dn} nao esta na tabela de plant.js`);

  const rExt = d.od / 2;
  const parede = Math.max(0.005, d.od * 0.05);
  const rInt = rExt - parede;
  const rFl = d.fl / 2;

  const g = new THREE.Group();
  g.name = `bocal-DN${dn}`;

  // --- pescoco ---
  const pescoco = tuboComParede(rExt, rInt, comprimento, 0);
  pescoco.castShadow = true;
  g.add(pescoco);

  // --- flange ---
  const flange = tuboComParede(rFl, rInt, d.esp, comprimento, MAT.flange);
  flange.castShadow = true;
  g.add(flange);

  // --- face de assentamento (raised face), 2 mm proeminente ---
  const rRF = rInt + (rFl - rInt) * 0.55;
  const face = tuboComParede(rRF, rInt, 0.002, comprimento + d.esp, MAT.flange);
  g.add(face);

  // --- parafusos no circulo de furacao ---
  const n = N_PARAFUSOS[dn] ?? 8;
  const rBolt = (rFl + rExt) / 2 + (rFl - rExt) * 0.12;
  const dBolt = Math.max(0.012, d.fl * 0.045);
  const geoBolt = new THREE.CylinderGeometry(dBolt / 2, dBolt / 2, d.esp * 2.4, 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = new THREE.Mesh(geoBolt, MAT.acoCarbono);
    b.position.set(Math.cos(a) * rBolt, comprimento + d.esp / 2, Math.sin(a) * rBolt);
    g.add(b);
  }

  // --- tampa cega (bocas de visita) ---
  if (tampaCega) {
    const tampa = new THREE.Mesh(
      new THREE.CylinderGeometry(rFl, rFl, d.esp, SEG),
      MAT.flange,
    );
    tampa.position.y = comprimento + d.esp * 1.5 + 0.002;
    tampa.castShadow = true;
    g.add(tampa);
  }

  // --- tampa com visor: anel de chapa, vidro e anel de aperto do vidro ---
  if (visor) {
    const rVidro = Math.min(rInt * 0.8, 0.17);      // visor de ate DN 300 na tampa [ADOTADO]
    const y = comprimento + d.esp + 0.002;
    const anel = tuboComParede(rFl, rVidro, d.esp, y, MAT.flange);
    anel.castShadow = true;
    g.add(anel);
    const aperto = tuboComParede(rVidro + 0.035, rVidro - 0.012, 0.018, y + d.esp, MAT.flange);
    g.add(aperto);
    const vidro = new THREE.Mesh(new THREE.CircleGeometry(rVidro, SEG), MAT.visor);
    vidro.rotation.x = -Math.PI / 2;
    vidro.position.y = y + d.esp * 0.5;
    g.add(vidro);
    // o vao livre do pescoco, de 9 cm dentro da base (a chapa) ate a tampa
    g.userData.furo = { raio: rInt - 0.004, de: -0.09, ate: comprimento + 0.001 };
  }

  g.userData.comprimentoTotal = comprimento + d.esp * (tampaCega || visor ? 2.5 : 1) + 0.002;
  return g;
}

/**
 * Aponta um objeto construido em +Y para uma direcao qualquer, e o coloca
 * numa posicao. E assim que os bocais radiais "nascem" perpendiculares ao
 * costado sem nenhuma matematica de angulo no codigo que chama.
 */
export function orientarPara(obj, posicao, direcao) {
  obj.position.copy(posicao);
  obj.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direcao.clone().normalize(),
  );
  return obj;
}
