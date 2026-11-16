/**
 * ===========================================================================
 *  ILUMINACAO FORA DA LAJE  (Fase 26, bloco 1: via, calcada, estacionamento)
 * ===========================================================================
 *  Alvos, luminarias e regras de colocacao. A conta e de lib/fotometria.js;
 *  a colocacao, de site/ambiente.js (secao 3); a medida, de
 *  dev/iluminacao.js (__auditarIluminacao). A laje e da sessao local
 *  (`LUZ_LAJE`, data/arranjo.js).
 *
 *  O espacamento sai do alvo, nao de regra fixa (ROTEIRO, Fase 26): para
 *  cada tipo de lugar, o maior passo que fecha Em e Uo numa faixa reta
 *  (`passoPorAlvo`); a auditoria mede o que ficou de verdade — curva,
 *  esquina, poste que desviou de obstaculo.
 */

import { VIAS, BLOCOS, CALCADAS, LARGURA_CALCADA, PRACA_PORTARIA, LOTE, PORTOES } from './site.js';
import { PORTAS, LARGURA_ACESSO, CERCA } from './entorno.js';
import { ROTAS_FUGA } from './seguranca.js';
import { pontosDaFaixa, passoDeArea } from '../lib/fotometria.js';
import { Y } from '../lib/terreno.js';

/* Alvos [VERIFICAR — de memoria ate abrir a norma; ROTEIRO, Fase 26]:
 * dentro da cerca a planta e local de trabalho externo, EN 12464-2; a NBR
 * 5101 so nas faixas de aceleracao e desaceleracao da via publica. Em e a
 * iluminancia horizontal media mantida (ja com o Fm de lib/fotometria.js);
 * Uo = Emin / Em. */
export const ALVOS = {
  // 15 km/h (data/ambiente.js) passa dos 10 km/h do trafego "lento" da EN:
  // cai no trafego regular (ate 40 km/h), 20 lx — o alto da faixa 10–20 do ROTEIRO
  via: { Em: 20, Uo: 0.40, fonte: 'EN 12464-2, trafego regular de veiculos ate 40 km/h' },
  calcada: { Em: 5, Uo: 0.25, fonte: 'EN 12464-2, caminho so de pedestre' },
  estacionamento: { Em: 10, Uo: 0.25, fonte: 'EN 12464-2, estacionamento de trafego medio' },
  publica: { Em: 10, Uo: 0.20, fonte: 'NBR 5101, via de classe V4' },
  // patios (Fase 26, bloco 2): carga e descarga, parque de tanques e a
  // praca da portaria — luminaria Ex onde ha tolueno (zona do seguranca.js)
  carga: { Em: 50, Uo: 0.40, fonte: 'EN 12464-2, ponto de carga e descarga' },
  tanques: { Em: 50, Uo: 0.40, fonte: 'EN 12464-2, industria petroquimica: carga e descarga de tanque' },
  portaria: { Em: 50, Uo: 0.40, fonte: 'EN 12464-2, portaria e ponto de giro de veiculo' },
  // bloco 3: o acesso de cada porta (como calcada) e a faixa de 3 m por
  // dentro da cerca — iluminacao de seguranca, que a EN 12464-2 nao cobre
  // [ADOTADO, ordem de grandeza de iluminacao perimetral]
  porta: { Em: 5, Uo: 0.25, fonte: 'EN 12464-2, caminho so de pedestre (acesso da porta)' },
  // pelo minimo junto da cerca, nao por Uo: na faixa de 254 m a luz da via
  // e da portaria sobe o Em sem subir o minimo (Uo 0,13 com a cerca acesa)
  perimetro: { Em: 5, Emin: 2, fonte: 'iluminacao de seguranca da cerca: minimo junto dela [ADOTADO]' },
  // rota de fuga so com as luminarias de emergencia, no fluxo de emergencia
  // [VERIFICAR — NBR 10898: 3 lx no plano da rota, 5 lx em escada e degrau]
  emergencia: { Em: 3, Emin: 3, fonte: 'NBR 10898, iluminacao de emergencia na rota de fuga' },
  // a laje e da sessao local (LUZ_LAJE, data/arranjo.js); o alvo e o mesmo
  // do ROTEIRO e a medida e daqui
  laje: { Em: 20, Uo: 0.25, fonte: 'EN 12464-2, industria petroquimica: circulacao e operacao de valvula' },
  bombas: { Em: 50, Uo: 0.40, fonte: 'EN 12464-2, industria petroquimica: leitura de instrumento e inspecao de vazamento' },
};

