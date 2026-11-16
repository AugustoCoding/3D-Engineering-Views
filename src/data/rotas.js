/**
 * ============================================================================
 *  ROTAS DA TUBULACAO  (Fase 5 do ROTEIRO)
 * ============================================================================
 *
 *  pid.js diz O QUE liga em que; aqui fica POR ONDE, que e decisao da
 *  maquete [ADOTADO]. Cada trecho vai de um bocal (ou no) a outro e e escrito
 *  em passos de isometrico — a linguagem esta no cabecalho de lib/rota.js.
 *  Numero de linha, DN, fluido e material vem de pid.js: aqui nao se repete.
 *
 *  Pontas:
 *    'TAG.BOCAL'      bocal de equipamento (ancora na face do flange)
 *    'NO@+x'          no de tubulacao (valvula de tres vias, te) pela face
 *                     indicada — de onde o tubo sai do no
 *    'LB:leste'       limite de bateria, na faixa da linha no rack
 *    { cabecal: id }  te num cabecal de utilidade (so em RAMAIS)
 *    'DRENO'          funil de dreno fechado no piso, sob o ponto onde se esta
 *
 *  Regras de viabilidade que as rotas seguem (e que tubulacao.js mede):
 *    - liquido so sobe o que a pressao da origem vence; senao ha bomba;
 *    - suspensao desce sempre, sem ponto baixo onde o cristal decante;
 *    - succao de bomba nao faz ponto alto (bolsa de vapor);
 *    - riser alto corre junto a um costado ou a borda do rack, que o guiam;
 *    - trecho horizontal fora do rack ganha apoio a cada vao admissivel.
 * ============================================================================
 */
import { R01, T01 } from './plant.js';
import { BLOCOS, VIAS } from './site.js';
import { VENT } from './arranjo.js';

/* ------------------------------------------------------------------------
 *  Passos que se repetem
 * --------------------------------------------------------------------- */
// Da origem a faixa, por cima. A bomba sob o rack (Fase 11) sobe na propria
// fila de bombas: andar baixo ate a faixa atravessaria o corredor do meio.
const SOBE = ['y:lat', 'z:rack', 'y:rack'];
const DESCE = ['y:lat', 'z:B'];                      // do rack a bocal abaixo da lateral
// Do rack a bocal baixo e longe: desce na borda do rack, que guia o riser,
// e corre baixo ate o bocal — descer 5 m solto no ar nao se sustenta.
const DESCE_NA_BORDA = ['y:lat', 'z:bordaB', 'y:B', 'z:B'];
const ATE_A_BORDA = ['z:bordaA', ...SOBE];          // vai baixo ate a borda e sobe nela

const passagem = (eq) => eq.geom.saiaPassagens[0].y;

/* ------------------------------------------------------------------------
 *  NOS: onde tres linhas se encontram ou onde a linha muda de numero numa
 *  valvula. A posicao e relativa a um bocal, para acompanhar o equipamento.
 *  O corpo da valvula entra na Fase 6; por ora o no e um te.
 * --------------------------------------------------------------------- */
export const NOS = {
  // Entre o T-01 e o E-02, no recuo do rack, 2,5 m abaixo do bocal de entrada
  // do T-01 (que olha para leste): a valvula de expansao e o PT da malha dela
  // ao alcance do piso. A 11 chega do R-01, pelo leste; a 12 sai para oeste e
  // sobe 2,5 m ate o bocal — trecho bifasico curto, que a equipe pode preferir
  // trocar pela valvula no bocal, com plataforma. [ADOTADO]
  'V-03b': { perto: 'T-01.N1', d: [0.75, -2.5, 0.9], nome: 'Válvula de expansão 15 → 1,3 bar' },
  // No recuo do rack, entre o V-02 e o TK-01, a 2,4 m: a 05A chega da BC-02
  // por cima do corredor transversal e a 06 desce ao topo do V-02.
  'V-08': { perto: 'V-02.N1', d: [2.6, 0.93, 0.68], nome: 'Válvula redutora antes do V-02' },
  // No vao entre o E-01 e o E-04: o condensado desce do fundo do E-04 e se
  // divide — o reciclo (14) segue reto para o sul, ate a V-15; o resto (29A)
  // vira para oeste, para a BC-04.
  'V-14': { perto: 'E-04.N2', d: [-0.88, -0.42, 2.33], nome: 'Válvula de três vias: reciclo × TK-01' },
  'V-15': { perto: 'BC-01.S', d: [-0.7, 0, 0], nome: 'Válvula de três vias: reciclo + licor-mãe' },
  // No vao entre o E-03 e o D-01, no recuo do rack: o concentrado (18) chega do
  // fundo do E-03 pelo oeste e o filtrado (26) pelo leste, em linha; a mistura
  // (19) sai pelo ramal, para o norte — a forma de uma valvula de tres vias.
  'V-16': { perto: 'E-03.N2', d: [0.77, -0.35, -0.18], nome: 'Válvula de três vias: concentrado + filtrado do F-02' },
  'P-27': { perto: 'BC-10.D', d: [0, 0.9, 0], nome: 'Tê da purga S-27' },
};

