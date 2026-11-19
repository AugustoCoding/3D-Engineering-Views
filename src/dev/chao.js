import * as THREE from 'three';

/**
 * ===========================================================================
 *  AUDITORIA DO CHAO (Fase 14)
 * ===========================================================================
 *  Z_FIGHTING  duas superficies de materiais diferentes, quase na mesma
 *              altura (menos de 4 cm — vistas de 200 m, o z-buffer ja nao as
 *              separa), que se sobrepoem em planta: o chao pisca quando a
 *              camera anda. Mesmo material nao conta (a sobreposicao sai da
 *              mesma cor); pintura com deslocamento de profundidade
 *              (polygonOffset) tambem nao.
 *  TRAVESSIA   travessia elevada sem calcada nos dois lados.
 *
 *  So pecas chatas (ate 40 cm de altura), com area (0,25 m²) e ate 0,5 m do
 *  chao: e o que deita no terreno ou no piso da laje. A sobreposicao e
 *  medida pela caixa em planta — pode acusar a mais numa peca girada; nunca
 *  a menos.
 *
 *  No console: __auditarChao().
 * ===========================================================================
 */
const f2 = (v) => v.toFixed(2).replace('.', ',');

function nome(o) {
  for (let n = o; n; n = n.parent) if (n.name) return n.name;
  return o.type;
}

export function auditarChao({ scene, chao }, { tolerancia = 0.039, espessuraMax = 0.4, areaMin = 0.25, topoMax = 0.5 } = {}) {
  const achados = [];
  const planos = [];
  let fundidas = 0;
  scene.updateWorldMatrix(true, true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
    // malha fundida (core/fundir.js) cobre a planta inteira: a caixa dela nao
    // diz onde a peca esta — mede-se com ?semfusao
    if (/^fundida/.test(o.name)) { fundidas++; return; }
    for (let n = o; n; n = n.parent) if (!n.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m.polygonOffset || (m.transparent && !m.depthWrite))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (b.max.y - b.min.y > espessuraMax || b.max.y > topoMax) return;
    if ((b.max.x - b.min.x) * (b.max.z - b.min.z) < areaMin) return;
    planos.push({ o, b, topo: b.max.y, mat: mats.map((m) => m.uuid).join('+') });
  });

  // grade de 10 m em planta: so compara quem esta perto
  const grade = new Map();
  const chave = (i, j) => `${i},${j}`;
  planos.forEach((p, k) => {
    for (let i = Math.floor(p.b.min.x / 10); i <= Math.floor(p.b.max.x / 10); i++) {
      for (let j = Math.floor(p.b.min.z / 10); j <= Math.floor(p.b.max.z / 10); j++) {
        const c = chave(i, j);
        if (!grade.has(c)) grade.set(c, []);
        grade.get(c).push(k);
      }
    }
  });
  const vistos = new Set();
  for (const lista of grade.values()) {
    for (let a = 0; a < lista.length; a++) {
      for (let c = a + 1; c < lista.length; c++) {
        const [i, j] = lista[a] < lista[c] ? [lista[a], lista[c]] : [lista[c], lista[a]];
        const par = `${i}-${j}`;
        if (vistos.has(par)) continue;
        vistos.add(par);
        const p = planos[i], q = planos[j];
        if (p.mat === q.mat) continue;
        const dy = Math.abs(p.topo - q.topo);
        if (dy >= tolerancia) continue;
        const ox = Math.min(p.b.max.x, q.b.max.x) - Math.max(p.b.min.x, q.b.min.x);
        const oz = Math.min(p.b.max.z, q.b.max.z) - Math.max(p.b.min.z, q.b.min.z);
        if (ox <= 0.02 || oz <= 0.02 || ox * oz < areaMin) continue;
        achados.push({
          regra: 'Z_FIGHTING', peca: `${nome(p.o)} × ${nome(q.o)}`,
          detalhe: `${f2(dy * 100)} cm de diferença em (${f2((Math.max(p.b.min.x, q.b.min.x) + Math.min(p.b.max.x, q.b.max.x)) / 2)}; ${f2((Math.max(p.b.min.z, q.b.min.z) + Math.min(p.b.max.z, q.b.max.z)) / 2)})`,
        });
      }
    }
  }

  // toda travessia tem calcada chegando dos dois lados
  for (const t of chao?.travessias ?? []) {
    const n = [-1, 1].map((s) => {
      const pt = [t.x - t.dv[1] * s * (t.largura / 2 + 0.5), t.z + t.dv[0] * s * (t.largura / 2 + 0.5)];
      return chao.calcadas.some((pts) => pts.some((p, k) => k > 0 && distSeg(pt, pts[k - 1], p) < 1.2));
    });
    if (!n[0] || !n[1]) achados.push({ regra: 'TRAVESSIA', peca: t.calcada, detalhe: `travessia sobre ${t.via} sem calçada dos dois lados` });
  }

  const porRegra = {};
  for (const a of achados) (porRegra[a.regra] ??= []).push(a);
  return {
    total: achados.length, porRegra, achados, superficies: planos.length,
    ...(fundidas ? { aviso: `${fundidas} malhas fundidas ficaram de fora: abra com ?semfusao` } : {}),
  };
}

function distSeg([x, z], [ax, az], [bx, bz]) {
  const vx = bx - ax, vz = bz - az;
  const L2 = vx * vx + vz * vz;
  const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
  return Math.hypot(x - (ax + t * vx), z - (az + t * vz));
}
