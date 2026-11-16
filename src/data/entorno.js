import { TORRE, ETA, ETE } from './agua.js';
import { PRACA_PORTARIA, BLOCOS, CALCADAS, VIAS, ROTAS_CAMINHAO, FAIXA_VEICULO, COMPRIMENTO_CAMINHAO } from './site.js';
import { ret, projetarNoSeg } from '../lib/plano.js';

/**
 * ============================================================================
 *  ENTORNO DA PLANTA  (Fase 7 do ROTEIRO)
 * ============================================================================
 *
 *  O que se constroi em cada bloco de site.js. Os blocos e as distancias ja
 *  foram aprovados na Fase 3; aqui so o volume de cada coisa. Nada disto esta
 *  nos documentos do grupo (o relatorio vai ate o limite de bateria): tudo e
 *  [ADOTADO] ou [ESTIMADO], com a regra ou a conta ao lado.
 *
 *  Predios sao volumes simples com fachada desenhada em canvas — sem textura
 *  externa, para o HTML continuar leve. A porta fica no lado que da para a
 *  calcada ou via mais proxima (site/entorno.js mede), e nao digitada.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 *  PREDIOS — volume dentro do bloco, recuado `recuo` m da borda dele.
 *  telhado: 'laje' (platibanda) ou 'galpao' (duas aguas, metalico).
 *  Pe-direito de 3,5 m por pavimento em escritorio; galpao pela carga.
 * ------------------------------------------------------------------------- */
export const PREDIOS = [
  // Sala de controle a 30 m do processo: predio de concreto, sem janela
  // voltada para a planta (pratica de sala resistente a sobrepressao).
  // Pressurizada e climatizada: duas condensadoras no telhado, uma de reserva
  // [ADOTADO, Fase 18].
  // `icone`: pictograma da placa de nome (ICONES, lib/predio.js)
  { bloco: 'CONTROLE', pavimentos: 1, altura: 4.5, cor: '#d4d0c8', telhado: 'laje', semJanelaPara: 'ISBL', condensadoras: 2, icone: 'controle' },
  { bloco: 'LAB', pavimentos: 1, altura: 4.2, cor: '#e2ded6', telhado: 'laje', icone: 'laboratorio' },
  { bloco: 'OFICINA', pavimentos: 1, altura: 7.5, cor: '#c7cbd0', telhado: 'galpao', portoes: 2, icone: 'oficina' },
  // Armazem de produto: torta seca em sacaria. O caminhao entra pelo portao
  // de garagem, no fim da via de servico, e e carregado la dentro (27/10,
  // pedido do autor; eram tres docas pintadas na fachada).
  { bloco: 'ARMAZEM', pavimentos: 1, altura: 9, cor: '#c3c8cd', telhado: 'galpao', garagem: true, icone: 'armazem' },
  { bloco: 'BRIGADA', pavimentos: 1, altura: 4.0, cor: '#e6e1d8', telhado: 'laje', faixa: '#c0392b', icone: 'brigada' },
  { bloco: 'ADM', pavimentos: 2, altura: 7.5, cor: '#e8e4dc', telhado: 'laje', icone: 'adm' },
  { bloco: 'REFEITORIO', pavimentos: 1, altura: 4.5, cor: '#e6e0d4', telhado: 'laje', icone: 'refeitorio' },
  // guarita na ilha da portaria; a de vidro, com a cobertura, e da Fase 15
  { bloco: 'PORTARIA', ret: PRACA_PORTARIA.guarita, guarita: true, pavimentos: 1, altura: 2.8, cor: '#e8e4dc', telhado: 'laje' },
  { bloco: 'BOMBAS-INC', pavimentos: 1, altura: 4.5, cor: '#c84b3c', telhado: 'laje', recuo: 0.5, icone: 'incendio' },
];

export const RECUO_PADRAO = 1.5;

