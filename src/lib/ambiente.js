import * as THREE from 'three';

/**
 * ===========================================================================
 *  AMBIENTACAO — arvore, poste, carro, caminhao, placa  (Fase 9)
 * ===========================================================================
 *  Cada peca e descrita por PARTES: { geo, mat, m } — geometria, material e
 *  a matriz local da parte. A mesma descricao vira InstancedMesh quando se
 *  repete (dezenas de arvores, postes e carros: uma chamada de desenho por
 *  parte, nao por peca) ou um grupo comum quando e uma so e se mexe.
 *  Origem no piso, no centro, frente para +Z.
 */

const SEG = 12;
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.8, metalness: 0.05, ...extra });
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz),
);

const TRONCO = mat(0x5b4636, { roughness: 0.95 });
// a cor da copa vem de cada arvore (instanceColor multiplica a do material)
const COPA = mat(0xffffff, { roughness: 0.92, flatShading: true });

/* Vento nas copas (Fase 27, item 20) [ADOTADO, parametro de desenho]: a copa
 * balanca em volta do lugar dela, mais no sentido do vento de projeto que de
 * lado, e cada arvore na sua fase (tirada da posicao da instancia) — no
 * shader, sem mexer nas instancias. O pe da copa quase nao anda; o alto,
 * ate `amplitude` m. A sombra fica parada (o mapa nao e refeito todo quadro). */
