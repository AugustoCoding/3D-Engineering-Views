/**
 * ===========================================================================
 *  AUDITORIA DE ILUMINACAO  (Fase 26)  —  __auditarIluminacao()
 * ===========================================================================
 *  Mede a luz que a cena tem, com a mesma conta da colocacao e da noite
 *  (lib/fotometria.js): Em e Uo = Emin / Em em cada area, contra o alvo de
 *  data/iluminacao.js.
 *
 *  As luminarias vem da cena INTEIRA, pela interface da Fase 26:
 *    - `userData.luminarias = [{ p, dir, fluxo, facho, ... }]` no mundo
 *      (InstancedMesh e grupos de postes);
 *    - `userData.luminaria = { fluxo, facho, dir, ... }` num objeto so: com
 *      `p`, p e dir no mundo; sem `p`, a luz sai da origem do objeto e o
 *      `dir` esta no referencial dele.
 *  Assim o que a sessao local puser na laje entra na conta de quem esta
 *  perto dela, e vice-versa.
 *
 *  Rotas de fuga (seguranca.js): so com as luminarias de emergencia, no
 *  fluxo de emergencia (NBR 10898). Areas: a laje do ISBL (1 m) e 1 m em volta de cada bomba (0,5 m), com
 *  as luminarias da sessao local; cada via interna (grade da EN 13201-3: a cada 2 m ao
 *  longo, 3 pontos por faixa de rolamento), as faixas de aceleracao e
 *  desaceleracao da via publica (NBR 5101), cada calcada (2 pontos
 *  atravessados) e o estacionamento (grade de area da EN 12464).
 *
 *  Achados:
 *    ABAIXO_DO_ALVO    Em menor que o alvo da area
 *    UNIFORMIDADE      Uo menor que o alvo da area
 *    MINIMO            Emin menor que o minimo (alvo de seguranca, a cerca)
 *    POSTE_NA_VIA      pe de poste dentro da pista
 *    POSTE_NA_CALCADA  pe de poste dentro da calcada
 *    PASSO_SEM_ALVO    nenhum passo fecha o alvo nem numa faixa reta
 *  No resumo, `semLugar`: os postes que a colocacao nao achou onde por.
 *  Sem obstrucao (predio, tanque e rack nao fazem sombra na conta).
 * ===========================================================================
 */
import * as THREE from 'three';
import { VIAS, BLOCOS, LARGURA_CALCADA, CALCADAS } from '../data/site.js';
import { ALVOS, areasDeLuz, emEmergencia } from '../data/iluminacao.js';
import { prepararLuminarias, iluminancia, estatistica } from '../lib/fotometria.js';
import { distPontoSeg, ret } from '../lib/plano.js';

// piso da laje do ISBL (o que pousa nela esta em y = 0)
const Y_LAJE = 0;
const f1 = (v) => v.toFixed(1).replace('.', ',');
const f2 = (v) => v.toFixed(2).replace('.', ',');

/** Todas as luminarias da cena, no mundo, no formato de lib/fotometria.js. */
export function luminariasDaCena(raiz) {
  const out = [];
  raiz.updateMatrixWorld(true);
  raiz.traverse((o) => {
    const ud = o.userData;
    if (Array.isArray(ud?.luminarias)) out.push(...ud.luminarias);
    const l = ud?.luminaria;
    if (l && l.fluxo) {
      if (l.p) { out.push(l); return; }
      const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      const d = new THREE.Vector3(...(Array.isArray(l.dir) ? l.dir : [l.dir.x, l.dir.y, l.dir.z])).transformDirection(o.matrixWorld);
      out.push({ ...l, p: p.toArray(), dir: d.toArray() });
    }
  });
  return out;
}

