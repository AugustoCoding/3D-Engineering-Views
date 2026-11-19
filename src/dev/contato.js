import * as THREE from 'three';

/**
 * ===========================================================================
 *  AUDITORIA DE CONTATO  (Fase 25) — __auditarContato(), com ?semfusao
 * ===========================================================================
 *  Pedido do autor: "nada flutuando, tudo ligado". Criterio fisico: cada
 *  peca da area de processo chega ao chao por uma cadeia de contatos (perna
 *  no costado, console sob a plataforma, grampo da escada, mancal na base,
 *  poste sob o tubo), e o que deveria estar ligado esta ligado (tubo no
 *  bocal, valvula na linha, instrumento na tomada).
 *
 *  Contato: um ponto de A a ate TOL (2 cm) de um triangulo de B. Os pontos
 *  de A sao os vertices e pontos nas arestas a cada PASSO (5 cm) — so os
 *  vertices nao bastam: o tubo reto tem anel so nas pontas, e a viga que o
 *  apoia no meio do vao nao tem vertice perto dele. Caixa sozinha nao serve
 *  (a do R-01 leva a plataforma; a perna a 5 cm do costado cabe nela).
 *  Busca por grade espacial de triangulos (celula de 0,25 m): cada
 *  triangulo entra nas celulas que a caixa dele, aumentada de TOL, toca;
 *  o ponto so olha a propria celula. Par ja em contato nao se testa de novo.
 *
 *  Raizes: a laje, as fundacoes (e plintos e sapatas) e o terreno.
 *  Achados:
 *    FLUTUANDO       componente conexo que nao chega a raiz nenhuma
 *    FOLGA           par que quase encosta (2–30 cm), um deles apoio, perna,
 *                    console, guia ou base (o que existe para encostar)
 *    PONTA_SOLTA     ponta de tubo que nao termina em bocal, flange, outro
 *                    tubo, tampao ou flange cega (dreno sobre funil vale:
 *                    o respiro de ar e de proposito)
 *    SOLTO_NA_LINHA  valvula ou instrumento sem contato com a linha (ou com
 *                    o bocal / o vaso, na tomada)
 *  Resumo por equipamento e por arquivo responsavel.
 * ===========================================================================
 */

const TOL = 0.02;            // contato: 2 cm
const FOLGA_MAX = 0.30;      // "quase encosta": ate 30 cm
const PASSO = 0.05;          // amostra nas arestas
const CEL = 0.25;            // celula da grade

/* --------------------------------------------------------------- quem e quem
 * Pelo nome dos grupos acima da malha (a malha quase nunca tem nome). */
const ignorar = (cad) => cad.some((n) => /^(ceu|ambiente|rotinas|operacoes|camada-seguranca|camada-escala|camada-rotulos|rotulos-planta.*|corredores|liquido.*|tag-pintada|isolamento|operador-escala)$/.test(n));
// raizes: o que esta no chao por definicao
const ehRaiz = (cad) => cad.some((n) => /^(laje|fundacao|chao|campo|plinto.*|sapata.*)$/.test(n));
// o que existe para encostar: apoio, perna, console (plataforma), guia,
// grampo (escada), berco, estai, rack e a base da bomba
const ehApoio = (cad) => cad.some((n) => /^(apoio|pernas|plataforma|guia|escada|bercos|estai|pipe-rack|saia)$/.test(n));

