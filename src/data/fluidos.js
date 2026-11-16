/**
 * ===========================================================================
 *  FLUIDOS E CRITERIOS HIDRAULICOS  (Fase 23)
 * ===========================================================================
 *  Propriedades das correntes (densidade, viscosidade, pressao de vapor), o
 *  diametro interno de cada linha pelo schedule da especificacao, a perda de
 *  carga dos acessorios, as faixas de velocidade por servico e o NPSH
 *  requerido de cada bomba. lib/hidraulica.js faz as contas;
 *  dev/hidraulica.js (__auditarHidraulica) mede.
 *
 *  Toda propriedade e funcao de T (e de P, no gas) e da composicao da
 *  corrente (CORRENTES, pid.js): nada de densidade fixa por linha.
 *  Unidades: T em K nas correlacoes (°C onde dito), P em Pa, rho em kg/m³,
 *  mu em Pa·s.
 * ===========================================================================
 */

/* ----------------------------------------------------------------------------
 *  CONSTANTES   [OFICIAL] CODATA / IUPAC
 * ------------------------------------------------------------------------- */
export const R_GAS = 8314.46;               // J/(kmol·K)
export const G = 9.80665;                   // m/s²
// massas molares, kg/kmol (IUPAC); as chaves sao as de CORRENTES
export const MASSA_MOLAR = { tol: 92.14, ab: 122.12, h2o: 18.015, o2: 31.999, n2: 28.014 };

/* ----------------------------------------------------------------------------
 *  DENSIDADE DO LIQUIDO   DIPPR 105: rho = C1 / C2^(1 + (1 - T/C3)^C4)
 *  (kmol/m³, T em K). [OFICIAL] Perry's Chemical Engineers' Handbook, 8ª ed.,
 *  Tabela 2-32. Conferido: tolueno a 25 °C da 864 kg/m³ (tabelado 862);
 *  acido benzoico a 130 °C da 1 078 kg/m³ (tabelado 1 075, liquido).
 *  Abaixo da fusao (122,4 °C) o acido benzoico esta dissolvido no tolueno ou
 *  em cristais: a correlacao extrapolada da o volume do soluto [ESTIMADO] —
 *  1 154 kg/m³ a 50 °C, entre o liquido (1 075) e o cristal (1 266).
 *  Mistura: volumes aditivos, 1/rho = soma(w_i / rho_i) [ESTIMADO].
 * ------------------------------------------------------------------------- */
export const DIPPR105 = {
  tol: { C1: 0.8792, C2: 0.27136, C3: 591.75, C4: 0.29241 },
  ab: { C1: 0.71587, C2: 0.24812, C3: 751, C4: 0.28571 },
};
/* Agua liquida, 0–100 °C: Tilton e Taylor (1937), J. Phys. Chem. 41, 1–6
 *   rho = 1000 [1 - (t + 288,9414)(t - 3,9863)² / (508 929,2 (t + 68,12963))]
 * com t em °C. [OFICIAL] */
export const AGUA_TILTON = { a: 288.9414, b: 3.9863, c: 508929.2, d: 68.12963 };
// Torta umida: cristal de acido benzoico [OFICIAL] Perry, 8ª ed., Tabela 2-2
// (1 266 kg/m³, 15 °C) com o tolueno da torta, volumes aditivos.
export const RHO_CRISTAL_AB = 1266;

/* ----------------------------------------------------------------------------
 *  VISCOSIDADE DO LIQUIDO
 *  Tolueno, DIPPR 101: ln mu = C1 + C2/T + C3 ln T + C4 T^C5 (Pa·s).
 *  [OFICIAL] Perry, 8ª ed., Tabela 2-313. Conferido: 0,554 mPa·s a 25 °C
 *  (tabelado 0,56). As misturas organicas usam a do tolueno [ESTIMADO]: o
 *  acido benzoico dissolvido a sobe, mas no escoamento turbulento o fator de
 *  atrito muda pouco com ela (f ~ Re^-0,2).
 *  Agua, Vogel: mu = exp(A + B/(T - C)) mPa·s, T em K. [OFICIAL] ajuste
 *  usual de Vogel (0,895 mPa·s a 25 °C; tabelado 0,890).
 * ------------------------------------------------------------------------- */
export const DIPPR101_MU_TOL = { C1: -226.08, C2: 6805.7, C3: 37.542, C4: -0.060853, C5: 1 };
export const VOGEL_AGUA = { A: -3.7188, B: 578.919, C: 137.546 };

