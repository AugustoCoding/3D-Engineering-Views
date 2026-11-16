import { BLOCOS, LOTE, PORTOES, ONIBUS, PRACA_PORTARIA } from './site.js';
import { RECUO_PADRAO } from './entorno.js';
import { INTERIORES } from './interiores.js';

/**
 * ============================================================================
 *  PONTOS DE VISTA PRONTOS  (Fase 10; revistos na Fase 17)
 * ============================================================================
 *  Teclas 1 a 9, os botoes da Exibicao e LB/RB no controle. A camera voa ate
 *  o ponto (core/controls.js, voarPara; o voo nao colide). Posicoes derivadas
 *  dos blocos de site.js e do programa dos interiores: se o terreno mudar, a
 *  vista acompanha. [ADOTADO]
 *
 *    pos / alvo   de onde se olha e para onde
 *    processo     enquadra os equipamentos (como o enquadramento inicial)
 *    planta       liga a vista de planta (tecla P)
 *
 *  Vista nova nao pode ter `pos` dentro de parede: a camera colide desde a
 *  Fase 16 (sai livre, mas o enquadramento fica errado).
 * ============================================================================
 */

const bloco = (id) => BLOCOS.find((b) => b.id === id);
const centro = (b) => [(b.x[0] + b.x[1]) / 2, (b.z[0] + b.z[1]) / 2];
const [lx, lz] = [(LOTE.x[0] + LOTE.x[1]) / 2, (LOTE.z[0] + LOTE.z[1]) / 2];
const portaria = PORTOES.find((p) => p.id === 'principal');
const [tx, tz] = centro(bloco('TANQUES'));
const [ix, iz] = centro(bloco('ISBL'));
const [ax, az] = centro(bloco('ETA'));
const [ex, ez] = centro(bloco('ETE'));
const [px, pz] = ONIBUS.parada;
const ilha = PRACA_PORTARIA.ilha;

/* Sala de controle por dentro: atras das cadeiras dos operadores, olhando o
 * videowall na parede cega — a que da para o processo (site/interiores.js).
 * A sala de controle e a primeira do programa, ao longo do eixo maior. */
const salaDeControle = (() => {
  const b = bloco('CONTROLE');
  const r = { x0: b.x[0] + RECUO_PADRAO, x1: b.x[1] - RECUO_PADRAO, z0: b.z[0] + RECUO_PADRAO, z1: b.z[1] - RECUO_PADRAO };
  const f = INTERIORES.CONTROLE[0][0].fracao;
  const s = r.x1 - r.x0 >= r.z1 - r.z0 ? { ...r, x1: r.x0 + f * (r.x1 - r.x0) } : { ...r, z1: r.z0 + f * (r.z1 - r.z0) };
  const [cx, cz] = [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2];
  const [dx, dz] = [ix - cx, iz - cz];
  const y = 2.0;                                   // um pouco acima dos monitores
  if (Math.abs(dx) > Math.abs(dz)) {
    const [parede, fundo] = dx > 0 ? [s.x1, s.x0 + 1.2] : [s.x0, s.x1 - 1.2];
    return { pos: [fundo, y, cz], alvo: [parede, 1.5, cz] };
  }
  const [parede, fundo] = dz > 0 ? [s.z1, s.z0 + 1.2] : [s.z0, s.z1 - 1.2];
  return { pos: [cx, y, fundo], alvo: [cx, 1.5, parede] };
})();

export const VISTAS = [
  // do alto, a sudeste: a planta inteira em perspectiva, com o vento de SE as costas
  { id: 'geral', nome: 'Visão geral', tecla: '1', pos: [lx + 120, 120, lz + 175], alvo: [lx, 0, lz - 10] },
  // de fora, por cima da via publica: a praca com a cobertura, a guarita na
  // ilha, as duas cancelas e, atras, o caminho ate a planta
  { id: 'portaria', nome: 'Portaria', tecla: '2', pos: [portaria.x + 16, 9, portaria.z + 26], alvo: [(ilha.x[0] + ilha.x[1]) / 2, 1.5, portaria.z - 6] },
  { id: 'processo', nome: 'Área de processo', tecla: '3', processo: true },
  // de sudeste, por cima do anel, vendo os tres tanques e a bacia
  { id: 'tanques', nome: 'Parque de tanques', tecla: '4', pos: [tx + 32, 22, tz + 38], alvo: [tx, 3, tz] },
  { id: 'planta', nome: 'Planta baixa', tecla: '5', planta: true },
  // de fora da cerca, ao sul: o retorno, o abrigo e o caminho ate o
  // vestiario, com o estacionamento a esquerda
  { id: 'onibus', nome: 'Ônibus e estacionamento', tecla: '6', pos: [px + 22, 26, pz + 38], alvo: [px - 20, 0, pz - 6] },
  // de leste, por cima da via principal: castelo, reservatorio, filtros e a torre atras
  { id: 'eta', nome: 'Tratamento de água', tecla: '7', pos: [ax + 26, 20, az + 24], alvo: [ax - 4, 4, az] },
  { id: 'ete', nome: 'Tratamento de efluentes', tecla: '8', pos: [ex + 20, 18, ez + 22], alvo: [ex, 0, ez] },
  { id: 'controle', nome: 'Sala de controle (dentro)', tecla: '9', ...salaDeControle },
];