/** O arquivo que desenha a peca, pelo grupo mais especifico acima dela. */
function arquivoDe(cad, tag) {
  const tem = (re) => cad.some((n) => re.test(n));
  if (tem(/^(bomba|bomba-deslocamento|bomba-vacuo)$/)) return 'lib/bomba.js';
  // escada e plataforma saem de lib/supports.js (criarEscada,
  // criarPlataformaRetangular), inclusive as do bloqueio do limite
  if (tem(/^(saia|pernas|fundacao|plataforma|escada|bercos)$/)) return 'lib/supports.js';
  if (tem(/^bocal-DN\d+$/) && !tem(/^(tubulacao|bloqueio-limite)$/)) return 'lib/nozzle.js';
  if (tem(/^(agitador|girante|turbina-rushton)$/)) return 'lib/agitator.js';
  if (tem(/^camada-internos$/)) return 'lib/internals.js';
  if (tem(/^(apoio|guia|estai|funil-dreno|apoios-tubulacao)$/)) return 'lib/apoios.js';
  if (tem(/^(chapeu|corta-chamas|filtro-admissao)$/) && tem(/^tubulacao$/)) return 'lib/pontas.js';
  if (tem(/^pipe-rack$/)) return 'lib/rack.js';
  if (tem(/^tubulacao$/)) return 'equipment/tubulacao.js';
  if (tem(/^alivio$/)) return 'equipment/alivio.js';
  if (tem(/^valvula-/)) return 'lib/valvula.js';
  if (tem(/^(instrumento-.*|tomada|capilar)$/)) return 'lib/instrumento.js';
  if (tem(/^instrumentacao$/)) return 'equipment/instrumentacao.js';
  if (tem(/^bloqueio-limite$/)) return 'equipment/limiteBateria.js';
  if (tem(/^area-processo$/)) return 'site/processo.js';
  if (tem(/^seguranca$/)) return 'site/seguranca.js';
  if (tem(/^pipeways$/)) return 'site/pipeways.js';
  if (tag) return ['R-01', 'V-01', 'V-02', 'TK-01'].includes(tag) ? `equipment/${tag}.js` : 'equipment/generico.js';
  return '?';
}
// donos (combinado em 28/10): o resto e da sessao local ou de ninguem ainda
const DA_NUVEM = /^(equipment\/tubulacao|lib\/pipe|lib\/rota|lib\/apoios|lib\/rack|lib\/pontas|equipment\/instrumentacao|lib\/valvula|lib\/instrumento|lib\/bomba|equipment\/alivio|equipment\/limiteBateria)\.js$/;
const DA_LOCAL = /^(lib\/supports|lib\/vessel|lib\/nozzle|lib\/agitator|lib\/internals|equipment\/(R-01|V-01|V-02|TK-01|generico)|core\/scene|site\/noite)\.js$/;

/* --------------------------------------------------------------- geometria */
/** Distancia² do ponto (px,py,pz) ao triangulo t (9 floats em T, a partir
 *  de o). Ericson, Real-Time Collision Detection, 5.1.5. */
function dist2PontoTriangulo(T, o, px, py, pz) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const bx = T[o + 3], by = T[o + 4], bz = T[o + 5];
  const cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx, qy, qz;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; } else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; } else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
              qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz);
            } else {
              const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
              qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
            }
          }
        }
      }
    }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}

const chave = (ix, iy, iz) => ((ix + 2048) * 4096 + (iy + 2048)) * 4096 + (iz + 2048);
const cel = (v) => Math.floor(v / CEL);

/**
 * A auditoria. `cena`, `todos` (TAG -> { grupo }), `tubulacao` (para as
 * pontas de tubo). Devolve os achados, o resumo e o tempo.
 */
