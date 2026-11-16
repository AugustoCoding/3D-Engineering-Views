import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { criarEscada } from './supports.js';
import { triplanar } from './texturas.js';

/**
 * ===========================================================================
 *  UTILIDADES DO ENTORNO  (Fase 7)
 * ===========================================================================
 *  Torre de resfriamento, caldeira de pacote com chamine, transformador,
 *  bacia aberta (ETE), braco de descarga e cobertura. Todas com a origem no
 *  piso, no centro da pegada; proporcoes [ESTIMADO], de catalogo — a escala
 *  certa ao lado do processo, nao desenho de fabricante.
 */

const SEG = 32;

function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cil(r, h, mat, aberto = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, SEG, 1, aberto), mat);
  m.castShadow = true;
  return m;
}

const PAINEL = triplanar(new THREE.MeshStandardMaterial({ color: 0x7f9a8f, roughness: 0.7, name: 'frp' }), 'painel', 1.2);
const VENEZIANA = new THREE.MeshStandardMaterial({ color: 0x4d5f58, roughness: 0.8 });
const AGUA = new THREE.MeshStandardMaterial({ color: 0x3f7d86, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
// O que se ve na bacia: agua (equalizacao), lamina com oleo (separador),
// licor misto marrom com espuma dos difusores (biologico) e lodo secando.
const SUPERFICIES = {
  agua: AGUA,
  oleosa: new THREE.MeshStandardMaterial({ color: 0x3a4a44, roughness: 0.05, metalness: 0.45, transparent: true, opacity: 0.9, name: 'lamina-oleosa' }),
  aeracao: new THREE.MeshStandardMaterial({ color: 0x7a6a4c, roughness: 0.6, transparent: true, opacity: 0.92, name: 'licor-misto' }),
  lodo: new THREE.MeshStandardMaterial({ color: 0x4e3f2e, roughness: 1, name: 'lodo' }),
};
const ESPUMA = new THREE.MeshStandardMaterial({ color: 0xe9e5d8, roughness: 0.9, name: 'espuma' });

/**
 * Torre de tiragem induzida, celulas em linha ao longo de X: bacia de
 * concreto, casco de painel de fibra, venezianas de entrada de ar nos lados
 * longos, deck com guarda-corpo e o difusor do ventilador em cima.
 */
export function criarTorreResfriamento({ celulas = 2, lado = 6, altura = 7 }) {
  const g = new THREE.Group();
  g.name = 'torre-resfriamento';
  const L = celulas * lado;
  const bacia = caixa(L + 0.6, 1.1, lado + 0.6, MAT.concreto);
  bacia.position.y = 0.25;                        // 0,3 m enterrada
  g.add(bacia);
  const casco = caixa(L, altura - 0.8, lado, PAINEL);
  casco.position.y = 0.8 + (altura - 0.8) / 2;
  g.add(casco);
  for (const s of [-1, 1]) {                      // venezianas nos lados longos
    for (let i = 0; i < celulas; i++) {
      const v = caixa(lado - 0.6, 1.8, 0.05, VENEZIANA);
      v.position.set(-L / 2 + lado * (i + 0.5), 0.8 + 1.1, s * (lado / 2 + 0.03));
      g.add(v);
    }
  }
  const deck = caixa(L + 0.3, 0.15, lado + 0.3, MAT.grade);
  deck.position.y = altura + 0.075;
  g.add(deck);
  for (let i = 0; i < celulas; i++) {
    const x = -L / 2 + lado * (i + 0.5);
    const difusor = new THREE.Mesh(new THREE.CylinderGeometry(lado * 0.3, lado * 0.27, 2, SEG, 1, true), PAINEL);
    difusor.material = PAINEL.clone();
    difusor.material.side = THREE.DoubleSide;
    difusor.position.set(x, altura + 1.15, 0);
    difusor.castShadow = true;
    g.add(difusor);
    const cubo = cil(0.25, 0.3, MAT.acoCarbono);
    cubo.position.set(x, altura + 0.6, 0);
    g.add(cubo);
    // ventilador (Fase 27): seis pas no cubo, girando (site/animacoes.js),
    // fora da fusao; a ponta da pa a 0,26 lado, dentro do difusor (0,27)
    const rotor = new THREE.Group();
    rotor.name = 'ventilador-torre';
    rotor.userData.girante = true;
    for (let k = 0; k < 6; k++) {
      const pa = caixa(lado * 0.26 - 0.2, 0.03, 0.42, MAT.acoCarbono);
      pa.position.x = 0.2 + (lado * 0.26 - 0.2) / 2;
      pa.rotation.x = 0.25;                       // passo da pa
      const braco = new THREE.Group();
      braco.rotation.y = (k / 6) * Math.PI * 2;
      braco.add(pa);
      rotor.add(braco);
    }
    rotor.position.set(x, altura + 0.72, 0);
    g.add(rotor);
  }
  // saidas de ar umido (Fase 27): o topo de cada difusor, de onde sai a pluma
  g.userData.saidas = Array.from({ length: celulas }, (_, i) => ({ tipo: 'torre', p: [-L / 2 + lado * (i + 0.5), altura + 2.15, 0] }));
  // guarda-corpo do deck e escada
  for (const s of [-1, 1]) {
    for (const h of [0.55, 1.1]) {
      const r1 = caixa(L + 0.3, 0.04, 0.04, MAT.guardaCorpo);
      r1.position.set(0, altura + 0.15 + h, s * (lado / 2 + 0.13));
      g.add(r1);
      const r2 = caixa(0.04, 0.04, lado + 0.3, MAT.guardaCorpo);
      r2.position.set(s * (L / 2 + 0.13), altura + 0.15 + h, 0);
      g.add(r2);
    }
  }
  const escada = criarEscada({ yBase: 0, yTopo: altura + 0.15, raio: L / 2 + 0.4, angulo: 0, largura: 0.6 });
  g.add(escada);
  // Retorno quente no costado sul, logo abaixo do deck: e onde fica o
  // distribuidor, sobre o enchimento. A succao das bombas sai da bacia.
  return {
    grupo: g, altura: altura + 2.15,
    bocais: { R: { pos: [0, altura - 0.8, lado / 2], dir: [0, 0, 1] } },
    bacia: { face: lado / 2 + 0.3, topo: 0.8 },
  };
}

/**
 * Caldeira flamotubular de pacote: casco horizontal sobre berco, queimador na
 * frente (-X), caixa de fumaca atras e a chamine subindo dela.
 */
export function criarCaldeira({ diametro = 2.2, comprimento = 5.5, chamine = 18 }) {
  const g = new THREE.Group();
  g.name = 'caldeira';
  const R = diametro / 2;
  const yEixo = 0.5 + R;
  const base = caixa(comprimento + 0.8, 0.5, diametro + 0.4, MAT.concreto);
  base.position.y = 0.05;
  g.add(base);
  const casco = cil(R, comprimento, new THREE.MeshStandardMaterial({ color: 0xc7cdd3, metalness: 0.35, roughness: 0.5 }));
  casco.rotation.z = Math.PI / 2;
  casco.position.y = yEixo;
  g.add(casco);
  const queimador = caixa(0.9, R * 1.2, R * 1.2, new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.6 }));
  queimador.position.set(-comprimento / 2 - 0.45, yEixo, 0);
  g.add(queimador);
  const fumaca = caixa(0.7, diametro * 1.05, diametro * 1.05, MAT.acoCarbono);
  fumaca.position.set(comprimento / 2 + 0.35, yEixo, 0);
  g.add(fumaca);
  const rCh = 0.35;
  const ch = cil(rCh, chamine - (yEixo + R), MAT.acoCarbono);
  ch.position.set(comprimento / 2 + 0.35, yEixo + R + (chamine - yEixo - R) / 2, 0);
  g.add(ch);
  const anel = cil(rCh * 1.25, 0.25, MAT.acoCarbono);
  anel.position.set(comprimento / 2 + 0.35, chamine - 0.2, 0);
  g.add(anel);
  // Saida de vapor no topo do casco, no meio dele (valvula principal).
  // boca da chamine (Fase 27): de onde sai a pluma dos gases
  g.userData.saidas = [{ tipo: 'chamine', p: [comprimento / 2 + 0.35, chamine, 0] }];
  return { grupo: g, altura: chamine, bocais: { V: { pos: [0, yEixo + R, 0], dir: [0, 1, 0] } } };
}

