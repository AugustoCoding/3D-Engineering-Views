/**
 * ============================================================================
 *  DEMAIS OPERACOES UNITARIAS  —  SOMENTE PARA A MAQUETE 3D
 * ============================================================================
 *
 *  Registro separado de propósito. Os quatro equipamentos de src/data/plant.js
 *  (R-01, V-01, V-02, TK-01) tem tabela de bocais, correntes e materiais
 *  completos, e alimentam croqui e folha de especificacao. Estes aqui existem
 *  para dar CONTEXTO a maquete: sao dos colegas de grupo, e so tem o que o
 *  relatorio ja publicou. Misturar os dois faria os geradores de entregavel
 *  produzirem folhas incompletas para equipamento que nao e nosso.
 *
 *  PROCEDENCIA
 *    [OFICIAL]   relatorio, secoes 5.2 e 5.3 e Apendice C.
 *    [ESTIMADO]  geometria que eu arbitrei para tornar o equipamento
 *                desenhavel — tipicamente a partir da area de troca termica
 *                ou da vazao, quando o relatorio so publicou esses.
 *
 *  EQUIPAMENTO PROMOVIDO
 *    Quando um equipamento ganha tabela de bocais e correntes reais ele passa
 *    a viver em plant.js e alimenta a geracao de documentos. A maquete continua
 *    precisando dele, entao a entrada aqui NAO e reescrita a mao: e DERIVADA
 *    da fonte principal por `promovido()`. Copiar os numeros para ca
 *    reintroduziria justamente a divergencia que a separacao existe para
 *    evitar — e ja aconteceu: o T-01 tinha 2,74 m aqui contra os 2,94 m do
 *    relatorio, e o CR-01 tinha 3,00 m de diametro contra 4,03 m.
 * ============================================================================
 */

import { EQUIPAMENTOS } from './plant.js';
import { nivelDeVolume } from '../lib/vessel.js';
import { perfilTampo } from '../lib/profiles.js';

/**
 * Adapta um equipamento ja cadastrado em plant.js para o formato reduzido que
 * a maquete consome, mantendo UMA fonte da verdade.
 *
 * O construtor generico le `Di, Ltan, tampo, tampoFundo, nivel, agitador,
 * camisa` e o apoio (`saiaAltura`, ou `elevacao` + `pernas`), mais a `ficha`;
 * o cadastro completo guarda volume em vez de nivel. Dai a traducao.
 */
function promovido(tag, tipo = 'vaso-vertical') {
  const e = EQUIPAMENTOS[tag];
  if (!e) throw new Error(`"${tag}" nao esta cadastrado em plant.js`);
  const g = e.geom;
  return {
    tag: e.tag,
    nome: e.nome,
    tipo,
    servico: e.servico,
    geom: {
      Di: g.Di,
      Ltan: g.Ltan,
      espessura: g.espessura,
      saiaAltura: g.saiaAltura,
      saiaEspessura: g.saiaEspessura,
      // Janelas da saia por onde sai a linha do bocal de fundo (Fase 5):
      // sem elas a linha 32 atravessava a chapa da saia do T-01.
      saiaPassagens: g.saiaPassagens,
      saiaAbertura: g.saiaAbertura,
      elevacao: g.elevacao,
      pernas: g.pernas,
      tampo: g.tampoTopo,
      tampoFundo: g.tampoFundo,
      // Calculado, nunca digitado: e o mesmo numero que o croqui cota.
      nivel: g.volumeUtil ? nivelDeVolume(g, g.volumeUtil) : undefined,
      // o bloco inteiro (Fase 27): o construtor genérico desenha o eixo e os
      // impelidores pela rotacao, numero e diametro do Datasheet
      agitador: g.agitador ?? null,
      // A camisa vai com base, altura e folga: o desenho sai dos dados.
      camisa: g.camisa,
    },
    ficha: e.processo,
  };
}

/**
 * Converte a tabela de bocais do cadastro completo para as coordenadas que a
 * maquete usa.
 *
 * Os dois registros descrevem o mesmo bocal de jeitos diferentes, e de
 * proposito: `plant.js` guarda `face`, `y`, `ang` e `r`, que e como o
 * projetista pensa e o que o croqui precisa; a maquete precisa de `pos` e
 * `dir` cartesianos. Enquanto a tabela da maquete era escrita a mao com
 * coordenadas ABSOLUTAS, ela silenciosamente amarrava os bocais ao diametro
 * vigente — e quando o CR-01 foi corrigido de 3,00 para os 4,03 m do
 * relatorio, cinco bocais que estavam na parede passaram a flutuar dentro do
 * vaso. Derivando, o bocal acompanha a geometria sozinho.
 *
 * O casco da maquete (`cascoVertical`) e construido sem espessura e sem aba
 * reta, com a tangencia inferior em y = 0. As contas abaixo seguem essa
 * mesma convencao, senao o bocal encostaria no lugar errado.
 */
function bocaisPromovidos(tag) {
  const e = EQUIPAMENTOS[tag];
  if (!e) throw new Error(`"${tag}" nao esta cadastrado em plant.js`);
  const g = e.geom;
  const R = g.Di / 2;

  /** Altura do tampo no raio `r`: o perfil vai da borda (r=R, y=0) ao centro. */
  const alturaTampo = (tipo, r) => {
    const pf = perfilTampo(tipo, R);
    if (r >= R) return 0;
    for (let i = 1; i < pf.length; i++) {
      if (pf[i].x <= r) {
        const a = pf[i - 1], b = pf[i];
        const t = (a.x - r) / (a.x - b.x || 1);
        return a.y + (b.y - a.y) * t;
      }
    }
    return pf.at(-1).y;
  };

  /* `Math.cos(Math.PI/2)` devolve 6,1e-17, nao zero. Um bocal a 90° saia com
   * essa sujeira na direcao, e como o costado e um lathe de 64 segmentos — em
   * que 90° cai exatamente sobre um vertice — o raio da auditoria raspava a
   * aresta entre dois triangulos e perdia a parede. Zerar o residuo deixa o
   * bocal alinhado ao eixo, que e o que ele deveria ser desde o inicio. */
  const limpo = (v) => (Math.abs(v) < 1e-9 ? 0 : v);

  return e.bocais.filter((b) => !b.instrumento).map((b) => {
    const a = ((b.ang ?? 0) * Math.PI) / 180;
    const cos = limpo(Math.cos(a));
    const sen = limpo(Math.sin(a));
    const r = b.r ?? 0;
    if (b.face === 'topo') {
      return {
        id: b.id, dn: b.dn, servico: b.servico,
        pos: [r * cos, g.Ltan + alturaTampo(g.tampoTopo, r), r * sen],
        dir: [0, 1, 0],
      };
    }
    if (b.face === 'fundo') {
      return {
        id: b.id, dn: b.dn, servico: b.servico,
        pos: [r * cos, -alturaTampo(g.tampoFundo, r), r * sen],
        dir: [0, -1, 0],
      };
    }
    return {
      id: b.id, dn: b.dn, servico: b.servico,
      pos: [R * cos, b.y, R * sen],
      dir: [cos, 0, sen],
    };
  });
}