export const TEMPO_VENTO = { value: 0 };
export function balancarCopas({ para, amplitude = 0.08, frequencia = 0.55 }) {
  const w = (2 * Math.PI * frequencia).toFixed(3), a = amplitude.toFixed(3);
  const [px, pz] = para.map((v) => v.toFixed(4));
  const anterior = COPA.onBeforeCompile;
  COPA.onBeforeCompile = (sh, r) => {
    anterior?.call(COPA, sh, r);
    sh.uniforms.uVentoT = TEMPO_VENTO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uVentoT;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          float fase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
          float h = clamp(transformed.y + 1.0, 0.0, 3.0) * 0.5;
          float s = sin(uVentoT * ${w} + fase) + 0.4 * sin(uVentoT * ${w} * 2.3 + fase * 1.7);
          mvPosition.xz += vec2(${px}, ${pz}) * ${a} * (0.6 + 0.4 * s) * h;
          mvPosition.xz += vec2(-(${pz}), ${px}) * ${a} * 0.5 * sin(uVentoT * ${w} * 1.3 + fase * 2.1) * h;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  COPA.customProgramCacheKey = () => 'copa-vento';
  COPA.needsUpdate = true;
}
const ACO = mat(0x8a9097, { metalness: 0.6, roughness: 0.45 });
// nomeados: o modo noite (site/noite.js) os acende pelo nome
const LUMINARIA = mat(0xd8dde2, { emissive: 0x3a3a2a, metalness: 0.3, roughness: 0.4, name: 'luminaria' });
const PNEU = mat(0x1d1f22, { roughness: 0.9 });
const VIDRO = mat(0x24303a, { metalness: 0.6, roughness: 0.15 });
const BRANCO = mat(0xf0f0ee, { metalness: 0.2, roughness: 0.5 });
const INOX = mat(0xd5d9dd, { metalness: 0.85, roughness: 0.3 });

/**
 * Massa de folhagem: icosaedro com o raio de cada vertice perturbado por um
 * ruido com semente — copa irregular, facetada, que pega luz e sombra como
 * folhagem, em vez de uma bola lisa.
 */
function folhagem(raio, semente) {
  const g = new THREE.IcosahedronGeometry(raio, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const vistos = new Map();                      // o mesmo vertice nas faces vizinhas, o mesmo ruido
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!vistos.has(k)) {
      const n = Math.sin(v.x * 3.1 + semente) * Math.cos(v.y * 2.7 - semente) + Math.sin(v.z * 3.7 + semente * 2);
      vistos.set(k, 1 + 0.16 * n);
    }
    v.multiplyScalar(vistos.get(k));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Arvore de copa media: tronco, dois galhos e tres massas de folhagem. */
export function partesArvore() {
  return [
    { geo: new THREE.CylinderGeometry(0.13, 0.24, 3.4, 8), mat: TRONCO, m: M(0, 1.7, 0) },
    { geo: new THREE.CylinderGeometry(0.06, 0.1, 1.6, 6), mat: TRONCO, m: M(0.4, 3.6, 0.1, 0, 0, -0.6) },
    { geo: new THREE.CylinderGeometry(0.06, 0.1, 1.5, 6), mat: TRONCO, m: M(-0.35, 3.7, -0.2, 0.3, 0, 0.55) },
    { geo: folhagem(2.1, 1.3), mat: COPA, m: M(0, 4.7, 0, 0, 0, 0, 1, 0.82, 1), cor: 1.0 },
    { geo: folhagem(1.6, 4.1), mat: COPA, m: M(0.95, 5.5, 0.5, 0, 0, 0, 1, 0.85, 1), cor: 1.12 },
    { geo: folhagem(1.5, 7.7), mat: COPA, m: M(-0.9, 5.3, -0.4, 0, 0, 0, 1, 0.85, 1), cor: 0.9 },
  ];
}
export const RAIO_COPA = 2.6;

/** Arbusto de canteiro: duas bolas de folhagem achatadas, ~0,9 m de altura. */
export function partesArbusto() {
  return [
    { geo: folhagem(0.55, 2.3), mat: COPA, m: M(0, 0.45, 0, 0, 0, 0, 1.2, 0.8, 1), cor: 0.85 },
    { geo: folhagem(0.4, 5.9), mat: COPA, m: M(0.35, 0.6, 0.15, 0, 0, 0, 1, 0.85, 1), cor: 1.05 },
  ];
}

/** Poste de iluminacao: mastro, braco sobre a via (+Z) e luminaria. */
export function partesPoste({ altura = 9, braco = 1.5 } = {}) {
  return [
    { geo: new THREE.CylinderGeometry(0.07, 0.12, altura, SEG), mat: ACO, m: M(0, altura / 2, 0) },
    { geo: new THREE.CylinderGeometry(0.04, 0.04, braco, 8), mat: ACO, m: M(0, altura - 0.15, braco / 2, Math.PI / 2) },
    { geo: new THREE.BoxGeometry(0.35, 0.12, 0.6), mat: LUMINARIA, m: M(0, altura - 0.25, braco) },
    { geo: new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8), mat: mat(0x8e8c85), m: M(0, 0.05, 0) },
  ];
}

/* ---------------------------------------------------------------------------
 *  Postes da Fase 26 (iluminacao fora da laje). Cada tipo tem as partes e a
 *  luminaria no referencial do poste (pe na origem, frente em +Z): o mesmo
 *  lugar de onde sai a luz na conta (lib/fotometria.js) e onde fica a peca
 *  que acende — `luminariasDoPoste` e a fonte unica dos dois.
 * ------------------------------------------------------------------------- */
const BASE_POSTE = mat(0x8e8c85);
const RAD = Math.PI / 180;
const NADIR = new THREE.Vector3(0, -1, 0);

/** Eixo de uma cabeca: do nadir, inclinado `incl` graus para o rumo `rumo` (graus de +Z para +X). */
function eixo(incl, rumo = 0) {
  const h = new THREE.Vector3(Math.sin(rumo * RAD), 0, Math.cos(rumo * RAD));
  return NADIR.clone().multiplyScalar(Math.cos(incl * RAD)).addScaledVector(h, Math.sin(incl * RAD)).normalize();
}

/**
 * Luminarias de um poste, no referencial dele: [{ p: Vector3, dir: Vector3 }]
 * — o centro da face que emite e o eixo. `tipo`: 'via' (braco sobre +Z),
 * 'pedestre' (topo), 'teto' (de embutir, origem no forro), 'estacionamento'
 * e 'patio' (duas cabecas em ±X, voltadas para +Z e abertas `abertura` graus
 * uma de cada lado).
 */
export function luminariasDoPoste(tipo, L) {
  if (tipo === 'via') return [{ p: new THREE.Vector3(0, L.altura - 0.31, L.braco), dir: eixo(L.inclinacao) }];
  if (tipo === 'pedestre') return [{ p: new THREE.Vector3(0, L.altura - 0.3, 0), dir: eixo(0) }];
  // de embutir: a origem e o forro; a face que emite, 1 cm abaixo dele
  if (tipo === 'teto') return [{ p: new THREE.Vector3(0, -0.011, 0), dir: eixo(0) }];
  // de parede (origem na parede, +Z para fora): a face que emite a frente
  if (tipo === 'arandela') return [{ p: new THREE.Vector3(0, 0, 0.2), dir: eixo(L.inclinacao) }];
  // projetor de parede: eixo dado (apontado para um ponto) ou o da inclinacao
  if (tipo === 'fachada') return [{ p: new THREE.Vector3(0, 0, 0.55), dir: L.dir?.clone() ?? eixo(L.inclinacao) }];
  // na coluna do pipeway: origem na altura da bracadeira, braco para +Z
  if (tipo === 'pipeway') return [{ p: new THREE.Vector3(0, -0.11, L.braco), dir: eixo(L.inclinacao) }];
  // perimetro: braco para +Z, luminaria de area para baixo
  if (tipo === 'perimetro') return [{ p: new THREE.Vector3(0, L.altura - 0.29, L.braco), dir: eixo(L.inclinacao) }];
  return [-1, 1].map((s) => ({ p: new THREE.Vector3(s * L.braco, L.altura - 0.25, 0.12), dir: eixo(L.inclinacao, s * L.abertura) }));
}

/** Poste de pedestre: mastro fino e luminaria de topo (lanterna com chapeu). */
export function partesPostePedestre(L) {
  const h = L.altura;
  return [
    { geo: new THREE.CylinderGeometry(0.045, 0.07, h - 0.45, SEG), mat: ACO, m: M(0, (h - 0.45) / 2, 0) },
    { geo: new THREE.CylinderGeometry(0.2, 0.12, 0.3, SEG), mat: LUMINARIA, m: M(0, h - 0.3, 0) },
    { geo: new THREE.ConeGeometry(0.26, 0.15, SEG), mat: ACO, m: M(0, h - 0.075, 0) },
    { geo: new THREE.CylinderGeometry(0.16, 0.2, 0.4, 8), mat: BASE_POSTE, m: M(0, 0.05, 0) },
  ];
}

/** Cabeca de luminaria (caixa) com a face de baixo no ponto e no eixo dela. */
function cabeca(p, dir, [w, h, d]) {
  const q = new THREE.Quaternion().setFromUnitVectors(NADIR, dir);
  return new THREE.Matrix4().compose(p.clone().addScaledVector(dir, -h / 2), q, new THREE.Vector3(1, 1, 1));
}

/** Arandela de parede: placa nas costas e a caixa inclinada para baixo. */
export function partesArandela(L) {
  const [{ p, dir }] = luminariasDoPoste('arandela', L);
  return [
    { geo: new THREE.BoxGeometry(0.2, 0.28, 0.04), mat: ACO, m: M(0, 0, 0.02) },
    { geo: new THREE.BoxGeometry(0.22, 0.1, 0.3), mat: LUMINARIA, m: cabeca(p, dir, [0.22, 0.1, 0.3]) },
  ];
}

/** Projetor de parede: suporte saindo da parede e a cabeca no eixo dela
 *  (`L.dir`, no referencial da parede, quando apontado para um ponto). */
export function partesProjetorParede(L) {
  const [{ p, dir }] = luminariasDoPoste('fachada', L);
  const costas = p.clone().addScaledVector(dir, -0.14);
  return [
    { geo: new THREE.BoxGeometry(0.3, 0.3, 0.04), mat: ACO, m: M(0, 0, 0.02) },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, costas.length() + 0.05, 6), mat: ACO,
      m: new THREE.Matrix4().compose(costas.clone().multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), costas.clone().normalize()), new THREE.Vector3(1, 1, 1)) },
    { geo: new THREE.BoxGeometry(0.5, 0.14, 0.4), mat: LUMINARIA, m: cabeca(p, dir, [0.5, 0.14, 0.4]) },
  ];
}

