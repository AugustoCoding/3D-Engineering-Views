/**
 * ============================================================================
 *  TOPOLOGIA DO P&ID  —  linhas, bombas, valvulas e malhas de controle
 * ============================================================================
 *
 *  [OFICIAL] Diagrama PI.pdf, Rev. 1 (27/09/2026), conferido com o Datasheet
 *  Global (linhas de cada folha) e com o Relatorio, §6.1 (malhas).
 *
 *  Este arquivo diz O QUE LIGA EM QUE. Nao tem geometria: posicao e rota sao
 *  da maquete (src/main.js e src/equipment/tubulacao.js). Tubulacao, bombas,
 *  valvulas e instrumentos da maquete partem daqui.
 *
 *  Convencoes
 *    - Uma LINHA vai de um no a outro do P&ID; o numero muda onde o desenho
 *      muda (ex.: 05 ate a BC-02, 05A dela em diante). `via` lista, em ordem,
 *      bombas e valvulas atravessadas pelo caminho.
 *    - `dn` em mm (DN), a partir da polegada do rotulo.
 *    - `origem` e o que esta fora do P&ID: 'datasheet' quando so a folha de
 *      especificacao traz a linha; 'proposta' quando e acrescimo da maquete,
 *      aceito provisoriamente e pendente de revisao da equipe.
 *    - `obs` registra divergencia entre documentos, em vez de escolher calado.
 *    - `de`/`para` com NUMERO de linha (ex.: '21') e um ramal com te nela.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 *  CODIGOS DE FLUIDO   [OFICIAL] Relatorio, Quadro 13 (e legenda do P&ID)
 * ------------------------------------------------------------------------- */
export const CODIGOS = {
  AR: 'Ar de processo',
  MRV: 'Mistura reacional vaporizada',
  MR: 'Mistura reacional',
  TOL: 'Tolueno',
  AB: 'Ácido benzoico',
  'TOL/AB': 'Mistura de tolueno e ácido benzoico',
  'AB/TOL': 'Mistura de tolueno e ácido benzoico',
  'T/H2O': 'Mistura de tolueno e água',
  H2O: 'Água',
  LM: 'Licor-mãe',
  'TORTA-AB': 'Torta de ácido benzoico',
  CW: 'Água de resfriamento',
  STM: 'Vapor de aquecimento',
  COND: 'Condensado',
};

export const MATERIAIS = {
  CS40: 'Aço carbono, Schedule 40',
  SS304L: 'Aço inoxidável AISI 304L',
};

/* ----------------------------------------------------------------------------
 *  CORRENTES   [OFICIAL] Relatorio, Quadros A3, A4 e A5 (balanco de massa)
 *  Vazoes em kg/h; T em °C; P em bar. Ordem: tolueno, O2, N2, AB, agua.
 * ------------------------------------------------------------------------- */
