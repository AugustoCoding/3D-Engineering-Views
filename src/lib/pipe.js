import * as THREE from 'three';
import { DN } from '../data/plant.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  TUBULACAO
 * ===========================================================================
 *  Voce descreve a linha pelos seus VERTICES (como num isometrico) e esta
 *  biblioteca insere os cotovelos com raio de curvatura de verdade.
 *
 *  Isso importa: uma spline "suavizada" entre pontos entorta os trechos retos
 *  e nao respeita raio de curvatura. Aqui os retos ficam retos e a curva tem
 *  raio definido — que e como tubulacao industrial realmente e.
 *
 *  Esta e a peca que vai carregar o resto da planta (racks, linhas de
 *  processo, utilidades), entao ela nasce generica de proposito.
 */

/** Curva exata sobre uma polilinha densa (sem suavizacao parasita). */
class CurvaPolilinha extends THREE.Curve {
  constructor(pontos) {
    super();
    this.pontos = pontos;
    this.acum = [0];
    let total = 0;
    for (let i = 1; i < pontos.length; i++) {
      total += pontos[i].distanceTo(pontos[i - 1]);
      this.acum.push(total);
    }
    this.total = total || 1;
  }
  getPoint(t, alvo = new THREE.Vector3()) {
    const s = THREE.MathUtils.clamp(t, 0, 1) * this.total;
    let i = 1;
    while (i < this.acum.length - 1 && this.acum[i] < s) i++;
    const s0 = this.acum[i - 1];
    const seg = this.acum[i] - s0 || 1;
    const f = (s - s0) / seg;
    return alvo.copy(this.pontos[i - 1]).lerp(this.pontos[i], f);
  }
}

/**
 * Insere cotovelos de raio `raio` em cada vertice interno da polilinha.
 * Retorna uma polilinha densa: retos preservados, curvas com arco real.
 */
export function comCotovelos(vertices, raio, segArco = 8) {
  if (vertices.length < 3) return vertices.map((v) => v.clone());

  const saida = [vertices[0].clone()];

  for (let i = 1; i < vertices.length - 1; i++) {
    const P = vertices[i];
    const u = new THREE.Vector3().subVectors(vertices[i - 1], P).normalize();
    const v = new THREE.Vector3().subVectors(vertices[i + 1], P).normalize();

    const cos = THREE.MathUtils.clamp(u.dot(v), -1, 1);
    const teta = Math.acos(cos);

    // vertices colineares: nao ha cotovelo
    if (teta > Math.PI - 1e-3 || teta < 1e-3) { saida.push(P.clone()); continue; }

    // recuo do cotovelo, limitado a metade do trecho mais curto
    const dMax = 0.49 * Math.min(
      P.distanceTo(vertices[i - 1]),
      P.distanceTo(vertices[i + 1]),
    );
    const d = Math.min(raio / Math.tan(teta / 2), dMax);
    const rEfetivo = d * Math.tan(teta / 2);

    const T1 = P.clone().addScaledVector(u, d);
    const T2 = P.clone().addScaledVector(v, d);

    // centro do arco: na bissetriz interna
    const bis = new THREE.Vector3().addVectors(u, v).normalize();
    const centro = P.clone().addScaledVector(bis, rEfetivo / Math.sin(teta / 2));

    const a1 = new THREE.Vector3().subVectors(T1, centro);
    const a2 = new THREE.Vector3().subVectors(T2, centro);
    const eixo = new THREE.Vector3().crossVectors(a1, a2).normalize();
    const varredura = a1.angleTo(a2);

    saida.push(T1);
    for (let k = 1; k < segArco; k++) {
      const p = a1.clone().applyAxisAngle(eixo, (k / segArco) * varredura).add(centro);
      saida.push(p);
    }
    saida.push(T2);
  }

  saida.push(vertices[vertices.length - 1].clone());
  return saida;
}

/**
 * Casca cilindrica varrida ao longo de uma polilinha densa: um anel em CADA
 * ponto, nenhum a mais.
 *
 * O TubeGeometry reamostra a curva em passos iguais de comprimento: numa
 * linha de 40 m com ~60 aneis, o cotovelo de 0,2 m caia entre dois deles e
 * virava uma corda — o tubo parecia um canudo amassado na curva. Aqui o reto
 * e um so trecho (dois aneis) e o arco do cotovelo tem os aneis dele.
 *
 * Cada anel fica no plano da bissetriz entre o trecho que chega e o que sai,
 * e o referencial anda por transporte paralelo (a menor rotacao de um
 * ponto ao seguinte): o tubo nao torce entre um cotovelo e outro.
 */
