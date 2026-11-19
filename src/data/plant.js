/**
 * ============================================================================
 *  FONTE UNICA DA VERDADE  —  Planta de producao de acido benzoico
 *  Benzoic Industries
 * ============================================================================
 *
 *  A maquete (src/equipment/*.js) e calculada daqui: mudar o diametro muda
 *  o vaso, os bocais, o nivel de liquido e os suportes juntos.
 *
 *  PROCEDENCIA
 *    [OFICIAL]   consta do relatorio do grupo (secoes 5.2, 5.3, 6.1,
 *                Quadro 03 e Apendice C). Nao alterar sem alterar o relatorio.
 *    [VERIFICAR] estimativa minha, coerente com os oficiais, mas a confirmar.
 *
 *  UNIDADES: metros para geometria, bar para pressao.
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 * Diametros externos e flanges — ASME B16.5 / B36.10, classe 150#
 * DN -> { od: diam. ext. do tubo (m), fl: diam. ext. do flange (m),
 *         esp: espessura do flange (m) }
 * ------------------------------------------------------------------------- */
export const DN = {
  15: { od: 0.0213, fl: 0.089, esp: 0.011 },
  25: { od: 0.0334, fl: 0.108, esp: 0.014 },
  32: { od: 0.0422, fl: 0.117, esp: 0.016 },
  40: { od: 0.0483, fl: 0.127, esp: 0.018 },
  50: { od: 0.0603, fl: 0.152, esp: 0.019 },
  65: { od: 0.0730, fl: 0.178, esp: 0.022 },
  80: { od: 0.0889, fl: 0.19, esp: 0.024 },
  100: { od: 0.1143, fl: 0.229, esp: 0.024 },
  150: { od: 0.1683, fl: 0.279, esp: 0.026 },
  200: { od: 0.2191, fl: 0.343, esp: 0.029 },
  250: { od: 0.273, fl: 0.406, esp: 0.03 },
  300: { od: 0.3239, fl: 0.483, esp: 0.032 },
  500: { od: 0.5080, fl: 0.699, esp: 0.044 },
};

/* ===========================================================================
 *  R-01  —  REATOR DE OXIDACAO DE TOLUENO  (CSTR)
 * =========================================================================== */