const c = (tol, o2, n2, ab, h2o, total, T, P) => ({ tol, o2, n2, ab, h2o, total, T, P });
export const CORRENTES = {
  'S-01': c(0, 810, 2681, 0, 0, 3491, 25, 15),
  'S-02': c(2983, 16, 2681, 0, 298, 5978, 140, 15),
  'S-03': c(2983, 16, 2681, 0, 298, 5978, 50, 15),
  'S-04': c(0, 16, 2681, 0, 0, 2697, 50, 15),
  'S-05': c(2983, 0, 0, 0, 298, 3281, 50, 15),
  'S-06': c(2983, 0, 0, 0, 298, 3281, 50, 1),
  'S-07': c(0, 0, 0, 0, 298, 298, 50, 1),
  'S-08': c(2983, 0, 0, 0, 0, 2983, 50, 1),
  'S-09': c(2837, 0, 0, 0, 0, 2837, 60, 1),
  'S-10': c(2837, 0, 0, 0, 0, 2837, 60, 1),
  'S-11': c(15719, 0, 0, 3930, 0, 19649, 140, 15),
  'S-12': c(15719, 0, 0, 3930, 0, 19649, 154, 1.3),
  'S-13': c(11789.2, 0, 0, 0, 0, 11789, 110, 1.3),
  'S-14': c(9099, 0, 0, 0, 0, 9099, 110, 1.3),
  'S-15': c(20226, 0, 0, 1910, 0, 22136, 103, 1),
  'S-16': c(20226, 0, 0, 1910, 0, 22136, 103, 15),
  'S-17': c(20226, 0, 0, 1910, 0, 22136, 140, 15),
  'S-18': c(3930, 0, 0, 3930, 0, 7860, 125, 1),
  'S-19': c(9571, 0, 0, 5704, 0, 15275, 50, 1),
  'S-20': c(9571, 0, 0, 5704, 0, 15275, 50, 1),
  'S-21': c(11239, 0, 0, 1930, 0, 13169, 50, 1),
  'S-22': c(11127, 0, 0, 1910, 0, 13037, 50, 1),
  'S-23': c(1161, 0, 0, 3774, 0, 4943, 50, 1),
  'S-24': c(4006, 0, 0, 3774, 0, 7780, 76, 1),
  'S-25': c(4006, 0, 0, 3774, 0, 7780, 58, 1),
  'S-26': c(5642, 0, 0, 1774, 0, 7416, 58, 1),
  'S-27': c(112, 0, 0, 19, 0, 132, 50, 1),
  'S-28': c(20, 0, 0, 2000, 0, 2020, 58, 1),
  'S-29': c(2690, 0, 0, 0, 0, 2690, 110, 1.3),
  'S-30': c(1656, 0, 0, 0, 0, 1656, 25, 1),
  'S-31': c(11127, 0, 0, 1910, 0, 13037, 65, 1),
  'S-32': c(3930, 0, 0, 3930, 0, 7860, 155, 1.3),
};

/* ----------------------------------------------------------------------------
 *  PRESSAO DE OPERACAO (bar abs)   [OFICIAL] Relatorio, Quadro B3 — exceto os
 *  marcados: V-01 e V-02 pelas correntes que saem deles (Quadro A3), E-03 e
 *  E-04 pela corrente que passa, filtros [ESTIMADO] (cuba aberta: 1 bar; o
 *  vacuo fica dentro do tambor). E o que a auditoria de viabilidade usa para
 *  saber ate onde um liquido sobe sem bomba.
 * ------------------------------------------------------------------------- */
export const PRESSAO = {
  'R-01': 15, 'T-01': 1.36, 'E-01': 14.5, 'CR-01': 1, 'CR-02': 1, 'D-01': 1,
  'E-03': 1, 'TK-01': 1, 'V-01': 15, 'V-02': 1, 'E-04': 1.3, 'E-02': 15,
  'F-01': 1, 'F-02': 1,
};

/* ----------------------------------------------------------------------------
 *  UTILIDADES   [OFICIAL] Relatorio, Quadro B9 — exceto o E-04, que o quadro
 *  nao traz: 66 m³/h [ESTIMADO] pelo calor de condensacao do topo do T-01
 *  (ver plant-extra.js). Vapor a pressao da pendencia I (8–10 bar).
 *  `linhas`: numero no Datasheet, quando ha.
 * ------------------------------------------------------------------------- */
export const UTILIDADES = [
  { equip: 'R-01', fluido: 'CW', vazao: '87 m³/h', calor: '2 576 kW removidos', linhas: ['1A', '1B'] },
  { equip: 'E-01', fluido: 'CW', vazao: '37 m³/h', calor: '647 kW removidos' },
  { equip: 'E-04', fluido: 'CW', vazao: '≈ 66 m³/h (estimado)', calor: '≈ 1 150 kW removidos (estimado)' },
  { equip: 'CR-01', fluido: 'CW', vazao: '26 m³/h', calor: '447 kW removidos' },
  { equip: 'CR-02', fluido: 'CW', vazao: '8 m³/h', calor: '144 kW removidos' },
  { equip: 'E-02', fluido: 'STM', vazao: '645 kg/h', calor: '394 kW fornecidos' },
  { equip: 'T-01', fluido: 'STM', vazao: '1 603 kg/h', calor: '980 kW fornecidos', linhas: ['12A', '12B'] },
  { equip: 'D-01', fluido: 'STM', vazao: '389 kg/h', calor: '238 kW fornecidos' },
];

/* Polegada -> DN. So as que o P&ID e o Datasheet usam. */
const POL = { '½': 15, '1': 25, '1¼': 32, '2': 50, '2½': 65, '3': 80, '4': 100, '6': 150 };

