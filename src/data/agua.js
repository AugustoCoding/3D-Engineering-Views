/**
 * ============================================================================
 *  BALANCO DE AGUA DA PLANTA
 * ============================================================================
 *
 *  O relatorio do grupo vai ate o limite de bateria e nao traz o balanco de
 *  agua; o processo em si nao consome agua (nenhuma corrente do Quadro A3
 *  entra com agua) e devolve a S-07. O que consome e utilidade: a reposicao
 *  da torre, a da caldeira e a gente. Daqui saem a capacidade da ETA e o
 *  tamanho da ETE — e quem desenha (Fase 14) le os numeros daqui.
 *
 *  Tudo o que nao vem dos documentos e [ESTIMADO] ou [ADOTADO], com a conta
 *  ao lado. Vazoes em m³/h (agua a 1 000 kg/m³), calor em kW.
 * ============================================================================
 */
import { UTILIDADES, CORRENTES } from './pid.js';
import { LAJE_PROPOSTA } from './arranjo-proposto.js';
import { CONTENCAO } from './arranjo.js';

/** Primeiro numero de um texto como '2 576 kW removidos' ou '≈ 66 m³/h'. */
const numero = (s) => +String(s).match(/\d[\d\s]*(?:,\d+)?/)[0].replace(/\s/g, '').replace(',', '.');
const soma = (lista, campo) => lista.reduce((t, u) => t + numero(u[campo]), 0);

/* ----------------------------------------------------------------------------
 *  TORRE DE RESFRIAMENTO
 *  Vazao e calor dos consumidores de CW [OFICIAL] Quadro B9 (o E-04
 *  [ESTIMADO], plant-extra.js): 224 m³/h e 4 964 kW. A faixa da torre sai
 *  19 K, e nao 15: o R-01 devolve a agua a 50,5 °C (plant.js).
 *    evaporacao  E = f x Q / lambda, f = 0,85 [ESTIMADO] (o resto sai como
 *                calor sensivel do ar), lambda = 2 419 kJ/kg a 35 °C (tabela
 *                de vapor)  ->  0,85 x 4 964 / 2 419 x 3,6 = 6,3 m³/h
 *    arraste     0,02 % da circulacao [ADOTADO] (com eliminador de gotas)
 *    purga       E / (N - 1) - arraste, N = 4 ciclos de concentracao
 *                [ADOTADO] (agua de poco, com tratamento quimico)
 * ------------------------------------------------------------------------- */
const cw = UTILIDADES.filter((u) => u.fluido === 'CW');
const circulacao = soma(cw, 'vazao');
const calorTorre = soma(cw, 'calor');
const FRACAO_EVAPORACAO = 0.85;
const LAMBDA = 2419;                              // kJ/kg, agua a 35 °C
const CICLOS = 4;
const evaporacao = (FRACAO_EVAPORACAO * calorTorre) / LAMBDA * 3.6;
const arraste = 0.0002 * circulacao;
const purgaTorre = evaporacao / (CICLOS - 1) - arraste;

export const TORRE = {
  circulacao, calor: calorTorre, faixa: calorTorre / ((circulacao / 3.6) * 4.18),
  evaporacao, arraste, purga: purgaTorre, ciclos: CICLOS,
  reposicao: evaporacao + arraste + purgaTorre,
};

/* ----------------------------------------------------------------------------
 *  CALDEIRA
 *  Vapor [OFICIAL] Quadro B9: 645 + 1 603 + 389 = 2 637 kg/h (pode subir
 *  5–10 % com a pendencia I). Volta 90 % como condensado [ADOTADO]: o resto
 *  se perde em purgador e flash. Purga de fundo de 5 % do vapor [ADOTADO]
 *  (flamotubular com agua abrandada, 3 a 6 %).
 * ------------------------------------------------------------------------- */
const vapor = soma(UTILIDADES.filter((u) => u.fluido === 'STM'), 'vazao') / 1000;
const RETORNO_CONDENSADO = 0.9;
const PURGA_CALDEIRA = 0.05;
export const CALDEIRA = {
  vapor, retorno: RETORNO_CONDENSADO,
  purga: vapor * PURGA_CALDEIRA,
  reposicao: vapor * (1 - RETORNO_CONDENSADO) + vapor * PURGA_CALDEIRA,
};