/* Limites de bateria: a 0,4 m da borda da laje, na faixa da linha. A oeste
 * ficam ETE e tanques; a leste, caldeira, torre e armazem.
 * `xPortico`: desde a Fase 11 o corredor de manutencao sai pelas pontas do
 * rack, por onde saem tambem as linhas. Um poste de pipeway na virada, logo
 * fora da laje, fecharia a saida do veiculo: o rack avanca ate o meio do
 * acostamento e o ultimo portico dele e o apoio da virada — as colunas ficam
 * a 3,5 m do eixo, fora da rampa, e o veiculo passa sob a viga. */
const isbl = BLOCOS.find((b) => b.id === 'ISBL');
const anel = VIAS.find((v) => v.id === 'anel-processo');
const anelX = anel.pontos.map((p) => p[0]);
const meiaVia = anel.largura / 2;
export const LIMITES = {
  oeste: { x: isbl.x[0] + 0.4, xPortico: (isbl.x[0] + Math.min(...anelX) + meiaVia) / 2, dir: [1, 0, 0] },
  leste: { x: isbl.x[1] - 0.4, xPortico: (isbl.x[1] + Math.max(...anelX) - meiaVia) / 2, dir: [-1, 0, 0] },
};
/* BLOQUEIO NO LIMITE DE BATERIA (pendencia O, decidida em 27/10: respeitar —
 * pedido do professor). Em toda linha que cruza o limite: valvula gaveta de
 * bloqueio do lado de dentro e, entre ela e a flange do limite, a raquete
 * (figura 8), que isola de verdade. Acesso por plataforma ao lado do feixe,
 * uma por nivel do rack, entre dois porticos (equipment/limiteBateria.js).
 * Nao se desceram as linhas ao piso: criaria ponto baixo no vapor e no
 * condensado e alongaria todas. [ADOTADO]
 *   recuo         m da flange do limite ao centro da valvula
 *   raquete       m da flange do limite a raquete
 *   alturaVolante m do piso da plataforma ao meio da faixa de volantes
 *                 (alcance confortavel de 0,8 a 1,7 m, a regra da auditoria)
 *   folgaLinha    m da geratriz da linha mais de fora a borda da plataforma
 *   largura / comprimento  da plataforma (1,2 m para operar, NR-12) */
export const BLOQUEIO_LIMITE = { recuo: 0.9, raquete: 0.35, alturaVolante: 1.25, folgaLinha: 0.35, largura: 1.2, comprimento: 1.8 };

export const DESTINOS = {
  '07': 'Dreno fechado → ETE',
  '27': 'Tanque de purga TQ-03',
  '30': 'Tanques de tolueno TQ-01/02',
  '28': 'Secagem e expedição (armazém)',
  CWS: 'Torre de resfriamento',
  CWR: 'Torre de resfriamento',
  STM: 'Caldeira',
  COND: 'Caldeira',
};

/* ------------------------------------------------------------------------
 *  TRECHOS DE PROCESSO
 *  Um por pedaco entre equipamentos, bombas e nos. `corrente` so quando a
 *  linha do P&ID atravessa um no que muda a corrente (19, 21).
 * --------------------------------------------------------------------- */
