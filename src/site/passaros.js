/**
 * ===========================================================================
 *  PASSAROS EM BANDO  (Fase 27, item 21)
 * ===========================================================================
 *  Boids sobre a planta, desviando de estrutura. Os obstaculos sao as caixas
 *  de tudo o que passa de PASSAROS.obstaculoMin de altura (cada instancia
 *  de poste conta por si), numa grade de 10 m para a busca. Cada ave e um
 *  "V" (corpo e duas asas) numa InstancedMesh: a batida de asa e a escala Y
 *  da instancia indo de +1 a -1. De dia so (de noite empoleiram).
 *  `auditar(segundos)` simula num clone do estado e conta ave dentro de
 *  geometria, fora do lote e baixa demais.
 * ===========================================================================
 */
import * as THREE from 'three';
import { PASSAROS } from '../data/passaros.js';
import { LOTE } from '../data/site.js';

/** Geometria do "V": corpo curto e duas asas finas subindo para fora. */
function geometriaAve(env) {
  const h = env / 2, g = new THREE.BufferGeometry();
  // asas: dois triangulos do corpo (0,0) ate a ponta (±h, 0,12)
  const v = [
    -h, 0.12, 0, 0, 0, 0.1, 0, 0, -0.08,
    0, 0, 0.1, h, 0.12, 0, 0, 0, -0.08,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function criarPassaros({ cena }) {
  const P = PASSAROS;
  const lote = { x0: LOTE.x[0], x1: LOTE.x[1], z0: LOTE.z[0], z1: LOTE.z[1] };
  let semente = 2027;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };

  /* ---- obstaculos: caixas do que e alto, numa grade de 10 m em planta ---- */
  const caixas = [];
  const b = new THREE.Box3(), m = new THREE.Matrix4();
  cena.scene.updateMatrixWorld(true);
  cena.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || o.name === 'passaros' || /^(ceu|chao|terreno)/.test(o.name)) return;
    if (o.isInstancedMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        b.copy(o.geometry.boundingBox).applyMatrix4(m).applyMatrix4(o.matrixWorld);
        if (b.max.y >= P.obstaculoMin) caixas.push(b.clone());
      }
      return;
    }
    b.setFromObject(o);
    if (b.max.y >= P.obstaculoMin && b.max.x - b.min.x < 200) caixas.push(b.clone());
  });
  const CEL = 10, grade = new Map();
  const chave = (i, j) => `${i},${j}`;
  caixas.forEach((c, k) => {
    for (let i = Math.floor(c.min.x / CEL); i <= Math.floor(c.max.x / CEL); i++) {
      for (let j = Math.floor(c.min.z / CEL); j <= Math.floor(c.max.z / CEL); j++) {
        const q = chave(i, j);
        if (!grade.has(q)) grade.set(q, []);
        grade.get(q).push(k);
      }
    }
  });
  const perto = (x, z) => grade.get(chave(Math.floor(x / CEL), Math.floor(z / CEL))) ?? [];
  const dentroDe = (p, f = 0) => perto(p.x, p.z).find((k) => {
    const c = caixas[k];
    return p.x > c.min.x - f && p.x < c.max.x + f && p.y > c.min.y - f && p.y < c.max.y + f && p.z > c.min.z - f && p.z < c.max.z + f;
  });

  /* ---- aves ---- */
  const novoAlvo = () => new THREE.Vector3(
    lote.x0 + 15 + rnd() * (lote.x1 - lote.x0 - 30), P.altura[0] + rnd() * (P.altura[1] - P.altura[0]), lote.z0 + 15 + rnd() * (lote.z1 - lote.z0 - 30));
  const criarEstado = () => {
    const bandos = [], aves = [];
    for (let k = 0; k < P.bandos; k++) {
      const alvo = novoAlvo(), base = novoAlvo();
      // nasce longe de obstaculo
      for (let n = 0; n < 20 && dentroDe(base, P.folga * 2) != null; n++) base.copy(novoAlvo());
      bandos.push({ alvo, troca: P.trocaAlvo[0] + rnd() * (P.trocaAlvo[1] - P.trocaAlvo[0]) });
      for (let i = 0; i < P.n; i++) {
        aves.push({ bando: k, p: base.clone().add(new THREE.Vector3((rnd() - 0.5) * 6, (rnd() - 0.5) * 2, (rnd() - 0.5) * 6)),
          v: new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).setLength(P.velocidade[0]), fase: rnd() * 6 });
      }
    }
    return { bandos, aves };
  };

  const ac = new THREE.Vector3(), tmp = new THREE.Vector3(), centro = new THREE.Vector3(), media = new THREE.Vector3(), afasta = new THREE.Vector3();
  function passo(est, dt) {
    for (const bd of est.bandos) {
      bd.troca -= dt;
      if (bd.troca <= 0) { bd.alvo.copy(novoAlvo()); bd.troca = P.trocaAlvo[0] + rnd() * (P.trocaAlvo[1] - P.trocaAlvo[0]); }
    }
    for (const a of est.aves) {
      centro.set(0, 0, 0); media.set(0, 0, 0); afasta.set(0, 0, 0);
      let n = 0;
      for (const o of est.aves) {
        if (o === a || o.bando !== a.bando) continue;
        const d = o.p.distanceTo(a.p);
        if (d > P.raio) continue;
        n++;
        centro.add(o.p); media.add(o.v);
        // separacao mais de lado que de cima: empilhadas, a de baixo era
        // empurrada para o chao (um bando mergulhou de 12 m a 3 m)
        if (d < P.separacao) { tmp.subVectors(a.p, o.p); tmp.y *= 0.5; afasta.add(tmp.setLength((P.separacao - d) / P.separacao)); }
      }
      ac.set(0, 0, 0);
      if (n) {
        ac.addScaledVector(afasta, P.pesos.separar * 6);
        ac.addScaledVector(media.divideScalar(n).sub(a.v), P.pesos.alinhar * 0.5);
        ac.addScaledVector(centro.divideScalar(n).sub(a.p), P.pesos.juntar * 0.4);
      }
      ac.addScaledVector(tmp.subVectors(est.bandos[a.bando].alvo, a.p).setLength(1), P.pesos.alvo);
      // parede: perto da borda do lote, volta para o meio
      const mg = P.margem;
      if (a.p.x < lote.x0 + mg) ac.x += P.pesos.parede; else if (a.p.x > lote.x1 - mg) ac.x -= P.pesos.parede;
      if (a.p.z < lote.z0 + mg) ac.z += P.pesos.parede; else if (a.p.z > lote.z1 - mg) ac.z -= P.pesos.parede;
      // piso e teto da faixa
      // piso cada vez mais duro quanto mais baixo
      if (a.p.y < P.altura[0]) ac.y += P.pesos.parede * (1 + (P.altura[0] - a.p.y));
      else if (a.p.y > P.altura[1] + 4) ac.y -= P.pesos.parede / 2;
      // desvio: tres pontos a frente; o primeiro dentro de uma caixa (com
      // folga) empurra para fora dela e, se o alto dela esta perto, para cima
      for (const f of [0.35, 0.7, 1]) {
        const frente = tmp.copy(a.p).addScaledVector(a.v, P.antever * f);
        const k = dentroDe(frente, P.folga);
        if (k == null) continue;
        const c = caixas[k], cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
        const fora = new THREE.Vector3(a.p.x - cx, 0, a.p.z - cz);
        if (fora.lengthSq() < 1e-6) fora.set(1, 0, 0);
        fora.setLength(1);
        if (c.max.y - a.p.y < 8) fora.y = 1;
        ac.addScaledVector(fora.normalize(), P.pesos.desviar / f);
        est.desvios = (est.desvios ?? 0) + 1;
        break;
      }
      a.v.addScaledVector(ac, dt);
      const s = a.v.length();
      a.v.setLength(THREE.MathUtils.clamp(s, P.velocidade[0], P.velocidade[1]));
      a.p.addScaledVector(a.v, dt);
      a.fase += dt * P.batida * Math.PI * 2;
    }
  }

  /* ---- desenho ---- */
  let estado = criarEstado();
  const N = estado.aves.length;
  const malha = new THREE.InstancedMesh(geometriaAve(P.envergadura),
    new THREE.MeshStandardMaterial({ color: P.cor, roughness: 0.9, side: THREE.DoubleSide }), N);
  malha.name = 'passaros';
  malha.frustumCulled = false;
  malha.userData.animar = true;
  const grupo = new THREE.Group();
  grupo.name = 'passaros';
  grupo.userData.animar = true;
  grupo.add(malha);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), esc = new THREE.Vector3();
  function desenhar() {
    estado.aves.forEach((a, i) => {
      e.set(0, Math.atan2(a.v.x, a.v.z), 0);
      q.setFromEuler(e);
      esc.set(1, Math.sin(a.fase), 1);
      malha.setMatrixAt(i, m.compose(a.p, q, esc));
    });
    malha.instanceMatrix.needsUpdate = true;
  }
  desenhar();

  /** Simula `seg` s de voo a partir do estado inicial, para cada uma de
   *  `sementes` sementes (dt 0,1 s), e conta os achados: a medida nao pode
   *  depender de quantos quadros ja rodaram nem de um sorteio so. */
  function auditar(seg = 600, sementes = 5) {
    const guarda = semente;
    const achados = [];
    const cont = { PASSARO_NA_GEOMETRIA: 0, PASSARO_FORA_DO_LOTE: 0, PASSARO_BAIXO: 0 };
    let desvios = 0;
    for (let k = 0; k < sementes; k++) {
      semente = 2027 + 7919 * k;
      const est = criarEstado();
      simular(est, seg, achados, cont);
      desvios += est.desvios ?? 0;
    }
    semente = guarda;
    const total = Object.values(cont).reduce((s2, v) => s2 + v, 0);
    // desvios: passos de ave em que o desvio agiu (que ele existe de fato)
    return { total, porRegra: cont, achados, resumo: { aves: N, obstaculos: caixas.length, segundos: seg, sementes, desvios } };
  }
  function simular(est, seg, achados, cont) {
    const achar = (regra, a, t) => { if (achados.filter((x) => x.regra === regra).length < 5) achados.push({ regra, detalhe: `(${a.p.x.toFixed(1)}; ${a.p.y.toFixed(1)}; ${a.p.z.toFixed(1)}) aos ${t.toFixed(0)} s` }); };
    for (let t = 0; t < seg; t += 0.1) {
      passo(est, 0.1);
      for (const a of est.aves) {
        if (dentroDe(a.p) != null) { cont.PASSARO_NA_GEOMETRIA++; achar('PASSARO_NA_GEOMETRIA', a, t); }
        if (a.p.x < lote.x0 - 20 || a.p.x > lote.x1 + 20 || a.p.z < lote.z0 - 20 || a.p.z > lote.z1 + 20) { cont.PASSARO_FORA_DO_LOTE++; achar('PASSARO_FORA_DO_LOTE', a, t); }
        if (a.p.y < P.minimo) { cont.PASSARO_BAIXO++; achar('PASSARO_BAIXO', a, t); }
      }
    }
  }

  return {
    grupo,
    atualizar(dt, noite = 0) {
      grupo.visible = noite < 0.5;
      if (!grupo.visible || dt <= 0) return;
      passo(estado, Math.min(dt, 0.1));
      desenhar();
    },
    auditar,
    get estado() { return estado; },
  };
}
