import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { PLINTO } from './supports.js';

/**
 * ===========================================================================
 *  BOMBA CENTRIFUGA HORIZONTAL DE SUCCAO AXIAL  (padrao ISO 2858 / ANSI B73)
 * ===========================================================================
 *  A configuracao de quase toda bomba de processo desta planta: carcaca em
 *  voluta com succao de frente e descarga no topo, cavalete de mancais, luva
 *  de acoplamento sob protetor e motor eletrico, tudo numa base de aco sobre
 *  bloco de concreto.
 *
 *  Referencial local: eixo da bomba em +X, succao apontando para -X, piso
 *  acabado em y = 0. O grupo sai centrado em X e Z, para quem posiciona girar
 *  em torno do centro da base.
 *
 *  As proporcoes sao [ESTIMADO]: partem do diametro do rotor e da potencia,
 *  com relacoes tipicas de catalogo — o suficiente para a bomba ter o tamanho
 *  certo na maquete e os flanges no lugar certo para a tubulacao. Nao e
 *  desenho de fabricante.
 *
 *  Devolve tambem os BOCAIS (S = succao, D = descarga) como dado — posicao da
 *  base do pescoco e direcao —, para o construtor montar os flanges com a
 *  mesma primitiva de bocal dos vasos.
 */

const SEG = 32;

function cilindroX(r, comprimento, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, comprimento, SEG), mat);
  m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  return m;
}

function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* Graute e chumbador [ESTIMADO]: a base de aco nao pousa direto no
 * concreto — leva 40 mm de graute sem retracao entre os dois (a API 686 pede
 * de 25 a 50 mm [VERIFICAR]) e e presa por chumbadores M16 a cada 0,6 m, no
 * maximo, ao longo das duas bordas. */
const GRAUTE = 0.04, CHUMBADOR = { r: 0.008, porca: 0.013, alturaPorca: 0.014, sobra: 0.03, passo: 0.6, borda: 0.035, fundo: 0.12 };

/**
 * Bloco de concreto, graute, base de aco e chumbadores, comuns as tres
 * bombas (Fase 25). O bloco desce 0,26 m na laje e para GRAUTE abaixo da
 * cota PLINTO; o graute completa ate ela e a base fica onde sempre esteve —
 * nenhum bocal muda de cota. Nenhuma face horizontal rente ao piso.
 */
function blocoEBase(raiz, comprimento, largura, espBase) {
  const yBloco = PLINTO - GRAUTE;
  const bloco = caixa(comprimento + 0.2, 0.26 + yBloco, largura + 0.2, MAT.concreto);
  bloco.position.set(0, (yBloco - 0.26) / 2, 0);
  bloco.castShadow = false;
  raiz.add(bloco);
  const graute = caixa(comprimento + 0.06, GRAUTE, largura + 0.06, MAT.concreto);
  graute.position.set(0, yBloco + GRAUTE / 2, 0);
  graute.castShadow = false;
  raiz.add(graute);
  const base = caixa(comprimento, espBase, largura, MAT.acoCarbono);
  base.position.set(0, PLINTO + espBase / 2, 0);
  raiz.add(base);
  // chumbadores: do fundo do bloco ate acima da porca, nas duas bordas
  const C = CHUMBADOR;
  const util = comprimento - 2 * C.borda;
  const n = Math.max(2, Math.ceil(util / C.passo) + 1);
  const yTopo = PLINTO + espBase;
  for (let i = 0; i < n; i++) {
    const x = -util / 2 + (util * i) / (n - 1);
    for (const z of [-(largura / 2 - C.borda), largura / 2 - C.borda]) {
      const h = yTopo + C.sobra - (yBloco - C.fundo);
      const haste = new THREE.Mesh(new THREE.CylinderGeometry(C.r, C.r, h, 8), MAT.acoCarbono);
      haste.position.set(x, yBloco - C.fundo + h / 2, z);
      const porca = new THREE.Mesh(new THREE.CylinderGeometry(C.porca, C.porca, C.alturaPorca, 6), MAT.acoCarbono);
      porca.position.set(x, yTopo + C.alturaPorca / 2, z);
      raiz.add(haste, porca);
    }
  }
}

