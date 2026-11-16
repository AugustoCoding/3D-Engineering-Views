/**
 * ===========================================================================
 *  FOTOMETRIA  (Fase 26)
 * ===========================================================================
 *  A conta de luz da planta, numa primitiva so: a auditoria
 *  (__auditarIluminacao) e a poca de luz da noite (site/noite.js) saem
 *  daqui — calculo duplicado diverge, e o que se ve tem de ser o que se
 *  mediu.
 *
 *  Modelo: fonte pontual, sem obstrucao (como a conta de projeto da EN
 *  12464-2 sem o fator de obstaculo), iluminancia num plano de normal n:
 *
 *      E = Fm · I(θ) · cos β / d²
 *
 *  θ entre o eixo da luminaria e o raio ate o ponto; β entre o raio de
 *  volta e a normal do plano (horizontal, por omissao: e o que a EN pede
 *  para Em e Uo). Fm = 0,8 [ADOTADO, ROTEIRO Fase 26].
 *
 *  Distribuicao de intensidade, simetrica em torno do eixo:
 *    'cos'   I(θ) = I0 · cos^m θ — projetor, arandela, luminaria de teto.
 *            m sai do facho: cos^m(facho/2) = 0,5; I0 = Φ (m + 1) / 2π.
 *    'larga' asa de morcego (otica viaria e de area): I cresce como
 *            1/cos²θ ate o pico e cai em rampa cos² de 15° ate zero. Com
 *            1/cos², a iluminancia horizontal sob o poste cai so com cos θ
 *            ate o pico — e o que deixa o poste a 3–4 alturas do outro com
 *            Uo ≥ 0,4. Com cos^m o pico fica no pe do poste e o
 *            espacamento pelo alvo encheria a via de postes. A razao pico /
 *            nadir sai 1/cos²(θp): ~5 com facho de 140°, a ordem da otica
 *            viaria real (3 a 6) [ESTIMADO].
 *  `facho` e sempre o angulo TOTAL a 50 % da intensidade maxima; `fluxo`,
 *  os lumens que saem da luminaria (rendimento ja incluso). A intensidade
 *  e normalizada por integracao numerica (2π ∫ f(θ) sen θ dθ = 1).
 *
 *  Luminaria: { p: [x, y, z], dir: [x, y, z], fluxo, facho, perfil?, ex?,
 *  emergencia? } — o formato de `userData.luminaria` (com p no mundo) e de
 *  cada item de `userData.luminarias`. Vector3 tambem serve em p e dir.
 *
 *  Sem three.js: roda no Node, como lib/plano.js.
 */

/** Fator de manutencao [ADOTADO, ROTEIRO Fase 26]. */
export const FM = 0.8;

const RAD = Math.PI / 180;
const RAMPA = 15 * RAD;          // queda do pico ate zero na 'larga' [ADOTADO]
const PICO_MAX = 75 * RAD;       // 1/cos² explode perto de 90°

const xyz = (v) => (Array.isArray(v) ? v : [v.x, v.y, v.z]);

/** Expoente m da distribuicao cos^m pelo facho total a 50 %. */
export function expoente(facho) {
  const c = Math.cos(Math.min(facho, 179) * RAD / 2);
  return c > 0 ? Math.log(0.5) / Math.log(c) : 0;
}

/** Forma da distribuicao (sem escala), por perfil e facho. */
function forma(perfil, facho) {
  if (perfil === 'larga') {
    const tp = Math.min(PICO_MAX, Math.max(0, facho * RAD / 2 - RAMPA / 2));
    const fp = 1 / Math.cos(tp) ** 2;
    return (t) => {
      if (t <= tp) return 1 / Math.cos(t) ** 2;
      if (t >= tp + RAMPA) return 0;
      return fp * Math.cos((Math.PI / 2) * (t - tp) / RAMPA) ** 2;
    };
  }
  const m = expoente(facho);
  return (t) => (t < Math.PI / 2 ? Math.cos(t) ** m : 0);
}