export function auditarContato({ cena, todos, tubulacao }) {
  const t0 = performance.now();
  const S = cena.scene;
  S.updateMatrixWorld(true);
  const semFusao = /semfusao/.test(location.search);

  /* ------------------------------------------------ 1. as pecas da area */
  // Os grupos inteiros da area de processo (o rack avanca alem da laje),
  // mais o que estiver sobre a laje do ISBL — com o objeto inteiro: o
  // pipeway que passa por cima entra com os postes de fora.
  const laje = S.getObjectByName('laje');
  const caixaLaje = new THREE.Box3().setFromObject(laje);
  const tagDe = new Map();
  for (const [tag, e] of Object.entries(todos)) tagDe.set(e.grupo, tag);
  const GRUPOS_PROCESSO = new Set(['tubulacao', 'pipe-rack', 'instrumentacao', 'bloqueio-limite', 'area-processo', 'laje', 'iluminacao-laje']);
  const naLaje = (c) => c.x > caixaLaje.min.x && c.x < caixaLaje.max.x && c.z > caixaLaje.min.z && c.z < caixaLaje.max.z;

  const candidatas = [];
  const objetosNaLaje = new Set();
  S.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    const cad = [], cadeia = [];
    let tag = null, ficha = null;
    for (let p = o; p && p !== S; p = p.parent) {
      if (p.name) cad.push(p.name);
      cadeia.unshift(p);
      if (!tag && tagDe.has(p)) tag = tagDe.get(p);
      if (!ficha && p.userData?.ficha?.titulo) ficha = p.userData.ficha.titulo;
    }
    if (ignorar(cad)) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) return;
    const doProcesso = !!tag || GRUPOS_PROCESSO.has(cadeia[0]?.name);
    const raiz = ehRaiz(cad);
    // o objeto: dois niveis abaixo do grupo de topo (pipeways > estrutura >
    // pipeway-leste; seguranca > extintor)
    const objeto = cadeia[Math.min(2, cadeia.length - 1)];
    if (!doProcesso && !raiz && naLaje(b.getCenter(new THREE.Vector3()))) objetosNaLaje.add(objeto);
    candidatas.push({ o, cad, cadeia, tag, ficha, b, doProcesso, raiz, objeto });
  });
  const entra = candidatas.filter((c) => !c.raiz && (c.doProcesso || objetosNaLaje.has(c.objeto)));
  // as raizes so onde ha o que apoiar (o terreno e enorme)
  const dominio = entra.reduce((d, c) => d.union(c.b), new THREE.Box3()).expandByScalar(1);
  const raizes = candidatas.filter((c) => c.raiz && c.b.intersectsBox(dominio));

  const malhas = [];          // { o, cad, tag, arquivo, raiz, apoio, peca, b, ficha, unidade, tubo }
  for (const { o, cad, cadeia, tag, ficha, b, raiz } of [...entra, ...raizes]) {
    // a unidade de instrumentacao (a valvula, o instrumento inteiro) e o
    // objeto de apoio inteiro (a plataforma, a escada: entre as pecas dele,
    // folga e desenho — o guarda-corpo nao encosta no piso)
    let unidade = null, peca = null;
    for (const p of cadeia) {
      if (/^(valvula-|instrumento-|psv$|raquete$|valvula-gaveta$)/.test(p.name)) unidade ??= p;
      if (/^(apoio|pernas|plataforma|guia|escada|bercos|estai|pipe-rack|saia)$/.test(p.name)) peca = p;
    }
    malhas.push({ o, cad, tag, arquivo: arquivoDe(cad, tag), raiz, apoio: ehApoio(cad), peca, b, ficha, unidade,
      tubo: /^(linha-|cabecal-|aberta-|descarga-|capilar$)/.test(o.name) || cad.includes('capilar') });
  }
  const N = malhas.length;

  /* ------------------------------------------------ 2. triangulos na grade */
  const tris = [];            // floats, 9 por triangulo
  const [DX0, DY0, DZ0] = [cel(dominio.min.x), cel(dominio.min.y), cel(dominio.min.z)];
  const [DX1, DY1, DZ1] = [cel(dominio.max.x), cel(dominio.max.y), cel(dominio.max.z)];
  const dono = [];            // malha de cada triangulo
  const grade = new Map();
  const v = new THREE.Vector3();
  const pos = [];             // vertices em mundo de cada malha (Float32Array)
  malhas.forEach((m, i) => {
    const g = m.o.geometry, P = g.attributes.position, idx = g.index;
    const W = new Float32Array(P.count * 3);
    for (let k = 0; k < P.count; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(m.o.matrixWorld);
      W[3 * k] = v.x; W[3 * k + 1] = v.y; W[3 * k + 2] = v.z;
    }
    pos.push(W);
    const nt = idx ? idx.count / 3 : P.count / 3;
    m.tri0 = dono.length;
    for (let t = 0; t < nt; t++) {
      const a = idx ? idx.getX(3 * t) : 3 * t, b = idx ? idx.getX(3 * t + 1) : 3 * t + 1, c = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (const k of [a, b, c]) {
        const x = W[3 * k], y = W[3 * k + 1], z = W[3 * k + 2];
        tris.push(x, y, z);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const id = dono.length;
      dono.push(i);
      // raiz enorme (terreno): so o pedaco dentro do dominio
      if (x1 < dominio.min.x || x0 > dominio.max.x || z1 < dominio.min.z || z0 > dominio.max.z) continue;
      // so as celulas dentro do dominio (o triangulo do terreno e enorme)
      const X0 = Math.max(cel(x0 - TOL), DX0), X1 = Math.min(cel(x1 + TOL), DX1);
      const Y0 = Math.max(cel(y0 - TOL), DY0), Y1 = Math.min(cel(y1 + TOL), DY1);
      const Z0 = Math.max(cel(z0 - TOL), DZ0), Z1 = Math.min(cel(z1 + TOL), DZ1);
      for (let ix = X0; ix <= X1; ix++) {
        for (let iy = Y0; iy <= Y1; iy++) {
          for (let iz = Z0; iz <= Z1; iz++) {
            const k = chave(ix, iy, iz);
            let l = grade.get(k);
            if (!l) grade.set(k, (l = []));
            l.push(id);
          }
        }
      }
    }
    m.tri1 = dono.length;
  });
  const T = new Float32Array(tris);

  /* ------------------------------------------------ 3. pontos de cada malha */
  // vertices e pontos nas arestas a cada PASSO; raiz nao precisa (os outros
  // a acham)
  function pontosDe(i, cb) {
    const m = malhas[i], W = pos[i], g = m.o.geometry, idx = g.index;
    const n = W.length / 3;
    for (let k = 0; k < n; k++) cb(W[3 * k], W[3 * k + 1], W[3 * k + 2]);
    const nt = idx ? idx.count / 3 : n / 3;
    const vistas = new Set();
    for (let t = 0; t < nt; t++) {
      for (let e = 0; e < 3; e++) {
        let a = idx ? idx.getX(3 * t + e) : 3 * t + e, b = idx ? idx.getX(3 * t + (e + 1) % 3) : 3 * t + (e + 1) % 3;
        if (a > b) [a, b] = [b, a];
        const ka = a * 1e7 + b;
        if (vistas.has(ka)) continue;
        vistas.add(ka);
        const dx = W[3 * b] - W[3 * a], dy = W[3 * b + 1] - W[3 * a + 1], dz = W[3 * b + 2] - W[3 * a + 2];
        const L = Math.hypot(dx, dy, dz);
        const ns = Math.floor(L / PASSO);
        for (let s = 1; s < ns; s++) {
          const u = s / ns;
          cb(W[3 * a] + dx * u, W[3 * a + 1] + dy * u, W[3 * a + 2] + dz * u);
        }
      }
    }
  }

  /* ------------------------------------------------ 4. contatos */
  const pai = Int32Array.from({ length: N }, (_, i) => i);
  const achar = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  const unir = (a, b) => { a = achar(a); b = achar(b); if (a !== b) pai[a] = b; };
  const contato = new Set();  // pares i*N+j, i<j
  const par = (a, b) => (a < b ? a * N + b : b * N + a);
  const tol2 = TOL * TOL;
  let testes = 0;
  for (let i = 0; i < N; i++) {
    if (malhas[i].raiz) continue;
    pontosDe(i, (px, py, pz) => {
      const l = grade.get(chave(cel(px), cel(py), cel(pz)));
      if (!l) return;
      for (const t of l) {
        const j = dono[t];
        if (j === i || contato.has(par(i, j))) continue;
        testes++;
        if (dist2PontoTriangulo(T, 9 * t, px, py, pz) <= tol2) { contato.add(par(i, j)); unir(i, j); }
      }
    });
  }

  /* ------------------------------------------------ 4b. encaixe */
  // Peca embutida em outra (a haste no castelo, o degrau no montante) nao
  // tem ponto a 2 cm da superficie da outra, e esta presa. Ponto dentro do
  // solido por paridade de raios em tres direcoes (vale a maioria: malha
  // aberta, como o tubo sem tampa, erra em uma). So onde muda a resposta: o
  // que ainda nao chega ao chao, e os pares de folga.
  const DIRS = [[1, 0.0123, 0.0071], [0.0091, 1, 0.0157], [0.0133, 0.0067, 1]];
  function cruza(o, px, py, pz, dx, dy, dz) {
    // Moller–Trumbore, so t > 0
    const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
    const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
    const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
    const a = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(a) < 1e-12) return 0;
    const f = 1 / a, sx = px - T[o], sy = py - T[o + 1], sz = pz - T[o + 2];
    const u = f * (sx * hx + sy * hy + sz * hz);
    if (u < 0 || u > 1) return 0;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const w = f * (dx * qx + dy * qy + dz * qz);
    if (w < 0 || u + w > 1) return 0;
    return f * (e2x * qx + e2y * qy + e2z * qz) > 1e-9 ? 1 : 0;
  }
  const pv = new THREE.Vector3();
  function dentroDe(i, j) {
    const W = pos[i], n = W.length / 3, passo = Math.max(1, Math.floor(n / 32));
    const mj = malhas[j];
    for (let k = 0; k < n; k += passo) {
      const px = W[3 * k], py = W[3 * k + 1], pz = W[3 * k + 2];
      if (!mj.b.containsPoint(pv.set(px, py, pz))) continue;
      let votos = 0;
      for (const [dx, dy, dz] of DIRS) {
        let c = 0;
        for (let t = mj.tri0; t < mj.tri1; t++) c += cruza(9 * t, px, py, pz, dx, dy, dz);
        if (c % 2) votos++;
      }
      if (votos >= 2) return true;
    }
    return false;
  }
  const encaixe = (i, j) => dentroDe(i, j) || dentroDe(j, i);
  let encaixes = 0;
  for (let volta = 0; volta < 3; volta++) {
    let mudou = false;
    const comRaiz = new Set();
    for (let i = 0; i < N; i++) if (malhas[i].raiz) comRaiz.add(achar(i));
    for (let i = 0; i < N; i++) {
      if (malhas[i].raiz || comRaiz.has(achar(i))) continue;
      const bi = malhas[i].b.clone().expandByScalar(TOL);
      for (let j = 0; j < N; j++) {
        if (j === i || achar(j) === achar(i) || !bi.intersectsBox(malhas[j].b)) continue;
        if (encaixe(i, j)) { contato.add(par(i, j)); unir(i, j); mudou = true; encaixes++; }
      }
    }
    if (!mudou) break;
  }

  // vizinhanca de contato de cada malha
  const viz = Array.from({ length: N }, () => []);
  for (const k of contato) { const a = Math.floor(k / N), b = k % N; viz[a].push(b); viz[b].push(a); }

  /* ------------------------------------------------ 5. distancia ate 30 cm */
  // menor distancia de pontos de i a triangulos de outras malhas (fora de
  // `fora`), procurando ate `raio`: [distancia, malha]
  function maisPerto(i, raio, fora) {
    let best = raio * raio, quem = -1;
    const r = Math.ceil(raio / CEL);
    pontosDe(i, (px, py, pz) => {
      const cx = cel(px), cy = cel(py), cz = cel(pz);
      for (let ix = cx - r; ix <= cx + r; ix++) for (let iy = cy - r; iy <= cy + r; iy++) for (let iz = cz - r; iz <= cz + r; iz++) {
        const l = grade.get(chave(ix, iy, iz));
        if (!l) continue;
        for (const t of l) {
          const j = dono[t];
          if (fora(j)) continue;
          const d = dist2PontoTriangulo(T, 9 * t, px, py, pz);
          if (d < best) { best = d; quem = j; }
        }
      }
    });
    return [Math.sqrt(best), quem];
  }

  /* ------------------------------------------------ 6. achados */
  const achados = [];
  const nomeDe = (m) => m.ficha ?? m.tag ?? m.cad.slice(0, 3).reverse().join(' > ');
  const f2 = (x) => x.toFixed(2).replace('.', ',');
  const ondeTxt = (b) => { const c = b.getCenter(new THREE.Vector3()); return `(${f2(c.x)}; ${f2(c.y)}; ${f2(c.z)})`; };

  // FLUTUANDO: componentes sem raiz
  const comp = new Map();
  for (let i = 0; i < N; i++) { const r = achar(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); }
  for (const lista of comp.values()) {
    if (lista.some((i) => malhas[i].raiz)) continue;
    const dentro = new Set(lista);
    const b = lista.reduce((bb, i) => bb.union(malhas[i].b), new THREE.Box3());
    // o vizinho mais perto: da maior malha do componente, ate 1 m
    const maior = lista.reduce((a, i) => (pos[i].length > pos[a].length ? i : a), lista[0]);
    const [d, j] = maisPerto(maior, 1.0, (k) => dentro.has(k));
    const m = malhas[maior];
    achados.push({ regra: 'FLUTUANDO', peca: nomeDe(m), tag: m.tag, arquivo: m.arquivo, malhas: lista.length, onde: ondeTxt(b),
      detalhe: `${lista.length} malha(s) sem cadeia até o chão; ${j >= 0 ? `a ${f2(d)} m de ${nomeDe(malhas[j])}` : 'nada a menos de 1 m'}`, d: j >= 0 ? d : null });
  }

  // FOLGA: apoio a 2–30 cm de algo com que nao encosta
  // o objeto de cada malha: o equipamento, o apoio inteiro, a valvula
  // inteira — ou ela mesma (a linha e uma malha so)
  const objetoDe = (k) => { const m = malhas[k]; return m.raiz ? 'raiz' : m.peca ?? m.unidade ?? (m.tag ? `tag:${m.tag}` : m.o); };
  const tocadosPor = new Map();
  for (const k of contato) {
    const a = Math.floor(k / N), b = k % N, oa = objetoDe(a), ob = objetoDe(b);
    if (oa === ob) continue;
    if (!tocadosPor.has(oa)) tocadosPor.set(oa, new Set());
    if (!tocadosPor.has(ob)) tocadosPor.set(ob, new Set());
    tocadosPor.get(oa).add(ob); tocadosPor.get(ob).add(oa);
  }
  const folgas = new Map();
  for (let i = 0; i < N; i++) {
    if (!malhas[i].apoio) continue;
    // o mais perto que nao encosta nele, fora as pecas do mesmo apoio — a
    // perna a 5 cm do costado e o pe a 5 cm da fundacao contam
    // Objeto contra objeto: o apoio que ja toca a linha pela travessa nao
    // tem folga contra ela na coluna, nem a guia presa ao costado contra a
    // camisa do mesmo vaso. Ja no chao, o chao nao conta: a coluna sobre a
    // laje nao esta "a 5 cm do terreno" que fica por baixo dela.
    const pc = malhas[i].peca;
    const oi = objetoDe(i);
    const tocados = tocadosPor.get(oi) ?? new Set();
    const noChao = tocados.has('raiz');
    const [d, j] = maisPerto(i, FOLGA_MAX, (k) => k === i || objetoDe(k) === oi || tocados.has(objetoDe(k)) || (noChao && malhas[k].raiz));
    if (j < 0 || d <= TOL) continue;
    if (encaixe(i, j)) { contato.add(par(i, j)); encaixes++; continue; }
    // uma folga por par de objetos
    const oj = objetoDe(j);
    if (folgas.get(oi)?.has(oj) || folgas.get(oj)?.has(oi)) continue;
    if (!folgas.has(oi)) folgas.set(oi, new Set());
    folgas.get(oi).add(oj);
    const mi = malhas[i], mj = malhas[j];
    achados.push({ regra: 'FOLGA', peca: nomeDe(mi), tag: mi.tag ?? mj.tag, arquivo: mi.arquivo, onde: ondeTxt(mi.b), d,
      detalhe: `${nomeDe(mi)} a ${f2(d)} m de ${nomeDe(mj)} (${mj.arquivo})` });
  }

  // PONTA_SOLTA: cada ponta de tubo tracado precisa de algo nela
  const tubosMalha = new Map();
  for (let i = 0; i < N; i++) if (malhas[i].tubo) tubosMalha.set(malhas[i].o, i);
  const caminhos = tubulacao?.tubos ?? [];
  const malhaDoItem = new Map();
  for (let i = 0; i < N; i++) if (malhas[i].o.userData?.item) malhaDoItem.set(malhas[i].o.userData.item, i);
  const P = new THREE.Vector3();
  const distSeg = (p, a, b) => new THREE.Line3(a, b).closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p);
  for (const c of caminhos) {
    if (!c.pts || c.pts.length < 2) continue;
    for (const [ponta] of [[c.pts[0], c.pts[1]], [c.pts.at(-1), c.pts.at(-2)]]) {
      P.copy(ponta);
      // (a) outro tubo passa por ela (te)
      const emTubo = caminhos.some((o) => o !== c && o.pts.some((q, k) => k && distSeg(P, o.pts[k - 1], q) <= o.r + TOL));
      if (emTubo) continue;
      // (a'') uma peca presa ao tubo que envolve a ponta: a reducao na
      // chegada ao bocal maior, a luva
      const iTubo = malhaDoItem.get(c.id);
      if (iTubo != null && viz[iTubo].some((k) => !malhas[k].tubo && malhas[k].b.clone().expandByScalar(TOL).containsPoint(P))) continue;
      // (a') dreno aberto sobre funil: o respiro de ar e de proposito (ve-se
      // o que escorre, e o esgoto nao volta para a linha)
      const funil = malhas.some((m) => m.cad.includes('funil-dreno') && m.b.min.y < P.y && P.y - m.b.max.y < 0.25
        && P.x > m.b.min.x && P.x < m.b.max.x && P.z > m.b.min.z && P.z < m.b.max.z);
      if (funil) continue;
      // (b) alguma malha (que nao seja um tubo tracado) a ate r + TOL da ponta
      const lim = c.r + TOL;
      const r = Math.ceil(lim / CEL);
      let achou = false;
      const cx = cel(P.x), cy = cel(P.y), cz = cel(P.z);
      for (let ix = cx - r; ix <= cx + r && !achou; ix++) for (let iy = cy - r; iy <= cy + r && !achou; iy++) for (let iz = cz - r; iz <= cz + r && !achou; iz++) {
        const l = grade.get(chave(ix, iy, iz));
        if (!l) continue;
        for (const t of l) {
          if (malhas[dono[t]].tubo) continue;
          if (dist2PontoTriangulo(T, 9 * t, P.x, P.y, P.z) <= lim * lim) { achou = true; break; }
        }
      }
      if (achou) continue;
      achados.push({ regra: 'PONTA_SOLTA', peca: `tubo ${c.id}`, tag: null, arquivo: 'equipment/tubulacao.js', onde: `(${f2(P.x)}; ${f2(P.y)}; ${f2(P.z)})`,
        detalhe: `a ponta do tubo ${c.id} não encosta em bocal, flange, outro tubo nem tampão (r = ${f2(c.r)} m)` });
    }
  }

  // SOLTO_NA_LINHA: a valvula ou o instrumento tem de tocar tubo, bocal ou
  // vaso (a tomada); encostar so na plataforma ou no piso nao vale
  const unidades = new Map();
  for (let i = 0; i < N; i++) { const u = malhas[i].unidade; if (u) { if (!unidades.has(u)) unidades.set(u, []); unidades.get(u).push(i); } }
  // o capilar e a tomada sao do instrumento: andam com ele ate o vaso, mas
  // sozinhos nao contam como linha
  const ehCapilar = (m) => m.cad.includes('capilar') || m.cad.includes('tomada');
  const ligaNaLinha = (m) => !ehCapilar(m) && (m.tubo || m.cad.some((n) => /^(bocal-DN\d+|costado|camisa|tubulacao)$/.test(n)) || (m.tag && !m.apoio && !m.unidade));
  const vizinhos = Array.from({ length: N }, () => []);
  for (const k of contato) { const a = Math.floor(k / N), b = k % N; vizinhos[a].push(b); vizinhos[b].push(a); }
  for (const [u, lista] of unidades) {
    const dentro = new Set(lista);
    // da unidade (e dos capilares presos nela) ate algo que seja linha
    const vistos = new Set(lista), fila = [...lista];
    let ok = false;
    while (fila.length && !ok) {
      const a = fila.pop();
      for (const b of vizinhos[a]) {
        if (vistos.has(b)) continue;
        if (ligaNaLinha(malhas[b])) { ok = true; break; }
        if (ehCapilar(malhas[b]) || malhas[b].unidade === u) { vistos.add(b); fila.push(b); }
      }
    }
    if (ok) continue;
    const m = malhas[lista[0]];
    const [d, j] = maisPerto(lista[0], 1.0, (k) => dentro.has(k) || !ligaNaLinha(malhas[k]));
    achados.push({ regra: 'SOLTO_NA_LINHA', peca: u.name, tag: m.tag, arquivo: m.arquivo, onde: ondeTxt(m.b),
      detalhe: `${u.name} não toca a linha nem a tomada; ${j >= 0 ? `a mais perto a ${f2(d)} m (${nomeDe(malhas[j])})` : 'nada a menos de 1 m'}` });
  }

  /* ------------------------------------------------ 7. resumo */
  const porRegra = {}, porEquipamento = {}, porArquivo = {};
  for (const a of achados) {
    porRegra[a.regra] = (porRegra[a.regra] ?? 0) + 1;
    const e = a.tag ?? '(sem TAG)';
    (porEquipamento[e] ??= {})[a.regra] = (porEquipamento[e][a.regra] ?? 0) + 1;
    (porArquivo[a.arquivo] ??= {})[a.regra] = (porArquivo[a.arquivo][a.regra] ?? 0) + 1;
  }
  const quem = (f) => (DA_NUVEM.test(f) ? 'nuvem' : DA_LOCAL.test(f) ? 'local' : 'sem dono');
  const porSessao = {};
  for (const [f, r] of Object.entries(porArquivo)) for (const [k, n] of Object.entries(r)) ((porSessao[quem(f)] ??= {})[k] = (porSessao[quem(f)][k] ?? 0) + n);
  const ordem = { FLUTUANDO: 0, SOLTO_NA_LINHA: 1, PONTA_SOLTA: 2, FOLGA: 3 };
  achados.sort((a, b) => ordem[a.regra] - ordem[b.regra] || (a.d ?? 0) - (b.d ?? 0));
  // o mesmo defeito repetido (os degraus de uma escada) numa linha so
  const agrupados = {};
  for (const a of achados) {
    const k = `${a.regra} | ${a.arquivo} | ${a.peca}`;
    const g = (agrupados[k] ??= { n: 0, dMin: null, onde: a.onde, exemplo: a.detalhe });
    g.n++;
    if (a.d != null && (g.dMin == null || a.d < g.dMin)) g.dMin = +a.d.toFixed(3);
  }
  return {
    total: achados.length, porRegra, porSessao, porArquivo, porEquipamento, agrupados, achados,
    medida: { malhas: N, raizes: malhas.filter((m) => m.raiz).length, triangulos: dono.length, componentes: comp.size, pares: contato.size, encaixes, testes,
      segundos: +((performance.now() - t0) / 1000).toFixed(1), semFusao,
      aviso: semFusao ? null : 'abra com ?semfusao: fundida, a cena junta pecas por material e a medida fica grosseira' },
  };
}