function linha(pol, fluido, numero, material, de, para, extra = {}) {
  return {
    id: `${pol}"-${fluido}-${numero}-${material}`,
    dn: POL[pol], fluido, numero, material, de, para,
    via: [], ...extra,
  };
}

/* ----------------------------------------------------------------------------
 *  LINHAS
 *  `de` e `para` sao TAGs; 'LB' = limite de bateria (fora da planta).
 * ------------------------------------------------------------------------- */
export const LINHAS = [
  // --- reacao ---
  linha('2½', 'AR', '01', 'CS40', 'LB', 'R-01', { via: ['CP-01'], corrente: 'S-01' }),
  linha('6', 'MRV', '02', 'CS40', 'R-01', 'E-01', { corrente: 'S-02' }),
  linha('3', 'CW', '1A', 'CS40', 'LB', 'R-01', { via: ['V-01'], obs: 'Entrada da camisa do R-01' }),
  linha('3', 'CW', '1B', 'CS40', 'R-01', 'LB', { obs: 'Saída da camisa do R-01' }),
  linha('3', 'TOL/AB', '11', 'SS304L', 'R-01', 'T-01', { via: ['V-02', 'V-03b'], corrente: 'S-11',
    obs: 'Vira a 12 depois da válvula de expansão (V-03 da linha 12)' }),

  // --- recuperacao de gases e condensado de topo ---
  linha('3', 'MR', '03', 'CS40', 'E-01', 'V-01', { corrente: 'S-03' }),
  linha('2', 'AR', '04', 'CS40', 'V-01', 'LB', { corrente: 'S-04',
    obs: 'Vent de N₂/O₂. O Datasheet cita saída "por V-06", que não aparece no P&ID' }),
  linha('2', 'T/H2O', '05', 'CS40', 'V-01', 'BC-02', { corrente: 'S-05' }),
  linha('2', 'T/H2O', '05A', 'CS40', 'BC-02', 'V-08', { via: ['V-07'] }),
  linha('1¼', 'T/H2O', '06', 'CS40', 'V-08', 'V-02', { corrente: 'S-06' }),
  linha('½', 'H2O', '07', 'CS40', 'V-02', 'LB', { corrente: 'S-07', obs: 'Água de subproduto para descarte' }),
  linha('1¼', 'TOL', '08', 'CS40', 'V-02', 'TK-01', { via: ['V-09', 'BC-03'], corrente: 'S-08' }),

  // --- vaso flash e reciclo ---
  linha('3', 'TOL/AB', '12', 'SS304L', 'V-03b', 'T-01', { corrente: 'S-12' }),
  linha('3', 'TOL', '13', 'CS40', 'T-01', 'V-14', { via: ['E-04'], corrente: 'S-13',
    obs: 'Pela eq. C18, 0,871 m³/s de vapor: ~180 m/s em 3". Pendência de engenharia' }),
  // O P&ID desenha a ligacao V-14 -> V-15 sem rotulo; o balanco a chama de
  // S-14. O nome segue a convencao do Relatorio (DN-fluido-corrente-material)
  // e o DN, o da 13 e da 16A, entre as quais ela fica.
  linha('3', 'TOL', '14', 'CS40', 'V-14', 'V-15', { corrente: 'S-14', origem: 'desenho',
    obs: 'Desenhada sem rótulo no P&ID; nome e DN pela convenção do Relatório' }),
  linha('1', 'TOL', '29A', 'CS40', 'V-14', 'BC-04'),
  linha('1¼', 'TOL', '29', 'CS40', 'BC-04', 'TK-01', { corrente: 'S-29' }),
  linha('3', 'TOL/AB', '16A', 'SS304L', 'V-15', 'BC-01', { corrente: 'S-15',
    obs: 'Reciclo de topo (V-14) somado ao licor-mãe aquecido (linha 31)' }),
  linha('3', 'TOL/AB', '16', 'SS304L', 'BC-01', 'E-02', { corrente: 'S-16' }),
  linha('3', 'TOL/AB', '17', 'SS304L', 'E-02', 'R-01', { via: ['V-03'], corrente: 'S-17' }),
  linha('3', 'STM', '12A', 'CS40', 'LB', 'T-01', { origem: 'datasheet', obs: 'Vapor da serpentina; não desenhada no P&ID' }),
  linha('1', 'COND', '12B', 'CS40', 'T-01', 'LB', { origem: 'datasheet', obs: 'Condensado da serpentina; não desenhada no P&ID' }),

  // --- cristalizacao 1 e filtracao 1 ---
  linha('3', 'TOL/AB', '32', 'SS304L', 'T-01', 'E-03', { via: ['BC-11', 'V-05'], corrente: 'S-32',
    obs: 'BC-11 é proposta da maquete — ver BOMBAS' }),
  linha('2½', 'AB/TOL', '19', 'SS304L', 'E-03', 'CR-01', { via: ['V-16', 'V-17'], corrente: 'S-18 → S-19',
    obs: 'Trecho E-03 → V-16 sem rótulo no P&ID (corrente 18); a 26 entra na V-16' }),
  linha('6', 'AB/TOL', '20', 'SS304L', 'CR-01', 'F-01', { corrente: 'S-20',
    obs: 'O Datasheet do CR-01 diz 316L na coluna de material; a tag e o Datasheet do F-01 dizem 304L' }),
  linha('2½', 'LM', '21', 'CS40', 'F-01', 'E-03', { via: ['BC-10'], corrente: 'S-21 → S-22',
    obs: 'A purga S-27 (132 kg/h) sai desta corrente no balanço, mas não está desenhada no P&ID. '
      + 'BC-10 é proposta da maquete — ver BOMBAS' }),
  // Purga: existe no balanco (S-27, Quadro A5) e nao no P&ID — pendencia D.
  // Ramal na 21, ate o tanque de purga TQ-03 (site.js). DN pela vazao: 132
  // kg/h de licor sao 0,16 m³/h, que nem ½" aproveita; fica no menor DN da
  // planta, o da 07.
  linha('½', 'LM', '27', 'CS40', '21', 'LB', { corrente: 'S-27', origem: 'balanco',
    obs: 'Não desenhada no P&ID (pendência D): sai do balanço de massa' }),
  linha('2½', 'LM', '31', 'CS40', 'E-03', 'V-15', { via: ['BC-05'], corrente: 'S-31' }),
  linha('1¼', 'TOL', '09', 'CS40', 'TK-01', 'BC-06', { via: ['V-12'], corrente: 'S-09' }),
  linha('1¼', 'TOL', '09A', 'CS40', 'BC-06', 'F-01', { via: ['V-19'], obs: 'Lavagem da torta' }),

  // --- dissolucao, cristalizacao 2 e filtracao 2 ---
  linha('3', 'AB/TOL', '23', 'CS40', 'F-01', 'D-01', { via: ['BD-01'], corrente: 'S-23',
    obs: 'O P&ID rotula 3"-AB/TOL-21-SS304L; vale o Datasheet (a 21 é o licor-mãe)' }),
  linha('1¼', 'TOL', '10', 'CS40', 'TK-01', 'D-01', { via: ['V-13', 'BC-09', 'V-20'], corrente: 'S-10',
    obs: 'BC-09 é proposta da maquete — ver BOMBAS' }),
  linha('2', 'AB/TOL', '24', 'SS304L', 'D-01', 'BC-07', { corrente: 'S-24' }),
  linha('2½', 'AB/TOL', '24A', 'SS304L', 'BC-07', 'CR-02', { via: ['V-18'] }),
  linha('6', 'AB/TOL', '25', 'SS304L', 'CR-02', 'F-02', { corrente: 'S-25' }),
  linha('2', 'LM', '26', 'CS40', 'F-02', 'V-16', { via: ['BC-08'], corrente: 'S-26' }),
  linha('1', 'TOL', '30', 'CS40', 'LB', 'F-02', { via: ['V-21'], corrente: 'S-30', obs: 'Tolueno de reposição' }),
  linha('3', 'TORTA-AB', '28', 'SS304L', 'F-02', 'LB', { via: ['BD-02'], corrente: 'S-28',
    obs: 'O P&ID rotula "6-TORTA-AB-28"; vale o Datasheet, 3"' }),

  // --- vacuo dos filtros ---
  // O P&ID liga cada filtro a sua bomba de vacuo sem rotular a linha. Numero,
  // codigo e DN sao da maquete [ESTIMADO]: ~1 m³/min de ar por m² de tela a
  // 0,5 bar abs; F-01 (16,55 m²) ~990 m³/h, F-02 (8,22 m²) ~490 m³/h; a
  // ~25 m/s, 6" e 4". 'VAC' nao e codigo do Quadro 13.
  linha('6', 'VAC', 'V1', 'CS40', 'F-01', 'BV-01', { origem: 'desenho',
    obs: 'Ligação de vácuo desenhada sem rótulo no P&ID; número, código e DN da maquete (estimado)' }),
  linha('4', 'VAC', 'V2', 'CS40', 'F-02', 'BV-02', { origem: 'desenho',
    obs: 'Ligação de vácuo desenhada sem rótulo no P&ID; número, código e DN da maquete (estimado)' }),
];