/* ----------------------------------------------------------------------------
 *  PRESSAO DE VAPOR
 *  Antoine, log10(P / mmHg) = A - B / (t + C), t em °C.
 *  [OFICIAL] Lange's Handbook of Chemistry (Dean), 15ª ed., Tabela 5.8:
 *    tolueno 6–137 °C; agua 1–100 °C.
 *  Acima de 137 °C (T-01, 154–155 °C) o tolueno e extrapolado: a 155 °C da
 *  3,08 bar, contra 3,09 bar do DIPPR 101 (Perry, Tabela 2-8) — 0,3 %.
 *  Acido benzoico: Clausius–Clapeyron pelos pontos de 10 e 100 mmHg da
 *  Tabela 2-8 do Perry, 8ª ed. (132,1 °C e 186,2 °C) [ESTIMADO]: a 155 °C
 *  da 28 mmHg (tabela: 20 mmHg a 146,7 °C e 40 a 162,6 °C).
 * ------------------------------------------------------------------------- */
export const ANTOINE = {
  tol: { A: 6.95464, B: 1344.8, C: 219.482, faixa: [6, 137] },
  h2o: { A: 8.07131, B: 1730.63, C: 233.426, faixa: [1, 100] },
};
export const PV_AB_PONTOS = [[132.1, 10], [186.2, 100]];      // [°C, mmHg]
export const MMHG = 133.322;                                    // Pa

/* ----------------------------------------------------------------------------
 *  UTILIDADES   condicoes que os dados de processo nao trazem
 *    CW: 25 → 40 °C [OFICIAL] Quadro B9 (a alimentacao a 25, o retorno a 40).
 *    STM: 9 bar abs, saturado, 175 °C [ESTIMADO] — o meio da faixa de 8–10
 *      bar da pendencia I (o E-02 e o T-01 pedem media pressao); Tsat de
 *      9 bar = 175,4 °C pela tabela de vapor (IAPWS-IF97). Gas ideal: 4,35
 *      kg/m³, contra 4,66 da tabela (6 % abaixo; a velocidade sai 7 % acima,
 *      do lado seguro).
 *    COND: agua a 100 °C [ESTIMADO], so o liquido — o vapor de flash do
 *      retorno nao e modelado.
 * ------------------------------------------------------------------------- */
export const CONDICAO_UTILIDADE = {
  CWS: { T: 25, P: 4 }, CWR: { T: 40, P: 2 }, CW: { T: 25, P: 4 },
  STM: { T: 175, P: 9 },
  COND: { T: 100, P: 1 },
};

/* ----------------------------------------------------------------------------
 *  CORRENTES QUE JA CHEGAM EM DUAS FASES
 *  Derivado do balanco [OFICIAL]: o vapor que o vaso a jusante separa ja se
 *  forma na linha.
 *    S-12: a V-03b leva o licor de 15 a 1,3 bar a 154 °C; o T-01 so separa o
 *      vapor (S-13) que a expansao ja formou na linha 12.
 *    S-03: o E-01 condensa o tolueno e a agua; o N₂ e o O₂ (S-04) seguem
 *      como gas com o liquido ate o V-01.
 *  Velocidade homogenea das duas fases [ESTIMADO].
 * ------------------------------------------------------------------------- */
export const DUAS_FASES = {
  'S-12': { vapor: 'S-13' },
  'S-03': { vapor: 'S-04' },
};

/* ----------------------------------------------------------------------------
 *  DIAMETRO INTERNO
 *  Espessura de parede, mm: [OFICIAL] ASME B36.10M (Sch 40, aco carbono) e
 *  ASME B36.19M (10S e 40S, inox).
 *  Schedule por material [ADOTADO]:
 *    CS40   -> Sch 40, como diz a propria especificacao.
 *    SS304L -> 10S do DN 50 para cima: a parede de 3,05 mm do 3" aguenta
 *      da ordem de 70 bar (Barlow, P = 2 S t / D, com S ~ 115 MPa e 12,5 %
 *      de tolerancia de laminacao [VERIFICAR S na Tabela A-1 da ASME B31.3])
 *      contra 15 bar de operacao; e o schedule usual de inox de processo.
 *      40S abaixo do DN 50: tubo fino de bitola pequena entorta com o peso
 *      da valvula e vibra na bomba.
 * ------------------------------------------------------------------------- */
