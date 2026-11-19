import * as THREE from 'three';
import { PARADAS, CAPITULOS, MOVIMENTO } from '../data/passeio.js';
import { PORTAS } from '../data/entorno.js';
import { PLACA } from '../data/ambiente.js';
import { BLOCOS, LOTE, PRACA_PORTARIA, ONIBUS, VIAS } from '../data/site.js';
import { RACK } from '../data/arranjo.js';
import { LONGE } from '../data/rotinas.js';

/**
 * ===========================================================================
 *  PASSEIO AUTOMATICO DE CAMERA  (Fase 22)
 * ===========================================================================
 *  Aperta-se uma vez e assiste-se: a camera percorre as paradas de
 *  data/passeio.js num trajeto so, sem corte — longe se percorre por cima —,
 *  e recomeca sozinha.
 *    - Cada parada vira um trecho lento (orbita, travelling, entrada pela
 *      porta com uma volta na sala); entre paradas a camera sobe em arco,
 *      tanto mais quanto mais longe. Posicao e alvo em duas splines
 *      Catmull-Rom centripetas; o tempo sai da velocidade de cada trecho,
 *      que muda devagar (sem tranco).
 *    - Ponto de passagem que cai dentro de parede, equipamento ou objeto
 *      sobe ate ficar livre.
 *    - Quem tem evento a mostrar (o onibus abrindo a porta, o caminhao
 *      entrando de re) e posto fora de cena e retido ate a hora certa; quem
 *      tem rotina tem o relogio acertado no comeco, com a camera alta (de
 *      longe ninguem e desenhado).
 *  Legenda embaixo (onde estamos, o que vem) e mini-mapa com a rota.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const centro = (r) => [(r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2];

export function criarPasseio({ cena, todos, tubulacao, entorno, interiores, ambiente, rotinas, operacoes }) {
  const camera = cena.camera;
  const bloco = (id) => BLOCOS.find((b) => b.id === id);
  const objeto = (nome) => entorno.objetos.find((o) => o.nome === nome)?.grupo;
  const caixa = (g) => new THREE.Box3().setFromObject(g);

  /* ---------------------------------------------------- o que e solido */
  const solidos = [];
  // `r`: a caixa sem a folga da camera — o que tapa a vista (ALVO_ESCONDIDO)
  for (const [tag, e] of Object.entries(todos)) { const r = caixa(e.grupo); solidos.push({ b: r.clone().expandByScalar(0.4), r, nome: tag }); }
  for (const o of entorno.objetos) {
    // predio e oco: dele contam as paredes (colisores), nao a caixa
    if (/^predio-|^casa-/.test(o.nome)) continue;
    const r = caixa(o.grupo);
    solidos.push({ b: r.clone().expandByScalar(0.3), r, nome: o.nome });
  }
  // o pipe rack (vigas e bandejas) e cada trecho de tubo: a camera nao
  // atravessa viga nem linha
  if (tubulacao) {
    const R = tubulacao.rack, z0 = R.z - R.largura / 2, z1 = R.z + R.largura / 2;
    const xa = Math.min(...R.xs), xb = Math.max(...R.xs);
    solidos.push({ b: new THREE.Box3(V(xa - 0.5, R.niveis[0] - 0.7, z0 - 0.4), V(xb + 0.5, R.niveis.at(-1) + 0.8, z1 + 0.4)), nome: 'pipe rack' });
    for (const x of R.xs) for (const z of [z0, z1]) solidos.push({ b: new THREE.Box3(V(x - 0.45, 0, z - 0.45), V(x + 0.45, R.niveis.at(-1) + 0.8, z + 0.45)), nome: 'pipe rack' });
    for (const tb of tubulacao.tubos) {
      for (let k = 1; k < tb.pts.length; k++) {
        const a = tb.pts[k - 1], b = tb.pts[k];
        solidos.push({ b: new THREE.Box3().setFromPoints([V(a.x, a.y, a.z), V(b.x, b.y, b.z)]).expandByScalar(0.35), nome: 'tubo' });
      }
    }
  }
  const paredes = interiores.colisores.map((c) => new THREE.Box3(V(c.x0 - 0.15, c.y0, c.z0 - 0.15), V(c.x1 + 0.15, c.y1, c.z1 + 0.15)));
  // moveis altos (armario, estante, porta-palete, capela) tambem
  for (const it of interiores.interiores) {
    for (const m of it.registro.moveis) {
      if (m.h < 1.5) continue;
      const y0 = (m.ref?.y ?? 0) + (m.y0 ?? 0);
      solidos.push({ b: new THREE.Box3(V(m.ret.x0 - 0.3, y0, m.ret.z0 - 0.3), V(m.ret.x1 + 0.3, y0 + m.h + 0.2, m.ret.z1 + 0.3)),
        r: new THREE.Box3(V(m.ret.x0, y0, m.ret.z0), V(m.ret.x1, y0 + m.h, m.ret.z1)), nome: m.nome, movel: true });
    }
  }
  // `sem`: o equipamento cuja caixa nao conta — junto do visor a camera
  // esta dentro da caixa do vaso, na plataforma dele
  const livre = (p, sem) => p.y > 0.8 && !solidos.some((s) => s.nome !== sem && s.b.containsPoint(p)) && !paredes.some((b) => b.containsPoint(p));
  /** A reta de a a b livre, medida a cada 0,2 m; com `folga`, tambem as
   *  paralelas a essa distancia de cada lado (a curva passa um pouco fora). */
  const retaLivre = (a, b, folga = 0, sem) => {
    const n = Math.ceil(a.distanceTo(b) / 0.2);
    const lado = V(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(folga);
    for (let k = 1; k < n; k++) {
      const p = a.clone().lerp(b, k / n);
      if (!livre(p, sem) || (folga && (!livre(p.clone().add(lado), sem) || !livre(p.clone().sub(lado), sem)))) return false;
    }
    return true;
  };
  /** Sobe o ponto ate ficar livre (de 1,5 em 1,5 m, ate 50 m). */
  const subir = (p, sem) => { const q = p.clone(); for (let k = 0; k < 34 && !livre(q, sem); k++) q.y += 1.5; return q; };
  /** Sobe a sequencia inteira junto, de metro em metro, ate cada ponto e
   *  cada reta entre eles passar livre: sem pulo de um ponto so. */
  const nivelar = (ps) => {
    for (let k = 0; k < 30 && !ps.every((q, i) => livre(q.p) && (!i || retaLivre(ps[i - 1].p, q.p))); k++) ps.forEach((q) => { q.p.y += 1; });
    return ps;
  };
  // dentro de predio nada sobe: furaria a laje de cobertura
  const cascas = interiores.interiores.map((it) => ({ r: it.registro.ret, topo: caixa(it.predio).max.y }));
  const emPredio = (p) => cascas.some(({ r, topo }) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && p.y < topo);

  /* ---------------------------------------------------- foco de cada parada */
  const isbl = bloco('ISBL');
  const meioLote = V((LOTE.x[0] + LOTE.x[1]) / 2, 0, (LOTE.z[0] + LOTE.z[1]) / 2);
  const portaDe = (b) => {
    const P = PORTAS.find((q) => q.bloco === b);
    const n = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[P.lado];
    return { p: P.porta, n };
  };
  // equipamento pela TAG, objeto pelo nome — um so ou a lista
  const titulo = (par) => par.titulo ?? par.nome;
  const gruposDe = (par) => (par.tipo === 'equip' || par.tipo === 'visor' ? [par.tag].flat().map((t) => todos[t].grupo) : [par.nome].flat().map(objeto));
  const caixaDe = (par) => gruposDe(par).reduce((b, g) => b.union(caixa(g)), new THREE.Box3());
  /** O visor da boca de visita do equipamento: a ponta do bocal e o eixo
   *  dele para fora (a marca do furo, lib/furos.js). */
  function visorDe(tag) {
    let v = null;
    todos[tag].grupo.traverse((o) => {
      const f = o.userData.furo;
      if (!v && f) v = { ponta: o.localToWorld(V(0, f.ate, 0)), eixo: V(0, 1, 0).transformDirection(o.matrixWorld) };
    });
    return v;
  }
  function foco(par) {
    switch (par.tipo) {
      case 'ceu': return meioLote.clone();
      case 'fachada': return V(PLACA.x, 2, PLACA.z);
      case 'portaria': { const c = PRACA_PORTARIA.cobertura; return V((c.x[0] + c.x[1]) / 2, 2, (c.z[0] + c.z[1]) / 2); }
      case 'onibus': return V(ONIBUS.parada[0], 1.6, ONIBUS.parada[1]);
      case 'predio': { const b = caixa(objeto(`predio-${par.bloco}`)); return b.getCenter(V()).setY(2.5); }
      case 'equip': case 'objeto': return caixaDe(par).getCenter(V());
      case 'visor': return visorDe(par.tag).ponta.clone();
      case 'rack': return V((isbl.x[0] + isbl.x[1]) / 2, 5, RACK.z);
      case 'descarga': { const [x, z] = centro(bloco('DESCARGA')); return V(x, 1.5, z - 2); }
      case 'armazem': { const [x, z] = centro(bloco('ARMAZEM')); return V(x + 10, 1.5, z); }
      default: return meioLote.clone();
    }
  }

  /** Uma volta por dentro da sala em que da a porta D (n: normal para
   *  fora): anel recuado das paredes (ate `fundoMax` de fundo e `ladoMax`
   *  para cada lado da porta), olhando o meio da sala, com os cantos
   *  arredondados; o menor recuo em que o anel inteiro passa livre de parede
   *  e de movel alto, com 0,3 m de folga para a curva. Sem lugar, null.
   *  `alto`: o anel nessa altura (sobe e desce junto da porta) — no
   *  armazem, por cima das estantes; `olhar`: o que se olha, se nao o meio;
   *  `evitar`: retangulo que o anel nao sobrevoa (a baia do caminhao: de
   *  cima so se veria o teto do bau). */
  function voltaNaSala(bloco, D, n, { ladoMax = 4, fundoMax = 9, alto = 0, olhar = null, evitar = null } = {}) {
    const fora = (m, y, l = 0) => V(D.x + n[0] * m - n[1] * l, y, D.z + n[1] * m + n[0] * l);
    const dentro = (m, l, y = 1.7) => fora(-m, y, l);
    const yA = alto || 1.7;
    const reg = interiores.interiores.find((it) => it.registro.bloco === bloco);
    const ent = fora(-2, 0);
    const sl = reg?.registro.salas.find((s) => s.k === 0 && ent.x > s.ret.x0 && ent.x < s.ret.x1 && ent.z > s.ret.z0 && ent.z < s.ret.z1);
    if (!sl) return null;
    // os cantos da sala no referencial da porta: m para dentro, l para o lado
    const cs = [[sl.ret.x0, sl.ret.z0], [sl.ret.x1, sl.ret.z0], [sl.ret.x0, sl.ret.z1], [sl.ret.x1, sl.ret.z1]].map(([x, z]) => {
      const dx = x - D.x, dz = z - D.z;
      return { m: -(n[0] * dx + n[1] * dz), l: -n[1] * dx + n[0] * dz };
    });
    const fundo = Math.max(...cs.map((c) => c.m));
    const lA = Math.max(...cs.map((c) => c.l)), lB = -Math.min(...cs.map((c) => c.l));
    let limA = ladoMax, limB = ladoMax;
    if (evitar) {
      const ls = [[evitar.x0, evitar.z0], [evitar.x1, evitar.z0], [evitar.x0, evitar.z1], [evitar.x1, evitar.z1]].map(([x, z]) => -n[1] * (x - D.x) + n[0] * (z - D.z));
      if (Math.min(...ls) > 0) limA = Math.min(limA, Math.min(...ls) - 1.5);
      if (Math.max(...ls) < 0) limB = Math.min(limB, -Math.max(...ls) - 1.5);
    }
    const lMin = evitar ? 0.2 : 0.5;
    for (let ins = 1.2; ins <= 2.4; ins += 0.3) {
      const M = Math.min(fundo - ins, fundoMax), LA = Math.min(lA - ins, limA), LB = Math.min(lB - ins, limB), m0 = Math.max(1.4, ins);
      if (M < m0 + 1.5 || LA < lMin || LB < lMin) return null;
      const sobe = () => (alto ? [dentro(1.4, 0, yA)] : []);
      const cantos = [dentro(m0, LA, yA), dentro(M, LA, yA), dentro(M, -LB, yA), dentro(m0, -LB, yA)];
      const seq = [dentro(1.4, 0.1), ...sobe(), ...cantos, ...sobe(), dentro(1.4, -0.1)];
      const q = [fora(2.6, 1.7), ...seq, fora(2.6, 1.7)];
      if (!q.every((a, k) => livre(a) && (!k || retaLivre(q[k - 1], a, 0.3)))) continue;
      const meio = olhar ?? dentro(M / 2, (LA - LB) / 2, 1.2);
      // canto arredondado: no lugar dele, dois pontos a ate 1 m, um de cada lado
      const anel = [];
      seq.forEach((c, k) => {
        if (!cantos.includes(c)) { anel.push(c); return; }
        for (const o of [seq[k - 1], seq[k + 1]]) { const d = c.distanceTo(o); anel.push(c.clone().lerp(o, Math.min(1, d / 3) / d)); }
      });
      // o ultimo canto ja olha para a porta (no anel alto, so ao chegar
      // embaixo: de cima, olhar a porta e olhar o chao)
      return [
        { p: fora(2.6, 1.7), alvo: meio },
        ...anel.slice(0, -1).map((p, k) => ({ p, alvo: alto || k < anel.length - 3 ? meio : fora(1, 1.7) })),
        { p: anel.at(-1), alvo: fora(6, 1.7) },
        { p: fora(2.6, 1.8), alvo: fora(12, 2.5) },
      ];
    }
    return null;
  }

  /* ---------------------------------------------------- o que se ve */
  // O que a camera olha esta atras de outra coisa? Cinco raios — o do
  // centro e quatro a 3° dele, no plano da tela —; tapado se o do centro e
  // tres dos outros batem antes de chegar ao assunto (a caixa do que a
  // parada mostra) ou ao ponto olhado. Fora de predio, contra a geometria de
  // verdade de equipamentos, tubulacao, objetos do entorno, arvores e
  // postes (caixa engana: a do R-01 leva a plataforma), sem vidro e sem o
  // que contem o ponto olhado (a cobertura sobre a cancela); dentro, contra
  // paredes e moveis altos. Tubo longe e fino bate em um raio so e nao tapa;
  // o grosso colado na lente, sim.
  let pecas = null, dentro = null;
  const rc = new THREE.Raycaster(), ponto = V();
  rc.camera = camera;                       // o sprite pede a camera no raio
  const material = (h) => (Array.isArray(h.object.material) ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material);
  // so malha: linha (cota, contorno) e rotulo nao tapam nada
  const opaco = (h) => { const m = h.object.isMesh && material(h); return m && m.visible !== false && !(m.transparent && (m.opacity ?? 1) < 0.7); };
  const aVista = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  /** O que tapa o raio de `o` na direcao `d` antes de `fim` (ou null). */
  function tapa(o, d, fim, nomes, alvo) {
    if (!pecas) {
      pecas = [...Object.entries(todos).map(([nome, e]) => ({ nome, g: e.grupo })), ...entorno.objetos.map((x) => ({ nome: x.nome, g: x.grupo }))];
      if (tubulacao) pecas.push({ nome: 'tubulação', g: tubulacao.grupo });
      ambiente.grupo.traverse((x) => { if (x.isInstancedMesh) pecas.push({ nome: x.name || 'árvore', g: x }); });
      pecas.forEach((x) => { x.b = caixa(x.g); });
      dentro = [
        ...solidos.filter((x) => x.movel).map((x) => ({ b: x.r, nome: x.nome })),
        ...interiores.colisores.map((c) => ({ b: new THREE.Box3(V(c.x0, c.y0, c.z0), V(c.x1, c.y1, c.z1)), nome: 'parede' })),
      ];
    }
    rc.set(o, d);
    rc.near = 0.05; rc.far = fim - 0.3;
    if (emPredio(o)) return dentro.find((x) => !x.b.containsPoint(o) && rc.ray.intersectBox(x.b, ponto) && ponto.distanceTo(o) < rc.far)?.nome ?? null;
    for (const x of pecas) {
      if (nomes.has(x.nome) || x.b.containsPoint(alvo)) continue;
      if (!x.b.containsPoint(o) && !(rc.ray.intersectBox(x.b, ponto) && ponto.distanceTo(o) < rc.far)) continue;
      if (rc.intersectObject(x.g, true).some((h) => opaco(h) && aVista(h.object))) return x.nome;
    }
    return null;
  }
  /** Os nomes e as caixas do que a parada mostra (o predio visto de fora). */
  const assuntos = new Map();
  function assuntoDe(par) {
    if (!assuntos.has(par)) {
      const nomes = new Set(par.tipo === 'equip' || par.tipo === 'visor' ? [par.tag].flat() : par.tipo === 'objeto' ? [par.nome].flat() : []);
      if (par.tipo === 'predio' && par.mov !== 'entra') nomes.add(`predio-${par.bloco}`);
      assuntos.set(par, { nomes, caixas: [...nomes].map((n) => (todos[n] ? todos[n].grupo : objeto(n))).filter(Boolean).map(caixa) });
    }
    return assuntos.get(par);
  }
  /** Da camera em p olhando alvo, na parada par: o nome do que tapa, ou null. */
  const raioV = new THREE.Ray();
  function escondido(p, alvo, par) {
    const { nomes, caixas } = assuntoDe(par);
    const dir = alvo.clone().sub(p), D = dir.length();
    dir.normalize();
    const lado = V(-dir.z, 0, dir.x).normalize(), cima = V().crossVectors(lado, dir).normalize();
    const k = Math.tan(THREE.MathUtils.degToRad(3));
    let batem = 0, centro = null;
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = dir.clone().addScaledVector(lado, a * k).addScaledVector(cima, b * k).normalize();
      raioV.set(p, d);
      // ate onde se olha: a entrada no assunto ou a distancia do alvo
      let fim = D;
      for (const c of caixas) if (!c.containsPoint(p) && raioV.intersectBox(c, ponto)) fim = Math.min(fim, ponto.distanceTo(p));
      const t = tapa(p, d, fim, nomes, alvo);
      if (!a && !b) { centro = t; if (!t) return null; }
      if (t) batem++;
    }
    return batem >= 4 ? centro : null;
  }

  /* ---------------------------------------------------- pontos de cada parada */
  // cada ponto: { p, alvo, parada } — o trecho da parada e percorrido em `s`
  function pontosDe(par, de) {
    const F = foco(par);
    const daqui = Math.atan2(de.z - F.z, de.x - F.x);       // de que lado a camera chega
    // o arco numa altura so, a menor em que ele inteiro passa livre (medido a
    // cada 0,5 m): subir ponto a ponto faria a camera dar pulos
    const arco = (R, y, a0, a1, n, alvo = F) => {
      const em = (a, yy) => V(F.x + R * Math.cos(a), yy, F.z + R * Math.sin(a));
      const passos = Math.max(8, Math.ceil((Math.abs(a1 - a0) * R) / 0.5));
      let yy = y;
      while (yy < y + 30 && !Array.from({ length: passos + 1 }, (_, k) => em(a0 + ((a1 - a0) * k) / passos, yy)).every(livre)) yy += 1;
      return Array.from({ length: n }, (_, i) => ({ p: em(a0 + ((a1 - a0) * i) / (n - 1), yy), alvo: alvo.clone() }));
    };
    switch (par.tipo) {
      case 'ceu': {
        // a ultima parada chega ao ponto do comeco vindo do lado oposto, na
        // mesma direcao em que o passeio parte: o laco fecha sem salto
        const [a, b] = [V(meioLote.x - 70, 120, LOTE.z[1] + 150), V(meioLote.x + 10, 105, LOTE.z[1] + 135)];
        const ps = par === PARADAS.at(-1) ? [a.clone().multiplyScalar(2).sub(b), a] : [a, b];
        return ps.map((p) => ({ p, alvo: meioLote.clone() }));
      }
      case 'fachada': return [
        { p: V(F.x - 28, 7, F.z + 20), alvo: F.clone() },
        { p: V(F.x - 6, 5, F.z + 15), alvo: F.clone() },
        { p: V(F.x + 12, 4.5, F.z + 12), alvo: F.clone().add(V(-12, 0, -8)) },
      ];
      case 'onibus': {
        // As portas abrem na faixa entre o onibus e o abrigo: so se ve pela
        // ponta do abrigo. Olha as portas da ponta de onde vem, contorna a
        // ponta para o lado da calcada e acompanha quem desceu indo para o
        // vestiario.
        const ab = caixa(objeto('abrigo-onibus'));
        const zP = (ab.max.z + F.z) / 2, lado = Math.sign(ab.min.z - F.z);
        const zC = lado > 0 ? ab.max.z : ab.min.z;                  // face do abrigo para a calcada
        const xa = de.x < F.x ? ab.min.x - 7 : ab.max.x + 7, d = de.x < F.x ? 1 : -1;
        return nivelar([
          { p: V(xa, 4.5, zP + lado * 2), alvo: V(F.x - d * 3, 1.4, zP) },
          { p: V(xa + d * 3, 3.6, zP + lado * 1.5), alvo: V(F.x, 1.4, zP) },
          { p: V(xa + d * 1, 3.6, zC + lado * 3), alvo: V(F.x - d * 2, 1.2, zC + lado * 1.5) },
          { p: V(F.x - d * 2, 4.5, zC + lado * 9), alvo: V(F.x + d * 6, 1.2, zC + lado * 6) },
        ]);
      }
      case 'predio': {
        const { p: d, n } = portaDe(par.bloco);
        const D = V(d[0], 0, d[1]);
        const fora = (m, y, l = 0) => V(D.x + n[0] * m - n[1] * l, y, D.z + n[1] * m + n[0] * l);
        // quanto ha de rua livre na frente da porta (a do LAB da para a sala
        // de controle a 8 m)
        let frente = 1.5;
        while (frente < 16 && livre(fora(frente + 0.5, 1.7)) && !emPredio(fora(frente + 0.5, 1.7))) frente += 0.5;
        const longe = Math.max(3.5, Math.min(11, frente - 1.5));
        if (par.mov !== 'entra') return [
          { p: subir(fora(16, 6, -8)), alvo: F.clone() }, { p: subir(fora(14, 5, 0)), alvo: F.clone() }, { p: subir(fora(16, 6, 8)), alvo: F.clone() },
        ];
        // pela porta, uma volta na sala de entrada, e sai pela porta; nao
        // cabendo, olha da porta
        const volta = voltaNaSala(par.bloco, D, n);
        if (!volta) return [
          { p: subir(fora(longe, 3.5, -3)), alvo: F.clone() }, { p: subir(fora(Math.min(4, longe), 2.2)), alvo: fora(-2, 1.2) }, { p: subir(fora(longe, 3.5, 3)), alvo: F.clone() },
        ];
        return [
          { p: subir(fora(longe, 3.5)), alvo: D.clone().setY(2) },
          ...volta,
          { p: subir(fora(longe, 3.5)), alvo: fora(20, 3) },
        ];
      }
      case 'portaria': return arco(17, 6, daqui - 0.6, daqui + 0.6, 4);
      case 'equip': case 'objeto': {
        const tam = caixaDe(par).getSize(V());
        const R = THREE.MathUtils.clamp(Math.max(tam.x, tam.z) * 0.8 + (par.tipo === 'equip' ? 6 : 9), 8, 30) * (par.perto ?? 1);
        const y = THREE.MathUtils.clamp(F.y, 2.5, 12) + 2;
        if (par.mov !== 'cadeia') {
          // do lado de onde se chega; se ali o assunto fica atras de outra
          // coisa (o F-02 atras do CR-02), o lado livre mais perto dele
          for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4, Math.PI]) {
            const a0 = daqui + da - 0.55, a1 = daqui + da + 0.55;
            if (arco(R, y, a0, a1, 7).filter((q) => escondido(q.p, F, par)).length <= 1) return arco(R, y, a0, a1, 4);
          }
          return arco(R, y, daqui - 0.55, daqui + 0.55, 4);
        }
        // cadeia: arco largo em volta do conjunto, o olhar passando de uma
        // peca a outra na ordem; o arco gira no sentido em que elas seguem
        const cs = gruposDe(par).map((g) => caixa(g).getCenter(V()));
        const ang = (c) => Math.atan2(c.z - F.z, c.x - F.x);
        const sentido = Math.sign(Math.sin(ang(cs.at(-1)) - ang(cs[0]))) || 1;
        const ps = arco(R, y, daqui - 0.8 * sentido, daqui + 0.8 * sentido, cs.length);
        ps.forEach((q, i) => { q.alvo = cs[i].clone(); });
        return ps;
      }
      case 'visor': {
        // chega pelo eixo do bocal, por cima do guarda-corpo, para a 0,8 m
        // do vidro e olha la para dentro; recua subindo
        // (chega e sai pelos lados que estiverem livres: o TK-01 tem o V-02 ao lado)
        const { ponta, eixo } = visorDe(par.tag);
        const ao = (d, dy = 0, l = 0) => ponta.clone().addScaledVector(eixo, d).add(V(-eixo.z * l, dy, eixo.x * l));
        const fundo = ponta.clone().addScaledVector(eixo, -1.5);
        // pela frente; se algo estiver na frente do bocal (o V-02, a 1,5 m do
        // visor do TK-01), desce por cima ate a frente do vidro
        const lados = [[1, -1], [-1, 1], [1, 1], [-1, -1]];
        const opcoes = [
          ...lados.map(([a, b]) => [ao(6, 2.5, 2 * a), ao(2.4, 0.4, 0.6 * a), ao(1.1, 0.05), ao(1.0, 0.05, 0.1 * b), ao(2.6, 0.9, 0.8 * b), ao(6, 2.5, 2 * b)]),
          ...lados.map(([a, b]) => [ao(4.5, 4, 2 * a), ao(0.9, 2.8, 0.3 * a), ao(0.8, 0.05), ao(0.75, 0.05, 0.1 * b), ao(0.9, 2.8, 0.3 * b), ao(4.5, 4, 2 * b)]),
        ].map((ps) => ps.map((p, k) => ({ p, alvo: k === 0 || k === ps.length - 1 ? ponta.clone() : fundo.clone(), sem: par.tag })));
        return opcoes.find((ps) => ps.every((q, k) => livre(q.p, par.tag) && (!k || retaLivre(ps[k - 1].p, q.p, 0.3, par.tag)))) ?? opcoes[0];
      }
      case 'rack': {
        // por baixo do rack, pelo corredor do meio (livre ate 2,1 m), olhando
        // os tubos a frente; nao cabendo, ao lado e por cima
        // da ponta mais perto de onde a camera vem para a outra
        const [x0, x1] = de.x > (isbl.x[0] + isbl.x[1]) / 2 ? [isbl.x[1], isbl.x[0]] : isbl.x;
        const xm = (x0 + x1) / 2, z = RACK.z, s = Math.sign(x1 - x0);
        // (a altura mais alta que passa: por cima da cabeca de quem anda ali)
        // (o "tunel", 16/11/2026: tudo na mesma altura e olhando em frente,
        // de fora da area ate sair do outro lado; `reta` fica com o maior
        // trecho livre)
        const adiante = (y) => V(x1 + 40 * s, y + 0.4, z);
        const baixo = (y) => [x0 - 9 * s, x0 + 1 * s, xm, x1 - 1 * s, x1 + 9 * s].map((x) => ({ p: V(x, y, z), alvo: adiante(y) }));
        for (const y of [2.8, 2.5, 2.2, 1.9]) {
          const ps = baixo(y);
          if (ps.slice(1, 4).every((q, k) => livre(q.p) && (!k || retaLivre(ps[k].p, q.p, 0.3)))) return ps;
        }
        return nivelar([
          { p: V(x0 - 2 * s, 9, z + 7), alvo: V(x0 + 8 * s, 4, z) },
          { p: V(xm, 9, z + 7), alvo: V(xm + 8 * s, 4, z) },
          { p: V(x1 + 2 * s, 9, z + 7), alvo: V(x1 + 8 * s, 4, z) },
        ]);
      }
      case 'descarga': {
        // De cima e de longe o caminhao entrando de re; desce por fora da
        // cobertura, atras da baia e do lado do braco de carregamento, ate a
        // altura do operador, que calca, aterra e liga o mangote na
        // traseira.
        const cob = caixa(objeto('cobertura-descarga'));
        const br = caixa(objeto('braco-1')).getCenter(V());
        const sx = Math.sign(br.x - F.x) || -1;
        const W = V(br.x + (F.x - br.x) * 0.6, 1.1, cob.min.z + 0.4);      // onde se trabalha
        const zt = cob.min.z;
        return [
          { p: subir(V(F.x + sx * 20, 13, zt - 14)), alvo: V(F.x, 1, cob.max.z + 6) },
          { p: subir(V(F.x + sx * 13, 7, zt - 9)), alvo: V(F.x, 1, (cob.min.z + cob.max.z) / 2) },
          { p: subir(V(F.x + sx * 7, 3.4, zt - 6)), alvo: W.clone() },
          { p: subir(V(F.x + sx * 4.5, 2.4, zt - 4)), alvo: W.clone() },
          { p: subir(V(F.x + sx * 1.5, 2.6, zt - 4.5)), alvo: W.clone() },
          { p: subir(V(F.x - sx * 3, 4, zt - 7)), alvo: W.clone().setY(1.5) },
        ];
      }
      case 'armazem': {
        // o patio de manobra visto de cima e, pela porta de pessoas, o
        // carregamento la dentro
        const reg = interiores.interiores.find((it) => it.registro.bloco === 'ARMAZEM');
        const porta = reg?.casca.portas[0];
        const c = porta?.centro ?? F;
        const n = porta ? { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[porta.lado] : [1, 0];
        const fora = (m, y, l = 0) => V(c.x + n[0] * m - n[1] * l, y, c.z + n[1] * m + n[0] * l);
        const patio = V(F.x + 8, 1, F.z - 4);
        // la dentro as estantes tomam o salao: a volta e por cima delas,
        // olhando a baia do caminhao (a maior area livre da sala)
        const baia = reg?.registro.salas[0]?.livres.reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
        const alto = Math.max(...(reg?.registro.moveis ?? []).map((m) => m.h)) + 1.9;
        const volta = porta && voltaNaSala('ARMAZEM', V(c.x, 0, c.z), n, {
          ladoMax: 6, fundoMax: 12, alto, olhar: baia && V((baia.x0 + baia.x1) / 2, 1.2, (baia.z0 + baia.z1) / 2), evitar: baia,
        });
        return [
          ...nivelar([{ p: V(F.x + 24, 18, F.z + 16), alvo: patio }, { p: V(F.x + 20, 12, F.z - 2), alvo: patio }]),
          { p: subir(fora(8, 4.5)), alvo: fora(-6, 1.5) },
          ...(volta || [{ p: subir(fora(3, 2.2)), alvo: fora(-8, 1.5) }]),
          { p: subir(fora(10, 4)), alvo: fora(20, 4) },
        ];
      }
      default: return [{ p: F.clone().add(V(10, 8, 10)), alvo: F }];
    }
  }

  /* ---------------------------------------------------- as tomadas */
  // Cada parada e uma TOMADA: a camera passa devagar pelos pontos dela e a
  // seguinte comeca com um corte (a tela escurece e clareia). Nao ha trecho
  // de ligacao entre uma e outra (pedido do autor, 16/11/2026: "ao inves
  // de um trajeto continuo, capture locais especificos passando lentamente a
  // camera, como se fosse uma demonstracao"). E a tomada e RETA: "o
  // movimento inicia e permanece na mesma direcao em cada quadro" — dos
  // pontos que `pontosDe` da (arco, volta na sala, chegada ao visor) fica
  // uma reta so, de um deles a outro.
  const tetoEm = (y) => MOVIMENTO.lento[0] + MOVIMENTO.lento[1] * y;
  /** A reta da tomada: o par de pontos mais afastado, na ordem em que a
   *  camera os percorreria, com o caminho entre eles livre (medido a cada
   *  0,2 m). O visor termina diante do vidro; em predio que se entra, conta
   *  tambem o ponto diante da porta a altura dos olhos, para a reta poder
   *  passar pelo vao dela. Comprida demais para o teto de velocidade, perde
   *  o comeco (o fim e onde se quer chegar). */
  /** A porta de pessoas do armazem e a baia do caminhao la dentro (o alvo). */
  function portaArmazem() {
    const reg = interiores.interiores.find((it) => it.registro.bloco === 'ARMAZEM');
    const pt = reg?.casca.portas[0];
    if (!pt) return null;
    const baia = reg.registro.salas[0]?.livres.reduce((x, y) => ((y.x1 - y.x0) * (y.z1 - y.z0) > (x.x1 - x.x0) * (x.z1 - x.z0) ? y : x));
    return { p: [pt.centro.x, pt.centro.z], n: { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[pt.lado],
      alvo: baia && V((baia.x0 + baia.x1) / 2, 1.4, (baia.z0 + baia.z1) / 2) };
  }
  function reta(ps, par) {
    const sem = ps.find((q) => q.sem)?.sem;
    const cs = par.tipo === 'visor' ? ps.slice(0, 3) : ps;
    let a = null, b = null, d = 0.5;
    // Predio que se entra: travelling pela porta, a altura dos olhos, no
    // eixo dela e olhando em frente — de onde ha rua livre ate onde a sala
    // deixa. No armazem, o olhar fica na baia do caminhao.
    const porta = par.mov === 'entra' ? portaDe(par.bloco) : par.tipo === 'armazem' ? portaArmazem() : null;
    if (porta) {
      const { p: D, n } = porta;
      const no = (m) => V(D[0] + n[0] * m, 1.7, D[1] + n[1] * m);
      let rua = 1.5, sala = 0;
      while (rua < 8 && livre(no(rua + 0.5)) && !emPredio(no(rua + 0.5))) rua += 0.5;
      while (sala < 12 && livre(no(-(sala + 1.1)))) sala += 0.5;
      if (sala >= 2 && retaLivre(no(rua), no(-sala))) {
        const frente = no(-sala - 1).setY(1.5);       // em frente, ainda dentro da sala (alem da parede do fundo contaria como escondido)
        a = { p: no(rua), alvo: porta.alvo ?? frente };
        b = { p: no(-sala), alvo: porta.alvo ?? frente };
      }
    }
    const pelaPorta = !!a;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length && !pelaPorta; j++) {
        if (par.tipo === 'visor' && j !== 2) continue;
        const dij = cs[i].p.distanceTo(cs[j].p);
        if (dij > d && livre(cs[i].p, sem) && livre(cs[j].p, sem) && retaLivre(cs[i].p, cs[j].p, 0, sem)) { a = cs[i]; b = cs[j]; d = dij; }
      }
    }
    if (!a) {
      // nenhum par livre: do primeiro ponto, na direcao do ultimo, ate onde der
      a = ps[0];
      const dir = ps.at(-1).p.clone().sub(a.p);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const fim = a.p.clone();
      for (let k = 0; k < 60 && livre(fim.clone().addScaledVector(dir, 0.2), sem); k++) fim.addScaledVector(dir, 0.2);
      if (fim.distanceTo(a.p) < 0.5) fim.copy(a.p).addScaledVector(dir, 0.5);
      b = { ...ps.at(-1), p: fim };
    }
    const L = a.p.distanceTo(b.p), max = tetoEm((a.p.y + b.p.y) / 2) * par.s * MOVIMENTO.alongar;
    const u = L > max ? 1 - max / L : 0;
    return [
      { p: a.p.clone().lerp(b.p, u), alvo: a.alvo.clone().lerp(b.alvo, u), sem },
      { p: b.p.clone(), alvo: b.alvo.clone(), sem },
    ];
  }
  const pontos = [];            // { p, alvo, parada, sem }
  const marcos = [];            // indice do primeiro ponto de cada parada
  let anterior = V(meioLote.x - 70, 120, LOTE.z[1] + 150);
  PARADAS.forEach((par, i) => {
    const ps = reta(pontosDe(par, anterior), par);
    marcos.push(pontos.length);
    ps.forEach((q) => pontos.push({ ...q, parada: i }));
    anterior = ps.at(-1).p;
  });
  // As amostras de cada tomada, ao longo da reta dela (nada e inserido nem
  // subido: a reta ja foi escolhida livre, e CAMERA_DENTRO confere).
  const SUB = 24;
  let N = 0, amostras = [];     // { p, alvo, seg, par, t, v }
  const ini = [], fim = [];     // primeira e ultima amostra de cada tomada
  const mesma = (k, i) => pontos[k]?.parada === i;
  {
    N = pontos.length;
    amostras = [];
    PARADAS.forEach((par, i) => {
      const k0 = marcos[i], k1 = (marcos[i + 1] ?? N) - 1, n = k1 - k0;
      const doTrecho = pontos.slice(k0, k1 + 1);
      const curva = new THREE.CatmullRomCurve3(doTrecho.map((q) => q.p), false, 'centripetal');
      const curvaAlvo = new THREE.CatmullRomCurve3(doTrecho.map((q) => q.alvo), false, 'centripetal');
      ini[i] = amostras.length;
      for (let s = 0; s < n; s++) {
        for (let j = 0; j < SUB; j++) {
          const u = (s + j / SUB) / n;
          amostras.push({ p: curva.getPoint(u), alvo: curvaAlvo.getPoint(u), seg: k0 + s, par: i });
        }
      }
      amostras.push({ p: curva.getPoint(1), alvo: curvaAlvo.getPoint(1), seg: k1, par: i });
      fim[i] = amostras.length - 1;
    });
  }
  // Tempo: velocidade constante dentro da tomada (a deriva lenta de um video
  // de demonstracao; o corte dispensa acelerar e frear). A tomada dura o `s`
  // dela, ou ate `alongar` vezes mais, se o caminho for comprido para o teto de
  // velocidade — que cresce com a altura: de cima, o chao passa devagar.
  let t = 0;
  PARADAS.forEach((par, i) => {
    let L = 0, ySoma = 0;
    const d = [0];
    for (let k = ini[i] + 1; k <= fim[i]; k++) { d.push(amostras[k].p.distanceTo(amostras[k - 1].p)); L += d.at(-1); }
    for (let k = ini[i]; k <= fim[i]; k++) ySoma += amostras[k].p.y;
    const n = fim[i] - ini[i];
    const teto = tetoEm(ySoma / (n + 1));
    const T = THREE.MathUtils.clamp(L / teto, par.s, par.s * MOVIMENTO.alongar);
    let s = 0;
    for (let k = ini[i]; k <= fim[i]; k++) {
      s += d[k - ini[i]];
      amostras[k].t = t + T * (L > 1e-6 ? s / L : (k - ini[i]) / n);
      amostras[k].v = L / T;
    }
    t += T;
  });
  const total = t;
  // o olhar gira no maximo a 80 % do limite: a direcao segue a do alvo com
  // atraso, e o alvo e refeito na mesma distancia (cada tomada comeca ja
  // olhando para o alvo dela)
  {
    const giro = THREE.MathUtils.degToRad(MOVIMENTO.giroMax * 0.8);
    const d = V();
    for (let k = 0; k < amostras.length; k++) {
      const q = amostras[k];
      const quer = q.alvo.clone().sub(q.p);
      const dist = quer.length();
      quer.normalize();
      if (k === ini[q.par]) { d.copy(quer); continue; }
      const ang = Math.acos(THREE.MathUtils.clamp(d.dot(quer), -1, 1));
      const max = giro * (q.t - amostras[k - 1].t);
      if (ang > max && ang > 1e-6) {
        const eixo = d.clone().cross(quer);
        if (eixo.lengthSq() < 1e-10) eixo.set(0, 1, 0);
        d.applyAxisAngle(eixo.normalize(), max);
      } else d.copy(quer);
      q.alvo = q.p.clone().addScaledVector(d, Math.max(dist, 2));
    }
  }
  /** Onde se esta entre duas amostras no instante tt. Entre a ultima de uma
   *  tomada e a primeira da seguinte nao ha tempo (dt = 0): e o corte. */
  function fracao(a, b, tt) {
    const dt = b.t - a.t;
    if (dt <= 1e-6) return 1;
    const tau = THREE.MathUtils.clamp(tt - a.t, 0, dt);
    const s = ((a.v + b.v) / 2) * dt;
    return s > 1e-9 ? THREE.MathUtils.clamp((a.v * tau + (0.5 * (b.v - a.v) * tau * tau) / dt) / s, 0, 1) : tau / dt;
  }
  const tParada = ini.map((k) => amostras[k].t);
  const tSai = fim.map((k) => amostras[k].t);
  /** Quanto a tela esta escura no instante tt: fecha antes de cada corte e
   *  abre depois dele (o fim da volta e o comeco tambem sao corte). */
  function corte(tt) {
    let perto = Math.min(tt, total - tt);
    for (const tc of tParada) perto = Math.min(perto, Math.abs(tt - tc));
    return THREE.MathUtils.clamp(1 - perto / MOVIMENTO.corte, 0, 1);
  }

  /** A camera no instante tt (busca binaria nas amostras). */
  function em(tt) {
    let k = 0, hi = amostras.length - 2;
    while (k < hi) { const m = (k + hi + 1) >> 1; if (amostras[m].t <= tt) k = m; else hi = m - 1; }
    const a = amostras[k], b = amostras[k + 1];
    const u = fracao(a, b, tt);
    return { p: a.p.clone().lerp(b.p, u), alvo: a.alvo.clone().lerp(b.alvo, u), k };
  }
  /** A parada em que se esta (ou a que se chega) no instante tt. */
  const paradaEm = (tt) => { let i = 0; while (i + 1 < PARADAS.length && tParada[i + 1] <= tt + 0.5) i++; return i; };

  /* ---------------------------------------------------- na tela */
  // Altura aparente (px) de uma esfera de diametro `diam` em P, vista da
  // camera `cam` com a tela de H px de alto; 0 fora do quadro.
  const quadro_ = new THREE.Frustum(), mPV = new THREE.Matrix4(), esfera = new THREE.Sphere();
  function enquadrar(cam) {
    cam.updateMatrixWorld();
    quadro_.setFromProjectionMatrix(mPV.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    return quadro_;
  }
  function px(P, diam, cam, H, fr) {
    esfera.set(P, diam / 2);
    if (!fr.intersectsSphere(esfera)) return 0;
    const d = Math.max(0.5, P.distanceTo(cam.position) - diam / 2);
    return (diam / (2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))) * H;
  }

  /* ---------------------------------------------------- eventos */
  // Cada evento acerta o ator para uma volta do passeio: retido fora de cena
  // ate a hora (`solta`), ou ja andando, se a hora passou. Depois que a
  // camera deixa a parada, o ator e acertado para a volta seguinte assim que
  // sai do quadro: o salto dele nunca e visto. So no comeco (a camera chega
  // de onde o usuario estava) e depois de pular de parada (com a tela
  // escura) o acerto e de uma vez. O relogio do passeio, para quem espera a
  // volta seguinte, nao da a volta: volta * total + tempo.
  const atores = ambiente.atores;
  const evs = [];
  PARADAS.forEach((par, i) => {
    const ev = par.evento;
    if (ev?.ator) {
      const a = atores.find((x) => x.g.name === ev.ator);
      if (!a) return;
      const n = a.fases.length, kFora = a.fases.findIndex((f) => f.tipo === 'fora');
      let soma = 0, t0 = 0;
      for (let k = (kFora + 1) % n; k !== ev.fase; k = (k + 1) % n) soma += a.fases[k].T;
      for (let k = 0; k < kFora; k++) t0 += a.fases[k].T;
      // os passageiros andam no relogio do onibus
      const quem = [a, ...atores.filter((p) => p.mestre === a)];
      evs.push({ i, a, quem, grupos: quem.map((q) => ({ g: q.g, pessoa: !!q.pessoa })), tSolta: t0 + a.fases[kFora].T - 0.05, solta: tParada[i] - ev.antes - soma, volta: -1 });
    } else if (ev?.pessoa && rotinas) {
      for (const p of rotinas.pessoas) {
        let tt = 0;
        const k = p.fases.findIndex((f) => { const ok = f.tipo === 'estar' && f.par.bloco === ev.pessoa && f.par.l?.acao === ev.acao; if (!ok) tt += f.T; return ok; });
        if (k < 0) continue;
        evs.push({ i, p, grupos: [{ g: p.pessoa.grupo, pessoa: true }], fase0: tt - ev.antes - tParada[i], volta: -1 });
        break;
      }
    }
  });
  let volta = 0;
  const relogio = () => volta * total + tempo;
  /** Acerta o evento para a volta v do passeio. */
  function acertar(e, v) {
    const agora = relogio();
    if (e.a) {
      const solta = v * total + e.solta;
      if (agora < solta) {
        // no fim da fase fora de cena, retido ate `solta`
        for (const q of e.quem) { q.t = e.tSolta; q.fase = -1; q.s = 0; }
        Object.assign(e.a, { retido: true, solta });
        e.a.g.visible = false;
      } else for (const q of e.quem) ambiente.posicionarEm(q, e.tSolta + agora - solta);
    } else e.p.t = (((e.fase0 + agora - v * total) % e.p.ciclo) + e.p.ciclo) % e.p.ciclo;
    e.volta = v;
  }
  /** Tudo de uma vez, para o instante atual: no comeco e depois de pular.
   *  Evento cuja parada ja passou nesta volta fica para a seguinte. */
  function sincronizar() {
    for (const e of evs) acertar(e, tempo <= tSai[e.i] ? volta : volta + 1);
    // as cenas de operacao (porta do onibus, operador da descarga) e as
    // rotinas se poem no lugar sem esperar a animacao
    operacoes?.atualizar(10);
    rotinas?.atualizar(0, camera);
  }
  /** Quanto o ator do evento aparece agora (px de altura, o maior dele e dos
   *  passageiros); 0 se fora do quadro ou invisivel. */
  function naTela(e) {
    const fr = enquadrar(camera), H = cena.renderer.domElement.clientHeight || innerHeight;
    let m = 0;
    for (const { g, pessoa } of e.grupos) {
      if (!g.visible) continue;
      const b = caixa(g);
      if (b.isEmpty()) continue;
      const c = b.getCenter(V());
      // pessoa longe nao e desenhada (camada 1, ou invisivel nas rotinas)
      if (pessoa && c.distanceTo(camera.position) > LONGE) continue;
      m = Math.max(m, px(c, b.getSize(V()).length(), camera, H, fr));
    }
    return m;
  }
  /** A camera deixou a parada do evento: ele e acertado para a volta
   *  seguinte no primeiro quadro em que nao aparece. */
  function acertarFora() {
    if (quadro % 10) return;                 // a caixa de cada ator custa: 6 vezes por segundo basta
    for (const e of evs) {
      if (e.volta > volta || tempo < tSai[e.i] + MOVIMENTO.acertoDepois) continue;
      if (naTela(e) > MOVIMENTO.acertoPx) continue;
      acertar(e, volta + 1);
    }
  }
  /** Fim da volta: quem ainda nao foi acertado e acertado a vista (anotado
   *  para a auditoria) — nao deve acontecer, ACERTO_A_VISTA mede. */
  const acertosAVista = [];
  function virar() {
    for (const e of evs) {
      if (e.volta > volta) continue;
      const v = naTela(e);
      if (v > MOVIMENTO.acertoPx) acertosAVista.push({ parada: titulo(PARADAS[e.i]), px: v });
      acertar(e, volta + 1);
    }
    tempo -= total;
    volta++;
  }

  /* ---------------------------------------------------- legenda e mini-mapa */
  // legenda no canto esquerdo, mini-mapa no direito: o meio da tela fica
  // para a cena
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:20;display:none;font-family:system-ui,"Segoe UI",sans-serif;color:#fff;pointer-events:none;max-width:min(460px,calc(100vw - 32px - clamp(120px,20vw,240px) - 12px))';
  const caixaMapa = document.createElement('canvas');
  caixaMapa.width = 240; caixaMapa.height = 180;
  caixaMapa.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:20;display:none;width:clamp(120px,20vw,240px);background:rgba(18,26,34,.78);border-radius:10px;pointer-events:none';
  document.body.appendChild(caixaMapa);
  // icones desenhados (o HTML abre sem internet nem fonte de simbolos)
  const icone = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="${d}"/></svg>`;
  const ICONES = { anterior: 'M6 5h2v14H6zM20 5v14L9 12z', pausar: 'M7 5h4v14H7zM13 5h4v14h-4z', tocar: 'M7 5v14l12-7z', proxima: 'M16 5h2v14h-2zM4 5v14l11-7z' };
  const estiloBotao = 'pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:26px;border:0;border-radius:6px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;padding:0';
  hud.innerHTML = `
    <div style="background:rgba(18,26,34,.82);border-left:4px solid #f2a03d;border-radius:8px;padding:10px 14px">
      <div data-cap style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.75"></div>
      <div data-nome style="font-size:20px;font-weight:600;margin:2px 0"></div>
      <div data-linha style="font-size:13px;opacity:.9"></div>
      <div data-seguir style="font-size:12px;opacity:.7;margin-top:6px"></div>
      <div data-barra style="display:flex;gap:4px;margin-top:4px"></div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
        <button data-b="anterior" title="Parada anterior (←)" style="${estiloBotao}">${icone(ICONES.anterior)}</button>
        <button data-b="pausar" title="Pausar e continuar (Espaço)" style="${estiloBotao}">${icone(ICONES.pausar)}</button>
        <button data-b="proxima" title="Próxima parada (→)" style="${estiloBotao}">${icone(ICONES.proxima)}</button>
        <span style="font-size:11px;opacity:.6;margin-left:4px">Espaço pausa · ← → paradas · Esc sai</span>
      </div>
    </div>`;
  document.body.appendChild(hud);
  // a tela escurece e clareia quando se pula de parada: pular e corte
  const veu = document.createElement('div');
  veu.style.cssText = 'position:fixed;inset:0;z-index:15;background:#0d1319;opacity:0;pointer-events:none';
  document.body.appendChild(veu);
  const el = (k) => hud.querySelector(`[data-${k}]`);
  const barra = el('barra');
  // cada capitulo da barra e clicavel: vai a primeira parada dele (a area de
  // clique e mais alta que o traco)
  CAPITULOS.forEach((nome, c) => {
    const s = document.createElement('span');
    s.title = nome;
    s.style.cssText = 'flex:1;height:4px;padding:5px 0;border-radius:2px;background-clip:content-box;background-color:rgba(255,255,255,.25);pointer-events:auto;cursor:pointer';
    s.onclick = () => irPara(PARADAS.findIndex((p) => p.cap === c));
    barra.appendChild(s);
  });
  for (const b of hud.querySelectorAll('button')) {
    b.onclick = () => { ({ anterior: paradaAnterior, pausar: () => pausar(), proxima: proximaParada })[b.dataset.b](); b.blur(); };
  }
  const mapa = caixaMapa.getContext('2d');
  const W = 240, H = 180, mx = (LOTE.x[1] - LOTE.x[0]) + 60, mz = (LOTE.z[1] - LOTE.z[0]) + 60;
  const esc = Math.min(W / mx, H / mz);
  const ox = (W - mx * esc) / 2 - (LOTE.x[0] - 30) * esc, oz = (H - mz * esc) / 2 - (LOTE.z[0] - 30) * esc;
  const M = (x, z) => [ox + x * esc, oz + z * esc];
  function desenharMapa(k) {
    mapa.clearRect(0, 0, W, H);
    mapa.strokeStyle = 'rgba(255,255,255,.35)'; mapa.lineWidth = 1;
    const [lx, lz] = M(LOTE.x[0], LOTE.z[0]);
    mapa.strokeRect(lx, lz, (LOTE.x[1] - LOTE.x[0]) * esc, (LOTE.z[1] - LOTE.z[0]) * esc);
    mapa.strokeStyle = 'rgba(160,170,180,.45)'; mapa.lineWidth = 2;
    for (const v of VIAS) { mapa.beginPath(); v.pontos.forEach(([x, z], i) => { const [a, b] = M(x, z); i ? mapa.lineTo(a, b) : mapa.moveTo(a, b); }); mapa.stroke(); }
    mapa.fillStyle = 'rgba(200,205,210,.35)';
    for (const b of BLOCOS) { const [a, c] = M(b.x[0], b.z[0]); mapa.fillRect(a, c, (b.x[1] - b.x[0]) * esc, (b.z[1] - b.z[0]) * esc); }
    // a rota: feita forte, por fazer fraca
    for (const [de, ate, cor] of [[0, k, '#f2a03d'], [k, amostras.length - 1, 'rgba(242,160,61,.35)']]) {
      mapa.strokeStyle = cor; mapa.lineWidth = 2; mapa.beginPath();
      for (let i = de, ant = -1; i <= ate; i += 4) { const [a, b] = M(amostras[i].p.x, amostras[i].p.z); amostras[i].par !== ant ? mapa.moveTo(a, b) : mapa.lineTo(a, b); ant = amostras[i].par; }
      mapa.stroke();
    }
    const [a, b] = M(amostras[k].p.x, amostras[k].p.z);
    mapa.fillStyle = '#fff'; mapa.beginPath(); mapa.arc(a, b, 4, 0, Math.PI * 2); mapa.fill();
  }

  /* ---------------------------------------------------- tocar */
  let ativo = false, tempo = 0, idx = 0, quadro = 0, pausado = false, forcando = false;
  let salto = null;             // { para, volta, fase: 'escurece' | 'clareia', k }
  const eventos = [];           // o que a camera viu ao chegar em cada parada com evento
  function legenda(k) {
    const i = amostras[k].par;
    const par = PARADAS[i];
    el('cap').textContent = `${par.cap + 1}/${CAPITULOS.length} · ${CAPITULOS[par.cap]}${pausado ? ' · pausado' : ''}`;
    el('nome').textContent = par.titulo ?? par.nome;
    el('linha').textContent = par.linha ?? '';
    const prox = PARADAS[(i + 1) % PARADAS.length];
    el('seguir').textContent = `A seguir: ${prox.titulo ?? prox.nome}`;
    [...barra.children].forEach((s, c) => { s.style.backgroundColor = c < par.cap ? '#f2a03d' : c === par.cap ? '#ffd28a' : 'rgba(255,255,255,.25)'; });
  }
  /** Chegou a uma parada com evento (ou, se ele vem depois da chegada, ao
   *  comeco dele): esta acontecendo, e no quadro? */
  function conferirEventos(t0, t1) {
    PARADAS.forEach((par, i) => {
      const tc = par.evento?.ator && tParada[i] + Math.max(0, -par.evento.antes) + 0.3;
      if (!tc || !(tc > t0 && tc <= t1)) return;
      const e = evs.find((x) => x.i === i);
      if (!e) return;
      eventos.push({ parada: par.nome, fase: e.a.fases.indexOf(ambiente.depurar.faseAgora(e.a)), quer: par.evento.fase, visivel: e.a.g.visible, px: naTela(e) });
    });
  }
  function pose() {
    while (idx < amostras.length - 2 && amostras[idx + 1].t <= tempo) idx++;
    while (idx > 0 && amostras[idx].t > tempo) idx--;
    const a = amostras[idx], b = amostras[idx + 1];
    const u = fracao(a, b, tempo);
    cena.controls.irPara(a.p.clone().lerp(b.p, u), a.alvo.clone().lerp(b.alvo, u));
  }
  /** Escurece, pula e clareia (anda mesmo pausado). */
  function andarSalto(dt) {
    const passo = dt / MOVIMENTO.escurecer;
    if (salto.fase === 'escurece') {
      salto.k = Math.min(1, salto.k + passo);
      if (salto.k >= 1) {
        tempo = salto.para; volta = salto.volta; idx = em(tempo).k;
        sincronizar();
        salto.fase = 'clareia';
      }
    } else if ((salto.k -= passo) <= 0) salto = null;
    veu.style.opacity = salto ? String(salto.k) : '0';
  }
  /** `forcar`: anda mesmo pausado (para inspecionar quadro a quadro). */
  function atualizar(dt, forcar = false) {
    if (!ativo) return;
    if (salto) andarSalto(dt);
    if (!pausado || forcar || forcando) {
      const t0 = tempo;
      tempo += dt;
      if (tempo >= total) { virar(); idx = 0; }
      else conferirEventos(t0, tempo);
      acertarFora();
    }
    // soltar quem estava retido
    for (const a of atores) if (a.retido && relogio() >= a.solta) a.retido = false;
    pose();
    // o corte entre tomadas (e o do salto, se for mais escuro)
    veu.style.opacity = String(Math.max(salto?.k ?? 0, corte(tempo)));
    legenda(idx);
    if (quadro++ % 6 === 0) desenharMapa(idx);
  }
  /** Pula para a parada i (da volta v), com a tela escura no meio. Pulos
   *  seguidos (tecla segura) contam da parada para onde ja se ia. */
  function irPara(i, v = volta) {
    if (!ativo || i < 0) return;
    if (i >= PARADAS.length) { i = 0; v++; }
    salto = { para: tParada[i], volta: v, fase: 'escurece', k: salto?.k ?? 0 };
  }
  const indiceAgora = () => (salto?.fase === 'escurece' ? paradaEm(salto.para) : paradaEm(tempo));
  function proximaParada() {
    const i = indiceAgora(), v = salto?.fase === 'escurece' ? salto.volta : volta;
    // a caminho de uma parada (ainda nao chegou), a proxima e ela
    const t = salto?.fase === 'escurece' ? salto.para : tempo;
    irPara(t < tParada[i] - 0.5 ? i : i + 1, v);
  }
  function paradaAnterior() {
    const i = indiceAgora(), v = salto?.fase === 'escurece' ? salto.volta : volta;
    const t = salto?.fase === 'escurece' ? salto.para : tempo;
    // passados alguns segundos da chegada, volta ao comeco da mesma parada
    if (t - tParada[i] > MOVIMENTO.voltarAte) irPara(i, v);
    else if (i > 0) irPara(i - 1, v);
    else irPara(PARADAS.length - 1, Math.max(0, v - 1));
  }
  function pausar(v = !pausado) {
    if (!ativo) return;
    pausado = v;
    hud.querySelector('[data-b="pausar"]').innerHTML = icone(pausado ? ICONES.tocar : ICONES.pausar);
  }
  function comecar() {
    if (ativo) return;
    ativo = true; tempo = 0; idx = 0; volta = 0; salto = null;
    pausar(false);
    cena.controls.ativo = false;
    // o botao do HUD com o foco "clicaria" de novo com o Espaco
    document.activeElement?.blur?.();
    sincronizar();
    hud.style.display = caixaMapa.style.display = 'block';
  }
  function parar() {
    if (!ativo) return;
    pausar(false);
    ativo = false;
    salto = null;
    veu.style.opacity = '0';
    for (const a of atores) a.retido = false;
    cena.controls.ativo = true;
    hud.style.display = caixaMapa.style.display = 'none';
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { parar(); return; }
    if (!ativo || e.ctrlKey || e.altKey || e.metaKey || e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pausar(); }
    else if (e.code === 'ArrowRight' || e.code === 'PageDown') { e.preventDefault(); proximaParada(); }
    else if (e.code === 'ArrowLeft' || e.code === 'PageUp') { e.preventDefault(); paradaAnterior(); }
  });
  /** Botao do controle durante o passeio (true se usado): A pausa, LB/RB e
   *  o direcional pulam de parada, B sai. */
  function botao(b) {
    if (!ativo) return false;
    if (b === 'A') pausar();
    else if (b === 'LB' || b === 'esquerda') paradaAnterior();
    else if (b === 'RB' || b === 'direita') proximaParada();
    else if (b === 'B') parar();
    else return false;
    return true;
  }
  /** Inspecao quadro a quadro com o passeio pausado: camera e mundo andam
   *  dt juntos (os ganchos da cena rodam como se nao estivesse pausado). */
  function inspecionar(dt = 1 / 30) {
    forcando = true;
    try { for (const f of cena.antesDeRenderizar) f(dt); } finally { forcando = false; }
  }

  /* ---------------------------------------------------- auditoria */
  // amostrada a cada 0,5 s: camera dentro de algo, velocidade, aceleracao e
  // giro do olhar acima do limite, evento que nao da tempo de preparar,
  // parada com o assunto escondido e ator que so poderia
  // ser acertado a vista
  function auditar(todosOsAchados = false) {   // true: todos os achados, nao so 5 por regra
    const achados = [];
    const conta = {};
    const achar = (regra, detalhe) => { conta[regra] = (conta[regra] ?? 0) + 1; if (conta[regra] <= (todosOsAchados ? 99 : 5)) achados.push({ regra, detalhe }); };
    const f1 = (x) => x.toFixed(1).replace('.', ',');
    let antes = em(0), vAntes = amostras[0].v;
    for (let tt = 0.5; tt < total; tt += 0.5) {
      const q = em(tt);
      const am = amostras[q.k];
      const pa = pontos[am.seg], pb = mesma(am.seg + 1, am.par) ? pontos[am.seg + 1] : pa;
      const nome = titulo(PARADAS[am.par]), sem = pa.sem || pb.sem;
      if (!livre(q.p, sem)) {
        const s = solidos.find((x) => x.nome !== sem && x.b.containsPoint(q.p))?.nome ?? (q.p.y <= 0.8 ? 'chão' : 'parede');
        achar('CAMERA_DENTRO', `${s}, t = ${f1(tt)} s (${nome})`);
      }
      // de uma tomada para outra e corte: velocidade e giro nao se medem
      if (amostras[antes.k].par !== am.par) { antes = q; vAntes = am.v; continue; }
      // velocidade pelo comprimento do caminho (cinco cordas de 0,1 s), nao
      // pela corda de 0,5 s, que encurta na curva
      let L = 0, ant = antes.p;
      for (let j = 1; j <= 5; j++) { const r = em(tt - 0.5 + j * 0.1).p; L += r.distanceTo(ant); ant = r; }
      const vv = L / 0.5;
      if (vv > MOVIMENTO.vMax) achar('RAPIDO_DEMAIS', `${f1(vv)} m/s, t = ${f1(tt)} s (${nome})`);
      if (Math.abs(vv - vAntes) / 0.5 > MOVIMENTO.aMax) achar('TRANCO', `${f1(Math.abs(vv - vAntes) / 0.5)} m/s², t = ${f1(tt)} s (${nome})`);
      const d0 = antes.alvo.clone().sub(antes.p).normalize(), d1 = q.alvo.clone().sub(q.p).normalize();
      const giro = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(d0.dot(d1), -1, 1))) / 0.5;
      if (giro > MOVIMENTO.giroMax) achar('GIRO_BRUSCO', `${f1(giro)}°/s, t = ${f1(tt)} s (${nome})`);
      antes = q; vAntes = vv;
    }

    // ALVO_ESCONDIDO: durante a parada, o que a camera olha fica atras de
    // outra coisa (`escondido`, a cada segundo) em mais de `escondidoMax` do
    // tempo dela; o ceu olha tudo
    PARADAS.forEach((par, i) => {
      if (par.tipo === 'ceu') return;
      let n = 0, tapado = 0;
      const quem = {}, quando = [];
      for (let tt = tParada[i]; tt <= tSai[i]; tt += 1) {
        const q = em(tt);
        const t = escondido(q.p, q.alvo, par);
        n++;
        if (t) { tapado++; quem[t] = (quem[t] ?? 0) + 1; quando.push(tt); }
      }
      if (n && tapado / n > MOVIMENTO.escondidoMax) {
        const pior = Object.entries(quem).sort((a, b) => b[1] - a[1])[0][0];
        achar('ALVO_ESCONDIDO', `${titulo(par)}: ${Math.round((100 * tapado) / n)} % do tempo atrás de ${pior} (t = ${f1(quando[quando.length >> 1])} s)`);
      }
    });

    // ACERTO_A_VISTA: depois da parada de cada evento tem de haver um
    // instante em que o ator, onde quer que esteja na rota dele, fica fora
    // do quadro (numa tela de 1080 px de alto) — e quando o passeio o acerta
    // para a volta seguinte sem que o salto se veja. Pessoa conta so a
    // menos de LONGE m (mais longe nao e desenhada).
    {
      const cam = camera.clone();
      cam.aspect = 16 / 9;
      cam.updateProjectionMatrix();
      for (const e of evs) {
        const lugares = [];
        if (e.a) {
          const diam = caixa(e.a.g).getSize(V()).length();
          for (const a of e.quem) {
            for (const f of a.fases) {
              if (!f.p) continue;
              if (f.tipo === 'espera') { const [x, z] = f.p.em(f.s); lugares.push(a === e.a ? { P: V(x, 1.5, z), diam } : { P: V(x, 0.9, z), diam: 1.8, pessoa: true }); continue; }
              for (let s = 0; s <= f.p.L; s += 2) { const [x, z] = f.p.em(s); lugares.push(a === e.a ? { P: V(x, 1.5, z), diam } : { P: V(x, 0.9, z), diam: 1.8, pessoa: true }); }
            }
          }
        } else {
          for (const f of e.p.fases) {
            if (f.tipo === 'anda') for (const p of f.pts) lugares.push({ P: V(p[0], (p[2] ?? 0) + 0.9, p[1]), diam: 1.8, pessoa: true });
            else if (f.par.l) lugares.push({ P: V(f.par.l.x, f.par.l.y + 0.9, f.par.l.z), diam: 1.8, pessoa: true });
            else if (f.par.p) lugares.push({ P: V(f.par.p[0], 0.9, f.par.p[1]), diam: 1.8, pessoa: true });
          }
        }
        let ok = false;
        for (let tt = tSai[e.i] + MOVIMENTO.acertoDepois; tt < total && !ok; tt += 1) {
          const q = em(tt);
          cam.position.copy(q.p);
          cam.lookAt(q.alvo);
          const fr = enquadrar(cam);
          ok = lugares.every(({ P, diam, pessoa }) => (pessoa && P.distanceTo(q.p) > LONGE) || px(P, diam, cam, 1080, fr) <= MOVIMENTO.acertoPx);
        }
        if (!ok) achar('ACERTO_A_VISTA', `${titulo(PARADAS[e.i])}: o ator fica no quadro até o fim da volta`);
      }
      for (const a of acertosAVista) achar('ACERTO_A_VISTA', `${a.parada}: acertado a vista no fim da volta (${f1(a.px)} px)`);
    }

    // os eventos: da tempo de retirar o ator e solta-lo antes de a camera chegar?
    for (const e of evs) if (e.a && e.solta < 0) achar('EVENTO_SEM_TEMPO', `${titulo(PARADAS[e.i])}: faltam ${f1(-e.solta)} s`);
    for (const e of eventos) {
      if (e.fase !== e.quer && !(e.fase === e.quer + 1)) achar('EVENTO_PERDIDO', `${e.parada}: fase ${e.fase}, queria ${e.quer}`);
      else if (!e.px) achar('EVENTO_FORA_DO_QUADRO', `${e.parada}: o ator não está no quadro na chegada`);
    }
    return { total: achados.length, porRegra: conta, achados, duracao: `${Math.floor(total / 60)} min ${Math.round(total % 60)} s`, paradas: PARADAS.length };
  }

  return { comecar, parar, alternar: () => (ativo ? parar() : comecar()), atualizar, auditar, pausar, proxima: proximaParada, anterior: paradaAnterior, irPara, botao, inspecionar,
    get ativo() { return ativo; }, get tempo() { return tempo; }, get volta() { return volta; },
    get pausado() { return pausado; }, set pausado(v) { pausar(v); },
    /** O mundo para junto com o passeio pausado (menos na inspecao). */
    get congelado() { return ativo && pausado && !forcando; },
    total, eventos,
    depurar: { pontos, amostras, tParada, tSai, evs, em, quem: (p) => [...solidos.filter((s) => s.b.containsPoint(p)).map((s) => s.nome), ...(paredes.some((b) => b.containsPoint(p)) ? ['parede'] : [])] } };
}
