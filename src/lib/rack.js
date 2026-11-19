import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { PLINTO } from './supports.js';

/**
 * ===========================================================================
 *  PIPE RACK  (Fase 5)
 * ===========================================================================
 *  A geometria vem inteira do arranjo calculado pela tubulacao (lib/rota.js):
 *  posicao de cada portico, largura, niveis e as bandejas das linhas
 *  pequenas. Nada aqui e escolhido — so desenhado.
 *
 *  Cada portico: duas colunas, uma viga por nivel com o topo no BOP (o fundo
 *  dos tubos), sapata de concreto. Longarinas nas bordas em cada nivel
 *  amarram os porticos, e o primeiro e o ultimo vao levam contraventamento
 *  em X — sem ele o portico so resiste no plano dele.
 *
 *  Bandeja: tubo menor que o vao do rack nao vence o vao entre vigas (ver
 *  VAO_ADMISSIVEL em data/rotas.js); corre sobre uma cantoneira continua,
 *  apoiada nas vigas, que e como se faz em campo.
 */

export const PERFIL_COLUNA = 0.2;     // HEB 200 [ESTIMADO]
export const ALTURA_VIGA = 0.2;
const LARGURA_VIGA = 0.12;

function caixa(dx, dy, dz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Barra entre dois pontos (contraventamento). */
function barra(a, b, lado, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(lado, d.length(), lado), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

/**
 * @param {object} L  { z, largura, niveis, xs, sapata, bandejas: [{ nivel, z, x0, x1 }],
 *                      linhas, vaoMax }
 */
export function criarPipeRack(L) {
  const g = new THREE.Group();
  g.name = 'pipe-rack';
  const aco = MAT.acoCarbono;
  const topo = L.niveis[L.niveis.length - 1];
  const bordas = [L.z - L.largura / 2, L.z + L.largura / 2];
  const x0 = L.xs[0], x1 = L.xs[L.xs.length - 1];

  for (const x of L.xs) {
    for (const zc of bordas) {
      const col = caixa(PERFIL_COLUNA, topo, PERFIL_COLUNA, aco);
      col.position.set(x, topo / 2, zc);
      g.add(col);
      // Sapata 2 cm enterrada: a face de baixo nao cai no plano da laje.
      const sap = caixa(L.sapata, 0.2 + PLINTO, L.sapata, MAT.concreto);
      sap.position.set(x, (PLINTO - 0.2) / 2 + 0.0, zc);
      sap.castShadow = false;
      g.add(sap);
    }
    for (const bop of L.niveis) {
      const viga = caixa(LARGURA_VIGA, ALTURA_VIGA, L.largura + PERFIL_COLUNA, aco);
      viga.position.set(x, bop - ALTURA_VIGA / 2, L.z);
      g.add(viga);
    }
  }

  // longarinas de borda, uma por nivel
  for (const bop of L.niveis) {
    for (const zc of bordas) {
      const lg = caixa(x1 - x0, ALTURA_VIGA * 0.8, LARGURA_VIGA * 0.8, aco);
      lg.position.set((x0 + x1) / 2, bop - ALTURA_VIGA / 2, zc);
      g.add(lg);
    }
  }

  // contraventamento em X no primeiro e no ultimo vao, nas duas bordas
  const vaos = L.xs.length > 2 ? [[L.xs[0], L.xs[1]], [L.xs[L.xs.length - 2], L.xs[L.xs.length - 1]]] : [];
  for (const [xa, xb] of vaos) {
    for (const zc of bordas) {
      const yb = L.niveis[0] - ALTURA_VIGA;
      g.add(barra(new THREE.Vector3(xa, 0.3, zc), new THREE.Vector3(xb, yb, zc), 0.08, aco));
      g.add(barra(new THREE.Vector3(xb, 0.3, zc), new THREE.Vector3(xa, yb, zc), 0.08, aco));
    }
  }

  // bandejas das linhas pequenas
  for (const b of L.bandejas ?? []) {
    const bop = L.niveis[b.nivel - 1];
    const bd = caixa(b.x1 - b.x0, 0.05, 0.1, MAT.acoCarbono);
    bd.position.set((b.x0 + b.x1) / 2, bop - 0.025, b.z);
    g.add(bd);
  }

  const vaoMaior = L.xs.slice(1).reduce((m, x, i) => Math.max(m, x - L.xs[i]), 0);
  const f2 = (v) => v.toFixed(2).replace('.', ',');
  g.userData.ficha = {
    titulo: 'Pipe rack',
    subtitulo: 'Pórtico de dois níveis no corredor central',
    grupos: [{
      nome: 'Geometria (sai das rotas da tubulação)',
      dados: {
        'Comprimento': `${f2(x1 - x0)} m`,
        'Largura': `${f2(L.largura)} m`,
        'Níveis (topo da viga)': L.niveis.map((y) => `${f2(y)} m`).join(' · '),
        'Pórticos': `${L.xs.length}, vão maior ${f2(vaoMaior)} m (máx. ${f2(L.vaoMax)} m)`,
        'Linhas apoiadas': String(L.linhas),
        'Bandejas de linha pequena': String((L.bandejas ?? []).length),
        'Uso': 'Nível 1: processo · Nível 2: utilidades',
      },
    }],
  };
  return g;
}