/* ===========================================================================
 *  GEOMETRIA DOS TROCADORES E DO COMPRESSOR   [ESTIMADO]
 * ===========================================================================
 *  O relatorio so publica a carga termica destes equipamentos. A geometria sai
 *  de A = Q / (U . dTml), com tubos de 3/4" e um U tipico do servico; o
 *  diametro do casco vem do numero de tubos (correlacao de feixe de Kern) com
 *  folga. Fica aqui, num lugar so, porque bocais e construtor leem os mesmos
 *  numeros — redimensionar um trocador nao pode deixar bocal no ar.
 * ======================================================================== */
const GEOM = {
  /* Filtros rotativos: o comprimento do tambor tambem posiciona o bocal de
   * vacuo, na ponta do eixo (BOCAIS_EXTRA) — por isso mora aqui. */
  'F-01': { D: 2.09, L: 2.51, alturaEixo: 1.9, rotacao: 0.5 },
  'F-02': { D: 1.48, L: 1.77, alturaEixo: 1.6, rotacao: 0.5 },

  /* E-01 — condensador de topo do R-01. Q = 647 kW (secao 5.2); agua 37 m³/h
   * (Quadro B9) -> 25 -> 40 °C. Processo 140 -> 50 °C, contracorrente:
   *   dTml = (100 - 25) / ln 4 = 54,1 °C
   *   U ~ 400 W/m²K: quase metade da massa do vapor e N2 incondensavel
   *   A = 647 000 / (400 x 54,1) = 30 m²  ->  139 tubos de 3,6 m, feixe 0,33 m
   * Antes: 0,85 x 4,2 m e "46 m²", o dobro do necessario. Fica elevado para o
   * condensado descer ao V-01. */
  'E-01': { Di: 0.50, L: 3.6, alturaEixo: 3.8, giro: 0 },

  /* E-02 — pre-aquecedor do reciclo. Q = 394 kW (Quadro B9); processo
   * 22 136 kg/h de 103 a 140 °C, nos tubos. Vapor de 8 bar (Tsat 170 °C):
   *   dTml = (67,4 - 30,4) / ln(67,4/30,4) = 46,5 °C
   *   U ~ 500 W/m²K (vapor condensando / liquido organico)
   *   A = 394 000 / (500 x 46,5) = 17 m²  ->  94 tubos de 3,0 m, feixe 0,28 m
   * O Quadro B9 da 645 kg/h de vapor, o que corresponde a lambda ~ 2 200 kJ/kg
   * (vapor de ~2 bar, 120 °C) — frio demais para aquecer a 140 °C. Com 8 bar,
   * 394 / 2 048 x 3 600 = 693 kg/h (pendencia I da equipe). */
  'E-02': { Di: 0.40, L: 3.0, alturaEixo: 1.2, giro: 0 },

  /* E-03 — integracao energetica. Q = 100,8 kW (eq. B8); concentrado
   * 154,4 -> 125,6 °C no casco, licor-mae 48,9 -> 65,6 °C nos tubos:
   *   dTml = (88,8 - 76,7) / ln(88,8/76,7) = 82,6 °C
   *   U ~ 250 W/m²K (liquido organico dos dois lados)
   *   A = 100 800 / (250 x 82,6) = 4,9 m²  ->  34 tubos de 2,4 m, feixe 0,17 m */
  'E-03': { Di: 0.30, L: 2.4, alturaEixo: 1.3, giro: 0 },

  /* E-04 — condensador de topo do T-01 (so no P&ID). A carga sai do balanco do
   * stripper: o latente dos 11 789 kg/h de tolueno, lambda_13 = 1 149,5 kW
   * (eq. B7). Tolueno condensa a ~119 °C (1,3 bar); agua 25 -> 40 °C:
   *   agua = 1 150 / (4,18 x 15) = 18,3 kg/s = 66 m³/h
   *   dTml = (94 - 79) / ln(94/79) = 86,3 °C ;  U ~ 700 W/m²K
   *   A = 1 150 000 / (700 x 86,3) = 19 m²  ->  106 tubos de 3,0 m, feixe 0,29 m
   * Casco de 0,50 m: o vapor chega a 0,87 m³/s (eq. C18) e precisa de espaco. */
  'E-04': { Di: 0.50, L: 3.0, alturaEixo: 1.5, giro: 0 },

  /* CP-01 — compressor de ar, 3 491 kg/h de 1 a 15 bar. Isotermico com
   * rendimento de 70 %:
   *   W = 0,970 kg/s x 0,287 x 298 x ln 15 / 0,70 = 321 kW -> motor de 355 kW
   * Pacote de tres estagios com resfriamento intermediario; antes era um skid
   * de 3,0 x 1,6 x 1,9 m, pequeno para essa potencia. */
  'CP-01': { L: 4.5, W: 2.2, H: 2.3 },
};

/**
 * Bocais de trocador casco-tubo derivados da geometria, para nao amarrar
 * coordenada digitada ao diametro vigente (o mesmo problema que o CR-01 ja
 * teve). Origem no eixo do casco, X ao longo do comprimento, como o construtor.
 *
 *   face 'topo' | 'fundo'                 no casco, a `u` x L do centro
 *   face 'carretel-topo' | 'carretel-fundo'  no cabecote do lado `lado` (-1|+1)
 *
 * Os do casco ficam em |u| <= 0,4 para nao cair sobre as selas (0,3 L).
 */
