import { PESSOAS } from './agua.js';

/**
 * ============================================================================
 *  INTERIORES DOS PREDIOS  (Fase 16 do ROTEIRO, pedido do autor)
 * ============================================================================
 *
 *  O programa de cada predio: as salas de cada pavimento e o uso de cada
 *  uma. As salas se dividem ao longo do eixo maior do predio, cada uma com a
 *  sua fracao do comprimento; a divisoria tem porta no meio. O uso diz que
 *  moveis entram, e eles entram por regra (site/interiores.js) — encostados
 *  na parede, em grade ou no meio —, nunca por coordenada: mudar o predio
 *  muda o arranjo. Medidas dos moveis em lib/moveis.js.
 *
 *  Tudo [ADOTADO]: nada disto esta nos documentos do grupo. Folgas pela NBR
 *  9050 (0,9 m de passagem, 1,2 m livres diante de porta) e pela pratica de
 *  armazem (corredor de empilhadeira de 3 m).
 * ============================================================================
 */

export const DIVISORIA = { espessura: 0.12, porta: 0.9, alturaPorta: 2.1 };
export const FOLGA = {
  porta: 1.2,         // livre diante de cada porta, dos dois lados
  passagem: 0.9,      // entre moveis e ate a parede, onde se anda
  empilhadeira: 3.0,  // corredor do porta-palete
  expedicao: 5.0,     // faixa livre de porta-palete diante das docas
  // baia livre do portao de garagem: bau de 10 m + 2 m + empilhadeira de
  // 3,2 m e o recuo dela (Fase 21: com 14 m ela encostava no porta-palete)
  caminhao: 18,
};
export const LUMINARIA = { passo: 2.4, galpao: 6 };
/* Sala cuja janela e de vidro fosco (Fase 18): de fora nao se ve quem troca
 * de roupa nem quem esta sendo atendido. [ADOTADO] */
export const VIDRO_FOSCO_EM = ['vestiario', 'ambulatorio'];

/* Refeitorio: um turno inteiro sentado de uma vez [ADOTADO, metade das
 * PESSOAS do dia — o administrativo e a operacao almocam em dois turnos].
 * Escritorio do ADM: 20 postos (`postos` de cada sala) dos ~25 do horario
 * administrativo (agua.js) — laboratorio e manutencao tem os seus. */
export const LUGARES_REFEITORIO = Math.ceil(PESSOAS / 2);

/* Programa por bloco: um vetor por pavimento, cada um com as salas em
 * ordem ao longo do eixo maior (do lado menor de x ou z para o maior). */
export const INTERIORES = {
  CONTROLE: [[
    { nome: 'Sala de controle', fracao: 0.7, uso: 'controle' },
    { nome: 'Supervisão', fracao: 0.3, uso: 'reuniao' },
  ]],
  LAB: [[
    { nome: 'Laboratório de controle de qualidade', fracao: 0.72, uso: 'laboratorio' },
    { nome: 'Reagentes', fracao: 0.28, uso: 'reagentes' },
  ]],
  OFICINA: [[
    { nome: 'Oficina de manutenção', fracao: 0.62, uso: 'oficina' },
    { nome: 'Almoxarifado', fracao: 0.38, uso: 'almoxarifado' },
  ]],
  ARMAZEM: [[
    { nome: 'Armazém de produto acabado', fracao: 1, uso: 'armazem' },
  ]],
  BRIGADA: [[
    { nome: 'Ambulatório', fracao: 0.5, uso: 'ambulatorio' },
    { nome: 'Brigada de emergência', fracao: 0.5, uso: 'brigada' },
  ]],
  // a recepcao no meio, onde fica a porta; a escada no arquivo, numa ponta
  ADM: [
    [
      { nome: 'Arquivo e escada', fracao: 0.33, uso: 'arquivo' },
      { nome: 'Recepção', fracao: 0.3, uso: 'recepcao' },
      { nome: 'Escritório', fracao: 0.37, uso: 'escritorio', postos: 8 },
    ],
    [
      { nome: 'Escritório', fracao: 0.62, uso: 'escritorio', postos: 12 },
      { nome: 'Sala de reunião', fracao: 0.38, uso: 'reuniao' },
    ],
  ],
  REFEITORIO: [[
    { nome: 'Refeitório', fracao: 0.6, uso: 'refeitorio' },
    { nome: 'Vestiário', fracao: 0.4, uso: 'vestiario' },
  ]],
  'BOMBAS-INC': [[
    { nome: 'Casa de bombas de incêndio', fracao: 1, uso: 'bombas-incendio' },
  ]],
  SUBESTACAO: [[
    { nome: 'Cubículos de média tensão', fracao: 1, uso: 'cubiculos' },
  ]],
  ETA: [[
    { nome: 'Casa de química e bombas', fracao: 1, uso: 'quimica-eta' },
  ]],
  ETE: [[
    { nome: 'Sopradores e dosagem', fracao: 1, uso: 'quimica-ete' },
  ]],
};

/* Oficina com ponte rolante de 5 t [ADOTADO: tira motor de bomba e
 * redutor de agitador], trilho 1,2 m abaixo do telhado. */
export const PONTE_ROLANTE = { bloco: 'OFICINA', capacidade: '5 t', abaixoDoTeto: 1.2 };

/* Bombas de incendio [ADOTADO, NFPA 20]: principal eletrica, reserva a
 * diesel e a jockey que mantem a rede pressurizada. */
export const BOMBAS_INCENDIO = [
  { nome: 'Bomba principal (elétrica)', potencia: 75, rotor: 0.22, dn: [200, 150], diesel: false },
  { nome: 'Bomba reserva (diesel)', potencia: 75, rotor: 0.22, dn: [200, 150], diesel: true },
  { nome: 'Bomba jockey', potencia: 4, rotor: 0.1, dn: [50, 40], diesel: false },
];