/* ENTRADA DO CAMINHAO NO ARMAZEM (27/10, pedido do autor). A rota de
 * produto acaba no fim da via de servico, de frente para o armazem; o
 * caminhao entra de re pela faixa da direita (manobra no patio, Fase 19) e
 * para dentro, com 2 m livres entre a traseira e as paletes. Daqui saem o
 * portao (site/entorno.js), o concreto entre a via e o portao
 * (site/chao.js) e a parada (data/ambiente.js). */
const BAU = COMPRIMENTO_CAMINHAO;
export const ENTRADA_GARAGEM = (() => {
  const rp = ROTAS_CAMINHAO.find((r) => r.id === 'produto').pontos;
  const fim = rp.at(-1), antes = rp.at(-2);
  const L = Math.hypot(fim[0] - antes[0], fim[1] - antes[1]);
  const d = [(fim[0] - antes[0]) / L, (fim[1] - antes[1]) / L];
  const dir = [-d[1], d[0]];         // direita de quem chega
  const em = (s, k = 0) => [fim[0] + d[0] * s + dir[0] * k, fim[1] + d[1] * s + dir[1] * k];
  return {
    faixa: em(0, FAIXA_VEICULO),                         // eixo do caminhao na borda do bloco
    parada: em(RECUO_PADRAO + BAU / 2 + 2, FAIXA_VEICULO), // centro do caminhao parado, la dentro
    patio: [em(RECUO_PADRAO, FAIXA_VEICULO), em(0, FAIXA_VEICULO)],
  };
})();

/* ----------------------------------------------------------------------------
 *  PORTA E ACESSO A PE (27/10, pedido do autor: nao havia calcada ate a
 *  porta). A porta de cada predio fica no meio do lado mais perto de calcada
 *  ou via — site/entorno.js le daqui — e dela sai uma calcada de
 *  LARGURA_ACESSO ate o ponto mais perto da rede de calcadas: reta, quando a
 *  calcada passa em frente; em L, quando passa de lado. Nao cruza via, e
 *  nao passa de ACESSO_MAX (alem disso o predio esta mal implantado, e a
 *  auditoria do entorno diz). [ADOTADO, NBR 9050: rota acessivel de 1,2 m
 *  no minimo]
 * ------------------------------------------------------------------------- */
