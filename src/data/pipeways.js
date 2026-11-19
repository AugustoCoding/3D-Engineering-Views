import { BLOCOS, VIAS, TANQUES } from './site.js';
import { RACK, CONTENCAO } from './arranjo.js';
import { LIMITES } from './rotas.js';
import { RECUO_PADRAO, BACIA, eixoCaldeira, posicaoBracos, arranjoEte } from './entorno.js';
import { dnDrenagem } from './agua.js';
import { DN } from './plant.js';

/**
 * ============================================================================
 *  PIPEWAYS — a interligacao fora dos limites de bateria  (Fase 7)
 * ============================================================================
 *
 *  As linhas que saem da laje pelas flanges de limite de bateria (Fase 5)
 *  seguem ate os blocos que as servem: tanques, torre, caldeira e armazem.
 *  Nada disto esta nos documentos do grupo — o relatorio para no limite de
 *  bateria. Tudo e [ADOTADO] ou [ESTIMADO], com a regra ao lado.
 *
 *  Regras de desenho:
 *    - o pipeway corre nas MESMAS cotas do rack (5,2 e 7,0 m): a linha sai da
 *      flange e segue reta, sem bolsao nem ponto alto ate o destino;
 *    - corre pelo acostamento, nunca por cima de via no sentido dela; via so
 *      se atravessa por cima, numa ponte de tubos, com altura livre;
 *    - o caminho e o de Manhattan: uma curva por mudanca de direcao.
 *
 *  O corredor e uma polilinha em planta; a faixa de cada linha nele e a do
 *  rack, carregada desde a flange (site/pipeways.js), e os postes e pontes
 *  saem do corredor e das vias que ele cruza — nada e posto a mao.
 * ============================================================================
 */

const bloco = (id) => BLOCOS.find((b) => b.id === id);
const via = (id) => VIAS.find((v) => v.id === id);
const caixaVia = (v) => {
  const xs = v.pontos.map((p) => p[0]), zs = v.pontos.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), m: v.largura / 2 };
};
const centro = (b) => [(b.x[0] + b.x[1]) / 2, (b.z[0] + b.z[1]) / 2];

export const PIPEWAY = {
  // [ADOTADO] IT 06 do CBPMESP (acesso de viatura): altura livre minima de
  // 4,5 m sobre a via. Vale tambem para a rampa do guindaste na laje.
  alturaLivre: 4.5,
  // [ADOTADO] poste a 1 m do meio-fio: fora do alcance de retrovisor e de
  // carroceria em manobra.
  folgaVia: 1.0,
  meioFio: 0.15,
  vaoMax: RACK.vaoMax,          // mesmo vao do rack (6 m)
  // Travessa da ponte a cada 3 m [ESTIMADO]: abaixo do vao admissivel do
  // menor tubo solto que ela carrega (DN 80, 3,7 m); o menor vai na bandeja.
  vaoPonte: 3.0,
  // Altura da trelica acima do nivel mais alto que ela carrega [ESTIMADO]:
  // L/8 de uma ponte de 9 m, e passa o tubo de 8" com folga.
  alturaTrelica: 1.2,
  sapata: 0.5,
  // Afastamento de poste a obstaculo (bomba, tubo, mureta) [ADOTADO].
  folgaObjeto: 0.3,
  // Rota contra o caminho minimo: comprimento <= fator x Manhattan + subida.
  fatorRota: 1.15,
};

/* ----------------------------------------------------------------------------
 *  Geometria de referencia: tudo derivado dos blocos e das vias de site.js.
 * ------------------------------------------------------------------------- */
const isbl = bloco('ISBL');
const anel = caixaVia(via('anel-processo'));
const anelTq = caixaVia(via('anel-tanques'));
const ligLeste = via('lig-leste');
const principal = caixaVia(via('principal'));

