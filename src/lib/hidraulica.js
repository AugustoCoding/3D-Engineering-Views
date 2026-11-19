import { CORRENTES, LINHAS, PRESSAO, UTILIDADES } from '../data/pid.js';
import { DN } from '../data/plant.js';
import { TRECHOS, RAMAIS, CABECAIS } from '../data/rotas.js';
import { LINHAS_OSBL, RAMAIS_OSBL } from '../data/pipeways.js';
import {
  R_GAS, G, MASSA_MOLAR, DIPPR105, AGUA_TILTON, RHO_CRISTAL_AB, DIPPR101_MU_TOL, VOGEL_AGUA,
  ANTOINE, PV_AB_PONTOS, MMHG, CONDICAO_UTILIDADE, DUAS_FASES, ESPESSURA, SCHEDULE, RUGOSIDADE,
  ACESSORIOS, FAIXAS, API14E_C, NPSH_REQUERIDO, MARGEM_NPSH, PRESSAO_SUCCAO, SATURADOS,
} from '../data/fluidos.js';

/**
 * ===========================================================================
 *  HIDRAULICA  (Fase 23)
 * ===========================================================================
 *  As contas de velocidade, perda de carga e NPSH, com os numeros de
 *  data/fluidos.js. A velocidade sai so dos dados (corrente, DN, material,
 *  servico do trecho): roda tambem no Node. O NPSH precisa do 3D — a cota da
 *  superficie (a malha de liquido, que sai de nivelDeVolume), a do bocal de
 *  succao da bomba e o comprimento da linha tracada.
 *
 *  Quem usa: equipment/tubulacao.js e site/pipeways.js calculam o NPSH ao
 *  montar a succao de cada bomba (eles tem o 3D); dev/hidraulica.js mede
 *  (__auditarHidraulica). Nada disso vai para a ficha: pedido do autor, a
 *  informacao tecnica vai no relatorio final.
 * ===========================================================================
 */

const K = (t) => t + 273.15;
const LINHA = new Map(LINHAS.map((l) => [l.numero, l]));
const ehBomba = (tag) => /^(BC|BD|BT|BAR)-/.test(tag);

/* ------------------------------------------------------------ propriedades */
const dippr105 = (c, T) => c.C1 / c.C2 ** (1 + (1 - T / c.C3) ** c.C4);          // kmol/m³
export function rhoPuro(comp, t) {
  if (comp === 'h2o') {
    const a = AGUA_TILTON;
    return 1000 * (1 - ((t + a.a) * (t - a.b) ** 2) / (a.c * (t + a.d)));
  }
  return dippr105(DIPPR105[comp], K(t)) * MASSA_MOLAR[comp];
}
export function pvPuro(comp, t) {
  if (comp === 'ab') {
    const [[t1, p1], [t2, p2]] = PV_AB_PONTOS;
    const B = Math.log(p2 / p1) / (1 / K(t1) - 1 / K(t2));
    return Math.exp(Math.log(p1) + B * (1 / K(t1) - 1 / K(t))) * MMHG;
  }
  const a = ANTOINE[comp];
  return 10 ** (a.A - a.B / (t + a.C)) * MMHG;
}
function muTolueno(t) {
  const c = DIPPR101_MU_TOL, T = K(t);
  return Math.exp(c.C1 + c.C2 / T + c.C3 * Math.log(T) + c.C4 * T ** c.C5);
}
const muAgua = (t) => Math.exp(VOGEL_AGUA.A + VOGEL_AGUA.B / (K(t) - VOGEL_AGUA.C)) * 1e-3;

/** Pressao de vapor (Pa) do liquido da corrente: Raoult na fase organica
 *  (tolueno e acido benzoico), mais a da agua se houver agua — tolueno e
 *  agua nao se misturam, e cada fase poe a sua pressao inteira. */
export function pressaoDeVapor(c) {
  const ntol = c.tol / MASSA_MOLAR.tol, nab = c.ab / MASSA_MOLAR.ab;
  const org = ntol + nab > 0 ? (ntol * pvPuro('tol', c.T) + nab * pvPuro('ab', c.T)) / (ntol + nab) : 0;
  return org + (c.h2o > 0 ? pvPuro('h2o', c.T) : 0);
}