/** Luminaria presa na coluna do pipeway: bracadeira abracando a coluna,
 *  braco ate a ponta e a caixa (origem na altura da bracadeira). */
export function partesLuminariaPipeway(L) {
  const c = L.coluna;
  return [
    { geo: new THREE.BoxGeometry(c + 0.06, 0.12, c + 0.06), mat: ACO, m: M(0, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, L.braco - c / 2, 8), mat: ACO, m: M(0, 0, c / 2 + (L.braco - c / 2) / 2, Math.PI / 2) },
    { geo: new THREE.BoxGeometry(0.3, 0.1, 0.45), mat: LUMINARIA, m: M(0, -0.06, L.braco) },
  ];
}

/** Poste do perimetro: mastro, braco para dentro e luminaria de area. */
export function partesPostePerimetro(L) {
  const h = L.altura;
  return [
    { geo: new THREE.CylinderGeometry(0.05, 0.08, h, SEG), mat: ACO, m: M(0, h / 2, 0) },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, L.braco, 8), mat: ACO, m: M(0, h - 0.15, L.braco / 2, Math.PI / 2) },
    { geo: new THREE.BoxGeometry(0.3, 0.1, 0.45), mat: LUMINARIA, m: M(0, h - 0.24, L.braco) },
    { geo: new THREE.CylinderGeometry(0.18, 0.22, 0.4, 8), mat: BASE_POSTE, m: M(0, 0.05, 0) },
  ];
}

/** Luminaria de embutir no forro: caixa rasa, a face 1 cm abaixo dele. */
export function partesLuminariaTeto(L) {
  return [{ geo: new THREE.BoxGeometry(L.lado, 0.08, L.lado), mat: LUMINARIA, m: M(0, 0.03, 0) }];
}

/**
 * Poste de estacionamento: mastro, travessa em X no topo e duas cabecas
 * (projetores de area) giradas para o eixo de cada uma.
 */
