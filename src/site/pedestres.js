/**
 * ===========================================================================
 *  REDE DE PEDESTRES  (Fase 28)
 * ===========================================================================
 *  Pedido do autor (30/10): "mapear os caminhos de pedestres — tem muitos
 *  lugares inacessiveis porque nao ha calcadas conectadas nem faixas".
 *
 *  O mapa logico de onde se anda a pe, tirado dos dados (nenhuma coordenada
 *  aqui):
 *    - DESTINOS: a porta de cada predio (PORTAS), as catracas da portaria,
 *      o abrigo do onibus, o estacionamento, as rampas de pedestre da laje
 *      (CONTENCAO.rampas), as escadas do dique (BACIA), cada bloco de
 *      utilidade e a baia de descarga (o meio do lado voltado para a rede —
 *      a mesma regra da porta), e os pontos de encontro;
 *    - ARESTAS: as calcadas (CALCADAS, ligadas onde se tocam ou cruzam), o
 *      acesso de cada porta e o trecho de cada destino ate a calcada mais
 *      perto. Trecho de calcada sobre a pista e TRAVESSIA (o entorno pinta a
 *      faixa ali); andar na pista fora dela nao e aresta: o acesso de um
 *      destino que cruzaria via nao vale.
 *    - A laje liga as rampas dela (anda-se pelos corredores); dentro do
 *      estacionamento e do ponto de encontro anda-se livre.
 *
 *  Achados (__auditarPedestres, roda no Node):
 *    INACESSIVEL         destino sem caminho a partir da catraca, do onibus
 *                        e do estacionamento
 *    TRAVESSIA_FALTANDO  o acesso mais perto do destino cruzaria a via
 *    CALCADA_SEM_SAIDA   ponta de calcada que nao chega a nada (fora do lote
 *                        ela segue pela cidade)
 *    DESVIO              de quem chega ate onde vai: mais de `fator` vezes
 *                        a reta (e `sobra` m)
 *    SEM_ROTA_DE_FUGA    destino sem caminho ate um ponto de encontro
 *  `mapaPedestre()` devolve a rede para desenhar (vista de planta).
 * ===========================================================================
 */
import { BLOCOS, VIAS, CALCADAS, PRACA_PORTARIA, ONIBUS, LOTE } from '../data/site.js';
import { PORTAS, BACIA } from '../data/entorno.js';
import { CONTENCAO } from '../data/arranjo.js';
import { PEDESTRES } from '../data/pedestres.js';
import { redeDePolilinhas, ret, distPontoSeg, projetarNoSeg, segEntraRet, distPontoRet } from '../lib/plano.js';

const f1 = (v) => v.toFixed(1).replace('.', ',');
const pt = (p) => `(${f1(p[0])}; ${f1(p[1])})`;
const bloco = (id) => BLOCOS.find((b) => b.id === id);
const dentroRet = ([x, z], r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;

/** A via em que o ponto cai (dentro da pista), ou null. */
function viaEm(p) {
  for (const v of VIAS) {
    for (let i = 1; i < v.pontos.length; i++) if (distPontoSeg(p, v.pontos[i - 1], v.pontos[i]) < v.largura / 2) return v;
  }
  return null;
}

/** Trechos de uma reta a..b sobre pista: [{ t0, t1, via }] (passo de 0,25 m). */
function trechosNaVia(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.25));
  const out = [];
  let atual = null;
  for (let k = 0; k <= n; k++) {
    const t = k / n, v = viaEm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    if (v && !atual) atual = { t0: t, t1: t, via: v.id };
    else if (v && atual) atual.t1 = t;
    else if (!v && atual) { out.push(atual); atual = null; }
  }
  if (atual) out.push(atual);
  return out;
}

