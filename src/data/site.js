/**
 * ============================================================================
 *  IMPLANTACAO DA PLANTA  —  terreno, blocos, vias e distancias
 * ============================================================================
 *
 *  Nada daqui esta nos documentos do grupo: o relatorio vai ate o limite de
 *  bateria. Tudo e [ADOTADO], e cada numero tem a regra ao lado — a auditoria
 *  de implantacao (src/dev/implantacao.js) mede o desenho contra elas.
 *
 *  REFERENCIAL
 *    Metros, o mesmo da maquete. X = leste, Z = sul, entao o NORTE e -Z.
 *    Retangulos sao [x0, x1] x [z0, z1]; vias sao polilinhas de eixo.
 *
 *  FONTES DAS DISTANCIAS
 *    BN-DS-C69 — Red-Bag, "Minimum spacing for refineries and petrochemical
 *      plants", rev. 09/05/2014. Matriz publica, em metros, de borda a borda.
 *      E a base de quase todas as distancias abaixo; o "item a x b" e a celula.
 *    NFPA 30 — tanques de liquido inflamavel (tolueno e classe IB).
 *    As tabelas de referencia do setor (GAP.2.5.2, CCPS "Guidelines for
 *    Siting and Layout of Facilities") sao pagas e nao foram consultadas.
 *    A CONFIRMAR com a bibliografia da disciplina e com NR-20 / ABNT NBR 17505.
 * ============================================================================
 */

import { LAJE_PROPOSTA, CORREDORES_PROPOSTOS } from './arranjo-proposto.js';
import { arco } from '../lib/plano.js';

/* ----------------------------------------------------------------------------
 *  VENTO PREDOMINANTE — de SUDESTE
 *  Estacao Experimental de Campinas, 1956-2004: 37,5 % das observacoes de SE,
 *  2,3 m/s em media; de maio a julho aparece vento de S (disturbios de leste).
 *  MP-SP: na RMC os ventos predominantes sao do quadrante leste a sul.
 *  `de` e o azimute de onde o vento VEM, em graus a partir do norte, horario.
 * ------------------------------------------------------------------------- */
export const VENTO = {
  de: 135,
  rotulo: 'SE',
  secundario: { de: 180, rotulo: 'S', quando: 'maio a julho' },
};