function bocaisTrocador(g, lista) {
  const R = g.Di / 2;
  const xCarretel = (lado) => lado * (g.L / 2 + R * 0.45);
  return lista.map((b) => {
    const base = { id: b.id, dn: b.dn, servico: b.servico };
    switch (b.face) {
      case 'topo': return { ...base, pos: [b.u * g.L, R - 0.01, 0], dir: [0, 1, 0] };
      case 'fundo': return { ...base, pos: [b.u * g.L, -(R - 0.01), 0], dir: [0, -1, 0] };
      case 'carretel-topo': return { ...base, pos: [xCarretel(b.lado), R * 0.92, 0], dir: [0, 1, 0] };
      case 'carretel-fundo': return { ...base, pos: [xCarretel(b.lado), -R * 0.92, 0], dir: [0, -1, 0] };
      default: throw new Error(`face de trocador desconhecida: ${b.face}`);
    }
  });
}

/**
 * Pontos de conexao dos equipamentos acima, em coordenadas LOCAIS do grupo.
 *
 *   pos  [x, y, z]  — origem do grupo, antes de ele ser elevado
 *   dir  [x, y, z]  — para onde o bocal aponta
 *
 * Origens por tipo:
 *   vaso-vertical    y = 0 na linha de tangencia inferior
 *   trocador         eixo do casco; X ao longo do comprimento
 *   filtro-rotativo  eixo do tambor; Z ao longo do comprimento
 *   skid             y = 0 no piso
 *
 * Sao POSICOES, nao especificacao mecanica: o relatorio nao publica tabela de
 * bocais destes equipamentos, entao aqui vale a coerencia do desenho — cada
 * bocal esta onde o processo exige que a linha chegue ou saia.
 */
/* Ponto na cuba (ou no capo) do filtro rotativo: raio 1,22 R, como em
 * generico.js, a `phi` graus da horizontal +x (90 = topo, -90 = fundo). */
const naCuba = (tag, phi, z) => {
  const r = 1.22 * GEOM[tag].D / 2, a = (phi * Math.PI) / 180;
  return [+(r * Math.cos(a)).toFixed(3), +(r * Math.sin(a)).toFixed(3), z];
};

