import * as THREE from 'three';
import {
  INTERIORES, DIVISORIA, FOLGA, LUMINARIA, LUGARES_REFEITORIO, PONTE_ROLANTE, BOMBAS_INCENDIO, VIDRO_FOSCO_EM,
} from '../data/interiores.js';
import { VIDRO_FOSCO } from '../lib/predio.js';
import * as MV from '../lib/moveis.js';
import { tuboPorCaminho } from '../lib/pipe.js';
import { matCodigo } from '../equipment/tubulacao.js';
import { DN } from '../data/plant.js';
import { MAT } from '../core/materials.js';
import { TANQUE_INCENDIO } from '../data/entorno.js';
import { ETA } from '../data/agua.js';
import { BLOCOS } from '../data/site.js';

/**
 * ===========================================================================
 *  INTERIORES — salas e moveis de cada predio (Fase 16 do ROTEIRO)
 * ===========================================================================
 *  Le a casca de cada predio (lib/predio.js, `userData.interno`: vao livre,
 *  pisos, forros, portas, janelas, escada) e o programa dele
 *  (data/interiores.js), e compoe:
 *    1. as divisorias de cada pavimento, ao longo do eixo maior, com porta
 *       no meio — nunca sobre a porta do predio nem sobre a escada;
 *    2. as zonas que ninguem ocupa: 1,2 m diante de cada porta, o pe e a
 *       chegada da escada, a frente de portao e doca;
 *    3. os moveis de cada sala pelo uso, por regra: encostados na parede
 *       (fundo na parede, frente para a sala; o que e alto nao tapa janela),
 *       em grade (com a passagem entre eles) ou no meio;
 *    4. as luminarias do forro.
 *  O interior e uma unidade da fusao (uma malha por material por predio) e
 *  so aparece de perto. As paredes, lajes e divisorias viram colisores da
 *  camera; as portas do predio abrem quando a camera chega.
 *  `__auditarInteriores()` (dev/interiores.js) mede o resultado.
 */

const REBOCO = new THREE.MeshStandardMaterial({ color: 0xeeebe4, roughness: 0.92, name: 'divisoria' });
const RAIO_VISIVEL = 40;        // m da casca ate a camera para o interior aparecer
const ABRE_PORTA = 3.5;         // m da porta ate a camera para ela abrir
const ABRE_PORTA_PESSOA = 2.0;  // m da porta ate quem passa a pe [ADOTADO]

const sobrepoe = (a, b, e = 0.01) => a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.z0 < b.z1 - e && a.z1 > b.z0 + e;
const contem = (r, a, e = 0.01) => a.x0 >= r.x0 - e && a.x1 <= r.x1 + e && a.z0 >= r.z0 - e && a.z1 <= r.z1 + e;
const recuar = (r, m) => ({ x0: r.x0 + m, x1: r.x1 - m, z0: r.z0 + m, z1: r.z1 - m });
const retDe = (x0, x1, z0, z1) => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

/** As quatro paredes de uma sala, com a normal para dentro dela. */
function paredesDe(r) {
  return [
    { lado: '-z', a: [r.x0, r.z0], b: [r.x1, r.z0], n: [0, 1] },
    { lado: '+z', a: [r.x1, r.z1], b: [r.x0, r.z1], n: [0, -1] },
    { lado: '-x', a: [r.x0, r.z1], b: [r.x0, r.z0], n: [1, 0] },
    { lado: '+x', a: [r.x1, r.z0], b: [r.x1, r.z1], n: [-1, 0] },
  ].map((p) => ({ ...p, L: Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) }));
}

/** Pegada no plano de uma peca w x d no centro (x, z) com o giro dado. */
function pegada(x, z, w, d, giro) {
  const deitada = Math.abs(Math.sin(giro)) > 0.5;
  const ex = deitada ? d : w, ez = deitada ? w : d;
  return { x0: x - ex / 2, x1: x + ex / 2, z0: z - ez / 2, z1: z + ez / 2 };
}