/* ----------------------------------------------------------------------------
 *  GENTE E LABORATORIO
 *  50 pessoas por dia [ADOTADO]: tres turnos de 8 na operacao e ~25 em
 *  horario administrativo (administracao, laboratorio, manutencao). Uso
 *  pessoal de fabrica 70 L/pessoa/dia e refeitorio 25 L/refeicao [ESTIMADO]
 *  (ordem de grandeza das tabelas de consumo predial; a confirmar com a NBR
 *  5626). Laboratorio e lavagem de piso: 0,1 m³/h [ESTIMADO].
 * ------------------------------------------------------------------------- */
export const PESSOAS = 50;
const potavel = (PESSOAS * (70 + 25)) / 1000 / 24;
const laboratorio = 0.1;

/* ----------------------------------------------------------------------------
 *  ETA — agua de poco tubular [ADOTADO]: cloracao, filtro de areia
 *  pressurizado, reservatorio de agua tratada; abrandador para a caldeira e
 *  castelo d'agua para o consumo humano. A reserva de incendio enche com
 *  agua bruta do poco e fica fora deste balanco.
 *    consumo proprio 3 % da tratada [ADOTADO] (retrolavagem e regeneracao)
 *    capacidade nominal 12 m³/h [ADOTADO]: ~30 % sobre a demanda
 *    reservatorio de 24 h de demanda [ADOTADO]: o poco pode parar um dia
 *    castelo d'agua de 1 dia de consumo humano (NBR 5626), arredondado
 *    filtro: taxa de 10 m³/(m².h) [ADOTADO, filtro pressurizado], dois — um
 *    filtra enquanto o outro lava
 * ------------------------------------------------------------------------- */
const demanda = TORRE.reposicao + CALDEIRA.reposicao + potavel + laboratorio;
const CONSUMO_PROPRIO = 0.03;
const CAPACIDADE_ETA = 12;
const reservatorio = 24 * demanda;
const areaFiltro = CAPACIDADE_ETA / 10;
export const ETA = {
  consumidores: [
    { nome: 'Reposição da torre', vazao: TORRE.reposicao },
    { nome: 'Reposição da caldeira (abrandada)', vazao: CALDEIRA.reposicao },
    { nome: 'Consumo humano (potável)', vazao: potavel },
    { nome: 'Laboratório e lavagem', vazao: laboratorio },
  ],
  demanda,
  bruta: demanda * (1 + CONSUMO_PROPRIO),
  capacidade: CAPACIDADE_ETA,
  reservatorio,
  // Ø x H do reservatorio com H = 6 m, arredondado para cima em 0,5 m
  reservatorioH: 6,
  reservatorioD: Math.ceil(2 * Math.sqrt(reservatorio / 6 / Math.PI) * 2) / 2,
  castelo: Math.ceil((potavel * 24) / 5) * 5,
  filtros: 2,
  filtroD: Math.ceil(2 * Math.sqrt(areaFiltro / Math.PI) * 10) / 10,
};

/* ----------------------------------------------------------------------------
 *  CHUVA NA LAJE — a drenagem fechada e o separador agua-oleo recebem a
 *  chuva que cai dentro da mureta. 100 mm/h [VERIFICAR] (ordem de grandeza
 *  de 10 min com 10 anos de retorno no interior de SP; a confirmar com a
 *  equacao IDF de Campinas, DAEE). Escoamento total (C = 1, piso de
 *  concreto).
 *  Tubo da drenagem, Manning com n = 0,013 a secao plena:
 *    Q = (1/n) x (pi D²/4) x (D/4)^(2/3) x i^(1/2)
 *  DN 150 a 1 % leva 55 m³/h — a laje de 31 x 22 m pede 68: vai DN 200.
 * ------------------------------------------------------------------------- */
const areaLaje = (LAJE_PROPOSTA.x[1] - LAJE_PROPOSTA.x[0]) * (LAJE_PROPOSTA.z[1] - LAJE_PROPOSTA.z[0]);
const INTENSIDADE = 100;                          // mm/h
export const CHUVA = { intensidade: INTENSIDADE, area: areaLaje, vazao: (INTENSIDADE / 1000) * areaLaje };

/** Vazao a secao plena (m³/h) de um tubo de DN mm com caimento i (m/m). */
export function vazaoPlena(dn, i, n = 0.013) {
  const D = dn / 1000;
  return (1 / n) * (Math.PI * D * D / 4) * (D / 4) ** (2 / 3) * Math.sqrt(i) * 3600;
}