export const BOCAIS_EXTRA = {
  /* Vapor no casco, de -X para +X; agua nos tubos, em passe unico de +X para
   * -X — contracorrente. As duas tomadas de agua ficam por cima: a de baixo
   * cruzava a linha 03, que sai do fundo do casco. */
  'E-01': bocaisTrocador(GEOM['E-01'], [
    { id: 'N1', dn: 150, face: 'topo', u: -0.38, servico: 'Entrada de vapores (de R-01, 6"-MRV-02)' },
    { id: 'N2', dn: 80, face: 'fundo', u: 0.38, servico: 'Saída de condensado (para V-01, 3"-MR-03)' },
    { id: 'A1', dn: 100, face: 'carretel-topo', lado: 1, servico: 'Entrada de água de resfriamento' },
    { id: 'A2', dn: 100, face: 'carretel-topo', lado: -1, servico: 'Saída de água de resfriamento' },
  ]),
  /* Reciclo nos tubos, passe unico de -X para +X; vapor no casco. */
  'E-02': bocaisTrocador(GEOM['E-02'], [
    { id: 'N1', dn: 80, face: 'carretel-topo', lado: -1, servico: 'Entrada do reciclo (de BC-01, 3"-TOL/AB-16)' },
    { id: 'N2', dn: 80, face: 'carretel-topo', lado: 1, servico: 'Saída para o R-01 (3"-TOL/AB-17)' },
    { id: 'V1', dn: 50, face: 'topo', u: -0.1, servico: 'Vapor de aquecimento — entrada (estimado)' },
    { id: 'V2', dn: 25, face: 'fundo', u: 0.38, servico: 'Condensado — saída (estimado)' },
  ]),
  'T-01': bocaisPromovidos('T-01'),
  /* Concentrado quente no casco, de -X para +X; licor-mae frio nos tubos, de
   * +X para -X. */
  'E-03': bocaisTrocador(GEOM['E-03'], [
    { id: 'N1', dn: 80, face: 'topo', u: -0.38, servico: 'Entrada do concentrado quente (3"-TOL/AB-32)' },
    { id: 'N2', dn: 65, face: 'fundo', u: 0.38, servico: 'Saída do concentrado resfriado (para V-16 e CR-01)' },
    { id: 'N3', dn: 65, face: 'carretel-topo', lado: 1, servico: 'Entrada do licor-mãe frio (2½"-LM-21)' },
    { id: 'N4', dn: 65, face: 'carretel-fundo', lado: -1, servico: 'Saída do licor-mãe aquecido (2½"-LM-31)' },
  ]),
  /* Vapor de tolueno no casco; agua nos tubos, de +X para -X. As duas tomadas
   * de agua por cima, como no E-01: a de baixo corria junto ao piso no mesmo
   * rumo da succao da BC-04. */
  'E-04': bocaisTrocador(GEOM['E-04'], [
    { id: 'N1', dn: 80, face: 'topo', u: -0.38, servico: 'Entrada de tolueno vaporizado (de T-01, 3"-TOL-13)' },
    { id: 'N2', dn: 80, face: 'fundo', u: 0.38, servico: 'Saída de condensado (para V-14)' },
    { id: 'A1', dn: 100, face: 'carretel-topo', lado: 1, servico: 'Entrada de água de resfriamento' },
    { id: 'A2', dn: 100, face: 'carretel-topo', lado: -1, servico: 'Saída de água de resfriamento' },
  ]),
  'CR-01': bocaisPromovidos('CR-01'),
  /* Filtro rotativo: os bocais nascem na CUBA, nunca no tambor.
   * Estavam soltos — N1 acima do topo do tambor (que GIRA: bocal fixo ali e
   * impossivel), N2 sete centimetros abaixo do fundo da cuba e N3 no ar ao lado
   * do tambor. As cotas abaixo sao a borda da cuba (raio 1,22 R, meio-angulo
   * 0,42 pi -> x = 1,235, y = -0,317) e o fundo dela (y = -1,26).
   * Com o capo (27/10) nada pode subir da borda -x: a suspensao (N1) entra
   * pela lateral da cuba, abaixo do nivel, de frente para o CR-01 — mais
   * baixa, a linha 20 so ganha queda —, a lavagem (N4) chega por cima do
   * capo, sobre a barra de lavagem, e a torta (N3) sai pelo capo logo
   * acima da borda +x: sob o raspador, acima do licor (-0,42 R) e da flange
   * do capo, que fica na borda. */
  'F-01': [
    { id: 'N1', dn: 150, pos: naCuba('F-01', -150, -0.6), dir: [-1, 0, 0], servico: 'Entrada de suspensão (de CR-01, 6"-AB/TOL-20)' },
    { id: 'N2', dn: 65, pos: [0, -1.26, 0.5], dir: [0, -1, 0], servico: 'Saída de licor-mãe (2½"-LM-21)' },
    { id: 'N3', dn: 80, pos: naCuba('F-01', -8, 0.3), dir: [1, 0, 0], servico: 'Descarga de torta (para D-01 via BD-01, 3"-AB/TOL-23)' },
    // Faltava: o P&ID leva a 09A (lavagem da torta, via BC-06) ao F-01 e nao
    // havia onde ela chegar. Mesma posicao do N4 do F-02, na borda da cuba.
    { id: 'N4', dn: 32, pos: naCuba('F-01', 120, 0.6), dir: [0, 1, 0], servico: 'Tolueno de lavagem da torta (1¼"-TOL-09A, via BC-06)' },
    // Cabecote de valvula na ponta do eixo oposta ao acionamento: por ele o
    // vacuo chega aos setores do tambor (generico.js desenha o cabecote).
    { id: 'V', dn: 150, pos: [0, -0.21, -(GEOM['F-01'].L / 2 + 0.45)], dir: [0, -1, 0], servico: 'Vácuo do tambor (para a BV-01)' },
  ],
  'D-01': bocaisPromovidos('D-01'),
  'CR-02': bocaisPromovidos('CR-02'),
  /* Mesma logica do F-01; aqui a borda da cuba fica em x = 0,874, y = -0,225
   * e o fundo em y = -0,89 (tambor de 1,48 m). */
  'F-02': [
    { id: 'N1', dn: 150, pos: naCuba('F-02', -150, -0.42), dir: [-1, 0, 0], servico: 'Entrada de suspensão (de CR-02, 6"-AB/TOL-25)' },
    { id: 'N2', dn: 50, pos: [0, -0.89, 0.4], dir: [0, -1, 0], servico: 'Saída de filtrado (para CR-01 via BC-08, 2"-LM-26)' },
    { id: 'N3', dn: 80, pos: naCuba('F-02', -8, 0.2), dir: [1, 0, 0], servico: 'Descarga do produto final (via BD-02, 3"-TORTA-AB-28)' },
    { id: 'N4', dn: 25, pos: naCuba('F-02', 120, 0.42), dir: [0, 1, 0], servico: 'Tolueno de lavagem, reposição (1"-TOL-30)' },
    { id: 'V', dn: 100, pos: [0, -0.21, -(GEOM['F-02'].L / 2 + 0.45)], dir: [0, -1, 0], servico: 'Vácuo do tambor (para a BV-02)' },
  ],
  /* Na face do corpo do compressor: o corpo tem L x 0,72 centrado em -L x 0,1,
   * entao a face fica em +0,26 L; a altura cai no terco superior do corpo.
   * Ja esteve 77 cm solto no ar quando era coordenada digitada. */
  'CP-01': [
    { id: 'N1', dn: 65, pos: [0.26 * GEOM['CP-01'].L, 0.22 + 0.55 * GEOM['CP-01'].H, 0],
      dir: [1, 0, 0], servico: 'Descarga de ar comprimido (2½"-AR-01)' },
    /* Admissao de ar, no topo do corpo. [ESTIMADO] 3 491 kg/h a 1,18 kg/m³ =
     * 0,82 m³/s; em DN 300 da 11,6 m/s, velocidade usual de succao de
     * compressor. A tomada sobe com filtro (tubulacao.js), longe do chao. */
    { id: 'S', dn: 300, pos: [-0.3 * GEOM['CP-01'].L, 0.22 + 0.62 * GEOM['CP-01'].H, 0],
      dir: [0, 1, 0], servico: 'Admissão de ar atmosférico (filtro)' },
  ],
};

