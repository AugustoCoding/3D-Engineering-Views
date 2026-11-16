/**
 * ===========================================================================
 *  PESSOAS COM ROTINA  (Fase 20, pedido do autor: "trajetorias longas e
 *  ciclicas de caminhada, alguns entrando e saindo dos predios, sentando
 *  nas cadeiras na frente dos PCzinhos, usando as mesas de reuniao")
 * ===========================================================================
 *  Cada papel tem uma agenda que se repete: onde vai (o bloco, ou a laje),
 *  o que faz la (a `acao` de um lugar de movel — lib/moveis.js) e quanto
 *  tempo fica. Nada de coordenada: site/rotinas.js escolhe o lugar pela
 *  acao, um por pessoa (ninguem senta na cadeira de outro), e o caminho por
 *  busca — por dentro dos predios, pelas portas, pelas calcadas e pelos
 *  corredores da laje. [ADOTADO] numeros de gente e de tempo.
 *
 *  O ciclo e de cena, nao de turno: ~10 min para se ver tudo acontecer.
 * ------------------------------------------------------------------------- */

export const VELOCIDADE_PESSOA = 1.3;   // m/s, a do trafego (data/ambiente.js)

export const PAPEIS = [
  {
    papel: 'operador', n: 3,
    roupa: { roupa: 0xf2a03d, calca: 0xd88a2c, capacete: 0xf4f4f0 },
    agenda: [
      { em: 'CONTROLE', acao: 'digitar', s: 90 },        // no console
      // inspecao (Fase 25): quatro postos, alternando valvula (gira o volante)
      // e instrumento (le e anota na prancheta), 14 s em cada
      { em: 'laje', inspecao: 4, s: 14 },
      // amostra (Fase 27, item 11): colhe na valvula de amostragem de uma
      // bomba (AMOSTRAS) e leva o frasco na mao ate a bancada do LAB, onde
      // o deixa — o laboratorista analisa na bancada dele
      { em: 'laje', amostra: 1, s: 20 },
      // sobe a escada de marinheiro do R-01 e le o instrumento da plataforma
      // (Fase 27, item 12); um operador por escada, alternando
      { em: 'laje', escada: 'R-01', s: 20 },
      { em: 'LAB', acao: 'bancada', s: 30, entrega: true },
      { em: 'CONTROLE', acao: 'digitar', s: 60 },
      { em: 'REFEITORIO', acao: 'comer', s: 50 },
    ],
  },
  {
    papel: 'administrativo', n: 4,
    roupa: { roupa: [0x3d6e9e, 0xe8e4dc, 0x6d5a8a, 0x2f5d3a], calca: 0x2f3a4a, capacete: null },
    // postos nos dois andares do ADM; reuniao na sala do 1o pavimento (sobe
    // a escada) e na supervisao da sala de controle
    agenda: [
      { em: 'ADM', acao: 'digitar', s: 120 },
      { em: 'ADM', acao: 'conversar', s: 50 },
      { em: 'ADM', acao: 'digitar', s: 80 },
      { em: 'CONTROLE', acao: 'conversar', s: 50 },
      { em: 'REFEITORIO', acao: 'comer', s: 60 },
    ],
  },
  {
    papel: 'laboratorista', n: 2,
    roupa: { roupa: 0xf4f4f2, calca: 0x3b4f6e, capacete: null },
    agenda: [
      { em: 'LAB', acao: 'bancada', s: 100 },
      { em: 'CONTROLE', acao: 'conversar', s: 40 },
      { em: 'LAB', acao: 'bancada', s: 70 },
      { em: 'REFEITORIO', acao: 'comer', s: 50 },
    ],
  },
  {
    papel: 'mecanico', n: 1,
    roupa: { roupa: 0x2f5d8a, calca: 0x2f5d8a, capacete: 0xffd24a },
    agenda: [
      { em: 'OFICINA', acao: 'bancada', s: 90 },
      // lubrifica o mancal de duas bombas, agachado, com a almotolia (Fase
      // 27, item 12)
      { em: 'laje', lubrifica: 2, s: 18 },
      { em: 'OFICINA', acao: 'bancada', s: 60 },
      { em: 'REFEITORIO', acao: 'comer', s: 50 },
    ],
  },
  {
    // ronda (Fase 27, item 13): o vigia anda pela rede de calcadas de um
    // destino de pedestre a outro (blocos de utilidade, escadas do dique,
    // descarga — site/pedestres.js), na ordem em volta da planta, e
    // ilumina cada um com a lanterna; a lanterna acende a noite
    papel: 'vigia', n: 1,
    roupa: { roupa: 0x27324a, calca: 0x1d2433, capacete: null },
    agenda: [
      { em: 'ronda', pontos: 8, s: 8 },
    ],
  },
];

/* Pontos de amostragem (Fase 27, item 11) [ADOTADO, controle de qualidade
 * de uma planta de acido benzoico]: na descarga da bomba de cada corrente
 * que o laboratorio acompanha — a fase liquida do V-01 depois do flash
 * (conversao do reator, BC-02), a solucao do D-01 antes da cristalizacao
 * final (BC-07), a torta de produto (pureza, BD-02) e o tolueno recuperado
 * (BC-03). Cada operador colhe num, em rodizio. */
export const AMOSTRAS = ['BC-02', 'BC-07', 'BD-02', 'BC-03'];

/* Relogio comum (Fase 27, item 16) [ADOTADO]: todo mundo no mesmo ciclo
 * (o maior das agendas, arredondado para o minuto de cima, e nunca menos
 * que `ciclo`) para o almoco e a reuniao acontecerem juntos. O almoco comeca
 * em `almoco` s do ciclo, um chegando `escalonar` s depois do outro; a
 * reuniao da ADM (o `conversar` dos administrativos no ADM) cai no mesmo
 * instante para os quatro. */
export const RELOGIO = { ciclo: 900, almoco: 420, escalonar: 5, reuniao: 'administrativo' };

/* Escada de marinheiro (Fase 27, item 12) [ADOTADO]: sobe a `velocidade`
 * m/s; o piso da plataforma fica `guarda` m abaixo do alto da escada (o
 * corrimao de 1,0 m); quem sobe fica `dentro` m para dentro da gaiola e da
 * `passo` m da escada para a plataforma. */
export const SUBIDA = { velocidade: 0.35, guarda: 1.0, dentro: 0.4, passo: 1.0 };

/* Quem senta e levanta leva SENTAR s; a porta abre a 2 m (interiores.js).
 * A mais de LONGE m da camera a pessoa nao e desenhada (como na Fase 17). */
export const SENTAR = 1.2;
export const LONGE = 120;