/**
 * @param {object} p
 * @param {number} p.dnSuccao     DN do flange de succao
 * @param {number} p.dnDescarga   DN do flange de descarga
 * @param {number} p.rotor        diametro nominal do rotor (m) — o "125" de 50-32-125
 * @param {number} p.potencia     potencia do motor (kW)
 */
export function criarBombaCentrifuga({ dnSuccao, dnDescarga, rotor = 0.125, potencia = 0.75 }) {
  const raiz = new THREE.Group();
  raiz.name = 'bomba';

  // --- proporcoes ---
  const rc = rotor * 1.1;                          // raio externo da voluta
  const wV = rotor * 0.8;                          // largura da voluta
  // Raio do motor cresce com a carcaca IEC, que cresce ~ com a raiz cubica da
  // potencia: 0,75 kW -> carcaca 80 (r ~ 0,09 m); 75 kW -> 280 (r ~ 0,19 m).
  const rm = 0.065 + 0.03 * Math.cbrt(potencia);
  const Lm = 3.2 * rm;
  const rCav = rc * 0.4;                           // cavalete de mancais
  const Lcav = rotor * 2.1;
  const Lluva = 0.14;

  const ESP_BASE = 0.08;
  const yBase = PLINTO + ESP_BASE;                 // topo da base de aco
  const hEixo = yBase + rc + 0.05;                 // voluta 5 cm acima da base

  // --- posicoes ao longo do eixo, a partir da face de succao da voluta ---
  const folgaSuccao = 0.16;                        // pescoco + flange de succao sobre a base
  const xV0 = folgaSuccao;                         // face de succao da voluta
  const xV = xV0 + wV / 2;                         // centro da voluta
  const xCav0 = xV0 + wV;
  const xLuva0 = xCav0 + Lcav;
  const xM0 = xLuva0 + Lluva;
  const xFim = xM0 + Lm + 0.05;
  const dx = -xFim / 2;                            // centra o conjunto em X

  // --- bloco de concreto, graute e base de aco (blocoEBase) ---
  const larg = Math.max(0.36, 2 * rm + 0.12);
  blocoEBase(raiz, xFim, larg, ESP_BASE);

  // --- voluta e sua pata ---
  const voluta = cilindroX(rc, wV, MAT.acoCarbono);
  voluta.position.set(xV + dx, hEixo, 0);
  raiz.add(voluta);
  // Bocal de succao nasce num cubo frontal, que e por onde a agua entra no olho do rotor.
  const cubo = cilindroX(rc * 0.45, 0.04, MAT.acoCarbono);
  cubo.position.set(xV0 - 0.02 + dx, hEixo, 0);
  raiz.add(cubo);
  const pataV = caixa(wV * 0.8, hEixo - rc * 0.8 - yBase, rc * 1.2, MAT.acoCarbono);
  pataV.position.set(xV + dx, yBase + pataV.geometry.parameters.height / 2, 0);
  raiz.add(pataV);

  // --- cavalete de mancais ---
  const cav = cilindroX(rCav, Lcav, MAT.acoCarbono);
  cav.position.set(xCav0 + Lcav / 2 + dx, hEixo, 0);
  raiz.add(cav);
  const pataC = caixa(Lcav * 0.35, hEixo - rCav - yBase + 0.01, rCav * 2.2, MAT.acoCarbono);
  pataC.position.set(xCav0 + Lcav * 0.7 + dx, yBase + pataC.geometry.parameters.height / 2, 0);
  raiz.add(pataC);

  // --- protetor de acoplamento: amarelo de seguranca, como o guarda-corpo ---
  const hProt = Math.max(rCav, rm * 0.7) * 2;
  const protetor = caixa(Lluva, hProt, hProt, MAT.guardaCorpo);
  protetor.position.set(xLuva0 + Lluva / 2 + dx, hEixo, 0);
  raiz.add(protetor);

  // --- motor ---
  const motor = cilindroX(rm, Lm, MAT.motor);
  motor.position.set(xM0 + Lm / 2 + dx, hEixo, 0);
  raiz.add(motor);
  const tampaVent = cilindroX(rm * 1.04, Lm * 0.16, MAT.motor);
  tampaVent.position.set(xM0 + Lm * 0.92 + dx, hEixo, 0);
  raiz.add(tampaVent);
  const caixaLig = caixa(rm * 0.9, rm * 0.55, rm * 0.9, MAT.motor);
  caixaLig.position.set(xM0 + Lm * 0.4 + dx, hEixo + rm + rm * 0.25, 0);
  raiz.add(caixaLig);
  for (const s of [0.22, 0.78]) {
    const pe = caixa(Lm * 0.14, hEixo - rm * 0.7 - yBase, rm * 1.6, MAT.motor);
    pe.position.set(xM0 + Lm * s + dx, yBase + pe.geometry.parameters.height / 2, 0);
    raiz.add(pe);
  }

  // --- bocais: base do pescoco dentro da carcaca, para encostar nela ---
  const bocais = [
    {
      id: 'S', dn: dnSuccao, comprimento: folgaSuccao - 0.04,
      pos: [xV0 - 0.04 + dx, hEixo, 0], dir: [-1, 0, 0], servico: 'Sucção',
    },
    {
      id: 'D', dn: dnDescarga, comprimento: 0.12,
      pos: [xV + dx, hEixo + rc - 0.02, 0], dir: [0, 1, 0], servico: 'Descarga',
    },
  ];

  return {
    raiz,
    corpo: voluta,
    bocais,
    altura: hEixo + rc + 0.12,
    comprimento: xFim,
    largura: larg,
  };
}

