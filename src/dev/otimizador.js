import { ARRANJO, RACK, ACESSO, CUSTO, GRUPOS, SUCCAO_MAX, faixaSaque } from '../data/arranjo.js';
import { EXTRAS } from '../data/plant-extra.js';
import { TRECHOS, RAMAIS, NOS, LIMITES } from '../data/rotas.js';
import { LINHAS, UTILIDADES } from '../data/pid.js';
import { BLOCOS, vetorBarlavento } from '../data/site.js';
import { pegadaDe } from '../lib/apoios.js';

/**
 * ===========================================================================
 *  OTIMIZADOR DO ARRANJO  (Fase 11)
 * ===========================================================================
 *  A Fase 5 minimizou o comprimento de cada linha com os equipamentos
 *  parados. Aqui a posicao e a variavel: o arranjo e montado pela gramatica
 *  de data/arranjo.js (rack central, bombas sob ele, uma fileira de cada
 *  lado, corredores) e a busca escolhe em que fileira e em que ordem vai
 *  cada grupo, pelo menor custo:
 *
 *    tubo     cada trecho do P&ID (rotas.js), bocal a bocal: direto no chao
 *             se os dois estao do mesmo lado do rack, senao subindo ao rack;
 *             peso ~DN^0,75, inox 2x (CUSTO em arranjo.js)
 *    cabecal  agua de resfriamento, vapor e condensado do limite leste ate o
 *             ultimo consumidor, com o diametro de cada trecho pela vazao que
 *             ainda passa nele
 *    fora     do limite de bateria ao bloco de destino (tanques, ETE,
 *             torre, caldeira, armazem)
 *    laje e rack, pela area e pelo comprimento
 *
 *  Penalidades: bomba longe da succao, tomada de ar que nao e o ponto mais a
 *  barlavento da area de processo.
 *
 *  Pegadas e bocais sao MEDIDOS na cena, em cada giro — o que existe de
 *  fato, como nas auditorias. Busca por recozimento simulado com semente
 *  fixa: o mesmo resultado a cada execucao.
 *
 *  No console: __otimizarArranjo() devolve a proposta e o custo contra o
 *  arranjo de hoje; __plantaProposta() desenha a planta por cima da cena.
 */

const GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g]));
const LINHA = Object.fromEntries(LINHAS.map((l) => [l.numero, l]));
const norm = (g) => ((Math.round(g) % 360) + 360) % 360;
const rad = (g) => (g * Math.PI) / 180;

/* ------------------------------------------------------------------------
 *  Medida: pegada (em volta do ponto de colocacao) e bocais em cada giro.
 * --------------------------------------------------------------------- */
export function medir(todos) {
  const med = {};
  for (const item of ARRANJO) {
    const e = todos[item.tag];
    const g = e.grupo;
    const pos0 = g.position.clone();
    const rot0 = g.rotation.y;
    const base = { x: pos0.x - item.x, y: pos0.y, z: pos0.z - item.z };
    med[item.tag] = { pegada: {}, bocais: {} };
    for (const giro of [0, 90, 180, 270]) {
      g.position.set(base.x, base.y, base.z);
      g.rotation.y = rad(giro);
      g.updateWorldMatrix(true, true);
      med[item.tag].pegada[giro] = pegadaDe(g);
      med[item.tag].bocais[giro] = Object.fromEntries(Object.entries(e.ancoras ?? {})
        .map(([id, a]) => {
          const p = a.pos.clone().applyMatrix4(g.matrixWorld);
          return [id, { x: p.x, y: p.y, z: p.z }];
        }));
    }
    g.position.copy(pos0);
    g.rotation.y = rot0;
    g.updateWorldMatrix(true, true);
  }
  return med;
}

/* ------------------------------------------------------------------------
 *  Montagem: de uma solucao (grupos por fileira, em ordem) as posicoes.
 * --------------------------------------------------------------------- */
const BOMBAS = ARRANJO.map((a) => a.tag).filter((t) => /^B[CV]-/.test(t));

function giroDe(it, fileira) {
  // trocador: o feixe (lado `saque` no eixo local x) para fora da fileira
  const can = it.saque ? -90 * GRUPO_ITEM_SAQUE[it.tag] : it.giro;
  return norm(fileira === 'sul' ? can : can + 180);
}
const GRUPO_ITEM_SAQUE = Object.fromEntries(ARRANJO.filter((a) => a.saque).map((a) => [a.tag, a.saque]));

function larguraGrupo(g, fileira, med) {
  let w = 0;
  const itens = fileira === 'sul' ? g.itens : [...g.itens].reverse();
  itens.forEach((it, k) => {
    const p = med[it.tag].pegada[giroDe(it, fileira)];
    if (k > 0) w += folgaEntre(itens[k - 1], it);
    w += p.x1 - p.x0;
  });
  return w;
}
const folgaEntre = (a, b) => Math.max(a.folga ?? 0, b.folga ?? 0) || ACESSO.folgaInterna;

/* Bombas de cada grupo: as que aspiram de uma peca dele. A BC-01 aspira do
 * no V-15, que fica nela: vale a linha que chega ao no (14, do V-14 no E-04). */
function fonteDeSuccao(tag) {
  const g = GRUPOS.find((q) => q.vacuo?.bomba === tag);
  if (g) return `${g.vacuo.filtro}.V`;
  const t = TRECHOS.find((q) => q.para === `${tag}.S`);
  if (!t) return null;
  const no = t.de.split('@')[0];
  if (NOS[no]?.perto?.startsWith(`${tag}.`)) {
    const entra = TRECHOS.find((q) => q.para.startsWith(`${no}@`) && !q.de.startsWith('B'));
    if (!entra) return null;
    return entra.de.includes('@') ? NOS[entra.de.split('@')[0]].perto : entra.de;
  }
  return t.de.includes('@') ? NOS[no]?.perto ?? null : t.de;
}
const grupoDaTag = (tag) => GRUPOS.find((g) => g.itens.some((i) => i.tag === tag))?.id;
const BOMBAS_DO_GRUPO = {};
for (const b of ARRANJO.map((a) => a.tag).filter((t) => /^B[CV]-/.test(t))) {
  const f = fonteDeSuccao(b);
  const g = f && grupoDaTag(f.split('.')[0]);
  if (g) (BOMBAS_DO_GRUPO[g] ??= []).push(b);
}