/** Vetor unitario (x, z) apontando PARA onde o vento vem. */
export function vetorBarlavento(azimute = VENTO.de) {
  const a = (azimute * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/* ----------------------------------------------------------------------------
 *  TERRENO
 *  Cercado: 225 x 254 m, 5,7 ha. O tamanho saiu das distancias, e nao o
 *  contrario: 60 m do processo ao limite a oeste, 15 m dos tanques ao limite
 *  ao norte, e a faixa de pessoas ao sul a 60 m do processo. Na Fase 13 o
 *  estacionamento e o retorno do onibus entraram na cerca, e a cerca do sul
 *  passa pela linha das cancelas da portaria (pedido do autor, 26/10).
 * ------------------------------------------------------------------------- */
export const LOTE = { x: [-80, 145], z: [-126, 128] };

/* ----------------------------------------------------------------------------
 *  BLOCOS
 *  categoria decide cor, regras de distancia e de vento:
 *    processo   area de processo (ISBL) — a laje onde estao os equipamentos
 *    tanques    parque de tanques de liquido inflamavel, com bacia de contencao
 *    carga      descarga de caminhao-tanque de tolueno
 *    utilidade  fontes de ignicao: caldeira, subestacao
 *    torre      torre de resfriamento
 *    incendio   agua de incendio e casa de bombas
 *    controle   sala de controle
 *    apoio      laboratorio, oficina, armazem de produto
 *    ocupado    predios com gente o dia todo
 *    efluentes  tratamento de efluentes
 *    estacionamento, verde, encontro
 * ------------------------------------------------------------------------- */
export const BLOCOS = [
  // --- processo: o limite e a laje do arranjo (Fase 11, arranjo-proposto.js) ---
  { id: 'ISBL', nome: 'Área de processo', categoria: 'processo', x: LAJE_PROPOSTA.x, z: LAJE_PROPOSTA.z },

  /* --- parque de tanques: tolueno de reposicao + purga ---
   * Tolueno S-30 = 1 656 kg/h; 15 dias de autonomia = 596 t ~ 690 m³ -> dois
   * tanques de 377 m³ (Ø 8 x 7,5 m). Purga S-27 = 132 kg/h x 15 dias ~ 55 m³
   * -> um de Ø 4 x 4,5 m. Bacia: tem de reter o maior tanque (NFPA 30):
   *   (40 x 31 - 113 m² de tanques) x h >= 377 m³  ->  h >= 0,34 m; adotado 1,0 m. */
  { id: 'TANQUES', nome: 'Parque de tanques (tolueno e purga)', rotulo: 'Tanques', categoria: 'tanques', x: [-60, -20], z: [-110, -79] },
  { id: 'DESCARGA', nome: 'Descarga de caminhão-tanque', rotulo: 'Descarga', categoria: 'carga', x: [30, 50], z: [-104, -92] },

  // --- utilidades e servicos de processo ---
  { id: 'TORRE', nome: 'Torre de resfriamento', rotulo: 'Torre', categoria: 'torre', x: [8, 22], z: [-42, -34] },
  /* Agua (Fase 13, balanco em agua.js): ETA de 12 m³/h ao lado da torre, que
   * leva 92 % da agua tratada; ETE onde a drenagem da laje chega por
   * gravidade. Bloco = pecas da conta (reservatorio de Ø 7 m, filtros,
   * abrandador, casa de quimica; equalizacao de 130 m³, separador, biologico,
   * decantador, leito de secagem) com 2 m de circulacao em volta. */
  // entre a calcada da lig-norte e a via principal; recua do canto da via
  // norte para caber a esquina arredondada dela
  { id: 'ETA', nome: 'Tratamento de água', rotulo: 'ETA', categoria: 'agua', x: [36.5, 53.5], z: [-60, -36] },
  { id: 'ETE', nome: 'Tratamento de efluentes', rotulo: 'ETE', categoria: 'efluentes', x: [-62, -36], z: [0, 20] },
  { id: 'CALDEIRA', nome: 'Caldeira e ar comprimido', rotulo: 'Caldeira', categoria: 'utilidade', x: [70, 86], z: [-10, 2] },
  { id: 'SUBESTACAO', nome: 'Subestação', categoria: 'utilidade', x: [70, 84], z: [6, 16] },
  { id: 'INCENDIO', nome: 'Água de incêndio', rotulo: 'Incêndio', categoria: 'incendio', x: [70, 84], z: [-33, -19] },
  { id: 'BOMBAS-INC', nome: 'Casa de bombas de incêndio', rotulo: 'Bombas de incêndio', categoria: 'incendio', x: [86, 94], z: [-30, -22] },

  // --- apoio, a 30 m ou mais do processo ---
  { id: 'CONTROLE', nome: 'Sala de controle', rotulo: 'Controle', categoria: 'controle', x: [0, 20], z: [48, 60] },
  { id: 'LAB', nome: 'Laboratório', categoria: 'apoio', x: [25, 40], z: [48, 58] },
  { id: 'OFICINA', nome: 'Oficina e almoxarifado', rotulo: 'Oficina', categoria: 'apoio', x: [-35, -8], z: [48, 62] },
  { id: 'ARMAZEM', nome: 'Armazém de produto e expedição', rotulo: 'Armazém', categoria: 'apoio', x: [100, 130], z: [25, 50] },

  // --- faixa verde entre a operacao e as pessoas ---
  { id: 'VERDE', nome: 'Faixa verde', categoria: 'verde', x: [-60, 140], z: [66, 74] },

  // --- pessoas: a barlavento, a 60 m ou mais do processo ---
  { id: 'BRIGADA', nome: 'Ambulatório e brigada', rotulo: 'Brigada', categoria: 'ocupado', x: [36, 52], z: [80, 92] },
  // recua 4 m da via principal: a calcada leste passa na frente
  { id: 'ADM', nome: 'Administração', rotulo: 'ADM', categoria: 'ocupado', x: [66, 92], z: [80, 95] },
  { id: 'REFEITORIO', nome: 'Refeitório e vestiário', rotulo: 'Refeitório', categoria: 'ocupado', x: [96, 120], z: [80, 95] },
  /* Portaria (Fase 13, segunda rodada): a ilha entre a pista de entrada e
   * a de saida, com a guarita no meio, como numa entrada de campus. Detalhe
   * em PRACA_PORTARIA, mais abaixo. */
  { id: 'PORTARIA', nome: 'Portaria', categoria: 'ocupado', x: [56, 60], z: [118, 133], naDivisa: true },

  /* --- estacionamento: dentro da cerca, depois da portaria (Fase 13) ---
   * 38 vagas (a borda leste e a passagem da calcada, entorno.js VAGA); o
   * corredor das vagas e o eixo da via que vem da portaria. A
   * borda leste fica 6 m antes da pista de saida: e a esquina arredondada do
   * carro que sai do estacionamento para a portaria. */
  { id: 'ESTAC', nome: 'Estacionamento', categoria: 'estacionamento', x: [-7, 45], z: [101, 125] },

  /* --- pontos de encontro ---
   * O principal fica a barlavento do vento predominante (SE). O alternativo,
   * a sudoeste, continua a barlavento quando o vento vira de S (maio a julho). */
  { id: 'ENCONTRO-1', nome: 'Ponto de encontro', categoria: 'encontro', x: [125, 140], z: [85, 98] },
  { id: 'ENCONTRO-2', nome: 'Ponto de encontro alternativo', categoria: 'encontro', x: [-75, -62], z: [45, 58] },
];

/* ----------------------------------------------------------------------------
 *  TANQUES do parque (posicao do centro e diametro), para a regra de
 *  espacamento entre costados. Viram geometria na Fase 7.
 * ------------------------------------------------------------------------- */
export const TANQUES = [
  { id: 'TQ-01', servico: 'Tolueno de reposição', x: -50, z: -94.5, D: 8, H: 7.5 },
  { id: 'TQ-02', servico: 'Tolueno de reposição', x: -35, z: -94.5, D: 8, H: 7.5 },
  { id: 'TQ-03', servico: 'Purga (S-27)', x: -26, z: -90, D: 4, H: 4.5 },
];

/* ----------------------------------------------------------------------------
 *  VIAS (eixo + largura)
 *    principal  via interna de circulacao — tem distancia minima a processo
 *               e tanques (BN-DS-C69, item 11)
 *    acesso     acesso de bombeiro e manutencao, encostado nos blocos
 *    servico    caminhoes; nunca cruza calcada nem area de pessoas
 *    publica    fora do lote
 * ------------------------------------------------------------------------- */
/* Anel em volta do processo: eixo a 6 m da laje (3 m de acostamento, onde
 * correm os pipeways, e meia via). Acompanha a laje, e as ligacoes saem dele. */
const [lx0, lx1] = LAJE_PROPOSTA.x;
const [lz0, lz1] = LAJE_PROPOSTA.z;
const A0 = lx0 - 6, A1 = lx1 + 6, AN = lz0 - 6, AS = lz1 + 6;
// via publica leste: 22 m a leste da cerca, para as curvas dos caminhoes
// ficarem fora dela
const XL = 167;

/* ----------------------------------------------------------------------------
 *  VEICULOS DE PROJETO — DNIT, Manual de Projeto de Intersecoes (2005),
 *  tabela dos veiculos de projeto [A CONFIRMAR: valores de memoria da
 *  tabela, a mesma base da AASHTO]. Largura, distancia entre eixos e os
 *  raios minimos de giro (roda dianteira externa, roda traseira interna).
 *    carro     VP
 *    caminhao  CO — caminhao-tanque, de produto e de bombeiro
 *    onibus    O  — onibus de 12,2 m
 *  Raio da esquina (meio-fio) pelo menor veiculo que faz a curva ali
 *  [ADOTADO]: 3 m para carro, 5 m para caminhao, 6 m para onibus — metade
 *  do da Fase 13 (6/10/12 m, ordem de grandeza de projeto urbano), pedido do
 *  o autor (27/10): arredondado demais. Com 3 a 6 m, o caminhao e o onibus
 *  viram devagar usando parte da outra faixa — o que a portaria e o
 *  cruzamento de 15 km/h comportam. As curvas de acesso (`curva`) seguem
 *  medidas pelo veiculo na regra CURVA.
 * ------------------------------------------------------------------------- */
export const VEICULOS = {
  carro: { nome: 'VP', largura: 2.1, entreEixos: 3.4, raioExterno: 7.3, raioInterno: 4.7, esquina: 3 },
  caminhao: { nome: 'CO', largura: 2.6, entreEixos: 6.1, raioExterno: 12.8, raioInterno: 8.7, esquina: 5 },
  onibus: { nome: 'O', largura: 2.6, entreEixos: 7.6, raioExterno: 12.8, raioInterno: 7.1, esquina: 6 },
};
export const FONTE_VEICULOS = 'DNIT, Manual de Projeto de Interseções (2005) — a confirmar';

/* Trafego (Fase 19). Mao de direcao: do eixo da via ao eixo do veiculo
 * [ADOTADO, Fase 3]. Giro do caminhao: o eixo dele, no giro minimo do CO,
 * passa a meia largura da roda traseira de dentro — 8,7 + 1,3 = 10 m; e o
 * raio das manobras e das curvas que os percursos fazem [ADOTADO]. */
export const FAIXA_VEICULO = 1.6;
export const GIRO_CAMINHAO = VEICULOS.caminhao.raioInterno + VEICULOS.caminhao.largura / 2;
export const COMPRIMENTO_CAMINHAO = 10;            // o bau (lib/ambiente.js), o maior dos dois

/* Esquina com raio diferente da regra, sempre com o motivo (como o desvio de
 * rota em rotas.js). `em` e o canto, onde as bordas das duas vias se cruzam. */
export const ESQUINAS = [
  { em: [58 + 3.5, 113 - 3.5], r: 3,
    motivo: 'nenhum veículo grande vira ali: o ônibus volta pela pista de saída e o bombeiro segue pela principal' },
];

/* ----------------------------------------------------------------------------
 *  VIA PUBLICA E ACESSO (Fase 13, segunda rodada)
 *  Sem curva de 90°: quem entra sai da via publica por uma faixa de
 *  desaceleracao paralela a ela e faz uma curva de 14 m de raio; quem sai
 *  faz a mesma curva e entra numa faixa de aceleracao. Comprimentos
 *  [ESTIMADO] pela cinematica, enquanto a tabela do DNIT nao e conferida:
 *    desaceleracao  de 40 para 20 km/h a 2,0 m/s²: (11,1² - 5,6²)/4 = 23 m
 *                   -> 25 m, mais 15 m de transicao
 *    aceleracao     de 15 para 40 km/h a 1,0 m/s² (onibus carregado):
 *                   (11,1² - 4,2²)/2 = 53 m -> 55 m, mais 15 m de transicao
 *  Pistas da portaria de 5 m: o onibus numa curva de 14 m varre
 *  2,6 + 7,6²/(2 x 14) = 4,7 m.
 * ------------------------------------------------------------------------- */
const ZP = 155;                                    // eixo da via publica (12 m)
const BORDA_PUB = ZP - 6;
const PISTA = 5;                                   // largura das pistas da portaria
const RC = 14;                                     // raio do eixo das curvas de acesso
const ZF = LOTE.z[1];                              // cerca = linha das cancelas
const zFaixa = BORDA_PUB - PISTA / 2;              // eixo das faixas de desaceleracao/aceleracao
const xEnt = 62.5, xSai = 53.5;                    // eixos das pistas de entrada e de saida
const cEnt = [xEnt + RC, zFaixa - RC];             // centros das curvas
const cSai = [xSai - RC, zFaixa - RC];
export const ACESSO = {
  desaceleracao: { comprimento: 25, transicao: 15, de: 40, para: 20, taxa: 2.0 },
  aceleracao: { comprimento: 55, transicao: 15, de: 15, para: 40, taxa: 1.0 },
  raio: RC, pista: PISTA,
};

/* ----------------------------------------------------------------------------
 *  PRACA DA PORTARIA — uma ilha entre a pista de entrada e a de saida, com
 *  a guarita envidracada no meio (visao de 360°, para quem chega e quem
 *  sai), uma cancela em cada pista, ao lado dela, e a cobertura sobre as
 *  duas pistas, a ilha e as calcadas, como numa praca de pedagio. A cerca
 *  passa pela linha das cancelas; o pedestre entra pela catraca, na calcada
 *  de cada lado, debaixo da cobertura e a vista do porteiro.
 *    fila  antes da cancela cabe um onibus ou dois carros fora da via
 *          publica: 15 m [ADOTADO]
 *    cobertura  altura livre de 5,0 m: acima dos 4,5 m da IT 06 do CBPMESP
 *          (a mesma do pipeway) [ADOTADO]
 * ------------------------------------------------------------------------- */
export const PRACA_PORTARIA = {
  ilha: { x: [56, 60], z: [118, 133] },
  guarita: { x: [56.75, 59.25], z: [ZF - 1.5, ZF + 1.5] },
  cancelas: [
    { pista: 'entrada', x: 60, z: ZF, comprimento: PISTA, sentido: 1 },
    { pista: 'saida', x: 56, z: ZF, comprimento: PISTA, sentido: -1 },
  ],
  cobertura: { x: [47.5, 68.5], z: [ZF - 6, ZF + 6], alturaLivre: 5.0 },
  fila: 15,
};

/* ----------------------------------------------------------------------------
 *  ONIBUS DOS OPERARIOS
 *  Entra pela portaria, vira a leste no cruzamento logo depois dela e da a
 *  volta num retorno circular; na volta para na baia, do lado norte, fora da
 *  faixa — com o abrigo coberto de frente para o vestiario. De manha
 *  desembarca ali; no fim do turno quem vai embora espera no abrigo. Sai
 *  pelo mesmo caminho.
 *  Retorno: eixo de 10 m e 7 m de pista — borda externa de 13,5 m e ilha de
 *  6,5 m, contra 12,8 e 7,1 m do veiculo O, com 0,5 m de folga.
 *  Abrigo para um onibus cheio, ~40 pessoas em pe ou sentadas: 12 x 2,85 m
 *  [ADOTADO].
 * ------------------------------------------------------------------------- */
const zJ = 113;                                    // cruzamento depois da portaria
const RETORNO = { x: 130, z: zJ, raio: 10, largura: 7 };
// O caminho do abrigo ao vestiario sai em linha reta para a porta dele (no
// meio da fachada sul); o abrigo fica logo a oeste do caminho, e a baia, de
// 24 m, com o onibus parado em frente ao abrigo.
const refeitorio = BLOCOS.find((b) => b.id === 'REFEITORIO');
const xVest = (refeitorio.x[0] + refeitorio.x[1]) / 2;
const ABRIGO_X = [xVest - 1.5 - 12, xVest - 1.5];
const BAIA = { x: [(ABRIGO_X[0] + ABRIGO_X[1]) / 2 - 8.5, (ABRIGO_X[0] + ABRIGO_X[1]) / 2 + 15.5], largura: 3 };
const zBaia = zJ - 7 / 2 - BAIA.largura / 2;

/** Poligono de 32 lados no eixo do retorno, fechado, comecando a oeste. */
function circulo({ x, z, raio }, n = 32) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI + (i / n) * Math.PI * 2;
    return [+(x + raio * Math.cos(a)).toFixed(3), +(z - raio * Math.sin(a)).toFixed(3)];
  });
}