/**
 * ===========================================================================
 *  BOMBA DE CAVIDADE PROGRESSIVA COM TREMONHA  (BD-01, BD-02)
 * ===========================================================================
 *  A torta umida que cai do raspador do filtro rotativo nao escoa como
 *  liquido: o P&ID a manda por bomba de deslocamento positivo. A forma usual
 *  para isso e a bomba helicoidal de cavidade progressiva com tremonha
 *  aberta e rosca alimentadora — a torta cai na tremonha, a rosca a empurra
 *  para o rotor helicoidal e o estator a leva ate a descarga.
 *
 *  Referencial local igual ao da centrifuga: eixo em +X, piso em y = 0,
 *  grupo centrado. Da esquerda para a direita: motorredutor, mancal, tremonha
 *  com a rosca, estator e cabecote de descarga.
 *
 *  Proporcoes [ESTIMADO], de catalogo de bombas de tremonha de 2 a 5 m³/h:
 *  estator de ~0,2 m de diametro e ~1,2 m de comprimento, tremonha de boca
 *  0,5 x 0,5 m. Bocais: S = boca da tremonha (para cima), D = descarga
 *  (ponta do estator, em +X).
 *
 * @param {object} p
 * @param {number} p.dnSuccao    DN do flange da boca da tremonha
 * @param {number} p.dnDescarga  DN do flange de descarga
 * @param {number} p.vazao       m³/h — escala o estator
 * @param {number} p.potencia    kW
 */
