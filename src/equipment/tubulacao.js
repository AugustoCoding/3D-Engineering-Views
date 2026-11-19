import * as THREE from 'three';
import { tuboPorCaminho, criarReducao } from '../lib/pipe.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { rotulo } from '../lib/dimensions.js';
import {
  tracar, trechoNoRack, arranjarRack, faixaProvisoria, proibidosNoRack, porticosDoRack,
} from '../lib/rota.js';
import {
  pegadaDe, obstaculosDe, criarPoste, criarGuia, criarEstai, criarFunil, apoioCabe,
} from '../lib/apoios.js';
import { MAT } from '../core/materials.js';
import { criarChapeu, criarCortaChamas, criarFiltroAdmissao } from '../lib/pontas.js';
import { DN, EQUIPAMENTOS } from '../data/plant.js';
import { EXTRAS } from '../data/plant-extra.js';
import {
  LINHAS, CODIGOS, MATERIAIS, CORRENTES, UTILIDADES, PRESSAO, BOMBAS, VALVULAS,
} from '../data/pid.js';
import { RACK, ARRANJO, GUINDASTE, faixaSaque, corredoresDaLaje } from '../data/arranjo.js';
import { correnteDoTrecho, servicoDoTrecho, pedacoDeSuccao, npshDaBomba } from '../lib/hidraulica.js';
import {
  NOS, LIMITES, DESTINOS, TRECHOS, ABERTAS, CABECAIS, RAMAIS, PASSA, CORES, VAO_ADMISSIVEL,
  RISER_LIVRE, DN_MIN_SEM_BANDEJA, CODIGOS_MAQUETE,
} from '../data/rotas.js';

/**
 * ===========================================================================
 *  TUBULACAO DE INTERLIGACAO  (Fase 5)
 * ===========================================================================
 *
 *  Toda linha do P&ID, montada a partir de dados: o que liga em que vem de
 *  data/pid.js, por onde passa vem de data/rotas.js, e o roteador
 *  (lib/rota.js) transforma os passos em vertices. Nada de coordenada
 *  digitada: se um equipamento muda de lugar, a linha, o rack e os apoios
 *  acompanham.
 *
 *  A ordem importa:
 *    1. tracar cada trecho com uma faixa provisoria, para saber que pedaco
 *       de X ele ocupa no rack;
 *    2. distribuir as faixas e tirar dai a largura do rack;
 *    3. tracar de novo, agora na faixa certa;
 *    4. por os porticos onde nenhuma linha cruza a estrutura, e os apoios
 *       onde o piso deixa;
 *    5. medir a viabilidade (hidraulica, apoio, rota) — o que nao fecha vira
 *       achado, que __auditar() mostra junto com os geometricos.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RHO_G = 850 * 9.81;                  // liquido de processo tipico, Pa/m
const f1 = (v) => v.toFixed(1).replace('.', ',');
const f2 = (v) => v.toFixed(2).replace('.', ',');
const kg = (v) => Math.round(v).toLocaleString('pt-BR').replace(/\./g, ' ');

const FACES = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1],
};

const materiais = {};
/** Material da linha pelo codigo do fluido: o mesmo dentro e fora dos limites. */
export function matCodigo(codigo) {
  if (!materiais[codigo]) {
    materiais[codigo] = new THREE.MeshStandardMaterial({
      color: CORES[codigo] ?? 0xb0b8c0, metalness: 0.45, roughness: 0.5, name: `linha-${codigo}`,
    });
  }
  return materiais[codigo];
}

const nomeCodigo = (c) => CODIGOS[c] ?? CODIGOS_MAQUETE[c] ?? '';

const LINHA = new Map();
for (const l of LINHAS) if (!LINHA.has(l.numero)) LINHA.set(l.numero, l);

/** Corrente de um trecho: a explicita, a ultima da linha ('S-18 → S-19')
 *  ou a da linha-mae (05A, 09A...). Uma conta so, a da hidraulica. */
const correnteDe = (t) => correnteDoTrecho(t);

function composicao(c) {
  const partes = [['tolueno', c.tol], ['O₂', c.o2], ['N₂', c.n2], ['ácido benzoico', c.ab], ['água', c.h2o]]
    .filter(([, v]) => v > 0)
    .map(([n, v]) => `${n} ${kg(v)}`);
  return `${partes.join(' · ')} kg/h`;
}

function comprimento(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]);
  return s;
}

/** Ancora de bocal ('TAG.BOCAL') em coordenadas de mundo; null se nao existir. */
export function ancoraMundo(todos, chave) {
  const [tag, bocal] = chave.split('.');
  const e = todos[tag];
  const a = e?.ancoras?.[bocal];
  if (!a) return null;
  e.grupo.updateMatrixWorld(true);
  return {
    tipo: 'bocal', tag, bocal, chave,
    pos: a.pos.clone().applyMatrix4(e.grupo.matrixWorld),
    dir: a.dir.clone().applyQuaternion(e.grupo.getWorldQuaternion(new THREE.Quaternion())).normalize(),
    dn: a.dn,
  };
}