// integral 2π ∫ f sen θ dθ, por perfil e facho (Simpson, 720 passos)
const cacheNorma = new Map();
function norma(perfil, facho) {
  const k = `${perfil}|${facho}`;
  if (cacheNorma.has(k)) return cacheNorma.get(k);
  const f = forma(perfil, facho), n = 720, h = Math.PI / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const t = i * h, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s += w * f(t) * Math.sin(t);
  }
  const v = 2 * Math.PI * s * h / 3;
  cacheNorma.set(k, v);
  return v;
}

/** Intensidade (cd) de uma luminaria a um angulo θ (rad) do eixo dela. */
export function intensidade({ fluxo, facho, perfil = 'cos' }, teta) {
  return fluxo * forma(perfil, facho)(teta) / norma(perfil, facho);
}

/**
 * Luminarias num formato compacto para conta em massa: posicao, eixo
 * unitario e a funcao de intensidade ja escalada. Faca uma vez e passe a
 * `iluminancia` e `grade` quantas vezes quiser.
 */
export function prepararLuminarias(lista) {
  return lista.map((l) => {
    const p = xyz(l.p), d = xyz(l.dir), nd = Math.hypot(d[0], d[1], d[2]) || 1;
    const perfil = l.perfil ?? 'cos';
    const f = forma(perfil, l.facho), k = l.fluxo / norma(perfil, l.facho);
    return { p, d: [d[0] / nd, d[1] / nd, d[2] / nd], I: (t) => k * f(t), fonte: l };
  });
}

const preparado = (lums) => (lums.length && lums[0].I ? lums : prepararLuminarias(lums));

/**
 * Iluminancia (lx) num ponto [x, y, z], somando as luminarias (lista crua ou
 * ja preparada). `normal`: do plano medido, para cima por omissao.
 * `filtro(fonte)`: so as que passam (as de emergencia, numa rota de fuga).
 */
export function iluminancia(ponto, luminarias, { normal = [0, 1, 0], fm = FM, filtro } = {}) {
  const [x, y, z] = xyz(ponto), [nx, ny, nz] = xyz(normal);
  let E = 0;
  for (const l of preparado(luminarias)) {
    if (filtro && !filtro(l.fonte)) continue;
    const vx = x - l.p[0], vy = y - l.p[1], vz = z - l.p[2];
    const d2 = vx * vx + vy * vy + vz * vz;
    if (d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const cosB = -(vx * nx + vy * ny + vz * nz) / d;           // raio de volta · normal
    if (cosB <= 0) continue;                                     // luz por tras do plano
    const cosT = (vx * l.d[0] + vy * l.d[1] + vz * l.d[2]) / d;
    const t = Math.acos(Math.max(-1, Math.min(1, cosT)));
    E += l.I(t) * cosB / d2;
  }
  return E * fm;
}

/**
 * Iluminancia numa grade retangular do plano horizontal, na altura y:
 * { nx, nz, passo, x0, z0, E: Float32Array (linha a linha em z) }. Para a
 * poca de luz da noite virar textura — a mesma conta da auditoria.
 */
export function grade({ x0, z0, x1, z1, passo = 1, y = 0 }, luminarias, op = {}) {
  const lums = preparado(luminarias);
  const nx = Math.max(1, Math.round((x1 - x0) / passo) + 1), nz = Math.max(1, Math.round((z1 - z0) / passo) + 1);
  const E = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) E[j * nx + i] = iluminancia([x0 + i * passo, y, z0 + j * passo], lums, op);
  }
  return { nx, nz, passo, x0, z0, E };
}

/**
 * A area fecha o alvo? Em >= alvo.Em e, conforme o alvo, Uo >= alvo.Uo
 * (EN 12464-2) ou Emin >= alvo.Emin (iluminacao de seguranca: numa faixa
 * longa, a luz de outra coisa sobe o Em sem subir o minimo junto da cerca).
 * Uma regra so para quem coloca, quem adensa e quem mede.
 */