/** Os destinos, dos dados. */
export function destinosPedestre() {
  const out = [];
  const nome = (id) => bloco(id)?.nome ?? id;
  for (const p of PORTAS) {
    out.push({ id: `porta:${p.bloco}`, nome: `Porta — ${nome(p.bloco)}`, tipo: 'porta', p: p.porta, acesso: p.acesso, dono: p.bloco });
  }
  PRACA_PORTARIA.catracas.forEach((c, i) => out.push({ id: `catraca:${i ? 'leste' : 'oeste'}`, nome: 'Catraca da portaria', tipo: 'catraca', p: c }));
  // o abrigo, nao a parada (que e o onibus, na baia)
  const A = ONIBUS.abrigo;
  out.push({ id: 'onibus', nome: 'Abrigo do ônibus', tipo: 'onibus', p: [(A.x[0] + A.x[1]) / 2, (A.z[0] + A.z[1]) / 2] });
  for (const id of PEDESTRES.livres) {
    const r = ret(bloco(id));
    const cat = bloco(id).categoria;
    out.push({ id: `bloco:${id}`, nome: nome(id), tipo: cat === 'encontro' ? 'encontro' : cat, p: [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2], livre: r, dono: id });
  }
  // rampas de pedestre da laje: onde o corredor transversal chega a mureta
  const L = ret(bloco('ISBL'));
  for (const rp of CONTENCAO.rampas.filter((q) => /pedestre/.test(q.motivo))) {
    const p = rp.lado === 'norte' ? [rp.centro, L.z0] : rp.lado === 'sul' ? [rp.centro, L.z1]
      : rp.lado === 'oeste' ? [L.x0, rp.centro] : [L.x1, rp.centro];
    out.push({ id: `rampa:${rp.lado}:${f1(rp.centro)}`, nome: `Rampa de pedestre da laje (${rp.lado})`, tipo: 'rampa', p, laje: true });
  }
  // escadas de transposicao do dique, no meio dos lados leste e oeste
  {
    const r = ret(bloco(BACIA.bloco)), zc = (r.z0 + r.z1) / 2;
    out.push({ id: 'dique:leste', nome: 'Escada do dique (leste)', tipo: 'dique', p: [r.x1 - BACIA.recuo, zc], dono: BACIA.bloco });
    out.push({ id: 'dique:oeste', nome: 'Escada do dique (oeste)', tipo: 'dique', p: [r.x0 + BACIA.recuo, zc], dono: BACIA.bloco });
  }
  // blocos de utilidade sem predio com porta: o meio do lado voltado para a
  // rede (a regra da porta)
  const comPorta = new Set(PORTAS.map((p) => p.bloco));
  const polis = CALCADAS.map((c) => c.pontos);
  for (const B of BLOCOS.filter((b) => PEDESTRES.categoriasDeBloco.includes(b.categoria) && !comPorta.has(b.id))) {
    const r = ret(B), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const meios = [[r.x1, cz], [r.x0, cz], [cx, r.z1], [cx, r.z0]];
    const d = (q) => Math.min(...polis.flatMap((pl) => pl.slice(1).map((b, i) => distPontoSeg(q, pl[i], b))));
    const p = meios.sort((a, b) => d(a) - d(b))[0];
    out.push({ id: `bloco:${B.id}`, nome: B.nome, tipo: 'bloco', p, dono: B.id });
  }
  return out;
}

/**
 * Acesso de um destino a rede: o trecho reto mais curto ate a calcada que
 * nao cruza via nem entra em bloco que nao seja o dele, ate `acessoMax` m
 * (dentro de area livre, ate a borda dela e mais `acessoMax`). Devolve
 * { pontos } ou { falta: 'via' | 'longe', via, d }.
 */
function acessoDe(dst, bloqueios) {
  if (dst.acesso) return { pontos: dst.acesso };
  // candidatos: o pe da perpendicular em cada segmento de calcada
  const cands = [];
  for (const c of CALCADAS) {
    for (let i = 1; i < c.pontos.length; i++) {
      const { p } = projetarNoSeg(dst.p, c.pontos[i - 1], c.pontos[i]);
      cands.push({ q: p, d: Math.hypot(p[0] - dst.p[0], p[1] - dst.p[1]) });
    }
  }
  cands.sort((a, b) => a.d - b.d);
  const max = dst.livre ? Math.max(dst.livre.x1 - dst.livre.x0, dst.livre.z1 - dst.livre.z0) / 2 + PEDESTRES.acessoMax : PEDESTRES.acessoMax;
  let viaMaisPerto = null;
  for (const { q, d } of cands) {
    if (d > max) break;
    if (d < 0.05) return { sobre: true };
    const naVia = trechosNaVia(dst.p, q);
    if (naVia.length) { viaMaisPerto ??= { via: naVia[0].via, d }; continue; }
    // nao entra em predio nem bloco alheio (a area livre do proprio, sim)
    if (bloqueios.some((b) => b.id !== dst.dono && !(dst.livre && b.r === dst.livre) && segEntraRet(dst.p, q, b.r, 0.05))) continue;
    return { pontos: [dst.p, q] };
  }
  return viaMaisPerto ? { falta: 'via', ...viaMaisPerto } : { falta: 'longe' };
}

