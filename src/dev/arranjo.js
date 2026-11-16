import * as THREE from 'three';
import { BLOCOS, VIAS, vetorBarlavento, VENTO } from '../data/site.js';
import {
  ARRANJO, GUINDASTE, CONTENCAO, VENT, GRAVIDADE, SUCCAO_MAX, ACESSO, GRUPOS, faixaSaque, corredoresDaLaje,
} from '../data/arranjo.js';
import { TRECHOS, NOS } from '../data/rotas.js';
import { EXTRAS } from '../data/plant-extra.js';
import { EQUIPAMENTOS } from '../data/plant.js';
import { ret, distRetRet } from '../lib/plano.js';
import { pegadaDe } from '../lib/apoios.js';

/**
 * ===========================================================================
 *  AUDITORIA DE ARRANJO DA AREA DE PROCESSO  (Fase 4)
 * ===========================================================================
 *  A auditoria fisica (auditoria.js) olha cada equipamento por dentro; esta
 *  olha o conjunto na laje. Perguntas:
 *
 *    FORA_ISBL     equipamento saindo da laje
 *    SOBREPOSICAO  pegada sobre pegada, ou sobre sapata do pipe rack
 *    SAQUE         faixa de retirada do feixe ocupada, ou que passa da via
 *    GUINDASTE     area de guindaste ocupada, fora da via do anel ou longe
 *    GRAVIDADE     nivel do cristalizador abaixo do que o filtro precisa
 *    SUCCAO        bomba longe de onde aspira (a succao e a do P&ID)
 *    FUGA          plataforma com uma escada so
 *    TOMADA_AR     tomada de ar do compressor que nao e o ponto mais a
 *                  barlavento da area de processo
 *    VENT          vent baixo demais perto de plataforma
 *    CONTENCAO     mureta que nao retem o maior vaso
 *  E as de acesso da Fase 11 (ACESSO em arranjo.js):
 *    CORREDOR      equipamento, tubo, valvula ou apoio dentro de um corredor
 *                  abaixo do pe-direito livre
 *    FOLGA         pecas de grupos diferentes mais perto que a folga minima
 *    ALCANCE       equipamento longe de qualquer corredor
 *
 *  A pegada de cada equipamento e medida na cena (caixa das malhas, sem
 *  etiquetas nem cotas), nao lida dos dados: e o que existe de fato.
 *  No console: __auditarArranjo().
 */

const cruza = (a, b, folga = 0) =>
  a.x0 < b.x1 - folga && b.x0 < a.x1 - folga && a.z0 < b.z1 - folga && b.z0 < a.z1 - folga;

const f2 = (v) => v.toFixed(2).replace('.', ',');

function ancoraMundo(e, id) {
  const a = e?.ancoras?.[id];
  if (!a) return null;
  e.grupo.updateWorldMatrix(true, false);
  return a.pos.clone().applyMatrix4(e.grupo.matrixWorld);
}