/* ----------------------------------------------------------------------------
 *  BOMBAS
 *  BC = centrifuga, BD = deslocamento positivo (torta), BV = vacuo.
 * ------------------------------------------------------------------------- */
export const BOMBAS = [
  { tag: 'BC-01', tipo: 'centrifuga', servico: 'Reciclo de tolueno + AB para o E-02 e o R-01', succao: '16A', descarga: '16' },
  { tag: 'BC-02', tipo: 'centrifuga', servico: 'Fase líquida do V-01 para o V-02', succao: '05', descarga: '05A' },
  { tag: 'BC-03', tipo: 'centrifuga', servico: 'Tolueno recuperado do V-02 para o TK-01', succao: '08', descarga: '08' },
  { tag: 'BC-04', tipo: 'centrifuga', servico: 'Condensado do E-04 para o TK-01', succao: '29A', descarga: '29' },
  { tag: 'BC-05', tipo: 'centrifuga', servico: 'Licor-mãe aquecido do E-03 para o reciclo', succao: '31', descarga: '31' },
  { tag: 'BC-06', tipo: 'centrifuga', servico: 'Tolueno de lavagem do TK-01 para o F-01', succao: '09', descarga: '09A' },
  { tag: 'BC-07', tipo: 'centrifuga', servico: 'Solução do D-01 para o CR-02', succao: '24', descarga: '24A' },
  { tag: 'BC-08', tipo: 'centrifuga', servico: 'Filtrado do F-02 de volta ao CR-01', succao: '26', descarga: '26' },
  { tag: 'BD-01', tipo: 'deslocamento', servico: 'Torta do F-01 para o D-01', succao: '23', descarga: '23',
    obs: '§6.1: o LIC do filtro atua nela por inversor de frequência' },
  { tag: 'BD-02', tipo: 'deslocamento', servico: 'Torta de produto do F-02 para a saída', succao: '28', descarga: '28' },
  // O P&ID desenha uma bomba de vacuo em cada filtro, mas chama as duas de
  // BV-01. Sao duas (decisao de 22/10/2026); a do F-02 vira BV-02 aqui.
  { tag: 'BV-01', tipo: 'vacuo', servico: 'Vácuo do filtro F-01' },
  { tag: 'BV-02', tipo: 'vacuo', servico: 'Vácuo do filtro F-02',
    obs: 'Desenhada como BV-01 no P&ID (divergência 6)' },
  { tag: 'BC-09', tipo: 'centrifuga', servico: 'Tolueno do TK-01 para o D-01', succao: '10', descarga: '10',
    origem: 'proposta',
    obs: 'Não consta do P&ID. Sem ela a linha 10 só escoa por gravidade e o TK-01 teria de ficar ~5 m acima do piso' },
  // As duas abaixo saem da analise hidraulica da Fase 5: sem elas o liquido
  // nao chega aonde o P&ID o manda (pendencias L e M da equipe).
  { tag: 'BC-10', tipo: 'centrifuga', servico: 'Filtrado do F-01 para o E-03', succao: '21', descarga: '21',
    origem: 'proposta',
    obs: 'Não consta do P&ID. O filtrado sai de filtro a vácuo e não sobe sozinho até o E-03; o F-02 tem a BC-08 para isso' },
  { tag: 'BC-11', tipo: 'centrifuga', servico: 'Concentrado do T-01 para o E-03 e o CR-01', succao: '32', descarga: '32',
    origem: 'proposta',
    obs: 'Não consta do P&ID. O T-01 opera a 1,36 bar abs: com o próprio nível o concentrado sobe ~7 m, e o CR-01 recebe pelo topo' },
];

