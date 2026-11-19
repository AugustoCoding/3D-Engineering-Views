/**
 * ============================================================================
 *  ARRANJO DA AREA DE PROCESSO
 * ============================================================================
 *
 *  Onde cada equipamento fica dentro da laje (bloco ISBL de site.js), e o que
 *  a laje precisa ter alem deles: rack, area de guindaste, contencao de
 *  derrame e o vent do S-04. Tudo [ADOTADO]; a regra de cada escolha vai ao
 *  lado, e src/dev/arranjo.js mede o resultado.
 *
 *  Referencial da maquete: X = leste, Z = sul (norte e -Z). `giro` em graus,
 *  em torno do eixo vertical, no sentido do three.js.
 *
 *  LOGICA GERAL (Fase 11)
 *    As posicoes nao sao escolhidas: saem de src/dev/otimizador.js, que monta
 *    o arranjo pela gramatica de GRUPOS e ACESSO (fim deste arquivo) e busca
 *    a ordem de menor custo — o resultado fica em arranjo-proposto.js,
 *    gerado. Rack central com as bombas sob as bordas e o corredor de
 *    manutencao por baixo; ao norte a reacao e a recuperacao de solvente, do
 *    R-01 (nordeste) ao V-02; ao sul a purificacao, do CR-01 ao F-02, em U.
 *    O R-01 fica na fileira norte, longe das pessoas (sul); o CP-01 no canto
 *    sudeste, o ponto mais a barlavento (vento de SE, site.js).
 * ============================================================================
 */
import { ARRANJO_PROPOSTO, RACK_PROPOSTO, LAJE_PROPOSTA, CORREDORES_PROPOSTOS } from './arranjo-proposto.js';

/* Pipe rack: portico de dois niveis no corredor central. Daqui saem so as
 * REGRAS [ADOTADO]; comprimento, largura e a posicao de cada portico saem
 * das rotas (lib/rota.js, Fase 5), que dizem quantas linhas correm nele e
 * onde cada uma entra e sai.
 *   niveis      topo da viga de apoio (BOP) de cada nivel: 1 = processo,
 *               2 = utilidades. 5,2 m deixa as bombas sob o rack com folga
 *               de manutencao; 1,8 m entre niveis cabe a linha que cruza.
 *   lateral     quanto acima do nivel corre a linha que entra ou sai do
 *               rack em Z: assim ela passa por cima das que correm em X.
 *   larguraMin  cabe uma bomba entre as colunas, longe das sapatas.
 *   folgaBorda  o riser que sobe para alem da lateral fica fora do rack. */
export const RACK = {
  z: RACK_PROPOSTO.z,
  niveis: [5.2, 7.0],
  lateral: 0.9,
  // as bombas ficam sob as bordas e o corredor de manutencao passa no meio
  // (ACESSO): a largura e a do arranjo, nao a das faixas
  larguraMin: RACK_PROPOSTO.largura,
  // as linhas correm sobre o corredor do meio, nao sobre a fila de bombas
  larguraFaixas: 3.2,
  vaoMax: 6,
  sapata: 0.5,
  folgaBorda: 0.45,
  folgaTubos: 0.1,
  margem: 0.3,
};

/*
 * `saque`: lado (-1 oeste, +1 leste) do eixo local do trocador por onde o
 *   feixe sai — o otimizador gira o trocador para ele sair para fora da
 *   fileira. A faixa do comprimento do casco + 1 m, com a largura do casco
 *   + 1 m, fica livre.
 * A succao de cada bomba e a do P&ID (rotas.js): a auditoria a acha la.
 */
export const ARRANJO = ARRANJO_PROPOSTO;

/* Corredores transversais pintados; o do rack e a faixa do perimetro saem da
 * laje, do RACK e de ACESSO. */
export const CORREDORES = CORREDORES_PROPOSTOS;

