import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { tuboPorCaminho, tuboPorCurva, CurvaPolilinha } from './pipe.js';

/**
 * ===========================================================================
 *  INTERNOS DO REATOR
 * ===========================================================================
 *  Chicanas, serpentina de resfriamento e distribuidor de ar.
 *  Sao eles que aparecem quando o corte em secao e ligado — e o que
 *  transforma a maquete em uma explicacao do processo.
 */

/**
 * CHICANAS (baffles) — quebram o vortice da agitacao.
 * Regra de projeto: 4 chapas de largura ~ D/10, afastadas da parede.
 */
export function criarChicanas(c, Ri, yBase, yTopo) {
  const g = new THREE.Group();
  g.name = 'chicanas';

  const altura = yTopo - yBase;
  const esp = 0.01;
  const geo = new THREE.BoxGeometry(c.largura, altura, esp);

  // aresta externa da chapa fica a `folgaParede` da parede interna
  const rCentro = Ri - c.folgaParede - c.largura / 2;

  for (let i = 0; i < c.n; i++) {
    const a = (i / c.n) * Math.PI * 2 + Math.PI / 4;
    const chapa = new THREE.Mesh(geo, MAT.inox);
    chapa.position.set(Math.cos(a) * rCentro, yBase + altura / 2, Math.sin(a) * rCentro);
    chapa.rotation.y = -a;
    chapa.castShadow = true;
    g.add(chapa);

    // suportes de fixacao na parede
    for (let k = 0; k < 3; k++) {
      const sup = new THREE.Mesh(
        new THREE.BoxGeometry(c.folgaParede, 0.06, esp),
        MAT.inox,
      );
      const rs = Ri - c.folgaParede / 2;
      const ys = yBase + altura * (0.15 + k * 0.35);
      sup.position.set(Math.cos(a) * rs, ys, Math.sin(a) * rs);
      sup.rotation.y = -a;
      g.add(sup);
    }
  }
  return g;
}

/**
 * SERPENTINA DE RESFRIAMENTO — helice interna.
 * A oxidacao de tolueno e fortemente exotermica; sem retirada de calor a
 * reacao dispara. Por isso a serpentina existe e por isso ela e grande.
 */
export function criarSerpentina(s, Ri, angEntrada = 300) {
  const g = new THREE.Group();
  g.name = 'serpentina';

  const r = s.diamHelice / 2;
  const a0 = THREE.MathUtils.degToRad(angEntrada);
  const N = Math.max(120, Math.round(s.voltas * 40));

  const pontos = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ang = a0 + t * s.voltas * Math.PI * 2;
    pontos.push(new THREE.Vector3(
      Math.cos(ang) * r,
      s.alturaBase + t * s.voltas * s.passo,
      Math.sin(ang) * r,
    ));
  }

  g.add(tuboPorCurva(new CurvaPolilinha(pontos), s.diamTubo, MAT.cobre, N * 2));

  // --- ramal de entrada: da helice ate a parede ---
  const p0 = pontos[0];
  const dir0 = new THREE.Vector3(p0.x, 0, p0.z).normalize();
  g.add(tuboPorCaminho([
    p0.clone(),
    new THREE.Vector3(dir0.x * (Ri - 0.02), p0.y, dir0.z * (Ri - 0.02)),
  ], { diam: s.diamTubo, mat: MAT.cobre }));

  // --- ramal de saida: sobe e sai pela parede ---
  const pN = pontos[pontos.length - 1];
  const dirN = new THREE.Vector3(pN.x, 0, pN.z).normalize();
  g.add(tuboPorCaminho([
    pN.clone(),
    new THREE.Vector3(pN.x, pN.y + 0.37, pN.z),
    new THREE.Vector3(dirN.x * (Ri - 0.02), pN.y + 0.37, dirN.z * (Ri - 0.02)),
  ], { diam: s.diamTubo, mat: MAT.cobre }));

  return g;
}

/**
 * DISTRIBUIDOR DE AR (sparger) — anel perfurado sob o primeiro impelidor.
 * O ar sobe em bolhas, e a turbina Rushton logo acima as redistribui.
 */
export function criarSparger(sp, Ri, angAlimentacao = 200) {
  const g = new THREE.Group();
  g.name = 'sparger';

  const rAnel = sp.diamAnel / 2;
  // de onde saem as bolhas de ar (Fase 27, site/animacoes.js), no local
  g.userData.anel = { r: rAnel, y: sp.altura };

  // anel
  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(rAnel, sp.diamTubo / 2, 14, 64),
    MAT.inox,
  );
  anel.rotation.x = -Math.PI / 2;
  anel.position.y = sp.altura;
  anel.castShadow = true;
  g.add(anel);

  // furos de saida de ar, voltados para cima
  const geoFuro = new THREE.CylinderGeometry(
    sp.diamTubo * 0.11, sp.diamTubo * 0.11, sp.diamTubo * 0.55, 8,
  );
  for (let i = 0; i < sp.nFuros; i++) {
    const a = (i / sp.nFuros) * Math.PI * 2;
    const f = new THREE.Mesh(geoFuro, MAT.inox);
    f.position.set(
      Math.cos(a) * rAnel,
      sp.altura + sp.diamTubo * 0.5,
      Math.sin(a) * rAnel,
    );
    g.add(f);
  }

  // ramal de alimentacao ate a parede
  const a = THREE.MathUtils.degToRad(angAlimentacao);
  g.add(tuboPorCaminho([
    new THREE.Vector3(Math.cos(a) * rAnel, sp.altura, Math.sin(a) * rAnel),
    new THREE.Vector3(Math.cos(a) * (Ri - 0.3), sp.altura, Math.sin(a) * (Ri - 0.3)),
    new THREE.Vector3(Math.cos(a) * (Ri - 0.02), sp.altura + 0.2, Math.sin(a) * (Ri - 0.02)),
  ], { diam: sp.diamTubo, mat: MAT.inox }));

  return g;
}

/**
 * Eliminador de nevoa (demister): pastilha de malha de arame no topo do vaso,
 * entre duas grades de retencao.
 *
 * Nao e acessorio: o fator k = 0,11 m/s de Souders-Brown usado no
 * dimensionamento do V-01 so vale para vasos EQUIPADOS com eliminador.
 */
export function criarDemister(d, Ri, yTopoCostado) {
  const g = new THREE.Group();
  g.name = 'demister';
  const y = yTopoCostado - d.abaixoDoTopo;

  const malha = new THREE.Mesh(
    new THREE.CylinderGeometry(Ri - 0.01, Ri - 0.01, d.espessura, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xb8c0c8, metalness: 0.8, roughness: 0.78,
      side: THREE.DoubleSide, transparent: true, opacity: 0.6,
    }),
  );
  malha.position.y = y + d.espessura / 2;
  g.add(malha);

  for (const dy of [0, d.espessura]) {
    const grade = new THREE.Mesh(new THREE.TorusGeometry(Ri - 0.01, 0.012, 8, 48), MAT.inox);
    grade.rotation.x = Math.PI / 2;
    grade.position.y = y + dy;
    g.add(grade);
  }
  return g;
}