export function geometriaTubo(pontos, raio, segRadial = 16) {
  // pontos repetidos dariam tangente nula
  const P = pontos.filter((p, i) => i === 0 || p.distanceToSquared(pontos[i - 1]) > 1e-10);
  const n = P.length;
  if (n < 2) {
    // tubo de comprimento zero: geometria vazia, com os mesmos atributos
    const g = new THREE.BufferGeometry();
    for (const [nome, k] of [['position', 3], ['normal', 3], ['uv', 2]]) g.setAttribute(nome, new THREE.Float32BufferAttribute([], k));
    return g;
  }
  const dirs = [];
  for (let i = 1; i < n; i++) dirs.push(new THREE.Vector3().subVectors(P[i], P[i - 1]).normalize());
  const tang = P.map((_, i) => {
    if (i === 0) return dirs[0].clone();
    if (i === n - 1) return dirs[n - 2].clone();
    const t = new THREE.Vector3().addVectors(dirs[i - 1], dirs[i]);
    return t.lengthSq() < 1e-8 ? dirs[i].clone() : t.normalize();
  });
  // referencial inicial: qualquer perpendicular a primeira tangente
  const t0 = tang[0];
  const aux = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let normal = new THREE.Vector3().crossVectors(t0, aux).normalize();
  const q = new THREE.Quaternion();

  const pos = [], nor = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      q.setFromUnitVectors(tang[i - 1], tang[i]);
      normal.applyQuaternion(q);
      // reortogonaliza contra a deriva numerica
      normal.addScaledVector(tang[i], -normal.dot(tang[i])).normalize();
      s += P[i].distanceTo(P[i - 1]);
    }
    const binormal = new THREE.Vector3().crossVectors(tang[i], normal);
    // no plano da bissetriz o anel e uma elipse: alonga na direcao da curva
    // para a parede manter o raio (1/cos da meia-deflexao)
    let esticar = 1, dirCurva = null;
    if (i > 0 && i < n - 1) {
      const c = THREE.MathUtils.clamp(dirs[i - 1].dot(dirs[i]), -1, 1);
      esticar = 1 / Math.max(0.3, Math.cos(Math.acos(c) / 2));
      dirCurva = new THREE.Vector3().subVectors(dirs[i], dirs[i - 1]);
      if (dirCurva.lengthSq() < 1e-10) dirCurva = null;
      else dirCurva.addScaledVector(tang[i], -dirCurva.dot(tang[i])).normalize();
    }
    for (let j = 0; j <= segRadial; j++) {
      const a = (j / segRadial) * Math.PI * 2;
      const d = new THREE.Vector3().copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a));
      const off = d.clone().multiplyScalar(raio);
      if (dirCurva) off.addScaledVector(dirCurva, (esticar - 1) * raio * d.dot(dirCurva));
      pos.push(P[i].x + off.x, P[i].y + off.y, P[i].z + off.z);
      nor.push(d.x, d.y, d.z);
      uv.push(j / segRadial, s);
    }
  }
  const anel = segRadial + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < segRadial; j++) {
      const a = i * anel + j, b = (i + 1) * anel + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Tubo a partir de uma lista de vertices.
 * @param {THREE.Vector3[]} vertices
 * @param {object} opts  { dn | diam, raioCurva, mat, segRadial }
 */
export function tuboPorCaminho(vertices, opts = {}) {
  const diam = opts.diam ?? (opts.dn ? DN[opts.dn].od : 0.1143);
  const raio = opts.raioCurva ?? diam * 1.5; // 1,5 D = cotovelo longo padrao
  // 12 aneis num cotovelo de 90°: 7,5° cada, a curva se le lisa de perto
  const pontos = comCotovelos(vertices, raio, 12);
  const geo = geometriaTubo(pontos, diam / 2, opts.segRadial ?? 16);
  const m = new THREE.Mesh(geo, opts.mat ?? MAT.inox);
  m.castShadow = true;
  // A linha de centro fica guardada para a auditoria geometrica poder
  // perguntar por onde a linha passa sem ter de reconstruir isso da malha.
  m.userData.caminho = pontos;
  m.userData.diam = diam;
  return m;
}

/** Tubo a partir de uma curva pronta (helices, serpentinas, etc). */
export function tuboPorCurva(curva, diam, mat = MAT.inox, segTubular = 400) {
  const geo = new THREE.TubeGeometry(curva, segTubular, diam / 2, 14, false);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

export { CurvaPolilinha };

/* Comprimento da reducao concentrica, m — ASME B16.9 (dimensao H), pelo DN
 * maior: 2" 76 mm, 2½" e 3" 89 mm, 4" 102 mm, 6" 140 mm, 8" 152 mm. */
const H_REDUCAO = { 25: 0.051, 32: 0.051, 40: 0.064, 50: 0.076, 65: 0.089, 80: 0.089, 100: 0.102, 150: 0.14, 200: 0.152, 250: 0.178, 300: 0.203 };

/**
 * Reducao concentrica na ponta da linha que chega a um bocal maior que ela
 * (Fase 25): sem ela, o tubo de 3" terminava no meio do furo do flange de
 * 6" da tremonha, sem encostar em nada. `ponta`: onde a linha encontra o
 * bocal; `dir`: o sentido da linha ao chegar. O lado grande fica na ponta.
 */
export function criarReducao({ ponta, dir, dnMaior, dnMenor, mat = MAT.acoCarbono }) {
  const H = H_REDUCAO[dnMaior] ?? 0.1;
  const geo = new THREE.CylinderGeometry(DN[dnMenor].od / 2, DN[dnMaior].od / 2, H, 24, 1, true);
  const m = new THREE.Mesh(geo, mat);
  const d = dir.clone().normalize();
  // +Y (o lado pequeno) aponta para tras, para a linha
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate());
  m.position.copy(ponta).addScaledVector(d, -H / 2);
  m.castShadow = true;
  m.name = 'reducao';
  return m;
}