export const EXTRAS = {
  /* ---------------------------------------------------------------- E-01 */
  'E-01': {
    tag: 'E-01',
    nome: 'Condensador',
    tipo: 'trocador',
    servico: 'Condensa o tolueno e a água dos vapores de topo do reator; os '
      + 'incondensáveis seguem com o líquido para o V-01',
    geom: GEOM['E-01'],
    ficha: {
      'Tipo': 'Casco e tubo horizontal, vapor no casco',
      'Carga térmica': '647 kW removidos',           // [OFICIAL] secao 5.2
      'Temperatura de saída': '50 °C',
      'Corrente de entrada': '02 — 5 978,3 kg/h de vapores a 140 °C',
      'Corrente de saída': '03 — 5 978,3 kg/h a 50 °C',
      'Água de resfriamento': '37 m³/h, 25 → 40 °C',   // [OFICIAL] Quadro B9
      'Área de troca (estimada)': '≈ 30 m² (U ≈ 400 W/m²·K, com N₂ no vapor)',
      'Casco (estimado)': 'Ø 0,50 × 3,6 m',
    },
  },

  /* ---------------------------------------------------------------- T-01 */
  'T-01': promovido('T-01'),

  /* ---------------------------------------------------------------- E-03 */
  'E-03': {
    tag: 'E-03',
    nome: 'Trocador de Integração',
    tipo: 'trocador',
    servico: 'Integração energética: resfria o concentrado do stripper aquecendo '
      + 'o licor-mãe frio que retorna ao pré-aquecedor',
    geom: GEOM['E-03'],
    ficha: {
      'Tipo': 'Casco e tubo horizontal',
      'Carga térmica': '101 kW recuperados internamente',   // [OFICIAL]
      'Lado quente': '154,4 °C → 125,6 °C (concentrado, no casco)',
      'Lado frio': '48,9 °C → 65,6 °C (licor-mãe, nos tubos)',
      'Área de troca (estimada)': '≈ 4,9 m² (U ≈ 250 W/m²·K)',
      'Casco (estimado)': 'Ø 0,30 × 2,4 m',
    },
  },

  /* ---------------------------------------------------------------- E-02 */
  'E-02': {
    tag: 'E-02',
    nome: 'Pré-aquecedor do reciclo',
    tipo: 'trocador',
    servico: 'Aquece o reciclo de tolueno e ácido benzóico até a temperatura de '
      + 'operação do reator, antes da entrada no R-01',
    geom: GEOM['E-02'],
    ficha: {
      'Tipo': 'Casco e tubo horizontal, vapor no casco',
      'Carga térmica': '394 kW fornecidos',          // [OFICIAL] Quadro B9, eq. B4
      'Processo': '22 136 kg/h, 103 → 140 °C (correntes 16 → 17)',
      'Vapor (Quadro B9)': '645 kg/h',
      'Vapor (estimado, 8 bar)': '≈ 693 kg/h — ver pendência I do roteiro',
      'Área de troca (estimada)': '≈ 17 m² (U ≈ 500 W/m²·K)',
      'Casco (estimado)': 'Ø 0,40 × 3,0 m',
      'Controle': 'TIC na saída → vapor de aquecimento (§6.1)',
    },
  },

  /* ---------------------------------------------------------------- E-04 */
  'E-04': {
    tag: 'E-04',
    nome: 'Condensador do vaso flash',
    tipo: 'trocador',
    servico: 'Condensa o tolueno vaporizado no topo do T-01; o condensado se '
      + 'divide na V-14 entre o reciclo ao reator e o tanque TK-01',
    geom: GEOM['E-04'],
    ficha: {
      'Origem': 'P&ID Rev. 1 — não tem folha nem linha no Quadro B9',
      'Tipo': 'Casco e tubo horizontal, vapor no casco',
      'Carga térmica (estimada)': '≈ 1 150 kW — latente da corrente 13 (eq. B7)',
      'Processo': '11 789 kg/h de tolueno, condensa a ~119 °C (1,3 bar)',
      'Água de resfriamento (estimada)': '≈ 66 m³/h, 25 → 40 °C',
      'Área de troca (estimada)': '≈ 19 m² (U ≈ 700 W/m²·K)',
      'Casco (estimado)': 'Ø 0,50 × 3,0 m',
      'Controle': 'PIC do T-01 → água do E-04 (§6.1)',
    },
  },

  /* --------------------------------------------------------------- BC-04
   * [OFICIAL] no P&ID Rev. 1: leva o condensado do E-04 (via V-14) ao TK-01.
   * Dimensionamento [ESTIMADO], o mesmo raciocinio da BC-09:
   *   Q = 2 690 kg/h / 860 kg/m³ = 3,1 m³/h ; H ~ 15 m ate o TK-01 pelo rack
   *   P = 860 x 9,81 x 0,00087 x 15 / 0,40 = 0,27 kW -> motor de 0,75 kW */
  'BC-04': {
    tag: 'BC-04',
    nome: 'Bomba de condensado do E-04',
    tipo: 'bomba-centrifuga',
    servico: 'Leva ao TK-01 a parte do condensado do E-04 que não volta ao reator',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.152, potencia: 0.75 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (sucção 1"-TOL-29A, descarga 1¼"-TOL-29)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 1½ × 1 × 6',
      'Fluido': 'Tolueno condensado, corrente 29',
      'Vazão': '2 690 kg/h ≈ 3,1 m³/h',
      'Altura manométrica (estimada)': '≈ 15 m',
      'Motor (estimado)': '0,75 kW',
    },
  },

  /* ---------------------------------------------------------------- CR-01 */
  'CR-01': promovido('CR-01'),

  /* ---------------------------------------------------------------- F-01 */
  'F-01': {
    tag: 'F-01',
    nome: 'Filtro Rotativo a Vácuo 1',
    tipo: 'filtro-rotativo',
    servico: 'Separa a torta de cristais de ácido benzóico do licor-mãe',
    // [OFICIAL] Datasheet, folha 9: rotacao preliminar de 0,50 rpm. Os 36 s do
    // Apendice C sao o tempo de FILTRACAO por volta (t_f = f_s/N), nao o
    // periodo: a 0,50 rpm a volta leva 120 s e o tambor fica 30 % submerso.
    geom: GEOM['F-01'],
    ficha: {
      'Tipo': 'Filtro rotativo a vácuo de tambor',
      'Área filtrante': '16,55 m²',                    // [OFICIAL] eq. C33
      'Diâmetro do tambor': '2,09 m',                  // eq. C34
      'Comprimento (L/D = 1,2)': '2,51 m',
      'Concentração de sólidos': '281,7 kg/m³',
      'Tempo de filtração': '36 s por rotação',
      'Volume de filtrado por área': '0,0270 m³/m²',
      'Torta úmida': '4 943 kg/h — 3 774 AB + 1 169 tolueno',
      'Licor-mãe': '13 169 kg/h',
      'Tolueno de lavagem': '09 — 2 836,8 kg/h (do TK-01, via BC-06)',
      'Rotação (preliminar)': '0,50 rpm',
      'Material': 'AISI 304L em contato com o processo; estrutura em aço carbono A36',
    },
  },

  /* ---------------------------------------------------------------- D-01 */
  'D-01': promovido('D-01'),

  /* ---------------------------------------------------------------- CR-02 */
  'CR-02': promovido('CR-02'),

  /* ---------------------------------------------------------------- F-02 */
  'F-02': {
    tag: 'F-02',
    nome: 'Filtro Rotativo a Vácuo 2',
    tipo: 'filtro-rotativo',
    servico: 'Filtração final do produto recristalizado, com lavagem da torta '
      + 'por tolueno de reposição',
    // [OFICIAL] Quadro 11 e Datasheet, folha 10: L = 1,77 m; 0,50 rpm.
    geom: GEOM['F-02'],
    ficha: {
      'Tipo': 'Filtro rotativo a vácuo de tambor',
      'Área filtrante': '8,22 m²',                     // [OFICIAL] eq. C44
      'Diâmetro do tambor': '1,48 m',                  // eq. C45
      'Comprimento (L/D = 1,2)': '1,77 m',
      'Concentração de sólidos': '295,3 kg/m³',
      'Volume de filtrado por área': '0,0275 m³/m²',
      'Tolueno de lavagem': '30 — 1 656 kg/h',
      'Filtrado orgânico': '26 — 7 416 kg/h de retorno ao CR-01',
      'Produto final': '28 — 2 020 kg/h com pureza > 99 % m/m',
      'Rotação (preliminar)': '0,50 rpm',
      'Material': 'AISI 304L em contato com o processo; estrutura em aço carbono A36',
    },
  },

  /* --------------------------------------------------------------- CP-01 */
  'CP-01': {
    tag: 'CP-01',
    nome: 'Compressor de Ar',
    tipo: 'skid',
    servico: 'Comprime o ar de processo até a pressão de alimentação do reator',
    geom: GEOM['CP-01'],
    ficha: {
      'Tipo': 'Compressor de ar de processo sobre base',
      'Vazão': '3 491 kg/h de ar',                     // [OFICIAL] secao 5.2
      'Pressão de descarga': '15 bar',
      'Composição do ar': '23,2 % O₂ / 76,8 % N₂',
      'Controle': 'PT/PIC na descarga atua sobre o compressor',
      'Potência (estimada)': '≈ 320 kW de compressão; motor de 355 kW',
      'Dimensões (estimadas)': '4,5 × 2,2 × 2,3 m, pacote de três estágios',
    },
  },

  /* --------------------------------------------------------------- BC-09
   * PROPOSTA DA MAQUETE — nao consta do P&ID Rev. 1.
   *
   * No P&ID a linha 1¼"-TOL-10 vai do TK-01 ao D-01 so com valvulas (V-13 e
   * V-20). Os dois sao atmosfericos, entao sem bomba o escoamento seria por
   * gravidade e o fundo do TK-01 teria de ficar acima da entrada do D-01, no
   * tampo superior (~5 m de cota). Em vez de erguer o tanque, propos-se uma
   * bomba; o autor aceitou provisoriamente em 22/10/2026, pendente de revisao
   * da equipe ("Pendencias para a equipe revisar"). A TAG segue a
   * numeracao do P&ID, que vai ate BC-08.
   *
   * Dimensionamento [ESTIMADO]:
   *   Q = 2 837 kg/h / 832 kg/m³ (eq. C46) = 3,41 m³/h
   *   H ~ 5 m estatico (ate o pipe rack) + 2,5 m de atrito + 7 m na valvula
   *       de controle V-20 (LIC do D-01, §6.1) ~ 15 m
   *   P = rho.g.Q.H / eta = 832 x 9,81 x 0,000947 x 15 / 0,40 = 0,29 kW
   *       -> motor de 0,75 kW, o menor de catalogo com folga
   *   A menor centrifuga de processo ANSI B73.1 (1½ x 1 x 6) atende com folga. */
  'BC-09': {
    tag: 'BC-09',
    nome: 'Bomba de tolueno para o dissolvedor (proposta)',
    tipo: 'bomba-centrifuga',
    servico: 'Transfere tolueno do TK-01 para o D-01 pela linha 10. Proposta da '
      + 'maquete, não consta do P&ID: aceita provisoriamente, pendente de revisão da equipe',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.152, potencia: 0.75 },
    ficha: {
      'Situação': 'Proposta — não consta do P&ID Rev. 1; pendente de revisão da equipe',
      'Por que existe': 'Sem bomba, a linha 10 só escoa por gravidade: o TK-01 '
        + 'teria de ficar ~5 m acima do piso',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 1½ × 1 × 6',
      'Fluido': 'Tolueno, corrente 10, 60 °C',
      'Vazão': '2 837 kg/h ≈ 3,4 m³/h',
      'Altura manométrica (estimada)': '≈ 15 m',
      'Motor (estimado)': '0,75 kW',
      'Material (estimado)': 'Carcaça em aço carbono, como a linha CS40',
      'Controle': 'A válvula V-20 (LIC do D-01) fica na descarga',
    },
  },

  /* ===================================================================
   *  BOMBAS DO P&ID QUE FALTAVAM  (Fase 5)
   *  Vazao [OFICIAL] das correntes (Quadros A3–A5); o resto [ESTIMADO],
   *  pelo mesmo raciocinio da BC-04 e da BC-09:
   *    P = rho.g.Q.H / eta, eta ~ 0,5 nas pequenas; motor no proximo
   *    tamanho de catalogo com folga. Densidade do tolueno com AB ~ 830–880.
   *  Posicao em arranjo.js: as de vaso do norte junto a ele, as do no do
   *  topo do T-01 e a do TK-01 sob o rack, as de fundo de vaso do sul ao
   *  lado dele.
   * ================================================================= */

  /* BC-01 — reciclo para o reator, que opera a 15 bar.
   *   Q = 22 136 / 830 = 26,7 m³/h
   *   dP = 15 - 1 bar + ~2 bar (E-02 e valvula V-03) = 16 bar -> H ~ 196 m
   *   P = 16e5 x 26,7/3600 / 0,55 = 21,6 kW -> motor de 30 kW
   *   196 m num estagio a 3 500 rpm pede rotor de ~0,33 m (u ~ 61 m/s). */
  'BC-01': {
    tag: 'BC-01',
    nome: 'Bomba de reciclo para o reator',
    tipo: 'bomba-centrifuga',
    servico: 'Leva o reciclo de topo e o licor-mãe aquecido (S-15) de 1 para 15 bar, pelo E-02, até o R-01',
    geom: { dnSuccao: 80, dnDescarga: 50, rotor: 0.33, potencia: 30 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (sucção 3"-TOL/AB-16A, descarga 3"-TOL/AB-16)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 3 × 2 × 13',
      'Vazão': '22 136 kg/h ≈ 26,7 m³/h',
      'Pressão': '1 → 15 bar (altura manométrica estimada ≈ 196 m)',
      'Motor (estimado)': '30 kW',
    },
  },

  /* BC-02 — fase liquida do V-01 para o V-02.
   *   Q = 3 281 / 870 = 3,8 m³/h ; H ~ 15 m -> 0,3 kW -> motor de 0,75 kW
   *   O V-01 opera a 15 bar e o V-02 a 1 bar: a diferenca de pressao ja
   *   move o liquido, e a V-08 o despressuriza. A bomba e do P&ID e fica;
   *   a duvida vai para a equipe (pendencia K da equipe). */
  'BC-02': {
    tag: 'BC-02',
    nome: 'Bomba de condensado do V-01',
    tipo: 'bomba-centrifuga',
    servico: 'Leva a fase líquida do V-01 (tolueno + água) ao V-02',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.152, potencia: 0.75 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (sucção 2"-T/H2O-05, descarga 2"-T/H2O-05A)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 1½ × 1 × 6',
      'Vazão': '3 281 kg/h ≈ 3,8 m³/h',
      'Motor (estimado)': '0,75 kW',
      'Observação': 'Aspira a 15 bar e entrega a 1 bar: a pressão do V-01 já bastaria (pendência K)',
    },
  },

  /* BC-03 — tolueno recuperado do V-02 para o TK-01.
   *   Q = 2 983 / 840 = 3,55 m³/h ; H ~ 15 m -> 0,3 kW -> 0,75 kW */
  'BC-03': {
    tag: 'BC-03',
    nome: 'Bomba de tolueno recuperado',
    tipo: 'bomba-centrifuga',
    servico: 'Leva o tolueno separado no V-02 ao tanque TK-01',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.152, potencia: 0.75 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (linha 1¼"-TOL-08)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 1½ × 1 × 6',
      'Vazão': '2 983 kg/h ≈ 3,6 m³/h',
      'Motor (estimado)': '0,75 kW',
    },
  },

  /* BC-05 — licor-mae aquecido do E-03 para a V-15.
   *   Q = 13 037 / 830 = 15,7 m³/h ; H ~ 15 m -> 1,1 kW -> motor de 1,5 kW */
  'BC-05': {
    tag: 'BC-05',
    nome: 'Bomba de licor-mãe aquecido',
    tipo: 'bomba-centrifuga',
    servico: 'Leva o licor-mãe aquecido no E-03 (S-31) à V-15, onde se junta ao reciclo de topo',
    geom: { dnSuccao: 50, dnDescarga: 40, rotor: 0.165, potencia: 1.5 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (linha 2½"-LM-31)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 2 × 1½ × 6',
      'Vazão': '13 037 kg/h ≈ 15,7 m³/h',
      'Motor (estimado)': '1,5 kW',
    },
  },

  /* BC-06 — tolueno de lavagem do TK-01 para o F-01, ~40 m pelo rack.
   *   Q = 2 837 / 832 = 3,41 m³/h ; H ~ 25 m -> 0,5 kW -> 0,75 kW */
  'BC-06': {
    tag: 'BC-06',
    nome: 'Bomba de tolueno de lavagem',
    tipo: 'bomba-centrifuga',
    servico: 'Leva tolueno do TK-01 à lavagem da torta no F-01',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.2, potencia: 0.75 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (sucção 1¼"-TOL-09, descarga 1¼"-TOL-09A)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 1½ × 1 × 8',
      'Vazão': '2 837 kg/h ≈ 3,4 m³/h',
      'Motor (estimado)': '0,75 kW',
      'Controle': 'A válvula V-19 (FIC do F-01) fica na descarga',
    },
  },

  /* BC-07 — solucao do D-01 para o topo do CR-02 (~7 m).
   *   Q = 7 780 / 880 = 8,8 m³/h ; H ~ 20 m -> 0,85 kW -> motor de 1,5 kW */
  'BC-07': {
    tag: 'BC-07',
    nome: 'Bomba de solução redissolvida',
    tipo: 'bomba-centrifuga',
    servico: 'Leva a solução do D-01 ao cristalizador CR-02',
    geom: { dnSuccao: 50, dnDescarga: 40, rotor: 0.165, potencia: 1.5 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (sucção 2"-AB/TOL-24, descarga 2½"-AB/TOL-24A)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 2 × 1½ × 6',
      'Vazão': '7 780 kg/h ≈ 8,8 m³/h',
      'Motor (estimado)': '1,5 kW',
      'Controle': 'A válvula V-18 (LIC do CR-02) fica na descarga',
    },
  },

  /* BC-08 — filtrado do F-02 de volta ao CR-01, ~45 m pelo rack e 8,6 m de
   * subida, aspirando de receptor sob vacuo.
   *   Q = 7 416 / 830 = 8,9 m³/h ; H ~ 30 m -> 1,2 kW -> motor de 2,2 kW */
  'BC-08': {
    tag: 'BC-08',
    nome: 'Bomba de filtrado do F-02',
    tipo: 'bomba-centrifuga',
    servico: 'Devolve o filtrado do F-02 (S-26) ao CR-01, pela V-16',
    geom: { dnSuccao: 50, dnDescarga: 40, rotor: 0.2, potencia: 2.2 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (linha 2"-LM-26)',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 2 × 1½ × 8',
      'Vazão': '7 416 kg/h ≈ 8,9 m³/h',
      'Motor (estimado)': '2,2 kW',
      'Observação': 'Aspira do filtro a vácuo: precisa de NPSH folgado (perna barométrica ou bomba abaixo do receptor)',
    },
  },

  /* BD-01 e BD-02 — torta umida (23 % de tolueno) do raspador do filtro.
   *   Densidade aparente da torta ~ 1 150 kg/m³ [ESTIMADO]
   *   BD-01: 4 943 / 1 150 = 4,3 m³/h ate o topo do D-01 -> 3 kW
   *   BD-02: 2 020 / 1 150 = 1,8 m³/h ate o limite de bateria -> 2,2 kW
   *   Potencia acima do hidraulico (~0,5 kW): pasta perde carga por atrito. */
  'BD-01': {
    tag: 'BD-01',
    nome: 'Bomba de torta do F-01',
    tipo: 'bomba-deslocamento',
    servico: 'Leva a torta úmida do F-01 ao dissolvedor D-01',
    geom: { dnSuccao: 150, dnDescarga: 80, vazao: 4.3, potencia: 3 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (linha 3"-AB/TOL-23)',
      'Tipo (estimado)': 'Cavidade progressiva com tremonha e rosca alimentadora',
      'Vazão': '4 943 kg/h ≈ 4,3 m³/h de torta',
      'Motor (estimado)': '3 kW',
      'Controle': 'O LIC do F-01 atua nela por inversor de frequência (§6.1)',
    },
  },
  'BD-02': {
    tag: 'BD-02',
    nome: 'Bomba de torta do F-02 (produto)',
    tipo: 'bomba-deslocamento',
    servico: 'Leva o ácido benzoico purificado do F-02 para fora do limite de bateria',
    geom: { dnSuccao: 150, dnDescarga: 80, vazao: 1.8, potencia: 2.2 },
    ficha: {
      'Origem': 'P&ID Rev. 1 (linha 3"-TORTA-AB-28)',
      'Tipo (estimado)': 'Cavidade progressiva com tremonha e rosca alimentadora',
      'Vazão': '2 020 kg/h ≈ 1,8 m³/h de torta',
      'Motor (estimado)': '2,2 kW',
      'Controle': 'O LIC do F-02 atua nela por inversor de frequência (§6.1)',
    },
  },

  /* --------------------------------------------------------- BC-10, BC-11
   * PROPOSTAS DA MAQUETE — nao constam do P&ID Rev. 1. Sairam da analise
   * hidraulica da Fase 5 (pendencias L e M da equipe), como a BC-09:
   *   BC-10: o filtrado do F-01 sai de filtro a vacuo e o P&ID o manda ao
   *     E-03 sem bomba; o F-02 tem a BC-08 para o mesmo servico.
   *     Q = 13 169 / 830 = 15,9 m³/h ; H ~ 6 m de vacuo + 6 m de rack +
   *     ~15 m de atrito e valvulas ~ 27 m -> 2,0 kW -> motor de 3 kW
   *   BC-11: o T-01 opera a 1,36 bar abs; com o proprio nivel o concentrado
   *     sobe ~7 m, e o CR-01 recebe pelo topo, a ~11 m.
   *     Q = 7 860 / 950 = 8,3 m³/h ; H ~ 11 m + E-03 + V-05 e V-17 ~ 30 m
   *     -> 1,3 kW -> motor de 2,2 kW. Liquido a 155 °C, saturado: so a saia
   *     de 2,2 m do T-01 empurra (NPSH, Fase 23). Por isso 1½ x 1 x 8, no
   *     tamanho da vazao (BEP ~14 m³/h, NPSHr ~1,5 m): a 3 x 2 x 8 de antes
   *     (BEP ~52 m³/h) trabalhava a 16 % do BEP e pedia NPSHr ~3,5 m, mais
   *     do que a saia da (2,7 m). data/fluidos.js, dev/hidraulica.js. */
  'BC-10': {
    tag: 'BC-10',
    nome: 'Bomba de filtrado do F-01 (proposta)',
    tipo: 'bomba-centrifuga',
    servico: 'Leva o filtrado do F-01 (S-21) ao E-03. Proposta da maquete, não consta do P&ID: '
      + 'pendente de revisão da equipe',
    geom: { dnSuccao: 65, dnDescarga: 50, rotor: 0.152, potencia: 3 },
    ficha: {
      'Situação': 'Proposta — não consta do P&ID Rev. 1; pendente de revisão da equipe (pendência L)',
      'Por que existe': 'O filtrado sai de filtro a vácuo e não sobe sozinho até o E-03; o F-02 tem a BC-08',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 2 × 1½ × 6',
      'Vazão': '13 169 kg/h ≈ 15,9 m³/h',
      'Motor (estimado)': '3 kW',
    },
  },
  'BC-11': {
    tag: 'BC-11',
    nome: 'Bomba de concentrado do T-01 (proposta)',
    tipo: 'bomba-centrifuga',
    servico: 'Leva o concentrado do T-01 (S-32) pelo E-03 até o CR-01. Proposta da maquete, '
      + 'não consta do P&ID: pendente de revisão da equipe',
    geom: { dnSuccao: 40, dnDescarga: 25, rotor: 0.2, potencia: 2.2 },
    ficha: {
      'Situação': 'Proposta — não consta do P&ID Rev. 1; pendente de revisão da equipe (pendência M)',
      'Por que existe': 'O T-01 opera a 1,36 bar abs: o concentrado sobe ~7 m sozinho e o CR-01 recebe pelo topo',
      'Tipo (estimado)': 'Centrífuga horizontal de sucção axial, ANSI B73.1 1½ × 1 × 8',
      'Vazão': '7 860 kg/h ≈ 8,3 m³/h, a 155 °C',
      'Motor (estimado)': '2,2 kW',
      'Controle': 'A válvula V-05 (LIC do T-01) fica na descarga',
    },
  },

  /* ----------------------------------------------------------- BV-01, BV-02
   * [OFICIAL] no P&ID Rev. 1 (uma por filtro; divergencia 6: a segunda e a
   * BV-02). Dimensionamento [ESTIMADO], anel liquido:
   *   ar ~1 m³/min por m² de tela a 0,5 bar abs
   *   F-01: 16,55 m² (eq. C33) -> ~16,5 m³/min ; F-02: 8,22 m² (eq. C44) -> ~8,2
   *   ~1,3 kW por m³/min nessa faixa -> 22 kW e 11 kW */
  'BV-01': {
    tag: 'BV-01',
    nome: 'Bomba de vácuo do F-01',
    tipo: 'bomba-vacuo',
    servico: 'Faz o vácuo no tambor do F-01, que puxa o filtrado pela tela',
    geom: { dnSuccao: 150, potencia: 22 },
    ficha: {
      'Origem': 'P&ID Rev. 1',
      'Tipo (estimado)': 'Anel líquido, com separador de líquido de selagem',
      'Vazão de ar (estimada)': '≈ 16,5 m³/min a 0,5 bar abs',
      'Motor (estimado)': '22 kW',
      'Controle': 'O PIC do F-01 atua nela (§6.1)',
    },
  },
  'BV-02': {
    tag: 'BV-02',
    nome: 'Bomba de vácuo do F-02',
    tipo: 'bomba-vacuo',
    servico: 'Faz o vácuo no tambor do F-02',
    geom: { dnSuccao: 100, potencia: 11 },
    ficha: {
      'Origem': 'P&ID Rev. 1, desenhada como BV-01 (divergência 6)',
      'Tipo (estimado)': 'Anel líquido, com separador de líquido de selagem',
      'Vazão de ar (estimada)': '≈ 8,2 m³/min a 0,5 bar abs',
      'Motor (estimado)': '11 kW',
      'Controle': 'O PIC do F-02 atua nela (§6.1)',
    },
  },
};