/* ------------------------------------------------------------------------ */
/*  1 e 2. Divisao do pavimento e zonas livres                               */
/* ------------------------------------------------------------------------ */
function dividir(casca, k, programa, grupo, colisores) {
  const r = casca.ret;
  const y = casca.pisos[k], teto = casca.tetos[k];
  const aoLongoX = r.x1 - r.x0 >= r.z1 - r.z0;
  const [a0, a1] = aoLongoX ? [r.x0, r.x1] : [r.z0, r.z1];
  const [b0, b1] = aoLongoX ? [r.z0, r.z1] : [r.x0, r.x1];
  const t = DIVISORIA.espessura;
  const ao = (q) => (aoLongoX ? [q.x0, q.x1] : [q.z0, q.z1]);

  // Onde nao pode haver divisoria: a porta do predio (no terreo) e a escada
  // com o pe e a chegada dela.
  const proibidas = [];
  if (k === 0) for (const p of casca.portas) { const [d0, d1] = ao(p.vao); proibidas.push([d0 - 0.6, d1 + 0.6]); }
  if (casca.escada) { const [s0, s1] = ao(casca.escada.ret); proibidas.push([s0 - FOLGA.porta - 0.2, s1 + FOLGA.porta + 0.2]); }
  const cortes = [];
  let acum = 0;
  for (let i = 0; i < programa.length - 1; i++) {
    acum += programa[i].fracao;
    let c = a0 + acum * (a1 - a0);
    for (const [p0, p1] of proibidas) if (c > p0 && c < p1) c = c - p0 < p1 - c ? p0 : p1;
    cortes.push(c);
  }
  const limites = [a0, ...cortes, a1];
  const salas = programa.map((s, i) => {
    const s0 = limites[i] + (i ? t / 2 : 0), s1 = limites[i + 1] - (i < programa.length - 1 ? t / 2 : 0);
    const ret = aoLongoX ? { x0: s0, x1: s1, z0: b0, z1: b1 } : { x0: b0, x1: b1, z0: s0, z1: s1 };
    return { ...s, ret, y, teto, k, entradas: [], livres: [], obstaculos: [] };
  });

  // divisorias: tres caixas (dos lados do vao e a verga), que tambem colidem
  const bm = (b0 + b1) / 2, hp = DIVISORIA.porta / 2;
  const caixa = (c, u0, u1, ya, yb) => {
    const q = aoLongoX
      ? { x0: c - t / 2, x1: c + t / 2, z0: u0, z1: u1 }
      : { x0: u0, x1: u1, z0: c - t / 2, z1: c + t / 2 };
    const m = new THREE.Mesh(new THREE.BoxGeometry(q.x1 - q.x0, yb - ya, q.z1 - q.z0), REBOCO);
    m.position.set((q.x0 + q.x1) / 2, (ya + yb) / 2, (q.z0 + q.z1) / 2);
    grupo.add(m);
    colisores.push({ ...q, y0: ya, y1: yb });
  };
  cortes.forEach((c, i) => {
    caixa(c, b0, bm - hp, y, teto);
    caixa(c, bm + hp, b1, y, teto);
    caixa(c, bm - hp, bm + hp, y + DIVISORIA.alturaPorta, teto);
    // vao e zona livre dos dois lados
    const vaoRet = aoLongoX ? retDe(c - t / 2, c + t / 2, bm - hp, bm + hp) : retDe(bm - hp, bm + hp, c - t / 2, c + t / 2);
    for (const [sala, sinal] of [[salas[i], -1], [salas[i + 1], 1]]) {
      const f = c + sinal * (t / 2 + FOLGA.porta);
      const livre = aoLongoX ? retDe(c, f, bm - hp - 0.3, bm + hp + 0.3) : retDe(bm - hp - 0.3, bm + hp + 0.3, c, f);
      sala.livres.push(livre);
      sala.entradas.push({ tipo: 'divisoria', vao: vaoRet, livre, lado: lado(sala.ret, vaoRet) });
    }
  });

  // porta do predio, portoes e docas (terreo); escada (todos os pavimentos)
  const naSala = (q) => salas.filter((s) => sobrepoe(s.ret, q, -0.05));
  const frente = (q, ladoParede, fundo) => {
    // retangulo de `fundo` m para dentro do vao q, na parede `ladoParede`
    const largo = 0.3;
    if (ladoParede === '-z') return retDe(q.x0 - largo, q.x1 + largo, r.z0, r.z0 + fundo);
    if (ladoParede === '+z') return retDe(q.x0 - largo, q.x1 + largo, r.z1 - fundo, r.z1);
    if (ladoParede === '-x') return retDe(r.x0, r.x0 + fundo, q.z0 - largo, q.z1 + largo);
    return retDe(r.x1 - fundo, r.x1, q.z0 - largo, q.z1 + largo);
  };
  if (k === 0) {
    for (const p of casca.portas) {
      const livre = frente(p.vao, p.lado, FOLGA.porta);
      for (const s of naSala(livre)) {
        s.livres.push(livre);
        s.entradas.unshift({ tipo: 'predio', vao: p.vao, livre, lado: p.lado });
      }
    }
    for (const f of casca.fechados) {
      const livre = frente(f, f.lado, f.y0 > 0.5 ? FOLGA.porta + 0.3 : FOLGA.empilhadeira);
      for (const s of naSala(livre)) {
        s.livres.push(livre);
        // diante das docas fica a faixa de expedicao (uma so, de ponta a
        // ponta delas): porta-palete nao entra
        if (f.y0 > 0.5) {
          const e = frente(f, f.lado, FOLGA.expedicao), u = s.expedicao ?? e;
          s.expedicao = { x0: Math.min(u.x0, e.x0), x1: Math.max(u.x1, e.x1), z0: Math.min(u.z0, e.z0), z1: Math.max(u.z1, e.z1) };
        }
      }
    }
  }
  // portao de garagem: a baia do caminhao fica livre ate o fundo dele; ao
  // lado, a faixa de expedicao (paletes e empilhadeira), do lado oposto ao
  // da porta de pessoas
  if (k === 0) {
    for (const q of casca.garagens ?? []) {
      const baia = frente(q, q.lado, FOLGA.caminhao);
      const lados = q.lado === '+x' || q.lado === '-x'
        ? [retDe(baia.x0, baia.x1, baia.z1, baia.z1 + FOLGA.expedicao), retDe(baia.x0, baia.x1, baia.z0 - FOLGA.expedicao, baia.z0)]
        : [retDe(baia.x1, baia.x1 + FOLGA.expedicao, baia.z0, baia.z1), retDe(baia.x0 - FOLGA.expedicao, baia.x0, baia.z0, baia.z1)];
      const pv = casca.portas[0]?.vao;
      const longe = (e) => (pv ? Math.hypot((e.x0 + e.x1 - pv.x0 - pv.x1) / 2, (e.z0 + e.z1 - pv.z0 - pv.z1) / 2) : 0);
      const exp = lados.sort((a, b) => longe(b) - longe(a))[0];
      for (const s of naSala(baia)) {
        s.livres.push(baia);
        s.expedicao = exp;
      }
    }
  }
  const es = casca.escada;
  if (es) {
    const [dx, dz] = es.dir, [px, pz] = es.pe, hl = es.largura / 2 + 0.15;
    const ao2 = (u0, u1) => (dx ? retDe(px + dx * u0, px + dx * u1, pz - hl, pz + hl) : retDe(px - hl, px + hl, pz + dz * u0, pz + dz * u1));
    // a escada (no terreo) e o vao (em cima) ninguem ocupa; o pe dela fica
    // livre onde ela comeca, e a chegada onde ela termina
    for (const s of naSala(es.ret)) s.obstaculos.push(es.ret);
    if (k < casca.pisos.length - 1) {
      const pe = ao2(-FOLGA.porta - 0.15, -0.15);
      for (const s of naSala(pe)) { s.livres.push(pe); s.entradas.push({ tipo: 'escada', livre: pe }); }
    }
    if (k > 0) {
      const chegada = ao2(es.comprimento, es.comprimento + FOLGA.porta);
      for (const s of naSala(chegada)) { s.livres.push(chegada); s.entradas.push({ tipo: 'escada', livre: chegada }); }
    }
  }

  // paredes de cada sala: externa (com as janelas deste pavimento) ou nao
  for (const s of salas) {
    s.paredes = paredesDe(s.ret).map((p) => {
      const externa = (p.lado === '-z' && Math.abs(s.ret.z0 - r.z0) < 0.01) || (p.lado === '+z' && Math.abs(s.ret.z1 - r.z1) < 0.01)
        || (p.lado === '-x' && Math.abs(s.ret.x0 - r.x0) < 0.01) || (p.lado === '+x' && Math.abs(s.ret.x1 - r.x1) < 0.01);
      const janelas = !externa ? [] : casca.janelas
        .filter((j) => j.lado === p.lado && j.y1 > y && j.y0 < teto)
        .map((j) => {
          // trecho da parede (a partir de p.a) que a janela ocupa, e o peitoril
          const u = (x, z) => ((x - p.a[0]) * (p.b[0] - p.a[0]) + (z - p.a[1]) * (p.b[1] - p.a[1])) / p.L;
          const [u0, u1] = [u(j.x0, j.z0), u(j.x1, j.z1)].sort((m, n) => m - n);
          return { u0, u1, peitoril: j.y0 - y };
        })
        .filter((j) => j.u1 > 0 && j.u0 < p.L);
      return { ...p, externa, janelas, semJanela: externa && casca.semJanela.includes(p.lado) };
    });
    const ent = s.entradas[0];
    s.frente = ent?.lado ? s.paredes.find((p) => p.lado === ent.lado) : s.paredes[0];
    const oposto = { '-z': '+z', '+z': '-z', '-x': '+x', '+x': '-x' };
    s.fundo = s.paredes.find((p) => p.lado === oposto[s.frente.lado]);
    s.laterais = s.paredes.filter((p) => p !== s.frente && p !== s.fundo);
  }
  return salas;
}