/**
 * Todos os corredores da laje como retangulos — uma fonte so para a pintura
 * no piso (site/processo.js), para os apoios e porticos que nao podem cair
 * neles (tubulacao.js) e para a auditoria.
 *   rack         sob o rack, de ponta a ponta: veiculo de manutencao
 *   transversal  da mureta ao corredor do rack, atravessando a fila de
 *                bombas pelo vao que elas deixam
 *   perimetro    faixa junto da mureta
 */
export function corredoresDaLaje() {
  const [x0, x1] = LAJE_PROPOSTA.x;
  const [z0, z1] = LAJE_PROPOSTA.z;
  const p = ACESSO.perimetro;
  const meio = ACESSO.corredorRack / 2;
  return [
    { tipo: 'rack', x0, x1, z0: RACK.z - meio, z1: RACK.z + meio },
    ...CORREDORES.map((c) => ({
      tipo: 'transversal', fileira: c.fileira, x0: c.x[0], x1: c.x[1],
      z0: c.fileira === 'norte' ? z0 : RACK.z + meio, z1: c.fileira === 'norte' ? RACK.z - meio : z1,
    })),
    { tipo: 'perimetro', x0, x1, z0, z1: z0 + p },
    { tipo: 'perimetro', x0, x1, z0: z1 - p, z1 },
    { tipo: 'perimetro', x0, x1: x0 + p, z0, z1 },
    { tipo: 'perimetro', x0: x1 - p, x1, z0, z1 },
  ];
}

/* Guindaste movel do R-01: o acionamento do agitador (75 kW, ~14 m de altura)
 * sai pelo topo. O guindaste trabalha da via do anel, ao lado do reator, sem
 * gastar laje: patolamento de 10 x 10 m sobre a via e o acostamento, para um
 * guindaste de ~50 t que ergue ~3 t a ~9 m de raio [ADOTADO/ESTIMADO].
 * A area e a via (6 m, de 9 a 3 m da laje) mais 1 m do acostamento do lado
 * do reator: 10 x 7 m, o patolamento de um guindaste dessa classe.
 * Durante o icamento a via fica interditada; o bombeiro chega pelos outros
 * lados (site.js, ACESSO_BOMBEIRO). */
const r01 = ARRANJO.find((a) => a.tag === 'R-01');
export const GUINDASTE = {
  x: [r01.x - 5, r01.x + 5], z: [LAJE_PROPOSTA.z[0] - 9, LAJE_PROPOSTA.z[0] - 2], atende: 'R-01', naVia: true,
};

/* Contencao de derrame da laje [ADOTADO]: mureta de 15 cm no perimetro, com
 * rampas onde ha acesso de veiculo ou de pedestre, e caimento para uma caixa
 * coletora do lado da ETE (oeste), que recebe a drenagem.
 *   Volume retido ~ 30,7 x 22,0 x 0,15 = 101 m³, menos ~134 m² de bases
 *   -> ~81 m³ >= 74,6 m³ do maior vaso (CR-01, Datasheet folha 6). A
 *   auditoria de arranjo refaz a conta com as bases medidas.
 * Rampas: de veiculo nas duas pontas do corredor sob o rack, por onde entra
 * e sai o veiculo de manutencao; de pedestre onde cada corredor transversal
 * chega a mureta. A caixa fica na ponta oeste, sob a borda sul do rack, fora
 * do corredor e antes da primeira bomba. */
export const CONTENCAO = {
  mureta: { altura: 0.15, largura: 0.2 },
  rampas: [
    { lado: 'oeste', centro: RACK.z, largura: 4, motivo: 'corredor do rack (veículo de manutenção)' },
    { lado: 'leste', centro: RACK.z, largura: 4, motivo: 'corredor do rack (veículo de manutenção)' },
    ...CORREDORES.map((c) => ({
      lado: c.fileira, centro: (c.x[0] + c.x[1]) / 2, largura: c.x[1] - c.x[0], motivo: 'pedestres (corredor transversal)',
    })),
  ],
  // entre o corredor (1,6 m do eixo) e a sapata da coluna (3,25 m), depois do
  // primeiro portico, que fica ate 1,5 m da ponta
  caixa: { x: LAJE_PROPOSTA.x[0] + 3.0, z: RACK.z + 2.4, lado: 1.5 },
  caimento: 0.005,
};