const parada = [(ABRIGO_X[0] + ABRIGO_X[1]) / 2, zBaia];
export const ONIBUS = {
  veiculo: VEICULOS.onibus,
  folga: 0.5,
  retorno: RETORNO,
  parada,
  abrigo: { x: ABRIGO_X, z: [zBaia - 1.5 - 0.15 - 2 - 2.85, zBaia - 1.5 - 0.15 - 2], capacidade: 40 },
  // da via publica pela faixa de desaceleracao, a portaria, o retorno, a baia
  // e de volta pela faixa de aceleracao (eixos de via)
  rota: [
    [150, ZP - 3], [xEnt + RC + 40, BORDA_PUB], [xEnt + RC + 25, zFaixa],
    ...arco(cEnt[0], cEnt[1], RC, 90, 180), [xEnt, zJ],
    [RETORNO.x - RETORNO.raio, zJ], ...circulo(RETORNO).slice(1),
    [BAIA.x[1], zJ - 1.75], [BAIA.x[1] - 4, zBaia], [BAIA.x[0] + 4, zBaia], [BAIA.x[0] - 2, zJ - 1.75],
    [58, zJ - 1.75], [xSai, zJ],
    ...arco(cSai[0], cSai[1], RC, 0, 90), [xSai - RC - 55, zFaixa], [xSai - RC - 70, BORDA_PUB], [-60, ZP - 3],
  ],
};