/** Lado do retangulo da sala onde fica o vao q (o mais perto). */
function lado(r, q) {
  const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
  const d = { '-x': Math.abs(cx - r.x0), '+x': Math.abs(cx - r.x1), '-z': Math.abs(cz - r.z0), '+z': Math.abs(cz - r.z1) };
  return Object.keys(d).sort((a, b) => d[a] - d[b])[0];
}

/* ------------------------------------------------------------------------ */
/*  3. Regras de colocacao                                                   */
/* ------------------------------------------------------------------------ */
function contexto(sala, grupo, registro) {
  const itens = [];
  const r = sala.ret;
  const ocupado = (q, evitar = []) => !contem(recuar(r, 0.02), q)
    || sala.livres.some((l) => sobrepoe(q, l)) || sala.obstaculos.some((o) => sobrepoe(q, o))
    || evitar.some((o) => sobrepoe(q, o)) || itens.some((i) => sobrepoe(q, i.ret));

  /** Poe a peca ja feita `f` no centro (x, z) com o giro; `frente` reserva
   *  uma faixa livre na frente dela (fila do buffet, porta de cubiculo). */
  function por(f, x, z, giro, nome, frente = 0) {
    f.grupo.position.set(x, sala.y, z);
    f.grupo.rotation.y = giro;
    grupo.add(f.grupo);
    const ret = pegada(x, z, f.w, f.d, giro);
    const item = { nome, sala: sala.nome, ref: sala, ret, h: f.h, y0: f.y0 ?? 0, obj: f.grupo };
    itens.push(item);
    registro.moveis.push(item);
    // lugares de gente (Fase 20), no mundo: quem tem rotina senta ou para ali
    for (const l of f.lugares ?? []) {
      const c = Math.cos(giro), sn = Math.sin(giro);
      registro.lugares.push({ x: x + l.x * c + l.z * sn, z: z - l.x * sn + l.z * c, y: sala.y, rumo: l.rumo + giro,
        postura: l.postura, acao: l.acao, sala, movel: item });
    }
    if (frente > 0) {
      const [nx, nz] = [Math.sin(giro), Math.cos(giro)];
      const ex = f.d / 2;
      const c = [x + nx * (ex + frente / 2), z + nz * (ex + frente / 2)];
      sala.livres.push({ ...pegada(c[0], c[1], f.w, frente, giro), dono: item });
    }
    return item;
  }

  /** Encostada: o fundo da peca na parede, a frente para a sala, uma ao lado
   *  da outra com `gap` entre elas. Peca mais alta que o peitoril nao fica
   *  na frente de janela. */
  function encostar(fab, { paredes = sala.paredes, gap = 0, margem = 0.05, max = Infinity, nome, frente = 0, centrado = false, evitar = [] } = {}) {
    let n = 0;
    let f = fab();
    for (const p of paredes) {
      if (n >= max || !f) break;
      const tx = (p.b[0] - p.a[0]) / p.L, tz = (p.b[1] - p.a[1]) / p.L;
      const giro = Math.atan2(p.n[0], p.n[1]);
      const tenta = (s) => {
        const cx = p.a[0] + tx * (s + f.w / 2) + p.n[0] * (0.02 + f.d / 2);
        const cz = p.a[1] + tz * (s + f.w / 2) + p.n[1] * (0.02 + f.d / 2);
        const q = pegada(cx, cz, f.w, f.d, giro);
        const janela = p.janelas.some((j) => s + f.w > j.u0 - 0.05 && s < j.u1 + 0.05 && f.h > j.peitoril - 0.02 && (f.y0 ?? 0) < j.peitoril + 1.5);
        // a faixa livre que a peca reserva na frente dela tambem tem de estar livre
        const faixa = frente > 0 && pegada(cx + p.n[0] * (f.d / 2 + frente / 2), cz + p.n[1] * (f.d / 2 + frente / 2), f.w, frente, giro);
        if (ocupado(q, evitar) || janela || (faixa && itens.some((i) => sobrepoe(faixa, i.ret)))) return false;
        por(f, cx, cz, giro, nome, frente);
        n++;
        f = n < max ? fab() : null;
        return true;
      };
      // centrada se couber; senao, onde couber ao longo da parede
      if (centrado && tenta((p.L - f.w) / 2)) continue;
      for (let s = margem; n < max && f && s + f.w <= p.L - margem + 1e-6;) {
        const w = f.w;
        s += tenta(s) ? w + gap : 0.1;
      }
    }
    return n;
  }

  /** Na parede p, centrada nela (ou em `u` m de p.a), a `distancia` m da
   *  parede; com `virar`, a frente olha para a parede. */
  function naParede(fab, p, { distancia = 0, u = null, virar = false, nome, frente = 0 } = {}) {
    const f = fab();
    const tx = (p.b[0] - p.a[0]) / p.L, tz = (p.b[1] - p.a[1]) / p.L;
    const s = (u ?? p.L / 2) - f.w / 2;
    const cx = p.a[0] + tx * (s + f.w / 2) + p.n[0] * (0.02 + distancia + f.d / 2);
    const cz = p.a[1] + tz * (s + f.w / 2) + p.n[1] * (0.02 + distancia + f.d / 2);
    const giro = Math.atan2(p.n[0], p.n[1]) + (virar ? Math.PI : 0);
    const q = pegada(cx, cz, f.w, f.d, giro);
    if (ocupado(q)) return null;
    return por(f, cx, cz, giro, nome, frente);
  }

  /** Em grade dentro de `area`: linhas ao longo de x (giro 0/pi) ou de z
   *  (giro +-pi/2), com `dx` entre pecas e `dzs` (ciclico) entre linhas; com
   *  `alternar`, uma linha sim, outra nao, vira de frente para a outra. */
  function grade(fab, { area = recuar(r, FOLGA.passagem), dx = FOLGA.passagem, dzs = [FOLGA.passagem], giro = 0, alternar = false, max = Infinity, nome, evitar = [] } = {}) {
    let n = 0;
    let f = fab();
    // as linhas correm ao longo da largura (w) da peca — x, ou z se ela
    // estiver deitada — e a grade avanca na profundidade (d)
    const deitada = Math.abs(Math.sin(giro)) > 0.5;
    const W = f.w, D = f.d;
    const [u0, u1, v0, v1] = deitada ? [area.z0, area.z1, area.x0, area.x1] : [area.x0, area.x1, area.z0, area.z1];
    let linha = 0;
    for (let v = v0 + D / 2; v + D / 2 <= v1 + 1e-6 && n < max; v += D + dzs[(linha++) % dzs.length]) {
      const g = alternar && linha % 2 ? giro + Math.PI : giro;
      for (let u = u0 + W / 2; u + W / 2 <= u1 + 1e-6 && n < max; u += W + dx) {
        const [x, z] = deitada ? [v, u] : [u, v];
        const q = pegada(x, z, f.w, f.d, g);
        if (ocupado(q, evitar)) continue;
        por(f, x, z, g, nome);
        n++;
        f = n < max ? fab() : null;
      }
    }
    return n;
  }

  /** No meio da sala; tenta as fabricas em ordem ate uma caber. */
  function centro(fabs, { giro = 0, nome } = {}) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    for (const fab of [].concat(fabs)) {
      const f = fab();
      if (!ocupado(pegada(cx, cz, f.w, f.d, giro))) return por(f, cx, cz, giro, nome);
    }
    return null;
  }

  const lx = r.x1 - r.x0, lz = r.z1 - r.z0;
  return {
    sala, itens, encostar, naParede, grade, centro, por,
    livre: (q) => !ocupado(q),
    longoX: lx >= lz, comprimento: Math.max(lx, lz), largura: Math.min(lx, lz),
    giroLongo: lx >= lz ? 0 : Math.PI / 2,
    oposta: (p) => sala.paredes.find((q) => q.n[0] === -p.n[0] && q.n[1] === -p.n[1]),
  };
}