/* Luminarias [ESTIMADO, ordem de grandeza de catalogo de LED a ~120 lm/W]:
 * `fluxo` sai da luminaria (rendimento incluso); `facho`, angulo total a
 * 50 % da intensidade maxima; `perfil`, a distribuicao de
 * lib/fotometria.js ('larga': otica viaria e de area). `inclinacao`: o eixo
 * sai do nadir para dentro da area, em graus.
 *  - via: 9 m com braco de 1,5 m sobre a via (o poste de sempre), 150 W;
 *  - pedestre: poste de 4,5 m com luminaria no topo, 25 W;
 *  - estacionamento: poste de 10 m com duas cabecas abertas uma para cada
 *    lado ao longo da fileira, 2 × 100 W. */
export const LUMINARIAS = {
  via: { altura: 9, braco: 1.5, fluxo: 18000, facho: 140, perfil: 'larga', inclinacao: 10 },
  pedestre: { altura: 4.5, fluxo: 3000, facho: 140, perfil: 'larga', inclinacao: 0 },
  estacionamento: { altura: 10, braco: 0.6, fluxo: 12000, facho: 130, perfil: 'larga', inclinacao: 25, abertura: 35 },
  // patio: mastro de 12 m com dois projetores de 200 W (24 klm, facho de
  // 90°) voltados para dentro da area; o mesmo desenho do de estacionamento
  patio: { altura: 12, braco: 0.6, fluxo: 24000, facho: 90, perfil: 'cos', inclinacao: 35, abertura: 40 },
  // fachada: projetor de parede de 200 W para o patio colado no predio
  // (o de expedicao: entre o armazem e a cerca nao cabe mastro)
  // a 35° do nadir: a 50, o pe da parede era o canto escuro (Uo 0,20)
  fachada: { altura: 7, fluxo: 24000, facho: 90, perfil: 'cos', inclinacao: 35 },
  // arandela: sobre cada porta, a 2,8 m, 15 W voltada para fora e para baixo
  arandela: { altura: 2.8, fluxo: 1500, facho: 100, perfil: 'cos', inclinacao: 30 },
  // pipeway: luminaria de 100 W presa por bracadeira na coluna do pipeway
  // (W 200), `folga` m abaixo do nivel mais baixo, braco para a via — onde
  // o poste nao pode ficar (sob o pipeway)
  pipeway: { folga: 0.6, braco: 0.7, fluxo: 12000, facho: 140, perfil: 'larga', inclinacao: 10, coluna: 0.2 },
  // perimetro: poste de 6 m com luminaria de area por dentro da cerca, 40 W
  perimetro: { altura: 6, braco: 0.8, fluxo: 4500, facho: 140, perfil: 'larga', inclinacao: 0 },
  // teto: luminaria de embutir no forro da cobertura da portaria, 20 W —
  // pequena e em grade densa: a de 6 klm dava 156 lx contra 50 de alvo
  teto: { fluxo: 2500, facho: 110, perfil: 'cos', lado: 0.6 },
};

