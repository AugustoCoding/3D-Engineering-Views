import * as THREE from 'three';

/**
 * ===========================================================================
 *  AUDITORIA DOS INTERIORES  (Fase 16)
 * ===========================================================================
 *  Mede o que site/interiores.js montou pela caixa de cada malha — nao pela
 *  conta que a colocou —, para pegar peca cujo tamanho real difere da pegada
 *  declarada:
 *    MOVEL_FORA_DA_SALA  a peca sai da sala
 *    MOVEL_NA_PAREDE     a peca entra numa parede, laje ou divisoria
 *    MOVEL_NA_PORTA      a peca invade a faixa livre de uma porta, do pe ou
 *                        da chegada da escada, ou a frente reservada de outra
 *    MOVEL_SOBRE_MOVEL   duas pecas no mesmo volume
 *    FLUTUA / AFUNDA     peca de piso fora do piso (a de parede nao conta)
 *    SALA_SEM_ACESSO     a camera (esfera de 0,3 m) nao chega a sala, ou a
 *                        uma porta dela, saindo da porta do predio ou da escada
 *  A cena fundida junta as pecas por material: abra com ?semfusao.
 */
const RAIO = 0.3;
const CELULA = 0.1;

const sobrepoe = (a, b, e = 0.02) => a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.z0 < b.z1 - e && a.z1 > b.z0 + e;
const contem = (r, a, e = 0.03) => a.x0 >= r.x0 - e && a.x1 <= r.x1 + e && a.z0 >= r.z0 - e && a.z1 <= r.z1 + e;
const cruza3d = (a, c, e = 0.02) => a.min.x < c.x1 - e && a.max.x > c.x0 + e && a.min.y < c.y1 - e && a.max.y > c.y0 + e
  && a.min.z < c.z1 - e && a.max.z > c.z0 + e;

export function auditarInteriores({ interiores }) {
  const achados = [];
  const add = (regra, onde, detalhe) => achados.push({ regra, onde, detalhe });
  let pecas = 0;

  for (const it of interiores.interiores) {
    const R = it.registro;
    const paredes = [...it.predio.userData.colisores, ...R.colisores];
    const caixas = new Map();
    for (const m of R.moveis) {
      m.obj.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(m.obj);
      if (b.isEmpty()) {
        return { total: 0, porRegra: {}, achados: [], aviso: 'A cena está fundida: abra com ?semfusao para medir peça por peça.' };
      }
      caixas.set(m, b);
      pecas++;
    }
    const plano = (b) => ({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z });
    const onde = (m) => `${R.predio} · ${m.sala} · ${m.nome}`;

    for (const m of R.moveis) {
      const b = caixas.get(m), q = plano(b), s = m.ref;
      if (!contem(s.ret, q)) add('MOVEL_FORA_DA_SALA', onde(m), 'a caixa sai da sala');
      if (paredes.some((c) => cruza3d(b, c))) add('MOVEL_NA_PAREDE', onde(m), 'a caixa entra numa parede ou laje');
      // o que fica na parede acima de 2,1 m nao tapa porta
      // a faixa reservada na frente da propria peca nao conta
      if (m.y0 < 2.1 && s.livres.some((l) => l.dono !== m && sobrepoe(q, l))) add('MOVEL_NA_PORTA', onde(m), 'invade a faixa livre de porta ou escada');
      if (m.y0 === 0) {
        if (b.min.y > s.y + 0.05) add('FLUTUA', onde(m), `fundo ${(b.min.y - s.y).toFixed(2)} m acima do piso`);
        if (b.max.y < s.y) add('AFUNDA', onde(m), 'abaixo do piso');
      }
    }
    for (let i = 0; i < R.moveis.length; i++) {
      for (let j = i + 1; j < R.moveis.length; j++) {
        const a = caixas.get(R.moveis[i]), b = caixas.get(R.moveis[j]);
        const bb = { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z };
        if (cruza3d(a, bb, 0.03)) add('MOVEL_SOBRE_MOVEL', `${onde(R.moveis[i])} × ${R.moveis[j].nome}`, 'as caixas se cruzam');
      }
    }

    /* Acesso: grade de 10 cm sobre cada pavimento; celula livre e a que o
     * centro da camera ocupa sem encostar em movel ou divisoria. Parte da
     * porta do predio (terreo) ou da chegada da escada (andares). */
    const r = it.casca.ret;
    it.casca.pisos.forEach((y, k) => {
      const salas = R.salas.filter((s) => s.k === k);
      if (!salas.length) return;
      const nx = Math.ceil((r.x1 - r.x0) / CELULA), nz = Math.ceil((r.z1 - r.z0) / CELULA);
      const bloqueios = [
        ...R.moveis.filter((m) => m.ref.k === k && m.y0 < 1.5).map((m) => plano(caixas.get(m))),
        ...R.colisores.filter((c) => c.y0 < y + 1.5 && c.y1 > y + 0.5),
        ...salas.flatMap((s) => s.obstaculos),
      ];
      const livre = new Uint8Array(nx * nz);
      const centro = (i, j) => [r.x0 + (i + 0.5) * CELULA, r.z0 + (j + 0.5) * CELULA];
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const [x, z] = centro(i, j);
          if (x < r.x0 + RAIO || x > r.x1 - RAIO || z < r.z0 + RAIO || z > r.z1 - RAIO) continue;
          if (bloqueios.some((c) => x > c.x0 - RAIO && x < c.x1 + RAIO && z > c.z0 - RAIO && z < c.z1 + RAIO)) continue;
          livre[i * nz + j] = 1;
        }
      }
      const celulasDe = (q) => {
        const out = [];
        for (let i = Math.max(0, Math.floor((q.x0 - r.x0) / CELULA)); i < Math.min(nx, Math.ceil((q.x1 - r.x0) / CELULA)); i++) {
          for (let j = Math.max(0, Math.floor((q.z0 - r.z0) / CELULA)); j < Math.min(nz, Math.ceil((q.z1 - r.z0) / CELULA)); j++) out.push(i * nz + j);
        }
        return out;
      };
      const partida = salas.flatMap((s) => s.entradas.filter((e) => (k === 0 ? e.tipo === 'predio' : e.tipo === 'escada')).map((e) => e.livre));
      if (!partida.length) return;
      const visto = new Uint8Array(nx * nz);
      const fila = partida.flatMap(celulasDe).filter((c) => livre[c]);
      for (const c of fila) visto[c] = 1;
      while (fila.length) {
        const c = fila.pop();
        const i = Math.floor(c / nz), j = c % nz;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
          const v = a * nz + b;
          if (livre[v] && !visto[v]) { visto[v] = 1; fila.push(v); }
        }
      }
      for (const s of salas) {
        if (!celulasDe(s.ret).some((c) => visto[c])) add('SALA_SEM_ACESSO', `${R.predio} · ${s.nome}`, `pavimento ${k}`);
        for (const e of s.entradas) {
          if (!celulasDe(e.livre).some((c) => visto[c])) add('SALA_SEM_ACESSO', `${R.predio} · ${s.nome}`, `não se chega à ${e.tipo === 'predio' ? 'porta do prédio' : e.tipo}`);
        }
      }
    });
  }
  const porRegra = {};
  for (const a of achados) (porRegra[a.regra] ??= []).push(a);
  return { total: achados.length, porRegra, achados, resumo: { predios: interiores.interiores.length, pecas } };
}