// Acostamento entre a laje e o anel: o pipeway corre no meio dele.
const xOeste = (isbl.x[0] + anel.x0 + anel.m) / 2;
const xLeste = (isbl.x[1] + anel.x1 - anel.m) / 2;
// Ao norte: no meio da faixa entre o anel e a torre.
const torre = bloco('TORRE');
const [xTorre] = centro(torre);
const zTorre = (anel.z0 - anel.m + torre.z[1]) / 2;
// Ao sul do parque de tanques, entre a borda do bloco e o anel dos tanques.
const tanques = bloco('TANQUES');
const zTanques = (tanques.z[1] + anelTq.z1 - anelTq.m) / 2;
const TQ = Object.fromEntries(TANQUES.map((t) => [t.id, t]));
// Desvio a meio caminho entre o anel do processo e o dos tanques, e a entrada
// no anel dos tanques 8,5 m para dentro da via leste dele (a de antes da
// Fase 11, quando a laje chegava ate ali).
const zDesvio = (anel.z0 - anel.m + anelTq.z1 - anelTq.m) / 2;
const xEntradaTanques = anelTq.x1 - anelTq.m - 8.5;
// A leste: 4 m ao sul da lig-leste, para o poste e a faixa ficarem fora dela.
const zSul = ligLeste.pontos[0][1] + ligLeste.largura / 2 + 4;
// Entre a via principal e os blocos de utilidade.
const caldeira = bloco('CALDEIRA');
const xFora = (principal.x1 + principal.m + caldeira.x[0]) / 2;
// Dentro do bloco da caldeira, 2 m da borda norte: fora da cobertura dela.
const zCaldeira = caldeira.z[0] + 2;
const xCaldeira = eixoCaldeira(caldeira).x;
// Entre a subestacao e o armazem; entra no armazem a um quarto do galpao,
// onde fica o secador, e para 0,5 m dentro do bloco (a parede e o recuo).
const subestacao = bloco('SUBESTACAO');
const armazem = bloco('ARMAZEM');
const zArmazem = (subestacao.z[1] + armazem.z[0]) / 2;
const xArmazem = armazem.x[0] + (armazem.x[1] - armazem.x[0]) / 4;
// Descarga: 1,0 m dentro da borda norte da baia, 1,2 m fora do beiral da
// cobertura (que vai a z0 + 2,2): o poste fica fora do telhado.
const descarga = bloco('DESCARGA');
const zDescarga = descarga.z[0] + 1.0;
const [xBraco1] = posicaoBracos(descarga)[0];

/** Paredes de predio que a linha atravessa: a do armazem, onde ela entra. */
export const PAREDES = { ARMAZEM: armazem.z[0] + RECUO_PADRAO };

/* ----------------------------------------------------------------------------
 *  CORREDORES — arvore de polilinhas em planta. `de` e o limite de bateria
 *  ('LB:oeste'), outro corredor (continua do ultimo ponto dele) ou nada (a
 *  raiz e o primeiro ponto). Os pontos colineares marcam onde uma linha para.
 * ------------------------------------------------------------------------- */
export const CORREDORES = [
  // A primeira virada fica sobre o ultimo portico do rack, que avanca ate o
  // acostamento (rotas.js, xPortico): ali o pipeway nao pede poste. Para os
  // tanques, desvia para oeste a meio caminho e entra no anel deles pelo
  // mesmo ponto de antes — reto, a 1 m da laje, correria sobre a via do anel
  // dos tanques.
  { id: 'oeste', nome: 'Pipeway oeste — parque de tanques', de: 'LB:oeste',
    pontos: [[xOeste, RACK.z], [xOeste, zDesvio], [xEntradaTanques, zDesvio], [xEntradaTanques, zTanques + 1.65],
      [xEntradaTanques, zTanques], [TQ['TQ-02'].x, zTanques]] },
  { id: 'leste', nome: 'Pipeway leste — tronco', de: 'LB:leste', pontos: [[xLeste, RACK.z]] },
  // Utilidades sobem juntas pelo acostamento: vapor e condensado viram para
  // leste na latitude da caldeira, a agua segue ate a torre. Pelo sul, o
  // vapor ia 7 m alem e voltava (a lig-leste ocupa z = -3 a 3).
  { id: 'norte', nome: 'Pipeway leste — utilidades', de: 'leste', pontos: [[xLeste, zCaldeira]] },
  { id: 'torre', nome: 'Pipeway da torre de resfriamento', de: 'norte',
    pontos: [[xLeste, zTorre], [xTorre + 3, zTorre], [xTorre, zTorre]] },
  { id: 'caldeira', nome: 'Pipeway da caldeira', de: 'norte',
    // o condensado para 3,5 m antes do vapor: o tanque de alimentacao fica
    // sob ele e sobra lugar para o poste antes do riser do vapor
    pontos: [[xCaldeira - 3.5, zCaldeira], [xCaldeira, zCaldeira]] },
  { id: 'sul', nome: 'Pipeway leste — expedição', de: 'leste', pontos: [[xLeste, zSul], [xFora, zSul]] },
  { id: 'armazem', nome: 'Pipeway do armazém', de: 'sul',
    pontos: [[xFora, zArmazem], [xArmazem, zArmazem], [xArmazem, armazem.z[0] + 0.5]] },
  { id: 'descarga', nome: 'Pipeway da descarga de tolueno', de: null,
    pontos: [[xBraco1, zDescarga], [TQ['TQ-02'].x, zDescarga], [TQ['TQ-01'].x, zDescarga]] },
];