/* Colocacao [ADOTADO]:
 *  - via: um lado; os dois, alternados, na via principal (ROTEIRO: a
 *    principal da portaria). Pe a >= 0,5 m da face do meio-fio
 *    (`recuos[0]`: centro a 1 m da borda da pista, base de 0,7 m); onde
 *    ha calcada encostada, atras dela (`recuos[1]`: 0,15 de meio-fio, 2 de
 *    calcada e 0,45 de folga). Nunca na via, na calcada, sob pipeway nem
 *    sobre equipamento de emergencia (o `livre` de site/ambiente.js).
 *    `desvioMax`: quanto o poste anda ao longo da via para achar lugar
 *    (ate meio passo).
 *  - calcada: so os caminhos fora de via (`caminho: true` em
 *    CALCADAS, data/site.js); a calcada encostada na via fica com a luz da via, e
 *    a auditoria confere. Poste a 0,85 m da borda do caminho.
 *  - estacionamento: postes nas duas faixas fora das fileiras de vagas,
 *    frente a frente, cabecas voltadas para o corredor; quantos, o menor
 *    numero que fecha o alvo na area (o mesmo nos patios).
 *  `passos`: de quanto em quanto o passo e tentado, do maior para o menor,
 *  em alturas de montagem (EN 13201: a ordem de 3 a 5 alturas para via). */
export const REGRAS = {
  via: {
    vias: ['principal', 'apoio', 'norte', 'servico-tolueno', 'servico-expedicao', 'servico-descarga',
      'anel-processo', 'anel-tanques', 'lig-leste', 'lig-norte', 'lig-ete', 'onibus', 'estacionamento',
      'entrada', 'saida', 'retorno-onibus'],
    doisLados: ['principal'],
    // o terceiro, atras do pipeway, so quando os dois primeiros nao cabem
    // (lig-ete: o pipeway ocupa o acostamento); o passo sai do segundo
    recuos: [1.0, 2.6, 5.0], desvioMax: 10, passos: [5, 2],
  },
  publica: { vias: ['publica', 'publica-leste', 'desaceleracao', 'aceleracao'], medir: ['desaceleracao', 'aceleracao'] },
  calcada: { afastamento: 0.85, desvioMax: 4, passos: [8, 3] },
  estacionamento: { blocos: ['ESTAC'], margem: 1.5, desvioMax: 4 },
  // postes a mais por area no adensamento (mede e adensa); sem lugar para
  // poste perto do ponto escuro, a coluna de pipeway mais perto, ate
  // `pipewayAlcance` m dele
  adensarMax: 4, pipewayAlcance: 8,
  // patios: mastros nas duas bordas do lado maior, a `fora` m para fora do
  // retangulo (o caminhao e o tanque ficam dentro), projetores para dentro;
  // Ex onde ha tolueno. `bloco` de site.js ou `via` com patio: true.
  patios: [
    // a 2,5 m da borda: a 1,5 o pe do mastro, onde os projetores nao
    // apontam, era o canto mais escuro (Uo 0,37 na descarga)
    { id: 'DESCARGA', bloco: 'DESCARGA', alvo: 'carga', fora: 2.5, ex: true },
    // tanques a 1,5: a 2,5 a fila sul caia na volta do dique (Fase 28)
    { id: 'TANQUES', bloco: 'TANQUES', alvo: 'tanques', fora: 1.5, ex: true },
    // sem lugar para mastro (armazem de um lado, cerca do outro): projetor
    // na fachada do armazem voltada para o patio
    { id: 'patio-expedicao', via: 'patio-expedicao', alvo: 'carga', fachada: 'ARMAZEM', ex: false },
  ],
  patio: { desvioMax: 4 },
  // perimetro: postes a `recuo` m por dentro da cerca; mede-se a faixa de
  // `faixa` m junto dela. Portao: o poste nao fica no vao.
  perimetro: { recuo: 1.0, faixa: 3, desvioMax: 6, passos: [6, 2] },
  // emergencia: parte das luminarias ja postas vai para o circuito de
  // emergencia — as do menor conjunto que fecha a rota (escolha gulosa) —
  // com `fracao` do fluxo. 1,0: circuito alimentado por gerador [ADOTADO,
  // pratica de planta de processo]; com kit de bateria de LED (15–25 %) o
  // poste de pedestre nao passa de ~2 lx nem embaixo dele. O gerador (ou
  // central de baterias) nao esta nos documentos: pendencia da equipe.
  // Trecho de rota sem luz perto ganha poste de pedestre no circuito
  // (adensa). Rota medida a cada `passo` m.
  emergencia: { fracao: 1.0, passo: 1 },
  // cobertura da portaria: grade de luminarias de embutir, a menor que
  // fecha o alvo na praca debaixo dela
  coberturas: [{ id: 'portaria', alvo: 'portaria' }],
};

