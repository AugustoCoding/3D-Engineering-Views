import { BLOCOS, VIAS, TANQUES } from './site.js';
import { CONTENCAO } from './arranjo.js';
import { BACIA } from './entorno.js';

/**
 * ============================================================================
 *  SEGURANCA
 * ============================================================================
 *
 *  Duas coisas diferentes:
 *    - equipamento de combate e de emergencia (hidrante, canhao monitor,
 *      chuveiro lava-olhos, extintor, biruta): existe de verdade, fica sempre
 *      a vista;
 *    - a camada "Seguranca" do HUD: zonas classificadas, distancias de
 *      separacao no chao e rotas de fuga. Desenho de projeto, ilustrativo.
 *
 *  Nada esta nos documentos do grupo. Cada regra e [ADOTADO] com a norma de
 *  onde veio a ordem de grandeza — a CONFIRMAR com a bibliografia da
 *  disciplina, com a NR-20 e com as instrucoes tecnicas do CBPMESP.
 *
 *  A posicao do equipamento SAI DA REGRA: a composicao (site/seguranca.js)
 *  escolhe o menor numero de pontos livres que cobre todo alvo, e a
 *  auditoria (__auditarSeguranca) mede a cobertura de volta.
 * ============================================================================
 */

const bloco = (id) => BLOCOS.find((b) => b.id === id);
const via = (id) => VIAS.find((v) => v.id === id);
const caixaVia = (v) => {
  const xs = v.pontos.map((p) => p[0]), zs = v.pontos.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), m: v.largura / 2 };
};

/* ----------------------------------------------------------------------------
 *  ZONAS CLASSIFICADAS (ilustrativas) — tolueno, classe IB, vapor 3,1 vezes
 *  mais denso que o ar: o que escapa desce e se espalha rente ao chao.
 *  Ordens de grandeza das figuras tipicas da API RP 505 / NFPA 497.
 * ------------------------------------------------------------------------- */
export const ZONAS = {
  // respiro atmosferico (tanque, vent, exaustao de bomba de vacuo)
  respiro: { zona1: 1.5, zona2: 3.0, fonte: 'API RP 505, respiro de tanque: Zona 1 a 1,5 m, Zona 2 a 3 m' },
  // dentro do dique, ate o topo da mureta
  bacia: { altura: BACIA.altura, fonte: 'API RP 505, tanque em dique: Zona 2 dentro do dique até o topo da mureta' },
  // carga e descarga de caminhao-tanque
  descarga: {
    zona1: 1.0, zona2: 4.5, camada: 0.45, alcanceCamada: 7.5,
    fonte: 'NFPA 497, carga de caminhão-tanque: Zona 1 a 1 m da conexão, Zona 2 a 4,5 m e camada de 0,45 m até 7,5 m',
  },
  // area de processo aberta, bem ventilada, com bombas, flanges e valvulas
  processo: {
    alcance: 7.5, altura: 7.5, camada: 0.6, alcanceCamada: 15,
    fonte: 'API RP 505, fonte em área aberta ventilada: Zona 2 a 7,5 m e até 7,5 m de altura; camada de 0,6 m até 15 m (vapor mais denso que o ar)',
  },
};

/* Fontes de ignicao que nao podem ficar em zona: chama e equipamento
 * eletrico comum. Categoria de bloco de site.js. */
export const IGNICAO = ['utilidade'];

/* ----------------------------------------------------------------------------
 *  COMBATE A INCENDIO E EMERGENCIA — regras de cobertura [ADOTADO]
 * ------------------------------------------------------------------------- */
export const COBERTURA = {
  // Hidrante: mangueira de 30 m (2 lances de 15 m) e 10 m de jato. Todo
  // equipamento ao alcance de DOIS hidrantes: um pode estar no fogo.
  hidrante: { alcance: 40, minimo: 2, passo: 35, afastamento: 1.5,
    fonte: 'IT 22 do CBPMESP (mangueira de 30 m) e NFPA 24; dois hidrantes por alvo' },
  // Canhao monitor de 1 900 L/min: jato util de ~45 m. Cada tanque ao
  // alcance de um; os dois juntos sao a reserva de agua do TQ-AI.
  monitor: { alcance: 45, minimo: 1, fonte: 'NFPA 15 / prática de parque de tanques; 2 × 1 900 L/min (TQ-AI)' },
  // Chuveiro com lava-olhos: a 10 s de caminhada (~17 m), no mesmo nivel.
  lavaOlhos: { alcance: 16.8, fonte: 'ANSI/ISEA Z358.1: alcançável em 10 s (≈ 17 m)' },
  // Extintor de classe B: ate 15 m de percurso em risco alto.
  extintor: { alcance: 15, fonte: 'NFPA 10, classe B, risco alto: percurso ≤ 15 m' },
  // Folga em volta da peca de emergencia: acesso livre.
  folga: 0.6,
};