/** Propriedades da corrente c (kg/h, °C, bar) na fase pedida:
 *  'liquido' (tolueno, acido benzoico e agua; o gas dissolvido nao conta),
 *  'gas' (gas ideal com a massa molar da mistura), 'torta' (cristal mais o
 *  tolueno que a molha). Devolve rho, mu, pv e a vazao em massa dessa fase. */
export function propriedades(c, fase = 'liquido') {
  if (fase === 'gas') {
    const comps = Object.keys(MASSA_MOLAR).filter((k) => c[k] > 0);
    const m = comps.reduce((s, k) => s + c[k], 0);
    const n = comps.reduce((s, k) => s + c[k] / MASSA_MOLAR[k], 0);
    return { rho: (c.P * 1e5 * (m / n)) / (R_GAS * K(c.T)), m, mu: null, pv: null };
  }
  const comps = ['tol', 'ab', 'h2o'].filter((k) => c[k] > 0);
  const m = comps.reduce((s, k) => s + c[k], 0);
  const rhoAb = fase === 'torta' ? RHO_CRISTAL_AB : rhoPuro('ab', c.T);
  const inv = comps.reduce((s, k) => s + c[k] / m / (k === 'ab' ? rhoAb : rhoPuro(k, c.T)), 0);
  const mu = c.h2o > 0.5 * m ? muAgua(c.T) : muTolueno(c.T);
  return { rho: 1 / inv, m, mu, pv: pressaoDeVapor(c) };
}

/* ------------------------------------------------------------ tubo */
/** Diametro interno (m) pelo schedule da especificacao. */
export function diametroInterno(dn, material) {
  const sch = (SCHEDULE[material] ?? SCHEDULE.CS40)(dn);
  const t = ESPESSURA[sch][dn];
  if (!DN[dn] || t == null) return null;
  return { di: DN[dn].od - (2 * t) / 1000, sch };
}
const area = (di) => (Math.PI * di * di) / 4;
// os DN da planta, do menor ao maior: o "logo abaixo" de LINHA_LENTA
const DNS = Object.keys(DN).map(Number).filter((d) => ESPESSURA['40'][d] != null).sort((a, b) => a - b);

/** Fator de atrito de Darcy, Churchill (1977): laminar, transicao e
 *  turbulento numa formula so. */
export function fatorAtrito(Re, eD) {
  const A = (2.457 * Math.log(1 / ((7 / Re) ** 0.9 + 0.27 * eD))) ** 16;
  const B = (37530 / Re) ** 16;
  return 8 * ((8 / Re) ** 12 + 1 / (A + B) ** 1.5) ** (1 / 12);
}
/** Turbulencia plena (o fT do Crane TP-410), von Karman. */
const fTurbulento = (eD) => 0.25 / Math.log10(eD / 3.7) ** 2;

/* ------------------------------------------------------------ correntes */
/** A corrente que passa no trecho: a do proprio trecho (19, 21), a da
 *  linha, ou — na linha com sufixo (05A, 09A, 24A, 29A), que e a mesma
 *  corrente depois da bomba ou da valvula — a da linha-mae. */
export function correnteDoTrecho(t) {
  if (t.corrente) return t.corrente;
  const L = LINHA.get(t.linha);
  const daLinha = (l) => l?.corrente?.split('→').map((s) => s.trim()).pop() ?? null;
  return daLinha(L) ?? daLinha(LINHA.get(String(t.linha).replace(/A$/, '')));
}
const tagDe = (ponta) => (typeof ponta === 'string' ? ponta.split(/[.@]/)[0] : null);
const bocalDe = (ponta) => (typeof ponta === 'string' && ponta.includes('.') ? ponta.split('.')[1] : null);

/** O servico do trecho, que escolhe a faixa de velocidade. */
export function servicoDoTrecho(t, L, S) {
  const para = typeof t.para === 'string' ? t.para : '';
  const de = typeof t.de === 'string' ? t.de : '';
  if (S && DUAS_FASES[S]) return 'duasFases';
  if (['AR', 'MRV', 'VAC'].includes(L?.fluido) || t.vapor) return 'gas';
  if (L?.fluido === 'TORTA-AB' || /^BD-.*\.S$/.test(para) || /^BD-.*\.D$/.test(de)) return 'torta';
  if (t.queda || /^F-0\d\.N1$/.test(para)) return 'suspensao';
  if (ehBomba(tagDe(para)) && bocalDe(para) === 'S') return 'succao';
  return 'liquido';
}