export const R01 = {
  tag: 'R-01',
  nome: 'Reator de Oxidação de Tolueno',
  tipo: 'CSTR',
  servico: 'Oxidação catalítica do tolueno a ácido benzóico em fase líquida, '
    + 'com ar como agente oxidante e acetato de manganês como catalisador homogêneo',

  /* -------------------------------------------------------------------------
   * GEOMETRIA
   * ---------------------------------------------------------------------- */
  geom: {
    // [OFICIAL] Apendice C, eq. C3-C5:
    //   Vt = (pi.D²/4).H  com  H = 3D   ->   D = 2,9 m ; H = 8,7 m
    // A equacao trata o volume como CILINDRO, logo H = 8,7 m e a altura do
    // costado (tangente a tangente) e os tampos sao volume adicional.
    Di: 2.9,
    Ltan: 8.7,

    // [OFICIAL] Apendice C, eq. C1-C2:
    //   Vu = tau.F = 1,5 h . 32,86 m³/h = 49,3 m³
    //   Vt = Vu.(1 + 0,15) = 56,7 m³
    volumeUtil: 49.3,
    volumeTotal: 56.7,

    // [VERIFICAR] ASME VIII Div.1, casco cilindrico:
    //   t = P·R/(S·E − 0,6·P) + c
    //   P = 1,75 MPa | R = 1450 mm | S(316L, 170 °C) ~ 110 MPa | E = 0,85
    //   t = 27,4 + 3 -> 28 mm
    espessura: 0.028,

    tampoTopo: 'eliptico',
    tampoFundo: 'eliptico',
    abaReta: 0.05,

    // --- Suportacao --- [VERIFICAR]
    saiaAltura: 2.8,
    saiaEspessura: 0.020,
    baseAnelLargura: 0.26,
    fundacaoAltura: 0.45,
    fundacaoLado: 4.8,
    // A linha 11 sai do bocal de fundo (N3) e atravessa a saia para o lado
    // do rack (no arranjo da Fase 11 o R-01 gira 90°: 180° local e o sul). A
    // abertura de acesso (o arco do croqui) fica do lado oposto, virada para
    // a faixa de circulacao do perimetro. [ADOTADO]
    saiaPassagens: [{ ang: 180, y: 1.25, diam: 0.32, linha: '11' }],
    saiaAbertura: { ang: 0 },

    // --- Isolamento --- [VERIFICAR] (meio a 140 °C, isolamento quente)
    isolamento: 0.10,

    // --- Agitacao ---
    // [OFICIAL] reator do tipo CSTR agitado gas-liquido; material AISI 316L.
    // [VERIFICAR] impelidor, rotacao e potencia. Turbina Rushton e o padrao
    // para DISPERSAO DE GAS, que e o caso (borbulhamento de ar pelo aspersor).
    agitador: {
      tipo: 'Turbina Rushton (3 estágios)',
      material: 'Aço inoxidável AISI 316L',
      nImpelidores: 3,
      Dimp: 0.97,          // ~ D/3
      alturaPrimeiro: 0.85,
      espacamento: 2.15,
      diamEixo: 0.13,
      rotacao: 100,        // [VERIFICAR] rpm
      potencia: 75,        // [VERIFICAR] kW  (~1,0 kW/m³, tipico gas-liquido)
    },

    // --- Chicanas --- [VERIFICAR] largura padrao D/10
    chicanas: { n: 4, largura: 0.29, folgaParede: 0.06 },

    // --- Anel aspersor perfurado (ring sparger) ---
    // [OFICIAL] tipo confirmado no Quadro 03. [VERIFICAR] dimensoes.
    sparger: { diamAnel: 0.80, diamTubo: 0.1143, nFuros: 32, altura: 0.45 },

    // NAO HA SERPENTINA INTERNA: o calor sai pela CAMISA, com agua de
    // resfriamento. Decidido pelo autor em 22/10/2026 — a reacao e
    // exotermica, entao a camisa so pode ser de resfriamento.
    //
    // [OFICIAL] Relatorio, eq. B3: o balanco ja desconta o latente dos vapores
    // de topo (477,6 kW, que seguem na Corrente 02 e sao condensados no E-01);
    // o que sobra, Q = -2 575,7 kW, sai por utilidade. Quadro B9: R-01 com
    // 87 m³/h de agua. Datasheet, folha 1: linhas 3"-CW-1A (entrada) e
    // 3"-CW-1B (saida) da camisa. P&ID Rev. 1 e §6.1: o TIC atua na valvula
    // V-01, na entrada de agua fria.
    //   saida da agua: 25 + 2 576 / (87/3,6 x 4,18) = 50,5 °C
    //
    // A versao de 08/10 modelava camisa A VAPOR; contradizia os quatro
    // documentos acima, e o croqui final herdou o rotulo "camisa de
    // aquecimento" dela (pendencia levada a equipe).

    // --- Camisa de resfriamento --- [ESTIMADO] geometria
    // Termina abaixo do nivel de liquido (6,94 m), porque parede seca nao
    // troca calor. `base` e a partir da tangencia de fundo; `folga`, o vao
    // anular por onde passa a agua. Conferencia do U exigido:
    //   A = pi x 2,956 x 6,30 = 58,5 m²
    //   dTml (140 °C contra 25 -> 50,5 °C) = (115 - 89,5) / ln(115/89,5) = 101,7 °C
    //   U = 2 576 000 / (58,5 x 101,7) = 433 W/m²·K — plausivel para vaso
    //   agitado encamisado com agua.
    camisa: { base: 0.30, altura: 6.30, folga: 0.075 },

    // --- Plataforma e escada --- [VERIFICAR]
    plataforma: { elevacao: 6.0, largura: 1.2, guardaCorpo: 1.1 },
    // Duas escadas: plataforma com uma so nao tem rota de fuga alternativa
    // (arranjo da laje). Em lados opostos, no unico par de angulos livre de
    // bocal: a 200° a escada descia por cima do N2 (ar, 200°) e a 60° por cima
    // do N9 (PI-01, 60°). A 90° ela fica entre o N9 e o N6/N7 (120°); a 270°,
    // num quadrante sem bocal lateral. [ADOTADO, 23/10/2026]
    escada: { largura: 0.6, angulos: [90, 270] },
  },

  /* -------------------------------------------------------------------------
   * PROCESSO   [OFICIAL] — relatorio secoes 4.2, 5.2 e Apendice C
   * ---------------------------------------------------------------------- */
  processo: {
    'Tipo de reator': 'CSTR (contínuo, fase líquida, gás-líquido agitado)',
    'Capacidade de produção': '2 000 kg/h de ácido benzóico (15 840 t/ano)',
    'Temperatura de operação': '140 °C',
    'Pressão de operação': '15 bar',
    'Tempo de residência': '1,5 h',
    'Vazão volumétrica de alimentação': '32,86 m³/h',
    'Conversão por passe': '15 %',
    'Volume útil': '49,3 m³',
    'Volume total': '56,7 m³',
    'Holdup de gás adotado': '15 %',
    'Relação H/D': '3,0',
    'Calor de reação': 'ΔHr = −683,0 kJ/mol',
    'Calor removido': '2 576 kW',
    'Mecanismo de remoção': 'Camisa com água de resfriamento (o latente dos vapores de topo segue para o E-01)',
    'Água de resfriamento': '87 m³/h, 25 → 50,5 °C',
    'Agente oxidante': 'Ar de processo (23,2 % O₂ / 76,8 % N₂)',
    'Catalisador': 'Acetato de manganês (homogêneo)',
    'Base de projeto': 'Patente US 3.210.416',
  },

  /* -------------------------------------------------------------------------
   * CONSTRUCAO MECANICA
   * ---------------------------------------------------------------------- */
  mecanica: {
    /* 316L e nao titanio porque o catalisador e acetato de manganes SEM
     * promotor de bromo — e o brometo que obriga titanio na oxidacao de
     * alquilaromaticos, e ele nao existe aqui. */
    'Material do costado': 'Aço inoxidável AISI 316L',
    'Material dos tampos': 'Aço inoxidável AISI 316L',
    // Eixo de 8,7 m com tres impelidores: manda a fadiga e a rigidez, nao a
    // corrosao. Duplex tem o dobro do escoamento do 316L.
    'Material do eixo do agitador': 'Aço duplex UNS S32205',
    'Material dos impelidores': 'Aço inoxidável AISI 316L',
    'Tipo de aspersor': 'Anel aspersor perfurado (ring sparger)',
    'Tipo de tampo': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Espessura do costado': '28 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm (estimado)',
    'Temperatura de projeto': '170 °C (estimado)',
    'Pressão de projeto': '17,5 bar (estimado)',
    'Suportação': 'Saia cilíndrica soldada (estimado)',
    /* Austenitico isolado entre 50 e 150 °C e o caso classico de corrosao sob
     * tensao por cloreto lixiviado do proprio isolante. O R-01 opera a 140 °C:
     * esta na faixa. Dai a exigencia de baixo cloreto certificado. */
    'Isolamento': 'Lã de rocha baixo cloreto (ASTM C795), 100 mm, com barreira '
      + 'de vapor e chapa de alumínio',
    'Proteção sob isolamento': 'Pintura do costado sob o isolamento (anti-ESCC)',
  },

  posicao: 'Vertical',

  componentes: 'Agitador de 3 turbinas Rushton (75 kW, 100 rpm); 4 chicanas verticais; anel aspersor perfurado; camisa de água de resfriamento (58,5 m², estimada); saia de sustentação; plataforma e escada com gaiola; isolamento de lã de rocha baixo cloreto (ASTM C795), 100 mm.',

  /* Lista de linhas: [sigla, descricao, material, material+schedule]
   * [OFICIAL] Datasheet, folha 1 — a tag da linha no P&ID vai entre parenteses. */
  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Temperatura', 'Concentração', 'Nível', 'Pressão'],
    isolamento: ['quente'],
    nota: 'Calor de reação (2 576 kW) removido pela camisa com água de resfriamento, 87 m³/h; o latente dos vapores de topo segue para o E-01 (eq. B3, Quadro B9).',
  },

  linhas: {
    N1: ['TOL/AB', 'Tolueno + ácido benzóico, reciclo do E-02 (3"-TOL/AB-17-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    N2: ['AR', 'Ar de processo, de CP-01 (2½"-AR-01-CS40)', 'Aço Carbono', 'CS40'],
    N3: ['TOL/AB', 'Licor de oxidação, para T-01 (3"-TOL/AB-11-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    N4: ['MRV', 'Vapores de tolueno e água, para E-01 (6"-MRV-02-CS40)', 'Aço Carbono', 'CS40'],
    N5: ['VP', 'Alívio de pressão — PSV-01', 'Aço Inox AISI 304L', 'SS40'],
    C1: ['CW', 'Água de resfriamento — entrada da camisa (3"-CW-1A)', 'Aço Carbono', 'CS40'],
    C2: ['CW', 'Água de resfriamento — saída da camisa (3"-CW-1B)', 'Aço Carbono', 'CS40'],
  },

  /* -------------------------------------------------------------------------
   * INSTRUMENTACAO   [OFICIAL] — relatorio secao 6.1
   * ---------------------------------------------------------------------- */
  instrumentacao: {
    'Nível': 'LT/LIC por pressão diferencial → válvula V-02 (saída líquida)',
    'Temperatura': 'TT/TIC, termopar tipo K em poço de 304L → válvula V-01 (água da camisa)',
    'Composição': 'DT/DIC — densímetro em linha na saída 11, partes molhadas em 316L → válvula V-03',
    'Pressão': 'PT/PIC tipo strain gauge na descarga do compressor CP-01',
    'Modo dos controladores': 'PI em nível, pressão e composição; PID em temperatura',
  },

  /* -------------------------------------------------------------------------
   * TABELA DE BOCAIS
   *   y   = elevacao em relacao a LINHA DE TANGENCIA INFERIOR (m)
   *   ang = posicao angular no costado (graus, 0 = eixo +X)
   * Servicos [OFICIAL]; elevacoes e angulos [VERIFICAR].
   * Diametros dimensionados pelas vazoes reais das correntes (ver correntes).
   * ---------------------------------------------------------------------- */
  bocais: [
    { id: 'N1', dn: 80, face: 'topo', ang: 45, r: 0.90, corrente: '17', servico: 'Entrada de tolueno + AB reciclado (do E-02)' },
    { id: 'N2', dn: 65, face: 'lateral', y: 0.70, ang: 200, corrente: '01', servico: 'Entrada de ar (anel aspersor)' },
    { id: 'N3', dn: 80, face: 'fundo', ang: 0, r: 0, corrente: '11', servico: 'Saída de licor de oxidação' },
    { id: 'N4', dn: 150, face: 'topo', ang: 180, r: 0.85, corrente: '02', servico: 'Saída de vapores para E-01' },
    { id: 'N5', dn: 100, face: 'topo', ang: 300, r: 0.85, servico: 'Válvula de segurança PSV-01' },
    { id: 'N6', dn: 50, face: 'lateral', y: 7.45, ang: 120, instrumento: true, servico: 'LT-01 — tomada superior' },
    { id: 'N7', dn: 50, face: 'lateral', y: 1.05, ang: 120, instrumento: true, servico: 'LT-01 — tomada inferior' },
    { id: 'N8', dn: 50, face: 'lateral', y: 3.60, ang: 150, instrumento: true, servico: 'Poço termométrico TT-01 (termopar K)' },
    { id: 'N9', dn: 50, face: 'lateral', y: 5.20, ang: 60, instrumento: true, servico: 'Indicador de pressão PI-01' },
    { id: 'M1', dn: 500, face: 'lateral', y: 7.05, ang: 0, servico: 'Boca de visita (inspeção)' },
    // Camisa: agua entra embaixo e sai em cima, como no CR-01 — a camisa opera
    // cheia, em contracorrente. 3" nas duas pontas, pelo Datasheet (folha 1).
    // Entrada e saida em lados opostos (180°), para a agua varrer a camisa
    // inteira em vez de seguir o caminho curto. A saida, rente ao topo da
    // camisa, cai 0,45 m acima do piso da plataforma: a linha sai e desce por
    // um furo no piso, junto ao costado (R-01.js), sem cruzar o passadico.
    // `camisa: true` faz o croqui nascer o bocal na parede da camisa.
    { id: 'C1', dn: 80, face: 'lateral', y: 0.45, ang: 34, camisa: true, corrente: 'CW-1A', servico: 'Água de resfriamento — entrada da camisa' },
    { id: 'C2', dn: 80, face: 'lateral', y: 6.45, ang: 214, camisa: true, corrente: 'CW-1B', servico: 'Água de resfriamento — saída da camisa' },
  ],

  /* -------------------------------------------------------------------------
   * CORRENTES DE PROCESSO   [OFICIAL] — relatorio secao 5.2
   *   Balanco fecha:  entrada 3 491 + 22 136 = 25 627 kg/h
   *                   saida   5 978 + 19 649 = 25 627 kg/h
   * ---------------------------------------------------------------------- */
  correntes: [
    {
      id: '01', bocal: 'N2', sentido: 'entrada', fluido: 'Ar de processo',
      vazao: '3 491 kg/h', T: '25 °C', P: '15 bar',
      composicao: '23,2 % O₂ / 76,8 % N₂', material: 'Aço carbono',
    },
    {
      id: '17', bocal: 'N1', sentido: 'entrada', fluido: 'Tolueno + ácido benzóico (reciclo)',
      vazao: '22 136 kg/h', T: '140 °C', P: '15 bar',
      composicao: '20 226 kg/h tolueno + 1 910 kg/h AB', material: 'Aço inox AISI 304L',
    },
    {
      id: '02', bocal: 'N4', sentido: 'saída', fluido: 'Vapores de tolueno e água',
      vazao: '5 978 kg/h', T: '140 °C', P: '15 bar',
      composicao: 'Evaporação que remove o calor de reação', material: 'Aço inox AISI 304L',
    },
    {
      id: '11', bocal: 'N3', sentido: 'saída', fluido: 'Licor de oxidação',
      vazao: '19 649 kg/h', T: '140 °C', P: '15 bar',
      composicao: '20 % m/m de ácido benzóico em tolueno', material: 'Aço inox AISI 304L',
    },
    // Utilidade, fora do balanco de massa acima. [OFICIAL] vazao do Quadro B9;
    // temperatura de saida calculada no comentario da camisa.
    {
      id: 'CW-1A', bocal: 'C1', sentido: 'entrada', fluido: 'Água de resfriamento',
      vazao: '87 m³/h', T: '25 °C', P: '—',
      composicao: 'Utilidade fria da camisa', material: 'Aço carbono',
    },
    {
      id: 'CW-1B', bocal: 'C2', sentido: 'saída', fluido: 'Água de resfriamento',
      vazao: '87 m³/h', T: '50,5 °C', P: '—',
      composicao: 'Retorno à torre de resfriamento', material: 'Aço carbono',
    },
  ],
};

/* ===========================================================================
 *  V-01  —  SEPARADOR GAS-LIQUIDO  (vaso de knock-out vertical)
 *  Apendice C, eq. C6-C12 · balanco de massa Apendice A, eq. A8
 * =========================================================================== */

export const V01 = {
  tag: 'V-01',
  nome: 'Separador Gás-Líquido',
  tipo: 'Vaso separador vertical com eliminador de névoa',
  servico: 'Separação física entre a fase gasosa não-condensável (N₂ e O₂ residual) '
    + 'e a fase líquida condensada (tolueno e água), a jusante do condensador E-01',

  geom: {
    // [OFICIAL] Apendice C:
    //   restricao de vapor  -> D >= 0,317 m (eq. C9)
    //   retencao de liquido -> V = 0,628 m³ e L/D = 3 -> D = 0,64 m (eq. C12)
    //   quem governa e a retencao de liquido, nao o vapor.
    Di: 0.64,
    Ltan: 1.92,                 // L = 3D (eq. C12)

    volumeTotal: 0.628,         // [OFICIAL] eq. C10
    volumeUtil: 0.314,          // metade: o vaso opera a 50 % da capacidade

    // [VERIFICAR] ASME VIII Div.1:
    //   P = 1,75 MPa | R = 320 mm | S(304L, 100 °C) ~ 115 MPa | E = 0,85
    //   t = 5,8 + 3 (corrosao) -> 10 mm
    espessura: 0.010,

    tampoTopo: 'eliptico',
    tampoFundo: 'eliptico',
    abaReta: 0.03,

    // --- Suportacao --- [VERIFICAR]
    // Nao sobe pelo NPSH da BC-02 (Fase 23, pendencia K): com mais ~0,9 m a
    // linha 03 faria sifao na saida do E-01 (o condensado tem de descer) e
    // o TT dela sairia do alcance do piso.
    saiaAltura: 1.2,
    saiaEspessura: 0.010,
    baseAnelLargura: 0.12,
    fundacaoAltura: 0.25,
    fundacaoLado: 1.5,
    // A linha 05 sai do fundo para a BC-02, a leste, na altura da succao da
    // bomba. [ADOTADO]
    saiaPassagens: [{ ang: 0, y: 0.45, diam: 0.3, linha: '05' }],
    saiaAbertura: { ang: 180 },

    // Sem isolamento: opera a 50 °C, nao ha ganho termico nem risco de contato.
    isolamento: 0,

    // --- Eliminador de nevoa ---
    // [OFICIAL] o fator k = 0,11 m/s de Souders-Brown so vale para vasos
    // EQUIPADOS com eliminador de nevoa, entao ele e parte do dimensionamento.
    demister: { espessura: 0.10, abaixoDoTopo: 0.35 },

    // --- Internos de entrada e saida --- [ESTIMADO] pratica usual de
    // knock-out drum; o relatorio nao os dimensiona.
    // Placa defletora em frente ao bocal de entrada: o jato bifasico do E-01
    // bate nela e o liquido cai antes de o gas subir ao demister.
    // `afastamento` e da parede interna; a placa e centrada no bocal.
    defletor: { bocal: 'N1', afastamento: 0.10, altura: 0.22, largura: 0.22 },
    // Quebra-vortice em cruz sobre a saida de liquido: sem ele, o redemoinho
    // na saida puxa gas para a linha que vai ao V-02.
    quebraVortice: { bocal: 'N3', altura: 0.08, largura: 0.15 },
  },

  processo: {
    'Tipo': 'Vaso separador vertical (knock-out drum)',
    'Temperatura de operação': '50 °C',
    'Pressão de operação': '14,9 bar',
    'Método de dimensionamento': 'Souders-Brown (Turton), vaso vertical',
    'Fator de capacidade k': '0,11 m/s (com eliminador de névoa)',
    'Velocidade máxima do vapor': '0,815 m/s',
    'Velocidade de operação': '0,611 m/s (75 % da máxima)',
    'Vazão volumétrica de vapor': '173,45 m³/h (0,04818 m³/s)',
    'Densidade do vapor': '15,55 kg/m³',
    'Densidade do líquido': '870 kg/m³',
    'Diâmetro mínimo por vapor': '0,317 m',
    'Tempo de retenção de líquido': '5 min a 50 % da capacidade',
    'Volume total': '0,628 m³',
    'Relação L/D': '3,0',
  },

  mecanica: {
    /* 304L e nao aco carbono porque o tolueno recuperado aqui VOLTA ao reator,
     * e ferro arrastado interfere no ciclo catalitico do manganes. 304L e nao
     * 316L porque o molibdenio compra resistencia a cloreto, que este circuito
     * nao tem. */
    'Material do costado': 'Aço inoxidável AISI 304L',
    'Material dos tampos': 'Aço inoxidável AISI 304L',
    'Eliminador de névoa': 'Malha de arame AISI 304, 100 mm',
    'Tipo de tampo': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Espessura do costado': '10 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm (estimado)',
    'Temperatura de projeto': '80 °C (estimado)',
    'Pressão de projeto': '17,5 bar (estimado)',
    'Suportação': 'Saia cilíndrica soldada (estimado)',
    'Isolamento': 'Não aplicável',
  },

  posicao: 'Vertical',

  componentes: 'Eliminador de névoa de malha de arame AISI 304, 100 mm; saia cilíndrica de sustentação.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Nível'],
    isolamento: ['nenhum'],
    nota: 'O fator k = 0,11 m/s de Souders-Brown só vale com eliminador de névoa; quem governou o diâmetro foi a retenção de líquido, não o vapor.',
  },

  linhas: {
    N1: ['MR', 'Mistura bifásica condensada, de E-01 (3"-MR-03-CS40)', 'Aço Carbono', 'CS40'],
    N2: ['AR', 'Gases residuais N₂ + O₂ (2"-AR-04-CS40)', 'Aço Carbono', 'CS40'],
    N3: ['T/H2O', 'Fase líquida, para V-02 via BC-02 (2"-T/H2O-05-CS40)', 'Aço Carbono', 'CS40'],
    N4: ['AL', 'Alívio de pressão — PSV-02', 'Aço Inox AISI 304L', 'SS40'],
  },

  /* Elevacoes e angulos [VERIFICAR]; servicos e vazoes [OFICIAL]. */
  bocais: [
    { id: 'N1', dn: 80, face: 'lateral', y: 1.10, ang: 180, corrente: '03', servico: 'Entrada de mistura bifásica (de E-01)' },
    { id: 'N2', dn: 50, face: 'topo', ang: 0, r: 0, corrente: '04', servico: 'Saída de gases residuais' },
    { id: 'N3', dn: 50, face: 'fundo', ang: 0, r: 0, corrente: '05', servico: 'Saída de fase líquida (para V-02, via BC-02)' },
    // r = 0,20 m e a menor distancia que separa os flanges DN80 e DN50 no
    // tampo (0,095 + 0,076 = 0,171 m de raio somados) com folga.
    { id: 'N4', dn: 50, face: 'topo', ang: 0, r: 0.20, servico: 'Válvula de segurança PSV-02' },
  ],

  /* [OFICIAL] Apendice A, eq. A7-A8. */
  correntes: [
    {
      id: '03', bocal: 'N1', sentido: 'entrada', fluido: 'Mistura bifásica condensada',
      vazao: '5 978,3 kg/h', T: '50 °C', P: '14,9 bar',
      composicao: '2 983,2 tolueno + 297,9 água + 2 681,0 N₂ + 16,2 O₂ (kg/h)',
    },
    {
      id: '04', bocal: 'N2', sentido: 'saída', fluido: 'Gases residuais',
      vazao: '2 697,2 kg/h', T: '50 °C', P: '14,9 bar',
      composicao: '2 681,0 N₂ + 16,2 O₂ (kg/h)',
    },
    {
      id: '05', bocal: 'N3', sentido: 'saída', fluido: 'Fase líquida condensada',
      vazao: '3 281,1 kg/h', T: '50 °C', P: '14,9 bar',
      composicao: '2 983,2 tolueno + 297,9 água (kg/h)',
    },
  ],

  /* Numeracao do P&ID Rev. 1: a saida liquida do V-01 e a S-05 (2"), que
   * passa pela BC-02 e pela valvula V-08 e chega ao V-02 como S-06 (1¼").
   * A secao 5.2 do relatorio chama as duas de "Corrente 06". */
};

/* ===========================================================================
 *  V-02  —  SEPARADOR LIQUIDO-LIQUIDO  (decantador HORIZONTAL)
 *  Apendice C, eq. C13-C16 · balanco de massa Apendice A, eq. A9
 * =========================================================================== */

export const V02 = {
  tag: 'V-02',
  nome: 'Separador Líquido-Líquido',
  tipo: 'Decantador horizontal por diferença de densidade',
  servico: 'Separação líquido-líquido por imiscibilidade entre a fase aquosa, '
    + 'descartada, e a fase orgânica de tolueno, recuperada para o tanque TK-01',
  posicao: 'Horizontal',

  geom: {
    orientacao: 'horizontal',

    // [OFICIAL] Apendice C eq. C15-C16 e secao 5.3:
    //   v_total = 3,469 (tolueno) + 0,302 (agua) = 3,771 m³/h
    //   V = 2 · v_total · 300 s = 0,628 m³  (5 min a 50 % de enchimento)
    //   Tabela 11.6 do Turton, tambor liquido horizontal, L/D = 3,0
    //   V = (pi.D²/4)·L com L = 3D  ->  D = 0,64 m ; L = 1,92 m
    Di: 0.64,
    Ltan: 1.92,

    volumeTotal: 0.628,
    volumeUtil: 0.314,          // 50 % de enchimento

    // Fracao pesada (agua) proporcional a vazao volumetrica: 0,302/3,771
    volumeFasePesada: 0.0252,

    // [VERIFICAR] vaso de baixa pressao (opera proximo da atmosferica apos a
    // valvula de expansao a jusante). Espessura minima construtiva.
    espessura: 0.008,

    // Em vaso horizontal, tampoFundo e o tampo ESQUERDO e tampoTopo o DIREITO.
    tampoTopo: 'eliptico',
    tampoFundo: 'eliptico',
    abaReta: 0.03,

    // --- Suportacao em bercos (saddles) --- [VERIFICAR]
    alturaEixo: 0.90,           // altura do eixo do vaso em relacao ao piso
    bercos: { largura: 0.16, fracao: 0.22 },   // fracao de Ltan a partir da tangencia
    fundacaoAltura: 0.25,
    fundacaoLargura: 0.45,      // ao longo do eixo, por bloco

    isolamento: 0,
  },

  processo: {
    'Tipo': 'Decantador horizontal (tambor líquido)',
    'Temperatura de operação': '50 °C',
    'Pressão de operação': 'Atmosférica',
    'Método de dimensionamento': 'Tabela 11.6 de Turton — tambor líquido horizontal',
    'Tempo de retenção': '5 min a 50 % da capacidade',
    'Vazão volumétrica total': '3,771 m³/h (0,001048 m³/s)',
    'Vazão volumétrica de tolueno': '3,469 m³/h',
    'Vazão volumétrica de água': '0,302 m³/h',
    'Densidade do tolueno a 50 °C': '860 kg/m³',
    'Densidade da água a 50 °C': '988 kg/m³',
    'Diferença de densidade': '128 kg/m³',
    'Volume total': '0,628 m³',
    'Relação L/D': '3,0',
  },

  mecanica: {
    /* Como no V-01, mais um agravante: a fase aquosa que sai daqui carrega
     * acido benzoico dissolvido e e levemente acida, o que afasta de vez o aco
     * carbono. */
    'Material do costado': 'Aço inoxidável AISI 304L',
    'Material dos tampos': 'Aço inoxidável AISI 304L',
    'Tipo de tampo': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Espessura do costado': '8 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm (estimado)',
    'Temperatura de projeto': '80 °C (estimado)',
    'Pressão de projeto': '3,5 bar (estimado)',
    'Suportação': 'Dois berços soldados sobre blocos de concreto (estimado)',
    'Isolamento': 'Não aplicável',
  },

  componentes: 'Bota de decantação da fase pesada; dois berços de sustentação sobre blocos de concreto.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Nível'],
    isolamento: ['nenhum'],
    nota: 'Turton, Tabela 11.6: 5 min de residência a 50 % da capacidade e L/D = 3,0; separação pela diferença de densidade de 128 kg/m³.',
  },

  linhas: {
    N1: ['T/H2O', 'Fase líquida, de V-01 (1¼"-T/H2O-06-CS40)', 'Aço Carbono', 'CS40'],
    N2: ['H2O', 'Água de subproduto, descarte (½"-H2O-07-CS40)', 'Aço Carbono', 'CS40'],
    N3: ['TOL', 'Tolueno recuperado, para TK-01 via BC-03 (1¼"-TOL-08-CS40)', 'Aço Carbono', 'CS40'],
    N4: ['AL', 'Respiro / alívio', 'Aço Inox AISI 304L', 'SS40'],
  },

  /* Em vaso horizontal o bocal e localizado por `u` (distancia ao longo do
   * eixo, a partir da tangencia esquerda) e `ang` (0 = topo, 180 = fundo).
   * Bocais de tampo usam face 'tampo-esq' / 'tampo-dir' e `v` (altura em
   * relacao ao eixo). Elevacoes e angulos [VERIFICAR]. */
  bocais: [
    { id: 'N1', dn: 32, face: 'topo', u: 0.35, corrente: '06', servico: 'Entrada de fase líquida (de V-01)' },
    // u = 0,20 m mantem o bocal livre do berço esquerdo, que fica em 0,42 m.
    { id: 'N2', dn: 15, face: 'fundo', u: 0.20, corrente: '07', servico: 'Saída de água (fase pesada)' },
    { id: 'N3', dn: 32, face: 'tampo-dir', v: 0.10, corrente: '08', servico: 'Saída de tolueno (fase leve)' },
    { id: 'N4', dn: 50, face: 'topo', u: 1.55, servico: 'Respiro / alívio de pressão' },
  ],

  /* [OFICIAL] Apendice A, eq. A9. */
  correntes: [
    {
      id: '06', bocal: 'N1', sentido: 'entrada', fluido: 'Fase líquida condensada',
      vazao: '3 281,1 kg/h', T: '50 °C', P: 'Atm.',
      composicao: '2 983,2 tolueno + 297,9 água (kg/h)',
    },
    {
      id: '07', bocal: 'N2', sentido: 'saída', fluido: 'Água de descarte',
      vazao: '297,9 kg/h', T: '50 °C', P: 'Atm.',
      composicao: 'Subproduto da oxidação',
    },
    {
      id: '08', bocal: 'N3', sentido: 'saída', fluido: 'Tolueno recuperado',
      vazao: '2 983,2 kg/h', T: '50 °C', P: 'Atm.',
      composicao: 'Segue para o Tanque de Tolueno TK-01',
    },
  ],
};

