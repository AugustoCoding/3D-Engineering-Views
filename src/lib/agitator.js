import * as THREE from 'three';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  SISTEMA DE AGITACAO
 * ===========================================================================
 *  Motor -> redutor -> selo mecanico -> eixo -> impelidores.
 *  Construido de cima para baixo a partir do topo do vaso.
 */

const SEG = 24;

/**
 * TURBINA RUSHTON (turbina de disco com 6 pas planas).
 * Padrao de projeto: disco = 0,75 D | pa: comprimento D/4, altura D/5.
 * E o impelidor classico para DISPERSAO DE GAS — exatamente o caso de um
 * reator de oxidacao com borbulhamento de ar.
 */
export function turbinaRushton(Dimp, { nPas = 6, diamEixo = 0.09 } = {}) {
  const g = new THREE.Group();
  g.name = 'turbina-rushton';

  const rDisco = 0.375 * Dimp;
  const compPa = Dimp / 4;
  const altPa = Dimp / 5;
  const espPa = 0.008;

  // cubo de fixacao no eixo
  const cubo = new THREE.Mesh(
    new THREE.CylinderGeometry(diamEixo * 0.9, diamEixo * 0.9, altPa * 1.1, SEG),
    MAT.inox,
  );
  cubo.castShadow = true;
  g.add(cubo);

  // disco
  const disco = new THREE.Mesh(
    new THREE.CylinderGeometry(rDisco, rDisco, 0.01, 48),
    MAT.inox,
  );
  disco.castShadow = true;
  g.add(disco);

  // pas verticais na periferia do disco
  const geoPa = new THREE.BoxGeometry(compPa, altPa, espPa);
  const rPa = Dimp / 2 - compPa / 2;
  for (let i = 0; i < nPas; i++) {
    const a = (i / nPas) * Math.PI * 2;
    const pa = new THREE.Mesh(geoPa, MAT.inox);
    pa.position.set(Math.cos(a) * rPa, 0, Math.sin(a) * rPa);
    pa.rotation.y = -a;
    pa.castShadow = true;
    g.add(pa);
  }

  return g;
}

/** TURBINA DE PAS INCLINADAS (45deg) — bombeamento axial. Deixada pronta
 *  para os proximos equipamentos (tanques de mistura, cristalizador). */
export function turbinaPasInclinadas(Dimp, { nPas = 4, angulo = 45, diamEixo = 0.09 } = {}) {
  const g = new THREE.Group();
  g.name = 'turbina-pas-inclinadas';

  const compPa = Dimp * 0.32;
  const altPa = Dimp * 0.2;

  const cubo = new THREE.Mesh(
    new THREE.CylinderGeometry(diamEixo * 0.95, diamEixo * 0.95, altPa * 0.9, SEG),
    MAT.inox,
  );
  g.add(cubo);

  const geoPa = new THREE.BoxGeometry(compPa, 0.008, altPa);
  const rPa = Dimp / 2 - compPa / 2;
  for (let i = 0; i < nPas; i++) {
    const a = (i / nPas) * Math.PI * 2;
    const pivo = new THREE.Group();
    pivo.rotation.y = -a;
    const pa = new THREE.Mesh(geoPa, MAT.inox);
    pa.position.set(rPa, 0, 0);
    pa.rotation.x = THREE.MathUtils.degToRad(angulo);
    pa.castShadow = true;
    pivo.add(pa);
    g.add(pivo);
  }
  return g;
}

/**
 * Conjunto completo de acionamento montado sobre o tampo superior.
 * @param {object} a  bloco `geom.agitador` de plant.js
 * @param {number} yTopo  elevacao local do apice do tampo superior
 * @param {number} yFundo elevacao local onde o eixo termina
 */
export function criarAgitador(a, yTopo, yFundo) {
  const g = new THREE.Group();
  g.name = 'agitador';

  const rEixo = a.diamEixo / 2;

  // --- flange de montagem sobre o tampo ---
  const flangeMont = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.05, SEG),
    MAT.flange,
  );
  flangeMont.position.y = yTopo + 0.025;
  flangeMont.castShadow = true;
  g.add(flangeMont);

  // --- lanterna / selo mecanico ---
  const selo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.34, SEG),
    MAT.inox,
  );
  selo.position.y = yTopo + 0.05 + 0.17;
  selo.castShadow = true;
  g.add(selo);

  const baseRedutor = yTopo + 0.05 + 0.34;

  // --- redutor ---
  const redutor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), MAT.redutor);
  redutor.position.y = baseRedutor + 0.25;
  redutor.castShadow = true;
  g.add(redutor);

  // --- motor eletrico ---
  const yMotor = baseRedutor + 0.5;
  const corpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.62, SEG),
    MAT.motor,
  );
  corpo.position.y = yMotor + 0.31;
  corpo.castShadow = true;
  g.add(corpo);

  // aletas de refrigeracao
  for (let i = 0; i < 5; i++) {
    const aleta = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.225, 0.02, SEG),
      MAT.motor,
    );
    aleta.position.y = yMotor + 0.12 + i * 0.1;
    g.add(aleta);
  }

  // caixa de ligacao
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.16), MAT.redutor);
  caixa.position.set(0.24, yMotor + 0.4, 0);
  g.add(caixa);

  // tampa do ventilador
  const ventilador = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.19, 0.16, SEG),
    MAT.redutor,
  );
  ventilador.position.y = yMotor + 0.62 + 0.08;
  ventilador.castShadow = true;
  g.add(ventilador);

  // --- partes girantes: eixo + impelidores ---
  // Ficam num subgrupo proprio para que a animacao gire SO o que gira de
  // verdade (o motor e o redutor sao carcacas fixas).
  const girante = new THREE.Group();
  girante.name = 'girante';

  const compEixo = yTopo + 0.2 - yFundo;
  const eixo = new THREE.Mesh(
    new THREE.CylinderGeometry(rEixo, rEixo, compEixo, SEG),
    MAT.inox,
  );
  eixo.position.y = yFundo + compEixo / 2;
  eixo.castShadow = true;
  girante.add(eixo);

  for (let i = 0; i < a.nImpelidores; i++) {
    const imp = turbinaRushton(a.Dimp, { diamEixo: a.diamEixo });
    imp.position.y = a.alturaPrimeiro + i * a.espacamento;
    girante.add(imp);
  }

  g.add(girante);
  g.userData.girante = girante;

  g.userData.alturaTotal = yMotor + 0.62 + 0.16;
  return g;
}