/** Vazao volumetrica (m³/s) e densidade de mistura da corrente S na fase do
 *  servico. Duas fases: o vapor e a corrente que o vaso a jusante separa. */
function vazaoDaCorrente(S, servico) {
  const c = CORRENTES[S];
  if (!c) return null;
  if (servico === 'duasFases') {
    const cv = { ...CORRENTES[DUAS_FASES[S].vapor], T: c.T, P: c.P };
    const cl = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, ['T', 'P'].includes(k) ? v : Math.max(0, v - (cv[k] ?? 0))]));
    const pv = propriedades(cv, 'gas'), pl = propriedades(cl, 'liquido');
    const Q = (pv.m / pv.rho + pl.m / pl.rho) / 3600;
    return { Q, rho: (pv.m + pl.m) / 3600 / Q, m: pv.m + pl.m, mu: pl.mu, pv: pl.pv, c,
      nota: `${Math.round(pv.m).toLocaleString('pt-BR').replace(/\./g, ' ')} kg/h de vapor (${DUAS_FASES[S].vapor})` };
  }
  const p = propriedades(c, servico === 'gas' ? 'gas' : servico === 'torta' ? 'torta' : 'liquido');
  return { Q: p.m / p.rho / 3600, rho: p.rho, m: p.m, mu: p.mu, pv: p.pv, c };
}

/** Vazao de utilidade (string do Quadro B9 ou do cabecal) para kg/h. */
function numeroDe(txt) {
  const m = String(txt).match(/([\d\s.,]+)\s*(m³\/h|kg\/h)/);
  if (!m) return null;
  return { valor: Number(m[1].replace(/[\s.]/g, '').replace(',', '.')), unidade: m[2] };
}
export function correnteDeUtilidade(fluido, vazaoTxt, ponta = null) {
  const n = numeroDe(vazaoTxt);
  if (!n) return null;
  const cond = CONDICAO_UTILIDADE[ponta ?? fluido] ?? CONDICAO_UTILIDADE[fluido];
  const kgh = n.unidade === 'm³/h' ? n.valor * rhoPuro('h2o', cond.T) : n.valor;
  return { tol: 0, o2: 0, n2: 0, ab: 0, h2o: kgh, total: kgh, T: cond.T, P: cond.P };
}

/* ------------------------------------------------------------ velocidade */
/** Faixa do servico, com o maximo de erosao da API RP 14E quando valer. */
export function faixaDe(servico, rho) {
  const f = FAIXAS[servico];
  const erosao = f.erosao ? (1.2199 * API14E_C) / Math.sqrt(rho) : Infinity;
  return { ...f, max: Math.min(f.max, erosao), porErosao: erosao < f.max };
}

/** Avalia a velocidade de um escoamento: vazao (m³/s), DN, material,
 *  servico. Diz se esta acima da faixa, abaixo (e se o DN logo abaixo
 *  caberia) e de quanto. */
export function avaliar({ Q, rho, dn, material, servico }) {
  const tubo = diametroInterno(dn, material);
  if (!tubo) return null;
  const v = Q / area(tubo.di);
  const faixa = faixaDe(servico, rho);
  const rapida = v > faixa.max;
  let lenta = faixa.min != null && v < faixa.min;
  if (lenta) {
    // so e defeito se havia DN menor em que ainda coubesse
    const menor = DNS.filter((d) => d < dn).at(-1);
    const tm = menor && diametroInterno(menor, material);
    lenta = !!tm && Q / area(tm.di) <= faixa.max;
  }
  return { v, di: tubo.di, sch: tubo.sch, faixa, rapida, lenta };
}