export function partesPosteEstacionamento(L) {
  const h = L.altura, partes = [
    { geo: new THREE.CylinderGeometry(0.08, 0.14, h, SEG), mat: ACO, m: M(0, h / 2, 0) },
    { geo: new THREE.BoxGeometry(2 * L.braco + 0.1, 0.08, 0.08), mat: ACO, m: M(0, h - 0.08, 0) },
    { geo: new THREE.CylinderGeometry(0.3, 0.36, 0.5, 8), mat: BASE_POSTE, m: M(0, 0.05, 0) },
  ];
  for (const { p, dir } of luminariasDoPoste('estacionamento', L)) {
    // a face que emite (-Y da caixa) para o eixo; o centro da caixa, 6 cm atras dela
    const q = new THREE.Quaternion().setFromUnitVectors(NADIR, dir);
    const c = p.clone().addScaledVector(dir, -0.06);
    partes.push({ geo: new THREE.BoxGeometry(0.45, 0.12, 0.35), mat: LUMINARIA, m: new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)) });
    // haste da travessa ate as costas da cabeca
    const topo = new THREE.Vector3(p.x, h - 0.08, 0), costas = p.clone().addScaledVector(dir, -0.12);
    const d = costas.clone().sub(topo), Lh = d.length();
    partes.push({ geo: new THREE.CylinderGeometry(0.025, 0.025, Lh + 0.04, 6), mat: ACO,
      m: new THREE.Matrix4().compose(topo.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)) });
  }
  return partes;
}

/** Extrusao de um perfil lateral (x = comprimento, y = altura) na largura, frente em +Z. */
function perfil(pontos, largura, chanfro) {
  const s = new THREE.Shape(pontos.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: largura - 2 * chanfro, bevelEnabled: chanfro > 0, bevelThickness: chanfro, bevelSize: chanfro, bevelSegments: 2,
  });
  g.translate(0, 0, -(largura - 2 * chanfro) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// sedan de 4,3 m: para-choque, capo, para-brisa, teto, vidro traseiro, porta-malas
const PERFIL_CARRO = [[-2.15, 0.32], [-2.17, 0.78], [-1.98, 0.93], [-1.32, 0.98], [-0.92, 1.4], [0.52, 1.43],
  [1.12, 1.0], [2.02, 0.88], [2.17, 0.66], [2.15, 0.32]];
const PERFIL_VIDROS = [[-1.24, 0.99], [-0.88, 1.36], [0.5, 1.39], [1.04, 0.99]];
const CARROCERIA = mat(0xffffff, { metalness: 0.55, roughness: 0.28 });
const FAROL = mat(0xfff6dc, { emissive: 0x6b6450, roughness: 0.2, name: 'farol' });
const LANTERNA = mat(0x9b1a1a, { emissive: 0x3a0606, roughness: 0.3, name: 'lanterna' });
/* Giroflex ambar (Fase 27, item 18): todo veiculo que circula dentro da
 * planta leva um, ligado — pratica de seguranca de area industrial. Um
 * material so: pisca junto (site/ambiente.js). */
export const GIROFLEX = mat(0xffa21a, { emissive: 0xff8c00, emissiveIntensity: 0, roughness: 0.3, name: 'giroflex' });
/** Giroflex de teto: base preta e cupula ambar, com o pe em (x, y, z). */
export function giroflex(g, x, y, z) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 12), PRETO);
  base.position.set(x, y + 0.025, z);
  const cupula = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 12), GIROFLEX);
  cupula.position.set(x, y + 0.12, z);
  g.add(base, cupula);
}
const ARO = mat(0xb9bec4, { metalness: 0.8, roughness: 0.3 });

/** Carro de passeio. A carroceria leva a cor da instancia; as rodas giram. */
export function partesCarro() {
  const rodas = [];
  for (const [x, z] of [[-0.8, 1.33], [0.8, 1.33], [-0.8, -1.33], [0.8, -1.33]]) {
    rodas.push({ geo: new THREE.CylinderGeometry(0.32, 0.32, 0.22, 18), mat: PNEU, m: M(x, 0.32, z, 0, 0, Math.PI / 2), roda: true });
    rodas.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, 0.235, 14), mat: ARO, m: M(x, 0.32, z, 0, 0, Math.PI / 2), roda: true });
  }
  return [
    { geo: perfil(PERFIL_CARRO, 1.76, 0.07), mat: CARROCERIA, m: M(0, 0, 0), cor: 1 },
    // vidros 1 cm para fora da carroceria, para nao disputar profundidade
    { geo: perfil(PERFIL_VIDROS, 1.79, 0), mat: VIDRO, m: M(0, 0.012, 0) },
    { geo: new THREE.BoxGeometry(0.32, 0.1, 0.04), mat: FAROL, m: M(-0.6, 0.74, 2.17) },
    { geo: new THREE.BoxGeometry(0.32, 0.1, 0.04), mat: FAROL, m: M(0.6, 0.74, 2.17) },
    { geo: new THREE.BoxGeometry(0.3, 0.1, 0.04), mat: LANTERNA, m: M(-0.62, 0.8, -2.18) },
    { geo: new THREE.BoxGeometry(0.3, 0.1, 0.04), mat: LANTERNA, m: M(0.62, 0.8, -2.18) },
    ...rodas,
  ];
}