export function criarBombaDeslocamento({ dnSuccao = 150, dnDescarga = 80, vazao = 4, potencia = 3 }) {
  const raiz = new THREE.Group();
  raiz.name = 'bomba-deslocamento';

  const rm = 0.065 + 0.03 * Math.cbrt(potencia);   // mesma regra da centrifuga
  const Lm = 3.2 * rm;
  const rs = 0.07 + 0.015 * Math.cbrt(vazao);      // estator
  const Ls = 0.9 + 0.08 * vazao;
  const Lred = 0.28, Lman = 0.3, Lt = 0.55, Lcab = 0.16;
  const bocaT = 0.5, hT = 0.45;                      // tremonha: boca e altura

  const ESP_BASE = 0.08;
  const yBase = PLINTO + ESP_BASE;
  const hEixo = yBase + Math.max(rm, rs + 0.06) + 0.06;

  // posicoes ao longo do eixo
  const xM0 = 0;
  const xR0 = xM0 + Lm;
  const xMan0 = xR0 + Lred;
  const xT0 = xMan0 + Lman;
  const xS0 = xT0 + Lt;
  const xC0 = xS0 + Ls;
  const xFim = xC0 + Lcab;
  const dx = -xFim / 2;

  // --- bloco de concreto e base de aco ---
  const larg = Math.max(0.5, bocaT + 0.1);
  blocoEBase(raiz, xFim, larg, ESP_BASE);

  // --- motorredutor ---
  const motor = cilindroX(rm, Lm, MAT.motor);
  motor.position.set(xM0 + Lm / 2 + dx, hEixo, 0);
  raiz.add(motor);
  const redutor = caixa(Lred, rm * 2.4, rm * 2.4, MAT.motor);
  redutor.position.set(xR0 + Lred / 2 + dx, hEixo, 0);
  raiz.add(redutor);
  const peR = caixa(Lred + Lm * 0.5, hEixo - rm - yBase, rm * 1.8, MAT.motor);
  peR.position.set(xR0 - Lm * 0.15 + dx, yBase + peR.geometry.parameters.height / 2, 0);
  raiz.add(peR);

  // --- mancal com a luva sob protetor ---
  const mancal = cilindroX(rs * 0.7, Lman, MAT.acoCarbono);
  mancal.position.set(xMan0 + Lman / 2 + dx, hEixo, 0);
  raiz.add(mancal);
  const protetor = caixa(Lman * 0.5, rs * 2, rs * 2, MAT.guardaCorpo);
  protetor.position.set(xMan0 + Lman * 0.35 + dx, hEixo, 0);
  raiz.add(protetor);

  // --- tremonha: caixa da rosca embaixo, tronco de piramide em cima ---
  const caixaRosca = caixa(Lt, 2 * rs + 0.12, 2 * rs + 0.12, MAT.acoCarbono);
  caixaRosca.position.set(xT0 + Lt / 2 + dx, hEixo, 0);
  raiz.add(caixaRosca);
  const yT0 = hEixo + rs + 0.06;
  // Cilindro de 4 lados girado 45°: tronco de piramide de base quadrada. A
  // boca e fechada por uma tampa com o flange da calha que vem do filtro.
  const tronco = new THREE.Mesh(
    new THREE.CylinderGeometry(bocaT / Math.SQRT2, (2 * rs + 0.12) / Math.SQRT2, hT, 4, 1, false),
    MAT.acoCarbono,
  );
  tronco.rotation.y = Math.PI / 4;
  tronco.position.set(xT0 + Lt / 2 + dx, yT0 + hT / 2, 0);
  tronco.castShadow = true;
  raiz.add(tronco);
  const pernaT = caixa(Lt * 0.8, hEixo - rs - 0.06 - yBase, 2 * rs, MAT.acoCarbono);
  pernaT.position.set(xT0 + Lt / 2 + dx, yBase + pernaT.geometry.parameters.height / 2, 0);
  raiz.add(pernaT);

  // --- estator, com dois apoios, e cabecote de descarga ---
  const estator = cilindroX(rs, Ls, MAT.acoCarbono);
  estator.position.set(xS0 + Ls / 2 + dx, hEixo, 0);
  raiz.add(estator);
  for (const f of [0.25, 0.8]) {
    const apoio = caixa(0.08, hEixo - rs - yBase, rs * 1.6, MAT.acoCarbono);
    apoio.position.set(xS0 + Ls * f + dx, yBase + apoio.geometry.parameters.height / 2, 0);
    raiz.add(apoio);
  }
  const cab = cilindroX(rs * 1.25, Lcab, MAT.acoCarbono);
  cab.position.set(xC0 + Lcab / 2 + dx, hEixo, 0);
  raiz.add(cab);

  // --- bocais ---
  const bocais = [
    {
      id: 'S', dn: dnSuccao, comprimento: 0.06,
      pos: [xT0 + Lt / 2 + dx, yT0 + hT - 0.02, 0], dir: [0, 1, 0], servico: 'Boca da tremonha',
    },
    {
      id: 'D', dn: dnDescarga, comprimento: 0.1,
      pos: [xFim - 0.02 + dx, hEixo, 0], dir: [1, 0, 0], servico: 'Descarga',
    },
  ];

  return {
    raiz,
    corpo: estator,
    bocais,
    altura: yT0 + hT + 0.08,
    comprimento: xFim,
    largura: larg,
  };
}