export const LARGURA_ACESSO = 1.5;
const ACESSO_MAX = 30;
const recuar = (r, m) => ({ x0: r.x0 + m, x1: r.x1 - m, z0: r.z0 + m, z1: r.z1 - m });
export const retDoPredio = (p) => (p.ret ? ret(p.ret) : recuar(ret(BLOCOS.find((b) => b.id === p.bloco)), p.recuo ?? RECUO_PADRAO));
const LADOS = (r) => {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return { '+x': { m: [r.x1, cz], n: [1, 0] }, '-x': { m: [r.x0, cz], n: [-1, 0] }, '+z': { m: [cx, r.z1], n: [0, 1] }, '-z': { m: [cx, r.z0], n: [0, -1] } };
};
const maisPerto = (pt, polilinhas) => {
  let melhor = null;
  for (const pts of polilinhas) {
    for (let i = 1; i < pts.length; i++) {
      const { p } = projetarNoSeg(pt, pts[i - 1], pts[i]);
      const d = Math.hypot(p[0] - pt[0], p[1] - pt[1]);
      if (!melhor || d < melhor.d) melhor = { p, d };
    }
  }
  return melhor;
};
const cruzaVia = (pontos) => VIAS.some((v) => {
  for (let i = 1; i < pontos.length; i++) {
    const [a, b] = [pontos[i - 1], pontos[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= L; s += 0.5) {
      const q = [a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L];
      if (maisPerto(q, [v.pontos]).d < v.largura / 2) return true;
    }
  }
  return false;
});
export const PORTAS = PREDIOS.filter((p) => !p.guarita).map((p) => {
  const r = retDoPredio(p);
  // predio com garagem: o lado da via e o do portao do caminhao; a porta de
  // pedestre vai para o lado da calcada (Fase 28: a do armazem caia no
  // portao, a 30 m da calcada, do outro lado da via)
  const polis = [...CALCADAS.map((c) => c.pontos), ...(p.garagem ? [] : VIAS.map((v) => v.pontos))];
  const [lado, { m, n }] = Object.entries(LADOS(r))
    .map(([l, s]) => [l, s, maisPerto(s.m, polis).d]).sort((a, b) => a[2] - b[2])[0];
  const alvo = maisPerto(m, CALCADAS.map((c) => c.pontos));
  let acesso = null;
  if (alvo && alvo.d <= ACESSO_MAX) {
    const v = [alvo.p[0] - m[0], alvo.p[1] - m[1]];
    const dn = v[0] * n[0] + v[1] * n[1], dt = -v[0] * n[1] + v[1] * n[0];
    const canto = [m[0] + n[0] * dn, m[1] + n[1] * dn];
    if (dn > 0.5) acesso = Math.abs(dt) < 0.4 ? [m, canto] : [m, canto, alvo.p];
    if (acesso && cruzaVia(acesso)) acesso = null;
  }
  return { bloco: p.bloco, ret: r, lado, porta: m, acesso };
});

/* ----------------------------------------------------------------------------
 *  TANQUES ATMOSFERICOS — os do parque (site.js, TANQUES) e o de agua de
 *  incendio. Teto conico com caimento de 1:16 (API 650, teto autoportante).
 *  Agua de incendio [ESTIMADO]: 2 canhoes de 1 900 L/min por 2 h (NFPA 15/
 *  24, ordem de grandeza) = 456 m³ -> Ø 9 x 7,5 m.
 * ------------------------------------------------------------------------- */
export const TANQUE_INCENDIO = { id: 'TQ-AI', bloco: 'INCENDIO', D: 9, H: 7.5, servico: 'Água de incêndio', volume: '≈ 477 m³' };

/* Bacia de contencao do parque: mureta de 1,0 m (site.js, conta da NFPA 30),
 * 1 m para dentro da borda do bloco, com escada por cima em dois lados. */
export const BACIA = { bloco: 'TANQUES', altura: 1.0, largura: 0.25, recuo: 1.0 };

/* ----------------------------------------------------------------------------
 *  UTILIDADES [ESTIMADO]
 * ------------------------------------------------------------------------- */
const f1 = (v) => v.toFixed(1).replace('.', ',');
export const UTILIDADES_ENTORNO = {
  /* Torre de resfriamento: 224 m³/h (Quadro B9 + E-04); o calor e a soma
   * dos consumidores (agua.js), 5,0 MW — a ficha dizia 3,9 MW, que era a
   * vazao com 15 K de faixa; o R-01 devolve a 50,5 °C e a faixa sai 19 K.
   * Celula de tiragem induzida de 6 x 6 m leva ~150 m³/h: duas celulas. */
  torre: { bloco: 'TORRE', celulas: 2, lado: 6, altura: 7, vazao: `${Math.round(TORRE.circulacao)} m³/h`,
    calor: `≈ ${f1(TORRE.calor / 1000)} MW (faixa de ${Math.round(TORRE.faixa)} K)` },

  /* Caldeira flamotubular de pacote para 2 637 kg/h de vapor (Quadro B9),
   * ~1,8 MW. Casco Ø 2,2 x 5,5 m sob cobertura; chamine de 18 m, que sai
   * acima de qualquer telhado num raio de 30 m. Compressor de ar de
   * instrumento no mesmo bloco. */
  caldeira: { bloco: 'CALDEIRA', diametro: 2.2, comprimento: 5.5, chamine: 18, vapor: '2 637 kg/h', pressao: '8–10 bar (pendência I)' },

  /* Subestacao: dois transformadores de 1 MVA (o CP-01 sozinho pede ~355 kW)
   * e a casa de cubiculos. */
  subestacao: {
    bloco: 'SUBESTACAO', transformadores: 2, potencia: '2 × 1 MVA',
    /* Fase 18 [ADOTADO]: patio dos transformadores cercado (NR-10, area de
     * risco eletrico) a 0,6 m das bases, com portao de 1,2 m; cabos em
     * canaleta de concreto com tampa, de cada transformador a casa; a media
     * tensao chega enterrada (a subestacao fica no meio da planta: linha
     * aerea cruzaria a fabrica) por uma caixa de passagem na borda do bloco. */
    patio: { folga: 0.6, altura: 2.2, portao: 1.2 },
    canaleta: 0.6,
    entrada: 'Cabo subterrâneo de 13,8 kV da concessionária (estimado)',
  },


  /* Baia de descarga de caminhao-tanque: piso com caimento e mureta, dois
   * bracos de descarga e cobertura. */
  descarga: { bloco: 'DESCARGA', bracos: 2, passo: 8, recuoBraco: 3.2 },
};

/* Posicoes que o desenho (site/entorno.js) e os pipeways usam: uma conta so.
 * Caldeira: queimador a 1,5 m + 0,9 m da borda oeste do bloco, no meio dele. */
export function eixoCaldeira(b) {
  const u = UTILIDADES_ENTORNO.caldeira;
  return { x: b.x[0] + 1.5 + 0.9 + u.comprimento / 2, z: (b.z[0] + b.z[1]) / 2 };
}

/* ----------------------------------------------------------------------------
 *  ETA E ETE (Fase 15) — cada peca no tamanho da conta de agua.js; aqui so
 *  onde ela fica no bloco. Uma conta so para o desenho (site/entorno.js) e
 *  para a drenagem que chega ao separador (pipeways.js). [ADOTADO] margem
 *  de 1 m da borda do bloco e 1 m entre pecas (passagem de operador).
 * ------------------------------------------------------------------------- */
const MARGEM = 1, FOLGA = 1;
const PAREDES = 0.5;                              // duas paredes de 0,25 m

/* ETE: o efluente anda em U. A drenagem da laje chega pela borda leste e
 * cai no separador; dele vai para a equalizacao (que recebe tambem as
 * correntes continuas), dai para o biologico e o decantador, no oeste; o
 * lodo vai para o leito de secagem, ao sul deles. A faixa norte fica livre
 * (PATIO_ETE): e por onde o caminhao de vacuo entra, vindo da lig-ete, para
 * tirar o oleo do separador e o lodo seco. A casa de quimica (sopradores e
 * dosagem) fica no canto sudeste, onde chega a calcada. */
export const PATIO_ETE = 5.5;
export function arranjoEte(b) {
  const s = ETE.separador;
  const zN = b.z[0] + PATIO_ETE;
  const sao = { x1: b.x[1] - MARGEM, z0: zN, z1: zN + s.largura + PAREDES };
  sao.x0 = sao.x1 - s.comprimento - PAREDES;
  const le = ETE.ladoEqualizacao + PAREDES;
  const equalizacao = { x1: sao.x0 - FOLGA, x0: sao.x0 - FOLGA - le, z0: zN, z1: zN + le };
  const lb = ETE.ladoBiologico + PAREDES;
  const biologico = { x1: equalizacao.x0 - FOLGA, x0: equalizacao.x0 - FOLGA - lb, z0: zN, z1: zN + lb };
  const rd = ETE.decantadorD / 2 + 0.15;
  const decantador = { x: (biologico.x0 + biologico.x1) / 2, z: biologico.z1 + FOLGA + rd, D: ETE.decantadorD, H: ETE.decantadorH };
  const L = ETE.leito;
  const zL1 = b.z[1] - MARGEM, zL0 = zL1 - L.comprimento - PAREDES;
  const leitos = Array.from({ length: L.celulas }, (_, i) => {
    const x0 = b.x[0] + MARGEM + i * (L.largura + PAREDES);
    return { x0, x1: x0 + L.largura + PAREDES, z0: zL0, z1: zL1 };
  });
  const casa = { x1: b.x[1] - MARGEM, x0: b.x[1] - MARGEM - 6, z0: b.z[1] - MARGEM - 4.5, z1: b.z[1] - MARGEM };
  // a drenagem entra no separador pela parede leste, no meio dela
  const entradaSao = [sao.x1, (sao.z0 + sao.z1) / 2];
  return { sao, equalizacao, biologico, decantador, leitos, casa, entradaSao };
}

/* ETA: o poco fica no canto noroeste, longe das vias (protecao sanitaria);
 * os filtros e o abrandador descem pelo lado oeste ate a casa de quimica e
 * bombas, junto da calcada; o reservatorio ocupa o canto nordeste e o
 * castelo d'agua o sudeste, de onde o potavel desce por gravidade. */
export function arranjoEta(b) {
  const Rr = ETA.reservatorioD / 2 + 0.5;         // base anelar, lib/tanque.js
  const reservatorio = { x: b.x[1] - MARGEM - Rr, z: b.z[0] + MARGEM + Rr, D: ETA.reservatorioD, H: ETA.reservatorioH };
  const poco = { x: b.x[0] + MARGEM + 1, z: b.z[0] + MARGEM + 1, lado: 2 };
  const passoF = ETA.filtroD + 0.9;
  // 1 m a mais que a folga: a saida da bomba do poco desce a 0,7 m da boca
  const zF = poco.z + poco.lado / 2 + FOLGA + 1 + ETA.filtroD / 2;
  const filtros = Array.from({ length: ETA.filtros }, (_, i) => ({ x: b.x[0] + MARGEM + 0.9 + i * passoF, z: zF }));
  const A = ETA.abrandador;
  const zA = zF + ETA.filtroD / 2 + FOLGA + 1.5;
  const abrandador = Array.from({ length: A.colunas }, (_, i) => ({ x: b.x[0] + MARGEM + 0.5 + i * (A.D + 0.5), z: zA }));
  const salmoura = { x: abrandador.at(-1).x + A.D / 2 + 0.5 + A.salmouraD / 2, z: zA };
  // 7 x 5 m: tres bombas de agua tratada, a dosagem de cloro e o painel (Fase 16)
  const casa = { x0: b.x[0] + MARGEM, x1: b.x[0] + MARGEM + 7, z0: b.z[1] - MARGEM - 5, z1: b.z[1] - MARGEM };
  const meioCastelo = ETA.casteloD / 2 + 0.75;     // sapata das pernas e escada
  const castelo = { x: b.x[1] - MARGEM - meioCastelo - 0.4, z: b.z[1] - MARGEM - meioCastelo };
  return { reservatorio, poco, filtros, abrandador, salmoura, casa, castelo };
}

/** Pe de cada braco de descarga: lado a lado, recuados para o norte da baia. */
export function posicaoBracos(b) {
  const u = UTILIDADES_ENTORNO.descarga;
  const cx = (b.x[0] + b.x[1]) / 2, cz = (b.z[0] + b.z[1]) / 2;
  return Array.from({ length: u.bracos }, (_, i) => [cx - (u.passo * (u.bracos - 1)) / 2 + i * u.passo, cz - u.recuoBraco]);
}

/* ----------------------------------------------------------------------------
 *  CERCA, VIAS E ESTACIONAMENTO [ADOTADO]
 * ------------------------------------------------------------------------- */
export const CERCA = { altura: 2.4, vao: 3, larguraPortao: 8 };
// passagem: faixa sem vaga na borda leste, onde a calcada da portaria cruza
// o estacionamento [ADOTADO]
export const VAGA = { largura: 2.5, comprimento: 5, corredor: 6, passagem: 2 };