/* ------------------------------------------------------------------------ */
/*  Casa de bombas com coletores (Fase 18)                                   */
/* ------------------------------------------------------------------------ */
const EIXO_Y = new THREE.Vector3(0, 1, 0);
const CENTRO_ISBL = (() => { const b = BLOCOS.find((q) => q.id === 'ISBL'); return { x: (b.x[0] + b.x[1]) / 2, z: (b.z[0] + b.z[1]) / 2 }; })();
const COLETOR = 0.45;          // m da parede ao coletor de succao [ADOTADO]
const FACE = 0.9;              // m da parede a face de succao da bomba
const FORA = 0.8;              // m do lado de fora da parede ate a curva

/**
 * As bombas lado a lado, a succao virada para a parede do lado de onde vem a
 * agua (`origem`: um tanque { x, z, R }), com o coletor de succao ao longo
 * dela, na altura dos bocais; cada bomba recalca para cima ate o coletor de
 * recalque, a ~2,5 m, que sai pela parede lateral do lado do `destino` e
 * desce enterrado. Do tanque a casa, a succao corre sobre dormentes. O
 * escape do diesel sobe ate acima da laje. [ADOTADO]
 */
function casaDeBombas(c, { bombas, origem, destino, dn, codigo, servico }) {
  const s = c.sala;
  const mat = matCodigo(codigo);
  const tubo = (pts, d, nome, onde = c.externo) => {
    const m = tuboPorCaminho(pts, { dn: d, mat, raioCurva: DN[d].od * 0.8 });
    m.name = nome;
    m.userData.ficha = { titulo: nome, subtitulo: servico, grupos: [{ nome: 'Adotado', dados: { 'Diâmetro': `DN ${d}` } }] };
    onde.add(m);
    return m;
  };
  const meio = (p) => [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
  // a parede de succao e a que olha mais para a origem
  const olha = (p) => { const [mx, mz] = meio(p); const dx = origem.x - mx, dz = origem.z - mz; return (-p.n[0] * dx - p.n[1] * dz) / Math.hypot(dx, dz); };
  const P = [...s.paredes].sort((p, q) => olha(q) - olha(p))[0];
  const t = [(P.b[0] - P.a[0]) / P.L, (P.b[1] - P.a[1]) / P.L], n = P.n;
  const ponto = (u, v, y) => new THREE.Vector3(P.a[0] + t[0] * u + n[0] * v, y, P.a[1] + t[1] * u + n[1] * v);
  const emParede = (x, z) => [(x - P.a[0]) * t[0] + (z - P.a[1]) * t[1], (x - P.a[0]) * n[0] + (z - P.a[1]) * n[1]];
  const giro = Math.atan2(-n[1], n[0]);           // +x da bomba para n: a succao olha a parede
  const mundo = (f, cen, p) => new THREE.Vector3(...p).applyAxisAngle(EIXO_Y, giro).add(cen);

  const postas = [];
  let u = 0.9;
  for (const b of bombas) {
    const f = b.fab();
    const v = FACE - f.bocais.S.face[0];
    let achou = false;
    // testa com a caixa real da peca (o bocal de succao passa da base)
    const real = (cen) => {
      f.grupo.position.set(cen.x, s.y, cen.z);
      f.grupo.rotation.y = giro;
      f.grupo.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(f.grupo);
      return { x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z };
    };
    for (; u + f.d <= P.L - 0.6; u += 0.2) {
      const cen = ponto(u + f.d / 2, v, 0);
      if (c.livre(real(cen))) { achou = true; break; }
    }
    if (!achou) continue;
    const cen = ponto(u + f.d / 2, v, s.y);
    c.por(f, cen.x, cen.z, giro, b.nome);
    postas.push({ f, cen, u: u + f.d / 2, S: mundo(f, cen, f.bocais.S.face), D: mundo(f, cen, f.bocais.D.face) });
    u += f.d + 0.9;
  }
  if (!postas.length) return;
  const yS = Math.max(...postas.map((p) => p.S.y));
  const yR = s.y + Math.min(2.6, s.teto - s.y - 0.5);
  const us = postas.map((p) => p.u);

  // succao: entra pela parede P no ponto mais perto da origem
  const [un] = emParede(origem.x, origem.z);
  const ue = Math.min(P.L - 0.4, Math.max(0.4, un));
  tubo([ponto(Math.min(ue, ...us), COLETOR, yS), ponto(Math.max(ue, ...us), COLETOR, yS)], dn[0], 'Coletor de sucção', c.grupo);
  for (const p of postas) {
    // bomba mais baixa (a jockey): o ramal desce do coletor e vai reto ao bocal
    const pts = [ponto(p.u, COLETOR, yS)];
    if (Math.abs(p.S.y - yS) > 0.02) pts.push(ponto(p.u, COLETOR, p.S.y));
    pts.push(p.S);
    tubo(pts, p.f.bocais.S.dn, 'Sucção da bomba', c.grupo);
  }
  // de fora: do tanque ate a parede, sobre dormentes a cada 3 m
  const dirT = new THREE.Vector3(ponto(ue, -FORA, 0).x - origem.x, 0, ponto(ue, -FORA, 0).z - origem.z).normalize();
  const bocal = new THREE.Vector3(origem.x, yS, origem.z).addScaledVector(dirT, origem.R + 0.3);
  const [ub, vb] = emParede(bocal.x, bocal.z);
  const fora = [bocal, ponto(ue, vb, yS), ponto(ue, -FORA, yS), ponto(ue, COLETOR, yS)];
  if (Math.abs(ub - ue) < 0.05) fora.splice(1, 1);
  tubo(fora, dn[0], `Sucção — ${origem.nome}`);
  for (let i = 1; i < fora.length - 1; i++) {
    const a = fora[i - 1], b = fora[i], L = a.distanceTo(b);
    for (let k = 1; k * 3 < L; k++) {
      const q = a.clone().lerp(b, (k * 3) / L);
      const dorm = new THREE.Mesh(new THREE.BoxGeometry(0.4, yS - 0.12 - s.y + 0.15, 0.4), MAT.concreto);
      dorm.position.set(q.x, (yS - 0.12 + s.y - 0.15) / 2, q.z);
      c.externo.add(dorm);
    }
  }

  // recalque: cada bomba sobe ao coletor, que sai pela lateral do lado do destino
  const vR = emParede(postas[0].D.x, postas[0].D.z)[1];
  // pela lateral do lado do destino, menos a da porta: nela fica o letreiro,
  // e o tubo a 2,6 m o atravessaria (a linha desce enterrada logo adiante,
  // entao o lado de saida nao muda o tracado)
  const [ud] = emParede(destino.x, destino.z);
  const NORMAL = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[c.ladoPorta];
  const ehPorta = (sinal) => NORMAL && Math.abs(sinal * t[0] - NORMAL[0]) + Math.abs(sinal * t[1] - NORMAL[1]) < 0.1;
  let sinal = ud < P.L / 2 ? -1 : 1;
  if (ehPorta(sinal)) sinal = -sinal;
  const fim = sinal < 0 ? -0.2 - FORA : P.L + 0.2 + FORA;
  const uIni = fim < 0 ? Math.max(...us) : Math.min(...us);
  tubo([ponto(uIni, vR, yR), ponto(fim, vR, yR), ponto(fim, vR, s.y - 0.6)], dn[1], `Recalque — ${servico}`);
  for (const p of postas) {
    tubo([p.D, new THREE.Vector3(p.D.x, yR, p.D.z), ponto(p.u, vR, yR)], p.f.bocais.D.dn, 'Recalque da bomba', c.grupo);
  }
  // escape do diesel: do topo do tubo dele ate 1,2 m acima da laje
  for (const p of postas) {
    if (!p.f.escape) continue;
    const e = mundo(p.f, p.cen, p.f.escape);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, s.teto + 1.5 - e.y, 10), MAT.acoCarbono);
    m.position.set(e.x, (e.y + s.teto + 1.5) / 2, e.z);
    m.name = 'escape-diesel';
    c.externo.add(m);
    const chapeu = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 12), MAT.acoCarbono);
    chapeu.position.set(e.x, s.teto + 1.62, e.z);
    c.externo.add(chapeu);
  }
  // o coletor de succao ocupa a faixa junto da parede: nada encosta nela
  const faixa = ponto(P.L / 2, (COLETOR + 0.5) / 2, 0);
  s.obstaculos.push(pegada(faixa.x, faixa.z, P.L, COLETOR + 0.5, Math.abs(t[0]) > 0.5 ? 0 : Math.PI / 2));
}