/* ----------------------------------------------------------------------------
 *  LINHAS — a que sai do limite de bateria (de: 'LB') segue o corredor ate o
 *  ponto `parada` (indice nos pontos do proprio corredor; sem ele, ate o fim)
 *  e dali o roteador (lib/rota.js) a leva ao destino `ate`, com `passos`
 *  escritos como no isometrico, do destino para o corredor.
 *
 *  Destinos (site/pipeways.js os acha no entorno):
 *    TQ-0x.E/S/F   entrada, saida (succao) e enchimento do tanque
 *    TORRE.R       retorno quente, no costado sul, no alto
 *    CALDEIRA.V    saida de vapor, no topo do casco
 *    ARMAZEM.P     passagem na parede norte do armazem
 *    <TAG>.S/D     succao e descarga das bombas de fora (BOMBAS_OSBL)
 *    TE-CWS        te que junta as descargas das bombas da torre
 *    TQ-AA.C       tanque de agua de alimentacao da caldeira
 * ------------------------------------------------------------------------- */
export const LINHAS_OSBL = [
  // Purga: desce ao lado do pipeway, corre baixa (1,4 m, por cima da mureta
  // de 1,0 m) e entra no TQ-03 perto do fundo.
  // Para 1,65 m antes da ultima virada (ponto colinear) — depois da cabeceira
  // da ponte sobre o anel dos tanques e antes da curva da 30, que vira por
  // dentro dela: parando na virada, ela cruzaria essa curva.
  { linha: '27', de: 'LB', corredor: 'oeste', parada: 3, ate: 'TQ-03.E', passos: ['y:1.4', 'z:B-1.0', 'x:B'] },
  { linha: '30', de: 'LB', corredor: 'oeste', ate: 'BT-01.D' },
  { linha: '28', de: 'LB', corredor: 'armazem', ate: 'ARMAZEM.P' },
  { linha: 'CWS', de: 'LB', corredor: 'torre', parada: 1, ate: 'TE-CWS' },
  { linha: 'CWR', de: 'LB', corredor: 'torre', ate: 'TORRE.R' },
  // Sai do topo do casco, corre sob a cobertura e sobe fora dela.
  { linha: 'STM', de: 'LB', corredor: 'caldeira', ate: 'CALDEIRA.V', passos: ['z:B'] },
  { linha: 'COND', de: 'LB', corredor: 'caldeira', parada: 0, ate: 'TQ-AA.C' },
  // Descarga de tolueno: do braco 1 sobe fora do beiral, corre no nivel 2 e
  // entra no alto do TQ-01 (tubo interno ate o fundo: enchimento sem queda
  // livre, que gera carga estatica no tolueno). Ramal para o TQ-02 no te.
  { linha: 'DT', de: 'BRACO-1.S', corredor: 'descarga', ate: 'TQ-01.F', nivel: 2, dn: 80, fluido: 'TOL',
    passosDe: ['z:B'] },
];

/* Ramais curtos entre pecas de fora: `de` e `para` sao destinos como acima,
 * ou 'LINHA@k' (a linha no ponto k do corredor dela). */