/* ===========================================================================
 *  TK-01  —  TANQUE DE TOLUENO  (pulmao atmosferico, fundo plano)
 *  Apendice C, eq. C46-C52 · balanco de massa: fecha em 5 673,2 kg/h
 * =========================================================================== */

export const TK01 = {
  tag: 'TK-01',
  nome: 'Tanque de Tolueno',
  tipo: 'Tanque cilíndrico vertical atmosférico',
  servico: 'Pulmão regulador de inventário de tolueno: recebe o condensado do '
    + 'decantador V-02 e o tolueno de topo do stripper T-01, e distribui para o '
    + 'dissolvedor D-01 e para a lavagem da torta no filtro F-02',
  posicao: 'Vertical',

  geom: {
    // [OFICIAL] Apendice C, eq. C50-C52:
    //   V = (pi/4)·D²·H  com  H = 1,5·D  ->  D = 1,51 m ; H = 2,27 m
    Di: 1.51,
    Ltan: 2.27,

    // [OFICIAL] eq. C46-C49:
    //   Qvol = 5 673,2 / 832 = 6,82 m³/h
    //   Vutil = Qvol · tau = 0,1136 m³/min · 15 min = 1,70 m³
    //   Vtotal = 2 · Vutil = 3,41 m³   (operacao a meio-cheio)
    //   Vprojeto = 1,20 · Vtotal = 4,09 m³
    volumeUtil: 1.70,
    volumeTotal: 4.09,

    // [VERIFICAR] tanque atmosferico: espessura minima construtiva, nao de
    // pressao. Fundo PLANO apoiado em berco anelar de concreto.
    espessura: 0.006,
    tampoTopo: 'eliptico',
    tampoFundo: 'plano',
    abaReta: 0.02,

    saiaAltura: 0.35,
    saiaEspessura: 0.008,
    baseAnelLargura: 0.16,
    fundacaoAltura: 0.25,
    fundacaoLado: 2.4,

    isolamento: 0,
  },

  processo: {
    'Tipo': 'Tanque cilíndrico vertical, pulmão de inventário',
    'Temperatura de operação': '60 °C',
    'Pressão de operação': 'Atmosférica',
    'Vazão mássica': '5 673,2 kg/h',
    'Densidade do tolueno': '832 kg/m³',
    'Vazão volumétrica': '6,82 m³/h',
    'Tempo de residência': '15 min',
    'Volume útil': '1,70 m³',
    'Volume total (meio-cheio)': '3,41 m³',
    'Volume de projeto': '4,09 m³ (margem de 20 %)',
    'Relação H/D': '1,5',
  },

  mecanica: {
    /* UNICA TROCA DE MATERIAL DOS QUATRO.
     * Tolueno seco nao corroi aco carbono (< 0,025 mm/ano) e tanque atmosferico
     * de solvente aromatico e aco carbono por padrao em API 650. A unica ameaca
     * e a agua livre que decanta no fundo — e problema localizado se resolve no
     * local (revestimento e dreno), nao trocando o vaso inteiro de liga.
     * Diferente do V-01, aqui o ferro nao chega ao reator: o produto e
     * recuperado por cristalizacao, que deixa o Fe no licor-mae.
     * Economia liquida da ordem de R$ 13 000. Ver Selecao-de-materiais.md. */
    'Material do costado': 'Aço carbono ASTM A516 Gr. 70',
    'Material do tampo': 'Aço carbono ASTM A516 Gr. 70',
    'Revestimento interno': 'Fundo com epóxi-fenólico, contra a água decantada',
    'Dreno de água livre': 'Bota de decantação com dreno',
    'Tipo de fundo': 'Plano (estimado)',
    'Tipo de teto': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'API 650 / ASME VIII Div. 1 (estimado)',
    'Espessura do costado': '6 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm',
    'Temperatura de projeto': '80 °C (estimado)',
    'Pressão de projeto': 'Atmosférica com respiro (estimado)',
    'Suportação': 'Berço anelar sobre laje (estimado)',
    'Isolamento': 'Não aplicável',
    // O costado em aco carbono ligado a linhas de inox forma par galvanico, e
    // quem corroi e o aco. A mitigacao mora na tubulacao, nao no vaso.
    'Ligação às linhas': 'Kit de isolamento galvânico nos flanges (linhas em inox)',
  },

  componentes: 'Fundo revestido com epóxi-fenólico; bota de decantação com dreno de água livre; respiro atmosférico; berço anelar sobre laje.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Nível', 'Vazão'],
    isolamento: ['nenhum'],
    nota: 'Costado em aço carbono: tolueno seco não corrói, e a água que decanta é tratada no fundo. Ver Seleção de materiais.',
  },

  linhas: {
    N1: ['TOL', 'Tolueno condensado, de V-02 (1¼"-TOL-08-CS40)', 'Aço Carbono', 'CS40'],
    N2: ['TOL', 'Tolueno do vaso flash, de T-01 via BC-04 (1¼"-TOL-29-CS40)', 'Aço Carbono', 'CS40'],
    N3: ['TOL', 'Tolueno de dissolução, para D-01 (1¼"-TOL-10-CS40)', 'Aço Carbono', 'CS40'],
    N4: ['TOL', 'Tolueno de lavagem, para F-01 via BC-06 (1¼"-TOL-09-CS40)', 'Aço Carbono', 'CS40'],
    N5: ['RE', 'Respiro atmosférico', 'Aço Inox AISI 304L', 'SS40'],
  },

  bocais: [
    { id: 'N1', dn: 32, face: 'topo', ang: 40, r: 0.45, corrente: '08', servico: 'Entrada de tolueno condensado (de V-02)' },
    { id: 'N2', dn: 32, face: 'topo', ang: 140, r: 0.45, corrente: '29', servico: 'Entrada de tolueno do stripper T-01' },
    { id: 'N3', dn: 32, face: 'lateral', y: 0.22, ang: 250, corrente: '10', servico: 'Saída para o dissolvedor D-01 (via BC-09, proposta)' },
    { id: 'N4', dn: 32, face: 'lateral', y: 0.22, ang: 290, corrente: '09', servico: 'Saída para lavagem da torta no filtro F-01 (via BC-06)' },
    { id: 'N5', dn: 100, face: 'topo', ang: 270, r: 0.30, servico: 'Respiro atmosférico com corta-chamas' },
    { id: 'M1', dn: 500, face: 'lateral', y: 1.30, ang: 0, servico: 'Boca de visita (inspeção)' },
  ],

  correntes: [
    {
      id: '08', bocal: 'N1', sentido: 'entrada', fluido: 'Tolueno condensado',
      vazao: '2 983,2 kg/h', T: '50 °C', P: 'Atm.',
      composicao: 'Recuperado no decantador V-02',
    },
    {
      id: '29', bocal: 'N2', sentido: 'entrada', fluido: 'Tolueno do stripper',
      vazao: '2 690,0 kg/h', T: '50 °C', P: 'Atm.',
      composicao: 'Parcela do topo do T-01 não reciclada ao reator',
    },
    {
      id: '10', bocal: 'N3', sentido: 'saída', fluido: 'Tolueno para dissolução',
      vazao: '2 836,8 kg/h', T: '60 °C', P: 'Atm.',
      composicao: 'Alimenta o dissolvedor D-01',
    },
    {
      id: '09', bocal: 'N4', sentido: 'saída', fluido: 'Tolueno para lavagem',
      vazao: '2 836,8 kg/h', T: '60 °C', P: 'Atm.',
      composicao: 'Lavagem da torta no filtro F-01',
    },
  ],

  /* Numeracao do P&ID Rev. 1 e do Datasheet: S-09 vai a lavagem do F-01
   * (via BC-06) e S-10 ao dissolvedor D-01. A secao 5.2 do relatorio troca
   * as duas em frases diferentes. Temperatura de 60 °C pelo Quadro B3 e
   * pelas correntes S-09/S-10; o Datasheet diz 50 °C (divergencia 8 entre os documentos). */
};