/* Onde abrir corredor transversal numa fileira. Obrigatorio dos lados do
 * reator (as escadas descem nele) e onde o trecho sem corredor passaria de
 * trechoMax. Entre os vaos possiveis, o corredor vai onde nenhuma bomba
 * precisa passar: um grupo cujas bombas nao cabem na largura dele (sob o
 * rack) as espalha para os vizinhos, e a succao, que corre baixa e sem
 * ponto alto, nao pode atravessar corredor. */
function escolherCorredores(ids, fileira, med) {
  const A = ACESSO;
  const larg = ids.map((id) => larguraGrupo(GRUPO[id], fileira, med));
  const demanda = (id) => (BOMBAS_DO_GRUPO[id] ?? []).reduce((s, b) => {
    const p = med[b].pegada[90];
    return s + Math.min(p.x1 - p.x0, p.z1 - p.z0) + A.folgaBombas;
  }, 0);
  // as bombas ficam sob o rack: cabem na largura do grupo mais um vao comum
  const transborda = ids.map((id, k) => demanda(id) > larg[k] + A.folga);
  const vaos = ids.slice(1).map((id, k) => {
    const f = Math.max(A[GRUPO[ids[k]].folga ?? 'folga'], A[GRUPO[id].folga ?? 'folga']);
    // corredor obrigatorio so dos lados do reator; vao largo nao vira corredor
    const reator = [GRUPO[ids[k]].folga, GRUPO[id].folga].includes('folgaReator');
    return { largura: f, corredor: reator, acoplado: transborda[k] || transborda[k + 1] };
  });
  // trechos entre corredores obrigatorios: parte o que passar do maximo
  const partir = (i0, i1) => {          // grupos i0..i1, vaos i0..i1-1
    if (i1 <= i0) return;
    let total = larg.slice(i0, i1 + 1).reduce((s, w) => s + w, 0);
    for (let k = i0; k < i1; k++) total += vaos[k].largura;
    if (total <= A.trechoMax) return;
    let melhor = null;
    let acum = larg[i0];
    for (let k = i0; k < i1; k++) {
      const esq = acum, dir = total - acum - vaos[k].largura;
      const nota = (vaos[k].acoplado ? 100 : 0) + Math.abs(esq - dir) / total;
      if (!melhor || nota < melhor.nota) melhor = { k, nota };
      acum += vaos[k].largura + larg[k + 1];
    }
    const v = vaos[melhor.k];
    v.corredor = true;
    v.largura = Math.max(v.largura, A.corredor);
    partir(i0, melhor.k);
    partir(melhor.k + 1, i1);
  };
  let ini = 0;
  vaos.forEach((v, k) => { if (v.corredor) { partir(ini, k); ini = k + 1; } });
  partir(ini, ids.length - 1);
  for (const v of vaos) if (v.corredor) v.largura = Math.max(v.largura, A.corredor);
  return vaos;
}

export function montar(sol, med, centro = [9, 0.5]) {
  const A = ACESSO;
  const W = A.larguraRack;
  const zIn = { norte: -W / 2 - A.recuo, sul: W / 2 + A.recuo };
  const itens = {};
  const corredores = [];
  const fim = {};
  const fundo = { norte: 0, sul: 0 };

  // na ponta da fileira, a folga do grupo (a do reator, onde desce a escada)
  // vale ate a mureta, e nao so a faixa do perimetro
  const ponta = (id) => Math.max(A.perimetro, GRUPO[id].folga ? A[GRUPO[id].folga] : 0);
  for (const fileira of ['norte', 'sul']) {
    const ids = sol[fileira];
    const aberturas = escolherCorredores(ids, fileira, med);
    let cur = ponta(ids[0]);
    ids.forEach((id, k) => {
      const g = GRUPO[id];
      if (k > 0) {
        const f = aberturas[k - 1];
        if (f.corredor) corredores.push({ fileira, x0: cur, x1: cur + f.largura });
        cur += f.largura;
      }
      const lista = fileira === 'sul' ? g.itens : [...g.itens].reverse();
      lista.forEach((it, j) => {
        const giro = giroDe(it, fileira);
        const p = med[it.tag].pegada[giro];
        if (j > 0) cur += folgaEntre(lista[j - 1], it);
        const x = cur - p.x0;
        const z = fileira === 'sul' ? zIn.sul - p.z0 : zIn.norte - p.z1;
        itens[it.tag] = { tag: it.tag, x, z, giro, grupo: id, fileira };
        fundo[fileira] = Math.max(fundo[fileira], p.z1 - p.z0);
        cur = x + p.x1;
      });
    });
    fim[fileira] = cur + ponta(ids[ids.length - 1]);
  }

  // laje provisoria (x a partir de 0) para as bombas
  let x1 = Math.max(fim.norte, fim.sul);
  const pos = (ref) => pontoDe(ref, { itens, med, laje: { x0: 0, x1 }, rack: { z: 0 } });
  const bombas = colocarBombas({ itens, med, corredores, W, pos, xFim: x1 });
  for (const b of bombas) {
    itens[b.tag] = b;
    x1 = Math.max(x1, b.x + med[b.tag].pegada[b.giro].x1 + A.perimetro);
  }
  const laje = { x0: 0, x1, z0: zIn.norte - fundo.norte - A.perimetro, z1: zIn.sul + fundo.sul + A.perimetro };

  // centra a laje onde ela estava
  const dx = centro[0] - (laje.x0 + laje.x1) / 2;
  const dz = centro[1] - (laje.z0 + laje.z1) / 2;
  for (const it of Object.values(itens)) { it.x += dx; it.z += dz; }
  for (const c of corredores) { c.x0 += dx; c.x1 += dx; }
  laje.x0 += dx; laje.x1 += dx; laje.z0 += dz; laje.z1 += dz;
  const rack = { z: dz, largura: W, x0: laje.x0, x1: laje.x1 };
  for (const c of corredores) {
    c.z0 = c.fileira === 'norte' ? laje.z0 : rack.z + W / 2;
    c.z1 = c.fileira === 'norte' ? rack.z - W / 2 : laje.z1;
  }
  return { itens, corredores, laje, rack, med };
}