export const TRECHOS = [
  // --- reacao ---
  // O ar vem do CP-01, do outro lado do rack: sobe na borda sul, cruza o
  // rack e desce junto ao R-01, entrando no anel aspersor pelo lado do rack.
  { linha: '01', de: 'CP-01.N1', para: 'R-01.N2', sai: 0.5, chega: 0.6, rota: [...ATE_A_BORDA, 'x:B', ...DESCE] },
  // Vapor de topo: desce colado ao costado do R-01 (guias presas a ele) ate a
  // faixa do rack e corre nela sem subir — vapor que condensa nao pode fazer
  // bolsao — ate sair sobre o E-01.
  { linha: '02', de: 'R-01.N4', para: 'E-01.N1', sai: 0.6, rota: ['z:A+1.1', 'y:rack', 'z:rack', 'x:B', 'z:B'],
    desvio: 'desce colado ao costado do R-01, que guia o riser de 6", e corre no rack sem ponto baixo' },
  // Sai do fundo pela passagem da saia, do lado do rack, sobe na borda (ao
  // lado do riser do vapor de topo) e desce na borda junto a valvula de
  // expansao.
  { linha: '11', de: 'R-01.N3', para: 'V-03b@+x', sai: `y:${passagem(R01)}`,
    rota: ['z:bordaA', 'x:d-0.6', ...SOBE, 'x:B', ...DESCE_NA_BORDA] },
  { linha: '12', de: 'V-03b@-x', para: 'T-01.N1', rota: [] },

  // --- recuperacao de gases e condensado de topo ---
  // O condensado desce do fundo do E-01 e entra no V-01 pelo lado que olha
  // para ele.
  { linha: '03', de: 'E-01.N2', para: 'V-01.N1', sai: 0.3, rota: ['x:B'] },
  { linha: '05', de: 'V-01.N3', para: 'BC-02.S', sai: 'y:B', rota: [] },
  // Sobe a 2,4 m na bomba e cruza o corredor transversal acima do pe-direito
  // ate a V-08 (a V-07 fica nesse trecho, ao alcance do piso).
  { linha: '05A', de: 'BC-02.D', para: 'V-08@+x', sai: 'y:2.4', rota: ['z:B'] },
  { linha: '06', de: 'V-08@-x', para: 'V-02.N1', rota: [] },
  // O V-02 opera a 1 bar: a agua nao sobe ao rack, desce ao dreno fechado,
  // no recuo do rack — na faixa do perimetro o funil seria tropeco.
  { linha: '07', de: 'V-02.N2', para: 'DRENO', sai: 0.08, rota: ['z:A+0.8'] },
  { linha: '08', de: 'V-02.N3', para: 'BC-03.S', sai: 0.4, rota: [] },
  // Sobe na bomba, recua para o recuo do rack e corre ali: pela fila de
  // bombas cruzaria a subida da 09A.
  { linha: '08', de: 'BC-03.D', para: 'TK-01.N1', sai: 'y:B+0.2', rota: ['z:A-1.4'] },

  // --- topo do T-01 e reciclo ---
  { linha: '13', de: 'T-01.N2', para: 'E-04.N1', sai: 0.5, vapor: true, rota: [] },
  { linha: '13', de: 'E-04.N2', para: 'V-14@-z', sai: 0.3, rota: ['x:B'] },
  // Reciclo: reto para o sul, baixo e sem ponto alto (e succao da BC-01), ate
  // a V-15 sob o rack.
  { linha: '14', de: 'V-14@+z', para: 'V-15@-z', rota: ['z:B-0.3'] },
  { linha: '29A', de: 'V-14@-x', para: 'BC-04.S', rota: ['z:B'] },
  // Sobe meio metro a oeste da bomba (no X dela sai o vapor de topo, 02, do
  // rack para o E-01), desce na borda e chega ao TK-01 por cima do teto.
  // Desce meio metro a oeste do bocal: no X dele, a travessia tirava o lugar
  // do portico que apoia a da 09A.
  { linha: '29', de: 'BC-04.D', para: 'TK-01.N2', sai: 0.3, rota: ['x:d-0.5', ...SOBE, 'x:B-0.5', ...DESCE_NA_BORDA] },
  { linha: '16A', de: 'V-15@+x', para: 'BC-01.S', sai: 0, rota: [] },
  // Corre ao lado do E-03, fora da projecao dele, ate a fila de bombas.
  { linha: '31', de: 'E-03.N4', para: 'BC-05.S', sai: 'y:B', rota: ['x:A+0.4', 'z:B'] },
  // Chega a V-15 por cima do corredor do rack, pelo sul, em linha com o
  // reciclo (14), que chega pelo norte: a saida comum (16A) vai a BC-01.
  { linha: '31', de: 'BC-05.D', para: 'V-15@+z', sai: 0.3, rota: [...SOBE, 'x:B', 'y:lat', 'z:B'] },
  // Desce no vao largo entre o T-01 e o E-02 e corre baixo ao lado do E-02,
  // onde o piso aceita apoio, ate o bocal da ponta norte.
  { linha: '16', de: 'BC-01.D', para: 'E-02.N1', sai: 0.3, rota: [...SOBE, 'x:B-0.75', 'y:lat', 'z:B+3.0', 'y:B', 'z:B'],
    desvio: 'desce entre o T-01 e o E-02 e corre ao lado do E-02, onde o piso aceita apoio' },
  // Reciclo ao topo do reator: corre baixo pelo recuo do rack (a V-03 ali,
  // ao alcance do piso), cruza o corredor do reator acima do pe-direito e
  // sobe colado ao costado do R-01 (a 135° no referencial dele, entre os
  // bocais de instrumento) ate o bocal do alto.
  { linha: '17', de: 'E-02.N2', para: 'R-01.N1', sai: 0.6, chega: 0.6, rota: ['z:A+0.31', 'x:B+0.74', 'z:B+2.02', 'y:B'],
    desvio: 'sobe colado ao costado do R-01, que guia o riser de 11 m' },

  // --- concentrado do T-01 ---
  // Sai do fundo pela passagem da saia, do lado do rack, e corre baixo no
  // recuo ate a BC-11.
  { linha: '32', de: 'T-01.N3', para: 'BC-11.S', sai: `y:${passagem(T01)}`, rota: ['z:A+1.2'] },
  // Corre 0,8 m baixo na fila de bombas (a V-05 ali, ao alcance do piso),
  // sobe, cruza o rack e desce na borda ao lado do E-03 — longe da 21, que
  // desce sobre o bocal vizinho.
  { linha: '32', de: 'BC-11.D', para: 'E-03.N1', sai: 0.3, rota: ['x:d+0.8', ...SOBE, 'x:B+0.55', 'y:lat', 'z:bordaB', 'y:B', 'z:B'] },

  // --- cristalizacao 1 e filtracao 1 ---
  // O concentrado (18) desce do fundo do E-03 a V-16.
  { linha: '19', corrente: 'S-18', de: 'E-03.N2', para: 'V-16@-x', sai: 0.2, rota: [] },
  // Corre baixo pelo recuo do rack (a V-17 ali, ao alcance do piso), cruza o
  // corredor acima do pe-direito e sobe junto ao costado do CR-01, que guia o
  // riser.
  { linha: '19', de: 'V-16@-z', para: 'CR-01.N1', rota: ['y:2.4', 'z:B-2.61', 'x:B', 'y:B', 'z:B'],
    desvio: 'corre baixo pelo recuo do rack, com a V-17 ao alcance, e sobe junto ao costado do CR-01' },
  // Suspensao: desce a 2 % do fundo do CR-01 a cuba do F-01.
  { linha: '20', de: 'CR-01.N2', para: 'F-01.N1', sai: 0.6, queda: 0.02, rota: ['x:B'] },
  { linha: '21', corrente: 'S-21', de: 'F-01.N2', para: 'BC-10.S', sai: 0.14, rota: ['x:B', 'z:B'] },
  { linha: '21', corrente: 'S-21', de: 'BC-10.D', para: 'P-27@-y', sai: 0, rota: [] },
  { linha: '21', corrente: 'S-22', de: 'P-27@-z', para: 'E-03.N3', rota: [...ATE_A_BORDA, 'x:B', ...DESCE] },
  // Sobe junto ao portico, antes da BV-01: no X do te, entre os corredores,
  // nao ha portico para apoiar a travessia (½" vence so 1,5 m).
  { linha: '27', de: 'P-27@+x', para: 'LB:oeste', sai: 1.1, rota: [...ATE_A_BORDA, 'x:B'] },
  { linha: '09', de: 'TK-01.N4', para: 'BC-06.S', sai: 0.4, rota: [] },
  // Desce no vao entre o CR-01 e o F-01, onde o piso e livre para apoio.
  // Corre a ~1,75 m, por baixo da linha 20, e so sobe ao lado do F-01: a V-19
  // fica nesse trecho baixo, ao alcance do piso. Desde o capo (27/10) o N4
  // fica no alto dele: o riser sobe por fora das pernas e a linha passa por
  // cima do capo ate o bocal.
  { linha: '09A', de: 'BC-06.D', para: 'F-01.N4', sai: 0.3,
    rota: [...SOBE, 'x:B-1.35', 'y:lat', 'z:bordaB', 'y:1.75', 'z:B', 'y:B'],
    desvio: 'corre fora da projeção do F-01, onde o piso aceita apoio' },

  // --- dissolucao, cristalizacao 2 e filtracao 2 ---
  { linha: '10', de: 'TK-01.N3', para: 'BC-09.S', sai: 0.4, rota: [] },
  // Corre 1,6 m baixo pela borda do rack antes de subir: ali, ao alcance do
  // piso e com o trecho reto que ela pede, ficam a placa de orificio (FIC do
  // TK-01) e a V-20. Desce sobre o bocal no X dele — de lado, a descida caia
  // num corredor, onde nao ha portico para apoiar a travessia.
  { linha: '10', de: 'BC-09.D', para: 'D-01.N2', sai: 0.3,
    rota: ['z:bordaA', 'x:d-1.6', ...SOBE, 'x:B', ...DESCE] },
  // Calha de torta: cai do raspador na tremonha, sempre descendo.
  { linha: '23', de: 'F-01.N3', para: 'BD-01.S', sai: 0.3, chega: 0.25, rota: [] },
  // A torta sobe por cima da BD-01 ate a borda do rack, que guia o riser
  // (solto ao sul dela, ele nao tinha guia), e chega ao D-01 de lado, livre
  // do acionamento do agitador. Corre a 2 m, por baixo da 19.
  { linha: '23', de: 'BD-01.D', para: 'D-01.N1', sai: 0.3,
    rota: ['y:2.0', 'z:bordaA', ...SOBE, 'x:B-0.6', 'y:lat', 'z:B', 'y:B', 'x:B'],
    desvio: 'sobe na borda do rack, que guia o riser, e chega ao D-01 de lado' },
  // Sai pelo meio das pernas do D-01, reto para o rack.
  { linha: '24', de: 'D-01.N3', para: 'BC-07.S', sai: 'y:B', rota: ['z:B'] },
  // Corre 0,8 m baixo na fila de bombas (a V-18 ali, ao alcance do piso),
  // sobe ao rack e sobe junto ao costado do CR-02, que guia o riser.
  { linha: '24A', de: 'BC-07.D', para: 'CR-02.N1', sai: 0.3,
    rota: ['x:d-0.8', ...SOBE, 'x:B', 'y:lat', 'z:B-2.2', 'y:B', 'z:B'],
    desvio: 'sobe junto ao costado do CR-02, que guia o riser' },
  { linha: '25', de: 'CR-02.N2', para: 'F-02.N1', sai: 0.6, queda: 0.02, rota: ['x:B'] },
  // A cuba corre ao longo do eixo do tambor: a linha sai de lado, rente ao
  // piso, e so depois segue para a bomba sob o rack.
  { linha: '26', de: 'F-02.N2', para: 'BC-08.S', sai: 0.16, rota: ['x:A-1.3', 'z:B'] },
  // Sobe na bomba ao rack, corre para oeste e desce na borda, junto a V-16.
  { linha: '26', de: 'BC-08.D', para: 'V-16@+x', sai: 0.3, rota: [...SOBE, 'x:B', ...DESCE_NA_BORDA] },
  { linha: '28', de: 'F-02.N3', para: 'BD-02.S', sai: 0.3, chega: 0.25, rota: [] },
  // Passa por cima da BD-02 antes de ir a borda: por baixo dela nao ha vao.
  // A 1,7 m: o N3 no capo (27/10) chega a tremonha a 1,47 m, por baixo.
  { linha: '28', de: 'BD-02.D', para: 'LB:leste', sai: 0.2, rota: ['y:1.7', ...ATE_A_BORDA, 'x:B'] },
  // Vacuo: do cabecote do tambor, descendo ate a bomba (o arraste de liquido
  // escorre para o separador dela); sai da projecao do filtro antes de virar.
  { linha: 'V1', de: 'F-01.V', para: 'BV-01.S', sai: 0.15, chega: 0.25, rota: ['z:A-0.9', 'x:B'] },
  { linha: 'V2', de: 'F-02.V', para: 'BV-02.S', sai: 0.15, chega: 0.1, rota: [] },
  // Corre por baixo da linha 25 (~2,3 m a oeste do F-02) e sobe so no fim:
  // a V-21 fica no trecho baixo, ao alcance do piso.
  { linha: '30', de: 'LB:oeste', para: 'F-02.N4', rota: ['x:B-1.32', 'y:lat', 'z:bordaB', 'y:1.48', 'z:B', 'y:B'],
    desvio: 'corre a oeste do F-02, onde o piso aceita apoio' },
];