export const ESPESSURA = {
  '40': { 15: 2.77, 20: 2.87, 25: 3.38, 32: 3.56, 40: 3.68, 50: 3.91, 65: 5.16, 80: 5.49, 100: 6.02, 150: 7.11, 200: 8.18, 250: 9.27, 300: 10.31 },
  '10S': { 15: 2.11, 20: 2.11, 25: 2.77, 32: 2.77, 40: 2.77, 50: 2.77, 65: 3.05, 80: 3.05, 100: 3.05, 150: 3.40, 200: 3.76, 250: 4.19, 300: 4.57 },
  '40S': { 15: 2.77, 20: 2.87, 25: 3.38, 32: 3.56, 40: 3.68, 50: 3.91, 65: 5.16, 80: 5.49, 100: 6.02, 150: 7.11, 200: 8.18, 250: 9.27, 300: 9.53 },
};
export const SCHEDULE = {
  CS40: () => '40',
  SS304L: (dn) => (dn >= 50 ? '10S' : '40S'),
};
// Rugosidade absoluta, m: [OFICIAL] Crane TP-410 (aco comercial, 0,046 mm);
// inox soldado 0,015 mm [ADOTADO] (parede lisa de laminacao a frio).
export const RUGOSIDADE = { CS40: 0.046e-3, SS304L: 0.015e-3 };

/* ----------------------------------------------------------------------------
 *  ACESSORIOS DA SUCCAO   [OFICIAL] Crane TP-410: K = (L/D) · fT, com fT o
 *  fator de atrito de turbulencia plena do proprio tubo.
 *    curva de 90° padrao: L/D = 30 — cada vertice da rota tracada e uma
 *    entrada de vaso (borda viva, faceando): K = 0,5
 *    valvula gaveta aberta: L/D = 8 — toda succao tem bloqueio [ADOTADO]
 * ------------------------------------------------------------------------- */
export const ACESSORIOS = { curvaLD: 30, entradaK: 0.5, gavetaLD: 8 };

/* ----------------------------------------------------------------------------
 *  FAIXAS DE VELOCIDADE POR SERVICO, m/s
 *  `min` nulo: lento nao e defeito (so custa diametro). LINHA_LENTA so se
 *  acusa quando o DN logo abaixo ainda caberia na faixa — com o menor DN
 *  da planta (a purga de ½") nao ha o que fazer.
 *  `erosao`: o maximo cai para a velocidade de erosao da API RP 14E,
 *  Ve = 1,22 · C / sqrt(rho) m/s com C = 100 (servico continuo), quando ela
 *  for menor.
 *  [ADOTADO] faixas tipicas de projeto (Towler e Sinnott, Chemical
 *  Engineering Design, 2ª ed., tubulacao e bombas; Spirax Sarco, The Steam
 *  and Condensate Loop, dimensionamento de linhas de vapor):
 * ------------------------------------------------------------------------- */
export const FAIXAS = {
  succao: { min: 0.3, max: 1.5, nome: 'líquido na sucção',
    porque: 'acima de 1,5 m/s a perda na sucção come o NPSH' },
  liquido: { min: 0.3, max: 3.0, nome: 'líquido',
    porque: 'acima de 3 m/s erosão e golpe; abaixo de 0,3 m/s a linha está superdimensionada' },
  suspensao: { min: 1.0, max: 2.5, nome: 'suspensão de cristais',
    porque: 'abaixo de ~1 m/s os cristais decantam (deposição); acima de 2,5 m/s quebram e erodem' },
  torta: { min: 0.05, max: 0.5, nome: 'torta (pasta)',
    porque: 'pasta escoa devagar: o atrito cresce com a velocidade' },
  gas: { min: null, max: 30, erosao: true, nome: 'gás ou vapor de processo',
    porque: 'acima de 30 m/s ruído, vibração e perda de carga' },
  duasFases: { min: null, max: Infinity, erosao: true, nome: 'duas fases',
    porque: 'acima da velocidade de erosão (API RP 14E) a gota arranca a parede' },
  vapor: { min: null, max: 40, nome: 'vapor de aquecimento',
    porque: 'vapor saturado: 25–40 m/s; acima, erosão por gota e ruído' },
  agua: { min: 0.6, max: 3.0, nome: 'água de resfriamento',
    porque: 'abaixo de 0,6 m/s incrustação; acima de 3 m/s erosão' },
  condensado: { min: null, max: 2.0, nome: 'condensado (só o líquido)',
    porque: 'acima de 2 m/s golpe de aríete' },
};
export const API14E_C = 100;