export const VIAS = [
  // anel de acesso em volta do processo — bombeiro chega pelos quatro lados
  { id: 'anel-processo', tipo: 'acesso', largura: 6,
    pontos: [[A0, AN], [A1, AN], [A1, AS], [A0, AS], [A0, AN]] },
  // anel em volta do parque de tanques
  { id: 'anel-tanques', tipo: 'acesso', largura: 6,
    pontos: [[-10, -70], [-10, -118], [-68, -118], [-68, -70], [-10, -70]] },
  // via principal norte-sul, a leste do processo, do cruzamento da portaria
  // ate o norte
  { id: 'principal', tipo: 'principal', largura: 7, pontos: [[58, -70], [58, zJ]] },
  // portaria: pistas de entrada e de saida em volta da ilha, com as curvas e
  // as faixas de desaceleracao e de aceleracao na via publica
  { id: 'desaceleracao', tipo: 'publica', largura: PISTA, veiculo: 'onibus',
    pontos: [[xEnt + RC + 40, BORDA_PUB], [xEnt + RC + 25, zFaixa], [cEnt[0], zFaixa]] },
  { id: 'entrada', tipo: 'principal', largura: PISTA, veiculo: 'onibus',
    pontos: [...arco(cEnt[0], cEnt[1], RC, 90, 180), [xEnt, zJ]], curva: { centro: cEnt, raio: RC } },
  { id: 'saida', tipo: 'principal', largura: PISTA, veiculo: 'onibus',
    pontos: [[xSai, zJ], ...arco(cSai[0], cSai[1], RC, 0, 90)], curva: { centro: cSai, raio: RC } },
  { id: 'aceleracao', tipo: 'publica', largura: PISTA, veiculo: 'onibus',
    pontos: [[cSai[0], zFaixa], [cSai[0] - 55, zFaixa], [cSai[0] - 70, BORDA_PUB]] },
  // ligacoes do anel do processo
  { id: 'lig-leste', tipo: 'acesso', largura: 6, pontos: [[A1, 0], [58, 0]] },
  { id: 'lig-norte', tipo: 'acesso', largura: 6, pontos: [[A1, AN], [A1, -70]] },
  { id: 'lig-ete', tipo: 'acesso', largura: 5, pontos: [[A0, 1.5], [-36, 1.5]] },
  // depois da portaria: estacionamento a oeste (entra no corredor das vagas)
  // e onibus a leste, no mesmo cruzamento
  // ate 3 m dentro do bloco: a calcada da portaria cruza a entrada a 1 m
  // da borda dele, e o cruzamento tem de cair na via para virar travessia
  // (Fase 28: era calcada na pista do carro, sem faixa)
  { id: 'estacionamento', tipo: 'acesso', largura: 6, veiculo: 'carro', pontos: [[58, zJ], [BLOCOS.find((b) => b.id === 'ESTAC').x[1] - 3, zJ]] },
  { id: 'onibus', tipo: 'acesso', largura: 7, veiculo: 'onibus', pontos: [[58, zJ], [RETORNO.x - RETORNO.raio, zJ]] },
  { id: 'retorno-onibus', tipo: 'acesso', largura: RETORNO.largura, veiculo: 'onibus', pontos: circulo(RETORNO),
    circulo: RETORNO, curva: { centro: [RETORNO.x, RETORNO.z], raio: RETORNO.raio } },
  { id: 'baia-onibus', tipo: 'acesso', largura: BAIA.largura, veiculo: 'onibus', pontos: [[BAIA.x[0], zBaia], [BAIA.x[1], zBaia]] },
  // via da faixa de apoio
  { id: 'apoio', tipo: 'acesso', largura: 6, pontos: [[-45, 40], [58, 40]] },
  // ligacao norte entre a via principal e o anel dos tanques
  { id: 'norte', tipo: 'acesso', largura: 7, pontos: [[-10, -70], [58, -70]] },
  /* servico: da via publica leste, por uma curva de 15 m fora da cerca, ao
   * portao e a descarga de tolueno; o caminhao CO varre 2,6 + 6,1²/30 =
   * 3,8 m na curva, numa pista de 7 m */
  { id: 'servico-tolueno', tipo: 'servico', largura: 7,
    pontos: [...arco(XL - 15, -70 + 15, 15, 0, -90), [58, -70]], curva: { centro: [XL - 15, -55], raio: 15 } },
  { id: 'servico-descarga', tipo: 'servico', largura: 7, pontos: [[40, -70], [40, -92]] },
  // servico: portao de expedicao -> doca do armazem, pela mesma curva
  { id: 'servico-expedicao', tipo: 'servico', largura: 7,
    pontos: [...arco(XL - 15, 37 + 15, 15, 0, -90), [130, 37]], curva: { centro: [XL - 15, 52], raio: 15 } },
  // patio de manobra do armazem (Fase 19): o caminhao de produto entra de
  // frente virando para o norte e volta de re em arco ate o portao. Cabe
  // entre o armazem e a cerca (15 m), do eixo da faixa dele ate a frente do
  // caminhao virado para o norte, um giro adiante (data/ambiente.js)
  ((x0, x1, zSul) => {
    const zNorte = zSul - FAIXA_VEICULO - GIRO_CAMINHAO - COMPRIMENTO_CAMINHAO / 2 - 1;
    return { id: 'patio-expedicao', tipo: 'servico', largura: zSul - zNorte, patio: true, pontos: [[x0, (zSul + zNorte) / 2], [x1, (zSul + zNorte) / 2]] };
  })(130, 145, 37),
  // fora do lote
  { id: 'publica', tipo: 'publica', largura: 12, pontos: [[-100, ZP], [190, ZP]] },
  { id: 'publica-leste', tipo: 'publica', largura: 9, pontos: [[XL, BORDA_PUB], [XL, -76]] },
];