/* ------------------------------------------------------------------------
 *  PONTAS ABERTAS: vent, respiro e tomada de ar. `ate` e uma cota absoluta.
 *  O vent sobe estaiado (tubulacao.js): 2" com 15 m nao se sustenta sozinho.
 * --------------------------------------------------------------------- */
export const ABERTAS = [
  { linha: '04', de: 'V-01.N2', ate: VENT.altura, destino: 'Vent atmosférico', estaiar: true, terminal: 'chapeu' },
  { id: 'RE', de: 'TK-01.N5', comprimento: 1.8, destino: 'Respiro com corta-chamas', terminal: 'corta-chamas',
    ficha: { 'Serviço': 'Alívio atmosférico do TK-01', 'Proteção': 'Corta-chamas na ponta' } },
  { id: 'AR', de: 'CP-01.S', comprimento: 3.5, destino: 'Ar atmosférico (filtro)', terminal: 'filtro',
    ficha: { 'Serviço': 'Admissão do compressor', 'Vazão': '3 491 kg/h ≈ 0,82 m³/s',
      'Posição': 'A barlavento do processo (vento de SE)' } },
  // Exaustao das bombas de vacuo: gas de selagem com vapor de tolueno.
  { id: 'EX1', de: 'BV-01.E', comprimento: 2.5, destino: 'Exaustão do vácuo', terminal: 'chapeu',
    ficha: { 'Serviço': 'Exaustão do separador da BV-01', 'Observação': 'Leva vapor de tolueno: na obra, vai a um condensador ou lavador antes da atmosfera' } },
  { id: 'EX2', de: 'BV-02.E', comprimento: 2.5, destino: 'Exaustão do vácuo', terminal: 'chapeu',
    ficha: { 'Serviço': 'Exaustão do separador da BV-02', 'Observação': 'Leva vapor de tolueno: na obra, vai a um condensador ou lavador antes da atmosfera' } },
];