export const RAMAIS_OSBL = [
  { id: 'DT-2', linha: 'DT', de: 'TQ-02.F', para: 'DT@1', dn: 80, fluido: 'TOL', servico: 'Enchimento do TQ-02' },
  { id: 'DT-B2', linha: 'DT', de: 'BRACO-2.S', para: 'BRACO-1.T', dn: 80, fluido: 'TOL', servico: 'Braço 2 ao coletor', passos: ['z:B'] },
  { id: 'SUC-TQ02', linha: '30', de: 'TQ-02.S', para: 'BT-01.S', dn: 40, fluido: 'TOL', succao: true, servico: 'Sucção da BT-01 no TQ-02' },
  { id: 'SUC-TQ01', linha: '30', de: 'TQ-01.S', para: 'TE-SUC', dn: 40, fluido: 'TOL', succao: true, servico: 'Sucção da BT-01 no TQ-01',
    passos: ['z:B'] },
  // Succao e descarga das bombas da torre pela velocidade (Fase 23): os
  // 224 m³/h dao 1,2 m/s em DN 250 (max. 1,5 na succao) e 1,9 m/s em
  // DN 200 (max. 3,0); em DN 200 e DN 150 davam 1,9 e 3,3 m/s. A succao
  // fica uma bitola acima do bocal da bomba (reducao excentrica nele).
  { id: 'SUC-A', linha: 'CWS', de: 'TORRE.S1', para: 'BAR-01A.S', dn: 250, fluido: 'CW', succao: true, servico: 'Sucção da BAR-01A na bacia' },
  { id: 'SUC-B', linha: 'CWS', de: 'TORRE.S2', para: 'BAR-01B.S', dn: 250, fluido: 'CW', succao: true, servico: 'Sucção da BAR-01B na bacia' },
  { id: 'DESC-A', linha: 'CWS', de: 'BAR-01A.D', para: 'TE-CWS', dn: 200, fluido: 'CW', servico: 'Descarga da BAR-01A' },
  { id: 'DESC-B', linha: 'CWS', de: 'BAR-01B.D', para: 'TE-CWS', dn: 200, fluido: 'CW', servico: 'Descarga da BAR-01B' },
];

/* Te do coletor de succao da BT-01: 2 m fora da mureta sul da bacia. O TQ-01
 * entra nele pelo lado; o TQ-02 passa reto ate a bomba. */
export const TE_SUCCAO = { z: tanques.z[1] - BACIA.recuo + 2.0 };

/* ----------------------------------------------------------------------------
 *  EQUIPAMENTO DE FORA DOS LIMITES — o que o P&ID nao traz e a interligacao
 *  exige para fechar. Posicao: a descarga fica sob a parada da linha
 *  (`sob`), deslocada `dx` em X; a succao aponta para `succaoPara`.
 * ------------------------------------------------------------------------- */
export const BOMBAS_OSBL = [
  { tag: 'BT-01', nome: 'Bomba de transferência de tolueno', sob: '30', dx: 0, succaoPara: '-z',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.16, potencia: 2.2 },
    ficha: {
      'Serviço': 'Tolueno de reposição dos TQ-01/02 para o F-02 (linha 30)',
      'Vazão': '1 656 kg/h ≈ 1,9 m³/h (S-30)',
      'Por quê': 'O tanque é atmosférico e o pipeway corre a 5,2 m: sem bomba o tolueno não chega ao limite de bateria',
      'Posição': 'Fora da bacia, ao lado da mureta (bomba não fica dentro do dique)',
      'Motor (estimado)': '2,2 kW',
    } },
  { tag: 'BAR-01A', nome: 'Bomba de água de resfriamento', sob: 'CWS', dx: -1.0, succaoPara: '-z',
    geom: { dnSuccao: 200, dnDescarga: 150, rotor: 0.33, potencia: 37 },
    ficha: {
      'Serviço': 'Circula a água da bacia da torre para o processo (CWS)',
      'Vazão': '224 m³/h (Quadro B9 + E-04)',
      'Altura (estimada)': '≈ 35 m: 7 m até o pipeway, trocadores e retorno ao alto da torre',
      'Motor (estimado)': '37 kW — ρgQH/η = 1000 × 9,81 × 0,062 × 35 / 0,75 ≈ 28 kW',
      'Reserva': 'BAR-01B, ao lado',
    } },
  { tag: 'BAR-01B', nome: 'Bomba de água de resfriamento (reserva)', sob: 'CWS', dx: 1.0, succaoPara: '-z',
    geom: { dnSuccao: 200, dnDescarga: 150, rotor: 0.33, potencia: 37 },
    ficha: { 'Serviço': 'Reserva instalada da BAR-01A', 'Vazão': '224 m³/h' } },
];