export const PORTOES = [
  // a abertura e a praca inteira: a barreira sao as cancelas, a guarita e
  // as catracas (Fase 15), e nao uma folha de portao
  { id: 'principal', nome: 'Portaria', x: 58, z: ZF, uso: 'carros, ônibus e pedestres',
    largura: PRACA_PORTARIA.cobertura.x[1] - PRACA_PORTARIA.cobertura.x[0], folha: false },
  { id: 'servico', nome: 'Portão de serviço', x: 145, z: -70, uso: 'caminhão-tanque de tolueno' },
  { id: 'expedicao', nome: 'Portão de expedição', x: 145, z: 37, uso: 'caminhões de produto' },
];

/* ----------------------------------------------------------------------------
 *  CIRCULACAO
 *  Calcadas e rotas de caminhao como polilinhas. A auditoria confere que
 *  nenhuma rota de caminhao cruza calcada nem entra em area de pessoas, que
 *  a calcada so cruza via (nunca corre nela), que a rede e uma so e chega a
 *  cada bloco, que o caminho por ela nao e muito mais longo que a reta e
 *  que calcada ao lado de via fica encostada no meio-fio.
 *
 *  Como na cidade (segunda rodada): a calcada encosta no meio-fio, com 2 m —
 *  0,70 m de faixa de servico junto do meio-fio (poste, placa, hidrante) e
 *  1,30 m de faixa livre (NBR 9050:2020: servico >= 0,70 m e livre >= 1,20
 *  m, 1,50 m recomendado). Onde nao ha via, caminho calcado pelo gramado.
 *  As esquinas ficam com canto vivo aqui; a Fase 14 as arredonda junto com
 *  as da via.
 * ------------------------------------------------------------------------- */
export const LARGURA_CALCADA = 2;
export const MEIO_FIO_LARGURA = 0.15;
/** Afastamento do eixo de uma via de largura w ao eixo da calcada encostada nela. */
const junto = (w) => w / 2 + MEIO_FIO_LARGURA + LARGURA_CALCADA / 2;
const cSul = CORREDORES_PROPOSTOS.find((c) => c.fileira === 'sul');
const xCorredorSul = (cSul.x[0] + cSul.x[1]) / 2;
// rampa de pedestre ao norte: o corredor do reator (o mais largo), com a
// calcada no lado oeste dele — o pe do pipeway da torre fica a leste
const cNorte = [...CORREDORES_PROPOSTOS].filter((c) => c.fileira === 'norte')
  .sort((a, b) => (b.x[1] - b.x[0]) - (a.x[1] - a.x[0]))[0];
