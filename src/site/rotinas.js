import * as THREE from 'three';
import { criarPessoa, PASSADA, criarFrascoAmostra, criarLanterna, criarAlmotolia } from '../lib/human.js';
import { criarGrade } from '../lib/navegacao.js';
import { redeDePolilinhas, ret } from '../lib/plano.js';
import { Y } from '../lib/terreno.js';
import { CALCADAS, BLOCOS } from '../data/site.js';
import { PORTAS } from '../data/entorno.js';
import { PAPEIS, VELOCIDADE_PESSOA, SENTAR, LONGE, AMOSTRAS, SUBIDA, RELOGIO } from '../data/rotinas.js';
import { destinosPedestre } from './pedestres.js';

/**
 * ===========================================================================
 *  PESSOAS COM ROTINA  (Fase 20)
 * ===========================================================================
 *  Cada pessoa de data/rotinas.js ganha, por regra:
 *    - um lugar por parada da agenda, escolhido pela `acao` entre os lugares
 *      dos moveis do predio (registro.lugares, site/interiores.js) — um por
 *      pessoa: ninguem senta na cadeira de outro;
 *    - o caminho entre as paradas: por dentro do predio (grade das salas
 *      com as portas e divisorias abertas, menos os moveis), pela porta e a
 *      calcada de acesso (PORTAS), pela rede de calcadas e, na ronda, pelos
 *      corredores da laje (grade sem equipamento, rack e apoios).
 *  O ciclo se repete. A pessoa senta e levanta (lib/human.js), digita,
 *  come, conversa ou trabalha na bancada. As portas abrem para ela
 *  (`posicoes`, lidas por interiores.atualizar) e os veiculos a respeitam
 *  (ambiente.pedestres). A auditoria (`achados`) mede o que a construcao
 *  promete: caminho que nao existe, pessoa dentro de parede ou de movel,
 *  fora de calcada fora dos predios, lugar repetido.
 */

const NORMAL = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
const ATRAS = 0.65;            // m atras do assento, de onde quem vai sentar chega [ADOTADO]