/** Velocidade num trecho de processo (entrada de TRECHOS). */
export function velocidadeDoTrecho(t) {
  const L = LINHA.get(t.linha);
  const S = correnteDoTrecho(t);
  if (!L || !S) return { semVazao: true, linha: t.linha, motivo: 'a linha não tem corrente no balanço (vácuo dos filtros)' };
  const servico = servicoDoTrecho(t, L, S);
  const q = vazaoDaCorrente(S, servico);
  const r = avaliar({ Q: q.Q, rho: q.rho, dn: L.dn, material: L.material, servico });
  return { ...r, linha: t.linha, corrente: S, servico, rho: q.rho, Q: q.Q, m: q.m, dn: L.dn, material: L.material, nota: q.nota };
}

/** Velocidade num ramal de utilidade (entrada de RAMAIS) de DN dado. */
export function velocidadeDoRamal(r, dn) {
  const cab = CABECAIS.find((c) => c.id === r.cabecal);
  const tag = tagDe(r.de);
  const u = UTILIDADES.find((x) => x.equip === tag);
  if (!u || !dn) return { semVazao: true, linha: r.linha ?? `${r.cabecal} ${tag}`, motivo: u ? 'sem DN fora do 3D' : `sem vazão de ${cab.fluido} para o ${tag} no Quadro B9` };
  // o condensado tem a vazao do vapor que entrou
  const c = correnteDeUtilidade(cab.fluido, u.vazao, r.cabecal);
  const servico = { CW: 'agua', STM: 'vapor', COND: 'condensado' }[cab.fluido];
  const p = propriedades(c, servico === 'vapor' ? 'gas' : 'liquido');
  const r2 = avaliar({ Q: p.m / p.rho / 3600, rho: p.rho, dn, material: 'CS40', servico });
  return { ...r2, linha: r.linha ?? `${r.cabecal} ${tag}`, servico, rho: p.rho, Q: p.m / p.rho / 3600, m: p.m, dn, material: 'CS40',
    nota: `${u.vazao} (Quadro B9), ${CONDICAO_UTILIDADE[r.cabecal]?.T ?? c.T} °C` };
}

/** Velocidade num cabecal ou linha de utilidade, com a vazao inteira (o
 *  comeco dele, onde ela e maior). */
function velocidadeDeUtilidade(id, fluido, dn, vazaoTxt, servico) {
  const c = correnteDeUtilidade(fluido, vazaoTxt, id);
  const p = propriedades(c, servico === 'vapor' ? 'gas' : 'liquido');
  const r = avaliar({ Q: p.m / p.rho / 3600, rho: p.rho, dn, material: 'CS40', servico });
  return { ...r, linha: id, servico, rho: p.rho, Q: p.m / p.rho / 3600, m: p.m, dn, material: 'CS40', nota: `${vazaoTxt}, vazão inteira` };
}
const SERVICO_UTILIDADE = { CW: 'agua', STM: 'vapor', COND: 'condensado' };

/**
 * Todos os trechos com vazao conhecida: processo (TRECHOS), ramais e
 * cabecais de utilidade, e o que corre fora do limite de bateria. So dados:
 * roda no Node. `dnDoRamal(r)` da o DN do ramal sem numero de linha (o do
 * bocal, que so o 3D conhece); sem ele, o ramal fica de fora, anotado.
 */
