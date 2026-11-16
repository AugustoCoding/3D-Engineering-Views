import * as THREE from 'three';

/**
 * ===========================================================================
 *  TAG PINTADA NO COSTADO
 * ===========================================================================
 *  Como em campo: a TAG do equipamento pintada a pincel/estencil no costado,
 *  em letras grandes, de frente para o acesso. So a tinta — sem placa: o
 *  fundo do canvas e transparente, a letra e fosca (rugosidade de tinta, nao
 *  de metal), com um pouco de desgaste: borda levemente irregular e falhas
 *  de cobertura, que e o que distingue tinta de adesivo.
 *
 *  A malha e um pedaco de cilindro concentrico ao costado, 4 mm para fora,
 *  com o mesmo eixo — a letra acompanha a curvatura. Desenha-se com
 *  polygonOffset para nao disputar profundidade com a chapa de baixo.
 *  Referencial: o do cilindro (eixo Y, theta = 0 em +Z), para entrar como
 *  filho da propria malha do costado.
 */

function texturaTinta(texto, escuro) {
  const H = 160;
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d');
  const fonte = `900 ${H}px "Arial Black", "Arial", sans-serif`;
  c.font = fonte;
  const largura = Math.ceil(c.measureText(texto).width + H * 0.3);
  cv.width = largura;
  cv.height = Math.round(H * 1.3);
  c.font = fonte;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = escuro ? '#f1efe8' : '#151617';
  c.fillText(texto, largura / 2, cv.height / 2 + H * 0.04);
  // desgaste: falhas de cobertura e borda comida, com semente pelo texto
  let s = [...texto].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  c.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < (largura * cv.height) / 90; k++) {
    c.globalAlpha = 0.25 + r() * 0.6;
    c.fillRect(r() * largura, r() * cv.height, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, aspecto: largura / cv.height };
}

/**
 * @param {object} p
 *   texto      a TAG
 *   raio       raio da superficie pintada (costado ou capa do isolamento)
 *   altura     altura da letra (m)
 *   azimute    angulo do centro da pintura em torno do eixo (rad, 0 = +Z)
 *   y          posicao do centro ao longo do eixo
 *   escuro     superficie escura -> tinta clara
 * @returns {{ malha: THREE.Mesh, largura: number }}
 */
export function criarTagPintada({ texto, raio, altura, azimute, y, escuro = false }) {
  const { tex, aspecto } = texturaTinta(texto, escuro);
  const faixa = altura * 1.3;                     // a textura tem folga em cima e embaixo
  const largura = faixa * aspecto;
  const theta = largura / raio;
  const geo = new THREE.CylinderGeometry(raio + 0.004, raio + 0.004, faixa, Math.max(8, Math.ceil(theta * 24)), 1, true,
    azimute - theta / 2, theta);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.35, depthWrite: false,
    roughness: 0.85, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.position.y = y;
  malha.name = 'tag-pintada';
  malha.renderOrder = 1;
  return { malha, largura };
}

/**
 * A mesma tinta num cilindro DEITADO (trocador, vaso horizontal): o texto
 * corre ao longo do eixo e a letra fica de pe ao longo da circunferencia.
 *   sentido  +1/-1: o texto le no sentido +Y ou -Y do eixo (quem chama escolhe
 *            o que fica da esquerda para a direita para quem olha)
 *   cima     +1/-1: o lado da circunferencia que fica para cima no mundo
 */
export function criarTagPintadaDeitada({ texto, raio, altura, azimute, y, sentido = 1, cima = 1, escuro = false }) {
  const { tex, aspecto } = texturaTinta(texto, escuro);
  const faixa = altura * 1.3;
  const largura = faixa * aspecto;
  const arco = faixa / raio;
  const r = raio + 0.004;
  const nv = Math.max(6, Math.ceil(arco * 24));
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const a = azimute + cima * (v - 0.5) * arco;
    for (let i = 0; i <= 1; i++) {
      const s = (i - 0.5) * largura * sentido;
      pos.push(r * Math.sin(a), y + s, r * Math.cos(a));
      uv.push(i, v);
    }
  }
  for (let j = 0; j < nv; j++) {
    const k = j * 2;
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.35, depthWrite: false, side: THREE.DoubleSide,
    roughness: 0.85, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'tag-pintada';
  malha.renderOrder = 1;
  return { malha, largura };
}