/* ------------------------------------------------------------------------ */
/*  Moveis por uso                                                           */
/* ------------------------------------------------------------------------ */
const USOS = {
  controle(c) {
    const s = c.sala;
    // o videowall na parede cega, a que olha o processo; o console de frente
    // para ele, a 2,6 m, com uma posicao de operador a cada 1,6 m
    const W = s.paredes.find((p) => p.semJanela) ?? s.fundo;
    c.naParede(() => MV.criarVideowall({ L: Math.min(W.L - 1.5, 6), H: 1.4 }), W, { nome: 'Videowall' });
    const pos = Math.max(1, Math.min(4, Math.floor((W.L - 2) / 1.6)));
    c.naParede(() => MV.criarConsole({ posicoes: pos }), W, { distancia: 2.6, nome: 'Console de operação' });
    c.encostar(() => MV.criarArmario(), { paredes: [c.oposta(W), ...s.laterais], gap: 0.1, max: 3, nome: 'Armário' });
  },
  reuniao(c) {
    const s = c.sala;
    const L = Math.min(4, c.comprimento - 2.8), W = Math.min(1.2, c.largura - 3.0);
    c.centro([1, 0.85, 0.7].map((k) => () => MV.criarMesaReuniao({ L: Math.max(1.4, L * k), W: Math.max(0.9, W) })), { giro: c.giroLongo, nome: 'Mesa de reunião' });
    c.naParede(() => MV.criarQuadro({ L: Math.min(2, s.fundo.L - 1) }), s.fundo, { nome: 'Quadro branco' });
    c.encostar(() => MV.criarArmario(), { paredes: s.laterais, max: 2, gap: 0.1, nome: 'Armário' });
  },
  laboratorio(c) {
    const s = c.sala;
    c.encostar(() => MV.criarCapela(), { paredes: [s.fundo, ...s.laterais], gap: 0.3, max: 2, nome: 'Capela de exaustão' });
    let pia = true;
    const bancada = (prateleira) => () => { const b = MV.criarBancadaLab({ L: 1.8, pia, prateleira }); pia = false; return b; };
    // com prateleira longe das janelas; sem prateleira, embaixo delas
    c.encostar(bancada(true), { gap: 0, nome: 'Bancada' });
    c.encostar(bancada(false), { gap: 0, nome: 'Bancada' });
    if (c.largura >= 0.75 * 2 + FOLGA.passagem * 2 + 1.5) {
      c.centro([3.6, 3, 2.4, 1.8].map((L) => () => MV.criarIlhaLab({ L })), { giro: c.giroLongo, nome: 'Bancada central' });
    }
  },
  reagentes(c) {
    c.encostar(() => MV.criarArmario({ cor: 'branco' }), { gap: 0.05, nome: 'Armário de reagentes' });
    c.encostar(() => MV.criarBancadaLab({ L: 1.2, prateleira: false }), { nome: 'Bancada' });
  },
  oficina(c) {
    const s = c.sala;
    c.encostar(() => MV.criarBancadaOficina({ L: 2 }), { paredes: [s.fundo, ...s.laterais], gap: 0.8, nome: 'Bancada de oficina' });
    const meio = recuar(s.ret, 2.6);
    c.grade(() => MV.criarTorno(), { area: meio, max: 1, giro: c.giroLongo, nome: 'Torno mecânico' });
    c.grade(() => MV.criarFuradeira(), { area: meio, max: 2, giro: c.giroLongo, dx: 1.5, nome: 'Furadeira de coluna' });
    // ponte rolante so sobre a oficina, correndo ao longo do eixo maior
    const vao = c.longoX ? s.ret.z1 - s.ret.z0 : s.ret.x1 - s.ret.x0;
    const pr = MV.criarPonteRolante({ vao, trilho: c.comprimento - 0.3, y: s.teto - s.y - PONTE_ROLANTE.abaixoDoTeto });
    pr.grupo.position.set((s.ret.x0 + s.ret.x1) / 2, s.y, (s.ret.z0 + s.ret.z1) / 2);
    // a viga atravessa o eixo menor: com a sala comprida em x, gira 90°
    pr.grupo.rotation.y = c.longoX ? Math.PI / 2 : 0;
    c.grupoPonte = pr.grupo;
  },
  almoxarifado(c) {
    c.encostar(() => MV.criarEstante(), { gap: 0, nome: 'Estante' });
    c.grade(() => MV.criarEstante(), { area: recuar(c.sala.ret, 0.5 + FOLGA.passagem), dx: 0, dzs: [FOLGA.passagem + 0.2], giro: c.giroLongo, nome: 'Estante' });
  },
  armazem(c) {
    const s = c.sala;
    const exp = s.expedicao ? [s.expedicao] : [];
    // porta-paletes costas com costas, corredor de empilhadeira entre os pares
    c.grade(() => MV.criarPortaPalete(), {
      area: recuar(s.ret, 0.3), dx: 0, dzs: [0.2, FOLGA.empilhadeira], alternar: true, giro: c.giroLongo + Math.PI, evitar: exp, nome: 'Porta-palete',
    });
    if (s.expedicao) {
      const area = recuar(s.expedicao, 0.4);
      // estacionada ao longo das docas ou de frente para elas, o que couber
      // a empilhadeira anda (Fase 21: leva palete ao bau), fora da fusao
      const anda = () => { const e = MV.criarEmpilhadeira(); e.grupo.userData.animar = true; return e; };
      if (!c.grade(anda, { area, max: 1, dx: 1, nome: 'Empilhadeira' })) {
        c.grade(anda, { area, max: 1, dx: 1, giro: Math.PI / 2, nome: 'Empilhadeira' });
      }
      c.grade(() => MV.criarPaleteSacaria({ camadas: 6 }), { area, dx: 0.6, dzs: [0.6], max: 10, nome: 'Palete de sacaria' });
    }
  },
  ambulatorio(c) {
    const s = c.sala;
    c.encostar(() => MV.criarMaca(), { paredes: [s.fundo, ...s.laterais], gap: 0.9, max: 2, nome: 'Maca' });
    c.encostar(() => MV.criarBancadaLab({ L: 1.2, pia: true, prateleira: false }), { max: 1, nome: 'Pia' });
    c.encostar(() => MV.criarArmario({ cor: 'branco' }), { gap: 0.1, max: 2, nome: 'Armário de medicamentos' });
    c.encostar(() => MV.criarEstacao(), { max: 1, nome: 'Mesa de atendimento' });
  },
  brigada(c) {
    c.encostar(() => MV.criarArmario({ cor: 'vermelho' }), { gap: 0.1, max: 6, nome: 'Armário de EPI' });
    c.centro([2.4, 1.8, 1.4].map((L) => () => MV.criarMesaReuniao({ L, W: 0.9 })), { giro: c.giroLongo, nome: 'Mesa' });
    c.naParede(() => MV.criarQuadro({ L: 1.6 }), c.sala.fundo, { nome: 'Quadro de ocorrências' });
  },
  recepcao(c) {
    const s = c.sala;
    // o balcao olha a porta do predio, a 3 m dela
    const ent = s.entradas.find((e) => e.tipo === 'predio');
    if (ent) {
      const p = s.frente;
      const u = ((ent.vao.x0 + ent.vao.x1) / 2 - p.a[0]) * ((p.b[0] - p.a[0]) / p.L) + ((ent.vao.z0 + ent.vao.z1) / 2 - p.a[1]) * ((p.b[1] - p.a[1]) / p.L);
      c.naParede(() => MV.criarRecepcao({ L: 2.4 }), p, { distancia: 3.0, u, virar: true, nome: 'Balcão de recepção' });
    }
    c.encostar(() => MV.criarLongarina({ n: 3 }), { paredes: s.laterais, gap: 0.6, max: 3, nome: 'Longarina de espera' });
  },
  arquivo(c) {
    c.encostar(() => MV.criarArmario(), { gap: 0.05, max: 10, nome: 'Arquivo' });
    c.encostar(() => MV.criarEstante({ L: 1.0, d: 0.4, h: 1.0, niveis: 3 }), { gap: 0, nome: 'Estante baixa' });
  },
  escritorio(c) {
    c.encostar(() => MV.criarArmario(), { paredes: [c.sala.fundo], gap: 0.05, max: 4, nome: 'Armário' });
    // estacoes em ilhas: duas linhas de costas uma para a outra, corredor
    // entre as ilhas
    c.grade(() => MV.criarEstacao(), {
      area: recuar(c.sala.ret, FOLGA.passagem), dx: 0, dzs: [0, FOLGA.passagem + 0.3], alternar: true, giro: c.giroLongo + Math.PI,
      max: c.sala.postos ?? Infinity, nome: 'Estação de trabalho',
    });
  },
  refeitorio(c) {
    const s = c.sala;
    c.encostar(() => MV.criarBuffet({ L: Math.min(5, s.fundo.L - 2) }), { paredes: [s.fundo, ...s.laterais], centrado: true, max: 1, frente: 1.5, nome: 'Buffet' });
    c.grade(() => MV.criarMesaRefeitorio(), {
      area: recuar(s.ret, 1.0), dx: 0.9, dzs: [0.9], giro: c.giroLongo, max: Math.ceil(LUGARES_REFEITORIO / 6), nome: 'Mesa',
    });
  },
  vestiario(c) {
    const s = c.sala;
    // NR-24: um chuveiro para cada 10 trabalhadores do turno
    const n = Math.ceil(LUGARES_REFEITORIO / 10);
    c.encostar(() => MV.criarChuveiros({ n }), { paredes: [s.fundo, ...s.laterais, s.frente], centrado: true, max: 1, frente: 1.0, nome: 'Chuveiros' });
    c.encostar(() => MV.criarArmariosVestiario({ L: 2.4 }), { gap: 0.1, nome: 'Armários' });
    c.grade(() => MV.criarBanco({ L: 2 }), { area: recuar(s.ret, 1.8), dx: 1.0, dzs: [1.6], giro: c.giroLongo, max: 4, nome: 'Banco' });
  },
  'bombas-incendio'(c) {
    const tq = c.objeto(TANQUE_INCENDIO.id).position;
    casaDeBombas(c, {
      bombas: BOMBAS_INCENDIO.map((b) => ({ nome: b.nome, fab: () => MV.criarMotobomba({ ...b, incendio: true }) })),
      origem: { x: tq.x, z: tq.z, R: TANQUE_INCENDIO.D / 2, nome: TANQUE_INCENDIO.id },
      destino: c.centroProcesso, dn: [250, 200], codigo: 'AI', servico: 'rede de hidrantes',
    });
    c.encostar(() => MV.criarPainel({ L: 1.6 }), { max: 1, frente: 1.0, nome: 'Painel das bombas' });
  },
  cubiculos(c) {
    const s = c.sala;
    const paredes = [s.fundo, ...s.laterais].sort((a, b) => b.L - a.L);
    const n = Math.min(8, Math.floor((paredes[0].L - 1.6) / 0.8));
    c.encostar(() => MV.criarCubiculos({ n }), { paredes, centrado: true, max: 1, frente: 1.5, nome: 'Cubículos de média tensão' });
    c.encostar(() => MV.criarPainel({ L: 1.2 }), { max: 2, gap: 0.2, frente: 1.0, nome: 'Quadro de baixa tensão' });
  },
  'quimica-eta'(c) {
    const rs = c.objeto('eta-reservatorio').position;
    casaDeBombas(c, {
      bombas: ['Bomba de água tratada — torre', 'Bomba de água tratada — caldeira', 'Bomba de água tratada — castelo']
        .map((nome) => ({ nome, fab: () => MV.criarMotobomba({ potencia: 7.5, rotor: 0.12, dn: [80, 65] }) })),
      origem: { x: rs.x, z: rs.z, R: ETA.reservatorioD / 2 + 0.5, nome: 'reservatório de água tratada' },
      destino: c.objeto('torre').position, dn: [100, 80], codigo: 'AT', servico: 'torre, caldeira e castelo',
    });
    // o painel antes da dosagem: ele precisa de 1 m livre na frente, ela nao
    c.encostar(() => MV.criarPainel({ L: 1.2 }), { max: 1, frente: 1.0, nome: 'Painel da ETA' });
    c.encostar(() => MV.criarDosagem(), { max: 1, nome: 'Dosagem de cloro' });
  },
  'quimica-ete'(c) {
    c.encostar(() => MV.criarSoprador(), { max: 2, gap: 0.6, frente: 0.8, nome: 'Soprador da aeração' });
    c.encostar(() => MV.criarDosagem(), { max: 2, gap: 0.3, nome: 'Dosagem (nutrientes, pH)' });
    c.encostar(() => MV.criarPainel({ L: 1.2 }), { max: 1, frente: 1.0, nome: 'Painel da ETE' });
  },
};

