/**
 * ============================================================================
 *  INSTRUMENTACAO DE CAMPO  (Fase 6 do ROTEIRO)
 * ============================================================================
 *
 *  pid.js diz QUAIS sao as valvulas e as malhas; aqui fica ONDE cada coisa e
 *  montada na maquete [ADOTADO]. instrumentacao.js poe, mede e reclama:
 *  valvula sem trecho reto que a caiba, valvula fora de alcance, placa de
 *  orificio sem trecho reto a montante, atuador batendo em tubo.
 * ============================================================================
 */

/* Valvula de controle a ate esta altura (eixo) e operavel e mantida do piso,
 * com escada portatil; acima disso pede plataforma. [ADOTADO] */
export const ACESSO_MAX = 2.5;

/* Valvula na linha: perto da ORIGEM (A) ou do DESTINO (B) do trecho em que
 * fica. Regra de campo: na descarga de bomba, junto a bomba; na saida de
 * vaso, junto ao vaso. Quando o destino fica no alto (topo do R-01 e do
 * CR-01), a valvula desce para onde se alcanca, perto da origem. */
export const VALVULA_PERTO = {
  'V-01': 'A',     // agua da camisa, no ramal, junto ao R-01
  'V-02': 'A',     // saida de licor do R-01
  'V-03': 'A',     // reciclo: o bocal fica a 12,5 m; a valvula, junto ao E-02
  'V-05': 'A',     // descarga da BC-11
  'V-07': 'A',     // descarga da BC-02
  'V-09': 'A',     // saida do V-02
  'V-12': 'A',     // saida do TK-01
  'V-13': 'A',     // saida do TK-01
  // entrada do CR-01, que fica a 11 m: no trecho baixo, junto ao pe do
  // riser — junto a V-16 a descida da 32 passa por cima dela
  'V-17': 'B',
  'V-18': 'A',     // descarga da BC-07
  'V-19': 'B',     // lavagem do F-01
  'V-20': 'B',     // entrada do D-01
  'V-21': 'B',     // lavagem do F-02
};

/* Placa de orificio: trecho reto, em diametros, antes e depois (ISO 5167,
 * caso de uma curva a montante, arredondado). [ADOTADO] */
export const RETO_ORIFICIO = { antes: 10, depois: 5 };

/**
 * Elemento de campo de cada malha de pid.js (MALHAS), achado por equip+tipo.
 *   bocal   num bocal do equipamento ({ bocal, ate } = DP com capilar ate
 *           a tomada de cima; { bocal, poco } = poco termometrico)
 *   vaso    no costado de um vaso vertical, no angulo dado (graus, de +X
 *           para +Z, no referencial do vaso); DP entre as tangencias
 *   horiz   no costado lateral de um vaso horizontal (V-02)
 *   topo    sobre o tampo de cima, a `r` do eixo, no angulo dado
 *   cuba    na parede da cuba de filtro rotativo, a `phi` graus do fundo
 *   linha   num trecho reto da linha; `de` escolhe o trecho pela origem
 *   peca: 'dp' | 'pressao' | 'poco' | 'radar' | 'orificio' | 'densimetro'
 */