/** Transformador a oleo: tanque, radiadores dos dois lados, buchas e conservador. */
export function criarTransformador() {
  const g = new THREE.Group();
  g.name = 'transformador';
  const mat = new THREE.MeshStandardMaterial({ color: 0x8c949b, metalness: 0.4, roughness: 0.6 });
  const base = caixa(3.2, 0.4, 2.4, MAT.concreto);
  base.position.y = 0.0;
  g.add(base);
  const tanque = caixa(2.2, 1.9, 1.4, mat);
  tanque.position.y = 0.2 + 0.95;
  g.add(tanque);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const aleta = caixa(0.04, 1.5, 0.45, mat);
      aleta.position.set(-0.8 + i * 0.32, 0.2 + 0.9, s * (0.7 + 0.24));
      g.add(aleta);
    }
  }
  for (let i = 0; i < 3; i++) {
    const bucha = cil(0.06, 0.55, new THREE.MeshStandardMaterial({ color: 0x6b4c3b, roughness: 0.4 }));
    bucha.position.set(-0.6 + i * 0.6, 0.2 + 1.9 + 0.27, 0);
    g.add(bucha);
  }
  const conserv = cil(0.22, 1.2, mat);
  conserv.rotation.z = Math.PI / 2;
  conserv.position.set(0, 0.2 + 1.9 + 0.45, -0.45);
  g.add(conserv);
  return { grupo: g, altura: 2.8 };
}

