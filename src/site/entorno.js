import * as THREE from 'three';
import { BLOCOS, VIAS, CALCADAS, LOTE, PORTOES, TANQUES, PRACA_PORTARIA, ONIBUS, LARGURA_CALCADA } from '../data/site.js';
import { criarGuarita, criarCoberturaPortaria, criarCancela, criarCatraca, criarAbrigo, pinturaChao, faixaPintada } from '../lib/portaria.js';
import {
  PREDIOS, RECUO_PADRAO, TANQUE_INCENDIO, BACIA, UTILIDADES_ENTORNO, CERCA, VAGA, PORTAS, ENTRADA_GARAGEM,
  eixoCaldeira, posicaoBracos, arranjoEta, arranjoEte,
} from '../data/entorno.js';
import { ETA, ETE } from '../data/agua.js';
import {
  criarCabecaPoco, criarVasoPressao, criarTanqueSalmoura, criarCastelo, criarSeparadorAguaOleo, criarDecantador,
  criarCaixaEnterrada,
} from '../lib/tratamento.js';
import { DRENAGEM, NIVEIS_ETE } from '../data/pipeways.js';
import { tuboPorCaminho } from '../lib/pipe.js';
import { criarCaixaInspecao } from '../lib/pipeway.js';
import { MAT } from '../core/materials.js';
import { ret, centro } from '../lib/plano.js';
import { criarPredio, GARAGEM } from '../lib/predio.js';
import { criarTanque } from '../lib/tanque.js';
import {
  criarTorreResfriamento, criarCaldeira, criarTransformador, criarBaciaAberta, criarBracoCarga, criarCobertura, criarCanaleta,
} from '../lib/utilidades.js';
import { mureta, vagas, cerca, Y } from '../lib/terreno.js';

/**
 * ===========================================================================
 *  ENTORNO — o que existe em cada bloco
 * ===========================================================================
 *  Composicao: le site.js (blocos, vias, tanques) e entorno.js (o volume de
 *  cada coisa) e combina as primitivas. Cada peca vai sobre o piso do bloco
 *  (Y.bloco) e dentro dele — dev/entorno.js mede as duas coisas.
 *
 *  O que nao se digita, mede-se: o lado da porta de cada predio e o que da
 *  para a calcada ou via mais proxima; as docas do armazem, o da via de
 *  servico; a sala de controle nao tem janela no lado que olha o processo.
 */

const f1 = (v) => v.toFixed(1).replace('.', ',');
const f2 = (v) => v.toFixed(2).replace('.', ',');

function distPontoPolilinha(x, z, pts) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const vx = bx - ax, vz = bz - az;
    const L2 = vx * vx + vz * vz;
    const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
    d = Math.min(d, Math.hypot(ax + t * vx - x, az + t * vz - z));
  }
  return d;
}

/** Pontos medios dos quatro lados de um retangulo. */
function lados(r) {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return { '+x': [r.x1, cz], '-x': [r.x0, cz], '+z': [cx, r.z1], '-z': [cx, r.z0] };
}

/** Lado do retangulo mais perto de alguma das polilinhas. */
function ladoMaisPerto(r, polilinhas) {
  let melhor = null;
  for (const [lado, [x, z]] of Object.entries(lados(r))) {
    const d = Math.min(...polilinhas.map((p) => distPontoPolilinha(x, z, p)));
    if (!melhor || d < melhor.d) melhor = { lado, d };
  }
  return melhor.lado;
}

/** Lado do retangulo que olha para o ponto (x, z). */
function ladoVoltadoPara(r, [x, z]) {
  const [cx, cz] = centro(r);
  const dx = x - cx, dz = z - cz;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? '+x' : '-x') : (dz > 0 ? '+z' : '-z');
}

const inset = (r, m) => ({ x0: r.x0 + m, x1: r.x1 - m, z0: r.z0 + m, z1: r.z1 - m });