/* Tanque de agua de alimentacao da caldeira [ESTIMADO]: recebe o condensado
 * de volta. 2 637 kg/h por 20 min ~ 0,9 m³ de reserva util -> Ø 1,0 x 2,0 m
 * (1,6 m³, 60 % cheio). O bocal de topo fica sob a parada da COND. */
export const TANQUE_ALIMENTACAO = { tag: 'TQ-AA', D: 1.0, L: 2.0, altura: 0.5, sob: 'COND' };

/* Bocais dos tanques do parque, acima da base anelar (0,3 m). */
export const BOCAIS_TANQUE = {
  'TQ-03': { E: { lado: '+z', altura: 0.5, dn: 15 } },
};

/* ----------------------------------------------------------------------------
 *  DRENAGEM FECHADA ate a ETE — enterrada, por gravidade: da caixa coletora
 *  da laje ao separador agua-oleo. Caixa de inspecao a cada mudanca de
 *  direcao. [ADOTADO] 1 % de caimento, geratriz a 1,0 m na saida.
 *  DN [ESTIMADO] pela chuva na laje (agua.js): o menor que leva os 68 m³/h
 *  a secao plena — DN 200 (o DN 150 da laje antiga leva 55 m³/h).
 * ------------------------------------------------------------------------- */
const ete = bloco('ETE');
const { entradaSao } = arranjoEte(ete);
export const DRENAGEM = {
  dn: dnDrenagem(0.01), caimento: 0.01, profundidade: 1.0,
  // Entra no bloco da ETE pela borda leste e desce, junto dela, ate a
  // entrada do separador (arranjoEte, entorno.js), que fica nessa borda.
  pontos: [
    [CONTENCAO.caixa.x, CONTENCAO.caixa.z],
    [ete.x[1] - 0.5, CONTENCAO.caixa.z],
    [ete.x[1] - 0.5, entradaSao[1]],
    entradaSao,
  ],
  destino: 'Separador água-óleo da ETE',
};
DRENAGEM.comprimento = DRENAGEM.pontos.slice(1)
  .reduce((s, [x, z], i) => s + Math.hypot(x - DRENAGEM.pontos[i][0], z - DRENAGEM.pontos[i][1]), 0);
// geratriz inferior do tubo na entrada do separador (m, 0 no piso; negativa)
DRENAGEM.fundoChegada = -(DRENAGEM.profundidade + DN[DRENAGEM.dn].od + DRENAGEM.caimento * DRENAGEM.comprimento);

/* A ETE se acomoda a cota da drenagem (Fase 15): o tubo chega ao separador
 * ~1,6 m abaixo do piso, entao o separador fica enterrado, com a lamina
 * 0,1 m abaixo do fundo do tubo [ADOTADO, o tubo nunca afoga], e passa por
 * gravidade a equalizacao, tambem enterrada, 0,15 m abaixo [ADOTADO, perda
 * no vertedor]. Da equalizacao o efluente sobe por bomba ao biologico, que
 * fica acima do chao, e dai desce por gravidade ao decantador. */
export const NIVEIS_ETE = {
  separador: DRENAGEM.fundoChegada - 0.1,
  equalizacao: DRENAGEM.fundoChegada - 0.25,
};

/* Rampas da mureta: veiculo entra na laje passando sob o pipeway do
 * acostamento — contam como via (altura livre, poste fora). */
export const ACESSOS = CONTENCAO.rampas
  .filter((r) => r.lado === 'oeste' || r.lado === 'leste')
  .map((r) => {
    const oeste = r.lado === 'oeste';
    return {
      id: `rampa-${r.lado}`, motivo: r.motivo,
      x0: oeste ? anel.x0 + anel.m : isbl.x[1], x1: oeste ? isbl.x[0] : anel.x1 - anel.m,
      z0: r.centro - r.largura / 2, z1: r.centro + r.largura / 2,
    };
  });

export { LIMITES };