/** A rede inteira e os achados. */
export function mapaPedestre() {
  const destinos = destinosPedestre();
  const achados = [];
  // blocos por onde nao se passa a pe (a faixa verde, o estacionamento e o
  // encontro, sim; a laje entra pelas rampas)
  const bloqueios = BLOCOS.filter((b) => !PEDESTRES.blocosDePassagem.includes(b.categoria) && b.id !== 'ISBL')
    .map((b) => ({ id: b.id, r: ret(b) }));

  // acessos
  const polis = CALCADAS.map((c) => ({ id: c.id, pontos: c.pontos, tipo: c.caminho ? 'caminho' : 'calcada' }));
  for (const dst of destinos) {
    if (dst.laje) { dst.noLaje = true; continue; }
    const a = acessoDe(dst, bloqueios);
    if (a.sobre) { dst.acessoOk = true; continue; }      // ja esta na calcada
    if (a.pontos) { polis.push({ id: `acesso:${dst.id}`, pontos: a.pontos, tipo: 'caminho' }); dst.acessoOk = true; dst.idAcesso = `acesso:${dst.id}`; continue; }
    if (a.falta === 'via') achados.push({ regra: 'TRAVESSIA_FALTANDO', id: dst.id, detalhe: `${dst.nome} ${pt(dst.p)}: a calçada mais perto (${f1(a.d)} m) fica do outro lado da via ${a.via}, sem faixa` });
    else achados.push({ regra: 'INACESSIVEL', id: dst.id, detalhe: `${dst.nome} ${pt(dst.p)}: nenhuma calçada a menos de ${PEDESTRES.acessoMax} m sem cruzar via ou bloco` });
  }

  // a rede: calcadas, acessos e a laje ligando as rampas
  const lajeR = ret(bloco('ISBL'));
  const rede = redeDePolilinhas(polis, { conectores: [lajeR] });
  // por onde cada destino entra na rede: a aresta em que ele cai (a do
  // proprio acesso, ou a calcada em que esta) e a distancia as duas pontas
  // dela; a rampa entra pelo no da laje mais perto
  const entrada = (p, so) => {
    let melhor = null;
    for (const a of rede.arestas) {
      if (so && a.id !== so) continue;
      const { p: q } = projetarNoSeg(p, a.a, a.b);
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (!melhor || d < melhor.d) melhor = { d, q, a };
    }
    if (!melhor) return null;
    const { q, a } = melhor, dq = (k) => Math.hypot(rede.nos[k].p[0] - q[0], rede.nos[k].p[1] - q[1]);
    return [[a.i, melhor.d + dq(a.i)], [a.j, melhor.d + dq(a.j)]];
  };
  for (const dst of destinos) {
    if (dst.noLaje) {
      let k = -1, dm = Infinity;
      rede.nos.forEach((n, i) => {
        if (distPontoRet(n.p, lajeR) > 1) return;
        const d = Math.hypot(n.p[0] - dst.p[0], n.p[1] - dst.p[1]);
        if (d < dm) { dm = d; k = i; }
      });
      dst.ent = k >= 0 && dm <= PEDESTRES.acessoMax ? [[k, dm]] : null;
      if (!dst.ent) achados.push({ regra: 'INACESSIVEL', id: dst.id, detalhe: `${dst.nome} ${pt(dst.p)}: nenhuma calçada chega à laje perto dela` });
    } else dst.ent = dst.acessoOk ? entrada(dst.p, dst.idAcesso) : null;
  }

  // distancias pela rede (Dijkstra a partir das pontas de entrada)
  const dijkstra = (ent) => {
    const dist = new Array(rede.nos.length).fill(Infinity), feito = new Uint8Array(rede.nos.length);
    for (const [k, d] of ent) dist[k] = Math.min(dist[k], d);
    for (;;) {
      let k = -1;
      for (let i = 0; i < dist.length; i++) if (!feito[i] && dist[i] < Infinity && (k < 0 || dist[i] < dist[k])) k = i;
      if (k < 0) break;
      feito[k] = 1;
      for (const [j, d] of rede.nos[k].viz) if (dist[k] + d < dist[j]) dist[j] = dist[k] + d;
    }
    return dist;
  };
  const ate = (dist, dst) => Math.min(...dst.ent.map(([k, d]) => dist[k] + d));
  const origens = destinos.filter((d) => PEDESTRES.origens.includes(d.tipo) && d.ent);
  const encontros = destinos.filter((d) => d.tipo === 'encontro' && d.ent);
  const distOrig = origens.map((o) => ({ o, dist: dijkstra(o.ent) }));
  const distEnc = encontros.map((e) => ({ e, dist: dijkstra(e.ent) }));
  for (const dst of destinos) {
    if (!dst.ent) { dst.alcancado = false; continue; }
    const ms = distOrig.map(({ o, dist }) => ({ o, m: ate(dist, dst), reta: Math.hypot(o.p[0] - dst.p[0], o.p[1] - dst.p[1]) }));
    const ok = ms.filter((x) => Number.isFinite(x.m));
    dst.alcancado = ok.length > 0;
    dst.metros = ok.length ? Math.min(...ok.map((x) => x.m)) : null;
    if (!dst.alcancado && !PEDESTRES.origens.includes(dst.tipo)) {
      achados.push({ regra: 'INACESSIVEL', id: dst.id, detalhe: `${dst.nome} ${pt(dst.p)}: a calçada dele não se liga à da portaria, do ônibus nem do estacionamento` });
    }
    // desvio: de quem chega (portaria, onibus, estacionamento) ate onde se
    // vai; entre duas origens nao se anda (as catracas ficam dos dois lados
    // da ilha), e a ida ao encontro e a rota de fuga
    const ehOrigem = PEDESTRES.origens.includes(dst.tipo);
    for (const x of ok) {
      if (ehOrigem || dst.tipo === 'encontro' || x.reta < 1) continue;
      if (x.m > PEDESTRES.fator * x.reta && x.m - x.reta > PEDESTRES.sobra) {
        achados.push({ regra: 'DESVIO', id: dst.id, detalhe: `${x.o.nome} → ${dst.nome}: ${f1(x.m)} m pela calçada contra ${f1(x.reta)} m em linha reta` });
      }
    }
    // rota de fuga: ate o ponto de encontro mais perto pela rede
    if (dst.tipo !== 'encontro') {
      const f = distEnc.map(({ e, dist }) => ({ e, m: ate(dist, dst) })).filter((x) => Number.isFinite(x.m)).sort((a, b) => a.m - b.m)[0];
      dst.fuga = f ? { encontro: f.e.id, metros: +f.m.toFixed(1) } : null;
      if (!f && dst.alcancado) achados.push({ regra: 'SEM_ROTA_DE_FUGA', id: dst.id, detalhe: `${dst.nome}: nenhum caminho até um ponto de encontro` });
    }
  }

  // ponta de calcada que nao chega a nada: no de grau 1 que nao e destino,
  // nao encosta na laje nem esta numa area livre
  const nosDestino = new Set(destinos.flatMap((d) => (d.ent ?? []).filter(([, d0]) => d0 < 1.5).map(([k]) => k)));
  const livres = destinos.filter((d) => d.livre).map((d) => d.livre);
  const loteR = { x0: LOTE.x[0], x1: LOTE.x[1], z0: LOTE.z[0], z1: LOTE.z[1] };
  rede.nos.forEach((n, k) => {
    if (n.viz.length !== 1 || nosDestino.has(k)) return;
    if (distPontoRet(n.p, lajeR) <= 1 || livres.some((r) => dentroRet(n.p, r, 1))) return;
    // fora do lote a calcada publica continua pela cidade
    if (!dentroRet(n.p, loteR)) return;
    const a = rede.arestas.find((q) => q.i === k || q.j === k);
    achados.push({ regra: 'CALCADA_SEM_SAIDA', id: a?.id, detalhe: `${a?.id ?? 'calçada'} termina em ${pt(n.p)} sem chegar a nada` });
  });

  // arestas para desenhar: cada trecho sobre pista vira travessia
  const tipoDe = Object.fromEntries(polis.map((q) => [q.id, q.tipo]));
  const arestas = [];
  for (const a of rede.arestas) {
    let t = 0;
    const em = (u) => [a.a[0] + (a.b[0] - a.a[0]) * u, a.a[1] + (a.b[1] - a.a[1]) * u];
    for (const tr of trechosNaVia(a.a, a.b)) {
      if (tr.t0 > t) arestas.push({ a: em(t), b: em(tr.t0), tipo: tipoDe[a.id], id: a.id });
      arestas.push({ a: em(tr.t0), b: em(tr.t1), tipo: 'travessia', id: a.id, via: tr.via });
      t = tr.t1;
    }
    if (t < 1) arestas.push({ a: em(t), b: a.b, tipo: tipoDe[a.id], id: a.id });
  }

  return {
    arestas,
    destinos: destinos.map(({ id, nome, tipo, p, alcancado, metros, fuga }) => ({ id, nome, tipo, p, alcancado: !!alcancado, metros: metros == null ? null : +metros.toFixed(1), fuga: fuga ?? null })),
    achados,
  };
}

/** __auditarPedestres(): os achados, por regra, e o resumo. */
export function auditarPedestres() {
  const m = mapaPedestre();
  const porRegra = {};
  for (const a of m.achados) porRegra[a.regra] = (porRegra[a.regra] ?? 0) + 1;
  const metros = { calcada: 0, caminho: 0, travessia: 0 };
  for (const a of m.arestas) metros[a.tipo] = (metros[a.tipo] ?? 0) + Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]);
  return {
    total: m.achados.length, porRegra, achados: m.achados, destinos: m.destinos,
    resumo: { destinos: m.destinos.length, alcancados: m.destinos.filter((d) => d.alcancado).length, travessias: m.arestas.filter((a) => a.tipo === 'travessia').length,
      metros: Object.fromEntries(Object.entries(metros).map(([k, v]) => [k, Math.round(v)])) },
  };
}