/* ===========================================================================
 *  T-01  —  VASO FLASH (STRIPPER)
 *  Quadro 06 do relatorio · descricao de processo secao 5.2
 *
 *  DIVERGENCIAS DO RELATORIO, registradas em vez de escolhidas em silencio:
 *
 *  1. O titulo do Quadro 06 diz "Vaso Flash (T-02)", mas a linha TAG dentro do
 *     proprio quadro diz T-01, e a secao 5.2 chama o equipamento de T-01 o
 *     tempo todo. Adotado T-01.
 *
 *  2. A secao 5.2 chama a corrente de topo de 29 e, duas frases depois, usa 29
 *     de novo para o ramo que segue ao TK-01 — o mesmo numero para o total e
 *     para uma das partes. Aqui o topo e 13 e o ramo para o tanque continua 29,
 *     que e a numeracao ja usada pela tubulacao da maquete.
 *
 *  3. A secao 5.2 numera a saida de fundo como 30; a maquete usa 32. Mantido
 *     32, por coerencia com o resto do modelo.
 * =========================================================================== */

export const T01 = {
  tag: 'T-01',
  nome: 'Vaso Flash (Stripper)',
  tipo: 'Vaso de flash vertical com serpentina de aquecimento',
  servico: 'Vaporiza parte do tolueno do licor de oxidacao, concentrando o acido '
    + 'benzoico de 20 % para 50 % em massa na corrente de fundo, que e a condicao '
    + 'de entrada da cristalizacao',

  geom: {
    // [OFICIAL] Quadro 06: D = 0,91 m e H = 2,94 m.
    // A maquete 3D trazia 2,74 m, que nao vem do relatorio.
    Di: 0.91,
    Ltan: 2.94,

    // Costado cilindrico + dois tampos elipticos 2:1:
    //   pi/4 x 0,91² x 2,94 = 1,912 m³  +  2 x pi x 0,91³/24 = 0,197 m³
    volumeTotal: 2.109,
    // Altura de liquido de 0,94 m [OFICIAL, Apendice C] medida da tangencia
    // inferior, mais o tampo de fundo cheio. O volume e calculado no raio
    // EXTERNO (Di/2 + espessura), que e o que o gerador de croqui integra:
    //   pi x (2R)³/24 + pi R² x 0,94, com R = 0,460 m.
    volumeUtil: 0.727,

    // [OFICIAL] Quadro 06: espessura 5 mm, sobrespessura de corrosao 2 mm.
    espessura: 0.005,

    tampoTopo: 'eliptico',
    tampoFundo: 'eliptico',
    abaReta: 0.03,

    // --- Suportacao --- [VERIFICAR]
    saiaAltura: 2.2,
    saiaEspessura: 0.008,
    // A linha 32 sai do fundo para o lado do rack, para a BC-11 sob ele, na
    // cota da succao dela (o T-01 gira 180° no arranjo da Fase 11: 270° local
    // e o sul); do outro lado ficam os bocais de vapor da serpentina. [ADOTADO]
    saiaPassagens: [{ ang: 270, y: 0.45, diam: 0.3, linha: '32' }],
    baseAnelLargura: 0.12,
    fundacaoAltura: 0.25,
    fundacaoLado: 1.8,

    // Opera a 154 °C: o isolamento e de protecao pessoal e de perda termica.
    isolamento: 0.05,
  },

  processo: {
    'Tipo': 'Destilador flash vertical, aquecido por serpentina',
    'Temperatura de operação': '154 °C',
    'Pressão de operação': '1,3 bar',
    'Origem da despressurização': 'Válvula de expansão a montante (15 bar → 1,3 bar)',
    'Calor fornecido': '980 kW por serpentina de vapor',
    'Método de dimensionamento': 'Relação D = H/3 (Peters) e velocidade de vapor',
    'Fator de capacidade k': '0,107 m/s (vasos flash)',
    'Velocidade máxima de vapor': '1,64 m/s',
    'Área de separação': '0,665 m²',
    // A altura de liquido NAO entra aqui: ela e calculada por nivelDeVolume
    // e ja sai cotada no croqui e na folha. Digitar de novo era o caminho
    // curto para os dois documentos discordarem.
    'Volume total': '2,109 m³',
    'Concentração de AB na entrada': '20 % em massa',
    'Concentração de AB no fundo': '50 % em massa',
  },

  mecanica: {
    'Material do costado': 'Aço inoxidável AISI 316L',
    'Material dos tampos': 'Aço inoxidável AISI 316L',
    'Espessura do costado': '5 mm',
    'Sobrespessura de corrosão': '2,0 mm',
    'Tipo de tampo': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Temperatura de projeto': '185 °C (estimado)',
    'Pressão de projeto': '3,5 bar (estimado)',
    'Serpentina de aquecimento': 'Vapor saturado, AISI 304 (estimado)',
    'Suportação': 'Saia cilíndrica soldada (estimado)',
    'Isolamento': 'Lã de rocha, 50 mm (estimado)',
  },

  posicao: 'Vertical',

  componentes: 'Serpentina interna de vapor (980 kW); saia de sustentação; isolamento de lã de rocha, 50 mm.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Nível', 'Pressão'],
    isolamento: ['quente', 'pessoal'],
    nota: 'Alimentado após válvula de expansão de 15 para 1,3 bar; concentra o ácido benzóico de 20 % para 50 % em massa no fundo.',
  },

  linhas: {
    N1: ['TOL/AB', 'Licor de oxidação despressurizado, de R-01 via V-03 (3"-TOL/AB-12-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    N2: ['TOL', 'Tolueno vaporizado, para E-04 (3"-TOL-13-CS40)', 'Aço Carbono', 'CS40'],
    N3: ['TOL/AB', 'Concentrado de ácido benzóico, para E-03 (3"-TOL/AB-32-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    V1: ['STM', 'Vapor de aquecimento da serpentina (3"-STM-12A-CS40)', 'Aço Carbono', 'CS40'],
    V2: ['COND', 'Condensado da serpentina (1"-COND-12B-CS40)', 'Aço Carbono', 'CS40'],
  },

  /* Elevacoes e angulos [VERIFICAR]; servicos, vazoes e correntes [OFICIAL]. */
  bocais: [
    { id: 'N1', dn: 80, face: 'lateral', y: 1.95, ang: 180, corrente: '12', servico: 'Entrada do licor de oxidação (de R-01)' },
    // [OFICIAL] 3" pelo Datasheet — mas a 0,871 m³/s de vapor (eq. C18) da
    // ~180 m/s nessa linha. Pendencia de engenharia levada a equipe.
    { id: 'N2', dn: 80, face: 'topo', ang: 0, r: 0, corrente: '13', servico: 'Saída de tolueno vaporizado (para E-04)' },
    { id: 'N3', dn: 80, face: 'fundo', ang: 0, r: 0, corrente: '32', servico: 'Saída do concentrado (para E-03)' },
    // A serpentina precisa de entrada e retorno; o relatorio cita a carga
    // termica, nao os bocais. Ambos estimados.
    { id: 'V1', dn: 80, face: 'lateral', y: 0.55, ang: 0, servico: 'Vapor de aquecimento — entrada (estimado)' },
    { id: 'V2', dn: 25, face: 'lateral', y: 0.20, ang: 0, servico: 'Condensado — retorno (estimado)' },
  ],

  /* [OFICIAL] secao 5.2 do relatorio. */
  correntes: [
    {
      id: '12', bocal: 'N1', sentido: 'entrada', fluido: 'Licor de oxidação despressurizado',
      vazao: '19 649 kg/h', T: '154 °C', P: '1,3 bar',
      composicao: '20 % em massa de ácido benzóico em tolueno',
    },
    {
      id: '13', bocal: 'N2', sentido: 'saída', fluido: 'Tolueno vaporizado',
      vazao: '11 789 kg/h', T: '154 °C', P: '1,3 bar',
      composicao: 'Tolueno; reparte-se em 14 (9 099 kg/h, reciclo ao R-01) '
        + 'e 29 (2 690 kg/h, para o TK-01)',
    },
    {
      id: '32', bocal: 'N3', sentido: 'saída', fluido: 'Concentrado de ácido benzóico',
      vazao: '7 860 kg/h', T: '154 °C', P: '1,3 bar',
      composicao: '50 % em massa de ácido benzóico em tolueno',
    },
  ],
};

/* ===========================================================================
 *  CR-01  —  CRISTALIZADOR POR RESFRIAMENTO 1
 *  Quadro 07 do relatorio · descricao de processo secao 5.2 · Apendice C eq. C29
 *
 *  A ALTURA DA CAMISA nao esta tabelada: ela e DEDUZIDA da area de troca, que
 *  esta. Para camisa cilindrica, A = pi x D x h, entao
 *      h = 41,1 / (pi x 4,03) = 3,25 m
 *  dos 4,43 m de costado. Por isso o nivel de liquido foi posto logo acima
 *  dela: nao se troca calor por parede seca.
 * =========================================================================== */

export const CR01 = {
  tag: 'CR-01',
  nome: 'Cristalizador por Resfriamento 1',
  tipo: 'Vaso agitado encamisado, cristalizacao por resfriamento',
  servico: 'Converte a solucao concentrada de acido benzoico em tolueno, vinda do '
    + 'stripper via E-03, em suspensao de cristais, resfriando de 92 °C para 49 °C '
    + 'e reduzindo a solubilidade do acido',

  geom: {
    // [OFICIAL] Quadro 07. A maquete 3D trazia 3,00 x 4,50 m, que nao vem do
    // relatorio — o diametro estava 1,03 m menor que o dimensionado.
    Di: 4.03,
    Ltan: 4.43,

    // Costado + dois tampos elipticos 2:1, no raio externo (R = 2,027 m):
    //   pi R² x 4,43 = 57,18 m³   +   2 x pi (2R)³/24 = 17,44 m³
    volumeTotal: 74.62,
    // Liquido ate 3,30 m, um palmo acima do topo da camisa (3,25 m).
    volumeUtil: 51.32,

    espessura: 0.012,

    // Fundo conico de 90° (decisao 3): tem o mesmo volume do tampo 2:1, entao
    // volumeTotal e o nivel acima da tangencia continuam os do Datasheet.
    tampoTopo: 'eliptico',
    tampoFundo: 'conico',
    abaReta: 0.04,

    /* Camisa de troca termica. `base` e a cota da borda inferior acima da
     * tangencia de fundo; `altura` sai da area de troca (ver cabecalho);
     * `folga` e o vao anular por onde passa a agua. */
    camisa: { base: 0.15, altura: 3.25, folga: 0.075 },

    /* Agitacao: a cristalizacao por resfriamento precisa de mistura para nao
     * incrustar na parede fria e para manter os cristais em suspensao.
     * Turbina de pas inclinadas, que e o impelidor usual de suspensao de
     * solidos, ao contrario da Rushton do reator, que e de dispersao de gas.
     * Geometria [VERIFICAR]: D/3 e uma proporcao tipica, nao um calculo. */
    agitador: {
      tipo: 'Turbina de pas inclinadas 45° (estimado)',
      material: 'Aco inoxidavel AISI 304',
      nImpelidores: 2,
      Dimp: 1.34,
      alturaPrimeiro: 0.70,
      espacamento: 1.40,
      diamEixo: 0.14,
      rotacao: 60,
      potencia: 30,
    },

    // --- Suportacao --- decisao da equipe (22/10/2026): forma dos croquis,
    // numeros do Datasheet. Quatro pernas soldadas a camisa, com
    // contraventamento; deixam livres o bocal de fundo e a valvula.
    // `elevacao` e a cota da tangencia inferior acima do piso. [ADOTADO, Fase 5]
    // A linha 20 leva SUSPENSAO por gravidade (o P&ID nao tem bomba nela).
    // So o nivel acima da cuba ja faria o liquido correr, mas uma linha que
    // desce do fundo e sobe ate o filtro faz um ponto baixo onde o cristal
    // decanta e entope. Entao o bocal de fundo fica acima da entrada do F-01
    // e a linha desce o tempo todo, a 2 %:
    //   F-01.N1 1,84 + 0,5 (chegada por cima) + 0,6 (valvula e curva sob o
    //   bocal) + 2 % x 6 m = 3,06 m para o bocal de fundo
    //   + cone 2,02 + bocal 0,25 = 5,33 -> 5,4 m
    // Desde o capo do F-01 (27/10) o N1 fica na lateral da cuba, 0,32 m mais
    // baixo e chegando de lado: a conta acima sobra, e a elevacao fica.
    elevacao: 5.4,
    pernas: { n: 4, lado: 0.30, fixacao: 0.8 },

    // Resfria ate 49 °C; sem isolamento a camisa perderia carga para o
    // ambiente. Nao esta no relatorio, entao vai como estimado no datasheet.
    isolamento: 0.05,
  },

  processo: {
    'Tipo': 'Cristalizador por resfriamento, agitado e encamisado',
    'Temperatura de operação': '49 °C',
    'Pressão de operação': 'Atmosférica',
    'Temperatura de entrada': '92 °C',
    'Carga térmica removida': '447 kW',
    'Área de troca térmica': '41,1 m²',
    'Coeficiente global U': '300 W/m²·°C',
    'ΔT médio logarítmico': '36,3 °C',
    'Altura de camisa deduzida': '3,25 m  (A = π·D·h)',
    'Vazão de alimentação': '15 275 kg/h (corrente 19)',
    'Ácido benzóico cristalizado': '3 774 kg/h',
    'Volume total': '74,6 m³',
  },

  mecanica: {
    'Material do costado': 'Aço inoxidável AISI 304',
    'Material dos tampos': 'Aço inoxidável AISI 304',
    'Material da camisa': 'Aço carbono (estimado)',
    'Espessura do costado': '12 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm (estimado)',
    'Tipo de tampo': 'Elíptico 2:1 no topo; fundo cônico de 90° (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Temperatura de projeto': '120 °C (estimado)',
    'Pressão de projeto': '3,0 bar no costado / 6,0 bar na camisa (estimado)',
    'Agitador': 'Turbina de pás inclinadas 45°, 2 estágios (estimado)',
    'Suportação': 'Quatro pernas soldadas à camisa, com contraventamento (estimado)',
    'Isolamento': 'Lã de rocha, 50 mm (estimado)',
  },

  posicao: 'Vertical',

  componentes: 'Camisa de troca térmica de 3,25 m; agitador de turbina de pás inclinadas, 2 estágios; fundo cônico; quatro pernas com contraventamento; isolamento de 50 mm.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Temperatura', 'Nível'],
    isolamento: ['frio'],
    nota: 'Altura da camisa deduzida da área de troca, A = π·D·h = 3,25 m; o nível de operação fica acima dela.',
  },

  linhas: {
    N1: ['AB/TOL', 'Solução concentrada + licor-mãe do F-02, de E-03 e V-16 (2½"-AB/TOL-19-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    N2: ['AB/TOL', 'Suspensão de cristais, para F-01 (6"-AB/TOL-20-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    A1: ['AR', 'Água de resfriamento — entrada', 'Aço Carbono', 'CS40'],
    A2: ['AR', 'Água de resfriamento — saída', 'Aço Carbono', 'CS40'],
  },

  /* Elevacoes e angulos [VERIFICAR]; servicos, vazoes e correntes [OFICIAL]. */
  bocais: [
    { id: 'N1', dn: 65, face: 'topo', ang: 0, r: 0.90, corrente: '19', servico: 'Entrada da solução concentrada + licor-mãe do F-02' },
    { id: 'N2', dn: 150, face: 'fundo', ang: 0, r: 0, corrente: '20', servico: 'Saída de suspensão (para F-01)' },
    // Sem bocal proprio para a corrente 26: pelo P&ID e pelo Datasheet ela se
    // junta a 18 na valvula V-16, antes do cristalizador, e entra como 19.
    // Agua entra embaixo e sai em cima: a camisa opera cheia, em contracorrente
    // com o liquido que desce resfriando.
    { id: 'A1', dn: 100, face: 'lateral', y: 0.30, ang: 90, servico: 'Água de resfriamento — entrada (estimado)' },
    { id: 'A2', dn: 100, face: 'lateral', y: 3.25, ang: 90, servico: 'Água de resfriamento — saída (estimado)' },
  ],

  /* [OFICIAL] secao 5.2 do relatorio. */
  correntes: [
    {
      id: '19', bocal: 'N1', sentido: 'entrada', fluido: 'Solução concentrada de ácido benzóico',
      vazao: '15 275 kg/h', T: '92 °C', P: 'Atmosférica',
      composicao: 'Mistura da corrente 18 (do E-03) com o licor recirculado 26 (do F-02)',
    },
    {
      id: '20', bocal: 'N2', sentido: 'saída', fluido: 'Suspensão de cristais de ácido benzóico',
      vazao: '15 275 kg/h', T: '49 °C', P: 'Atmosférica',
      composicao: '3 774 kg/h de AB cristalizado em suspensão no licor-mãe',
    },
  ],
};

/* ===========================================================================
 *  D-01  —  DISSOLVEDOR
 *  Quadro 08 do relatorio · descricao de processo secao 5.2
 *
 *  O QUADRO 08 NAO DA O DIAMETRO, da volume e altura. Ele sai deles, e a
 *  equacao trata o volume como CILINDRO — a mesma leitura ja registrada para
 *  o R-01 no Apendice C:
 *      D = raiz(4 V / (pi H)) = raiz(4 x 5 / (pi x 3,82)) = 1,291 m
 *  O resultado da H/D = 2,96, praticamente os 3,0 que o relatorio adota como
 *  otimo economico nos demais vasos verticais. A coincidencia e boa evidencia
 *  de que a leitura esta certa.
 *
 *  DUAS DIVERGENCIAS DO RELATORIO:
 *
 *  1. O titulo do Quadro 08 diz "Dissolvedor (D-01)", mas a linha TAG dentro
 *     do quadro diz T-01, que e o vaso flash. Adotado D-01.
 *
 *  2. A secao 5.2 usa "Corrente 10" tanto para o tolueno que alimenta este
 *     dissolvedor quanto para o tolueno de lavagem do F-02. Aqui a entrada do
 *     dissolvedor e a 09, que e a numeracao ja adotada na saida do TK-01 e a
 *     unica que fecha o balanco do tanque em 5 674 kg/h.
 * =========================================================================== */

export const D01 = {
  tag: 'D-01',
  nome: 'Dissolvedor',
  tipo: 'Vaso agitado encamisado, redissolucao de torta',
  servico: 'Redissolve a torta de acido benzoico vinda do F-01 em tolueno fresco '
    + 'do TK-01, a 76,7 °C, preparando a solucao para a segunda cristalizacao',

  geom: {
    // [OFICIAL] Quadro 08: V = 5 m³ e H = 3,82 m; o diametro e deduzido.
    // A maquete 3D trazia 1,60 x 2,40 m, que nao vem do relatorio.
    Di: 1.291,
    Ltan: 3.82,

    // No raio externo (R = 0,6535 m): 2 tampos de 0,292 m³ + cilindro de
    // 1,3416 m²/m x 3,82 m.
    volumeTotal: 5.709,
    // [OFICIAL] os 5 m³ do quadro sao o volume de liquido; conferem com o
    // nivel de 3,509 m calculado por integracao.
    volumeUtil: 5.000,

    espessura: 0.008,

    tampoTopo: 'eliptico',
    tampoFundo: 'eliptico',
    abaReta: 0.03,

    /* Camisa de aquecimento. Ao contrario do CR-01, o Quadro 08 NAO tabela
     * area de troca — so os 238 kW da secao 5.2. Entao a altura foi arbitrada
     * cobrindo o costado ate abaixo do nivel, e a utilidade sai da conta:
     *   A = pi x 1,291 x 3,40 = 13,79 m²
     *   dT = 238 kW / (300 W/m²·°C x 13,79 m²) = 57,5 °C
     *   utilidade a 76,7 + 57,5 = 134 °C  ->  vapor saturado a ~3 bar
     * Vapor de baixa pressao resolve, o que torna a escolha defensavel. */
    camisa: { base: 0.12, altura: 3.40, folga: 0.06 },

    /* Dissolucao de solido precisa de agitacao vigorosa junto ao fundo, onde
     * a torta chega. [VERIFICAR]: proporcoes tipicas, nao calculo. */
    agitador: {
      tipo: 'Turbina de pas inclinadas 45° (estimado)',
      material: 'Aco inoxidavel AISI 304',
      nImpelidores: 2,
      Dimp: 0.43,
      alturaPrimeiro: 0.35,
      espacamento: 1.20,
      diamEixo: 0.08,
      rotacao: 90,
      potencia: 11,
    },

    // --- Suportacao --- decisao da equipe: pernas, como no croqui, com as
    // dimensoes do Datasheet (decisao 2). A saida vai a bomba BC-07, entao
    // basta folga para o bocal de fundo e a valvula. [ESTIMADO]
    elevacao: 1.2,
    pernas: { n: 4, lado: 0.16, fixacao: 0.5 },

    isolamento: 0.05,
  },

  processo: {
    'Tipo': 'Vaso agitado encamisado, redissolução',
    'Temperatura de operação': '76,7 °C',
    'Pressão de operação': 'Atmosférica',
    'Calor fornecido': '238 kW',
    'Entrada de torta': '4 943 kg/h (corrente 23, do F-01)',
    'Entrada de tolueno': '2 837 kg/h (corrente 10, do TK-01)',
    'Saída de solução': '7 780 kg/h (corrente 24, para CR-02)',
    'Volume de líquido': '5,00 m³',
    'Volume geométrico total': '5,71 m³',
    'Relação L/D': '2,96',
    'Área de camisa (estimada)': '13,79 m²',
    'Utilidade de aquecimento (estimada)': 'Vapor saturado a ~3 bar (134 °C)',
  },

  mecanica: {
    'Material do costado': 'Aço inoxidável AISI 304 (estimado)',
    'Material dos tampos': 'Aço inoxidável AISI 304 (estimado)',
    'Material da camisa': 'Aço carbono (estimado)',
    'Espessura do costado': '8 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm (estimado)',
    'Tipo de tampo': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Temperatura de projeto': '150 °C (estimado)',
    'Pressão de projeto': '3,0 bar no costado / 6,0 bar na camisa (estimado)',
    'Agitador': 'Turbina de pás inclinadas 45°, 2 estágios (estimado)',
    'Suportação': 'Quatro pernas soldadas à camisa (estimado)',
    'Isolamento': 'Lã de rocha, 50 mm (estimado)',
  },

  posicao: 'Vertical',

  componentes: 'Camisa de aquecimento a vapor de 3,40 m; agitador de turbina de pás inclinadas, 2 estágios; quatro pernas; isolamento de 50 mm.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Temperatura', 'Nível'],
    isolamento: ['quente'],
    nota: 'O Quadro 08 dá volume e altura; o diâmetro sai de D = raiz(4V/πH) = 1,291 m, o que dá H/D = 2,96.',
  },

  linhas: {
    N1: ['AB/TOL', 'Torta úmida de ácido benzóico, de F-01 via BD-01 (3"-AB/TOL-23-CS40)', 'Aço Carbono', 'CS40'],
    N2: ['TOL', 'Tolueno de dissolução, de TK-01 (1¼"-TOL-10-CS40)', 'Aço Carbono', 'CS40'],
    N3: ['AB/TOL', 'Solução de ácido benzóico, para CR-02 via BC-07 (2"-AB/TOL-24-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    V1: ['VP', 'Vapor de aquecimento — entrada', 'Aço Carbono', 'CS40'],
    V2: ['CD', 'Condensado — retorno', 'Aço Carbono', 'CS40'],
  },

  /* Elevacoes e angulos [VERIFICAR]; servicos, vazoes e correntes [OFICIAL]. */
  bocais: [
    { id: 'N1', dn: 80, face: 'topo', ang: 0, r: 0.30, corrente: '23', servico: 'Entrada de torta (de F-01)' },
    { id: 'N2', dn: 32, face: 'topo', ang: 180, r: 0.30, corrente: '10', servico: 'Entrada de tolueno (de TK-01, via BC-09 — proposta)' },
    { id: 'N3', dn: 50, face: 'fundo', ang: 0, r: 0, corrente: '24', servico: 'Saída de solução (para CR-02)' },
    // Vapor entra em cima e o condensado sai embaixo, que e o sentido de uma
    // camisa de aquecimento — o inverso da agua de resfriamento do CR-01.
    { id: 'V1', dn: 50, face: 'lateral', y: 3.20, ang: 90, servico: 'Vapor de aquecimento — entrada (estimado)' },
    { id: 'V2', dn: 50, face: 'lateral', y: 0.25, ang: 90, servico: 'Condensado — retorno (estimado)' },
  ],

  /* [OFICIAL] secao 5.2 do relatorio. O balanco fecha exatamente:
   * 4 943 + 2 837 = 7 780 kg/h. */
  correntes: [
    {
      id: '23', bocal: 'N1', sentido: 'entrada', fluido: 'Torta úmida de ácido benzóico',
      vazao: '4 943 kg/h', T: '49 °C', P: 'Atmosférica',
      composicao: '3 774 kg/h de ácido benzóico + 1 169 kg/h de tolueno',
    },
    {
      id: '10', bocal: 'N2', sentido: 'entrada', fluido: 'Tolueno de dissolução',
      vazao: '2 837 kg/h', T: '60 °C', P: 'Atmosférica',
      composicao: 'Tolueno do TK-01',
    },
    {
      id: '24', bocal: 'N3', sentido: 'saída', fluido: 'Solução de ácido benzóico em tolueno',
      vazao: '7 780 kg/h', T: '76,7 °C', P: 'Atmosférica',
      composicao: 'Ácido benzóico redissolvido, segue à segunda cristalização',
    },
  ],
};

/* ===========================================================================
 *  CR-02  —  CRISTALIZADOR POR RESFRIAMENTO 2
 *  Quadro 09 do relatorio · descricao de processo secao 5.2 · Apendice C eq. C40
 *
 *  DIVERGENCIA: o titulo do Quadro 09 diz "Cristalizador por Resfriamento 2
 *  (CR-02)", mas a linha TAG dentro do quadro diz CR-01, que e o primeiro
 *  cristalizador e ja tem quadro proprio (07) com outros numeros. Adotado
 *  CR-02. E o terceiro quadro seguido com a TAG trocada — vale o grupo revisar
 *  a tabela inteira antes de entregar.
 *
 *  ALTURA DA CAMISA, como no CR-01, deduzida da area de troca:
 *      h = 14,0 / (pi x 3,22) = 1,384 m   —  39 % do costado
 *  A camisa cobrir so o terco inferior nao e erro: a carga aqui e um terco da
 *  do CR-01 (144 contra 447 kW) num vaso que nao encolheu na mesma proporcao.
 *  O que confirma a coerencia e o FLUXO TERMICO, que bate entre os dois:
 *      CR-01: 447,0 / 41,1 = 10,9 kW/m²
 *      CR-02: 144,3 / 14,0 = 10,3 kW/m²
 *  E a conta fecha de volta: 300 W/m²·°C x 14,0 m² x 34,5 °C = 144,9 kW.
 * =========================================================================== */

export const CR02 = {
  tag: 'CR-02',
  nome: 'Cristalizador por Resfriamento 2',
  tipo: 'Vaso agitado encamisado, segunda cristalizacao',
  servico: 'Recristaliza o acido benzoico redissolvido no D-01, resfriando de '
    + '76,7 °C para 58 °C, formando cristais de maior pureza antes da filtracao '
    + 'final que entrega o produto',

  geom: {
    // [OFICIAL] Quadro 09. A maquete trazia 1,80 x 2,70 m, que nao vem do
    // relatorio — o diametro estava 1,42 m menor que o dimensionado.
    Di: 3.22,
    Ltan: 3.54,

    // No raio externo (R = 1,620 m): 2 tampos de 4,452 m³ + 8,245 m²/m x 3,54 m.
    volumeTotal: 38.09,

    /* [VERIFICAR] O relatorio nao publica o volume de liquido deste vaso.
     * Adotado o MESMO TEMPO DE RESIDENCIA do CR-01, que e o criterio que
     * costura os dois cristalizadores da mesma serie:
     *   tau(CR-01) = 51,32 m³ / (15 275 kg/h / 900 kg/m³) = 3,02 h
     *   V(CR-02)   = 3,02 h x (7 780 / 900) = 26,1 m³   ->  nivel 2,63 m
     * Da 74 % de enchimento do costado, e deixa a camisa inteiramente
     * submersa — que e a condicao para a area de troca valer. */
    volumeUtil: 26.14,

    espessura: 0.010,

    // Fundo conico de 90°, como o CR-01 (decisao 3); mesmo volume do 2:1.
    tampoTopo: 'eliptico',
    tampoFundo: 'conico',
    abaReta: 0.04,

    // Altura deduzida da area de troca; ver cabecalho.
    camisa: { base: 0.12, altura: 1.384, folga: 0.07 },

    /* Mesma familia de impelidor do CR-01: suspensao de solidos, nao dispersao
     * de gas. Proporcoes [VERIFICAR]. */
    agitador: {
      tipo: 'Turbina de pas inclinadas 45° (estimado)',
      material: 'Aco inoxidavel AISI 304',
      nImpelidores: 2,
      Dimp: 1.07,
      alturaPrimeiro: 0.55,
      espacamento: 1.10,
      diamEixo: 0.12,
      rotacao: 65,
      potencia: 18,
    },

    // --- Suportacao --- decisao da equipe (22/10/2026): forma dos croquis,
    // numeros do Datasheet. Quatro pernas soldadas a camisa, com
    // contraventamento; deixam livres o bocal de fundo e a valvula.
    // `elevacao` e a cota da tangencia inferior acima do piso. [ADOTADO, Fase 5]
    // Mesmo criterio do CR-01: a suspensao da linha 25 desce o tempo todo.
    //   F-02.N1 1,63 + 0,5 + 0,6 + 2 % x 5,2 m = 2,83 m para o bocal de fundo
    //   + cone 1,61 + bocal 0,25 = 4,69 -> 4,8 m
    elevacao: 4.8,
    pernas: { n: 4, lado: 0.25, fixacao: 0.6 },

    isolamento: 0.05,
  },

  processo: {
    'Tipo': 'Cristalizador por resfriamento, agitado e encamisado',
    'Temperatura de operação': '58 °C',
    'Pressão de operação': 'Atmosférica',
    'Temperatura de entrada': '76,7 °C',
    'Carga térmica removida': '144,3 kW',
    'Área de troca térmica': '14,0 m²',
    'Coeficiente global U': '300 W/m²·°C',
    'ΔT médio logarítmico': '34,5 °C',
    'Altura de camisa deduzida': '1,384 m  (A = π·D·h)',
    'Fluxo térmico': '10,3 kW/m²  (CR-01: 10,9 kW/m²)',
    'Vazão de alimentação': '7 780 kg/h (corrente 24, do D-01)',
    'Saída de suspensão': '7 780 kg/h (corrente 25, para F-02)',
    'Volume geométrico total': '38,09 m³',
    'Volume de líquido (estimado)': '26,1 m³, por tempo de residência do CR-01',
  },

  mecanica: {
    'Material do costado': 'Aço inoxidável AISI 316L',
    'Material dos tampos': 'Aço inoxidável AISI 316L',
    'Material da camisa': 'Aço carbono (estimado)',
    'Espessura do costado': '10 mm (estimado)',
    'Sobrespessura de corrosão': '3,0 mm (estimado)',
    'Tipo de tampo': 'Elíptico 2:1 (estimado)',
    'Código de projeto': 'ASME VIII Div. 1 (estimado)',
    'Temperatura de projeto': '120 °C (estimado)',
    'Pressão de projeto': '3,0 bar no costado / 6,0 bar na camisa (estimado)',
    'Agitador': 'Turbina de pás inclinadas 45°, 2 estágios (estimado)',
    'Suportação': 'Quatro pernas soldadas à camisa, com contraventamento (estimado)',
    'Isolamento': 'Lã de rocha, 50 mm (estimado)',
  },

  posicao: 'Vertical',

  componentes: 'Camisa de troca térmica de 1,384 m, submersa no nível de operação; agitador de turbina de pás inclinadas, 2 estágios; fundo cônico; quatro pernas com contraventamento; isolamento de 50 mm.',

  /* Campos que so a folha de especificacao usa (formato do modelo). */
  folha: {
    controles: ['Temperatura', 'Nível'],
    isolamento: ['frio'],
    nota: 'Camisa cobre 39 % do costado porque a carga é um terço da do CR-01; o fluxo térmico confere entre os dois, 10,3 contra 10,9 kW/m².',
  },

  linhas: {
    N1: ['AB/TOL', 'Solução de ácido benzóico, de D-01 via BC-07 (2½"-AB/TOL-24A-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    N2: ['AB/TOL', 'Suspensão de cristais purificados, para F-02 (6"-AB/TOL-25-SS304L)', 'Aço Inox AISI 304L', 'SS40S'],
    A1: ['AR', 'Água de resfriamento — entrada', 'Aço Carbono', 'CS40'],
    A2: ['AR', 'Água de resfriamento — saída', 'Aço Carbono', 'CS40'],
  },

  /* Elevacoes e angulos [VERIFICAR]; servicos, vazoes e correntes [OFICIAL]. */
  bocais: [
    { id: 'N1', dn: 65, face: 'topo', ang: 0, r: 0.70, corrente: '24', servico: 'Entrada da solução dissolvida (de D-01, via BC-07)' },
    { id: 'N2', dn: 150, face: 'fundo', ang: 0, r: 0, corrente: '25', servico: 'Saída de suspensão (para F-02)' },
    // Agua entra pelo fundo da camisa e sai pelo topo dela, para a camisa
    // operar cheia e em contracorrente. DN 50 [ESTIMADO] pela vazao (Fase
    // 23): 8 m³/h (Quadro B9) dao 1,0 m/s; o DN 80 de antes dava 0,47 m/s,
    // abaixo do minimo de agua de resfriamento (data/fluidos.js).
    { id: 'A1', dn: 50, face: 'lateral', y: 0.25, ang: 90, servico: 'Água de resfriamento — entrada (estimado)' },
    { id: 'A2', dn: 50, face: 'lateral', y: 1.45, ang: 90, servico: 'Água de resfriamento — saída (estimado)' },
  ],

  /* [OFICIAL] secao 5.2 do relatorio. */
  correntes: [
    {
      id: '24', bocal: 'N1', sentido: 'entrada', fluido: 'Solução de ácido benzóico em tolueno',
      vazao: '7 780 kg/h', T: '76,7 °C', P: 'Atmosférica',
      composicao: 'Ácido benzóico redissolvido no D-01',
    },
    {
      id: '25', bocal: 'N2', sentido: 'saída', fluido: 'Suspensão de cristais de maior pureza',
      vazao: '7 780 kg/h', T: '58 °C', P: 'Atmosférica',
      composicao: 'Segue ao F-02, de onde sai o produto final a 99 % de pureza',
    },
  ],
};

/* Equipamentos sob nossa responsabilidade, indexados por TAG. */
export const EQUIPAMENTOS = {
  'R-01': R01,
  'V-01': V01,
  'V-02': V02,
  'TK-01': TK01,
  'T-01': T01,
  'CR-01': CR01,
  'D-01': D01,
  'CR-02': CR02,
};

/* Cores por tipo de fluido — legenda da maquete 3D. */
export const CORES_FLUIDO = {
  'Ar de processo': '#5fb4e8',
  'Tolueno + ácido benzóico (reciclo)': '#e8b04b',
  'Vapores de tolueno e água': '#9aa7b4',
  'Licor de oxidação': '#d97a5a',
};