/* ------------------------------------------------------------------------
 *  UTILIDADES: cabecais no nivel 2 do rack, do limite de bateria leste ate o
 *  consumidor mais a oeste, e um ramal por bocal. DN [ESTIMADO]:
 *    CWS/CWR 224 m³/h (Quadro B9 + E-04) a ~2 m/s -> 8"
 *    STM 2 637 kg/h a ~9 bar (4,7 kg/m³) = 0,156 m³/s a ~20 m/s -> 4"
 *    COND 2 637 kg/h ~ 2,8 m³/h -> 2"
 * --------------------------------------------------------------------- */
export const CABECAIS = [
  { id: 'CWS', fluido: 'CW', dn: 200, nome: 'Água de resfriamento — alimentação', vazao: '224 m³/h' },
  { id: 'CWR', fluido: 'CW', dn: 200, nome: 'Água de resfriamento — retorno', vazao: '224 m³/h' },
  { id: 'STM', fluido: 'STM', dn: 100, nome: 'Vapor de aquecimento', vazao: '2 637 kg/h' },
  { id: 'COND', fluido: 'COND', dn: 50, nome: 'Condensado', vazao: '2 637 kg/h' },
];

/* Ramal: do bocal do consumidor ate o te no cabecal. `sentido` so muda a
 * ficha (alimenta ou retorna); a geometria e a mesma. O DN e o do bocal.
 * Regra: corre baixo ate a borda do rack e sobe nela, onde o riser tem
 * guia (BORDA). Excecoes anotadas. */