export function criarRotinas({ interiores, tubulacao, ambiente, instrumentacao = null, todos = null }) {
  const grupo = new THREE.Group();
  grupo.name = 'rotinas';
  const achados = [];
  const achar = (regra, peca, detalhe) => achados.push({ regra, peca, detalhe });
  const f1 = (v) => v.toFixed(1).replace('.', ',');

  /* ---------------------------------------------------------- predios */
  const predios = {};
  for (const it of interiores.interiores) {
    const reg = it.registro, casca = it.casca;
    // uma grade por pavimento: as salas dele, as portas e divisorias dele e
    // os moveis dele; a escada (em baixo) e o vao dela (em cima) bloqueiam
    const andares = casca.pisos.map((y, k) => {
      const salas = reg.salas.filter((s) => s.k === k);
      const abertos = [];
      for (const s of salas) {
        for (const e of s.entradas) {
          if (!e.vao) continue;
          const v = e.vao, emX = e.lado === '+x' || e.lado === '-x';
          abertos.push(emX ? { x0: v.x0 - 0.6, x1: v.x1 + 0.6, z0: v.z0 + 0.15, z1: v.z1 - 0.15 }
            : { x0: v.x0 + 0.15, x1: v.x1 - 0.15, z0: v.z0 - 0.6, z1: v.z1 + 0.6 });
        }
      }
      const bloqueios = reg.moveis.filter((m) => (m.ref?.k ?? 0) === k && m.h > 0.2).map((m) => m.ret);
      if (casca.escada) bloqueios.push(casca.escada.ret);
      return { k, y, grade: criarGrade({ ret: casca.ret, livres: salas.map((s) => s.ret), abertos, bloqueios, passo: 0.2, raio: 0.28 }) };
    });
    const grade = andares[0].grade;
    // escada: o pe dela no terreo e a chegada em cima, meio metro fora dos degraus
    const es = casca.escada;
    const escada = es ? {
      baixo: [es.pe[0] - es.dir[0] * 0.5, es.pe[1] - es.dir[1] * 0.5],
      pe: es.pe,
      topo: [es.pe[0] + es.dir[0] * es.comprimento, es.pe[1] + es.dir[1] * es.comprimento],
      cima: [es.pe[0] + es.dir[0] * (es.comprimento + 0.5), es.pe[1] + es.dir[1] * (es.comprimento + 0.5)],
    } : null;
    const P = PORTAS.find((q) => q.bloco === reg.bloco);
    const porta = P?.acesso ? {
      fora: P.porta, acesso: P.acesso,
      dentro: [P.porta[0] - NORMAL[P.lado][0] * 0.9, P.porta[1] - NORMAL[P.lado][1] * 0.9],
    } : null;
    predios[reg.bloco] = { it, grade, andares, escada, y: casca.pisos[0], porta, lugares: reg.lugares.filter((l) => l.sala.k < andares.length), usados: new Set(), ret: casca.ret };
  }

  /* ---------------------------------------------------------- laje e calcadas */
  const isbl = ret(BLOCOS.find((b) => b.id === 'ISBL'));
  const laje = criarGrade({
    ret: isbl, livres: [isbl], passo: 0.5, raio: 0.35,
    bloqueios: tubulacao.ocupados.filter((q) => !tubulacao.corredores.includes(q)),
  });
  const acessos = Object.entries(predios).filter(([, p]) => p.porta).map(([b, p]) => ({ id: `acesso-${b}`, pontos: p.porta.acesso }));
  // tolerancia de 0,5 m: calcada que comeca encostada em outra (a do
  // predio na da via) tem de entrar na rede, senao o caminho pula pela via
  const rede = redeDePolilinhas([...CALCADAS, ...acessos], { tol: 0.5 });
  // por onde se entra na laje: no da rede do lado de fora dela, a ate 1,5 m
  // (os de dentro sao calcada que a cruza: na laje anda-se pela grade), no
  // componente das calcadas dos predios — o do norte (tanques, torre) so se
  // liga a ele atravessando a laje, e quem vai la anda pela grade
  const principal = rede.componentes().find((c) => c.includes(acessos[0]?.id)) ?? [];
  const naBorda = rede.nos.filter((n) => {
    const dx = Math.max(isbl.x0 - n.p[0], 0, n.p[0] - isbl.x1), dz = Math.max(isbl.z0 - n.p[1], 0, n.p[1] - isbl.z1);
    const d = Math.hypot(dx, dz);
    // e com chao livre da laje logo ali (senao o trecho ate ele cruza equipamento)
    const c = laje.maisPerto(n.p);
    return d > 0.05 && d <= 1.5 && c && Math.hypot(c[0] - n.p[0], c[1] - n.p[1]) < 2
      && principal.includes(rede.entrar(n.p).a.id);
  });
  // as bordas de todos os componentes (a ronda do vigia entra pela do norte
  // quando vem dos tanques): o mesmo criterio, sem o do componente
  const todasBordas = rede.nos.filter((n) => {
    const dx = Math.max(isbl.x0 - n.p[0], 0, n.p[0] - isbl.x1), dz = Math.max(isbl.z0 - n.p[1], 0, n.p[1] - isbl.z1);
    const d = Math.hypot(dx, dz), c = laje.maisPerto(n.p);
    return d > 0.05 && d <= 1.5 && c && Math.hypot(c[0] - n.p[0], c[1] - n.p[1]) < 2;
  });
  // pontos de ronda: o meio dos corredores da laje, so os que a grade liga
  // a uma entrada (corredor estreito demais vira bolsao)
  const rondas = tubulacao.corredores.map((r) => laje.maisPerto([(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2])).filter(Boolean)
    .filter((p) => { const e = entradaLaje(p); return e && laje.caminho(p, e.dentro); });
  /* Postos de inspecao (Fase 25, pedido do autor: "operarios mexendo nas
   * valvulas, olhando as coisas de perto ... inspecionando com prancheta").
   * Os alvos saem da cena, por regra: valvula de controle ao alcance do
   * piso (girar o volante), instrumento de campo (ler e anotar) e, para o
   * mecanico, bomba (olhar de perto). O posto e o ponto livre da grade da
   * laje a ~0,9 m do alvo, em uma de oito direcoes, que a grade liga a uma
   * entrada; a pessoa fica de frente para o alvo. */
  const caixaDe = (o) => new THREE.Box3().setFromObject(o);
  const alvos = { valvula: [], instrumento: [], bomba: [], amostra: [], lubrifica: [] };
  instrumentacao?.grupo.traverse((o) => {
    const v = /^valvula-V/.test(o.name), i = /^instrumento-/.test(o.name);
    if (!v && !i) return;
    const b = caixaDe(o), c = b.getCenter(new THREE.Vector3());
    if (v && b.min.y >= 0.25 && b.max.y <= 2.1) alvos.valvula.push({ nome: o.name.slice(8), p: [c.x, c.z], y: (b.min.y + b.max.y) / 2, acao: 'valvula' });
    if (i && c.y >= 0.5 && c.y <= 2.2) alvos.instrumento.push({ nome: o.name.split('-')[1], p: [c.x, c.z], y: c.y, acao: 'inspecionar' });
  });
  for (const [tag, e] of Object.entries(todos ?? {})) {
    if (!/^B[CD]-/.test(tag)) continue;
    const b = caixaDe(e.grupo), c = b.getCenter(new THREE.Vector3());
    alvos.bomba.push({ nome: tag, p: [c.x, c.z], y: b.max.y, acao: 'inspecionar' });
    // mancal: no meio da bomba, a meia altura dela (Fase 27, item 12)
    alvos.lubrifica.push({ nome: tag, p: [c.x, c.z], y: (b.min.y + b.max.y) / 2, acao: 'lubrificar' });
    // valvula de amostragem na descarga, no alto da bomba (Fase 27, item 11)
    if (AMOSTRAS.includes(tag)) alvos.amostra.push({ nome: tag, p: [c.x, c.z], y: b.max.y, acao: 'amostra' });
  }
  // escadas de marinheiro de cada vaso (Fase 27, item 12): o pe (no chao
  // livre da laje, por fora), o alto da escada e o piso da plataforma
  function escadasDe(tag) {
    const e = todos?.[tag];
    if (!e) return [];
    const c = e.grupo.getWorldPosition(new THREE.Vector3()), out = [];
    e.grupo.traverse((o) => {
      if (o.name !== 'escada' || !o.children.length) return;
      const b = caixaDe(o), lc = b.getCenter(new THREE.Vector3());
      const u = [lc.x - c.x, lc.z - c.z], n = Math.hypot(u[0], u[1]);
      if (n < 1e-3) return;
      const d = [u[0] / n, u[1] / n];
      // a face de fora da escada, no eixo radial
      const rFora = Math.max(...[[b.min.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z], [b.max.x, b.min.z]]
        .map(([x, z]) => (x - c.x) * d[0] + (z - c.z) * d[1]));
      const r = rFora - SUBIDA.dentro;
      const pe = [c.x + d[0] * r, c.z + d[1] * r];
      const piso = b.max.y - SUBIDA.guarda;
      const deck = [pe[0] - d[0] * SUBIDA.passo, pe[1] - d[1] * SUBIDA.passo];
      // a grade da laje marca a escada inteira como obstaculo, mas a gaiola
      // so comeca acima da cabeca: o pe dela fica a ate 1,5 m do chao livre,
      // e o primeiro passo vai dele ao pe
      const chao = laje.maisPerto(pe);
      if (!chao || Math.hypot(chao[0] - pe[0], chao[1] - pe[1]) > 1.5) return;
      out.push({ pe, chao, piso, deck, centro: [c.x, c.y, c.z] });
    });
    return out;
  }
  function postoDe(a) {
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const q = laje.maisPerto([a.p[0] + 0.9 * Math.cos(ang), a.p[1] + 0.9 * Math.sin(ang)]);
      if (!q) continue;
      const d = Math.hypot(q[0] - a.p[0], q[1] - a.p[1]);
      if (d < 0.45 || d > 1.4) continue;
      const e = entradaLaje(q);
      if (e && laje.caminho(q, e.dentro)) return { tipo: 'laje', p: q, alvo: [a.p[0], a.y, a.p[1]], acao: a.acao, nome: a.nome };
    }
    return null;
  }
  for (const lista of Object.values(alvos)) lista.sort((u, v) => u.p[0] - v.p[0] || u.p[1] - v.p[1]);
  const postos = new Map();                       // alvo -> posto (ou null), calculado uma vez
  const posto = (a) => { if (!postos.has(a)) postos.set(a, postoDe(a)); return postos.get(a); };
  /** k-esimo posto de quem: alternando valvula e instrumento (ou so bombas),
   *  sem repetir alvo (nem o de outra pessoa) enquanto houver alvo livre. */
  const usados = new Set();
  function postoPara(quem, k, de) {
    const listas = de === 'bombas' ? [alvos.bomba] : de === 'amostra' ? [alvos.amostra] : de === 'lubrifica' ? [alvos.lubrifica] : [alvos.valvula, alvos.instrumento];
    const L = listas[k % listas.length];
    for (const repetir of [false, true]) {
      for (let j = 0; j < L.length; j++) {
        const a = L[(quem * 5 + k * 7 + j) % L.length];
        if (!repetir && usados.has(a)) continue;
        const p = posto(a);
        if (p) { usados.add(a); return p; }
      }
    }
    return null;
  }
  function entradaLaje(p) {
    const n = naBorda.reduce((m, q) => (!m || Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < Math.hypot(m.p[0] - p[0], m.p[1] - p[1]) ? q : m), null);
    return n ? { fora: n.p, dentro: laje.maisPerto(n.p) } : null;
  }

  /* ---------------------------------------------------------- paradas */
  const comY = (pts, y, bloco = null) => pts.map(([x, z]) => [x, z, y, bloco]);
  /** Ponto de onde se chega a parada (atras da cadeira, ou o proprio lugar). */
  function chegada(par) {
    if (par.tipo === 'laje' || par.tipo === 'calcada') return par.p;
    const l = par.l;
    return l.postura === 'sentado' ? [l.x - Math.sin(l.rumo) * ATRAS, l.z - Math.cos(l.rumo) * ATRAS] : [l.x, l.z];
  }
  /** Caminho dentro do predio, de a (pavimento ka) a b (kb), pela escada se
   *  mudar de andar: a grade de um, os degraus subindo (ou descendo), a do
   *  outro. Pontos com a altura do piso de cada trecho. */
  function noPredio(P, bloco, a, ka, b, kb) {
    const A = P.andares;
    if (ka === kb) {
      const pts = A[ka].grade.caminho(a, b);
      return pts && comY(pts, A[ka].y, bloco);
    }
    const e = P.escada;
    if (!e) return null;
    const sobe = kb > ka;
    const p1 = A[ka].grade.caminho(a, sobe ? e.baixo : e.cima);
    const p2 = A[kb].grade.caminho(sobe ? e.cima : e.baixo, b);
    if (!p1 || !p2) return null;
    const degraus = sobe
      ? [[e.pe[0], e.pe[1], A[ka].y, bloco], [e.topo[0], e.topo[1], A[kb].y, bloco]]
      : [[e.topo[0], e.topo[1], A[ka].y, bloco], [e.pe[0], e.pe[1], A[kb].y, bloco]];
    return [...comY(p1, A[ka].y, bloco), ...degraus, ...comY(p2, A[kb].y, bloco)];
  }
  /** Da parada ate o lado de fora (a calcada), e o lado de fora: { pts, ext }. */
  function saida(par, nome) {
    const a = chegada(par);
    if (par.tipo === 'calcada') return { pts: [[a[0], a[1], Y.calcada, null]], ext: a };
    if (par.tipo === 'laje') {
      const e = par.entrada ?? entradaLaje(a);
      const pts = e && laje.caminho(a, e.dentro);
      if (!pts) { achar('CAMINHO_SEM_SAIDA', nome, `da laje em (${f1(a[0])}; ${f1(a[1])})`); return null; }
      return { pts: [...comY(pts, 0), [e.fora[0], e.fora[1], Y.calcada, null]], ext: e.fora };
    }
    const P = predios[par.bloco];
    if (!P.porta) { achar('CAMINHO_SEM_SAIDA', nome, `${par.bloco} sem calçada de acesso`); return null; }
    const pts = noPredio(P, par.bloco, a, par.l.sala.k, P.porta.dentro, 0);
    if (!pts) { achar('CAMINHO_SEM_SAIDA', nome, `de ${par.l.acao} até a porta do ${par.bloco}`); return null; }
    return { pts: [...pts, ...comY(P.porta.acesso, Y.calcada)], ext: P.porta.acesso.at(-1) };
  }
  function trecho(de, ate, nome) {
    if (de.tipo === 'lugar' && ate.tipo === 'lugar' && de.bloco === ate.bloco) {
      const P = predios[de.bloco];
      const pts = noPredio(P, de.bloco, chegada(de), de.l.sala.k, chegada(ate), ate.l.sala.k);
      if (!pts) { achar('CAMINHO_SEM_SAIDA', nome, `dentro do ${de.bloco}`); return null; }
      return pts;
    }
    if (de.tipo === 'laje' && ate.tipo === 'laje') {
      const pts = laje.caminho(chegada(de), chegada(ate));
      if (!pts) { achar('CAMINHO_SEM_SAIDA', nome, 'na laje'); return null; }
      return comY(pts, 0);
    }
    const s = saida(de, nome), e = saida(ate, nome);
    if (!s || !e) return null;
    const meio = rede.caminho(s.ext, e.ext).pontos;
    return [...s.pts, ...comY(meio, Y.calcada), ...[...e.pts].reverse()];
  }

  /* ---------------------------------------------------------- gente */
  const pessoas = [];
  let quem = 0;
  const total = PAPEIS.reduce((s, p) => s + p.n, 0);
  for (const papel of PAPEIS) {
    for (let i = 0; i < papel.n; i++, quem++) {
      const nome = `${papel.papel} ${i + 1}`;
      const reservados = {};
      const paradas = [];
      for (const ag of papel.agenda) {
        if (ag.em === 'laje') {
          // inspecao em postos de verdade (Fase 25); sem alvo, a ronda antiga
          for (let k = 0; k < (ag.inspecao ?? 0); k++) {
            const p = postoPara(quem, k, ag.alvos);
            if (p) paradas.push({ ...p, s: ag.s });
            else achar('SEM_POSTO', nome, `inspecao ${k + 1} (${ag.alvos ?? 'campo'})`);
          }
          for (let k = 0; k < (ag.ronda ?? 0); k++) paradas.push({ tipo: 'laje', p: rondas[(quem * 2 + k * 3) % rondas.length], s: ag.s });
          for (let k = 0; k < (ag.lubrifica ?? 0); k++) {
            const p = postoPara(quem, k, 'lubrifica');
            if (p) paradas.push({ ...p, s: ag.s });
            else achar('SEM_POSTO', nome, `lubrificacao ${k + 1}`);
          }
          if (ag.escada) {
            const es = escadasDe(ag.escada);
            const E = es[quem % Math.max(1, es.length)];
            if (!E) achar('SEM_POSTO', nome, `escada do ${ag.escada}`);
            else {
              const e0 = entradaLaje(E.chao);
              if (e0 && laje.caminho(E.chao, e0.dentro)) paradas.push({ tipo: 'laje', p: E.chao, alvo: [E.centro[0], 1.5, E.centro[2]], s: 1, escada: { ...E, s: ag.s, tag: ag.escada } });
              else achar('SEM_POSTO', nome, `pe da escada do ${ag.escada} sem caminho na laje`);
            }
          }
          for (let k = 0; k < (ag.amostra ?? 0); k++) {
            const p = postoPara(quem, k, 'amostra');
            if (p) paradas.push({ ...p, s: ag.s });
            else achar('SEM_POSTO', nome, `amostra ${k + 1}`);
          }
          continue;
        }
        if (ag.em === 'ronda') {
          // os destinos de pedestre de fora dos predios, pela ordem do angulo
          // em volta do centro da planta (uma volta), escolhidos `pontos`
          // espalhados; a parada e onde o acesso deles toca a rede
          const ds = destinosPedestre().filter((d) => ['bloco', 'dique'].includes(d.tipo));
          const cx = ds.reduce((a, d) => a + d.p[0], 0) / ds.length, cz = ds.reduce((a, d) => a + d.p[1], 0) / ds.length;
          ds.sort((u, v) => Math.atan2(u.p[1] - cz, u.p[0] - cx) - Math.atan2(v.p[1] - cz, v.p[0] - cx));
          const n = Math.min(ag.pontos, ds.length);
          const volta = [];
          for (let k = 0; k < n; k++) {
            const d = ds[Math.floor((k * ds.length) / n)];
            const e = rede.entrar(d.p);
            if (!e) { achar('SEM_POSTO', nome, `ronda em ${d.nome}`); continue; }
            volta.push({ tipo: 'calcada', p: e.q, alvo: [d.p[0], 1.0, d.p[1]], acao: 'iluminar', nome: d.nome, s: ag.s });
          }
          // a rede de calcadas daqui nao liga o norte (ETA, torre, tanques)
          // ao leste (utilidades) sem a laje: entre duas paradas sem caminho
          // por calcada, passa pela laje (o ponto de ronda dela mais perto)
          // Entra na laje pela borda a que a parada de antes chega a pe e sai
          // pela que chega a seguinte: um ponto de ronda junto de cada uma.
          const pertoDe = (p) => rondas.reduce((m, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(m[0] - p[0], m[1] - p[1]) ? q : m));
          const bordaDe = (p) => todasBordas.map((nb) => ({ nb, L: rede.caminho(p, nb.p).total })).filter((x) => Number.isFinite(x.L))
            .sort((u, v) => u.L - v.L)[0]?.nb;
          volta.forEach((a, k) => {
            paradas.push(a);
            const b = volta[(k + 1) % volta.length];
            if (!b || Number.isFinite(rede.caminho(a.p, b.p).total) || !rondas.length) return;
            const ba = bordaDe(a.p), bb = bordaDe(b.p);
            if (!ba || !bb) { achar('CAMINHO_SEM_SAIDA', nome, `ronda de ${a.nome} a ${b.nome}`); return; }
            // a parada na laje leva a entrada dela: a da borda a que se chega
            const r1 = pertoDe(ba.p), r2 = pertoDe(bb.p);
            paradas.push({ tipo: 'laje', p: r1, s: 1, entrada: { fora: ba.p, dentro: laje.maisPerto(ba.p) } });
            paradas.push({ tipo: 'laje', p: r2, s: 1, entrada: { fora: bb.p, dentro: laje.maisPerto(bb.p) } });
          });
          continue;
        }
        const P = predios[ag.em];
        const chave = `${ag.em}:${ag.acao}`;
        let l = reservados[chave];
        if (!l) {
          // espalhados pelos lugares livres (e pelos andares), nao sempre o primeiro
          const livres = P?.lugares.filter((q) => q.acao === ag.acao && !P.usados.has(q)) ?? [];
          l = livres[(quem * 7) % Math.max(1, livres.length)];
          if (!l) { achar('SEM_LUGAR', nome, `${ag.acao} no ${ag.em}`); continue; }
          P.usados.add(l);
          reservados[chave] = l;
        }
        paradas.push({ tipo: 'lugar', bloco: ag.em, l, s: ag.s, entrega: !!ag.entrega });
      }
      // fases: estar em cada parada e andar ate a seguinte (fecha o ciclo)
      const fases = [];
      for (let k = 0; k < paradas.length; k++) {
        const de = paradas[k], ate = paradas[(k + 1) % paradas.length];
        fases.push({ tipo: 'estar', par: de, T: de.s });
        if (de.escada) {
          // sobe a escada, passa a plataforma, le o instrumento, volta e desce
          const E = de.escada, v = SUBIDA.velocidade;
          const pe0 = [E.pe[0], 0, E.pe[1]], pe1 = [E.pe[0], E.piso, E.pe[1]], dk = [E.deck[0], E.piso, E.deck[1]];
          const olha = [E.centro[0], E.centro[2]];
          // `par` com a posicao em planta: quem le as fases (o passeio,
          // site/passeio.js) espera `par.l` ou `par.p` fora do andar
          const par = { tipo: 'subida', p: [E.pe[0], E.pe[1]] };
          fases.push({ tipo: 'sobe', par, de: [de.p[0], 0, de.p[1]], ate: pe0, T: 1, anda: true, olha });
          fases.push({ tipo: 'sobe', par, de: pe0, ate: pe1, T: E.piso / v, olha });
          fases.push({ tipo: 'sobe', par, de: pe1, ate: dk, T: SUBIDA.passo / VELOCIDADE_PESSOA + 0.5, anda: true, olha });
          fases.push({ tipo: 'estar', par: { tipo: 'plataforma', p: E.deck, y: E.piso, alvo: [E.centro[0], E.piso + 1.4, E.centro[2]], acao: 'inspecionar' }, T: E.s });
          fases.push({ tipo: 'sobe', par, de: dk, ate: pe1, T: SUBIDA.passo / VELOCIDADE_PESSOA + 0.5, anda: true, olha, deCostas: true });
          fases.push({ tipo: 'sobe', par, de: pe1, ate: pe0, T: E.piso / v, olha });
          fases.push({ tipo: 'sobe', par, de: pe0, ate: [de.p[0], 0, de.p[1]], T: 1, anda: true, olha, deCostas: true });
        }
        const pts = trecho(de, ate, nome);
        if (!pts) continue;
        const acum = [0];
        for (let j = 1; j < pts.length; j++) acum.push(acum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
        fases.push({ tipo: 'anda', pts, acum, L: acum.at(-1), T: acum.at(-1) / VELOCIDADE_PESSOA });
      }
      if (!fases.length) continue;
      // frasco de amostra (Fase 27, item 11): aparece na mao na metade da
      // coleta, vai junto ate a bancada do LAB e fica nela no primeiro terco
      // da parada (deixado para a analise)
      const iColhe = fases.findIndex((q) => q.tipo === 'estar' && q.par.acao === 'amostra');
      if (iColhe >= 0) {
        fases[iColhe].frasco = 'colhe';
        for (let k = 1; k < fases.length; k++) {
          const q = fases[(iColhe + k) % fases.length];
          if (q.tipo === 'estar' && q.par.entrega) { q.frasco = 'entrega'; break; }
          q.frasco = 'leva';
        }
      }
      const roupa = papel.roupa;
      const pessoa = criarPessoa({
        roupa: Array.isArray(roupa.roupa) ? roupa.roupa[i % roupa.roupa.length] : roupa.roupa,
        calca: roupa.calca, capacete: roupa.capacete, pele: [0xe0b394, 0xc89a7a, 0xa47554, 0x7d5338, 0x5c3a24][quem % 5],
      });
      pessoa.grupo.name = `pessoa-rotina`;
      pessoa.grupo.userData.animar = true;               // fora da fusao: se mexe
      pessoa.grupo.userData.ficha = {
        titulo: nome[0].toUpperCase() + nome.slice(1), subtitulo: 'Rotina de cena (Fase 20)',
        grupos: [{ nome: 'Agenda (adotado)', dados: Object.fromEntries(papel.agenda.map((a, j) => [`${j + 1}. ${a.em === 'laje' ? 'Laje' : a.em}`,
          a.em === 'ronda' ? `ronda de lanterna por ${a.pontos} pontos, ${a.s} s cada` : a.em === 'laje' ? (a.inspecao ? `inspeção em ${a.inspecao} postos, ${a.s} s cada` : a.amostra ? `coleta de amostra (${AMOSTRAS.join(', ')}), ${a.s} s` : a.escada ? `sobe a escada do ${a.escada} e lê o instrumento, ${a.s} s` : a.lubrifica ? `lubrifica ${a.lubrifica} bombas, ${a.s} s cada` : `ronda por ${a.ronda} pontos`) : `${a.acao}, ${a.s} s`])) }],
      };
      grupo.add(pessoa.grupo);
      const ciclo = fases.reduce((s, f) => s + f.T, 0);
      const frasco = iColhe >= 0 ? pessoa.segurar(criarFrascoAmostra()) : null;
      const lanterna = paradas.some((q) => q.acao === 'iluminar') ? pessoa.segurar(criarLanterna()) : null;
      const almotolia = paradas.some((q) => q.acao === 'lubrificar') ? pessoa.segurar(criarAlmotolia()) : null;
      pessoas.push({ nome, papel: papel.papel, pessoa, frasco, lanterna, almotolia, fases, ciclo, t: (quem / total) * ciclo, fase: 0, passoFase: Math.random() * 6, ritmo: 0, dim: [0.5, 0.5] });
    }
  }

  /* ------------------------------------------- relogio comum (item 16) */
  let relogio = null;
  {
    const inicio = (p, i) => p.fases.slice(0, i).reduce((s2, f) => s2 + f.T, 0);
    const idx = (p, ok) => p.fases.findIndex((f) => f.tipo === 'estar' && ok(f.par));
    const comer = (par) => par.tipo === 'lugar' && par.l.acao === 'comer';
    const reuniao = (par) => par.tipo === 'lugar' && par.bloco === 'ADM' && par.l.acao === 'conversar';
    // a reuniao: o mesmo intervalo entre ela e o almoco para todos os que a
    // tem — a diferenca entra no trabalho de mesa entre as duas
    const doReuniao = pessoas.filter((p) => p.papel === RELOGIO.reuniao && idx(p, reuniao) >= 0 && idx(p, comer) > idx(p, reuniao));
    const delta = (p) => inicio(p, idx(p, comer)) - inicio(p, idx(p, reuniao));
    const dMax = Math.max(0, ...doReuniao.map(delta));
    for (const p of doReuniao) {
      const i0 = idx(p, reuniao), i1 = idx(p, comer);
      const meio = p.fases.slice(i0 + 1, i1).filter((f) => f.tipo === 'estar' && f.par.tipo === 'lugar' && f.par.l.acao !== 'conversar');
      if (meio.length) meio[0].T += dMax - delta(p);
      else achar('SEM_LUGAR', p.nome, 'sem trabalho entre a reunião e o almoço para acertar o relógio');
    }
    // o ciclo comum: o maior, para cima no minuto; a sobra no trabalho
    const ciclo = Math.max(RELOGIO.ciclo, ...pessoas.map((p) => Math.ceil(p.fases.reduce((s2, f) => s2 + f.T, 0) / 60) * 60));
    let k = 0;
    for (const p of pessoas) {
      const tot = p.fases.reduce((s2, f) => s2 + f.T, 0);
      const trabalho = p.fases.filter((f) => f.tipo === 'estar' && !(f.par.tipo === 'lugar' && (comer(f.par) || reuniao(f.par))))
        .sort((u, v) => v.T - u.T)[0];
      if (trabalho) trabalho.T += ciclo - tot;
      p.ciclo = ciclo;
      // o almoco comeca em RELOGIO.almoco, um depois do outro
      const ic = idx(p, comer);
      if (ic >= 0) p.t = (((inicio(p, ic) - RELOGIO.almoco - k++ * RELOGIO.escalonar) % ciclo) + ciclo) % ciclo;
    }
    relogio = { ciclo, almoco: RELOGIO.almoco, reuniao: doReuniao.length ? +(RELOGIO.almoco - dMax).toFixed(0) : null };
  }

  /* ---------------------------------------------------------- auditoria */
  // pessoa dentro de parede (colisores dos predios, a 1 m do piso) ou de
  // movel (fora o trecho final ate o assento), e fora de calcada fora deles
  const paredes = interiores.colisores;
  // cada movel com a altura do piso dele: em cima nao se esbarra no de baixo
  const moveis = Object.values(predios).flatMap((P) => P.it.registro.moveis.filter((m) => m.h > 0.2)
    .map((m) => ({ ...m.ret, y: P.andares[m.ref?.k ?? 0]?.y ?? P.y })));
  const naCalcada = ([x, z]) => rede.entrar([x, z]).d < 1.6;
  for (const p of pessoas) {
    let ruim = 0;
    for (const f of p.fases) {
      if (f.tipo !== 'anda') continue;
      for (let s = 0.5; s < f.L - 0.5 && ruim < 3; s += 0.5) {
        const [x, z, y, bloco] = ponto(f, s);
        if (paredes.some((c) => x > c.x0 + 0.05 && x < c.x1 - 0.05 && z > c.z0 + 0.05 && z < c.z1 - 0.05 && y + 1 > c.y0 && y + 1 < c.y1)) { ruim++; achar('PESSOA_NA_PAREDE', p.nome, `(${f1(x)}; ${f1(z)})`); }
        else if (bloco && moveis.some((m) => Math.abs(m.y - y) < 1 && x > m.x0 + 0.05 && x < m.x1 - 0.05 && z > m.z0 + 0.05 && z < m.z1 - 0.05)) { ruim++; achar('PESSOA_NO_MOVEL', p.nome, `(${f1(x)}; ${f1(z)})`); }
        else if (!bloco && y > 0.01 && !naCalcada([x, z])) { ruim++; achar('PESSOA_FORA_DA_CALCADA', p.nome, `(${f1(x)}; ${f1(z)})`); }
      }
    }
  }

  /* ---------------------------------------------------------- movimento */
  function ponto(f, s) {
    let j = 1;
    while (j < f.acum.length - 1 && f.acum[j] < s) j++;
    const a = f.pts[j - 1], b = f.pts[j];
    const u = Math.min(1, Math.max(0, (s - f.acum[j - 1]) / Math.max(1e-6, f.acum[j] - f.acum[j - 1])));
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] ?? b[3]];
  }
  const posicoes = [];
  const pc = new THREE.Vector3();
  function atualizar(dt, camera, noite = 0) {
    posicoes.length = 0;
    for (const p of pessoas) {
      p.t = (p.t + dt) % p.ciclo;
      let t = p.t, f = null;
      for (const g of p.fases) { if (t < g.T) { f = g; break; } t -= g.T; }
      if (!f) continue;
      const g = p.pessoa.grupo, P = p.pessoa;
      let bloco = null, andando = 0, sentado = 0;
      if (f.tipo === 'sobe') {
        // escada e passo para a plataforma: reta em 3D, de frente para o vaso
        const k = Math.min(1, t / f.T);
        const x = f.de[0] + (f.ate[0] - f.de[0]) * k, y = f.de[1] + (f.ate[1] - f.de[1]) * k, z = f.de[2] + (f.ate[2] - f.de[2]) * k;
        g.position.set(x, y, z);
        g.rotation.y = Math.atan2(f.olha[0] - x, f.olha[1] - z) + (f.deCostas ? Math.PI : 0);
        if (f.anda) { andando = 1; p.passoFase += (Math.PI * VELOCIDADE_PESSOA * dt) / PASSADA; }
      } else if (f.tipo === 'anda') {
        const s = t * VELOCIDADE_PESSOA;
        const [x, z, y, b] = ponto(f, s);
        const [x2, z2] = ponto(f, Math.min(f.L, s + 0.4));
        g.position.set(x, y, z);
        if (Math.hypot(x2 - x, z2 - z) > 1e-3) g.rotation.y = Math.atan2(x2 - x, z2 - z);
        bloco = b;
        andando = 1;
        p.passoFase += (Math.PI * VELOCIDADE_PESSOA * dt) / PASSADA;
      } else if (f.par.tipo === 'laje' || f.par.tipo === 'calcada' || f.par.tipo === 'plataforma') {
        g.position.set(f.par.p[0], f.par.tipo === 'calcada' ? Y.calcada : f.par.tipo === 'plataforma' ? f.par.y : 0, f.par.p[1]);
        // de frente para o alvo (a frente da figura e +z); sem alvo, olha em volta
        if (f.par.alvo) g.rotation.y = Math.atan2(f.par.alvo[0] - f.par.p[0], f.par.alvo[2] - f.par.p[1]);
        else g.rotation.y += 0.3 * dt;
      } else {
        const l = f.par.l;
        bloco = f.par.bloco;
        const de = chegada(f.par);
        if (l.postura === 'sentado') {
          // senta: de tras da cadeira ao assento, girando; levanta ao fim
          const k = Math.min(1, t / SENTAR, (f.T - t) / SENTAR);
          g.position.set(de[0] + (l.x - de[0]) * k, l.y, de[1] + (l.z - de[1]) * k);
          sentado = Math.max(0, k);
        } else {
          g.position.set(l.x, l.y, l.z);
        }
        g.rotation.y = l.rumo;
      }
      p.ritmo += (andando - p.ritmo) * Math.min(1, dt / 0.3);
      P.animar(p.passoFase, p.ritmo);
      if (f.tipo === 'sobe' && !f.anda) P.subir(t);
      else if (sentado > 0) P.sentar(sentado, f.par.l.acao, p.t);
      else if (f.tipo === 'estar' && f.par.tipo === 'lugar' && f.par.l.postura === 'em-pe') P.trabalhar(p.t);
      else if (f.tipo === 'estar' && f.par.acao === 'valvula') P.girarVolante(t, f.par.alvo[1]);
      else if (f.tipo === 'estar' && f.par.acao === 'iluminar') {
        const d = Math.hypot(f.par.alvo[0] - f.par.p[0], f.par.alvo[2] - f.par.p[1]);
        P.iluminar(t, Math.atan2(f.par.alvo[1] - 1.6, Math.max(0.3, d)));
      }
      else if (f.tipo === 'estar' && f.par.acao === 'lubrificar') {
        const d = Math.hypot(f.par.alvo[0] - f.par.p[0], f.par.alvo[2] - f.par.p[1]);
        P.lubrificar(t, Math.atan2(f.par.alvo[1] - 1.0, Math.max(0.3, d)));
      }
      else if (f.tipo === 'estar' && f.par.acao === 'amostra') {
        const d = Math.hypot(f.par.alvo[0] - f.par.p[0], f.par.alvo[2] - f.par.p[1]);
        P.colher(t, Math.atan2(f.par.alvo[1] - 1.6, Math.max(0.3, d)));
      }
      else if (f.tipo === 'estar' && f.par.acao === 'inspecionar') {
        const d = Math.hypot(f.par.alvo[0] - f.par.p[0], f.par.alvo[2] - f.par.p[1]);
        P.inspecionar(t, Math.atan2(f.par.alvo[1] - 1.6, Math.max(0.3, d)));
      }
      if (p.frasco) p.frasco.visible = f.frasco === 'leva' || (f.frasco === 'colhe' && t > f.T / 2) || (f.frasco === 'entrega' && t < f.T / 3);
      if (p.almotolia) p.almotolia.visible = f.tipo === 'estar' && f.par.acao === 'lubrificar';
      // a lanterna acende quando escurece (k da noite, site/noite.js)
      if (p.lanterna) p.lanterna.userData.facho.visible = noite > 0.5;
      // de longe, ou dentro de predio cujo interior esta apagado, nao se desenha
      g.getWorldPosition(pc);
      g.visible = pc.distanceTo(camera.position) < LONGE && (!bloco || predios[bloco].it.grupo.visible);
      posicoes.push(g.position);
    }
  }

  // os veiculos respeitam quem anda (site/ambiente.js)
  ambiente.pedestres?.(pessoas.map((p) => ({ g: p.pessoa.grupo, dim: p.dim, pessoa: true })));

  const resumo = { relogio, pessoas: pessoas.length, lugares: Object.values(predios).reduce((s, P) => s + P.usados.size, 0),
    ciclos: pessoas.map((p) => Math.round(p.ciclo)) };
  return { grupo, atualizar, posicoes, achados, resumo, pessoas, depurar: { rede, laje, predios, naBorda } };
}