/* ----------------------------------------------------------------------------
 *  VALVULAS DE CONTROLE
 *  `tres_vias` marca as de mistura desenhadas como valvula de tres vias.
 *  V-03b: o P&ID repete a TAG V-03 em duas valvulas (linha 17 e linha 11/12).
 *  Aqui a segunda leva o sufixo "b" so para nao colidir — divergencia 10.
 * ------------------------------------------------------------------------- */
export const VALVULAS = [
  { tag: 'V-01', linha: '1A', funcao: 'Água de resfriamento da camisa do R-01', malha: 'TIC R-01' },
  { tag: 'V-02', linha: '11', funcao: 'Saída de licor do R-01', malha: 'LIC R-01' },
  { tag: 'V-03', linha: '17', funcao: 'Reciclo de entrada do R-01', malha: 'DIC R-01' },
  { tag: 'V-03b', linha: '11/12', funcao: 'Expansão de 15 para 1,3 bar antes do T-01', malha: 'PIC T-01 (entrada)',
    obs: 'Desenhada como V-03 no P&ID; o PFD a chama de PCV-01' },
  { tag: 'V-05', linha: '32', funcao: 'Saída de concentrado do T-01', malha: 'LIC T-01' },
  { tag: 'V-07', linha: '05A', funcao: 'Descarga da BC-02', malha: 'LIC V-01' },
  { tag: 'V-08', linha: '05A/06', funcao: 'Redução de pressão antes do V-02', malha: 'PIC V-02 (entrada)',
    obs: 'O PFD a chama de PCV-02' },
  { tag: 'V-09', linha: '08', funcao: 'Saída de tolueno do V-02', malha: 'LIC V-02' },
  { tag: 'V-12', linha: '09', funcao: 'Saída de fundo do TK-01', malha: 'LIC TK-01' },
  { tag: 'V-13', linha: '10', funcao: 'Tolueno para o D-01', malha: 'FIC TK-01 (linha 10)' },
  { tag: 'V-14', linha: '13/29A', funcao: 'Divide o condensado do E-04 entre reciclo e TK-01', tres_vias: true },
  { tag: 'V-15', linha: '16A', funcao: 'Junta o reciclo de topo ao licor-mãe aquecido (31)', tres_vias: true },
  { tag: 'V-16', linha: '19', funcao: 'Junta o filtrado do F-02 (26) ao concentrado (18)', tres_vias: true },
  { tag: 'V-17', linha: '19', funcao: 'Entrada do CR-01', malha: 'LIC CR-01' },
  { tag: 'V-18', linha: '24A', funcao: 'Entrada do CR-02', malha: 'LIC CR-02' },
  { tag: 'V-19', linha: '09A', funcao: 'Tolueno de lavagem do F-01', malha: 'FIC F-01' },
  { tag: 'V-20', linha: '10', funcao: 'Entrada de tolueno do D-01', malha: 'LIC D-01' },
  { tag: 'V-21', linha: '30', funcao: 'Tolueno de lavagem do F-02', malha: 'FIC F-02' },
];