const BORDA = ['z:bordaA', 'y:lat'];
export const RAMAIS = [
  // A agua entra pelo bocal de baixo, que olha para nordeste (de costas para
  // o rack): desce a 1,5 m e contorna o R-01 pelo leste, por fora da saia e
  // antes da escada — a V-01 (TIC do R-01) fica nesse trecho, ao alcance.
  { cabecal: 'CWS', de: 'R-01.C1', linha: '1A', sai: 0.4, rota: ['y:A-1.7', 'x:A+1.0', ...BORDA] },
  // Sai acima do piso da plataforma e desce por um furo nele.
  { cabecal: 'CWR', de: 'R-01.C2', linha: '1B', sai: 0.3, rota: ['y:lat'] },
  // Condensador elevado: os ramais descem pelos lados dele, onde ha piso
  // para apoio — por cima dele, o vapor de topo (02) sai do rack.
  { cabecal: 'CWS', de: 'E-01.A1', rota: ['x:d-0.5', ...BORDA] },
  { cabecal: 'CWR', de: 'E-01.A2', rota: ['x:d+0.5', ...BORDA] },
  { cabecal: 'CWS', de: 'E-04.A1', rota: ['x:d-0.45', ...BORDA] },
  { cabecal: 'CWR', de: 'E-04.A2', rota: BORDA },
  // Bocais empilhados na mesma geratriz: o de baixo desvia meio metro.
  { cabecal: 'CWS', de: 'CR-01.A1', rota: ['x:d+0.45', ...BORDA] },
  { cabecal: 'CWR', de: 'CR-01.A2', rota: BORDA },
  // Sobem a oeste do CR-02: no X dele fica o corredor do reator, onde nao ha
  // portico para apoiar a travessia ate o cabecal.
  { cabecal: 'CWS', de: 'CR-02.A1', rota: ['x:d-1.0', ...BORDA] },
  { cabecal: 'CWR', de: 'CR-02.A2', rota: ['x:d-0.55', ...BORDA] },
  // Vapor do E-02 pelo lado oeste dele: no eixo, cruzaria a subida da 17.
  { cabecal: 'STM', de: 'E-02.V1', rota: ['x:A-0.35', ...BORDA] },
  { cabecal: 'COND', de: 'E-02.V2', sai: 0.3, rota: ['z:d+0.6', ...BORDA] },
  // Os bocais da serpentina olham para oeste, 0,35 m um acima do outro:
  // saidas de comprimento diferente para os risers nao se encostarem.
  { cabecal: 'STM', de: 'T-01.V1', linha: '12A', sai: 0.4, rota: BORDA },
  { cabecal: 'COND', de: 'T-01.V2', linha: '12B', sai: 0.75, rota: BORDA },
  { cabecal: 'STM', de: 'D-01.V1', rota: BORDA },
  { cabecal: 'COND', de: 'D-01.V2', rota: ['x:d+0.45', ...BORDA] },
];