/* Bombas sob o rack, na borda do lado de onde aspiram, de frente para o
 * corredor do meio. Cada uma fica no trecho entre corredores transversais
 * onde esta a succao dela — a succao corre baixa e nao atravessa corredor —
 * e, dentro dele, o mais perto possivel do X desejado: empacota da esquerda
 * para a direita e recua se passar do fim do trecho. */
function colocarBombas({ itens, med, corredores, W, pos, xFim }) {
  const A = ACESSO;
  const prof = (A.larguraRack - A.corredorRack) / 2 - A.bordaBomba;
  const lista = [];
  for (const tag of BOMBAS) {
    const fontes = [];
    const g = GRUPOS.find((q) => q.vacuo?.bomba === tag);
    if (g) fontes.push({ p: pos(`${g.vacuo.filtro}.V`), peso: 3 });
    for (const t of TRECHOS) {
      if (t.para === `${tag}.S`) fontes.push({ p: pos(t.de), peso: 3 });
      if (t.de === `${tag}.D`) fontes.push({ p: pos(t.para), peso: 1 });
      // no que fica na propria bomba (V-15 na BC-01): valem as linhas que chegam nele
      const no = t.para.split('@')[0];
      // (e a succao dela: pesa como succao)
      if (NOS[no]?.perto?.startsWith(`${tag}.`) && t.de !== `${tag}.D`) fontes.push({ p: pos(t.de), peso: 3 });
    }
    const validas = fontes.filter((f) => f.p);
    const peso = validas.reduce((s, f) => s + f.peso, 0);
    const fonte = fonteDeSuccao(tag);
    const pf = fonte ? pos(fonte) : null;
    const xDesejado = validas.reduce((s, f) => s + f.p.x * f.peso, 0) / peso;
    const sul = (pf ? Math.sign(pf.z) : validas.reduce((s, f) => s + Math.sign(f.p.z) * f.peso, 0)) > 0;
    // de pe (eixo norte-sul, motor para o corredor) se couber; senao deitada
    const dePe = sul ? 90 : 270;
    const pd = med[tag].pegada[dePe];
    const giro = pd.z1 - pd.z0 <= prof + 0.005 ? dePe : (sul ? 180 : 0);
    lista.push({ tag, xDesejado, xRef: pf?.x ?? xDesejado, fileira: sul ? 'sul' : 'norte', giro, p: med[tag].pegada[giro] });
  }
  const out = [];
  for (const fileira of ['norte', 'sul']) {
    const fechados = corredores.filter((c) => c.fileira === fileira).sort((a, b) => a.x0 - b.x0);
    const bordas = [A.perimetro, ...fechados.flatMap((c) => [c.x0, c.x1]), xFim - A.perimetro];
    const trechos = [];
    for (let k = 0; k < bordas.length; k += 2) trechos.push([bordas[k], bordas[k + 1]]);
    for (const [s0, s1] of trechos) {
      const aqui = lista.filter((b) => b.fileira === fileira && (b.xRef >= s0 || s0 === trechos[0][0])
        && (b.xRef < s1 || s1 === trechos[trechos.length - 1][1]))
        .sort((a, b) => a.xDesejado - b.xDesejado);
      const xs = aqui.map((b) => Math.min(Math.max(b.xDesejado, s0 - b.p.x0), s1 - b.p.x1));
      for (let i = 1; i < aqui.length; i++) {
        xs[i] = Math.max(xs[i], xs[i - 1] + aqui[i - 1].p.x1 + A.folgaBombas - aqui[i].p.x0);
      }
      for (let i = aqui.length - 1; i >= 0; i--) {
        const lim = i === aqui.length - 1 ? s1 - aqui[i].p.x1 : xs[i + 1] + aqui[i + 1].p.x0 - A.folgaBombas - aqui[i].p.x1;
        xs[i] = Math.min(xs[i], lim);
      }
      aqui.forEach((b, i) => {
        const z = fileira === 'sul' ? W / 2 - A.bordaBomba - b.p.z1 : -W / 2 + A.bordaBomba - b.p.z0;
        out.push({ tag: b.tag, x: xs[i], z, giro: b.giro, grupo: 'bombas', fileira, bomba: true });
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------------
 *  Custo
 * --------------------------------------------------------------------- */
function pontoDe(ref, L) {
  if (!ref || ref === 'DRENO') return null;
  if (ref.startsWith('LB:')) {
    const lado = ref.slice(3);
    return { x: lado === 'oeste' ? L.laje.x0 + 0.4 : L.laje.x1 - 0.4, y: RACK.niveis[0] + 0.3, z: L.rack.z, lb: lado };
  }
  let alvo = ref;
  if (ref.includes('@')) alvo = NOS[ref.split('@')[0]]?.perto;
  const [tag, bocal] = alvo.split('.');
  const it = L.itens[tag];
  if (!it) return null;
  const b = L.med[tag].bocais[it.giro][bocal];
  if (!b) return { x: it.x, y: 1, z: it.z };
  return { x: it.x + b.x, y: b.y, z: it.z + b.z };
}

const peso = (dn, inox) => (dn / 80) ** CUSTO.expoenteDN * (inox ? CUSTO.inox : 1);

function comprimento(P, Q, L) {
  const rz = L.rack.z;
  const yR = RACK.niveis[0];
  const dx = Math.abs(P.x - Q.x);
  const viaRack = Math.abs(P.z - rz) + Math.abs(Q.z - rz) + dx + Math.max(0, yR - P.y) + Math.max(0, yR - Q.y);
  const ladoP = Math.sign(P.z - rz), ladoQ = Math.sign(Q.z - rz);
  if (ladoP !== ladoQ || P.lb || Q.lb) return viaRack;
  // do mesmo lado: direto, mas passando por cima de corredor transversal
  const [xa, xb] = [Math.min(P.x, Q.x), Math.max(P.x, Q.x)];
  const cruza = (L.corredores ?? []).some((c) => (c.z0 + c.z1) / 2 * ladoP > rz * ladoP && c.x0 < xb && c.x1 > xa);
  const subir = cruza ? 2 * Math.max(0, ACESSO.peDireito + 0.3 - Math.min(P.y, Q.y)) : 0;
  return Math.min(dx + Math.abs(P.z - Q.z) + Math.abs(P.y - Q.y) + subir, viaRack);
}

const numero = (s) => Number(String(s).replace(/[^\d,.]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));

/* Destino fora da laje de cada linha que sai pelo limite de bateria. */
const DESTINO_FORA = { '27': 'TANQUES', '30': 'TANQUES', '28': 'ARMAZEM', CWS: 'TORRE', CWR: 'TORRE', STM: 'CALDEIRA', COND: 'CALDEIRA' };
function fora(lb, idBloco) {
  const b = BLOCOS.find((q) => q.id === idBloco);
  const x = Math.min(Math.max(lb.x, b.x[0]), b.x[1]);
  const z = Math.min(Math.max(lb.z, b.z[0]), b.z[1]);
  return Math.abs(lb.x - x) + Math.abs(lb.z - z);
}

function dnPorVazao(cab, q) {
  const C = CUSTO;
  let area;
  if (cab === 'CWS' || cab === 'CWR') area = q / 3600 / C.vAgua;
  else if (cab === 'STM') area = q / 3600 / C.rhoVapor / C.vVapor;
  else area = q / 3600 / 950 / C.vCondensado;
  return Math.max(25, Math.sqrt((4 * area) / Math.PI) * 1000);
}

export function custo(L) {
  const r = { tubo: 0, cabecal: 0, fora: 0, laje: 0, rack: 0, penal: 0, metros: 0, linhas: {}, avisos: [] };
  for (const t of TRECHOS) {
    const P = pontoDe(t.de, L);
    const Q = pontoDe(t.para, L);
    const l = LINHA[t.linha];
    const w = peso(l.dn, l.material.startsWith('SS'));
    let m;
    if (!P) continue;
    if (!Q) m = P.y + 1;                      // dreno: desce ao funil
    else m = comprimento(P, Q, L);
    r.tubo += w * m;
    r.metros += m;
    r.linhas[t.linha] = (r.linhas[t.linha] ?? 0) + m;
    const lb = P.lb ? P : Q?.lb ? Q : null;
    if (lb && DESTINO_FORA[t.linha]) r.fora += w * fora(lb, DESTINO_FORA[t.linha]);
  }

  // ramais de utilidade: do bocal ao nivel 2 do rack; cabecais graduados
  const nivel2 = RACK.niveis[1];
  const consumo = {};
  for (const u of UTILIDADES) consumo[u.equip] = numero(u.vazao.match(/[\d\s.,]+(?=\s*(m³|kg))/)?.[0] ?? '0');
  const porCabecal = {};
  for (const rm of RAMAIS) {
    const P = pontoDe(rm.de, L);
    if (!P) continue;
    const tag = rm.de.split('.')[0];
    const q = consumo[tag] ?? 0;
    const m = Math.abs(P.z - L.rack.z) + Math.abs(nivel2 - P.y);
    r.cabecal += peso(dnPorVazao(rm.cabecal, q), false) * m;
    r.metros += m;
    (porCabecal[rm.cabecal] ??= []).push({ x: P.x, q });
  }
  const xL = L.laje.x1 - 0.4;
  for (const [cab, cons] of Object.entries(porCabecal)) {
    let resta = cons.reduce((s, c) => s + c.q, 0);
    r.fora += peso(dnPorVazao(cab, resta), false) * fora({ x: L.laje.x1, z: L.rack.z }, DESTINO_FORA[cab]);
    let ant = xL;
    for (const c of [...cons].sort((a, b) => b.x - a.x)) {
      const m = Math.max(0, ant - c.x);
      r.cabecal += peso(dnPorVazao(cab, resta), false) * m;
      r.metros += m;
      resta -= c.q;
      ant = Math.min(ant, c.x);
    }
  }

  const { laje } = L;
  r.laje = CUSTO.laje * (laje.x1 - laje.x0) * (laje.z1 - laje.z0);
  r.rack = CUSTO.rack * (laje.x1 - laje.x0);

  // penalidades: succao longa; tomada de ar que nao e o ponto mais a barlavento
  for (const t of TRECHOS) {
    if (!/^B[CV]-\d+\.S$/.test(t.para)) continue;
    const P = pontoDe(t.de, L), Q = pontoDe(t.para, L);
    if (!P || !Q) continue;
    const d = Math.hypot(P.x - Q.x, P.y - Q.y, P.z - Q.z);
    if (d > SUCCAO_MAX) { r.penal += 100 * (d - SUCCAO_MAX); r.avisos.push(`succao da ${t.para} a ${d.toFixed(1)} m`); }
  }
  for (const b of Object.values(L.itens).filter((i) => i.bomba)) {
    const f = fonteDeSuccao(b.tag);
    const P = f && pontoDe(f, L);
    if (!P) continue;
    const [xa, xb] = [Math.min(P.x, b.x), Math.max(P.x, b.x)];
    const pb = L.med[b.tag].pegada[b.giro];
    const dentroDeCorredor = (L.corredores ?? []).some((q) => q.fileira === b.fileira && b.x + pb.x1 > q.x0 + 0.01 && b.x + pb.x0 < q.x1 - 0.01);
    if (dentroDeCorredor) { r.penal += 300; r.avisos.push(`${b.tag} dentro de um corredor`); }
    if ((L.corredores ?? []).some((q) => q.fileira === b.fileira && q.x0 > xa && q.x1 < xb)) {
      r.penal += 300;
      r.avisos.push(`succao da ${b.tag} atravessa um corredor`);
    }
  }
  const tomada = pontoDe('CP-01.S', L);
  if (tomada) {
    const [vx, vz] = vetorBarlavento();
    const proj = (p) => p.x * vx + p.z * vz;
    const pior = Math.max(...Object.values(L.itens).filter((i) => i.tag !== 'CP-01').map((i) => proj(i) - proj(tomada)));
    if (pior > 0) { r.penal += 50 * pior; r.avisos.push(`tomada de ar ${pior.toFixed(1)} m a sotavento do equipamento mais a barlavento`); }
  }
  r.total = r.tubo + r.cabecal + r.fora + r.laje + r.rack + r.penal;
  return r;
}

/* ------------------------------------------------------------------------
 *  Busca: recozimento simulado sobre a fileira e a ordem dos grupos.
 * --------------------------------------------------------------------- */
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function otimizar(med, { iteracoes = 30000, semente = 7 } = {}) {
  const rnd = aleatorio(semente);
  const livres = GRUPOS.filter((g) => !g.fileira).map((g) => g.id);
  // partida: o fluxo da Fase 4 (reacao ao norte, purificacao ao sul)
  let sol = {
    norte: ['R', 'CP', 'COND', 'DEC', 'TK', 'FLASH', 'PRE'],
    sul: ['REC', 'FILT1', 'DISS', 'FILT2'],
  };
  const avaliar = (s) => custo(montar(s, med)).total;
  let atual = avaliar(sol);
  let melhor = { sol: structuredClone(sol), total: atual };
  const T0 = 60, T1 = 0.05;
  for (let i = 0; i < iteracoes; i++) {
    const T = T0 * (T1 / T0) ** (i / iteracoes);
    const nova = structuredClone(sol);
    const mov = rnd();
    const id = livres[Math.floor(rnd() * livres.length)];
    const de = nova.norte.includes(id) ? 'norte' : 'sul';
    if (mov < 0.5) {
      // troca com outro grupo (de qualquer fileira)
      const outro = [...nova.norte, ...nova.sul][Math.floor(rnd() * (nova.norte.length + nova.sul.length))];
      if (outro === id || GRUPO[outro].fileira) continue;
      const pa = nova.norte.includes(outro) ? 'norte' : 'sul';
      const ia = nova[de].indexOf(id), ib = nova[pa].indexOf(outro);
      nova[de][ia] = outro;
      nova[pa][ib] = id;
    } else {
      // tira e reinsere em qualquer posicao de qualquer fileira
      nova[de].splice(nova[de].indexOf(id), 1);
      const para = rnd() < 0.5 ? 'norte' : 'sul';
      nova[para].splice(Math.floor(rnd() * (nova[para].length + 1)), 0, id);
    }
    if (!nova.norte.length || !nova.sul.length) continue;
    const c = avaliar(nova);
    if (c < atual || rnd() < Math.exp((atual - c) / T)) {
      sol = nova;
      atual = c;
      if (c < melhor.total) melhor = { sol: structuredClone(nova), total: c };
    }
  }
  return melhor.sol;
}

/* ------------------------------------------------------------------------
 *  Diagnostico: as regras de acesso medidas num arranjo (o de hoje ou o
 *  proposto) — folga entre pecas e distancia de cada uma ao corredor.
 *  Corredor e o que o arranjo demarca mais a faixa do perimetro.
 * --------------------------------------------------------------------- */
const caixaDe = (it, med) => {
  const p = med[it.tag].pegada[it.giro];
  return { x0: it.x + p.x0, x1: it.x + p.x1, z0: it.z + p.z0, z1: it.z + p.z1 };
};
const distCaixas = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));

export function corredoresDe(L) {
  const { laje, rack } = L;
  const p = ACESSO.perimetro;
  const out = [
    { x0: laje.x0, x1: laje.x1, z0: laje.z0, z1: laje.z0 + p },
    { x0: laje.x0, x1: laje.x1, z0: laje.z1 - p, z1: laje.z1 },
    { x0: laje.x0, x1: laje.x0 + p, z0: laje.z0, z1: laje.z1 },
    { x0: laje.x1 - p, x1: laje.x1, z0: laje.z0, z1: laje.z1 },
    ...(L.corredores ?? []),
  ];
  if (L.corredores?.length) out.push({ x0: laje.x0, x1: laje.x1, z0: rack.z - ACESSO.corredorRack / 2, z1: rack.z + ACESSO.corredorRack / 2 });
  return out;
}

export function diagnosticar(L) {
  const { itens, med } = L;
  const lista = Object.values(itens);
  const cx = Object.fromEntries(lista.map((i) => [i.tag, caixaDe(i, med)]));
  const corr = corredoresDe(L);
  const apertados = [];
  let folgaMin = Infinity;
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      if (a.grupo && a.grupo === b.grupo && a.grupo !== 'bombas') continue;   // dentro do grupo, por projeto
      const d = distCaixas(cx[a.tag], cx[b.tag]);
      folgaMin = Math.min(folgaMin, d);
      const min = a.bomba && b.bomba ? ACESSO.folgaBombas : ACESSO.folgaInterna;
      if (d < min - 0.005) apertados.push(`${a.tag}–${b.tag} ${d.toFixed(2)} m`);
    }
  }
  // dentro do corredor nao pode haver peca; longe dele, o operador nao chega.
  // Sem corredor demarcado (o arranjo de hoje), so a borda da laje conta.
  const demarcados = L.corredores?.length ? corr : [];
  const longe = [], dentro = [];
  for (const i of lista) {
    const d = Math.min(...corr.map((c) => distCaixas(cx[i.tag], c)));
    if (d > ACESSO.alcanceOperacao) longe.push(`${i.tag} ${d.toFixed(1)} m`);
    if (demarcados.some((c) => cx[i.tag].x0 < c.x1 - 0.05 && cx[i.tag].x1 > c.x0 + 0.05 && cx[i.tag].z0 < c.z1 - 0.05 && cx[i.tag].z1 > c.z0 + 0.05)) dentro.push(i.tag);
  }
  const area = L.corredores?.length
    ? corr.reduce((s, c) => s + (c.x1 - c.x0) * (c.z1 - c.z0), 0) : 0;
  return { folgaMin, apertados, longe, dentro, areaCorredores: area };
}

/* ------------------------------------------------------------------------
 *  Planta da proposta em SVG (norte para cima), para aprovar antes da 3D.
 * --------------------------------------------------------------------- */
const COR = {
  fundo: '#1d232b', via: '#3b4148', faixa: '#2a3038', laje: '#8d949b', mureta: '#c9ced3',
  corredor: 'rgba(84, 190, 120, 0.55)', borda: '#f2c94c', rack: '#5c6b7a', bomba: '#e07b39',
  vaso: '#d7dde3', troca: '#9fc6e8', filtro: '#c9b48a', reator: '#e8a0a0', cp: '#7fb2ff',
  saque: '#4fa6d0', guindaste: '#ffc247', texto: '#10151b',
};

export function desenhar(L, { atual, custoNovo, escala = 22 } = {}) {
  const { laje, rack, itens, corredores, med } = L;
  const A = ACESSO;
  const m = 14;                                  // margem em metros (anel e legenda)
  const X = (x) => (x - laje.x0 + m) * escala;
  const Z = (z) => (z - laje.z0 + m) * escala;
  const larg = (laje.x1 - laje.x0 + 2 * m) * escala;
  const alt = (laje.z1 - laje.z0 + 2 * m) * escala + 230;
  const r = (x0, z0, x1, z1, estilo) => `<rect x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * escala}" height="${(z1 - z0) * escala}" ${estilo}/>`;
  const t = (x, z, s, estilo = '') => `<text x="${X(x)}" y="${Z(z)}" ${estilo}>${s}</text>`;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${larg} ${alt}" width="${larg}" height="${alt}" style="max-width:100%;height:auto" font-family="Segoe UI, Arial" font-size="12">`);
  out.push(`<defs><pattern id="hach" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${COR.guindaste}" stroke-width="3"/></pattern></defs>`);
  out.push(r(laje.x0 - m, laje.z0 - m, laje.x1 + m, laje.z1 + m, `fill="${COR.fundo}"`));
  // anel: 3 m de acostamento e 6 m de via
  out.push(r(laje.x0 - 9, laje.z0 - 9, laje.x1 + 9, laje.z1 + 9, `fill="${COR.via}"`));
  out.push(r(laje.x0 - 3, laje.z0 - 3, laje.x1 + 3, laje.z1 + 3, `fill="${COR.faixa}"`));
  out.push(r(laje.x0, laje.z0, laje.x1, laje.z1, `fill="${COR.laje}" stroke="${COR.mureta}" stroke-width="3"`));
  // faixa do perimetro, corredor sob o rack e transversais
  const p = A.perimetro;
  out.push(r(laje.x0 + p, laje.z0 + p, laje.x1 - p, laje.z1 - p, `fill="none" stroke="${COR.borda}" stroke-width="2" stroke-dasharray="10 6"`));
  out.push(r(laje.x0, rack.z - A.corredorRack / 2, laje.x1, rack.z + A.corredorRack / 2, `fill="${COR.corredor}" stroke="${COR.borda}" stroke-width="2"`));
  for (const c of corredores) out.push(r(c.x0, c.z0, c.x1, c.z1, `fill="${COR.corredor}" stroke="${COR.borda}" stroke-width="2"`));
  // rack: linhas de coluna
  for (const s of [-1, 1]) {
    const z = rack.z + (s * rack.largura) / 2;
    out.push(`<line x1="${X(laje.x0)}" y1="${Z(z)}" x2="${X(laje.x1)}" y2="${Z(z)}" stroke="${COR.rack}" stroke-width="4"/>`);
  }
  // guindaste do R-01: na via do anel, ao lado dele
  const R = itens['R-01'];
  if (R) {
    const gz = R.fileira === 'norte' ? [laje.z0 - 10, laje.z0] : [laje.z1, laje.z1 + 10];
    out.push(r(R.x - 5, gz[0], R.x + 5, gz[1], `fill="url(#hach)" stroke="${COR.guindaste}" stroke-width="2"`));
    out.push(t(R.x, (gz[0] + gz[1]) / 2, 'guindaste do R-01', `text-anchor="middle" fill="#fff" font-weight="600"`));
  }
  // faixas de saque
  for (const it of Object.values(itens)) {
    const a = ARRANJO.find((q) => q.tag === it.tag);
    if (!a?.saque) continue;
    const f = faixaSaque({ ...it, saque: a.saque }, EXTRAS[it.tag].geom);
    out.push(r(f.x0, f.z0, f.x1, f.z1, `fill="none" stroke="${COR.saque}" stroke-width="2" stroke-dasharray="6 4"`));
  }
  // equipamentos
  const cor = (tag) => (tag === 'R-01' ? COR.reator : tag === 'CP-01' ? COR.cp : /^B/.test(tag) ? COR.bomba
    : /^E-/.test(tag) ? COR.troca : /^F-/.test(tag) ? COR.filtro : COR.vaso);
  for (const it of Object.values(itens)) {
    const pg = med[it.tag].pegada[it.giro];
    out.push(r(it.x + pg.x0, it.z + pg.z0, it.x + pg.x1, it.z + pg.z1, `fill="${cor(it.tag)}" stroke="#222" stroke-width="1.2" rx="2"`));
    const peq = /^B/.test(it.tag);
    out.push(t(it.x + (pg.x0 + pg.x1) / 2, it.z + (pg.z0 + pg.z1) / 2 + (peq ? 0.15 : 0.2), it.tag,
      `text-anchor="middle" fill="${COR.texto}" font-size="${peq ? 9 : 12}" font-weight="700"`));
  }
  // tomada de ar
  const tom = pontoDe('CP-01.S', L);
  if (tom) out.push(`<circle cx="${X(tom.x)}" cy="${Z(tom.z)}" r="6" fill="#fff" stroke="${COR.cp}" stroke-width="3"/>`);
  // rampas na mureta: veiculo nas pontas do corredor do rack, pedestre nos transversais
  const rampa = (x0, z0, x1, z1) => out.push(r(x0, z0, x1, z1, `fill="${COR.mureta}" stroke="#fff" stroke-width="1"`));
  for (const xb of [laje.x0, laje.x1]) rampa(xb - 0.6, rack.z - 2, xb + 0.6, rack.z + 2);
  for (const c of corredores) {
    const zb = c.fileira === 'norte' ? laje.z0 : laje.z1;
    rampa(c.x0, zb - 0.6, c.x1, zb + 0.6);
  }
  // cotas da laje
  const f1 = (v) => v.toFixed(1).replace('.', ',');
  out.push(t((laje.x0 + laje.x1) / 2, laje.z1 + 2.2, `${f1(laje.x1 - laje.x0)} m`, `text-anchor="middle" fill="#fff" font-weight="600"`));
  const xc = laje.x0 - 10.5, zc = (laje.z0 + laje.z1) / 2;
  out.push(`<text x="${X(xc)}" y="${Z(zc)}" fill="#fff" font-weight="600" text-anchor="middle" transform="rotate(-90 ${X(xc)} ${Z(zc)})">${f1(laje.z1 - laje.z0)} m</text>`);
  // rotulos
  out.push(t(laje.x0 + 1.2, rack.z + 0.35, 'corredor de manutenção sob o rack', `fill="#fff" font-size="11"`));
  out.push(t(laje.x0 - 1, rack.z - 2.6, 'LB oeste', `text-anchor="end" fill="#fff"`));
  out.push(t(laje.x1 + 1, rack.z - 2.6, 'LB leste', `fill="#fff"`));
  // norte, vento e escala
  const nx = laje.x1 + 6, nz = laje.z0 - 11;
  out.push(`<path d="M ${X(nx)} ${Z(nz - 1.6)} l -7 16 l 7 -5 l 7 5 z" fill="#fff"/>`);
  out.push(t(nx, nz - 2, 'N', `text-anchor="middle" fill="#fff" font-weight="700"`));
  const [vx, vz] = vetorBarlavento();
  const wx = laje.x1 + 6, wz = laje.z1 + 6;
  out.push(`<line x1="${X(wx + vx * 3)}" y1="${Z(wz + vz * 3)}" x2="${X(wx - vx * 1.5)}" y2="${Z(wz - vz * 1.5)}" stroke="#9fd3ff" stroke-width="3" marker-end="url(#seta)"/>`);
  out.push(`<defs><marker id="seta" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9fd3ff"/></marker></defs>`);
  out.push(t(wx + vx * 3, wz + vz * 3 + 1.2, 'vento de SE', `text-anchor="middle" fill="#9fd3ff"`));
  const ex = laje.x0 - 12, ez = laje.z1 + 11;
  out.push(`<line x1="${X(ex)}" y1="${Z(ez)}" x2="${X(ex + 10)}" y2="${Z(ez)}" stroke="#fff" stroke-width="3"/>`);
  out.push(t(ex + 5, ez - 0.5, '10 m', `text-anchor="middle" fill="#fff"`));
  // quadro de custo
  const y0 = (laje.z1 - laje.z0 + 2 * m) * escala + 22;
  const fmt = (v) => Math.round(v).toLocaleString('pt-BR');
  const linhas = [['', 'hoje', 'proposta'],
    ['Laje (m)', `${fmt(atual.dim[0])} × ${fmt(atual.dim[1])}`, `${(laje.x1 - laje.x0).toFixed(1).replace('.', ',')} × ${(laje.z1 - laje.z0).toFixed(1).replace('.', ',')}`],
    ['Tubo e ramais (m)', fmt(atual.c.metros), fmt(custoNovo.metros)],
    ['Custo de tubulação', fmt(atual.c.tubo + atual.c.cabecal + atual.c.fora), fmt(custoNovo.tubo + custoNovo.cabecal + custoNovo.fora)],
    ['Custo de laje e rack', fmt(atual.c.laje + atual.c.rack), fmt(custoNovo.laje + custoNovo.rack)],
    ['Total (m de 3" CS equiv.)', fmt(atual.c.total), fmt(custoNovo.total)],
    ['Corredor demarcado (m²)', fmt(atual.d.areaCorredores), fmt(diagnosticar(L).areaCorredores)],
    ['A mais de 3 m de um corredor', `${atual.d.longe.length} de ${Object.keys(itens).length}`, `${diagnosticar(L).longe.length} de ${Object.keys(itens).length}`],
    ['Menor folga entre peças (m)', atual.d.folgaMin.toFixed(2).replace('.', ','), diagnosticar(L).folgaMin.toFixed(2).replace('.', ',')],
    ['Compressor ↔ reator (m)', f1(atual.dCP), f1(Math.hypot(itens['CP-01'].x - itens['R-01'].x, itens['CP-01'].z - itens['R-01'].z))]];
  linhas.forEach((ln, i) => {
    const y = y0 + i * 19;
    out.push(`<text x="20" y="${y}" fill="#fff" font-weight="${i ? 400 : 700}">${ln[0]}</text>`);
    out.push(`<text x="260" y="${y}" fill="#c9ced3" text-anchor="end">${ln[1]}</text>`);
    out.push(`<text x="380" y="${y}" fill="#fff" text-anchor="end" font-weight="700">${ln[2]}</text>`);
  });
  const leg = [[COR.corredor, 'corredor pintado'], [COR.bomba, 'bomba'], [COR.troca, 'trocador'], [COR.saque, 'saque do feixe (tracejado)'], [COR.guindaste, 'guindaste']];
  leg.forEach(([c, s], i) => {
    out.push(`<rect x="430" y="${y0 - 11 + i * 19}" width="14" height="12" fill="${c}"/>`);
    out.push(`<text x="452" y="${y0 + i * 19}" fill="#fff">${s}</text>`);
  });
  out.push('</svg>');
  return out.join('\n');
}

/** Texto de src/data/arranjo-proposto.js a partir de uma proposta. */
export function exportar(r, { semente, iteracoes } = {}) {
  const L = r.proposta;
  const n = (v) => Number(v.toFixed(2));
  const giro = (g) => (g > 180 ? g - 360 : g);
  // fileira norte, bombas do norte, fileira sul, bombas do sul; de oeste a leste
  const chave = (i) => (i.fileira === 'norte' ? 0 : 2) + (i.bomba ? 1 : 0);
  const itens = Object.values(L.itens).sort((a, b) => chave(a) - chave(b) || a.x - b.x);
  const c = r.custo, a = r.atual;
  const fmt = (v) => Math.round(v);
  const lin = [];
  lin.push('/**');
  lin.push(' * ============================================================================');
  lin.push(' *  ARRANJO PROPOSTO DA AREA DE PROCESSO  (Fase 11) — GERADO, nao editar a mao');
  lin.push(' * ============================================================================');
  lin.push(' *  Saida de src/dev/otimizador.js (__otimizarArranjo no console), pela');
  lin.push(' *  gramatica e pelas regras de data/arranjo.js (GRUPOS, ACESSO, CUSTO).');
  lin.push(` *  Busca: ${iteracoes ?? '?'} iteracoes, semente ${semente ?? '?'}.`);
  lin.push(` *  Grupos: norte ${r.sol.norte.join(' ')} | sul ${r.sol.sul.join(' ')}`);
  lin.push(' *');
  lin.push(' *  Custo (m de tubo de 3" de aco carbono equivalente) [ESTIMADO]:');
  lin.push(` *    hoje      ${fmt(a.total)}  (tubulacao ${fmt(a.tubo + a.cabecal + a.fora)}, laje e rack ${fmt(a.laje + a.rack)}; ${fmt(a.metros)} m de tubo)`);
  lin.push(` *    proposta  ${fmt(c.total)}  (tubulacao ${fmt(c.tubo + c.cabecal + c.fora)}, laje e rack ${fmt(c.laje + c.rack)}; ${fmt(c.metros)} m de tubo)`);
  lin.push(' *');
  lin.push(' *  A Fase 12 troca o ARRANJO de arranjo.js por este e refaz as rotas.');
  lin.push(' * ========================================================================= */');
  lin.push('');
  lin.push(`export const LAJE_PROPOSTA = { x: [${n(L.laje.x0)}, ${n(L.laje.x1)}], z: [${n(L.laje.z0)}, ${n(L.laje.z1)}] };`);
  lin.push('');
  lin.push(`export const RACK_PROPOSTO = { z: ${n(L.rack.z)}, largura: ${L.rack.largura} };`);
  lin.push('');
  lin.push('export const ARRANJO_PROPOSTO = [');
  let grupo = null;
  for (const it of itens) {
    const g = `${it.grupo}|${it.fileira}`;
    if (g !== grupo) {
      grupo = g;
      lin.push(`  // ${it.grupo === 'bombas' ? `bombas sob o rack, borda ${it.fileira}` : `fileira ${it.fileira}: grupo ${it.grupo}`}`);
    }
    const saque = ARRANJO.find((q) => q.tag === it.tag)?.saque;
    lin.push(`  { tag: '${it.tag}', x: ${n(it.x)}, z: ${n(it.z)}, giro: ${giro(it.giro)}${saque ? `, saque: ${saque}` : ''} },`);
  }
  lin.push('];');
  lin.push('');
  lin.push('/* Corredores transversais pintados (o do rack e a faixa do perimetro saem');
  lin.push(' * de LAJE_PROPOSTA, RACK_PROPOSTO e ACESSO). */');
  lin.push('export const CORREDORES_PROPOSTOS = [');
  for (const k of L.corredores) lin.push(`  { fileira: '${k.fileira}', x: [${n(k.x0)}, ${n(k.x1)}], z: [${n(k.z0)}, ${n(k.z1)}] },`);
  lin.push('];');
  lin.push('');
  return lin.join('\n');
}

/** Arranjo de hoje no mesmo modelo de custo, para comparar. */
export function arranjoAtual(med) {
  const isbl = BLOCOS.find((b) => b.id === 'ISBL');
  const itens = Object.fromEntries(ARRANJO.map((a) => [a.tag, { ...a, giro: norm(a.giro) }]));
  return { itens, med, corredores: [], laje: { x0: isbl.x[0], x1: isbl.x[1], z0: isbl.z[0], z1: isbl.z[1] }, rack: { z: RACK.z, largura: RACK.larguraMin } };
}

export { LIMITES };