export const INSTRUMENTOS = [
  { equip: 'R-01', tipo: 'nível', peca: 'dp', onde: { bocal: 'R-01.N7', ate: 'R-01.N6' } },
  { equip: 'R-01', tipo: 'temperatura', peca: 'poco', onde: { bocal: 'R-01.N8' } },
  { equip: 'R-01', tipo: 'composição', peca: 'densimetro', onde: { linha: '11', perto: 'A' } },
  { equip: 'CP-01', tipo: 'pressão', peca: 'pressao', onde: { linha: '01', perto: 'A' } },
  { equip: 'E-01', tipo: 'temperatura', peca: 'poco', onde: { linha: '03', perto: 'A' } },
  { equip: 'V-01', tipo: 'nível', peca: 'dp', onde: { vaso: 'V-01', ang: 90 } },
  { equip: 'V-02', tipo: 'pressão', peca: 'pressao', onde: { linha: '06', perto: 'B' } },
  { equip: 'V-02', tipo: 'nível', peca: 'dp', onde: { horiz: 'V-02' } },
  { equip: 'TK-01', tipo: 'nível', peca: 'radar', onde: { topo: 'TK-01', ang: 0, r: 0.45 } },
  { equip: 'TK-01', tipo: 'vazão', peca: 'orificio', onde: { linha: '10', de: 'BC-09', perto: 'A' } },
  { equip: 'E-02', tipo: 'temperatura', peca: 'poco', onde: { linha: '17', perto: 'A' } },
  { equip: 'T-01', tipo: 'pressão de entrada', peca: 'pressao', onde: { linha: '12', perto: 'A' } },
  { equip: 'T-01', tipo: 'nível', peca: 'dp', onde: { vaso: 'T-01', ang: 225 } },
  { equip: 'T-01', tipo: 'pressão do vaso', peca: 'pressao', onde: { topo: 'T-01', ang: 180, r: 0.25 } },
  { equip: 'CR-01', tipo: 'nível', peca: 'radar', onde: { topo: 'CR-01', ang: 90, r: 1.2 } },
  { equip: 'CR-01', tipo: 'temperatura', peca: 'poco', onde: { linha: '20', perto: 'A' } },
  { equip: 'F-01', tipo: 'vácuo', peca: 'pressao', onde: { linha: 'V1', perto: 'B' } },
  { equip: 'F-01', tipo: 'nível', peca: 'pressao', onde: { cuba: 'F-01', phi: 40, z: -0.6 } },
  { equip: 'F-01', tipo: 'vazão de lavagem', peca: 'orificio', onde: { linha: '09A', perto: 'B' } },
  { equip: 'D-01', tipo: 'temperatura', peca: 'poco', onde: { vaso: 'D-01', ang: 0, altura: 0.35 } },
  // 270°: no meio do vão entre as pernas de 225° e 315°. A 300° a tomada de
  // baixo ficava a 4 cm da perna de 315°, o flange sem chave e o transmissor
  // atrás dela (Fase 25, __auditarContato) [ADOTADO]
  { equip: 'D-01', tipo: 'nível', peca: 'dp', onde: { vaso: 'D-01', ang: 270 } },
  { equip: 'CR-02', tipo: 'nível', peca: 'radar', onde: { topo: 'CR-02', ang: 90, r: 1.0 } },
  { equip: 'CR-02', tipo: 'temperatura', peca: 'poco', onde: { linha: '25', perto: 'A' } },
  { equip: 'F-02', tipo: 'vácuo', peca: 'pressao', onde: { linha: 'V2', perto: 'B' } },
  { equip: 'F-02', tipo: 'nível', peca: 'pressao', onde: { cuba: 'F-02', phi: 40, z: -0.4 } },
  { equip: 'F-02', tipo: 'vazão de lavagem', peca: 'orificio', onde: { linha: '30', perto: 'B' } },
];

/* ----------------------------------------------------------------------------
 *  VALVULAS DE SEGURANCA (Fase 8). Bocal e servico [OFICIAL]: Datasheet,
 *  R-01 N5 "Alivio de pressao — PSV-01" e V-01 N4 "Alivio de pressao —
 *  PSV-02". O resto [ESTIMADO]: ajuste na pressao de projeto (ASME VIII,
 *  UG-134 — nao acima da PMTA, 17,5 bar nas duas folhas), corpo API 526 pelo
 *  DN de entrada, saida no DN seguinte da tabela. O cenario de alivio (fogo
 *  externo, saida bloqueada, reacao fora de controle no R-01) nao foi
 *  calculado: pendencia N.
 * ------------------------------------------------------------------------- */
export const PSVS = [
  { tag: 'PSV-01', bocal: 'R-01.N5', vaso: 'R-01', dnSaida: 150, ajuste: 17.5, corpo: 'API 526 4P6' },
  { tag: 'PSV-02', bocal: 'V-01.N4', vaso: 'V-01', dnSaida: 80, ajuste: 17.5, corpo: 'API 526 2J3' },
];

/* Descarga para a atmosfera [ADOTADO]: a mesma regra do vent (arranjo.js,
 * VENT — 3 m acima de qualquer plataforma num raio de 15 m) e, no minimo,
 * 2 m acima da propria valvula. Tubo de descarga alto vai guiado a cada 3 m
 * num tubo vizinho que ja tem apoio (o vent estaiado, no V-01). */
export const ALIVIO = { acimaDaValvula: 2.0, guia: 3.0, alcanceGuia: 1.5 };