export function auditarArranjo({ todos, rack, tubulacao, instrumentacao }) {
  const achados = [];
  const add = (regra, detalhe) => achados.push({ regra, detalhe });

  const isbl = ret(BLOCOS.find((b) => b.id === 'ISBL'));
  const pegadas = Object.fromEntries(Object.entries(todos).map(([t, e]) => [t, pegadaDe(e.grupo)]));

  // sapatas do rack: nos porticos que a tubulacao calculou (Fase 5)
  const sapatas = [];
  for (const x of rack.xs) {
    for (const s of [-1, 1]) {
      const z = rack.z + (s * rack.largura) / 2;
      sapatas.push({ x0: x - rack.sapata / 2, x1: x + rack.sapata / 2, z0: z - rack.sapata / 2, z1: z + rack.sapata / 2 });
    }
  }

  // FORA_ISBL e SOBREPOSICAO
  const tags = Object.keys(pegadas);
  for (const t of tags) {
    const p = pegadas[t];
    if (p.x0 < isbl.x0 || p.x1 > isbl.x1 || p.z0 < isbl.z0 || p.z1 > isbl.z1) add('FORA_ISBL', `${t} sai da laje`);
    if (sapatas.some((s) => cruza(p, s))) add('SOBREPOSICAO', `${t} sobre sapata do pipe rack`);
  }
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      if (cruza(pegadas[tags[i]], pegadas[tags[j]], 0.05)) add('SOBREPOSICAO', `${tags[i]} sobre ${tags[j]}`);
    }
  }

  // SAQUE
  for (const item of ARRANJO.filter((a) => a.saque)) {
    const f = faixaSaque(item, EXTRAS[item.tag].geom);
    for (const t of tags) {
      if (t !== item.tag && cruza(f, pegadas[t])) add('SAQUE', `faixa de saque do ${item.tag} ocupada por ${t}`);
    }
    if (sapatas.some((s) => cruza(f, s))) add('SAQUE', `faixa de saque do ${item.tag} sobre sapata do rack`);
    // Desde a Fase 11 o feixe sai para fora, sobre a faixa do perimetro, ate o
    // acostamento e a via do anel, onde fica o caminhao que o recebe: pode
    // sair da laje, mas nao passar da via (9 m alem da borda).
    const ALEM = 9;
    if (f.x0 < isbl.x0 - ALEM || f.x1 > isbl.x1 + ALEM || f.z0 < isbl.z0 - ALEM || f.z1 > isbl.z1 + ALEM) {
      add('SAQUE', `faixa de saque do ${item.tag} passa da via do anel`);
    }
  }

  // GUINDASTE: livre, longe no maximo 6 m do vaso que atende e — desde a
  // Fase 11 — sobre a via do anel, fora da laje
  const gz = { x0: GUINDASTE.x[0], x1: GUINDASTE.x[1], z0: GUINDASTE.z[0], z1: GUINDASTE.z[1] };
  for (const t of tags) if (cruza(gz, pegadas[t])) add('GUINDASTE', `área de guindaste ocupada por ${t}`);
  if (distRetRet(gz, pegadas[GUINDASTE.atende]) > 6) add('GUINDASTE', `área longe do ${GUINDASTE.atende}`);
  if (GUINDASTE.naVia) {
    if (cruza(gz, isbl)) add('GUINDASTE', 'área de guindaste sobre a laje');
    const anel = VIAS.find((q) => q.id === 'anel-processo');
    const m = anel.largura / 2;
    const naVia = anel.pontos.slice(1).some(([bx, bz], k) => {
      const [ax, az] = anel.pontos[k];
      return cruza(gz, { x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m });
    });
    if (!naVia) add('GUINDASTE', 'área de guindaste fora da via do anel');
  }

  // GRAVIDADE: nivel do cristalizador (acima do piso) contra o eixo do tambor
  for (const g of GRAVIDADE) {
    const cr = EXTRAS[g.de].geom;
    const nivel = cr.elevacao + cr.nivel;
    const eixo = EXTRAS[g.para].geom.alturaEixo;
    if (nivel - eixo < g.margem) {
      add('GRAVIDADE', `${g.de} → ${g.para}: nível a ${f2(nivel)} m, eixo do filtro a ${f2(eixo)} m (margem ${g.margem} m)`);
    }
  }

  // SUCCAO: a de cada bomba e o trecho do P&ID que chega ao bocal S dela; de
  // um no, vale o bocal a que o no esta preso (a V-15 fica na propria BC-01:
  // ai vale a linha que chega a ela)
  for (const t of TRECHOS.filter((q) => /^B[CV]-\d+\.S$/.test(q.para))) {
    const bomba = t.para.split('.')[0];
    let de = t.de;
    if (de.includes('@')) {
      const no = de.split('@')[0];
      de = NOS[no].perto;
      if (de.startsWith(`${bomba}.`)) {
        const entra = TRECHOS.find((q) => q.para.startsWith(`${no}@`) && !q.de.startsWith('B'));
        de = entra.de.includes('@') ? NOS[entra.de.split('@')[0]].perto : entra.de;
      }
    }
    const [fonte, bocal] = de.split('.');
    const s = ancoraMundo(todos[bomba], 'S');
    const o = ancoraMundo(todos[fonte], bocal);
    if (!s || !o) { add('SUCCAO', `${bomba}: âncora não encontrada`); continue; }
    const d = s.distanceTo(o);
    if (d > SUCCAO_MAX) add('SUCCAO', `${bomba} a ${f2(d)} m de ${fonte}.${bocal} (máx. ${SUCCAO_MAX} m)`);
  }

  // FUGA: toda plataforma com duas escadas
  for (const [tag, eq] of Object.entries(EQUIPAMENTOS)) {
    if (eq.geom.plataforma && (eq.geom.escada?.angulos?.length ?? 0) < 2) {
      add('FUGA', `plataforma do ${tag} com ${eq.geom.escada?.angulos?.length ?? 0} escada(s)`);
    }
  }

  // TOMADA_AR: a tomada do compressor e o ponto mais a barlavento da area de
  // processo — nada de onde vaze vapor fica entre ela e o vento
  const [vx, vz] = vetorBarlavento(VENTO.de);
  const tomada = ancoraMundo(todos['CP-01'], 'S');
  const proj = (x, z) => x * vx + z * vz;
  for (const [t, p] of Object.entries(pegadas)) {
    if (t === 'CP-01') continue;
    const maisAlto = Math.max(proj(p.x0, p.z0), proj(p.x1, p.z0), proj(p.x0, p.z1), proj(p.x1, p.z1));
    if (maisAlto > proj(tomada.x, tomada.z)) add('TOMADA_AR', `${t} fica a barlavento da tomada de ar do CP-01`);
  }

  // VENT: saida acima das plataformas proximas
  const v = ARRANJO.find((a) => a.tag === VENT.tag);
  for (const [tag, eq] of Object.entries(EQUIPAMENTOS)) {
    const pl = eq.geom.plataforma;
    const pos = ARRANJO.find((a) => a.tag === tag);
    if (!pl || !pos) continue;
    const d = Math.hypot(pos.x - v.x, pos.z - v.z);
    const cota = eq.geom.saiaAltura + pl.elevacao;
    if (d <= VENT.raio && VENT.altura < cota + VENT.folga) {
      add('VENT', `vent a ${VENT.altura} m; plataforma do ${tag} a ${f2(cota)} m, ${f2(d)} m de distância`);
    }
  }

  // CONTENCAO: volume retido contra o maior vaso
  const area = (isbl.x1 - isbl.x0) * (isbl.z1 - isbl.z0);
  const bases = tags.reduce((s, t) => {
    const p = pegadas[t];
    return s + Math.min((p.x1 - p.x0) * (p.z1 - p.z0), 25);   // so a base ocupa o piso
  }, 0);
  const retido = (area - bases) * CONTENCAO.mureta.altura;
  const maior = Math.max(...Object.values(EQUIPAMENTOS).map((e) => e.geom.volumeTotal ?? 0));
  if (retido < maior) add('CONTENCAO', `retém ${f2(retido)} m³, maior vaso ${f2(maior)} m³`);

  // --- acesso (Fase 11) ---
  const corredores = corredoresDaLaje();
  const naoLivre = ACESSO.peDireito;
  const dentro = (b, c) => b.x0 < c.x1 - 0.02 && c.x0 < b.x1 - 0.02 && b.z0 < c.z1 - 0.02 && c.z0 < b.z1 - 0.02;
  // CORREDOR: equipamento. A escada do R-01 desce no corredor de proposito
  // (e por ela que se chega a ele): nao conta. Nem o que fica acima do
  // pe-direito — a plataforma do R-01, a 9,4 m, avanca sobre a faixa do
  // perimetro sem tirar a passagem de ninguem.
  const semEscada = (grupo) => {
    const caixa = new THREE.Box3();
    grupo.updateWorldMatrix(true, true);
    grupo.traverse((o) => {
      if (!o.isMesh) return;
      for (let n = o; n && n !== grupo.parent; n = n.parent) if (/rotulo|cota|escala|escada/.test(n.name)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (b.min.y >= naoLivre) return;
      caixa.union(b);
    });
    return { x0: caixa.min.x, x1: caixa.max.x, z0: caixa.min.z, z1: caixa.max.z };
  };
  for (const t of tags) {
    const pg = semEscada(todos[t].grupo);
    const c = corredores.find((q) => dentro(pg, q));
    if (c) add('CORREDOR', `${t} dentro do corredor (${c.tipo})`);
  }
  // CORREDOR: tubo abaixo do pe-direito (fundo do tubo)
  for (const tubo of tubulacao?.tubos ?? []) {
    const pts = tubo.pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (Math.min(a.y, b.y) - tubo.r >= naoLivre) continue;
      const seg = { x0: Math.min(a.x, b.x) - tubo.r, x1: Math.max(a.x, b.x) + tubo.r, z0: Math.min(a.z, b.z) - tubo.r, z1: Math.max(a.z, b.z) + tubo.r };
      const c = corredores.find((q) => dentro(seg, q));
      if (c) { add('CORREDOR', `linha ${tubo.id} a ${f2(Math.min(a.y, b.y))} m dentro do corredor (${c.tipo})`); break; }
    }
  }
  // CORREDOR: valvula, instrumento e apoio (cada peca com ficha)
  const pecas = [];
  for (const g of [instrumentacao?.grupo, tubulacao?.grupo?.getObjectByName('apoios-tubulacao')].filter(Boolean)) {
    g.updateWorldMatrix(true, true);
    for (const o of g.children) {
      if (!o.userData?.ficha) continue;
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty() || b.min.y >= naoLivre) continue;
      pecas.push({ nome: o.userData.ficha.titulo, x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z });
    }
  }
  for (const p of pecas) {
    const c = corredores.find((q) => dentro(p, q));
    if (c) add('CORREDOR', `${p.nome} dentro do corredor (${c.tipo})`);
  }
  // FOLGA: pecas de grupos diferentes (bomba com bomba: a folga das bombas)
  const grupoDe = Object.fromEntries(GRUPOS.flatMap((g) => g.itens.map((i) => [i.tag, g.id])));
  const ehBomba = (t) => /^B[CV]-/.test(t);
  const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const [a, b] = [tags[i], tags[j]];
      if (grupoDe[a] && grupoDe[a] === grupoDe[b]) continue;
      const min = ehBomba(a) && ehBomba(b) ? ACESSO.folgaBombas : ehBomba(a) || ehBomba(b) ? 0.6 : ACESSO.folga;
      const d = gap(pegadas[a], pegadas[b]);
      if (d < min - 0.02) add('FOLGA', `${a} e ${b} a ${f2(d)} m (mín. ${f2(min)} m)`);
    }
  }
  // ALCANCE: todo equipamento a poucos passos de um corredor
  for (const t of tags) {
    const d = Math.min(...corredores.map((c) => gap(pegadas[t], c)));
    if (d > ACESSO.alcanceOperacao) add('ALCANCE', `${t} a ${f2(d)} m do corredor mais perto (máx. ${f2(ACESSO.alcanceOperacao)} m)`);
  }

  const porRegra = {};
  for (const a of achados) (porRegra[a.regra] ??= []).push(a);
  return { total: achados.length, porRegra, achados, retido, maior };
}