const xCorredorNorte = cNorte.x[0] + 0.5;
const xL = 58 + junto(7), xW = 58 - junto(7);      // dos dois lados da via principal
const xEntL = xEnt + junto(PISTA), xSaiW = xSai - junto(PISTA);
const zPub = zFaixa - junto(PISTA);                // calcada publica, atras das faixas
const rCalc = RC - junto(PISTA);                   // calcada por dentro das curvas
const zAnelS = AS + junto(6);
const xLigN = A1 + junto(6);
const zNorteS = -70 + junto(7), zNorteN = -70 - junto(7);
const xAnelTq = -10 + junto(6);
const zApoio = 40 + junto(6);
const zOnibusN = zJ - junto(7), zEstacN = zJ - junto(6);
const zOnibusS = zJ + junto(7), zEstacS = zJ + junto(6);
const ESTAC_X1 = 45;                               // borda leste do estacionamento (BLOCOS)
// travessia da via do onibus: depois da esquina de 12 m (borda da pista de
// entrada + 12) e mais 1,5 m
const xTravOnibus = xEnt + PISTA / 2 + VEICULOS.onibus.esquina + 1.5;
// via norte: depois da esquina de 10 m com o anel dos tanques (-10 + 3 + 10)
const xTravNorte = -10 + 3 + VEICULOS.caminhao.esquina + 1.5;
// via de apoio e principal: fora da esquina de 10 m entre elas
const zApoioN = 40 - junto(6);
const xTravApoio = 58 - 3.5 - VEICULOS.caminhao.esquina - 1.5;
const zTravApoio = 40 - 3 - VEICULOS.caminhao.esquina - 1.5;
// caminho 3 m ao sul da torre: longe do anel (mais de 8 m, a regra SOLTA)
// e fora da esquina da lig-norte com ele
const zSulTorre = BLOCOS.find((b) => b.id === 'TORRE').z[1] + 3 + LARGURA_CALCADA / 2;
const zBaiaN = zBaia - junto(BAIA.largura);
const zTorre = -33;                                // 1 m antes da torre
const zBacia = -94.5;                              // escada leste da bacia
// Fase 28 (rede de pedestres): pontos tirados dos blocos e das vias, nao
// digitados — a frente dos predios, a ligacao das utilidades e a ETA
const zFrente = 97;                                // calcada da frente dos predios
const zUtilidades = -17;                           // caminho das utilidades, da principal
const zArmazem = 40;                               // caminho do armazem, da principal
const blocoEta = BLOCOS.find((b) => b.id === 'ETA');
const zEta = (blocoEta.z[0] + blocoEta.z[1]) / 2;  // meio do lado oeste da ETA
// volta do dique por dentro do anel dos tanques, encostada no meio-fio, pelo
// sul: liga a escada oeste (ate aqui sem calcada) a leste. Pelo norte, a
// linha 27 desce do pipeway e corre a 1,4 m colada nela
const anelTq = VIAS.find((v) => v.id === 'anel-tanques').pontos;
const xAnelL = Math.max(...anelTq.map((q) => q[0])), xAnelO = Math.min(...anelTq.map((q) => q[0]));
const zAnelTqS = Math.min(...anelTq.map((q) => q[1]));
const blocoTq = BLOCOS.find((b) => b.id === 'TANQUES');

export const CALCADAS = [
  // --- portaria: da calcada publica, por dentro da curva, catraca debaixo
  // da cobertura, e ao longo da via principal ate as utilidades ---
  // A travessia fica fora do arredondamento da esquina (onde a calcada o
  // contorna, Fase 14): a da via do onibus passa 1,5 m alem da esquina de
  // 12 m do onibus; a do estacionamento, dentro dele, no corredor das vagas.
  { id: 'portaria-leste', pontos: [[cEnt[0] + 25, zPub], ...arco(cEnt[0], cEnt[1], rCalc, 90, 180),
    [xEntL, zOnibusS], [xTravOnibus, zOnibusS], [xTravOnibus, zOnibusN]] },
  { id: 'portaria-oeste', pontos: [[cSai[0] - 55, zPub], ...arco(cSai[0], cSai[1], rCalc, 90, 0),
    [xSaiW, zEstacS], [ESTAC_X1 - 1, zEstacS], [ESTAC_X1 - 1, zEstacN], [xW, zEstacN], [xW, zApoio]] },
  // ate o caminho das utilidades (Fase 28: o trecho ate -30 nao chegava a nada)
  { id: 'principal-leste', pontos: [[xL, zOnibusN], [xL, zUtilidades]] },
  // --- onibus: ao longo da via e da baia, e do abrigo ao vestiario ---
  { id: 'onibus-norte', pontos: [[xL, zOnibusN], [BAIA.x[0] - 2.5, zOnibusN], [BAIA.x[0] - 2.5, zBaiaN],
    [xVest, zBaiaN]] },
  // da travessia da via do onibus direto a frente da administracao
  { id: 'adm', caminho: true, pontos: [[xTravOnibus, zOnibusN], [xTravOnibus, 97]] },
  { id: 'vestiario', caminho: true, pontos: [[xVest, zBaiaN], [xVest, 95]] },
  // --- frente e fundo dos predios ---
  { id: 'frente-predios', caminho: true, pontos: [[30, zFrente], [124, zFrente]] },
  // do abrigo do onibus, entre a ADM e o refeitorio, a frente dos predios
  // e ao armazem (Fase 28: do abrigo a porta da ADM eram 51 m pela calcada
  // contra 23,5 em linha reta; a do armazem, 147 contra 65)
  // A borda dele encosta na do abrigo: no eixo da ponta do abrigo, o
  // piso dos dois brigava na mesma altura (z-fighting).
  { id: 'abrigo-armazem', caminho: true, pontos: [[ABRIGO_X[0] - LARGURA_CALCADA / 2, zBaiaN], [ABRIGO_X[0] - LARGURA_CALCADA / 2, zArmazem]] },
  { id: 'predios-apoio', caminho: true, pontos: [[30, 97], [30, 64]] },
  // ate a calcada oeste da principal (Fase 28: parava a 11 m dela)
  { id: 'frente-apoio', caminho: true, pontos: [[-62, 64], [xW, 64]] },
  { id: 'apoio-sul', pontos: [[-40, zApoio], [xW, zApoio]] },
  // para o norte: cruza a via de apoio antes da esquina dela, segue pela
  // borda norte e pela principal e atravessa 1,5 m depois da esquina de 10 m
  { id: 'travessia-apoio', pontos: [[xTravApoio, zApoio], [xTravApoio, zApoioN], [xW, zApoioN],
    [xW, zTravApoio], [xL, zTravApoio]] },
  { id: 'controle-lab', caminho: true, pontos: [[22.5, zApoio], [22.5, 64]] },
  // chega a laje no primeiro corredor transversal do sul (rampa de pedestre);
  // cruza a via de apoio e o anel: travessias
  // para a 1 m da laje: a ponta quadrada da calcada encosta na borda dela
  { id: 'apoio-processo', caminho: true, pontos: [[xCorredorSul, zApoio], [xCorredorSul, lz1 + 1]] },
  // ao longo do anel, pelo sul, ate a ETE
  { id: 'processo-ete', pontos: [[xCorredorSul, zAnelS], [-40, zAnelS]] },
  { id: 'ete', caminho: true, pontos: [[-40, 64], [-40, 21]] },
  // --- utilidades a leste e o armazem ---
  { id: 'utilidades', caminho: true, pontos: [[xL, zUtilidades], [90, zUtilidades]] },
  // a porta da casa da caldeira, do lado da via principal
  { id: 'caldeira', caminho: true, pontos: [[xL, -4], [69, -4]] },
  { id: 'armazem', caminho: true, pontos: [[xL, zArmazem], [99, zArmazem]] },
  // --- ao norte: da rampa do reator a torre; ao sul da torre ate a
  // lig-norte (cruzando-a fora da esquina dela com o anel) e a ETA; e pelo
  // gramado ate a via norte, os tanques e a descarga ---
  { id: 'processo-norte', caminho: true, pontos: [[xCorredorNorte, lz0 - 1], [xCorredorNorte, zTorre]] },
  // ate o meio do lado oeste da ETA (Fase 28: seguia 8 m alem, ate nada)
  { id: 'torre-eta', caminho: true, pontos: [[0, zSulTorre], [xLigN, zSulTorre], [xLigN, zEta]] },
  { id: 'tanques', pontos: [[0, zSulTorre], [0, zNorteS], [xTravNorte, zNorteS], [xTravNorte, zNorteN],
    [xAnelTq, zNorteN], [xAnelTq, -98], [29, -98]] },
  { id: 'bacia', caminho: true, pontos: [[xAnelTq, zBacia], [-18.5, zBacia]] },
  // volta do dique por dentro do anel, pelo sul, no meio-fio, ate 1 m da
  // escada oeste
  { id: 'dique', pontos: [[xAnelL - junto(6), zBacia], [xAnelL - junto(6), zAnelTqS + junto(6)],
    [xAnelO + junto(6), zAnelTqS + junto(6)], [xAnelO + junto(6), zBacia], [blocoTq.x[0] - 1, zBacia]] },
];