/** Monta as partes como um grupo comum. */
export function grupoDe(partes, cor) {
  const g = new THREE.Group();
  g.userData.rodas = [];
  for (const p of partes) {
    const m = new THREE.Mesh(p.geo, p.cor && cor != null ? p.mat.clone() : p.mat);
    if (p.cor && cor != null) m.material.color.setHex(cor).multiplyScalar(p.cor);
    m.applyMatrix4(p.m);
    m.castShadow = true;
    g.add(m);
    if (p.roda) g.userData.rodas.push(m);        // quem anda gira as rodas
  }
  return g;
}

/**
 * Monta as partes como InstancedMesh, uma por parte. `matrizes`: a de cada
 * peca no mundo; `cores`: a cor de cada peca (so nas partes com `cor`).
 */
export function instanciar(partes, matrizes, cores = null, sombra = true) {
  const g = new THREE.Group();
  const tmp = new THREE.Matrix4();
  for (const p of partes) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, matrizes.length);
    matrizes.forEach((mw, i) => {
      im.setMatrixAt(i, tmp.multiplyMatrices(mw, p.m));
      if (p.cor && cores) im.setColorAt(i, new THREE.Color(cores[i]).multiplyScalar(p.cor));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = sombra;
    im.receiveShadow = false;
    im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}

/* ----------------------------------------------------------------------------
 *  Caminhoes (um de cada; se mexem): frente para +Z. Detalhe da Fase 19
 *  (pedido do autor: "os caminhoes podem ser um pouco mais detalhados"):
 *  cabine com vidros, grade, farois, para-choque, retrovisores, degraus e
 *  tanque de combustivel; o tanque de tolueno com passadico, bocas de carga,
 *  escada, caixa de valvulas, painel de seguranca e rotulo de risco; o bau
 *  com portas, trancas, faixa refletiva e para-choque traseiro. [ADOTADO,
 *  proporcoes de catalogo]
 * ------------------------------------------------------------------------- */
const GRADE_CAB = mat(0x2b2e33, { metalness: 0.5, roughness: 0.5 });
const PRETO = mat(0x1b1d20, { roughness: 0.7 });
const ESCURO = mat(0x3a3e44, { metalness: 0.6, roughness: 0.4 });

function caixaEm(g, m, [sx, sy, sz], [x, y, z], rot = null) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
  b.position.set(x, y, z);
  if (rot) b.rotation.set(...rot);
  b.castShadow = sx * sy * sz > 0.05;
  g.add(b);
  return b;
}