export function criarEntorno() {
  const grupo = new THREE.Group();
  grupo.name = 'entorno';
  const objetos = [];                       // { nome, bloco, grupo }: para a auditoria
  const blocos = Object.fromEntries(BLOCOS.map((b) => [b.id, b]));

  // `piso`: a cota em que a peca se apoia, quando nao e a placa do bloco
  // (a catraca fica na calcada)
  function por(nome, bloco, obj, ficha, piso = Y.bloco) {
    obj.userData.ficha = ficha;
    obj.name = nome;
    grupo.add(obj);
    objetos.push({ nome, bloco, grupo: obj, piso });
  }

  /* ---------------------------------------------------------------- predios */
  const polCalcadasVias = [...CALCADAS.map((c) => c.pontos), ...VIAS.map((v) => v.pontos)];
  const isblCentro = centro(ret(blocos.ISBL));
  const retsPredios = PREDIOS.map((p) => (p.ret ? ret(p.ret) : inset(ret(blocos[p.bloco]), p.recuo ?? RECUO_PADRAO)));
  /* Letreiro no lado que olha para o centro da fabrica (pedido do autor,
   * Fase 15), quando essa fachada esta a vista: nenhum predio na faixa de
   * VISTA m em frente a ela (metade da largura da fachada). A porta continua
   * do lado da calcada; se for o mesmo lado, o letreiro fica sobre ela. */
  const VISTA = 8;
  const NORMAL = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
  function letreiroPara(r) {
    const lado = ladoVoltadoPara(r, isblCentro);
    const [mx, mz] = lados(r)[lado];
    const [nx, nz] = NORMAL[lado];
    const meia = (nx ? r.z1 - r.z0 : r.x1 - r.x0) / 4;
    const faixa = {
      x0: Math.min(mx, mx + nx * VISTA) - (nx ? 0 : meia), x1: Math.max(mx, mx + nx * VISTA) + (nx ? 0 : meia),
      z0: Math.min(mz, mz + nz * VISTA) - (nz ? 0 : meia), z1: Math.max(mz, mz + nz * VISTA) + (nz ? 0 : meia),
    };
    const tapa = (o) => o.x0 < faixa.x1 - 0.01 && o.x1 > faixa.x0 + 0.01 && o.z0 < faixa.z1 - 0.01 && o.z1 > faixa.z0 + 0.01
      && !(o.x0 === r.x0 && o.z0 === r.z0);
    return retsPredios.some(tapa) ? null : lado;
  }
  const viasServico = VIAS.filter((v) => v.tipo === 'servico').map((v) => v.pontos);
  const viasAcesso = VIAS.filter((v) => v.tipo !== 'publica').map((v) => v.pontos);
  const isbl = ret(blocos.ISBL);
  /* Portao de garagem: na fachada voltada para a via de servico, centrado na
   * faixa por onde o caminhao chega (eixo da via deslocado de TRAFEGO.faixa
   * para a direita de quem entra) — data/ambiente.js manda o caminhao ate la
   * dentro pela mesma conta (ENTRADA_GARAGEM). */
  function garagemNaFaixa(r) {
    const lado = ladoMaisPerto(r, viasServico);
    const g = ENTRADA_GARAGEM;
    const L = lado === '+x' || lado === '-x' ? r.z1 - r.z0 : r.x1 - r.x0;
    // x da fachada cresce para a direita de quem olha de fora
    const x = { '+x': r.z1 - g.faixa[1], '-x': g.faixa[1] - r.z0, '+z': g.faixa[0] - r.x0, '-z': r.x1 - g.faixa[0] }[lado];
    return { lado, x: [Math.min(L - GARAGEM.largura / 2 - 0.5, Math.max(GARAGEM.largura / 2 + 0.5, x))] };
  }
  for (const [i, p] of PREDIOS.entries()) {
    const b = blocos[p.bloco];
    const r = retsPredios[i];
    if (p.guarita) {
      // guarita envidracada na ilha (Fase 15): o porteiro e da ambientacao
      const gu = criarGuarita({ largura: r.x1 - r.x0, comprimento: r.z1 - r.z0, porta: '-z' });
      gu.grupo.position.set((r.x0 + r.x1) / 2, Y.bloco, (r.z0 + r.z1) / 2);
      const o = gu.grupo.position;
      gu.grupo.userData.colisores = gu.colisores.map((c) => ({
        x0: c.x0 + o.x, x1: c.x1 + o.x, y0: c.y0 + o.y, y1: c.y1 + o.y, z0: c.z0 + o.z, z1: c.z1 + o.z,
      }));
      por(`predio-${p.bloco}`, p.bloco, gu.grupo, {
        titulo: 'Guarita', subtitulo: b.nome,
        grupos: [{ nome: 'Volume (adotado)', dados: {
          'Planta': `${f1(r.x1 - r.x0)} × ${f1(r.z1 - r.z0)} m`,
          'Vidro': 'Nos quatro lados, de 1,0 a 2,6 m: o porteiro vê quem chega e quem sai',
        } }],
      });
      continue;
    }
    // a porta e a de data/entorno.js (PORTAS), a mesma da calcada de acesso
    const porta = PORTAS.find((q) => q.bloco === p.bloco)?.lado ?? ladoMaisPerto(r, polCalcadasVias);
    const letreiro = letreiroPara(r);
    const obj = criarPredio({
      ret: r, base: Y.bloco, altura: p.altura, pavimentos: p.pavimentos, cor: p.cor,
      telhado: p.telhado, nome: b.nome, porta, letreiro, faixa: p.faixa, condensadoras: p.condensadoras, icone: p.icone,
      portoes: p.portoes ? { lado: ladoMaisPerto(r, viasAcesso), n: p.portoes } : null,
      docas: p.docas ? { lado: ladoMaisPerto(r, viasServico), n: p.docas } : null,
      garagens: p.garagem ? garagemNaFaixa(r) : null,
      semJanela: p.semJanelaPara ? [ladoVoltadoPara(r, centro(isbl))] : [],
    });
    // planta e lado da porta: o paisagismo (site/ambiente.js) deixa a porta livre
    obj.userData.planta = { ret: r, porta, letreiro, portoes: p.portoes ? ladoMaisPerto(r, viasAcesso) : null,
      docas: p.docas ? ladoMaisPerto(r, viasServico) : null, uso: b.categoria };
    por(`predio-${p.bloco}`, p.bloco, obj, {
      titulo: b.nome, subtitulo: 'Edificação',
      grupos: [{ nome: 'Volume (adotado)', dados: {
        'Planta': `${f1(r.x1 - r.x0)} × ${f1(r.z1 - r.z0)} m`,
        'Altura': `${f1(p.altura)} m, ${p.pavimentos} pavimento(s)`,
        'Telhado': p.telhado === 'galpao' ? 'Duas águas, metálico' : 'Laje com platibanda',
        ...(p.semJanelaPara ? { 'Fachada para o processo': 'Sem janela (sala de controle)' } : {}),
        ...(p.docas ? { 'Docas': `${p.docas}, no lado da via de serviço` } : {}),
        ...(p.garagem ? { 'Portão': `${f1(GARAGEM.largura)} × ${f1(GARAGEM.altura)} m, de enrolar, no fim da via de serviço: o caminhão entra e é carregado dentro` } : {}),
      } }],
    });
  }

  /* --------------------------------------------------- parque de tanques */
  const corTanque = { 'TQ-03': 0xd9d6c8 };
  for (const t of TANQUES) {
    const { grupo: g, R, yFundo } = criarTanque({ D: t.D, H: t.H, cor: corTanque[t.id] ?? 0xe9e8e3 });
    g.position.set(t.x, Y.bloco, t.z);
    g.userData.tanque = { R, yFundo };
    const vol = Math.PI * (t.D / 2) ** 2 * t.H;
    por(t.id, 'TANQUES', g, {
      titulo: t.id, subtitulo: t.servico,
      grupos: [{ nome: 'Tanque atmosférico (estimado)', dados: {
        'Diâmetro × altura': `${f1(t.D)} × ${f1(t.H)} m`,
        'Volume': `≈ ${Math.round(vol)} m³`,
        'Norma': 'API 650, teto cônico autoportante',
      } }],
    });
  }
  const rb = inset(ret(blocos[BACIA.bloco]), BACIA.recuo);
  const bacia = mureta(rb, { altura: BACIA.altura, largura: BACIA.largura });
  bacia.position.y = Y.bloco;
  // escadas de transposicao da bacia, no meio dos lados leste e oeste
  for (const x of [rb.x0, rb.x1]) {
    for (let k = 0; k < 4; k++) {
      for (const s of [-1, 1]) {
        // degraus de 0,22 m: a escada de fora cabe nos 1,0 m entre a mureta e a
        // borda do bloco
        const deg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25 * (k + 1), 1.2),
          new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.9 }));
        deg.position.set(x + s * (0.22 * (4 - k) - 0.06), (0.25 * (k + 1)) / 2 - 0.02, (rb.z0 + rb.z1) / 2);
        bacia.add(deg);
      }
    }
  }
  por('bacia-tanques', 'TANQUES', bacia, {
    titulo: 'Bacia de contenção', subtitulo: 'Parque de tanques',
    grupos: [{ nome: 'Especificação (adotado)', dados: {
      'Altura da mureta': `${f1(BACIA.altura)} m`,
      'Regra': 'Retém o maior tanque (NFPA 30); conta em site.js',
      'Acesso': 'Escadas de transposição nos lados leste e oeste',
    } }],
  });

  /* ------------------------------------------------------ agua de incendio */
  {
    const t = TANQUE_INCENDIO;
    const [cx, cz] = centro(ret(blocos[t.bloco]));
    const { grupo: g } = criarTanque({ D: t.D, H: t.H, cor: 0xe9e8e3, faixa: 0xc0392b });
    g.position.set(cx, Y.bloco, cz);
    por(t.id, t.bloco, g, {
      titulo: t.id, subtitulo: t.servico,
      grupos: [{ nome: 'Tanque (estimado)', dados: {
        'Diâmetro × altura': `${f1(t.D)} × ${f1(t.H)} m`, 'Volume': t.volume,
        'Reserva': '2 canhões de 1 900 L/min por 2 h',
      } }],
    });
  }

  /* ------------------------------------------------- torre de resfriamento */
  {
    const u = UTILIDADES_ENTORNO.torre;
    const [cx, cz] = centro(ret(blocos[u.bloco]));
    const { grupo: g, bocais, bacia } = criarTorreResfriamento(u);
    g.position.set(cx, Y.bloco, cz);
    g.userData.bocais = bocais;
    g.userData.bacia = bacia;
    por('torre', u.bloco, g, {
      titulo: 'Torre de resfriamento', subtitulo: `${u.celulas} células de tiragem induzida`,
      grupos: [{ nome: 'Especificação (estimado)', dados: {
        'Vazão de água': u.vazao, 'Calor rejeitado': u.calor,
        'Célula': `${u.lado} × ${u.lado} m, ${u.altura} m de altura`,
      } }],
    });
  }

  /* ------------------------------------------------------------- caldeira */
  {
    const u = UTILIDADES_ENTORNO.caldeira;
    const r = ret(blocos[u.bloco]);
    const { x: xCal, z: cz } = eixoCaldeira(blocos[u.bloco]);
    const cal = criarCaldeira(u);
    cal.grupo.position.set(xCal, Y.bloco, cz);
    cal.grupo.userData.bocais = cal.bocais;
    por('caldeira', u.bloco, cal.grupo, {
      titulo: 'Caldeira', subtitulo: 'Flamotubular de pacote',
      grupos: [{ nome: 'Especificação (estimado)', dados: {
        'Vapor': u.vapor, 'Pressão': u.pressao,
        'Casco': `Ø ${f1(u.diametro)} × ${f1(u.comprimento)} m`,
        'Chaminé': `${f1(u.chamine)} m — acima dos telhados num raio de 30 m`,
      } }],
    });
    // cobertura sobre o queimador e o casco; a chamine fica fora dela
    const cob = criarCobertura({ comprimento: u.comprimento, largura: u.diametro + 2, altura: u.diametro + 1.6 });
    cob.grupo.position.set(xCal - 0.9, Y.bloco, cz);
    por('cobertura-caldeira', u.bloco, cob.grupo, { titulo: 'Cobertura da caldeira', subtitulo: 'Estrutura metálica aberta', grupos: [] });
    // compressor de ar de instrumento, a leste
    const comp = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x2f6ea8, roughness: 0.6 }));
    comp.position.set(r.x1 - 3, Y.bloco + 0.85, cz);
    comp.castShadow = true;
    por('compressor-ar', u.bloco, comp, {
      titulo: 'Compressor de ar de instrumento', subtitulo: 'Pacote com secador',
      grupos: [{ nome: 'Serviço', dados: { 'Uso': 'Ar para os atuadores das válvulas de controle (Fase 6)' } }],
    });
  }

  /* ----------------------------------------------------------- subestacao */
  {
    const u = UTILIDADES_ENTORNO.subestacao;
    const r = ret(blocos[u.bloco]);
    for (let i = 0; i < u.transformadores; i++) {
      const tr = criarTransformador();
      tr.grupo.position.set(r.x0 + 2.5 + i * 4, Y.bloco, r.z0 + 3);
      por(`trafo-${i + 1}`, u.bloco, tr.grupo, {
        titulo: `Transformador ${i + 1}`, subtitulo: 'Subestação',
        grupos: [{ nome: 'Especificação (estimado)', dados: { 'Potência do conjunto': u.potencia } }],
      });
    }
    const casa = inset({ x0: r.x0, x1: r.x1, z0: r.z0 + 4.5, z1: r.z1 }, 1);
    const predio = criarPredio({
      ret: casa, base: Y.bloco, altura: 4, pavimentos: 1, cor: '#d9d5cc', telhado: 'laje',
      nome: 'Subestação', porta: ladoMaisPerto(casa, polCalcadasVias), letreiro: letreiroPara(casa), icone: 'energia',
      // casa de cubiculos nao tem janela baixa: ventila por veneziana alta, e
      // o cubiculo (2,2 m) encosta em qualquer parede (Fase 16)
      semJanela: ['+x', '-x', '+z', '-z'],
    });
    por('casa-subestacao', u.bloco, predio, {
      titulo: 'Casa de cubículos', subtitulo: 'Subestação',
      grupos: [{ nome: 'Uso', dados: { 'Abriga': 'Painéis de média tensão e CCMs' } }],
    });

    // patio cercado, canaletas e a entrada enterrada (Fase 18)
    const trafos = objetos.filter((o) => o.bloco === u.bloco && /^trafo-/.test(o.nome));
    const bases = new THREE.Box3();
    for (const t of trafos) bases.union(new THREE.Box3().setFromObject(t.grupo));
    const pt = { x0: bases.min.x - u.patio.folga, x1: bases.max.x + u.patio.folga, z0: bases.min.z - u.patio.folga, z1: bases.max.z + u.patio.folga };
    const cp = cerca(pt, [{ x: pt.x1, z: (pt.z0 + pt.z1) / 2, largura: u.patio.portao, folha: false }], { altura: u.patio.altura, vao: 2 });
    cp.name = 'cerca-subestacao';
    cp.userData.ficha = { titulo: 'Pátio dos transformadores', subtitulo: 'Subestação', grupos: [{ nome: 'Adotado', dados: {
      'Cerca': `${f1(u.patio.altura)} m, a ${f1(u.patio.folga)} m das bases — área de risco elétrico (NR-10)`,
      'Portão': `${f1(u.patio.portao)} m, para a manutenção`,
    } }] };
    grupo.add(cp);
    const canaleta = (x0, z0, x1, z1, nome) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const c = criarCanaleta({ comprimento: L, largura: u.canaleta });
      c.grupo.position.set((x0 + x1) / 2, Y.bloco, (z0 + z1) / 2);
      c.grupo.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      c.grupo.name = nome;
      c.grupo.userData.ficha = { titulo: 'Canaleta de cabos', subtitulo: 'Subestação', grupos: [{ nome: 'Adotado', dados: { 'Tampa': 'Concreto, removível', 'Largura': `${f1(u.canaleta)} m` } }] };
      grupo.add(c.grupo);
    };
    for (const t of trafos) {
      const b = new THREE.Box3().setFromObject(t.grupo);
      const x = (b.min.x + b.max.x) / 2;
      canaleta(x, b.max.z, x, casa.z0, `canaleta-${t.nome}`);
    }
    // a media tensao chega enterrada pela borda do bloco mais perto da via principal
    const zc = (casa.z0 + casa.z1) / 2;
    const cx0 = r.x0 + 0.6;
    canaleta(cx0 + 0.45, zc, casa.x0, zc, 'canaleta-entrada');
    const caixaMT = criarCaixaInspecao({ x: cx0, z: zc, yTopo: Y.bloco, profundidade: 1.2 });
    caixaMT.name = 'entrada-media-tensao';
    caixaMT.userData.ficha = { titulo: 'Caixa de passagem', subtitulo: 'Entrada de média tensão', grupos: [{ nome: 'Adotado', dados: { 'Recebe': u.entrada } }] };
    grupo.add(caixaMT);
  }

  /* -------------------------------------------- ETE (Fase 15, agua.js) */
  const naPlaca = (o, x, z) => o.position.set(x, Y.bloco, z);
  const meio = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
  const planta = (r) => ({ comprimento: r.x1 - r.x0, largura: r.z1 - r.z0 });
  {
    const A = arranjoEte(blocos.ETE);
    const s = ETE.separador;
    // cotas com 0 no piso do bloco (o grupo fica em Y.bloco)
    const cota = (y) => `${f2(y - Y.bloco).replace('-', '−')} m`;
    const sao = criarSeparadorAguaOleo({ ...planta(A.sao), lamina: s.lamina, nivel: NIVEIS_ETE.separador - Y.bloco });
    // a entrada (chicana do lado -x) fica para a drenagem, que chega do leste
    sao.grupo.rotation.y = Math.PI;
    naPlaca(sao.grupo, ...meio(A.sao));
    por('ete-separador', 'ETE', sao.grupo, {
      titulo: 'Separador água-óleo', subtitulo: 'ETE — recebe a drenagem da laje',
      grupos: [{ nome: 'API 421 (estimado)', dados: {
        'Canal': `${f1(s.largura)} × ${f1(s.comprimento)} m, lâmina de ${f1(s.lamina)} m`,
        'Pico de chuva': `${f1(ETE.chuvaLaje)} m³/h (100 mm/h na laje)`,
        'Gota retida': `150 µm de tolueno — sobe a ${f1(s.vt * 1000)} mm/s`,
        'Velocidade horizontal': `${f1(s.vh * 1000)} mm/s (${f1(s.vh / s.vt)} vt; a norma aceita até 15)`,
      } }, { nome: 'Enterrado (adotado)', dados: {
        'Chegada da drenagem': `fundo do tubo a ${cota(DRENAGEM.fundoChegada)}, depois de ${f1(DRENAGEM.comprimento)} m a ${f1(DRENAGEM.caimento * 100)} %`,
        'Lâmina': `${cota(NIVEIS_ETE.separador)} — por gravidade, sem bomba antes do separador (bomba emulsiona o óleo)`,
        'Óleo': 'Tubo coletor rotativo; o caminhão de vácuo recolhe pela tampa, do pátio',
        'Respiro': 'Com corta-chamas: vapor de tolueno',
      } }],
    });
    const le = planta(A.equalizacao).comprimento;
    // tampa das bombas junto da parede oeste, do lado do biologico
    const tampaBombas = [-le / 2 + 0.9, (A.biologico.z0 + A.biologico.z1) / 2 - meio(A.equalizacao)[1]];
    const eq = criarCaixaEnterrada({
      ...planta(A.equalizacao), nivel: NIVEIS_ETE.equalizacao - Y.bloco,
      fundo: NIVEIS_ETE.equalizacao - Y.bloco - ETE.laminaEqualizacao,
      tampas: [[...tampaBombas, 1.0], [le / 2 - 1, 0, 0.7], [0, le / 2 - 1, 0.7]],
    });
    naPlaca(eq.grupo, ...meio(A.equalizacao));
    por('ete-equalizacao', 'ETE', eq.grupo, {
      titulo: 'Tanque de equalização', subtitulo: 'ETE — enterrado',
      grupos: [{ nome: 'Dimensionamento (adotado)', dados: {
        'Volume': `${ETE.equalizacao} m³ — laje contida ${Math.round(ETE.contido)} m³ + 8 h da vazão contínua`,
        'Planta': `${f1(ETE.ladoEqualizacao)} × ${f1(ETE.ladoEqualizacao)} m, lâmina de ${f1(ETE.laminaEqualizacao)} m`,
        'Nível máximo': `${cota(NIVEIS_ETE.equalizacao)} — recebe o separador por gravidade`,
        'Recebe': 'O separador: chuva da laje, derrame ou água de incêndio, e a S-07, que vem pela drenagem',
        'Sai': 'Duas bombas submersíveis (uma reserva) mandam ao biológico em vazão constante',
      } }],
    });
    const bio = criarBaciaAberta({ ...planta(A.biologico), altura: ETE.laminaBiologico + 0.35, superficie: 'aeracao' });
    naPlaca(bio.grupo, ...meio(A.biologico));
    por('ete-biologico', 'ETE', bio.grupo, {
      titulo: 'Tanque de aeração', subtitulo: 'ETE — lodo ativado',
      grupos: [{ nome: 'Dimensionamento (adotado)', dados: {
        'Volume': `${ETE.biologico} m³ — 24 h de ${f1(ETE.organico)} m³/h com carga orgânica`,
        'Planta': `${f1(ETE.ladoBiologico)} × ${f1(ETE.ladoBiologico)} m, lâmina de ${f1(ETE.laminaBiologico)} m`,
        'Recebe': 'A equalização (S-07) por bomba; esgoto e laboratório pela rede sanitária',
        'Aeração': 'Difusores de bolha fina no fundo; sopradores na casa de química',
        'Fora dele': 'Purgas da torre e da caldeira e rejeito da ETA (inorgânicos) vão direto ao lançamento',
      } }],
    });
    // recalque da equalizacao ao biologico: sobe da tampa das bombas, passa
    // por cima da parede e desce dentro do tanque [ADOTADO DN 50, o menor
    // de bomba de efluente]
    {
      const [xe, ze] = meio(A.equalizacao);
      const xi = xe + tampaBombas[0], zi = ze + tampaBombas[1];
      const yAlto = Y.bloco + ETE.laminaBiologico + 0.35 + 0.35;
      const xb = A.biologico.x1 - 0.6;
      const tubo = tuboPorCaminho([
        new THREE.Vector3(xi, Y.bloco + eq.topo, zi), new THREE.Vector3(xi, yAlto, zi),
        new THREE.Vector3(xb, yAlto, zi), new THREE.Vector3(xb, Y.bloco + ETE.laminaBiologico - 0.3, zi),
      ], { dn: 50, mat: MAT.acoCarbono });
      tubo.name = 'recalque-equalizacao';
      tubo.userData.ficha = { titulo: 'Recalque da equalização', subtitulo: 'ETE → tanque de aeração',
        grupos: [{ nome: 'Adotado', dados: { 'Diâmetro': 'DN 50', 'Bombas': 'Submersíveis, no poço da equalização' } }] };
      grupo.add(tubo);
    }
    const dec = criarDecantador({ D: A.decantador.D, H: A.decantador.H });
    naPlaca(dec.grupo, A.decantador.x, A.decantador.z);
    por('ete-decantador', 'ETE', dec.grupo, {
      titulo: 'Decantador secundário', subtitulo: 'ETE',
      grupos: [{ nome: 'Dimensionamento (adotado)', dados: {
        'Diâmetro': `${f1(A.decantador.D)} m (16 m³/m²·dia, nunca menos de 2 m)`,
        'Parede': `${f1(A.decantador.H)} m`,
        'Lodo': 'Volta ao tanque de aeração; o excesso vai ao leito de secagem',
      } }],
    });
    A.leitos.forEach((r, i) => {
      const lt = criarBaciaAberta({ ...planta(r), altura: 0.6, superficie: 'lodo' });
      naPlaca(lt.grupo, ...meio(r));
      por(`ete-leito-${i + 1}`, 'ETE', lt.grupo, {
        titulo: `Leito de secagem ${i + 1}`, subtitulo: 'ETE — lodo de excesso',
        grupos: [{ nome: 'Adotado', dados: {
          'Célula': `${f1(ETE.leito.largura)} × ${f1(ETE.leito.comprimento)} m sobre areia e brita`,
          'Operação': 'Uma recebe lodo enquanto a outra seca',
        } }],
      });
    });
    const predio = criarPredio({
      ret: A.casa, base: Y.bloco, altura: 3.5, pavimentos: 1, cor: '#d6d2c6', telhado: 'laje',
      nome: 'ETE', porta: ladoMaisPerto(A.casa, polCalcadasVias), letreiro: letreiroPara(A.casa), icone: 'agua',
    });
    por('casa-ete', 'ETE', predio, {
      titulo: 'Casa de química e sopradores', subtitulo: 'Tratamento de efluentes',
      grupos: [{ nome: 'Uso', dados: { 'Abriga': 'Sopradores da aeração, dosagem (nutrientes, pH) e painel da ETE' } }],
    });
  }

  /* -------------------------------------------- ETA (Fase 15, agua.js) */
  {
    const A = arranjoEta(blocos.ETA);
    const po = criarCabecaPoco({ lado: A.poco.lado });
    naPlaca(po.grupo, A.poco.x, A.poco.z);
    por('eta-poco', 'ETA', po.grupo, {
      titulo: 'Poço tubular', subtitulo: 'ETA — captação',
      grupos: [{ nome: 'Adotado', dados: {
        'Água bruta': `${f1(ETA.bruta)} m³/h (demanda + 3 % de retrolavagem e regeneração)`,
        'Bomba': 'Submersa; quadro de comando no poste',
        'Proteção': 'Laje sanitária, longe das vias e da ETE',
      } }],
    });
    A.filtros.forEach((p, i) => {
      const f = criarVasoPressao({ D: ETA.filtroD, H: ETA.filtroH });
      naPlaca(f.grupo, p.x, p.z);
      por(`eta-filtro-${i + 1}`, 'ETA', f.grupo, {
        titulo: `Filtro de areia ${i + 1}`, subtitulo: 'ETA — pressurizado',
        grupos: [{ nome: 'Dimensionamento (adotado)', dados: {
          'Diâmetro × costado': `${f1(ETA.filtroD)} × ${f1(ETA.filtroH)} m`,
          'Taxa': `10 m³/(m²·h): ${f1(ETA.capacidade)} m³/h num filtro só`,
          'Operação': 'Um filtra enquanto o outro faz a retrolavagem',
        } }],
      });
    });
    const Ab = ETA.abrandador;
    A.abrandador.forEach((p, i) => {
      const c = criarVasoPressao({ D: Ab.D, H: Ab.H, pes: 0.15, fibra: true });
      naPlaca(c.grupo, p.x, p.z);
      por(`eta-abrandador-${i + 1}`, 'ETA', c.grupo, {
        titulo: `Abrandador ${i + 1}`, subtitulo: 'ETA — água da caldeira',
        grupos: [{ nome: 'Adotado', dados: {
          'Coluna de resina': `Ø ${f1(Ab.D)} × ${f1(Ab.H)} m`,
          'Vazão': `${f1(ETA.consumidores[1].vazao)} m³/h de reposição da caldeira`,
          'Por que não desmineralizar': 'Caldeira flamotubular de 8–10 bar: basta tirar a dureza',
        } }],
      });
    });
    const sa = criarTanqueSalmoura({ D: Ab.salmouraD, H: Ab.salmouraH });
    naPlaca(sa.grupo, A.salmoura.x, A.salmoura.z);
    por('eta-salmoura', 'ETA', sa.grupo, {
      titulo: 'Tanque de salmoura', subtitulo: 'ETA — regeneração do abrandador', grupos: [],
    });
    const rs = criarTanque({ D: A.reservatorio.D, H: A.reservatorio.H, cor: 0xe9e8e3, faixa: 0x2f6aa8 });
    naPlaca(rs.grupo, A.reservatorio.x, A.reservatorio.z);
    por('eta-reservatorio', 'ETA', rs.grupo, {
      titulo: 'Reservatório de água tratada', subtitulo: 'ETA',
      grupos: [{ nome: 'Dimensionamento (adotado)', dados: {
        'Volume': `${Math.round(ETA.reservatorio)} m³ — 24 h de demanda (o poço pode parar um dia)`,
        'Diâmetro × altura': `${f1(A.reservatorio.D)} × ${f1(A.reservatorio.H)} m`,
        ...Object.fromEntries(ETA.consumidores.map((c) => [c.nome, `${f1(c.vazao)} m³/h`])),
      } }],
    });
    const ca = criarCastelo({ D: ETA.casteloD, H: ETA.casteloH, fundo: ETA.casteloFundo });
    naPlaca(ca.grupo, A.castelo.x, A.castelo.z);
    por('eta-castelo', 'ETA', ca.grupo, {
      titulo: 'Castelo d’água', subtitulo: 'ETA — água potável',
      grupos: [{ nome: 'Dimensionamento (adotado)', dados: {
        'Volume': `${ETA.castelo} m³ — um dia de consumo humano (NBR 5626)`,
        'Cuba': `Ø ${f1(ETA.casteloD)} × ${f1(ETA.casteloH)} m`,
        'Fundo da cuba': `${f1(ETA.casteloFundo)} m acima do piso`,
      } }],
    });
    const predio = criarPredio({
      ret: A.casa, base: Y.bloco, altura: 3.5, pavimentos: 1, cor: '#d9d5cc', telhado: 'laje',
      nome: 'ETA', porta: ladoMaisPerto(A.casa, polCalcadasVias), letreiro: letreiroPara(A.casa), icone: 'agua',
    });
    por('casa-eta', 'ETA', predio, {
      titulo: 'Casa de química e bombas', subtitulo: 'Tratamento de água',
      grupos: [{ nome: 'Uso', dados: {
        'Abriga': 'Dosagem de cloro, bombas de água tratada (torre, caldeira, castelo) e painel',
      } }],
    });
  }

  /* ----------------------------------------------------- baia de descarga */
  {
    const u = UTILIDADES_ENTORNO.descarga;
    const r = ret(blocos[u.bloco]);
    const [cx, cz] = centro(r);
    const piso = new THREE.Group();
    const laje = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0 - 2, 0.3, r.z1 - r.z0 - 4),
      new THREE.MeshStandardMaterial({ color: 0x9b9d9a, roughness: 0.95 }));
    laje.position.set(cx, Y.bloco + 0.04 - 0.15, cz);
    laje.receiveShadow = true;
    piso.add(laje);
    por('laje-descarga', u.bloco, piso, {
      titulo: 'Baia de descarga', subtitulo: 'Caminhão-tanque de tolueno',
      grupos: [{ nome: 'Especificação (adotado)', dados: {
        'Piso': 'Concreto com caimento para canaleta', 'Braços de descarga': String(u.bracos),
      } }],
    });
    const cob = criarCobertura({ comprimento: r.x1 - r.x0 - 4, largura: 7, altura: 5.2 });
    cob.grupo.position.set(cx, Y.bloco, cz);
    por('cobertura-descarga', u.bloco, cob.grupo, { titulo: 'Cobertura da baia de descarga', subtitulo: 'Estrutura metálica aberta', grupos: [] });
    posicaoBracos(blocos[u.bloco]).forEach(([xb, zb], i) => {
      const br = criarBracoCarga();
      br.grupo.position.set(xb, Y.bloco, zb);
      br.grupo.rotation.y = -Math.PI / 2;
      br.grupo.userData.bocais = br.bocais;
      por(`braco-${i + 1}`, u.bloco, br.grupo, {
        titulo: `Braço de descarga ${i + 1}`, subtitulo: 'Tolueno de reposição',
        grupos: [{ nome: 'Serviço', dados: { 'Destino': 'Tanques TQ-01 e TQ-02' } }],
      });
    });
  }

  /* -------------------------------------- praca da portaria (Fase 15) */
  const P = PRACA_PORTARIA;
  const cancelas = [];
  {
    const cob = { x0: P.cobertura.x[0], x1: P.cobertura.x[1], z0: P.cobertura.z[0], z1: P.cobertura.z[1] };
    const xi = (P.ilha.x[0] + P.ilha.x[1]) / 2;
    const pilares = [cob.x0 + 0.4, xi, cob.x1 - 0.4].flatMap((x) => [[x, cob.z0 + 1], [x, cob.z1 - 1]]);
    const co = criarCoberturaPortaria({
      ret: cob, pilares, yBase: Y.via, alturaLivre: P.cobertura.alturaLivre,
      letreiro: ['BENZOIC INDUSTRIES  ·  PORTARIA'],
    });
    por('cobertura-portaria', 'praca-portaria', co.grupo, {
      titulo: 'Cobertura da portaria', subtitulo: 'Praça de entrada e saída',
      grupos: [{ nome: 'Estrutura (adotado)', dados: {
        'Planta': `${f1(cob.x1 - cob.x0)} × ${f1(cob.z1 - cob.z0)} m`,
        'Altura livre': `${f1(P.cobertura.alturaLivre)} m (IT 06 do CBPMESP pede 4,5 m)`,
      } }],
    });
    for (const cn of P.cancelas) {
      const ca = criarCancela({ comprimento: cn.comprimento - 0.3 });
      ca.grupo.position.set(cn.x - cn.sentido * 0.25, Y.bloco, cn.z);
      ca.grupo.rotation.y = cn.sentido > 0 ? 0 : Math.PI;
      por(`cancela-${cn.pista}`, 'praca-portaria', ca.grupo, {
        titulo: `Cancela de ${cn.pista}`, subtitulo: 'Portaria',
        grupos: [{ nome: 'Operação', dados: { 'Braço': `${f1(cn.comprimento - 0.3)} m`, 'Abre': 'Quando o veículo para diante dela' } }],
      });
      cancelas.push({ ...cn, braco: ca.braco });
    }
    for (const [x, z] of P.catracas ?? []) {
      const ct = criarCatraca({ largura: LARGURA_CALCADA });
      ct.grupo.position.set(x, Y.calcada, z);
      por(`catraca-${x < xi ? 'oeste' : 'leste'}`, 'praca-portaria', ct.grupo, {
        titulo: 'Catraca de pedestre', subtitulo: 'Portaria',
        grupos: [{ nome: 'Passagem', dados: { 'Tripé': '0,55 m', 'Portão de acessibilidade': '0,9 m' } }],
      }, Y.calcada);
    }
  }

  /* ----------------------------------------- ponto de onibus (Fase 15) */
  {
    const ab = ONIBUS.abrigo;
    const a = criarAbrigo({ comprimento: ab.x[1] - ab.x[0], profundidade: ab.z[1] - ab.z[0], frente: 1, placa: ['PONTO DE ÔNIBUS'] });
    a.grupo.position.set((ab.x[0] + ab.x[1]) / 2, Y.calcada, (ab.z[0] + ab.z[1]) / 2);
    por('abrigo-onibus', 'ponto-onibus', a.grupo, {
      titulo: 'Abrigo do ônibus', subtitulo: 'Desembarque e espera dos operários',
      grupos: [{ nome: 'Adotado', dados: {
        'Planta': `${f1(ab.x[1] - ab.x[0])} × ${f1(ab.z[1] - ab.z[0])} m, beiral sobre a calçada`,
        'Capacidade': `~${ab.capacidade} pessoas — um ônibus cheio`,
      } }],
    });
    // caminho pintado ate o vestiario: as duas bordas em amarelo e o texto
    const cam = ONIBUS.caminho;
    const yP = Y.calcada + 0.003;
    for (const s of [-1, 1]) {
      grupo.add(faixaPintada(cam.map(([x, z]) => [x + s * (LARGURA_CALCADA / 2 - 0.15), z]), 0.12, yP));
    }
    const [x0, z0] = cam[0], [x1, z1] = cam[cam.length - 1];
    const ida = pinturaChao({ texto: 'VESTIÁRIO', largura: 0.5, comprimento: 1.6 });
    ida.position.set(x0, yP, z0 - 2);
    grupo.add(ida);
    const volta = pinturaChao({ texto: 'ÔNIBUS', largura: 0.5, comprimento: 1.4 });
    volta.position.set(x1, yP, z1 + 3);
    volta.rotation.z = Math.PI;
    grupo.add(volta);
  }

  /* -------------------------------------------- estacionamento e cerca
   * (vias, calcadas, meio-fio e travessias sao do chao: site/chao.js) */
  grupo.add(vagas(ret(blocos.ESTAC), VAGA));
  grupo.add(cerca(ret(LOTE), PORTOES, CERCA));

  return { grupo, objetos, cancelas };
}