/** Menor DN que leva a chuva da laje a secao plena com caimento i. */
export function dnDrenagem(i) {
  return [100, 150, 200, 250, 300].find((dn) => vazaoPlena(dn, i) >= CHUVA.vazao);
}

/* ----------------------------------------------------------------------------
 *  ETE — o que chega continuo, mais a agua contaminada da laje.
 *    S-07 [OFICIAL] Quadro A3: 298 kg/h de agua de reacao do V-02
 *    purgas da torre e da caldeira (acima): inorganicas, nao passam pelo
 *      biologico (na Fase 15 vao direto ao lancamento, depois do decantador)
 *    rejeito da ETA: os 3 % de consumo proprio
 *    esgoto: 80 % do potavel [ADOTADO] (coeficiente de retorno, NBR 9649)
 *    laboratorio: todo
 *  Equalizacao: o que a mureta da laje segura (area x altura, cota de cima:
 *  sem descontar as bases) — derrame ou agua de incendio vao para la depois
 *  do evento — mais 8 h da vazao continua [ADOTADO].
 *  Biologico (lodo ativado) so para o que tem carga organica — S-07,
 *  esgoto e laboratorio — com 24 h de detencao [ADOTADO].
 *  Decantador secundario: 16 m³/(m².d) [ADOTADO]; nunca menos de Ø 2 m.
 * ------------------------------------------------------------------------- */
const s07 = CORRENTES['S-07'].total / 1000;
const esgoto = 0.8 * potavel;
const rejeitoEta = CONSUMO_PROPRIO * demanda;
const organico = s07 + esgoto + laboratorio;
const continua = s07 + TORRE.purga + CALDEIRA.purga + rejeitoEta + esgoto + laboratorio;
const contido = areaLaje * CONTENCAO.mureta.altura;
const equalizacao = contido + 8 * continua;
const biologico = 24 * organico;
export const ETE = {
  entradas: [
    { nome: 'Água de reação (S-07)', vazao: s07, organica: true },
    { nome: 'Purga da torre', vazao: TORRE.purga },
    { nome: 'Purga da caldeira', vazao: CALDEIRA.purga },
    { nome: 'Rejeito da ETA', vazao: rejeitoEta },
    { nome: 'Esgoto sanitário', vazao: esgoto, organica: true },
    { nome: 'Laboratório', vazao: laboratorio, organica: true },
  ],
  continua, organico,
  chuvaLaje: CHUVA.vazao,
  contido,
  equalizacao: Math.ceil(equalizacao / 10) * 10,
  biologico: Math.ceil(biologico / 5) * 5,
  decantadorD: Math.max(2, Math.ceil(2 * Math.sqrt((organico * 24) / 16 / Math.PI) * 2) / 2),
};

/* ----------------------------------------------------------------------------
 *  SEPARADOR AGUA-OLEO — gravitacional, metodo da API 421 [ESTIMADO]. A
 *  drenagem e de area com tolueno: a gota de 150 µm (a menor que a norma
 *  manda reter) sobe a
 *    vt = g (rho_agua - rho_oleo) d² / (18 mu)
 *  com agua a 20 °C (998 kg/m³, 1,0 mPa.s) e tolueno a 867 kg/m³. Canal de
 *  2,0 m de largura e 1,0 m de lamina (profundidade/largura 0,5, o teto da
 *  norma); no pico da chuva a velocidade horizontal tem de ficar abaixo de
 *  15 vt e de 0,015 m/s. Comprimento L = F (vh / vt) d, F = Ft x 1,2 (o
 *  1,2 e o curto-circuito); Ft da curva da norma [VERIFICAR: tabela de
 *  segunda mao, conferir com a API 421].
 * ------------------------------------------------------------------------- */
const vt = (9.81 * (998 - 867) * (150e-6) ** 2) / (18 * 1.0e-3);
const B_SAO = 2.0, D_SAO = 1.0;
const vh = CHUVA.vazao / 3600 / (B_SAO * D_SAO);
const FT = [[3, 1.07], [6, 1.14], [10, 1.27], [15, 1.37], [20, 1.45]];
function interpolar(tabela, x) {
  const i = Math.max(1, Math.min(tabela.length - 1, tabela.findIndex(([xi]) => xi >= x)));
  const [x0, y0] = tabela[i - 1], [x1, y1] = tabela[i];
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}
const F_SAO = interpolar(FT, vh / vt) * 1.2;
ETE.separador = {
  vt, vh, F: F_SAO, largura: B_SAO, lamina: D_SAO,
  comprimento: Math.ceil(F_SAO * (vh / vt) * D_SAO * 2) / 2,
  atende: vh / vt <= 15 && vh <= 0.015,
};