/** Bacia aberta de concreto com lamina d'agua (ETE); `superficie` escolhe
 *  o que se ve nela (SUPERFICIES). A lamina fica 0,35 m abaixo da borda. */
export function criarBaciaAberta({ comprimento, largura, altura, superficie = 'agua' }) {
  const g = new THREE.Group();
  g.name = 'bacia';
  const e = 0.25;
  for (const [w, d, x, z] of [[comprimento, e, 0, -largura / 2 + e / 2], [comprimento, e, 0, largura / 2 - e / 2],
    [e, largura, -comprimento / 2 + e / 2, 0], [e, largura, comprimento / 2 - e / 2, 0]]) {
    const parede = caixa(w, altura + 0.3, d, MAT.concreto);
    parede.position.set(x, (altura - 0.3) / 2, z);
    g.add(parede);
  }
  // fundo 4 cm acima da placa do bloco: no mesmo plano, os dois piscam
  const fundo = caixa(comprimento, 0.3, largura, MAT.concreto);
  fundo.position.y = -0.15 + 0.04;
  g.add(fundo);
  const agua = new THREE.Mesh(new THREE.BoxGeometry(comprimento - 2 * e, 0.02, largura - 2 * e), SUPERFICIES[superficie]);
  agua.position.y = altura - 0.35;
  g.add(agua);
  if (superficie === 'aeracao') {
    // um borbulhar sobre cada difusor, em grade de ~0,8 m: uma InstancedMesh
    // so (uma chamada de desenho), cada circulo pulsando fora de fase com os
    // outros (Fase 27, item 22) — quem anda o relogio e o main.js
    const nx = Math.max(1, Math.floor((comprimento - 2 * e) / 0.8)), nz = Math.max(1, Math.floor((largura - 2 * e) / 0.8));
    const bolhas = new THREE.InstancedMesh(new THREE.CircleGeometry(0.25, 10).rotateX(-Math.PI / 2), ESPUMA, nx * nz);
    bolhas.name = 'borbulhar';
    bolhas.userData.animar = true;
    const pos = [], fase = [];
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        pos.push(new THREE.Vector3(-comprimento / 2 + e + (i + 0.5) * (comprimento - 2 * e) / nx, altura - 0.335,
          -largura / 2 + e + (k + 0.5) * (largura - 2 * e) / nz));
        fase.push(((i * 7 + k * 13) % 17) / 17 * Math.PI * 2);
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    bolhas.userData.animarTempo = (t) => {
      pos.forEach((p, n) => {
        const k = 0.75 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.6 + fase[n]));
        bolhas.setMatrixAt(n, m.compose(p, q, s.set(k, 1, k)));
      });
      bolhas.instanceMatrix.needsUpdate = true;
    };
    bolhas.userData.animarTempo(0);
    g.add(bolhas);
  }
  return { grupo: g, altura };
}