/** Troca o vidro das janelas desta sala (as da fachada no trecho dela) por fosco. */
function foscar(predio, s) {
  const p = new THREE.Vector3();
  predio.updateWorldMatrix(true, true);
  predio.traverse((m) => {
    if (!m.isMesh || m.material?.name !== 'vidro-janela') return;
    m.getWorldPosition(p);
    if (p.x > s.ret.x0 - 0.5 && p.x < s.ret.x1 + 0.5 && p.z > s.ret.z0 - 0.5 && p.z < s.ret.z1 + 0.5 && p.y > s.y && p.y < s.teto) m.material = VIDRO_FOSCO;
  });
}

/* ------------------------------------------------------------------------ */
/*  4. Luminarias                                                            */
/* ------------------------------------------------------------------------ */
function luminarias(sala, grupo, galpao) {
  const passo = galpao ? LUMINARIA.galpao : LUMINARIA.passo;
  const r = recuar(sala.ret, passo / 2);
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / passo) + 1), nz = Math.max(1, Math.round((r.z1 - r.z0) / passo) + 1);
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const l = MV.criarLuminaria({ galpao });
      const x = nx > 1 ? r.x0 + (i * (r.x1 - r.x0)) / (nx - 1) : (r.x0 + r.x1) / 2;
      const z = nz > 1 ? r.z0 + (k * (r.z1 - r.z0)) / (nz - 1) : (r.z0 + r.z1) / 2;
      // embutida no forro; no galpao, pendurada 1,25 m abaixo da telha
      l.grupo.position.set(x, sala.teto - (galpao ? l.h : 0.004), z);
      grupo.add(l.grupo);
    }
  }
}