export function velocidades({ dnDoRamal = null } = {}) {
  const out = [];
  TRECHOS.forEach((t, i) => out.push({ id: `t${i}`, onde: `${t.de} → ${t.para}`, ...velocidadeDoTrecho(t) }));
  RAMAIS.forEach((r, i) => {
    const dn = r.linha ? LINHA.get(r.linha)?.dn : dnDoRamal?.(r);
    out.push({ id: `r${i}`, onde: `${r.de} ↔ ${r.cabecal}`, ...velocidadeDoRamal(r, dn) });
  });
  for (const c of CABECAIS) out.push({ id: `cab-${c.id}`, onde: `cabeçal ${c.id}`, ...velocidadeDeUtilidade(c.id, c.fluido, c.dn, c.vazao, SERVICO_UTILIDADE[c.fluido]) });
  // fora do limite de bateria: as linhas do P&ID que continuam (27, 28, 30)
  // e as succoes e descargas das bombas de fora
  for (const l of LINHAS_OSBL) {
    const L = LINHA.get(l.linha);
    if (L) { out.push({ id: `osbl-${l.linha}`, onde: `fora do limite: ${l.corredor}`, ...velocidadeDoTrecho({ linha: l.linha, de: 'LB', para: l.ate }) }); continue; }
    const cab = CABECAIS.find((c) => c.id === l.linha);
    if (cab) { out.push({ id: `osbl-${l.linha}`, onde: `fora do limite: ${l.corredor}`, ...velocidadeDeUtilidade(cab.id, cab.fluido, cab.dn, cab.vazao, SERVICO_UTILIDADE[cab.fluido]) }); continue; }
    out.push({ id: `osbl-${l.linha}`, onde: `fora do limite: ${l.corredor}`, semVazao: true, linha: l.linha, motivo: 'vazão da bomba do caminhão não está nos dados' });
  }
  for (const r of RAMAIS_OSBL) {
    const L = LINHA.get(r.linha);
    const base = { id: `osbl-${r.id}`, onde: r.servico };
    if (L) {
      const servico = r.succao ? 'succao' : servicoDoTrecho({ linha: r.linha, de: r.de, para: r.para }, L, L.corrente);
      const q = vazaoDaCorrente(L.corrente, servico);
      out.push({ ...base, ...avaliar({ Q: q.Q, rho: q.rho, dn: r.dn, material: 'CS40', servico }), linha: r.id, corrente: L.corrente, servico, rho: q.rho, Q: q.Q, m: q.m, dn: r.dn, material: 'CS40' });
      continue;
    }
    const cab = CABECAIS.find((c) => c.id === r.linha);
    if (cab && cab.fluido === 'CW') {
      // cada bomba da torre leva a vazao inteira (a outra e reserva)
      const servico = r.succao ? 'succao' : 'agua';
      out.push({ ...base, ...velocidadeDeUtilidade(r.id, cab.fluido, r.dn, cab.vazao, servico), linha: r.id });
      continue;
    }
    out.push({ ...base, semVazao: true, linha: r.id, motivo: 'vazão da bomba do caminhão não está nos dados' });
  }
  return out;
}

/* ------------------------------------------------------------ NPSH */
/** Perda de carga (Pa) de um pedaco de linha de succao: comprimento real,
 *  curvas contadas na rota e o K extra (entrada, valvula) a dar. */
export function perdaNoTrecho({ m, rho, mu, dn, material, L, curvas, Kextra = 0 }) {
  const tubo = diametroInterno(dn, material);
  const v = m / 3600 / rho / area(tubo.di);
  const eD = (RUGOSIDADE[material] ?? RUGOSIDADE.CS40) / tubo.di;
  const Re = (rho * v * tubo.di) / mu;
  const f = fatorAtrito(Re, eD);
  const fT = fTurbulento(eD);
  const Kcurvas = curvas * ACESSORIOS.curvaLD * fT;
  const dp = (f * (L / tubo.di) + Kcurvas + Kextra) * (rho * v * v) / 2;
  return { dp, v, Re, f, fT, Kcurvas };
}

/** NPSH requerido (m) estimado pelo tamanho da bomba (o bocal de succao). */
export function npshRequerido(tag, geom, tipo) {
  if (tipo === 'bomba-deslocamento') return { valor: NPSH_REQUERIDO.npipDeslocamento, como: 'NPIPr de cavidade progressiva com tremonha (estimado)' };
  const tubo = diametroInterno(geom.dnSuccao, 'CS40');
  const Qbep = area(tubo.di) * NPSH_REQUERIDO.vBocalBEP;                     // m³/s
  const gpm = Qbep * 15850.3;
  const N = NPSH_REQUERIDO.rpmPor[tag] ?? NPSH_REQUERIDO.rpm;
  const ft = ((N * Math.sqrt(gpm)) / NPSH_REQUERIDO.Nss) ** (4 / 3);
  return { valor: ft * 0.3048, como: `Nss ${NPSH_REQUERIDO.Nss} a ${N} rpm, BEP ≈ ${Math.round(Qbep * 3600)} m³/h (bocal DN ${geom.dnSuccao})` };
}
export const margemNecessaria = (npshr, torre = false) => Math.max(npshr * (torre ? MARGEM_NPSH.razaoTorre : MARGEM_NPSH.razao), npshr + MARGEM_NPSH.minimo);