/**
 * ===========================================================================
 *  BOMBA DE VACUO DE ANEL LIQUIDO  (BV-01, BV-02)
 * ===========================================================================
 *  A bomba usual de filtro rotativo: aguenta o vapor de solvente e o arraste
 *  de liquido que vem do tambor. Carcaca cilindrica com o motor ao lado e,
 *  na ponta, o separador que tira o liquido de selagem do gas de exaustao.
 *
 *  Referencial como o das outras: eixo em +X, piso em y = 0, grupo centrado.
 *  Bocais: S = succao, no alto da carcaca; E = exaustao, no topo do
 *  separador. Proporcoes [ESTIMADO] pela potencia.
 */
export function criarBombaVacuo({ dnSuccao = 100, potencia = 11 }) {
  const raiz = new THREE.Group();
  raiz.name = 'bomba-vacuo';

  const rm = 0.065 + 0.03 * Math.cbrt(potencia);
  const Lm = 3.2 * rm;
  const rc = 0.15 + 0.05 * Math.cbrt(potencia);        // carcaca
  const Lc = 2.2 * rc;
  const rs = rc * 0.8;                                  // separador
  const hs = 0.9 + 0.04 * potencia;

  const ESP_BASE = 0.08;
  const yBase = PLINTO + ESP_BASE;
  const hEixo = yBase + rc + 0.06;

  const xM0 = 0;
  const xC0 = xM0 + Lm + 0.14;
  const xS = xC0 + Lc + rs + 0.12;
  const xFim = xS + rs + 0.05;
  const dx = -xFim / 2;
  const larg = 2 * rc + 0.2;

  blocoEBase(raiz, xFim, larg, ESP_BASE);

  const motor = cilindroX(rm, Lm, MAT.motor);
  motor.position.set(xM0 + Lm / 2 + dx, hEixo, 0);
  raiz.add(motor);
  const protetor = caixa(0.14, rm * 1.6, rm * 1.6, MAT.guardaCorpo);
  protetor.position.set(xM0 + Lm + 0.07 + dx, hEixo, 0);
  raiz.add(protetor);

  const carcaca = cilindroX(rc, Lc, MAT.acoCarbono);
  carcaca.position.set(xC0 + Lc / 2 + dx, hEixo, 0);
  raiz.add(carcaca);
  const pe = caixa(Lc * 0.7, hEixo - rc * 0.6 - yBase, rc * 1.4, MAT.acoCarbono);
  pe.position.set(xC0 + Lc / 2 + dx, yBase + pe.geometry.parameters.height / 2, 0);
  raiz.add(pe);

  // separador vertical e o tubo curto que vem da descarga da carcaca
  const sep = new THREE.Mesh(new THREE.CylinderGeometry(rs, rs, hs, 24), MAT.acoCarbono);
  sep.position.set(xS + dx, yBase + hs / 2, 0);
  sep.castShadow = true;
  raiz.add(sep);
  const tampo = new THREE.Mesh(new THREE.SphereGeometry(rs, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.acoCarbono);
  tampo.scale.y = 0.5;
  tampo.position.set(xS + dx, yBase + hs, 0);
  raiz.add(tampo);
  const desc = cilindroX(0.05, 0.12 + rs * 0.2, MAT.acoCarbono);
  desc.position.set(xC0 + Lc + 0.06 + dx, hEixo, 0);
  raiz.add(desc);

  const bocais = [
    {
      id: 'S', dn: dnSuccao, comprimento: 0.1,
      pos: [xC0 + Lc / 2 + dx, hEixo + rc - 0.02, 0], dir: [0, 1, 0], servico: 'Sucção de vácuo',
    },
    {
      id: 'E', dn: 50, comprimento: 0.1,
      pos: [xS + dx, yBase + hs + rs * 0.5 - 0.02, 0], dir: [0, 1, 0], servico: 'Exaustão do separador',
    },
  ];

  return { raiz, corpo: carcaca, bocais, altura: yBase + hs + rs * 0.5 + 0.1, comprimento: xFim, largura: larg };
}
