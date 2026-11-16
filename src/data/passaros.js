/**
 * ===========================================================================
 *  PASSAROS  (Fase 27, item 21) — parametros [ADOTADO, desenho]
 * ===========================================================================
 *  site/passaros.js voa e mede. Bandos de boids (separacao, alinhamento,
 *  coesao) atras de alvos que trocam de tempos em tempos, em alturas
 *  variadas para passar entre as estruturas e nao so por cima delas; desvio
 *  quando o ponto `antever` s a frente cai na caixa de um obstaculo (com
 *  `folga`). Ave de ~0,4 m de envergadura, ~9 m/s (pombo, garca-vaqueira).
 *   bandos, n         quantos bandos e quantas aves em cada
 *   altura            faixa dos alvos, m
 *   minimo            nunca abaixo disto (a auditoria acusa)
 *   velocidade        m/s (min, max)
 *   raio              vizinhanca de cada ave, m; `separacao` m
 *   trocaAlvo         s entre um alvo e outro (min, max)
 *   obstaculoMin      so entra como obstaculo o que passa desta altura, m
 *   (com voo a ~9 m/s e aceleracao lateral de 4 m/s² o raio de curva e
 *   ~20 m: o alvo e a parede tem de puxar forte, senao o bando sai do lote)
 *   batida            batidas de asa por segundo
 * ===========================================================================
 */
export const PASSAROS = {
  bandos: 2, n: 12,
  // de 12 m para cima passam entre o que e alto (vasos, chamine, mastros)
  // e nao entre as casas
  altura: [12, 32], minimo: 6,
  velocidade: [7, 11],
  raio: 6, separacao: 1.4,
  // aceleracoes, m/s²: o alvo puxa `alvo`; a `parede` (a `margem` m da
  // borda do lote) devolve para o meio; o desvio empurra `desviar`
  pesos: { separar: 1.6, alinhar: 0.8, juntar: 0.6, alvo: 4, parede: 8, desviar: 20 }, margem: 20,
  antever: 1.5, folga: 3,
  trocaAlvo: [12, 25],
  obstaculoMin: 4,
  envergadura: 0.42, batida: 3.2,
  cor: 0x2b2b2b,
};