/* Equipamentos que a linha atravessa sem perder a pressao: a hidraulica
 * (tubulacao.js) segue por eles ate achar uma bomba ou um vaso. */
export const PASSA = {
  'E-01.N2': 'E-01.N1', 'E-02.N2': 'E-02.N1', 'E-03.N2': 'E-03.N1',
  'E-03.N4': 'E-03.N3', 'E-04.N2': 'E-04.N1',
};

/* ------------------------------------------------------------------------
 *  CORES por codigo de fluido (Quadro 13) [ADOTADO], pela NBR 6493 (Fase
 *  25, pedido do autor: "selecione bem as cores das coisas pra nao ficar
 *  parecendo de mentira"). Antes cada linha de processo tinha uma cor viva
 *  propria, para o fluxo se ler — e a area de processo parecia de brinquedo.
 *  Agora o corpo do tubo tem a cor da norma, em tons de tinta de campo:
 *    - inflamaveis de baixa viscosidade (tolueno e as misturas dele, o
 *      licor-mae, a torta umida): aluminio;
 *    - agua verde, ar azul, vapor e condensado (sempre isolados) na capa de
 *      aluminio, vacuo cinza-claro, agua de incendio vermelha.
 *  A leitura do fluxo passa para as FAIXAS de identificacao: aneis da cor
 *  do fluido perto de cada ponta e a cada `FAIXA.passo` m (lib/faixas.js).
 * --------------------------------------------------------------------- */