/* Alvos de cada regra. 'bombas' sao as do P&ID e as de fora (Fase 7). */
export const ALVOS = {
  hidrante: ['processo', 'tanques', 'carga'],
  monitor: ['tanques'],
  lavaOlhos: ['bombas', 'filtros', 'carga'],
  extintor: ['processo', 'bombas-fora', 'carga', 'caldeira'],
};

/* Hidrantes no acostamento de fora dos aneis viarios: longe o bastante da
 * fonte para serem usaveis durante o fogo (> 12 m da laje, NFPA 24). */
export const ANEIS_HIDRANTE = ['anel-processo', 'anel-tanques'];

/* Canhoes monitores nos dois cantos do anel dos tanques do lado da via
 * norte, a barlavento do parque (vento de SE). */
const anelTq = caixaVia(via('anel-tanques'));
export const MONITORES = [
  { x: anelTq.x1 + anelTq.m + 2.5, z: anelTq.z1 + anelTq.m + 2.5 },
  { x: anelTq.x0 - anelTq.m - 2.5, z: anelTq.z1 + anelTq.m + 2.5 },
];

/* Birutas [ADOTADO]: visiveis da laje, do parque de tanques, da baia e do
 * ponto de encontro — quem foge le o vento antes de escolher o caminho. */
const tanques = bloco('TANQUES');
const encontro = bloco('ENCONTRO-1');
const descarga = bloco('DESCARGA');
export const BIRUTAS = [
  { onde: 'rack', altura: 3.5 },
  { onde: 'ponto', x: tanques.x[1] + 3, z: tanques.z[1] + 3, altura: 8 },
  { onde: 'ponto', x: descarga.x[0] - 2, z: descarga.z[1] + 2, altura: 7 },
  { onde: 'ponto', x: encontro.x[0] + 2, z: encontro.z[0] + 2, altura: 6 },
];

/* ----------------------------------------------------------------------------
 *  ROTAS DE FUGA — pelas vias e calcadas, ate os pontos de encontro. Saem
 *  pelas rampas da mureta (a laje) e pelas escadas da bacia (os tanques).
 *  [ADOTADO] Encontro 1 e o principal: a barlavento do vento de SE.
 * ------------------------------------------------------------------------- */
const isbl = bloco('ISBL');
const rampa = (lado) => CONTENCAO.rampas.find((r) => r.lado === lado);
const anel = caixaVia(via('anel-processo'));
const principal = caixaVia(via('principal'));
const apoio = caixaVia(via('apoio'));
const enc1 = bloco('ENCONTRO-1');
const enc2 = bloco('ENCONTRO-2');
const c1 = [(enc1.x[0] + enc1.x[1]) / 2, (enc1.z[0] + enc1.z[1]) / 2];
const c2 = [(enc2.x[0] + enc2.x[1]) / 2, (enc2.z[0] + enc2.z[1]) / 2];
const zCalcadaSul = 97;                          // calcada do apoio (site.js)
const rb = { x0: tanques.x[0] + BACIA.recuo, x1: tanques.x[1] - BACIA.recuo };
const zMeioTq = (tanques.z[0] + tanques.z[1]) / 2;
const anelTqV = caixaVia(via('anel-tanques'));
const servDesc = caixaVia(via('servico-descarga'));
const norte = caixaVia(via('norte'));

export const ROTAS_FUGA = [
  { id: 'F1', de: 'ISBL', para: 'ENCONTRO-1', nome: 'Rota principal — a barlavento (vento de SE)',
    pontos: [[isbl.x[1], rampa('leste').centro], [principal.x0, rampa('leste').centro], [principal.x0, zCalcadaSul],
      [c1[0], zCalcadaSul], c1] },
  { id: 'F2', de: 'ISBL', para: 'ENCONTRO-2', nome: 'Rota alternativa — vento de S (maio a julho)',
    pontos: [[isbl.x[0], rampa('oeste').centro], [anel.x0, rampa('oeste').centro], [anel.x0, apoio.z0],
      [apoio.x0, apoio.z0], [apoio.x0, c2[1]], c2] },
  { id: 'F3', de: 'TANQUES', para: 'ENCONTRO-2', nome: 'Rota do parque de tanques',
    pontos: [[rb.x0, zMeioTq], [anelTqV.x0, zMeioTq], [anelTqV.x0, c2[1]], c2] },
  { id: 'F4', de: 'DESCARGA', para: 'ENCONTRO-1', nome: 'Rota da baia de descarga',
    pontos: [[servDesc.x0, descarga.z[1]], [servDesc.x0, norte.z0], [principal.x0, norte.z0],
      [principal.x0, zCalcadaSul], [c1[0], zCalcadaSul], c1] },
];

export { TANQUES };