export const fecha = (st, alvo) => st.Em >= alvo.Em && (alvo.Emin != null ? st.Emin >= alvo.Emin : st.Uo >= alvo.Uo);

/** Em, Emin, Emax e Uo = Emin / Em de uma lista de iluminancias. */
export function estatistica(Es) {
  let s = 0, min = Infinity, max = 0;
  for (const e of Es) { s += e; if (e < min) min = e; if (e > max) max = e; }
  const n = Es.length, Em = n ? s / n : 0;
  return { n, Em, Emin: n ? min : 0, Emax: max, Uo: Em > 0 ? min / Em : 0 };
}

/* ---------------------------------------------------------------------------
 *  Grades de medida — as mesmas para quem coloca (passoPorAlvo) e para quem
 *  mede (dev/iluminacao.js).
 * ------------------------------------------------------------------------- */

/** Passo da grade de area da EN 12464 (p = 0,2·5^log10 d, d o lado maior), m. */
export const passoDeArea = (d) => Math.min(10, 0.2 * 5 ** Math.log10(Math.max(1, d)));

/**
 * Pontos de medida numa faixa ao longo de uma polilinha [[x, z], ...] de
 * largura `largura` (EN 13201-3): ao longo, a cada `passo` m (<= 3), no
 * meio de cada intervalo; atravessado, `nTrans` pontos no meio de faixas
 * iguais (3 por faixa de rolamento de ~3,5 m, por omissao).
 */
export function pontosDaFaixa(pontos, largura, { passo = 3, nTrans } = {}) {
  const n = nTrans ?? 3 * Math.max(1, Math.round(largura / 3.5));
  const out = [];
  for (let i = 1; i < pontos.length; i++) {
    const [ax, az] = pontos[i - 1], [bx, bz] = pontos[i];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-6) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    const k = Math.max(1, Math.ceil(L / passo));
    for (let a = 0; a < k; a++) {
      const s = ((a + 0.5) / k) * L;
      for (let b = 0; b < n; b++) {
        const t = ((b + 0.5) / n - 0.5) * largura;
        out.push([ax + ux * s - uz * t, az + uz * s + ux * t]);
      }
    }
  }
  return out;
}

/**
 * Maior passo entre postes que cumpre o alvo numa faixa reta de `largura`
 * (via ou caminho), com postes de um lado ou alternados dos dois (`lados`).
 * A luminaria fica a `alt` m de altura e a `dLat` m do eixo da faixa, do
 * lado do poste, com o eixo inclinado `incl` graus do nadir para dentro da
 * faixa. Mede um periodo no meio de uma fila de 11 postes, na grade de
 * `pontosDaFaixa`. `passos`: os passos a tentar, do maior para o menor.
 * Devolve { passo, Em, Uo } ou null (nenhum passo fecha).
 */
export function passoPorAlvo({ largura, lados = 1, alt, dLat, incl = 0, luminaria, alvo, passos, fm = FM }) {
  const a = incl * RAD;
  for (const S of passos) {
    const lums = [];
    for (let k = -5; k <= 5; k++) {
      const lado = lados === 2 && k % 2 ? -1 : 1;
      lums.push({ ...luminaria, p: [k * S, alt, lado * dLat], dir: [0, -Math.cos(a), -lado * Math.sin(a)] });
    }
    const periodo = lados === 2 ? 2 * S : S;
    const pts = pontosDaFaixa([[0, 0], [periodo, 0]], largura, { passo: Math.min(3, S / 10) });
    const st = estatistica(pts.map(([x, z]) => iluminancia([x, 0, z], lums, { fm })));
    if (fecha(st, alvo)) return { passo: S, Em: st.Em, Uo: st.Uo };
  }
  return null;
}