/* Iluminacao da laje (Fase 26) [ADOTADO]: luminaria LED Ex d de campo,
 * ~6 klm saindo (~50 W a 120 lm/W) e facho de 110°, a de area que se
 * pendura em coluna e guarda-corpo.
 *   rack        uma em cada coluna de cada portico, a 4,6 m (acima dos 2,1 m
 *               livres do corredor, abaixo da viga do 1o nivel, fundo a
 *               5,0 m), braco de 0,35 m para dentro: o corredor de
 *               manutencao e as bombas sob as bordas.
 *   plataforma  poste no montante do guarda-corpo, luminaria a 2,6 m do
 *               piso (2,26 m livres sob ela), uma na chegada de cada escada
 *               e outra a cada ~6 m de guarda-corpo.
 *   mastro      16 m com 3 projetores de ~20 klm (facho de 60°), nos dois
 *               pontos livres mais afastados da volta da laje, a 1,5 m da
 *               mureta, fora de pipeway, item de seguranca e guindaste.
 * Alvos de lux e a medida: data/iluminacao.js e __auditarIluminacao()
 * (Fase 26, sessao da nuvem).
 * Fluxo pela conta (lib/fotometria.js, Fm 0,8, sem obstrucao, grade de
 * 1 m na laje), o menor de catalogo que fecha os alvos da EN 12464-2:
 *   rack 1000 lm + projetor 6000 lm -> sob o rack Em 59 lx, Uo 0,62
 *   (alvo 50 / 0,40); resto da laje Em 37 lx, Uo 0,26 (alvo 20 / 0,25).
 *   Com 6000 e 20000 lm (o primeiro chute) dava 144 e 95 lx: 3 a 4 vezes
 *   o alvo. Projetor de 4000 lm deixa o Uo do resto em 0,23. Na
 *   plataforma, a mesma de 1000 lm (um item de estoque so). */
export const LUZ_LAJE = {
  luminaria: { fluxo: 1000, facho: 110 },
  rack: { altura: 4.6, braco: 0.35 },
  plataforma: { altura: 2.6, braco: 0.45, passo: 6 },
  mastro: { altura: 16, afastamento: 1.5, passo: 1, folga: 1.2, projetores: 3, projetor: { fluxo: 6000, facho: 60 } },
};

/* Vent atmosferico dos incondensaveis (S-04, 2"-AR-04) [ADOTADO]: saida pelo
 * menos 3 m acima de qualquer plataforma num raio de 15 m — pratica usual
 * de vent (cf. API 521), a confirmar. A plataforma do R-01, a 14 m do V-01,
 * esta a 8,8 m do piso. */
export const VENT = { tag: 'V-01', bocal: 'N2', altura: 15, raio: 15, folga: 3 };

/* Escoamento por gravidade: o NIVEL do cristalizador tem de ficar acima do
 * eixo do tambor do filtro, com margem para as perdas da linha de 6". */
export const GRAVIDADE = [
  { de: 'CR-01', para: 'F-01', linha: '20', margem: 1.5 },
  { de: 'CR-02', para: 'F-02', linha: '25', margem: 1.5 },
];

/* Bomba aspira de perto: linha de succao curta poupa NPSH. [ADOTADO] */
export const SUCCAO_MAX = 5;

/* Faixa de saque: comprimento do casco + esta folga, largura do casco + folga. */
export const SAQUE_FOLGA = 1.0;