// a catraca de cada lado da portaria, na calcada, na linha da cerca
PRACA_PORTARIA.catracas = [[xSaiW, ZF], [xEntL, ZF]];
// o caminho pintado do ponto de onibus ate a porta do vestiario
ONIBUS.caminho = CALCADAS.find((c) => c.id === 'vestiario').pontos;

/* Travessia elevada [ADOTADO, CONTRAN Res. 738/2018 — conferir se a Res.
 * 973/2022 a substituiu]: plataforma na altura da calcada (ate 15 cm) com 5
 * a 7 m na direcao do trafego e rampas de 5 a 10 %. Toda calcada que cruza
 * via cruza por uma; a posicao sai do cruzamento (auditoria e Fase 14). */
export const TRAVESSIA = { plataforma: 5, altura: 0.15, rampa: 1.5 };

/* Chao do que nao e bloco, via nem calcada [ADOTADO]: gramado, menos a
 * faixa de brita em volta do que pega fogo (sem vegetacao a menos de 15 m
 * de processo, tanques e descarga — a mesma regra das arvores) e um
 * contorno de brita nas utilidades. */
export const CHAO = {
  padrao: 'grama',
  // piso: o proprio piso de brita do bloco se estende a faixa (site/
  // implantacao.js) — sem placa de brita por baixo e sem o degrau entre elas
  brita: [
    { categorias: ['processo', 'tanques', 'carga'], faixa: 15 },
    { categorias: ['incendio', 'torre'], faixa: 3 },
    { categorias: ['utilidade', 'agua', 'efluentes'], faixa: 3, piso: true },
  ],
};

/* Rede de pedestres: o que a auditoria mede.
 *   alcance  todo bloco destas categorias a ate tantos metros de calcada
 *            [ADOTADO]: a porta fica do lado dela
 *   fator    caminho por calcada contra a reta, nos pares abaixo [ADOTADO]:
 *            numa rede em grade o pior caso e raiz de 2; ou ate `sobra` m a
 *            mais, para os pares perto */
export const REDE_PEDESTRE = {
  largura: LARGURA_CALCADA, faixaLivre: 1.2,
  alcance: 10,
  categorias: ['processo', 'tanques', 'carga', 'utilidade', 'torre', 'incendio', 'controle', 'apoio',
    'ocupado', 'efluentes', 'agua', 'estacionamento', 'encontro'],
  fator: 1.5, sobra: 15,
  // a laje liga as calcadas que chegam nela: anda-se pelos corredores
  conectores: ['ISBL'],
  // calcada ao lado de via, paralela a menos de `solta` m, encosta nela
  solta: 8,
  // pontos que nao sao bloco: o ponto de onibus e a catraca da portaria
  pontos: { onibus: parada, catraca: [xEntL, ZF] },
  // calcada pode passar no estacionamento (o pedestre cruza o corredor das vagas)
  blocosDePassagem: ['verde', 'estacionamento'],
  pares: [
    ['catraca', 'ADM'], ['onibus', 'REFEITORIO'], ['ESTAC', 'ADM'], ['REFEITORIO', 'ISBL'],
    ['CONTROLE', 'ISBL'], ['ISBL', 'TANQUES'], ['ISBL', 'TORRE'], ['ISBL', 'ETE'], ['ISBL', 'ETA'],
    ['CONTROLE', 'CALDEIRA'], ['OFICINA', 'BOMBAS-INC'], ['ADM', 'ENCONTRO-1'], ['OFICINA', 'ENCONTRO-2'],
  ],
};

// No eixo da via publica: com a mao de direcao (FAIXA_VEICULO), o caminhao
// vai pela pista do seu sentido (a 3 m do eixo, ia e voltava pela do oeste)
export const ROTAS_CAMINHAO = [
  { id: 'tolueno', nome: 'Caminhão-tanque de tolueno',
    pontos: [[190, ZP], [XL, ZP], ...arco(XL - 15, -55, 15, 0, -90), [40, -70], [40, -92]] },
  { id: 'produto', nome: 'Caminhão de produto',
    pontos: [[190, ZP], [XL, ZP], ...arco(XL - 15, 52, 15, 0, -90), [130, 37]] },
];