/* ------------------------------------------------------------------------ */
export function criarInteriores({ entorno }) {
  const interiores = [];
  const colisores = [];
  const portas = [];
  const externo = new THREE.Group();
  externo.name = 'tubulacao-utilidades';
  entorno.grupo.add(externo);
  for (const o of entorno.objetos) {
    colisores.push(...(o.grupo.userData.colisores ?? []));
    const casca = o.grupo.userData.interno;
    if (!casca) continue;
    portas.push(...o.grupo.userData.portas);
    const programa = INTERIORES[o.bloco];
    if (!programa) continue;
    const grupo = new THREE.Group();
    grupo.name = 'interior';
    grupo.userData.unidade = true;                 // fundido a parte, para acender e apagar
    const registro = { predio: o.nome, bloco: o.bloco, ret: casca.ret, salas: [], moveis: [], colisores: [], lugares: [] };
    programa.forEach((salasDoPiso, k) => {
      const salas = dividir(casca, k, salasDoPiso, grupo, registro.colisores);
      for (const s of salas) {
        const c = contexto(s, grupo, registro);
        // o que fica fora do predio (tubo ate o tanque, escape no telhado)
        // vai num grupo do entorno, que nao se apaga de longe — no proprio
        // predio, ele esticaria a caixa do predio ate o tanque
        c.grupo = grupo;
        c.externo = externo;
        c.objeto = (nome) => entorno.objetos.find((x) => x.nome === nome)?.grupo;
        c.centroProcesso = CENTRO_ISBL;
        c.ladoPorta = casca.porta;
        USOS[s.uso]?.(c);
        if (c.grupoPonte) grupo.add(c.grupoPonte);
        if (VIDRO_FOSCO_EM.includes(s.uso)) foscar(o.grupo, s);
        luminarias(s, grupo, casca.galpao);
        registro.salas.push(s);
      }
    });
    grupo.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    o.grupo.add(grupo);
    // lugar de gente que caiu dentro de OUTRO movel (um vizinho posto depois
    // por cima da frente da mesa) nao serve: a pessoa chegaria dentro dele.
    // Mesma regra da auditoria de rotinas: 5 cm para dentro, mesmo piso.
    registro.lugares = registro.lugares.filter((l) => !registro.moveis.some((m) => m !== l.movel
      && Math.abs(m.ref.y - l.y) < 1 && l.x > m.ret.x0 + 0.05 && l.x < m.ret.x1 - 0.05 && l.z > m.ret.z0 + 0.05 && l.z < m.ret.z1 - 0.05));
    colisores.push(...registro.colisores);
    interiores.push({ predio: o.grupo, grupo, registro, casca });
  }

  /* So de perto: o interior acende quando a camera chega a RAIO_VISIVEL m
   * da casca (dentro, a distancia e zero). As portas abrem com a camera a
   * ABRE_PORTA m e fecham quando ela se afasta. */
  const angulos = new Map();
  /** Devolve se a camera esta dentro de algum predio (quem chama desliga o
   *  pos-processamento la dentro). */
  function atualizar(camera, dt, gente = []) {
    const p = camera.position;
    let dentro = false;
    for (const it of interiores) {
      const r = it.casca.ret;
      const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1), dz = Math.max(r.z0 - p.z, 0, p.z - r.z1);
      it.grupo.visible = Math.hypot(dx, dz) < RAIO_VISIVEL;
      if (!dx && !dz && p.y > it.casca.pisos[0] && p.y < it.casca.tetos.at(-1)) dentro = true;
    }
    for (const porta of portas) {
      // abre para a camera e para quem passa a pe (Fase 20: `gente`, as
      // posicoes de quem tem rotina)
      const perto = p.distanceTo(porta.centro) < ABRE_PORTA
        || gente.some((q) => Math.hypot(q.x - porta.centro.x, q.z - porta.centro.z) < ABRE_PORTA_PESSOA);
      const alvo = perto ? THREE.MathUtils.degToRad(80) : 0;
      let a = angulos.get(porta) ?? 0;
      if (a === alvo) continue;
      a += Math.sign(alvo - a) * Math.min(Math.abs(alvo - a), 2.4 * dt);
      angulos.set(porta, a);
      for (const f of porta.folhas) f.pivo.rotation.y = f.sinal * a;
    }
    return dentro;
  }

  return { interiores, colisores, portas, atualizar };
}