/* Volumes em planta [ADOTADO]: equalizacao com 3,0 m de lamina e
 * biologico com 2,5 m (o difusor de bolha fina pede pelo menos isso),
 * os dois quadrados, lado arredondado para cima em 0,5 m; decantador com
 * 2,5 m de parede lateral (o minimo das tabelas de projeto). Leito de
 * secagem: o lodo de excesso de 0,6 m³/h de efluente organico e pouco —
 * duas celulas de 2,5 x 4 m, uma recebe enquanto a outra seca. */
const lado = (volume, lamina) => Math.ceil(Math.sqrt(volume / lamina) * 2) / 2;
Object.assign(ETE, {
  laminaEqualizacao: 3.0, ladoEqualizacao: lado(ETE.equalizacao, 3.0),
  laminaBiologico: 2.5, ladoBiologico: lado(ETE.biologico, 2.5),
  decantadorH: 2.5,
  leito: { celulas: 2, largura: 2.5, comprimento: 4 },
});

/* ETA em planta [ADOTADO]: castelo d'agua de Ø 2,0 m com fundo a 12 m
 * (10 m.c.a. no chuveiro do vestiario, NBR 5626 pede 1 m.c.a. no ponto
 * de uso); filtro com 1,8 m de costado (0,3 m de suporte, 0,8 m de areia
 * e 0,7 m para a expansao na retrolavagem); abrandador de catalogo — duas
 * colunas de Ø 0,35 m (a menor que leva os 0,4 m³/h a 15 m/h com folga),
 * uma regenera enquanto a outra trabalha — e tanque de salmoura. */
const D_CASTELO = 2.0;
Object.assign(ETA, {
  casteloD: D_CASTELO,
  casteloH: Math.ceil((ETA.castelo / (Math.PI * D_CASTELO ** 2 / 4)) * 10) / 10,
  casteloFundo: 12,
  filtroH: 1.8,
  abrandador: { colunas: 2, D: 0.35, H: 1.5, salmouraD: 0.6, salmouraH: 1.0 },
});

/* Ficha que a vista de planta mostra no bloco. */
const f1 = (v) => v.toFixed(1).replace('.', ',');
const m3h = (v) => `${f1(v)} m³/h`;
export const FICHA_AGUA = {
  ETA: [
    { nome: 'Demanda (estimada)', dados: {
      ...Object.fromEntries(ETA.consumidores.map((c) => [c.nome, m3h(c.vazao)])),
      'Total tratado': m3h(ETA.demanda),
      'Água bruta do poço': m3h(ETA.bruta),
    } },
    { nome: 'Dimensionamento (adotado)', dados: {
      'Capacidade nominal': m3h(ETA.capacidade),
      'Reservatório de água tratada': `${Math.round(ETA.reservatorio)} m³ — 24 h (Ø ${f1(ETA.reservatorioD)} × ${ETA.reservatorioH} m)`,
      'Castelo d’água (potável)': `${ETA.castelo} m³`,
      'Filtros de areia': `${ETA.filtros} × Ø ${f1(ETA.filtroD)} m`,
      'Torre': `evapora ${m3h(TORRE.evaporacao)}, purga ${m3h(TORRE.purga)} (${TORRE.ciclos} ciclos)`,
    } },
  ],
  ETE: [
    { nome: 'Entradas contínuas (estimadas)', dados: {
      ...Object.fromEntries(ETE.entradas.map((e) => [e.nome, m3h(e.vazao)])),
      'Total': m3h(ETE.continua),
    } },
    { nome: 'Dimensionamento (adotado)', dados: {
      'Chuva na laje (pico)': `${m3h(ETE.chuvaLaje)} → separador água-óleo`,
      'Separador água-óleo': `${f1(ETE.separador.largura)} × ${f1(ETE.separador.comprimento)} m, lâmina de ${f1(ETE.separador.lamina)} m (API 421, gota de 150 µm)`,
      'Equalização': `${ETE.equalizacao} m³ (laje contida ${Math.round(ETE.contido)} m³ + 8 h)`,
      'Biológico (lodo ativado)': `${ETE.biologico} m³ — 24 h de ${m3h(ETE.organico)} com carga orgânica`,
      'Decantador secundário': `Ø ${f1(ETE.decantadorD)} m`,
    } },
  ],
};