/* ============================================================================
 *  REARRANJO  (Fase 11)
 * ============================================================================
 *  Pedido do autor (26/10): o meio da laje ficou confuso e de dificil
 *  acesso, e a Fase 5 otimizou a tubulacao com os equipamentos parados. Aqui
 *  as posicoes sao a variavel: src/dev/otimizador.js monta o arranjo pela
 *  gramatica abaixo e procura a ordem de menor custo.
 *
 *  GRAMATICA (a pratica classica de unidade em linha — Mecklenburgh, Process
 *  Plant Layout; Kern, Hydrocarbon Processing, 1977):
 *    - rack central leste-oeste, com os limites de bateria nas duas pontas;
 *    - bombas sob as duas bordas do rack, de frente para um corredor de
 *      manutencao que corre por baixo dele de ponta a ponta;
 *    - uma fileira de equipamentos de cada lado, encostada no rack: succao
 *      curta, sem nada cruzando corredor no chao;
 *    - corredores transversais pintados entre os grupos, ligando o corredor do
 *      rack a faixa de circulacao do perimetro;
 *    - feixe de trocador sai para fora, pela faixa do perimetro ate a via;
 *    - guindaste do R-01 trabalha da via do anel, ao lado dele.
 * ========================================================================= */

/* Acesso e manutencao [ADOTADO] — a confirmar com a bibliografia:
 *   corredorRack  3,2 m livres sob o rack: passa empilhadeira, carrinho de
 *                 bomba e maca (manutencao e resgate);
 *   corredor      1,5 m nos transversais e larguraMinima 1,2 m (NR-12, item
 *                 12.2 — circulacao principal);
 *   perimetro     1,2 m de faixa entre a ultima peca e a mureta;
 *   peDireito     2,1 m livres sobre o corredor (pratica de projeto, PIP
 *                 PNE00003 — a confirmar);
 *   folga         1,2 m livres entre grupos, 1,0 m entre pecas de um grupo,
 *                 3,0 m em volta do R-01 (plataforma, escadas, guindaste) —
 *                 ordem de grandeza das tabelas de espacamento (CCPS/GAP 2.5.2
 *                 sao pagas: a confirmar);
 *   folgaTubos    1,8 m entre o T-01 e o E-02: ali descem a valvula de
 *                 expansao e as linhas 11, 12 e 16 e sobe o vapor do E-02;
 *   trechoMax     no maximo 12 m de equipamento sem corredor transversal;
 *   recuo         1,0 m da linha de colunas do rack ao equipamento: livra a
 *                 sapata e deixa a succao chegar reta a bomba;
 *   bordaBomba    0,44 m da linha de colunas ao fundo da bomba (sapata de
 *                 0,25 e 0,19 de folga; com 0,45 a BC-11 nao cabia de pe);
 *   folgaBombas   0,9 m entre bombas (retirada do motor). */
export const ACESSO = {
  larguraRack: 7.0,
  corredorRack: 3.2,
  corredor: 1.5,
  larguraMinima: 1.2,
  perimetro: 1.2,
  peDireito: 2.1,
  folga: 1.2,
  folgaInterna: 1.0,
  folgaReator: 3.0,
  folgaTubos: 1.8,
  trechoMax: 12,
  recuo: 1.0,
  bordaBomba: 0.44,
  folgaBombas: 0.9,
  alcanceOperacao: 3,
};

/* Custo para COMPARAR arranjos, nao orcamento [ESTIMADO]. Unidade: 1 m de
 * tubo de 3" de aco carbono instalado. Custo instalado de tubo cresce com
 * ~DN^0,75 e o inox 304L/316L custa ~2 vezes o carbono (ordem de grandeza
 * de Peters, Timmerhaus e West, cap. de tubulacao). Laje de 20 cm armada com
 * base e mureta ~0,6 desse metro por m²; rack de dois niveis com 7 m de
 * largura ~8 por metro de comprimento. */
export const CUSTO = {
  expoenteDN: 0.75,
  inox: 2.0,
  laje: 0.6,
  rack: 8,
  // velocidades de projeto para o diametro do cabecal em cada trecho
  vAgua: 2.0, vVapor: 20, rhoVapor: 4.7, vCondensado: 1.0,
};