/* ----------------------------------------------------------------------------
 *  NPSH REQUERIDO   [ESTIMADO] pela velocidade especifica de succao
 *    Nss = N · sqrt(Q) / NPSHr^0,75   (rpm, gpm, ft)  ->  NPSHr = (N sqrt(Q) / Nss)^(4/3)
 *  no ponto de melhor rendimento (BEP) do tamanho ANSI da bomba, com:
 *    Nss = 8 500, o limite usual de projeto para operar sem recirculacao
 *      na succao (os usuarios limitam a 8 500–11 000) [VERIFICAR];
 *    Q_BEP = area do bocal de succao (Sch 40) × 3 m/s, a velocidade tipica
 *      no flange de succao no BEP: da 14 m³/h para o 1½ × 1 × 6 e 52 m³/h
 *      para o 3 × 2 × 13 (catalogos ANSI B73.1: ~14 e ~57 m³/h);
 *    N = 3 550 rpm, 2 polos em 60 Hz; as BAR-01 a 1 775 rpm (4 polos): com o
 *      rotor de 0,33 m e 35 m de altura (pipeways.js), a 3 550 rpm dariam
 *      ~140 m.
 *  Bomba de cavidade progressiva com tremonha (BD): NPIPr ~ 3 m em baixa
 *  rotacao [ESTIMADO] (ordem de grandeza de catalogo).
 * ------------------------------------------------------------------------- */
export const NPSH_REQUERIDO = {
  Nss: 8500, vBocalBEP: 3.0, rpm: 3550,
  rpmPor: { 'BAR-01A': 1775, 'BAR-01B': 1775 },
  npipDeslocamento: 3.0,
};

/* ----------------------------------------------------------------------------
 *  MARGEM DE NPSH   [ADOTADO] ANSI/HI 9.6.1 (margem de NPSH): razao
 *  NPSHa/NPSHr de 1,1 a 1,3 para servico quimico e de hidrocarboneto e de
 *  1,3 a 1,5 em torre de resfriamento; usa-se o topo de cada faixa, e nunca
 *  menos de 1 m acima do requerido [VERIFICAR a tabela na edicao usada pela
 *  disciplina].
 * ------------------------------------------------------------------------- */
export const MARGEM_NPSH = { razao: 1.3, razaoTorre: 1.5, minimo: 1.0 };

/* ----------------------------------------------------------------------------
 *  DE ONDE A BOMBA ASPIRA, quando nao e da superficie livre do vaso
 *    Vacuo do filtro: o filtrado sai do tambor a 0,5 bar abs [ESTIMADO], a
 *      mesma pressao com que se dimensionaram as BV-01/02 (plant-extra.js).
 *    Vaso em equilibrio com o vapor ou com gas (o liquido sai saturado):
 *      T-01 (flash) e V-01 (separador a 15 bar com N₂): a pressao de vapor
 *      efetiva e a do proprio vaso — so a coluna estatica empurra.
 * ------------------------------------------------------------------------- */
export const PRESSAO_SUCCAO = { 'F-01.N2': 0.5, 'F-02.N2': 0.5 };
export const SATURADOS = ['T-01', 'V-01'];

/* ----------------------------------------------------------------------------
 *  ACHADOS JA REGISTRADOS COMO PENDENCIA DA EQUIPE (ROTEIRO.md, "Pendencias
 *  para a equipe revisar"): `REGRA:id` -> letra. So numero de documento
 *  oficial (DN, vazao, pressao) entra aqui. A auditoria os conta a parte;
 *  so o que nao estiver aqui e achado novo.
 * ------------------------------------------------------------------------- */
export const ACEITOS = {
  'LINHA_RAPIDA:13': 'C',                                   // vapor do topo do T-01 em 3"
  'LINHA_RAPIDA:12': 'Q',                                   // licor flasheando depois da V-03b
  'LINHA_RAPIDA:1A': 'R', 'LINHA_RAPIDA:1B': 'R',           // agua da camisa do R-01 em 3"
  'LINHA_RAPIDA:29A': 'S',                                  // succao da BC-04 em 1"
  'LINHA_LENTA:20': 'T', 'LINHA_LENTA:25': 'T',             // suspensao em 6"
  // a BC-02 do P&ID aspira liquido saturado de N₂: a maquete nao fecha a
  // margem sem subir E-01 e V-01 juntos (pendencia K: tirar a bomba?)
  'NPSH_MARGEM_CURTA:BC-02': 'K',
};
// O que e numero da maquete (tracado, posicao e tamanho de bomba, saia,
// linha de fora proposta) nao entra aqui: adapta-se ate fechar (Fase 23).