export function auditarIluminacao({ cena, ambiente, todos }) {
  const t0 = performance.now();
  const fontes = luminariasDaCena(cena.scene);
  const lums = prepararLuminarias(fontes);
  const achados = [];
  const areas = [];
  let pontos = 0;

  const medir = (tipo, id, pts, alvo, filtro, conjunto = lums) => {
    if (!pts.length) return;
    pontos += pts.length;
    const Es = pts.map((q) => iluminancia(q, conjunto, { filtro }));
    const st = estatistica(Es);
    // onde esta o ponto mais escuro: para ir olhar
    const iMin = Es.indexOf(st.Emin);
    const onde = `(${f1(pts[iMin][0])}; ${f1(pts[iMin][2])})`;
    areas.push({ tipo, id, n: st.n, Em: +st.Em.toFixed(1), Emin: +st.Emin.toFixed(1), Uo: +st.Uo.toFixed(2), alvo, onde });
    if (st.Em < alvo.Em) achados.push({ regra: 'ABAIXO_DO_ALVO', tipo, id, detalhe: `Em ${f1(st.Em)} lx < ${alvo.Em} lx (${tipo} ${id})`, onde });
    if (alvo.Emin != null && st.Emin < alvo.Emin) achados.push({ regra: 'MINIMO', tipo, id, detalhe: `Emin ${f1(st.Emin)} lx < ${f1(alvo.Emin)} lx em ${onde} (${tipo} ${id})`, onde });
    if (alvo.Emin == null && st.Uo < alvo.Uo) achados.push({ regra: 'UNIFORMIDADE', tipo, id, detalhe: `Uo ${f2(st.Uo)} < ${f2(alvo.Uo)}, Emin ${f1(st.Emin)} lx em ${onde} (${tipo} ${id})`, onde });
  };
  // vias, faixas da via publica, calcadas e estacionamento: as areas de
  // data/iluminacao.js, as mesmas que a colocacao adensa
  // a rota de fuga se mede so com as de emergencia, no fluxo delas
  const lumsEm = prepararLuminarias(emEmergencia(fontes));
  for (const a of areasDeLuz()) medir(a.tipo, a.id, a.pts, a.alvo, a.filtro, a.emergencia ? lumsEm : lums);

  // laje (luminarias da sessao local): a area toda a cada 1 m, e cada bomba
  // com 1 m em volta dela (onde o operador le o instrumento e ve vazamento)
  const isbl = BLOCOS.find((q) => q.id === 'ISBL');
  if (isbl) {
    const r = ret(isbl), pts = [];
    for (let x = r.x0 + 0.5; x < r.x1; x += 1) for (let z = r.z0 + 0.5; z < r.z1; z += 1) pts.push([x, Y_LAJE, z]);
    medir('laje', 'ISBL', pts, ALVOS.laje);
  }
  for (const [tag, e] of Object.entries(todos ?? {})) {
    if (!/^B[CDV]-\d+/.test(tag) || !e?.grupo) continue;
    const b = new THREE.Box3().setFromObject(e.grupo);
    const pts = [];
    for (let x = b.min.x - 1 + 0.25; x < b.max.x + 1; x += 0.5) {
      for (let z = b.min.z - 1 + 0.25; z < b.max.z + 1; z += 0.5) pts.push([x, Y_LAJE, z]);
    }
    medir('bombas', tag, pts, ALVOS.bombas);
  }

  // pe de poste na pista ou na calcada
  for (const l of fontes) {
    if (!l.base) continue;
    const [x, z] = l.base, r = 0.35;
    const via = VIAS.find((v) => v.pontos.some((q, i) => i && distPontoSeg([x, z], v.pontos[i - 1], q) < v.largura / 2 + r * 0.5));
    if (via) achados.push({ regra: 'POSTE_NA_VIA', tipo: l.tipo, id: via.id, detalhe: `poste de ${l.tipo} em (${f1(x)}; ${f1(z)}), na via ${via.id}` });
    const calc = CALCADAS.find((c) => c.pontos.some((q, i) => i && distPontoSeg([x, z], c.pontos[i - 1], q) < LARGURA_CALCADA / 2 + r * 0.5));
    if (calc) achados.push({ regra: 'POSTE_NA_CALCADA', tipo: l.tipo, id: calc.id, detalhe: `poste de ${l.tipo} em (${f1(x)}; ${f1(z)}), na calcada ${calc.id}` });
  }
  // o que a colocacao nao fechou
  achados.push(...(ambiente?.grupo?.userData?.achadosLuz ?? []));

  const porRegra = {};
  for (const a of achados) porRegra[a.regra] = (porRegra[a.regra] ?? 0) + 1;
  const porTipo = {};
  for (const l of fontes) porTipo[l.tipo ?? 'outra'] = (porTipo[l.tipo ?? 'outra'] ?? 0) + 1;
  return {
    total: achados.length, porRegra, achados, areas,
    resumo: { luminarias: fontes.length, emergencia: fontes.filter((l) => l.emergencia).length, porTipo, semLugar: ambiente?.grupo?.userData?.semLugar ?? [], pontos, segundos: +((performance.now() - t0) / 1000).toFixed(1) },
  };
}