/**
 * Os quatro lados da cerca (o LOTE), cada um como polilinha recuada meia
 * faixa para dentro, com o lado de dentro (+1/-1 em relacao a direita de
 * quem anda nela) — o poste do perimetro fica so do lado de dentro.
 */
export function ladosDaCerca() {
  const [x0, x1] = LOTE.x, [z0, z1] = LOTE.z, m = REGRAS.perimetro.faixa / 2;
  // sentido horario visto de cima (+z para baixo): a direita aponta para dentro
  return [
    { id: 'cerca-norte', pontos: [[x0, z0 + m], [x1, z0 + m]], dentro: 1 },
    { id: 'cerca-leste', pontos: [[x1 - m, z0], [x1 - m, z1]], dentro: 1 },
    { id: 'cerca-sul', pontos: [[x1, z1 - m], [x0, z1 - m]], dentro: 1 },
    { id: 'cerca-oeste', pontos: [[x0 + m, z1], [x0 + m, z0]], dentro: 1 },
  ];
}

/** Luminarias de emergencia no fluxo de emergencia (a conta da rota de fuga). */
export const emEmergencia = (lista) => lista.filter((l) => l.emergencia)
  .map((l) => ({ ...l, fluxo: l.fluxoEmergencia ?? l.fluxo * REGRAS.emergencia.fracao }));

/** Retangulo { x0, x1, z0, z1 } de um patio da regra: bloco ou via-patio. */
export function retanguloDoPatio(pt) {
  if (pt.bloco) {
    const b = BLOCOS.find((q) => q.id === pt.bloco);
    return { x0: b.x[0], x1: b.x[1], z0: b.z[0], z1: b.z[1] };
  }
  const v = VIAS.find((q) => q.id === pt.via);
  const [[ax, az], [bx, bz]] = v.pontos, m = v.largura / 2;
  return ax === bx ? { x0: ax - m, x1: ax + m, z0: Math.min(az, bz), z1: Math.max(az, bz) }
    : { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: az - m, z1: az + m };
}

/* ---------------------------------------------------------------------------
 *  Areas de calculo — as mesmas para quem adensa (site/ambiente.js) e para
 *  quem mede (dev/iluminacao.js): cada via interna e as faixas da via
 *  publica (EN 13201-3: a cada 2 m ao longo, 3 pontos por faixa de
 *  rolamento), cada calcada (2 pontos atravessados) e o estacionamento
 *  (grade de area da EN 12464). `linha`: a polilinha de onde sai poste a
 *  mais; `poste`: o tipo que adensa. A laje e as bombas ficam na auditoria
 *  (as luminarias delas sao da sessao local).
 * ------------------------------------------------------------------------- */