/** Placa em canvas (so no navegador): painel laranja ONU e rotulo de risco. */
function texturaPlaca(desenho, w, h) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  desenho(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
let painelOnu = null, rotuloClasse3 = null;
function matPainelOnu() {
  // painel de seguranca (ABNT NBR 7500): laranja, risco 33 em cima, ONU 1294 embaixo
  painelOnu ??= new THREE.MeshStandardMaterial({
    roughness: 0.6,
    map: texturaPlaca((c, w, h) => {
      c.fillStyle = '#f08a1c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#111'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
      c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      c.fillStyle = '#111'; c.font = `bold ${h * 0.36}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('33', w / 2, h * 0.26); c.fillText('1294', w / 2, h * 0.76);
    }, 256, 192),
  });
  return painelOnu;
}
function matRotulo3() {
  // rotulo de risco classe 3 (liquido inflamavel): losango vermelho, chama e "3"
  rotuloClasse3 ??= new THREE.MeshStandardMaterial({
    roughness: 0.6, transparent: true, alphaTest: 0.5,
    map: texturaPlaca((c, w) => {
      const m = w / 2;
      c.beginPath(); c.moveTo(m, 4); c.lineTo(w - 4, m); c.lineTo(m, w - 4); c.lineTo(4, m); c.closePath();
      c.fillStyle = '#d0201b'; c.fill();
      c.lineWidth = 6; c.strokeStyle = '#fff';
      c.beginPath(); c.moveTo(m, 18); c.lineTo(w - 18, m); c.lineTo(m, w - 18); c.lineTo(18, m); c.closePath(); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(m, w * 0.2);
      c.bezierCurveTo(w * 0.62, w * 0.34, w * 0.66, w * 0.46, w * 0.6, w * 0.55);
      c.bezierCurveTo(w * 0.56, w * 0.6, w * 0.44, w * 0.6, w * 0.4, w * 0.55);
      c.bezierCurveTo(w * 0.34, w * 0.46, w * 0.42, w * 0.36, m, w * 0.2); c.fill();
      c.font = `bold ${w * 0.16}px Arial`; c.textAlign = 'center'; c.fillText('3', m, w * 0.85);
    }, 256, 256),
  });
  return rotuloClasse3;
}

function cabine(g, cor, z0, zEixo) {
  const pintura = mat(cor, { metalness: 0.4, roughness: 0.45 });
  const zf = z0 + 1.05;                                 // face da frente
  caixaEm(g, pintura, [2.45, 2.5, 2.1], [0, 1.85, z0]);
  caixaEm(g, pintura, [2.3, 0.35, 1.1], [0, 3.27, z0 - 0.25], [-0.25, 0, 0]);   // defletor
  caixaEm(g, VIDRO, [2.2, 0.95, 0.03], [0, 2.5, zf + 0.01]);                   // para-brisa
  giroflex(g, -0.8, 3.1, z0 + 0.6);                                              // no teto, a frente do defletor
  for (const s of [-1, 1]) {
    caixaEm(g, VIDRO, [0.03, 0.75, 1.0], [s * 1.235, 2.55, z0 + 0.35]);        // janela lateral
    caixaEm(g, ESCURO, [0.25, 0.04, 0.04], [s * 1.35, 2.6, zf - 0.15]);        // braco do retrovisor
    caixaEm(g, PRETO, [0.08, 0.5, 0.24], [s * 1.5, 2.45, zf - 0.15]);          // retrovisor
    caixaEm(g, FAROL, [0.38, 0.2, 0.05], [s * 0.85, 1.15, zf + 0.02]);         // farol
    for (const y of [0.5, 0.92]) caixaEm(g, ESCURO, [0.35, 0.06, 0.45], [s * 1.12, y, z0 + 0.45]);   // degraus
    caixaEm(g, PRETO, [0.42, 0.06, 1.15], [s * 1.05, 1.08, zEixo]);           // para-lama da roda da frente
  }
  caixaEm(g, GRADE_CAB, [1.5, 0.62, 0.04], [0, 1.4, zf + 0.02]);              // grade
  for (let k = 0; k < 4; k++) caixaEm(g, ESCURO, [1.5, 0.03, 0.05], [0, 1.18 + k * 0.15, zf + 0.04]);
  caixaEm(g, ESCURO, [2.5, 0.3, 0.22], [0, 0.72, zf + 0.12]);                 // para-choque
  // tanque de combustivel, do lado direito, atras da cabine
  const tq = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 16), ACO);
  tq.rotation.x = Math.PI / 2;
  tq.position.set(-1.0, 0.75, z0 - 1.55);
  g.add(tq);
}
function eixos(g, zs) {
  g.userData.rodas ??= [];
  for (const z of zs) {
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 18), PNEU);
      r.rotation.z = Math.PI / 2;
      r.position.set(s * 1.05, 0.5, z);
      r.castShadow = true;
      const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.37, 12), ARO);
      r.add(aro);                                // o aro gira junto com o pneu
      g.add(r);
      g.userData.rodas.push(r);
    }
  }
}
function chassi(g, comprimento) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, comprimento), mat(0x2a2c30));
  c.position.set(0, 0.85, 0);
  g.add(c);
  // lanternas traseiras
  for (const s of [-1, 1]) caixaEm(g, LANTERNA, [0.3, 0.14, 0.05], [s * 1.0, 0.85, -comprimento / 2 - 0.02]);
  // luz de re (Fase 27, item 18): material deste veiculo, acesa so na re
  // (site/ambiente.js, posicionar)
  const re = mat(0xf2f2ee, { emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.25, name: 'luz-re' });
  for (const s of [-1, 1]) caixaEm(g, re, [0.16, 0.12, 0.05], [s * 0.72, 0.85, -comprimento / 2 - 0.02]);
  g.userData.luzRe = re;
}

/** Caminhao-tanque de 30 m³ (toco, 9,5 m): cabine e tanque de inox. */
export function criarCaminhaoTanque() {
  const g = new THREE.Group();
  g.name = 'caminhao-tanque';
  chassi(g, 9.0);
  cabine(g, 0xc0392b, 3.6, 3.2);
  const zT = -1.2, LT = 6.4, yT = 2.15, RT = 1.1;
  const tanque = new THREE.Mesh(new THREE.CylinderGeometry(RT, RT, LT, 24), INOX);
  tanque.rotation.x = Math.PI / 2;
  tanque.position.set(0, yT, zT);
  tanque.castShadow = true;
  g.add(tanque);
  for (const s of [-1, 1]) {
    const tampo = new THREE.Mesh(new THREE.SphereGeometry(RT, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), INOX);
    tampo.scale.set(1, 0.25, 1);
    tampo.rotation.x = s * Math.PI / 2;
    tampo.position.set(0, yT, zT + s * LT / 2);
    g.add(tampo);
  }
  // cintas do tanque e passadico com guarda-corpo, sobre as bocas de carga
  for (const z of [zT - 2.4, zT, zT + 2.4]) {
    const cinta = new THREE.Mesh(new THREE.TorusGeometry(RT + 0.01, 0.025, 6, 32), ESCURO);
    cinta.position.set(0, yT, z);
    g.add(cinta);
    const boca = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.18, 16), ACO);
    boca.position.set(0, yT + RT + 0.05, z);
    g.add(boca);
  }
  caixaEm(g, ESCURO, [0.5, 0.04, LT - 0.6], [0.55, yT + RT + 0.04, zT]);
  for (const z of [zT - 2.8, zT - 0.9, zT + 0.9, zT + 2.8]) caixaEm(g, ESCURO, [0.03, 0.45, 0.03], [0.78, yT + RT + 0.27, z]);
  caixaEm(g, ESCURO, [0.03, 0.03, LT - 0.6], [0.78, yT + RT + 0.5, zT]);
  // escada na traseira e caixa de valvulas embaixo
  const zE = zT - LT / 2 - 0.35;
  for (const x of [0.35, 0.75]) caixaEm(g, ESCURO, [0.04, 2.6, 0.04], [x, 2.1, zE]);
  for (let k = 0; k < 7; k++) caixaEm(g, ESCURO, [0.44, 0.03, 0.03], [0.55, 1.0 + k * 0.36, zE]);
  caixaEm(g, ESCURO, [0.9, 0.45, 0.45], [-0.5, 1.05, zE + 0.1]);
  // painel de seguranca na frente e atras; rotulo de risco nos lados e atras
  caixaEm(g, matPainelOnu(), [0.4, 0.3, 0.02], [0, 0.95, 3.6 + 1.05 + 0.25]);
  caixaEm(g, matPainelOnu(), [0.4, 0.3, 0.02], [0, 1.6, zE - 0.04], [0, Math.PI, 0]);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), matRotulo3());
    r.position.set(s * (RT + 0.02), yT, zT - 1.2);
    r.rotation.y = s * Math.PI / 2;
    g.add(r);
  }
  const rt = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), matRotulo3());
  rt.position.set(0, yT + 0.2, zT - LT / 2 - 0.3);
  rt.rotation.y = Math.PI;
  g.add(rt);
  caixaEm(g, ESCURO, [2.3, 0.15, 0.12], [0, 0.55, -4.6]);                  // para-choque traseiro
  eixos(g, [3.2, -2.4, -3.6]);
  // onde se trabalha na descarga (Fase 21), no referencial do caminhao: a
  // boca da caixa de valvulas, o ponto de aterramento no chassi e a roda de tras
  const pontos = { valvula: [-0.5, 0.95, zE - 0.13], aterramento: [-0.52, 0.85, -4.2], roda: [-1.05, 0, -3.6], lado: -1 };
  return { grupo: g, comprimento: 9.5, pontos };
}

/** Caminhao bau (10 m) para a expedicao de produto. */
export function criarCaminhaoBau() {
  const g = new THREE.Group();
  g.name = 'caminhao-bau';
  chassi(g, 9.5);
  cabine(g, 0x24477a, 3.8, 3.4);
  const zB = -1.0, LB = 7.0;
  const bau = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.7, LB), BRANCO);
  bau.position.set(0, 2.45, zB);
  bau.castShadow = true;
  g.add(bau);
  const zt = zB - LB / 2;                              // face traseira
  // portas traseiras (Fase 21: abrem na carga): uma folha de cada lado, na
  // dobradica da borda, com duas trancas; abertas, encostam na lateral
  // (270°). Atras delas, o vao de carga escuro.
  caixaEm(g, PRETO, [2.36, 2.56, 0.02], [0, 2.45, zt - 0.005]);
  g.userData.portasTraseiras = [];
  for (const s of [-1, 1]) {
    for (const y of [1.5, 2.45, 3.4]) caixaEm(g, ESCURO, [0.12, 0.1, 0.05], [s * 1.2, y, zt - 0.02]);
    const pivo = new THREE.Group();
    pivo.position.set(s * 1.25, 2.45, zt - 0.03);
    caixaEm(pivo, BRANCO, [1.24, 2.6, 0.04], [-s * 0.62, 0, 0]);
    for (const x of [0.35, 0.9]) {
      const tranca = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 8), ACO);
      tranca.position.set(-s * (1.25 - x), 0, -0.03);
      pivo.add(tranca);
    }
    g.add(pivo);
    g.userData.portasTraseiras.push({ pivo, s });
    // faixa refletiva na lateral (vermelho e branco) e o nome da empresa
    caixaEm(g, LANTERNA, [0.02, 0.1, LB - 0.2], [s * 1.26, 1.25, zB]);
  }
  caixaEm(g, ESCURO, [2.3, 0.15, 0.12], [0, 0.55, zt - 0.15]);              // para-choque traseiro
  const nome = texturaPlaca((c, w, h) => {
    c.fillStyle = '#f0f0ee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#24477a'; c.font = `bold ${h * 0.42}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Benzoic Industries', w / 2, h * 0.42);
    c.fillStyle = '#c0392b'; c.fillRect(w * 0.15, h * 0.78, w * 0.7, h * 0.06);
  }, 1024, 160);
  if (nome) {
    const mn = new THREE.MeshStandardMaterial({ map: nome, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.9), mn);
      p.position.set(s * 1.256, 2.7, zB);
      p.rotation.y = s * Math.PI / 2;
      g.add(p);
    }
  }
  eixos(g, [3.4, -2.8, -4.0]);
  // traseira do bau, onde a empilhadeira encosta (Fase 21)
  return { grupo: g, comprimento: 10, pontos: { traseira: [0, 0, zt] } };
}

/**
 * Onibus de fretamento (12,2 m, o veiculo O do DNIT): carroceria branca com a
 * faixa azul, janelas corridas e as duas portas do lado direito (-X, com a
 * frente em +Z), a dianteira e a do meio.
 */
export function criarOnibus() {
  const g = new THREE.Group();
  g.name = 'onibus';
  const L = 12.2;
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, L), BRANCO);
  corpo.position.set(0, 0.45 + 1.4, 0);
  corpo.castShadow = true;
  g.add(corpo);
  const faixa = mat(0x1f4e79, { roughness: 0.4 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, L - 0.4), faixa);
    f.position.set(s * 1.26, 1.05, 0);
    g.add(f);
    const jan = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, L - 1.6), VIDRO);
    jan.position.set(s * 1.26, 2.2, -0.4);
    g.add(jan);
  }
  const para = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.2, 0.02), VIDRO);
  para.position.set(0, 2.1, L / 2 + 0.01);
  g.add(para);
  // portas de folha unica com a dobradica na beirada da frente (Fase 21:
  // abrem no ponto, para fora), cada uma num pivo
  const porta = mat(0x2a2c30, { roughness: 0.4 });
  g.userData.portas = [];
  for (const z of [L / 2 - 1.0, 0.2]) {
    const pivo = new THREE.Group();
    pivo.position.set(-1.27, 1.55, z + 0.55);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 1.1), porta);
    p.position.set(0, 0, -0.55);
    pivo.add(p);
    g.add(pivo);
    g.userData.portas.push(pivo);
  }
  for (const s of [-1, 1]) {
    const fa = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), FAROL);
    fa.position.set(s * 0.9, 0.8, L / 2 + 0.02);
    g.add(fa);
  }
  // acabamento (Fase 18): colunas entre as janelas, letreiro de destino aceso
  // sobre o para-brisa e os retrovisores — sem eles o onibus era uma caixa
  const coluna = mat(0xdfe2e4, { roughness: 0.5 });
  for (const s of [-1, 1]) {
    for (let z = -L / 2 + 1.0; z < L / 2 - 1.4; z += 1.45) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.09), coluna);
      c.position.set(s * 1.27, 2.2, z);
      g.add(c);
    }
    const haste = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.04), porta);
    haste.position.set(s * 1.4, 2.4, L / 2 - 0.1);
    g.add(haste);
    const espelho = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.2), porta);
    espelho.position.set(s * 1.58, 2.25, L / 2 - 0.1);
    g.add(espelho);
  }
  const letreiro = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.24, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x1b1b1b, emissive: 0xffa31a, emissiveIntensity: 0.7, name: 'letreiro-onibus' }));
  letreiro.position.set(0, 2.92, L / 2 + 0.015);
  g.add(letreiro);
  eixos(g, [L / 2 - 2.6, -L / 2 + 3.0]);
  return { grupo: g, comprimento: L };
}

/** Placa da empresa: muro baixo de concreto com o letreiro. */
export function criarPlacaEmpresa({ texto, sub }) {
  const g = new THREE.Group();
  g.name = 'placa-empresa';
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 1.2), mat(0x9a9890, { roughness: 0.95 }));
  base.position.y = 0.2;
  g.add(base);
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#1d2a36'; c.fillRect(0, 0, 1024, 256);
  c.fillStyle = '#e8b84a'; c.fillRect(0, 196, 1024, 10);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // a fonte encolhe ate o letreiro caber com margem
  let fs = 104;
  do { c.font = `bold ${fs}px sans-serif`; fs -= 4; } while (c.measureText(texto).width > 940 && fs > 40);
  c.fillText(texto, 512, 100);
  c.font = '44px sans-serif';
  c.fillStyle = '#c9d3dc';
  c.fillText(sub, 512, 168);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const lado = mat(0x1d2a36);
  const painel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.4, 0.3),
    // emissiveMap desde ja (apagado de dia): acende-la a noite e so uniforme, sem recompilar
    [lado, lado, lado, lado, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, name: 'placa-empresa' }), lado]);
  painel.position.y = 0.45 + 0.7;
  painel.castShadow = true;
  g.add(painel);
  return g;
}
