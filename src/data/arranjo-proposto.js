/**
 * ============================================================================
 *  ARRANJO PROPOSTO DA AREA DE PROCESSO  (Fase 11) — GERADO, nao editar a mao
 * ============================================================================
 *  Saida de src/dev/otimizador.js (__otimizarArranjo no console), pela
 *  gramatica e pelas regras de data/arranjo.js (GRUPOS, ACESSO, CUSTO).
 *  Busca: 15000 iteracoes, semente 3; ordem dos grupos aprovada em 26/10.
 *  Remontado na Fase 12: corredor transversal fora do caminho das bombas
 *  (a succao nao o atravessa), V-01 e T-01 com a entrada para quem os
 *  alimenta, vao largo entre o T-01 e o E-02 (ali descem quatro linhas).
 *  Grupos: norte DEC TK COND FLASH PRE R | sul FILT1 REC DISS FILT2 CP
 *
 *  Custo (m de tubo de 3" de aco carbono equivalente) [ESTIMADO]:
 *    hoje      3043  (tubulacao 1395, laje e rack 1647; 857 m de tubo) — arranjo da Fase 4
 *    proposta  1886  (tubulacao 1229, laje e rack 657; 662 m de tubo)
 *
 *  A Fase 12 troca o ARRANJO de arranjo.js por este e refaz as rotas.
 * ========================================================================= */

export const LAJE_PROPOSTA = { x: [-6.5, 24.5], z: [-10.48, 11.48] };

export const RACK_PROPOSTO = { z: 0.83, largura: 7 };

export const ARRANJO_PROPOSTO = [
  // fileira norte: grupo DEC
  { tag: 'V-02', x: -4.14, z: -4.08, giro: 90 },
  // fileira norte: grupo TK
  { tag: 'TK-01', x: -0.35, z: -4.87, giro: 180 },
  // fileira norte: grupo COND
  { tag: 'V-01', x: 3.1, z: -4.42, giro: 180 },
  { tag: 'E-01', x: 5.14, z: -5.69, giro: 90, saque: 1 },
  // fileira norte: grupo FLASH
  { tag: 'E-04', x: 6.91, z: -5.39, giro: 90, saque: 1 },
  { tag: 'T-01', x: 8.91, z: -4.35, giro: 180 },
  // fileira norte: grupo PRE
  { tag: 'E-02', x: 11.66, z: -5.35, giro: -90, saque: -1 },
  // fileira norte: grupo R
  { tag: 'R-01', x: 18.17, z: -6.47, giro: 90 },
  // bombas sob o rack, borda norte
  { tag: 'BC-03', x: -2.35, z: -1.58, giro: -90 },
  { tag: 'BC-06', x: -0.89, z: -1.51, giro: -90 },
  { tag: 'BC-09', x: 0.57, z: -1.58, giro: -90 },
  { tag: 'BC-02', x: 2.63, z: -1.58, giro: -90 },
  { tag: 'BC-04', x: 5.18, z: -1.58, giro: -90 },
  { tag: 'BC-01', x: 8.1, z: -1.86, giro: 0 },
  { tag: 'BC-11', x: 10.29, z: -1.5, giro: -90 },
  // fileira sul: grupo FILT1
  { tag: 'CR-01', x: -3.11, z: 7.61, giro: 180 },
  { tag: 'F-01', x: 1.72, z: 7.54, giro: 0 },
  { tag: 'BD-01', x: 4.16, z: 6.87, giro: -90 },
  // fileira sul: grupo REC
  { tag: 'E-03', x: 6.33, z: 6.69, giro: 90, saque: -1 },
  // fileira sul: grupo DISS
  { tag: 'D-01', x: 8.59, z: 6.23, giro: 180 },
  // fileira sul: grupo FILT2
  { tag: 'CR-02', x: 12.75, z: 7.2, giro: 180 },
  { tag: 'F-02', x: 16.7, z: 7.17, giro: 0 },
  { tag: 'BD-02', x: 18.66, z: 6.77, giro: -90 },
  // fileira sul: grupo CP
  { tag: 'CP-01', x: 21.98, z: 7.81, giro: 90 },
  // bombas sob o rack, borda sul
  { tag: 'BC-10', x: 1.39, z: 3.22, giro: 90 },
  { tag: 'BV-01', x: 3.62, z: 3.4, giro: 180 },
  { tag: 'BC-05', x: 6.44, z: 3.22, giro: 90 },
  { tag: 'BC-07', x: 9.19, z: 3.22, giro: 90 },
  { tag: 'BC-08', x: 14.11, z: 3.16, giro: 90 },
  { tag: 'BV-02', x: 16.7, z: 3.43, giro: 180 },
];

/* Corredores transversais pintados (o do rack e a faixa do perimetro saem
 * de LAJE_PROPOSTA, RACK_PROPOSTO e ACESSO). */
export const CORREDORES_PROPOSTOS = [
  { fileira: 'norte', x: [0.85, 2.35], z: [-10.48, -2.67] },
  { fileira: 'norte', x: [11.89, 14.89], z: [-10.48, -2.67] },
  { fileira: 'sul', x: [4.66, 6.16], z: [4.33, 11.48] },
  { fileira: 'sul', x: [9.47, 10.97], z: [4.33, 11.48] },
  { fileira: 'sul', x: [19.16, 20.66], z: [4.33, 11.48] },
];