export function areasDeLuz() {
  const faixa = (pontos, largura, y, nTrans) => pontosDaFaixa(pontos, largura, { passo: 2, nTrans }).map(([x, z]) => [x, y, z]);
  const areas = [];
  for (const id of REGRAS.via.vias) {
    const v = VIAS.find((q) => q.id === id);
    if (v) areas.push({ tipo: 'via', id, alvo: ALVOS.via, pts: faixa(v.pontos, v.largura, Y.via), linha: { pontos: v.pontos, largura: v.largura }, poste: 'via' });
  }
  for (const id of REGRAS.publica.medir) {
    const v = VIAS.find((q) => q.id === id);
    if (v) areas.push({ tipo: 'publica', id, alvo: ALVOS.publica, pts: faixa(v.pontos, v.largura, Y.via), linha: { pontos: v.pontos, largura: v.largura }, poste: 'via' });
  }
  // calcada: so o trecho dentro da cerca — fora, e a calcada publica (da
  // cidade, NBR 5101); da via publica se medem so as faixas
  const noLote = ([x, , z]) => x >= LOTE.x[0] && x <= LOTE.x[1] && z >= LOTE.z[0] && z <= LOTE.z[1];
  for (const c of CALCADAS) {
    areas.push({ tipo: 'calcada', id: c.id, alvo: ALVOS.calcada, pts: faixa(c.pontos, LARGURA_CALCADA, Y.calcada, 2).filter(noLote),
      linha: { pontos: c.pontos, largura: LARGURA_CALCADA }, poste: 'pedestre' });
  }
  const grade = (r, y) => {
    const pa = passoDeArea(Math.max(r.x1 - r.x0, r.z1 - r.z0)), pts = [];
    for (let x = r.x0 + pa / 2; x < r.x1; x += pa) for (let z = r.z0 + pa / 2; z < r.z1; z += pa) pts.push([x, y, z]);
    return pts;
  };
  for (const id of REGRAS.estacionamento.blocos) {
    const b = BLOCOS.find((q) => q.id === id);
    if (b) areas.push({ tipo: 'estacionamento', id, alvo: ALVOS.estacionamento, pts: grade({ x0: b.x[0], x1: b.x[1], z0: b.z[0], z1: b.z[1] }, Y.bloco) });
  }
  for (const pt of REGRAS.patios) {
    const r = retanguloDoPatio(pt);
    areas.push({ tipo: pt.alvo, id: pt.id, alvo: ALVOS[pt.alvo], pts: grade(r, pt.via ? Y.via : Y.bloco), ret: r, fachada: pt.fachada });
  }
  for (const pt of PORTAS.filter((q) => q.acesso)) {
    areas.push({ tipo: 'porta', id: pt.bloco, alvo: ALVOS.porta, pts: faixa(pt.acesso, LARGURA_ACESSO, Y.calcada, 2) });
  }
  // perimetro: cada lado da cerca, a faixa de dentro (o poligono da cerca
  // recuado meia faixa), sem o vao dos portoes
  for (const lado of ladosDaCerca()) {
    areas.push({ tipo: 'perimetro', id: lado.id, alvo: ALVOS.perimetro, pts: faixa(lado.pontos, REGRAS.perimetro.faixa, Y.lote, 1)
      .filter(([x, , z]) => !PORTOES.some((g) => Math.hypot(x - g.x, z - g.z) < (g.largura ?? CERCA.larguraPortao) / 2 + 1)), linha: { pontos: lado.pontos, largura: REGRAS.perimetro.faixa }, poste: 'perimetro', dentro: lado.dentro });
  }
  // rotas de fuga (seguranca.js): so com as de emergencia
  for (const r of ROTAS_FUGA) {
    areas.push({ tipo: 'emergencia', id: r.id, alvo: ALVOS.emergencia, emergencia: true, linha: { pontos: r.pontos, largura: 1 }, poste: 'pedestre',
      pts: pontosDaFaixa(r.pontos, 0.5, { passo: REGRAS.emergencia.passo, nTrans: 1 }).map(([x, z]) => [x, Y.via, z]) });
  }
  // debaixo da cobertura so conta a luz de quem esta abaixo do forro: a
  // conta nao tem obstrucao, e o poste de 9 m "atravessava" o telhado
  const c = PRACA_PORTARIA.cobertura, forro = Y.via + c.alturaLivre;
  areas.push({ tipo: 'portaria', id: 'portaria', alvo: ALVOS.portaria, pts: grade({ x0: c.x[0], x1: c.x[1], z0: c.z[0], z1: c.z[1] }, Y.via),
    filtro: (l) => (Array.isArray(l.p) ? l.p[1] : l.p.y) < forro });
  return areas;
}
