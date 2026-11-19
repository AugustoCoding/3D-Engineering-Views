import * as THREE from 'three';

/**
 * ===========================================================================
 *  PERFIS DE REVOLUCAO DE TAMPOS DE VASO DE PRESSAO
 * ===========================================================================
 *
 *  Um vaso de pressao e uma superficie de revolucao. Em vez de "modelar" o
 *  vaso, a gente descreve o seu PERFIL no plano (raio, altura) e revoluciona
 *  com THREE.LatheGeometry. Isso da geometria exata, parametrica e barata.
 *
 *  Todas as funcoes retornam um array de THREE.Vector2 (x = raio, y = altura),
 *  ordenado da LINHA DE TANGENCIA (y = 0) ate o APICE do tampo.
 *
 *  O parametro `inset` desloca o perfil para DENTRO da parede. Ele existe para
 *  que o mesmo codigo gere a superficie externa (inset = 0) e a interna
 *  (inset = espessura) — e o vaso possa ser fechado como uma casca com
 *  espessura real, que aparece corretamente quando cortado em secao.
 */

/* ---------------------------------------------------------------------------
 * TAMPO TORISFERICO — ASME Flanged & Dished
 *
 *   Composto por DOIS arcos tangentes entre si:
 *     - o "rebordo" (knuckle), raio pequeno rk, tangente ao costado
 *     - a "calota" (crown),   raio grande Lc, tangente ao rebordo
 *
 *   Padrao ASME F&D:  Lc = D  e  rk = 0,06 D
 *   Padrao 80:10   :  Lc = 0,8 D  e  rk = 0,10 D
 *
 *   Detalhe importante: ao deslocar a superficie para dentro da parede, os
 *   CENTROS dos dois arcos NAO se movem — apenas os raios diminuem de `inset`.
 *   Por isso a casca interna sai perfeitamente concentrica com a externa.
 * ------------------------------------------------------------------------ */
export function perfilTorisferico(R, { Lc, rk, inset = 0, seg = 24 } = {}) {
  const D = 2 * R;
  Lc = Lc ?? D;          // raio da calota
  rk = rk ?? 0.06 * D;   // raio do rebordo

  const Re = R - inset;   // raio do costado nesta superficie
  const Lce = Lc - inset; // raio da calota nesta superficie
  const rke = rk - inset; // raio do rebordo nesta superficie

  // Centro do rebordo: deslocado para dentro de rk, na altura da tangencia.
  // (R - rk) === (Re - rke), logo o centro e o MESMO nas duas superficies.
  const cKnuckle = new THREE.Vector2(R - rk, 0);

  // Centro da calota: no eixo, abaixo da linha de tangencia.
  // Distancia entre centros deve ser (Lc - rk) para os arcos serem tangentes.
  const dz2 = (Lc - rk) ** 2 - (R - rk) ** 2;
  const zc = -Math.sqrt(Math.max(dz2, 1e-9));
  const cCrown = new THREE.Vector2(0, zc);

  // Angulo em que os dois arcos se encontram (ponto de tangencia).
  const alpha = Math.atan2(-zc, R - rk);

  const pts = [];

  // --- arco do rebordo: da linha de tangencia ate o encontro ---
  const nk = Math.max(4, Math.round(seg * 0.4));
  for (let i = 0; i <= nk; i++) {
    const t = (i / nk) * alpha;
    pts.push(new THREE.Vector2(
      cKnuckle.x + rke * Math.cos(t),
      cKnuckle.y + rke * Math.sin(t),
    ));
  }

  // --- arco da calota: do encontro ate o apice ---
  const thetaJ = Math.atan2(
    cKnuckle.y + rke * Math.sin(alpha) - zc,
    cKnuckle.x + rke * Math.cos(alpha),
  );
  const nc = Math.max(6, seg);
  for (let i = 1; i <= nc; i++) {
    const t = thetaJ + (i / nc) * (Math.PI / 2 - thetaJ);
    pts.push(new THREE.Vector2(
      cCrown.x + Lce * Math.cos(t),
      cCrown.y + Lce * Math.sin(t),
    ));
  }

  pts[pts.length - 1].x = 0; // fecha exatamente no eixo
  return pts;
}