/* Grupos que andam juntos [ADOTADO]: o que o processo amarra (cristalizador
 * ao lado do filtro, a suspensao desce por gravidade; a bomba de torta sob a
 * calha do filtro; o condensador ao lado do vaso que ele alimenta). Pecas
 * de oeste para leste e `giro` na fileira SUL — o lado do rack e o norte, e
 * os giros sao os que ja tinham os bocais de camisa e as saidas virados para
 * o rack. Na fileira norte o grupo inteiro gira 180°.
 * `saque: 'fora'` gira o trocador para o feixe sair para o perimetro. */
export const GRUPOS = [
  // As escadas do R-01 (90° e 270° no referencial dele) descem a leste e a
  // oeste, nos corredores de 3 m dos lados — nao no recuo de 1 m junto ao
  // rack —, e a entrada de ar (N2) fica virada para o rack, de onde vem a 01.
  { id: 'R', itens: [{ tag: 'R-01', giro: 270 }], folga: 'folgaReator', fileira: 'norte' },
  { id: 'CP', itens: [{ tag: 'CP-01', giro: 90 }], tomada: true },
  // V-01 com a entrada (N1) de frente para o E-01, que o alimenta
  { id: 'COND', itens: [{ tag: 'E-01', saque: 'fora' }, { tag: 'V-01', giro: 0 }] },
  { id: 'DEC', itens: [{ tag: 'V-02', giro: 270 }] },
  { id: 'TK', itens: [{ tag: 'TK-01', giro: 0 }] },
  // T-01 com a entrada (N1) do lado do R-01 e da valvula de expansao
  { id: 'FLASH', itens: [{ tag: 'T-01', giro: 0 }, { tag: 'E-04', saque: 'fora' }] },
  { id: 'PRE', itens: [{ tag: 'E-02', saque: 'fora' }], folga: 'folgaTubos' },
  { id: 'REC', itens: [{ tag: 'E-03', saque: 'fora' }] },
  { id: 'FILT1', itens: [{ tag: 'CR-01', giro: 180 }, { tag: 'F-01', giro: 0 }, { tag: 'BD-01', giro: -90, folga: 0.3 }],
    vacuo: { bomba: 'BV-01', filtro: 'F-01' } },
  { id: 'DISS', itens: [{ tag: 'D-01', giro: 180 }] },
  { id: 'FILT2', itens: [{ tag: 'CR-02', giro: 180 }, { tag: 'F-02', giro: 0 }, { tag: 'BD-02', giro: -90, folga: 0.3 }],
    vacuo: { bomba: 'BV-02', filtro: 'F-02' } },
];

/**
 * Retangulo { x0, x1, z0, z1 } da faixa de saque de um trocador, no chao.
 * Comeca no fim do cabecote do lado `saque` (o construtor poe o cabecote
 * entre L/2 e L/2 + 0,9 R) e se estende pelo comprimento do feixe + folga.
 * Usado pela auditoria e pelo desenho da faixa na vista de planta.
 */
export function faixaSaque(item, geom) {
  const R = geom.Di / 2;
  const lado = item.saque;
  const ini = lado * (geom.L / 2 + 0.9 * R);
  const fim = ini + lado * (geom.L + SAQUE_FOLGA);
  const meia = (geom.Di + SAQUE_FOLGA) / 2;
  const cantos = [[Math.min(ini, fim), -meia], [Math.max(ini, fim), meia]];
  const a = (item.giro * Math.PI) / 180;
  const rot = ([x, z]) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  const [p, q] = cantos.map(rot);
  return {
    x0: item.x + Math.min(p[0], q[0]), x1: item.x + Math.max(p[0], q[0]),
    z0: item.z + Math.min(p[1], q[1]), z1: item.z + Math.max(p[1], q[1]),
  };
}