const ALUMINIO = 0xaab0b6, CAPA = 0xbcc1c5, AGUA = 0x3b7050;
export const CORES = {
  AR: 0x35618c,
  MRV: ALUMINIO,
  MR: ALUMINIO,
  TOL: ALUMINIO,
  'TOL/AB': ALUMINIO,
  'AB/TOL': ALUMINIO,
  'T/H2O': ALUMINIO,
  H2O: AGUA,
  LM: ALUMINIO,
  'TORTA-AB': ALUMINIO,
  CW: AGUA,
  STM: CAPA,
  COND: CAPA,
  VAC: 0xb4b9bf,          // NBR 6493: vacuo em cinza-claro
  AI: 0xa3342b,           // NBR 6493: agua de incendio em vermelho (Fase 18)
  AT: AGUA,               // agua tratada, verde como a potavel (Fase 18)
};

/* Faixa de identificacao por codigo [ADOTADO]: a cor que distingue o fluido
 * no tubo de aluminio (as de processo, uma por codigo, para o fluxo ainda se
 * ler) e a da norma no que vai em capa (vapor branco, condensado verde).
 * Quem ja tem a cor da norma no corpo nao leva faixa. */
export const FAIXAS = {
  MRV: 0x8f9cab,          // vapor do reator: cinza-azulado
  MR: 0xb57a4c,
  TOL: 0xc9962e,          // tolueno: ambar
  'TOL/AB': 0xa9573c,     // licor: ferrugem
  'AB/TOL': 0xa9573c,
  'T/H2O': 0x4a8f9c,
  LM: 0x6f5c9a,           // licor-mae: roxo apagado
  'TORTA-AB': 0x86684a,
  STM: 0xeceee9,          // vapor: branco
  COND: 0x4f8466,
};
export const FAIXA = { largura: 0.25, passo: 8, ponta: 0.6, retoMin: 1.4 };   // m

/* Legenda das cores do tubo (Fase 25, pedido do autor: "uma legendinha
 * para as cores dos canos"): o que cada cor de corpo quer dizer pela norma.
 * As faixas a legenda tira de FAIXAS e dos nomes do Quadro 13. */
export const LEGENDA_CORPO = [
  { cor: ALUMINIO, nome: 'Inflamáveis de processo (alumínio)' },
  { cor: CAPA, nome: 'Vapor e condensado, isolados (capa de alumínio)' },
  { cor: AGUA, nome: 'Água: resfriamento, processo e tratada' },
  { cor: CORES.AR, nome: 'Ar comprimido e de processo' },
  { cor: CORES.VAC, nome: 'Vácuo' },
  { cor: CORES.AI, nome: 'Água de incêndio' },
];

/* Codigos da maquete que o Quadro 13 nao tem. */
export const CODIGOS_MAQUETE = {
  VAC: 'Vácuo — ar e vapor de tolueno (código da maquete)',
};

/* ------------------------------------------------------------------------
 *  VAO ADMISSIVEL entre apoios (m), por DN: ASME B31.1, Tabela 121.5, linha
 *  cheia de agua — o caso mais pesado, usado para todas. ½" nao consta da
 *  tabela: 1,5 m e a pratica para tubo pequeno.
 * --------------------------------------------------------------------- */
export const VAO_ADMISSIVEL = {
  15: 1.5, 25: 2.1, 32: 2.4, 40: 2.7, 50: 3.0, 65: 3.4, 80: 3.7,
  100: 4.3, 150: 5.2, 200: 5.8, 300: 7.0,
};

/* Riser sem guia intermediaria: ate 1,5 vez o vao horizontal do DN — o peso
 * desce axial para o apoio da base; a guia so segura vento e vibracao.
 * [ADOTADO] */
export const RISER_LIVRE = 1.5;

/* No rack, entre porticos de ate 6 m, a referencia e a flecha, nao a tabela
 * de vao (que e para linha solta, com flecha de 2,5 mm). Linha cheia de
 * agua, biapoiada em 6 m, Sch 40:
 *   3": w ~ 160 N/m, I = 125,8 cm4 -> flecha ~ 1,1 cm  (aceitavel em rack)
 *   2": w ~  95 N/m, I =  27,7 cm4 -> flecha ~ 2,9 cm  (nao)
 * Entao de 2" para baixo a linha corre numa bandeja continua. [ESTIMADO] */
export const DN_MIN_SEM_BANDEJA = 65;