/* V-04, V-06, V-10 e V-11 nao aparecem no P&ID; o Datasheet do V-01 cita a
 * V-06 na saida de gases. Registrado para a equipe, nao inventado aqui. */
export const VALVULAS_AUSENTES = ['V-04', 'V-06', 'V-10', 'V-11'];

/* ----------------------------------------------------------------------------
 *  MALHAS DE CONTROLE   [OFICIAL] P&ID + Relatorio §6.1
 *  `atua` e o elemento final: uma valvula, uma bomba (por inversor) ou a
 *  utilidade de um trocador/camisa quando a valvula nao esta desenhada.
 * ------------------------------------------------------------------------- */
export const MALHAS = [
  { equip: 'R-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-02', modo: 'PI', sensor: 'Pressão diferencial' },
  { equip: 'R-01', tipo: 'temperatura', instrumentos: ['TT', 'TIC'], atua: 'V-01', modo: 'PID', sensor: 'Termopar tipo K em poço de 304L' },
  { equip: 'R-01', tipo: 'composição', instrumentos: ['DT', 'DIC'], atua: 'V-03', modo: 'PI', sensor: 'Densímetro em linha (316L) na linha 11' },
  { equip: 'CP-01', tipo: 'pressão', instrumentos: ['PT', 'PIC'], atua: 'CP-01', modo: 'PI', sensor: 'Strain gauge na descarga' },
  { equip: 'E-01', tipo: 'temperatura', instrumentos: ['TT', 'TIC'], atua: 'água de resfriamento do E-01', modo: 'PI', sensor: 'Pt100 em poço de 304L, na linha 03' },
  { equip: 'V-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-07', modo: 'PI', sensor: 'Pressão diferencial, partes molhadas 304L' },
  { equip: 'V-02', tipo: 'pressão', instrumentos: ['PT', 'PIC'], atua: 'V-08', modo: 'não especificado', sensor: 'Na linha 06; só no P&ID' },
  { equip: 'V-02', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-09', modo: 'PI', sensor: 'Nível total' },
  { equip: 'TK-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-12', modo: 'PI', sensor: 'Radar sem contato' },
  { equip: 'TK-01', tipo: 'vazão', instrumentos: ['FT', 'FIC'], atua: 'V-13', modo: 'PI', sensor: 'Placa de orifício, linha 10' },
  { equip: 'E-02', tipo: 'temperatura', instrumentos: ['TT', 'TIC'], atua: 'vapor do E-02', modo: 'PI', sensor: 'Termopar tipo K em poço de 304L' },
  { equip: 'T-01', tipo: 'pressão de entrada', instrumentos: ['PT', 'PIC'], atua: 'V-03b', modo: 'PI', sensor: 'Piezorresistivo, linha 12' },
  { equip: 'T-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-05', modo: 'PI', sensor: 'Pressão diferencial' },
  { equip: 'T-01', tipo: 'pressão do vaso', instrumentos: ['PT', 'PIC'], atua: 'água do E-04', modo: 'PI', sensor: 'Piezorresistivo de baixa faixa' },
  { equip: 'CR-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-17', modo: 'não especificado', sensor: 'Radar no topo' },
  { equip: 'CR-01', tipo: 'temperatura', instrumentos: ['TT', 'TIC'], atua: 'água da camisa do CR-01', modo: 'não especificado', sensor: 'Pt100 em 316L, na saída' },
  { equip: 'F-01', tipo: 'vácuo', instrumentos: ['PT', 'PIC'], atua: 'BV-01', modo: 'PI', sensor: 'Pressão absoluta piezorresistivo' },
  { equip: 'F-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'BD-01', modo: 'PI', sensor: 'Pressão diferencial' },
  { equip: 'F-01', tipo: 'vazão de lavagem', instrumentos: ['FT', 'FIC'], atua: 'V-19', modo: 'PI', sensor: 'Placa de orifício' },
  { equip: 'D-01', tipo: 'temperatura', instrumentos: ['TT', 'TIC'], atua: 'vapor da camisa do D-01', modo: 'PID', sensor: 'Termopar tipo K em poço de 304L' },
  { equip: 'D-01', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-20', modo: 'PI', sensor: 'Pressão diferencial' },
  { equip: 'CR-02', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'V-18', modo: 'não especificado', sensor: 'Radar no topo' },
  { equip: 'CR-02', tipo: 'temperatura', instrumentos: ['TT', 'TIC'], atua: 'água da camisa do CR-02', modo: 'não especificado', sensor: 'Pt100 em 316L, na saída' },
  { equip: 'F-02', tipo: 'vácuo', instrumentos: ['PT', 'PIC'], atua: 'BV-02', modo: 'PI', sensor: 'Pressão absoluta piezorresistivo' },
  { equip: 'F-02', tipo: 'nível', instrumentos: ['LT', 'LIC'], atua: 'BD-02', modo: 'PI', sensor: 'Pressão diferencial' },
  { equip: 'F-02', tipo: 'vazão de lavagem', instrumentos: ['FT', 'FIC'], atua: 'V-21', modo: 'PI', sensor: 'Placa de orifício' },
];

/* Equipamentos principais do P&ID — os que a Fase 2 precisa ter na cena. */
export const EQUIPAMENTOS_PID = [
  'CP-01', 'R-01', 'E-01', 'V-01', 'V-02', 'TK-01', 'E-02', 'T-01', 'E-04',
  'E-03', 'CR-01', 'F-01', 'D-01', 'CR-02', 'F-02',
];