/**
 * NPSH disponivel de uma bomba, do vaso de origem ao bocal de succao:
 *   NPSHa = (P_sup - P_v) / (rho g) + (z_sup - z_eixo) - h_f
 * `segs`: os pedacos da succao, do vaso para a bomba, cada um com a
 * corrente (S), o servico, DN, material, comprimento e curvas; o liquido
 * que chega a bomba e o do ultimo. `origem`: { tag, bocal, z } (z: a
 * superficie, ou o bocal quando nao ha nivel modelado). `fixo`: o que a
 * corrente nao diz (utilidade, torta).
 */
export function npshDisponivel({ origem, segs, zEixo, liquidoNaBomba }) {
  const chave = `${origem.tag}.${origem.bocal}`;
  const Psup = (PRESSAO_SUCCAO[chave] ?? PRESSAO[origem.tag] ?? origem.P ?? 1) * 1e5;
  const { rho, pv: pvRaoult } = liquidoNaBomba;
  const saturado = SATURADOS.includes(origem.tag);
  // liquido nao fica acima da propria pressao de vapor num vaso: ferve ate
  // igualar. No vaso em equilibrio com vapor ou gas, vale a do vaso.
  const pv = saturado ? Psup : Math.min(pvRaoult, Psup);
  let dp = 0;
  const pedacos = segs.map((s, i) => {
    const Kextra = (i === 0 ? ACESSORIOS.entradaK : 0);
    const r = s.semAtrito ? { dp: 0, v: 0 } : perdaNoTrecho({ ...s, Kextra });
    // a gaveta de bloqueio fica no ultimo pedaco, junto da bomba
    if (!s.semAtrito && i === segs.length - 1) {
      const tubo = diametroInterno(s.dn, s.material);
      r.dp += ACESSORIOS.gavetaLD * fTurbulento((RUGOSIDADE[s.material] ?? RUGOSIDADE.CS40) / tubo.di) * (s.rho * r.v * r.v) / 2;
    }
    dp += r.dp;
    return { ...s, ...r };
  });
  const pressao = (Psup - pv) / (rho * G);
  const estatica = origem.z - zEixo;
  const atrito = dp / (rho * G);
  return { valor: pressao + estatica - atrito, pressao, estatica, atrito, Psup, pv, saturado, pedacos, rho };
}

/* ------------------------------------------------------------ bomba */
const comprimentoDe = (pts) => pts.reduce((s, p, i) => (i ? s + p.distanceTo(pts[i - 1]) : 0), 0);

/** Um pedaco da linha de succao: a corrente que passa (S, ou o objeto `c`
 *  de uma utilidade), o tubo e a rota tracada (pts). */
export function pedacoDeSuccao({ S = null, c = null, servico, dn, material, pts, semAtrito = false, rotulo }) {
  const corr = c ?? CORRENTES[S];
  const p = propriedades(corr, servico === 'torta' ? 'torta' : 'liquido');
  return { S, rotulo, servico, m: p.m, rho: p.rho, mu: p.mu, pv: p.pv, T: corr.T, dn, material, L: comprimentoDe(pts), curvas: Math.max(0, pts.length - 2), semAtrito };
}

/** NPSH disponivel, requerido e margem de uma bomba.
 *  `origem`: { tag, bocal, z, P? } — de onde aspira; `pedacos`: do vaso para
 *  a bomba; `zEixo`: a cota do bocal de succao. */
export function npshDaBomba({ tag, tipo, geom, origem, pedacos, zEixo, torre = false }) {
  const disp = npshDisponivel({ origem, segs: pedacos, zEixo, liquidoNaBomba: pedacos.at(-1) });
  const req = npshRequerido(tag, geom, tipo);
  const margem = margemNecessaria(req.valor, torre);
  return {
    tag, origem: `${origem.tag}.${origem.bocal}`, disponivel: disp.valor, requerido: req.valor, comoRequerido: req.como, margem,
    razao: disp.valor / req.valor, insuficiente: disp.valor < req.valor, curto: disp.valor >= req.valor && disp.valor < margem,
    ...disp, deslocamento: tipo === 'bomba-deslocamento',
  };
}
