/**
 * ===========================================================================
 *  OPERACOES ANIMADAS  (Fase 21, pedido do autor: "o trabalhador
 *  conectando a mangueira no caminhao, pessoas subindo e descendo do
 *  onibus, essas coisas")
 * ===========================================================================
 *  Cada operacao acontece dentro da espera do veiculo (data/ambiente.js):
 *  site/operacoes.js le em que ponto da espera ele esta e anima o resto.
 *  Os pontos de trabalho sao da geometria do veiculo (lib/ambiente.js) e da
 *  baia; aqui ficam so os tempos e as folgas. [ADOTADO]
 * ------------------------------------------------------------------------- */

/* Descarga de tolueno (procedimento usual de descarga de inflamavel): o
 * operador calca a roda de tras, liga o cabo de aterramento ao chassi,
 * leva o mangote do braco a caixa de valvulas, abre, espera, e desfaz na
 * ordem inversa — aterramento por ultimo a sair, calco por ultimo de todos. */
export const DESCARGA = {
  andar: 1.3,                    // m/s
  calcar: 2, aterrar: 2, conectar: 3, abrirValvula: 2,   // s de cada tarefa
  espera: 1.5,                   // s parado antes de comecar e depois de acabar
  // onde o operador aguarda: ao lado do braco 1, longe do caminhao
  aguarda: [-1.5, 4.5],          // m do pe do braco 1 (x, z do mundo)
  // carretel do cabo de aterramento, num poste ao lado do braco 1
  carretel: [-0.8, 1.5],
  mangoteDN: 0.08,               // m, diametro externo do mangote de 2"
  // Fase 27, item 10 [ADOTADO]: a carga de um caminhao-tanque (30 m³)
  // entra no `tanque`; o nivel sobe na descarga e desce no consumo entre um
  // caminhao e outro (o ciclo fecha). `nivel0`: fracao da altura antes de
  // descarregar. A lampada verde do aterramento acende com o cabo no chassi
  // (sistema de verificacao de aterramento).
  volume: 30, tanque: 'TQ-01', nivel0: 0.45,
};

/* Carregamento do bau: a porta de enrolar sobe quando o caminhao chega a
 * ABRE_A m do portao e desce quando ele sai; a empilhadeira faz `viagens`
 * da faixa de expedicao a traseira do bau, com um palete de cada vez. */
export const CARREGAMENTO = {
  abreA: 25,                     // m do caminhao ao portao
  porta: 0.6,                    // m/s da cortina
  viagens: 2,
  empilhadeira: 1.5,             // m/s
  garfos: 0.4,                   // m/s de subida dos garfos
  portasBau: 260,                // graus: abertas, as folhas encostam na lateral
  abrePortasBau: 3,              // s para abrir (e para fechar)
  // conferente: anda a `andar` m/s; o posto dele fica a [m atras da
  // traseira, m para o lado] — alem da folha aberta (1,25 m) e da
  // empilhadeira (1,15 m de largura no eixo do bau); abre e fecha as
  // portas a `diantePortas` m da traseira (a folha tem 1,24 m)
  andar: 1.3, posto: [1.6, 2.9], diantePortas: 1.45,
};

/* Onibus: as portas abrem (80°) com ele parado no ponto e fecham antes de
 * ele sair; quem passa a 1 m da porta sobe ou desce o degrau de 0,35 m. */
export const ONIBUS_PORTAS = { angulo: 80, abre: 1.2, degrau: 0.35, alcance: 1.0 };