/* ----------------------------------------------------------------------------
 *  DISTANCIAS MINIMAS (de borda a borda, em metros)
 *  `a` e `b` sao categorias de bloco; 'limite' e o limite do lote; 'via:tipo'
 *  e uma via daquele tipo.
 * ------------------------------------------------------------------------- */
export const DISTANCIAS = [
  { a: 'processo', b: 'ocupado', min: 60, fonte: 'BN-DS-C69, item 10 x 1' },
  { a: 'processo', b: 'apoio', min: 30, fonte: 'BN-DS-C69, item 10 x 2' },
  { a: 'processo', b: 'controle', min: 30, fonte: 'BN-DS-C69, equipamento x item 8' },
  { a: 'processo', b: 'utilidade', min: 30, fonte: 'BN-DS-C69, item 10 x 6' },
  { a: 'processo', b: 'torre', min: 15, fonte: 'BN-DS-C69, item 10 x 7' },
  { a: 'processo', b: 'tanques', min: 60, fonte: 'BN-DS-C69, item 10 x 33' },
  { a: 'processo', b: 'carga', min: 45, fonte: 'BN-DS-C69, item 10 x 5' },
  { a: 'processo', b: 'limite', min: 60, fonte: 'BN-DS-C69, item 10 x 12' },
  { a: 'processo', b: 'efluentes', min: 15, fonte: '[ADOTADO] acesso e manutenção' },
  { a: 'processo', b: 'via:principal', min: 15, fonte: 'BN-DS-C69, item 11 x 10' },
  { a: 'tanques', b: 'ocupado', min: 60, fonte: 'BN-DS-C69, item 33 x 1' },
  { a: 'tanques', b: 'apoio', min: 60, fonte: 'BN-DS-C69, item 33 x 2' },
  { a: 'tanques', b: 'controle', min: 60, fonte: 'BN-DS-C69, item 33 x 8' },
  { a: 'tanques', b: 'torre', min: 45, fonte: 'BN-DS-C69, item 33 x 7' },
  { a: 'tanques', b: 'carga', min: 45, fonte: 'BN-DS-C69, item 33 x 5' },
  { a: 'tanques', b: 'via:principal', min: 45, fonte: 'BN-DS-C69, item 33 x 11' },
  // 377 m³ = 99 600 gal: faixa de 50 001 a 100 000 gal da tabela de referencia
  { a: 'tanques', b: 'limite', min: 15.2, fonte: 'NFPA 30, Tabela 22.4.1.1(b): 50 ft' },
  { a: 'carga', b: 'ocupado', min: 60, fonte: 'BN-DS-C69, item 5 x 1' },
  { a: 'torre', b: 'ocupado', min: 30, fonte: 'BN-DS-C69, item 7 x 1' },
  { a: 'torre', b: 'carga', min: 45, fonte: 'BN-DS-C69, item 7 x 5' },
  { a: 'incendio', b: 'carga', min: 45, fonte: 'BN-DS-C69, item 4 x 5' },
  { a: 'incendio', b: 'via:principal', min: 7.5, fonte: 'BN-DS-C69, item 11 x 4' },
  // Carro estacionado e fonte de ignicao e lugar de gente: a mesma distancia
  // do predio ocupado (Fase 13).
  { a: 'estacionamento', b: 'processo', min: 60, fonte: '[ADOTADO] como prédio ocupado (BN-DS-C69, item 10 x 1)' },
  { a: 'estacionamento', b: 'tanques', min: 60, fonte: '[ADOTADO] como prédio ocupado (BN-DS-C69, item 33 x 1)' },
  { a: 'estacionamento', b: 'carga', min: 60, fonte: '[ADOTADO] como prédio ocupado (BN-DS-C69, item 5 x 1)' },
  { a: 'agua', b: 'processo', min: 15, fonte: '[ADOTADO] acesso e manutenção, como a ETE' },
];

/** Costado a costado: 1/6 da soma dos diametros, nunca menos de 0,9 m. */
export const ESPACAMENTO_TANQUES = {
  fracao: 1 / 6, minimo: 0.9, fonte: 'NFPA 30, §22.4.2 (Tabela 22.4.2.1)',
};

/* Regras de vento: o primeiro grupo tem de ficar a barlavento do segundo. */
export const BARLAVENTO = [
  { a: 'ocupado', b: ['processo', 'tanques', 'carga'], motivo: 'vazamento não deriva para onde há gente' },
  { a: 'utilidade', b: ['processo', 'tanques'], motivo: 'vapor inflamável não deriva até a chama ou a faísca' },
  { a: 'estacionamento', b: ['processo', 'tanques', 'carga'], motivo: 'vapor inflamável não deriva até o motor do carro' },
  { a: 'encontro', b: ['processo', 'tanques'], motivo: 'rota de fuga contra o vento', so: 'ENCONTRO-1' },
];

/* Bombeiro chega a estes blocos por pelo menos `lados` lados, por uma via a
 * ate `alcance` m da borda e que cubra metade do lado. [ADOTADO] pratica
 * usual; NFPA 1 trata de acesso de viatura — a confirmar. */
export const ACESSO_BOMBEIRO = { blocos: ['processo', 'tanques'], lados: 2, alcance: 15 };

/* Cotas desenhadas na vista de planta: pares de blocos (ou 'limite'). */
export const COTAS_PLANTA = [
  ['ISBL', 'ADM'], ['ISBL', 'TANQUES'], ['ISBL', 'CALDEIRA'], ['ISBL', 'DESCARGA'],
  ['TANQUES', 'DESCARGA'], ['ISBL', 'CONTROLE'], ['ISBL', 'TORRE'], ['TANQUES', 'TORRE'],
  ['ISBL', 'limite-oeste'], ['TANQUES', 'limite-norte'], ['ISBL', 'ESTAC'], ['ISBL', 'ETA'],
];