/* ---------------------------------------------------------------------------
 * TAMPO ELIPTICO 2:1  —  o mais comum em vasos de processo
 *   Semi-eixo radial  a = D/2      Semi-eixo axial  b = D/4
 *   Profundidade do tampo = D/4
 * ------------------------------------------------------------------------ */
export function perfilEliptico(R, { razao = 2, inset = 0, seg = 28 } = {}) {
  const a = R - inset;
  const b = R / razao - inset;
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(a * Math.cos(t), b * Math.sin(t)));
  }
  pts[pts.length - 1].x = 0;
  return pts;
}

/* --------------------------------------------------------------------------
 * TAMPO HEMISFERICO — usado em pressoes altas
 * ------------------------------------------------------------------------ */
export function perfilHemisferico(R, { inset = 0, seg = 28 } = {}) {
  return perfilEliptico(R, { razao: 1, inset, seg });
}

/* --------------------------------------------------------------------------
 * TAMPO PLANO — flanges cegos, vasos de baixa pressao
 * ------------------------------------------------------------------------ */
export function perfilPlano(R, { inset = 0 } = {}) {
  const r = R - inset;
  return [new THREE.Vector2(r, 0), new THREE.Vector2(0, 0)];
}

/* --------------------------------------------------------------------------
 * FUNDO CONICO — cristalizadores e vasos que descarregam suspensao
 *   `angulo` e o angulo INCLUIDO no vertice. A 90° a altura e R e o volume e
 *   pi.R³/3 = pi.D³/24 — exatamente o de um tampo eliptico 2:1. Trocar um pelo
 *   outro nao mexe em volume total nem no nivel acima da tangencia.
 *   A superficie interna e a externa recuada de `inset` na horizontal; a
 *   espessura na normal fica ~30 % menor, diferenca que nao aparece na escala.
 * ------------------------------------------------------------------------ */
export function perfilConico(R, { angulo = 90, inset = 0 } = {}) {
  const r = R - inset;
  const h = r / Math.tan(THREE.MathUtils.degToRad(angulo / 2));
  return [new THREE.Vector2(r, 0), new THREE.Vector2(0, h)];
}

/** Despacha pelo nome usado em plant.js. */
export function perfilTampo(tipo, R, opts = {}) {
  switch (tipo) {
    case 'torisferico': return perfilTorisferico(R, opts);
    case 'hemisferico': return perfilHemisferico(R, opts);
    case 'plano': return perfilPlano(R, opts);
    case 'conico': return perfilConico(R, opts);
    case 'eliptico':
    default: return perfilEliptico(R, opts);
  }
}

/** Profundidade do tampo (da linha de tangencia ate o apice). */
export function alturaTampo(tipo, R, opts = {}) {
  const p = perfilTampo(tipo, R, opts);
  return p[p.length - 1].y;
}

/**
 * Altura da superficie do tampo a uma distancia `r` do eixo.
 * E o que permite assentar um bocal de topo exatamente sobre a curvatura do
 * tampo, em vez de deixa-lo flutuando ou afundado.
 */
export function alturaNoRaio(tipo, R, r, opts = {}) {
  const p = perfilTampo(tipo, R, opts);
  r = Math.min(Math.max(r, 0), p[0].x);
  // O perfil vem ordenado da tangencia (raio maximo) ate o apice (raio 0).
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (r <= a.x && r >= b.x) {
      const f = a.x === b.x ? 0 : (a.x - r) / (a.x - b.x);
      return a.y + f * (b.y - a.y);
    }
  }
  return p[p.length - 1].y;
}