/** Braco de descarga de caminhao-tanque: coluna, braco horizontal e descida. */
export function criarBracoCarga() {
  const g = new THREE.Group();
  g.name = 'braco-carga';
  const mat = MAT.inox;
  const col = cil(0.06, 3.4, mat);
  col.position.y = 1.7;
  g.add(col);
  const base = caixa(0.5, 0.3, 0.5, MAT.concreto);
  base.position.y = 0.0;
  g.add(base);
  const braco = cil(0.05, 2.6, mat);
  braco.rotation.z = Math.PI / 2;
  braco.position.set(1.3, 3.35, 0);
  g.add(braco);
  const desce = cil(0.05, 1.4, mat);
  desce.position.set(2.6, 2.65, 0);
  g.add(desce);
  const contra = caixa(0.25, 0.25, 0.25, MAT.acoCarbono);
  contra.position.set(-0.25, 3.35, 0);
  g.add(contra);
  // O produto desce pela coluna e sai no pe dela, para tras (-X).
  return { grupo: g, altura: 3.5, bocais: { S: { pos: [-0.06, 0.45, 0], dir: [-1, 0, 0] } } };
}

/** Cobertura aberta: colunas nos cantos e telha metalica a 1 agua. */
export function criarCobertura({ comprimento, largura, altura }) {
  const g = new THREE.Group();
  g.name = 'cobertura';
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = caixa(0.2, altura, 0.2, MAT.acoCarbono);
      c.position.set(sx * (comprimento / 2 - 0.1), altura / 2, sz * (largura / 2 - 0.1));
      g.add(c);
    }
  }
  const telha = caixa(comprimento + 0.6, 0.08, largura + 0.6,
    triplanar(new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.5, roughness: 0.5 }), 'telhaX', 1));
  telha.position.y = altura + 0.04;
  g.add(telha);
  return { grupo: g, altura: altura + 0.1 };
}

/**
 * Canaleta de cabos de concreto (Fase 18) ao longo de x, com tampas de
 * concreto de 1 m e uma fresta entre elas; sai 8 cm acima do piso.
 */
export function criarCanaleta({ comprimento, largura = 0.6 }) {
  const g = new THREE.Group();
  g.name = 'canaleta';
  const corpo = caixa(comprimento, 0.3, largura, MAT.concreto);
  corpo.position.y = -0.15 + 0.04;
  g.add(corpo);
  const n = Math.max(1, Math.round(comprimento));
  for (let i = 0; i < n; i++) {
    const tampa = caixa(comprimento / n - 0.02, 0.04, largura - 0.04, MAT.concreto);
    tampa.position.set(-comprimento / 2 + (i + 0.5) * (comprimento / n), 0.06, 0);
    g.add(tampa);
  }
  return { grupo: g };
}