export function criarTubulacao(todos) {
  const raiz = new THREE.Group();
  raiz.name = 'tubulacao';
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  const apoios = new THREE.Group();
  apoios.name = 'apoios-tubulacao';
  const achados = [];
  const achar = (regra, peca, detalhe, ponto) => achados.push({
    regra, tag: '—', peca, detalhe,
    ponto: ponto ? [+ponto.x.toFixed(2), +ponto.y.toFixed(2), +ponto.z.toFixed(2)] : null,
  });

  /* ======================================================================
   *  1. Pontas
   * =================================================================== */
  const ancora = (chave) => ancoraMundo(todos, chave);

  const nos = {};
  for (const [nome, n] of Object.entries(NOS)) {
    const a = ancora(n.perto);
    if (!a) { achar('NO_SEM_BASE', nome, `bocal ${n.perto} não existe`); continue; }
    nos[nome] = { tag: nome, descricao: n.nome, pos: a.pos.clone().add(V(...n.d)), dns: [], faces: [] };
  }

  function ponta(spec) {
    if (typeof spec === 'object') return { tipo: 'cabecal', id: spec.cabecal };
    if (spec === 'DRENO') return { tipo: 'dreno', dir: V(0, 1, 0) };
    if (spec.startsWith('LB:')) {
      const lado = spec.slice(3);
      return { tipo: 'lb', lado, dir: V(...LIMITES[lado].dir) };
    }
    if (spec.includes('@')) {
      const [nome, face] = spec.split('@');
      const n = nos[nome];
      if (!n) return null;
      return { tipo: 'no', no: nome, pos: n.pos.clone(), dir: V(...FACES[face]), chave: `no:${nome}` };
    }
    return ancora(spec);
  }

  /* ======================================================================
   *  2. Itens: trechos de processo, ramais e cabecais
   * =================================================================== */
  const itens = [];
  TRECHOS.forEach((t, i) => {
    const L = LINHA.get(t.linha);
    const A = ponta(t.de), B = ponta(t.para);
    if (!L || !A || !B) {
      achar('TRECHO_SEM_PONTA', `Linha ${t.linha}`, `${t.de} → ${t.para}`);
      return;
    }
    itens.push({
      id: `t${i}`, tipo: 'processo', t, L, A, B, dn: L.dn, od: DN[L.dn].od, nivel: 1,
      fluido: L.fluido, numero: t.linha, passos: t.rota,
    });
  });

  const cabecais = Object.fromEntries(CABECAIS.map((c) => [c.id, { ...c, od: DN[c.dn].od, tes: [] }]));
  RAMAIS.forEach((r, i) => {
    const A = ancora(r.de);
    if (!A) { achar('TRECHO_SEM_PONTA', `Ramal ${r.de}`, `bocal ${r.de} não existe`); return; }
    const c = cabecais[r.cabecal];
    const L = r.linha ? LINHA.get(r.linha) : null;
    itens.push({
      id: `r${i}`, tipo: 'ramal', t: r, L, A, B: { tipo: 'cabecal', id: r.cabecal },
      dn: A.dn, od: DN[A.dn].od, nivel: 2, fluido: c.fluido, numero: r.linha ?? null,
      passos: r.rota, cabecal: c,
    });
  });

  /** Onde o ramal toca o cabecal: o X depois dos passos dele ('x:d±',
   * 'x:A±' ou absoluto). */
  function xDoTe(it) {
    const xA = it.A.pos.x + it.A.dir.x * (it.t.sai ?? 0.5);
    let x = xA;
    for (const p of it.passos) {
      const [eixo, tok] = p.split(':');
      if (eixo !== 'x') continue;
      if (tok.startsWith('d')) x += Number(tok.slice(1));
      else if (tok.startsWith('A')) x = xA + Number(tok.slice(1) || 0);
      else x = Number(tok);
    }
    return x;
  }

  /* ======================================================================
   *  3. Tracado
   * =================================================================== */
  const usaRack = (it) => it.tipo === 'ramal' || it.A.tipo === 'lb' || it.B.tipo === 'lb'
    || it.passos.some((p) => /rack|lat|borda/.test(p));

  function tracarItem(it, faixa, rack, faixaCab) {
    const A = { ...it.A, sai: it.t.sai ?? (it.A.tipo === 'no' ? 0.25 : 0.5) };
    const B = { ...it.B, chega: it.t.chega ?? (it.B.tipo === 'no' ? 0.25 : 0.5) };
    if (A.tipo === 'lb') { A.pos = V(LIMITES[A.lado].x, faixa.y, faixa.z); A.sai = 0.3; }
    if (B.tipo === 'lb') { B.pos = V(LIMITES[B.lado].x, faixa.y, faixa.z); B.chega = 0.3; }
    if (B.tipo === 'cabecal') {
      B.pos = V(xDoTe(it), faixaCab.y, faixaCab.z);
      B.dir = V(0, 1, 0);
      B.chega = faixaCab.yLat - faixaCab.y;
    }
    if (B.tipo === 'dreno') {
      // Funil sob o ponto onde os passos terminam, com a boca a 0,15 m.
      const p = it.A.pos.clone().addScaledVector(it.A.dir, A.sai);
      for (const s of it.passos) {
        const [eixo, tok] = s.split(':');
        p[eixo] = tok.startsWith('A') ? p[eixo] + Number(tok.slice(1) || 0) : p[eixo];
      }
      B.pos = V(p.x, 0.15, p.z);
      B.chega = 0;
    }
    it.Bfinal = B;
    return tracar(A, B, it.passos, { faixa, rack }, { queda: it.t.queda ?? 0 });
  }

  const rackProv = { z: RACK.z, largura: RACK.larguraMin, folgaBorda: RACK.folgaBorda };
  const ladoDoRack = (z) => (Math.abs(z - RACK.z) < 0.3 ? 0 : Math.sign(z - RACK.z));
  const ocupacao = [];
  for (const it of itens) {
    const faixa = faixaProvisoria(RACK, it.nivel, it.od);
    const faixaCab = it.cabecal ? faixaProvisoria(RACK, 2, it.cabecal.od) : null;
    let pts;
    try {
      pts = tracarItem(it, faixa, rackProv, faixaCab);
    } catch (e) {
      achar('ROTA_INVALIDA', `Linha ${it.numero ?? it.t.de}`, e.message);
      it.falhou = true;
      continue;
    }
    if (it.tipo === 'ramal') {
      it.cabecal.tes.push(xDoTe(it));
      (it.cabecal.lados ??= []).push(ladoDoRack(it.A.pos.z));
      continue;
    }
    if (!usaRack(it)) continue;
    const tr = trechoNoRack(pts, faixa.y);
    // de que lado do rack a linha chega e sai: a faixa fica desse lado
    const lados = [it.A, it.B].filter((P) => P.tipo !== 'lb' && P.pos).map((P) => ladoDoRack(P.pos.z));
    const lado = lados.length && lados.every((l) => l === lados[0]) ? lados[0] : 0;
    if (tr) ocupacao.push({ id: it.id, nivel: it.nivel, od: it.od, x0: tr[0], x1: tr[1], lado });
  }
  for (const c of Object.values(cabecais)) {
    if (!c.tes.length) continue;
    c.x0 = Math.min(...c.tes) - 0.5;
    c.x1 = LIMITES.leste.x;
    const lado = c.lados.every((l) => l === c.lados[0]) ? c.lados[0] : 0;
    ocupacao.push({ id: `cab-${c.id}`, nivel: 2, od: c.od, x0: c.x0, x1: c.x1, lado });
  }

  const arr = arranjarRack(ocupacao, RACK);
  const rack = { z: RACK.z, largura: arr.largura, folgaBorda: RACK.folgaBorda };

  const caminhos = [];
  for (const it of itens) {
    if (it.falhou) continue;
    const faixa = arr.faixas.get(it.id) ?? faixaProvisoria(RACK, it.nivel, it.od);
    const faixaCab = it.cabecal ? arr.faixas.get(`cab-${it.cabecal.id}`) : null;
    it.faixa = arr.faixas.get(it.id) ?? null;
    it.pts = tracarItem(it, faixa, rack, faixaCab);
    caminhos.push({ pts: it.pts, r: it.od / 2, id: it.id });
  }
  for (const c of Object.values(cabecais)) {
    if (!c.tes.length) continue;
    c.faixa = arr.faixas.get(`cab-${c.id}`);
    c.pts = [V(c.x0, c.faixa.y, c.faixa.z), V(c.x1, c.faixa.y, c.faixa.z)];
    caminhos.push({ pts: c.pts, r: c.od / 2, id: `cab-${c.id}` });
  }

  /* ======================================================================
   *  4. Rack: porticos fora das travessias, bandejas das linhas pequenas
   * =================================================================== */
  // Coluna de portico nao fica num corredor transversal: ele atravessa a
  // linha de colunas para chegar ao corredor do rack.
  const proibidos = [
    ...proibidosNoRack(caminhos, rack, RACK),
    ...corredoresDaLaje().filter((c) => c.tipo === 'transversal').map((c) => [c.x0 - 0.15, c.x1 + 0.15]),
  ];
  // o rack avanca ate o portico de virada dos pipeways, no acostamento
  const x0r = Math.min(...ocupacao.map((o) => o.x0), LIMITES.oeste.xPortico ?? Infinity);
  const x1r = Math.max(...ocupacao.map((o) => o.x1), LIMITES.leste.xPortico ?? -Infinity);

  /* Travessias (Fase 12): trecho que cruza o rack de lado, na cota lateral.
   * Com o rack de 7 m (bombas sob as bordas), ele vence mais que o vao do
   * tubo. Apoia-se na longarina de cada borda que cruza e, se ainda sobrar
   * vao, num pe sobre a viga do portico mais perto — o portico e posto a
   * 0,4–1,0 m da travessia para isso. */
  const zBN = rack.z - rack.largura / 2, zBS = rack.z + rack.largura / 2;
  const travessias = [];
  for (const it of itens) {
    if (it.falhou || !it.pts) continue;
    for (let i = 1; i < it.pts.length; i++) {
      const a = it.pts[i - 1], b = it.pts[i];
      if (Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.x - b.x) > 1e-6) continue;
      const z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
      if (z1 - z0 < 0.3 || z1 < zBN - 0.5 || z0 > zBS + 0.5 || a.y < RACK.niveis[0]) continue;
      const bop = Math.max(...RACK.niveis.filter((y) => y <= a.y - it.od / 2 + 1e-6));
      const bordas = [zBN, zBS].filter((z) => z > z0 && z < z1);
      const pontos = [z0, ...bordas, z1];
      const vao = VAO_ADMISSIVEL[it.dn] ?? 3;
      const longe = pontos.slice(1).some((z, k) => z - pontos[k] > vao);
      travessias.push({ it, a, b, x: a.x, y: a.y, z0, z1, bop, bordas, pontos, vao, longe, r: it.od / 2 });
    }
  }
  const topoRack = RACK.niveis[RACK.niveis.length - 1];
  for (const t of travessias) t.rente = t.y - t.r > topoRack + 0.2;
  const port = porticosDoRack(x0r, x1r, proibidos, RACK.vaoMax,
    travessias.filter((t) => t.longe).map((t) => ({ x: t.x, rente: t.rente })));
  if (port.forcados) achar('PORTICO_FORCADO', 'Pipe rack', `${port.forcados} pórtico(s) sobre uma travessia de linha`);
  const vaoRack = port.xs.slice(1).reduce((m, x, i) => Math.max(m, x - port.xs[i]), 0);
  const bandejas = [];
  for (const o of ocupacao) {
    const f = arr.faixas.get(o.id);
    const dn = o.id.startsWith('cab-') ? cabecais[o.id.slice(4)].dn : itens.find((i) => i.id === o.id).dn;
    // 0,3 m mais curta em cada ponta: o riser que sobe para a faixa nao a fura.
    if (dn < DN_MIN_SEM_BANDEJA && o.x1 - o.x0 > 1) {
      bandejas.push({ nivel: f.nivel, z: f.z, x0: o.x0 + 0.3, x1: o.x1 - 0.3 });
    }
  }
  const layoutRack = {
    z: RACK.z, largura: arr.largura, niveis: RACK.niveis, xs: port.xs, sapata: RACK.sapata,
    bandejas, linhas: ocupacao.length, vaoMax: RACK.vaoMax,
  };

  /* ======================================================================
   *  5. Malhas e fichas
   * =================================================================== */
  const nomePonta = (P) => {
    if (P.tipo === 'bocal') return `${P.tag} · ${P.bocal}`;
    if (P.tipo === 'no') return P.no;
    if (P.tipo === 'lb') return `limite de bateria (${P.lado})`;
    if (P.tipo === 'dreno') return 'dreno fechado';
    return `cabeçal ${P.id}`;
  };

  function fichaProcesso(it, L) {
    const S = correnteDe(it.t, L);
    const c = S ? CORRENTES[S] : null;
    const Lr = comprimento(it.pts);
    const ident = {
      'Identificação': L.id,
      'Fluido': `${L.fluido} — ${nomeCodigo(L.fluido)}`,
      'Diâmetro': `${L.id.split('"')[0]}" (DN ${L.dn})`,
      'Material': MATERIAIS[L.material] ?? L.material,
      'Trecho': `${nomePonta(it.A)} → ${nomePonta(it.B)}`,
      'Comprimento': `${f1(Lr)} m · ${it.pts.length - 2} curvas`,
    };
    if (L.origem === 'proposta' || L.via?.some((v) => BOMBAS.find((b) => b.tag === v)?.origem === 'proposta')) {
      ident['Situação'] = 'Passa por bomba proposta pela maquete (pendente de revisão)';
    }
    if (L.origem === 'datasheet') ident['Origem'] = 'Só no Datasheet (não desenhada no P&ID)';
    if (L.origem === 'balanco') ident['Origem'] = 'Só no balanço de massa (não desenhada no P&ID)';
    if (L.origem === 'desenho') ident['Origem'] = 'Desenhada sem rótulo no P&ID';
    const grupos = [{ nome: 'Linha', dados: ident }];
    if (c) {
      grupos.push({
        nome: `Corrente ${S}`,
        dados: {
          'Vazão': `${kg(c.total)} kg/h`,
          'Composição': composicao(c),
          'Temperatura': `${kg(c.T)} °C`,
          'Pressão': `${String(c.P).replace('.', ',')} bar`,
        },
      });
    }
    const obs = [L.obs, it.t.queda ? `Desce ${(it.t.queda * 100).toFixed(0)} % até o destino: suspensão não pode ter ponto baixo` : null]
      .filter(Boolean);
    if (obs.length) grupos.push({ nome: 'Observação', dados: Object.fromEntries(obs.map((o, i) => [`${i + 1}`, o])) });
    return { titulo: `Linha ${L.numero}`, subtitulo: `${nomePonta(it.A)} → ${nomePonta(it.B)}`, grupos };
  }

  function fichaRamal(it) {
    const c = it.cabecal;
    const u = UTILIDADES.find((x) => x.equip === it.A.tag);
    const alimenta = c.id === 'CWS' || c.id === 'STM';
    const dados = {
      'Identificação': it.L?.id ?? `sem número no P&ID (${c.id})`,
      'Fluido': `${c.fluido} — ${CODIGOS[c.fluido]}`,
      'Diâmetro': `DN ${it.dn} (o do bocal)`,
      'Serviço': `${alimenta ? 'Alimentação' : 'Retorno'} de ${it.A.tag} (${it.A.bocal})`,
      'Comprimento': `${f1(comprimento(it.pts))} m · ${it.pts.length - 2} curvas`,
    };
    if (u) { dados['Vazão'] = u.vazao; dados['Calor'] = u.calor; }
    return {
      titulo: it.L ? `Linha ${it.L.numero}` : `Ramal de ${CODIGOS[c.fluido].toLowerCase()}`,
      subtitulo: alimenta ? `Cabeçal ${c.id} → ${nomePonta(it.A)}` : `${nomePonta(it.A)} → cabeçal ${c.id}`,
      grupos: [{ nome: 'Utilidade (Quadro B9)', dados }],
    };
  }

  function etiquetaNumero(texto, pts, od) {
    // No meio do trecho mais longo, que e onde a etiqueta menos se confunde.
    let k = 1, maior = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].distanceTo(pts[i - 1]);
      if (d > maior) { maior = d; k = i; }
    }
    const lbl = rotulo(texto, 'linha-num');
    lbl.position.copy(pts[k - 1]).lerp(pts[k], 0.5).add(V(0, od + 0.2, 0));
    rotulos.add(lbl);
  }

  function flangeDeLimite(p, dir, dn, ficha, destino) {
    const fl = criarBocal({ dn, comprimento: 0.05 });
    orientarPara(fl, p.clone().addScaledVector(dir, 0.03), dir.clone().negate());
    fl.userData.ficha = ficha;
    raiz.add(fl);
    const lbl = rotulo(`→ ${destino}`, 'linha-label');
    lbl.position.copy(p).add(V(0, 0.45, 0));
    rotulos.add(lbl);
  }

  // Pontas no limite de bateria: os pipeways (site/pipeways.js) continuam
  // daqui, na mesma cota e faixa, com o mesmo material.
  const limites = [];
  let feitas = 0;
  for (const it of itens) {
    if (it.falhou) continue;
    const mat = matCodigo(it.fluido);
    const tubo = tuboPorCaminho(it.pts, { dn: it.dn, mat });
    const ficha = it.tipo === 'processo' ? fichaProcesso(it, it.L) : fichaRamal(it);
    tubo.name = `linha-${it.numero ?? it.id}`;
    tubo.userData.ficha = ficha;
    tubo.userData.linha = it.numero;
    tubo.userData.item = it.id;
    raiz.add(tubo);
    // bocal maior que a linha: reducao concentrica na ponta (Fase 25)
    for (const [P, ponta, antes] of [[it.A, it.pts[0], it.pts[1]], [it.Bfinal ?? it.B, it.pts.at(-1), it.pts.at(-2)]]) {
      if (P?.tipo !== 'bocal' || !P.dn || P.dn <= it.dn || !DN[P.dn]) continue;
      tubo.add(criarReducao({ ponta, dir: ponta.clone().sub(antes), dnMaior: P.dn, dnMenor: it.dn, mat }));
    }
    feitas++;
    if (it.tipo === 'processo') etiquetaNumero(it.numero, it.pts, it.od);

    // Cada no guarda as faces por onde as linhas chegam: a de tres vias se
    // orienta por elas (instrumentacao.js).
    for (const P of [it.A, it.Bfinal]) {
      if (P.tipo === 'no') { nos[P.no].dns.push(it.dn); nos[P.no].faces.push({ dir: P.dir.clone(), item: it.id }); }
    }
    if (it.B.tipo === 'lb' || it.A.tipo === 'lb') {
      const P = it.B.tipo === 'lb' ? it.Bfinal : it.A;
      const fim = it.B.tipo === 'lb' ? it.pts[it.pts.length - 1] : it.pts[0];
      flangeDeLimite(fim, V(...LIMITES[P.lado].dir), it.dn, ficha, DESTINOS[it.numero] ?? 'limite de bateria');
      limites.push({
        id: it.numero, lado: P.lado, pos: fim.clone(), dn: it.dn, od: it.od, fluido: it.fluido, mat, ficha,
      });
    }
    if (it.B.tipo === 'dreno') {
      const f = criarFunil({ x: it.Bfinal.pos.x, z: it.Bfinal.pos.z, yBoca: 0.15 });
      f.userData.ficha = {
        titulo: 'Dreno fechado', subtitulo: `Recebe a linha ${it.numero}`,
        grupos: [{ nome: 'Serviço', dados: { 'Destino': DESTINOS[it.numero] ?? 'ETE', 'Por quê': 'O V-02 opera a 1 bar: a água desce por gravidade, não sobe ao rack' } }],
      };
      raiz.add(f);
      const lbl = rotulo(`→ ${DESTINOS[it.numero] ?? 'dreno'}`, 'linha-label');
      lbl.position.copy(it.Bfinal.pos).add(V(0, 0.5, 0));
      rotulos.add(lbl);
    }
  }

  // cabecais: tubo reto, tampa no fim oeste, flange no limite de bateria
  for (const c of Object.values(cabecais)) {
    if (!c.pts) continue;
    const ficha = {
      titulo: `Cabeçal ${c.id}`, subtitulo: c.nome,
      grupos: [{
        nome: 'Utilidade', dados: {
          'Fluido': `${c.fluido} — ${CODIGOS[c.fluido]}`,
          'Diâmetro (estimado)': `DN ${c.dn}`,
          'Vazão total': c.vazao,
          'Ramais': String(c.tes.length),
          'Origem': DESTINOS[c.id],
          'Comprimento': `${f1(c.x1 - c.x0)} m no rack, nível 2`,
        },
      }],
    };
    const tubo = tuboPorCaminho(c.pts, { dn: c.dn, mat: matCodigo(c.fluido) });
    tubo.name = `cabecal-${c.id}`;
    tubo.userData.ficha = ficha;
    raiz.add(tubo);
    const tampa = new THREE.Mesh(new THREE.SphereGeometry(c.od / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matCodigo(c.fluido));
    tampa.rotation.z = Math.PI / 2;
    tampa.position.copy(c.pts[0]);
    raiz.add(tampa);
    flangeDeLimite(c.pts[1], V(...LIMITES.leste.dir), c.dn, ficha, DESTINOS[c.id]);
    limites.push({
      id: c.id, lado: 'leste', pos: c.pts[1].clone(), dn: c.dn, od: c.od, fluido: c.fluido,
      mat: matCodigo(c.fluido), ficha,
    });
    const lbl = rotulo(c.id, 'linha-num');
    lbl.position.copy(c.pts[0]).lerp(c.pts[1], 0.15).add(V(0, c.od + 0.2, 0));
    rotulos.add(lbl);
  }

  // nos que nao sao valvula: te soldado (as valvulas vem de instrumentacao.js)
  const ehValvula = new Set(VALVULAS.map((v) => v.tag));
  for (const n of Object.values(nos)) {
    if (!n.dns.length || ehValvula.has(n.tag)) continue;
    const od = Math.max(...n.dns.map((d) => DN[d].od));
    const te = new THREE.Mesh(new THREE.SphereGeometry(od * 0.75, 16, 12), MAT.acoCarbono);
    te.position.copy(n.pos);
    te.castShadow = true;
    const ehTe = n.tag.startsWith('P-');
    te.userData.ficha = {
      titulo: n.tag, subtitulo: n.descricao,
      grupos: [{ nome: 'Nó de tubulação', dados: {
        'Linhas que se encontram': String(n.dns.length),
        'Corpo': ehTe ? 'Tê soldado' : 'A válvula entra na Fase 6; por ora, o tê',
      } }],
    };
    raiz.add(te);
    const lbl = rotulo(n.tag, 'bocal-label');
    lbl.position.copy(n.pos).add(V(0, od + 0.15, 0));
    rotulos.add(lbl);
  }

  // pontas abertas: vent, respiro, tomada de ar
  const abertas = [];
  for (const a of ABERTAS) {
    const A = ancora(a.de);
    if (!A) { achar('TRECHO_SEM_PONTA', a.linha ?? a.id, `bocal ${a.de} não existe`); continue; }
    const comp = a.ate != null ? a.ate - A.pos.y : a.comprimento;
    const fim = A.pos.clone().addScaledVector(A.dir, comp);
    const L = a.linha ? LINHA.get(a.linha) : null;
    const dn = L?.dn ?? A.dn;
    const fluido = L?.fluido ?? (a.id === 'AR' ? 'AR' : 'MRV');
    const pts = [A.pos.clone(), fim];
    const tubo = tuboPorCaminho(pts, { dn, mat: matCodigo(fluido) });
    const ficha = L ? {
      titulo: `Linha ${L.numero}`, subtitulo: `${nomePonta(A)} → ${a.destino}`,
      grupos: [{ nome: 'Linha', dados: {
        'Identificação': L.id, 'Fluido': `${L.fluido} — ${CODIGOS[L.fluido]}`,
        'Saída': `${f1(fim.y)} m do piso`, 'Observação': L.obs ?? '',
        ...(a.estaiar ? { 'Sustentação': 'Estaiado: 2" com essa altura não se sustenta sozinho' } : {}),
      } }],
    } : { titulo: a.destino, subtitulo: nomePonta(A), grupos: [{ nome: 'Ponta aberta', dados: a.ficha }] };
    tubo.userData.ficha = ficha;
    tubo.name = `aberta-${a.linha ?? a.id}`;
    raiz.add(tubo);
    // Terminal da ponta: nada fica aberto para cima (chuva, passaro, chama).
    const TERMINAIS = { chapeu: criarChapeu, 'corta-chamas': criarCortaChamas, filtro: criarFiltroAdmissao };
    if (a.terminal) {
      const term = TERMINAIS[a.terminal]({ dn });
      orientarPara(term, fim, A.dir);
      term.userData.ficha = ficha;
      raiz.add(term);
    }
    abertas.push({ a, A, fim, dn, pts });
    caminhos.push({ pts, r: DN[dn].od / 2, id: `aberta-${a.linha ?? a.id}` });
    const lbl = rotulo(`↑ ${a.destino}`, 'linha-label');
    lbl.position.copy(fim).add(V(0, 0.4, 0));
    rotulos.add(lbl);
  }

  /* ======================================================================
   *  6. Apoios
   * =================================================================== */
  const pegadas = Object.fromEntries(Object.entries(todos).map(([t, e]) => [t, pegadaDe(e.grupo)]));
  const infla = (p, m) => ({ x0: p.x0 - m, x1: p.x1 + m, z0: p.z0 - m, z1: p.z1 + m });
  // Corredores (Fase 11): nenhum poste no caminho de quem anda ou do veiculo
  // de manutencao — o corredor sob o rack, os transversais e a faixa do
  // perimetro.
  const corredores = corredoresDaLaje();
  // Para o poste, peca a peca e com a altura (obstaculosDe): sob a
  // plataforma do R-01 ou um trocador elevado ha piso. Os outros (seguranca,
  // ambiente) recebem a pegada inteira, que e o que eles precisam.
  const restoOcupado = [
    ...corredores,
    { x0: GUINDASTE.x[0], x1: GUINDASTE.x[1], z0: GUINDASTE.z[0], z1: GUINDASTE.z[1] },
    ...ARRANJO.filter((a) => a.saque).map((a) => faixaSaque(a, EXTRAS[a.tag].geom)),
    ...port.xs.flatMap((x) => [-1, 1].map((s) => {
      const zc = rack.z + (s * rack.largura) / 2;
      return { x0: x - 0.35, x1: x + 0.35, z0: zc - 0.35, z1: zc + 0.35 };
    })),
  ];
  const ocupados = [...Object.values(pegadas).map((p) => infla(p, 0.1)), ...restoOcupado];
  const ocupadosApoio = [...Object.values(todos).flatMap((e) => obstaculosDe(e.grupo)), ...restoOcupado];

  /* Travessias: pe sobre a longarina de cada borda que a linha cruza; onde o
   * vao ainda passa do admissivel, mao-francesa do portico mais perto (viga
   * em balanco ate o X da linha) com pes a cada vao, fora das faixas. */
  const faixasZ = [...arr.faixas.values()];
  const pe = (x, z, y0, y1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, y1 - y0, 0.08), MAT.acoCarbono);
    m.position.set(x, (y0 + y1) / 2, z);
    m.castShadow = true;
    return m;
  };
  const fichaTravessia = (t, tipo) => ({
    titulo: 'Apoio de travessia do rack', subtitulo: `Linha ${t.it.numero ?? t.it.id}`,
    grupos: [{ nome: 'Especificação', dados: {
      'Tipo': tipo, 'Altura do pé': `${f2(t.y - t.r - t.bop)} m sobre a viga`,
      'Vão admissível': `${f1(t.vao)} m (ASME B31.1, Tab. 121.5)`,
    } }],
  });
  const ehTravessia = new Set();
  for (const t of travessias) {
    ehTravessia.add(`${t.it.id}|${t.a.x}|${t.a.z}|${t.b.z}`);
    for (const z of t.bordas) {
      const m = pe(t.x, z, t.bop, t.y - t.r);
      m.userData.ficha = fichaTravessia(t, 'Pé sobre a longarina de borda');
      apoios.add(m);
    }
    if (!t.longe) continue;
    const xf = port.xs.find((x) => Math.abs(x - t.x) >= (t.rente ? 0 : 0.3) && Math.abs(x - t.x) <= 1.05);
    if (xf === undefined) {
      achar('VAO_LIVRE', `Linha ${t.it.numero ?? t.it.id}`,
        `travessia de ${f1(t.z1 - t.z0)} m no rack sem pórtico perto para apoiá-la`, t.a.clone().lerp(t.b, 0.5));
      continue;
    }
    // pes no meio de cada vao longo, fora das faixas (nao pousam num tubo)
    const livreDeFaixa = (z) => !faixasZ.some((f) => Math.abs(f.z - z) < 0.12 && Math.abs(f.y - t.bop) < 1.0);
    for (let k = 1; k < t.pontos.length; k++) {
      const [za, zb] = [t.pontos[k - 1], t.pontos[k]];
      const n = Math.ceil((zb - za) / t.vao) - 1;
      for (let j = 1; j <= n; j++) {
        const base = za + ((zb - za) * j) / (n + 1);
        let z = base;
        for (let d = 0.05; d < 0.6 && !livreDeFaixa(z); d += 0.05) z = livreDeFaixa(base + d) ? base + d : base - d;
        const g = new THREE.Group();
        g.add(pe(t.x, z, t.bop, t.y - t.r));
        const braco = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(t.x - xf) + 0.08, 0.08, 0.08), MAT.acoCarbono);
        braco.position.set((t.x + xf) / 2, t.bop + 0.04, z);
        g.add(braco);
        g.userData.ficha = fichaTravessia(t, `Mão-francesa do pórtico em x = ${f2(xf)} m`);
        apoios.add(g);
      }
    }
  }

  // Vasos verticais: guiam o riser que corre junto ao costado deles.
  const vasos = Object.entries(todos).map(([tag, e]) => {
    const g = EQUIPAMENTOS[tag]?.geom ?? EXTRAS[tag]?.geom;
    const vertical = EQUIPAMENTOS[tag] || EXTRAS[tag]?.tipo === 'vaso-vertical';
    if (!g?.Di || !vertical) return null;
    const c = new THREE.Vector3();
    e.grupo.getWorldPosition(c);
    const r = g.Di / 2 + (g.camisa?.folga ?? 0) + (g.isolamento ?? 0) + 0.02;
    // a guia e soldada no costado e atravessa isolamento (e camisa, onde ha):
    // vai ate a chapa, 1 cm para dentro dela. Ate o isolamento, ficava a
    // 7–8 cm da camisa sem tocar nada (Fase 25)
    const rChapa = g.Di / 2 + (g.espessura ?? 0.008) - 0.01;
    return { tag, c, r, rChapa, y1: pegadas[tag].y1 };
  }).filter(Boolean);
  const vasoJunto = (p, folga = 1.0) => vasos.find((v) => p.y <= v.y1 + 0.5
    && Math.hypot(p.x - v.c.x, p.z - v.c.z) - v.r <= folga);

  // Riser dentro do rack ou a ate 0,8 m da borda: guiado pelas longarinas.
  const zN = rack.z - rack.largura / 2, zS = rack.z + rack.largura / 2;
  const naBordaDoRack = (p) => p.x >= x0r - 0.3 && p.x <= x1r + 0.3
    && p.z >= zN - 0.8 && p.z <= zS + 0.8;
  const noRack = (a, b, it) => it?.faixa && Math.abs(a.y - it.faixa.y) < 1e-6 && Math.abs(b.y - it.faixa.y) < 1e-6
    && Math.abs(a.z - b.z) < 1e-6;

  const postes = [];
  function porApoio(it, a, b) {
    const span = VAO_ADMISSIVEL[it.dn] ?? 3;
    const eixo = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
    const L = a.distanceTo(b);
    const n = Math.ceil(L / span) - 1;
    const r = it.od / 2;
    let falhou = 0;
    for (let k = 1; k <= n; k++) {
      const s0 = k / (n + 1);
      const passo = Math.min(0.2 / L, 0.5 / (n + 1));
      let feito = false;
      for (let tent = 0; tent <= 12 && !feito; tent++) {
        for (const sinal of tent === 0 ? [0] : [1, -1]) {
          const s = s0 + sinal * tent * passo;
          if (s <= 0.02 || s >= 0.98) continue;
          const p = a.clone().lerp(b, s);
          const yApoio = p.y - r;
          const ja = postes.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.3 && Math.abs(q.yApoio - yApoio) < 0.05);
          if (ja) { feito = true; break; }
          if (yApoio > 9 || !apoioCabe({ x: p.x, z: p.z, yApoio }, ocupadosApoio, caminhos, it.id)) continue;
          const poste = criarPoste({ x: p.x, z: p.z, yApoio, eixo });
          poste.userData.ficha = {
            titulo: 'Apoio de tubulação', subtitulo: `Linha ${it.numero ?? it.id}`,
            grupos: [{ nome: 'Especificação', dados: {
              'Tipo': yApoio < 0.45 ? 'Berço de concreto' : 'Poste de aço com travessa',
              'Altura': `${f2(yApoio)} m`,
              'Vão admissível': `${f1(span)} m (ASME B31.1, Tab. 121.5)`,
            } }],
          };
          apoios.add(poste);
          postes.push({ x: p.x, z: p.z, yApoio });
          ocupados.push({ x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2 });
          ocupadosApoio.push({ x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2 });
          feito = true;
          break;
        }
      }
      if (!feito) falhou++;
    }
    return falhou;
  }

  /* Trecho baixo correndo ao longo do rack, a ate 0,8 m da linha de colunas
   * (o recuo entre o rack e a fileira): pendurado na longarina do nivel 1,
   * com tirante e um braco curto ate o tubo — e assim que se faz em campo,
   * e o piso do recuo fica livre para as subidas e as bombas. */
  const BOP1 = RACK.niveis[0];
  const rente = (p) => p.x >= x0r && p.x <= x1r && p.y < BOP1 - 0.5
    && ((p.z >= zS - 0.05 && p.z <= zS + 0.8) || (p.z <= zN + 0.05 && p.z >= zN - 0.8));
  function pendurar(it, a, b, span) {
    const L = a.distanceTo(b);
    const n = Math.ceil(L / span) - 1;
    const r = it.od / 2;
    for (let k = 1; k <= n; k++) {
      const p = a.clone().lerp(b, k / (n + 1));
      const zc = Math.abs(p.z - zS) < Math.abs(p.z - zN) ? zS : zN;
      const g = new THREE.Group();
      const tirante = new THREE.Mesh(new THREE.BoxGeometry(0.03, BOP1 - 0.2 - (p.y + r), 0.03), MAT.acoCarbono);
      tirante.position.set(p.x, (BOP1 - 0.2 + p.y + r) / 2, p.z);
      const braco = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, Math.abs(p.z - zc) + 0.06), MAT.acoCarbono);
      braco.position.set(p.x, BOP1 - 0.23, (p.z + zc) / 2);
      const berco = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 2 * r + 0.06), MAT.acoCarbono);
      berco.position.set(p.x, p.y - r - 0.015, p.z);
      g.add(tirante, braco, berco);
      g.userData.ficha = {
        titulo: 'Suporte pendurado', subtitulo: `Linha ${it.numero ?? it.id}`,
        grupos: [{ nome: 'Especificação', dados: {
          'Tipo': 'Tirante da longarina do rack (nível 1) e berço',
          'Vão admissível': `${f1(span)} m (ASME B31.1, Tab. 121.5)`,
        } }],
      };
      apoios.add(g);
    }
  }

  function guias(it, a, b, v) {
    const r = it.od / 2;
    const n = Math.max(1, Math.floor(a.distanceTo(b) / 3));
    for (let k = 1; k <= n; k++) {
      const p = a.clone().lerp(b, k / (n + 1));
      apoios.add(criarGuia(p, r, v.c, v.rChapa));
    }
  }

  const apoiaveis = [...itens.filter((i) => !i.falhou)];
  for (const it of apoiaveis) {
    const pts = it.pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const L = a.distanceTo(b);
      if (L < 0.05) continue;
      const vertical = Math.abs(b.y - a.y) > 0.9 * L;
      if (vertical) {
        if (L <= RISER_LIVRE * (VAO_ADMISSIVEL[it.dn] ?? 3)) continue;
        const meio = a.clone().lerp(b, 0.5);
        const v = vasoJunto(meio);
        if (v) guias(it, a, b, v);
        else if (!naBordaDoRack(meio)) {
          achar('RISER_SEM_GUIA', `Linha ${it.numero ?? it.id}`,
            `riser de ${f1(L)} m longe de costado e do rack`, meio);
        }
        continue;
      }
      if (Math.abs(b.y - a.y) > 0.1 * L) continue;              // curva/diagonal curta
      if (noRack(a, b, it)) continue;
      if (ehTravessia.has(`${it.id}|${a.x}|${a.z}|${b.z}`)) continue;   // apoiada no rack (acima)
      const span = VAO_ADMISSIVEL[it.dn] ?? 3;
      if (L <= span) continue;
      if (rente(a) && rente(b) && Math.abs(a.z - b.z) < 1e-6) { pendurar(it, a, b, span); continue; }
      const v = vasoJunto(a.clone().lerp(b, 0.5), 1.2);
      if (v && vasoJunto(a, 1.2) && vasoJunto(b, 1.2)) { guias(it, a, b, v); continue; }
      const falhas = porApoio(it, a, b);
      if (falhas) {
        achar('VAO_LIVRE', `Linha ${it.numero ?? it.id}`,
          `${f1(L)} m a ${f1(a.y)} m sem lugar para ${falhas} apoio(s) (vão admissível ${f1(span)} m)`,
          a.clone().lerp(b, 0.5));
      }
    }
  }

  // vent estaiado: tres estais em dois niveis, ancoras onde o piso deixa
  for (const { a, A, fim } of abertas) {
    if (!a.estaiar) continue;
    const H = fim.y;
    let ok = false;
    // Ancoras a 0,3–0,4 H do pe, onde o piso deixa (fora de corredor e de
    // equipamento). Na laje compacta da Fase 11 um lado do V-01 e o rack:
    // os tres estais nao precisam estar a 120° exatos — basta nenhum vao
    // entre eles passar de 150°, para o vent nao ter lado sem estai.
    const angs = Array.from({ length: 72 }, (_, i) => i * 5);
    for (const fr of [0.4, 0.35, 0.3]) {
      if (ok) break;
      const raio = fr * H;
      const ponto = (g) => V(A.pos.x + raio * Math.cos(THREE.MathUtils.degToRad(g)), 0.1, A.pos.z + raio * Math.sin(THREE.MathUtils.degToRad(g)));
      const livres = angs.filter((g) => { const p = ponto(g); return apoioCabe({ x: p.x, z: p.z, yApoio: 0.3 }, ocupadosApoio, caminhos, null); });
      let melhor = null;
      for (let i = 0; i < livres.length; i++) for (let j = i + 1; j < livres.length; j++) for (let k = j + 1; k < livres.length; k++) {
        const [g1, g2, g3] = [livres[i], livres[j], livres[k]];
        const vao = Math.max(g2 - g1, g3 - g2, 360 - g3 + g1);
        if (vao <= 150 && (!melhor || vao < melhor.vao)) melhor = { vao, gs: [g1, g2, g3] };
      }
      if (!melhor) continue;
      for (const g of melhor.gs) {
        for (const h of [0.55 * H, 0.95 * H]) apoios.add(criarEstai(V(A.pos.x, h, A.pos.z), ponto(g)));
      }
      ok = true;
    }
    if (!ok) achar('VENT_SEM_ESTAI', `Linha ${a.linha}`, 'nenhuma posição de âncora livre no piso', fim);
  }

  /* ======================================================================
   *  7. Viabilidade: hidraulica, succao, descida, rota
   * =================================================================== */
  const superficie = {};
  for (const [tag, e] of Object.entries(todos)) {
    let y = null;
    e.grupo.traverse((o) => {
      if (o.isMesh && o.material?.name === 'liquido') {
        const b = new THREE.Box3().setFromObject(o);
        y = Math.max(y ?? -Infinity, b.max.y);
      }
    });
    superficie[tag] = y;
  }

  const processo = itens.filter((i) => i.tipo === 'processo' && !i.falhou);
  const saem = new Map();
  for (const it of processo) {
    const k = it.A.tipo === 'no' ? `no:${it.A.no}` : it.A.tipo === 'bocal' ? it.A.chave : null;
    if (k) saem.set(k, [...(saem.get(k) ?? []), it]);
  }
  const ehBomba = (tag) => /^B[CD]-/.test(tag);
  const saidaDe = Object.fromEntries(Object.entries(PASSA).map(([saida, entrada]) => [entrada, saida]));
  const liquido = (it) => !['AR', 'MRV', 'VAC'].includes(it.fluido) && !it.t.vapor;

  /** Trechos que continuam o liquido depois deste: pelo no, ou atravessando
   * o trocador (entra num bocal, sai pelo outro). */
  function seguintes(it) {
    const B = it.B;
    if (B.tipo === 'no') return saem.get(`no:${B.no}`) ?? [];
    if (B.tipo === 'bocal' && saidaDe[B.chave]) return saem.get(saidaDe[B.chave]) ?? [];
    return [];
  }

  /* HIDRAULICA: o liquido que sai de um vaso, sem bomba no caminho, so sobe o
   * que a diferenca de pressao vence. Segue-se a cadeia inteira — por nos e
   * por trocadores — ate um vaso, uma succao de bomba ou o limite de bateria.
   * Numa juncao a corrente vale por si: outra corrente bombeada que entre no
   * mesmo no nao empurra esta; ao contrario, a pressao dela e que esta tem
   * de vencer. */
  for (const ini of processo) {
    const A = ini.A;
    if (!liquido(ini) || A.tipo !== 'bocal' || ehBomba(A.tag) || PASSA[A.chave]) continue;
    const Ps = PRESSAO[A.tag] ?? 1;
    const ySup = superficie[A.tag] ?? A.pos.y;
    const andar = (it, maxY, ondeMax, vistos) => {
      if (vistos.has(it.id)) return;
      vistos.add(it.id);
      for (const p of it.pts) if (p.y > maxY) { maxY = p.y; ondeMax = { p, it }; }
      const prox = seguintes(it).filter(liquido);
      if (prox.length) { for (const x of prox) andar(x, maxY, ondeMax, new Set(vistos)); return; }
      const B = it.B;
      if (B.tipo === 'bocal' && ehBomba(B.tag)) return;            // a bomba assume
      const Pd = B.tipo === 'bocal' ? PRESSAO[B.tag] ?? 1 : 1;
      const sobe = maxY - ySup;
      const vence = ((Ps - Pd) * 1e5) / RHO_G;
      if (sobe > 0.05 && sobe > vence - 0.3) {
        achar('HIDRAULICA', `Linha ${ondeMax.it.numero}`,
          `o líquido do ${A.tag} sobe ${f1(sobe)} m acima da superfície dele; `
          + `a pressão disponível vence ${f1(Math.max(0, vence))} m — falta bomba`, ondeMax.p);
      }
    };
    andar(ini, -Infinity, null, new Set());
  }

  /* NPSH (Fase 23): de cada bomba de liquido, a succao ate o vaso de onde
   * ela aspira — pelos nos, sem atravessar outra bomba (a bomba a montante
   * empurra; vale o caminho que chega sem ela) nem trocador (a pressao do
   * trocador e a do dado, PRESSAO). A cota de onde se aspira e a superficie
   * do liquido (a malha, que sai de nivelDeVolume); sem nivel modelado — o
   * trocador, e o filtro, cujo filtrado e torta saem do tambor e nao da
   * cuba —, a do bocal de saida. */
  const npsh = {};
  for (const b of BOMBAS) {
    if (b.tipo === 'vacuo' || !todos[b.tag]) continue;
    const segs = [];
    let it = processo.find((i) => i.B.tipo === 'bocal' && i.B.tag === b.tag && i.B.bocal === 'S');
    while (it) {
      segs.unshift(it);
      if (it.A.tipo !== 'no') break;
      const no = it.A.no;
      it = processo.find((i) => i.B.tipo === 'no' && i.B.no === no && liquido(i) && !(i.A.tipo === 'bocal' && ehBomba(i.A.tag)));
    }
    const A = segs[0]?.A;
    const eixo = ancora(`${b.tag}.S`);
    if (!A || A.tipo !== 'bocal' || !eixo) continue;
    const z = /^F-/.test(A.tag) ? A.pos.y : superficie[A.tag] ?? A.pos.y;
    const pedacos = segs.map((s) => {
      const S = correnteDe(s.t);
      const servico = servicoDoTrecho(s.t, s.L, S);
      return pedacoDeSuccao({ S, servico, dn: s.dn, material: s.L.material, pts: s.pts, semAtrito: servico === 'torta', rotulo: `linha ${s.numero}` });
    });
    const eq = EXTRAS[b.tag];
    npsh[b.tag] = npshDaBomba({ tag: b.tag, tipo: eq.tipo, geom: eq.geom, origem: { tag: A.tag, bocal: A.bocal, z }, pedacos, zEixo: eixo.pos.y });
  }

  for (const it of processo) {
    const nome = `Linha ${it.numero}`;
    const ys = it.pts.map((p) => p.y);

    // SUCCAO: sem ponto alto entre a origem e a bomba (bolsa de vapor).
    if (it.B.tipo === 'bocal' && /^BC-/.test(it.B.tag) && it.B.bocal === 'S') {
      const lim = Math.max(ys[0], ys[ys.length - 1]) + 0.05;
      const alto = ys.slice(1, -1).findIndex((y) => y > lim);
      if (alto >= 0) achar('SUCCAO_ALTA', nome, 'a sucção sobe acima da origem e da bomba', it.pts[alto + 1]);
    }

    // DESCE: suspensao, torta e dreno descem o tempo todo.
    const desce = it.t.queda || (it.B.tipo === 'bocal' && /^BD-/.test(it.B.tag)) || it.B.tipo === 'dreno';
    if (desce) {
      const sobe = ys.findIndex((y, i) => i > 0 && y > ys[i - 1] + 0.01);
      if (sobe >= 0) achar('PONTO_BAIXO', nome, 'linha que deveria só descer volta a subir', it.pts[sobe]);
    }
  }

  // ROTA: comprimento contra o minimo. Para linha de rack, o minimo e o
  // caminho canonico (sobe a lateral, entra na faixa, corre, desce); para as
  // locais, a distancia ortogonal entre os bocais.
  const resumo = [];
  for (const it of itens.filter((i) => !i.falhou && i.pts)) {
    const Lr = comprimento(it.pts);
    const a = it.pts[0], b = it.pts[it.pts.length - 1];
    let Lmin = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
    if (it.faixa) {
      const f = it.faixa;
      Lmin = Math.abs(a.y - f.yLat) + Math.abs(a.z - f.z) + Math.abs(a.x - b.x)
        + Math.abs(f.z - b.z) + Math.abs(f.yLat - b.y) + 2 * Math.abs(f.yLat - f.y);
    }
    const excesso = Lr - Lmin;
    resumo.push({ linha: it.numero ?? it.t.de, comprimento: +Lr.toFixed(1), minimo: +Lmin.toFixed(1), curvas: it.pts.length - 2 });
    if (excesso > Math.max(4, 0.5 * Lmin) && !it.t.desvio) {
      achar('ROTA_LONGA', `Linha ${it.numero ?? it.t.de}`,
        `${f1(Lr)} m contra ${f1(Lmin)} m do caminho mínimo, sem desvio justificado em rotas.js`);
    }
  }

  // COBERTURA: toda linha do P&ID desenhada, toda bomba posta.
  const desenhadas = new Set([...itens.filter((i) => !i.falhou).map((i) => i.numero), ...ABERTAS.map((a) => a.linha)]);
  for (const l of LINHAS) if (!desenhadas.has(l.numero)) achar('LINHA_FALTANDO', `Linha ${l.numero}`, l.id);
  for (const b of BOMBAS) if (!todos[b.tag]) achar('BOMBA_FALTANDO', b.tag, b.servico);

  raiz.add(apoios);
  raiz.add(rotulos);
  return {
    grupo: raiz, rotulos, rack: layoutRack, linhas: feitas, achados, resumo,
    caminhos: caminhos.map((c) => c.pts),
    // para a instrumentacao (Fase 6): trechos tracados, nos e obstaculos
    itens: itens.filter((i) => !i.falhou), nos, tubos: caminhos, ocupados, ocupadosApoio, corredores, superficie,
    // NPSH de cada bomba de liquido (Fase 23), para __auditarHidraulica
    npsh,
    limites,
    // pontas abertas (vent, respiro, exaustao): fontes de vapor da Fase 8
    pontas: abertas.map(({ a, fim }) => ({ id: a.linha ?? a.id, destino: a.destino, pos: fim.clone() })),
  };
}
