/**
 * ===========================================================================
 *  SETAS DO P&ID CORRENDO NOS TUBOS  (Fase 27, item 6)
 * ===========================================================================
 *  Com a legenda de cores ligada (tecla C), cada linha ganha uma luva fina de
 *  setas que corre no sentido do escoamento, na velocidade da Fase 23
 *  (lib/hidraulica.js) em escala logaritmica (data/setas.js). Linha sem
 *  vazao conhecida (o vacuo dos filtros) fica com as setas paradas.
 *
 *  Uma geometria so para todas as linhas: um cilindro aberto por trecho
 *  reto, com uv.y = comprimento acumulado no sentido do escoamento e a
 *  velocidade de tela num atributo por vertice; o shader desliza a textura
 *  com o relogio do mundo. Uma chamada de desenho; fora da fusao
 *  (`userData.animar`).
 * ===========================================================================
 */
import * as THREE from 'three';
import { velocidades } from '../lib/hidraulica.js';
import { RAMAIS } from '../data/rotas.js';
import { SETAS } from '../data/setas.js';

/** Textura: uma seta (chevron) apontando para +v, fundo transparente. */
function texturaSeta() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // contorno escuro e miolo claro: se le no tubo claro e no escuro
  for (const [cor, w] of [['rgba(20,24,28,0.85)', 14], ['#ffffff', 7]]) {
    g.strokeStyle = cor; g.lineWidth = w;
    g.beginPath(); g.moveTo(14, 44); g.lineTo(32, 20); g.lineTo(50, 44); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Velocidade de tela (m/s) de uma velocidade real. */
export const velocidadeDeTela = (v) => (v == null ? 0 : SETAS.base * (1 + Math.log10(Math.max(v, SETAS.vMin) / SETAS.vRef)));

/**
 * @param {object} p
 * @param {object} p.tubulacao  o de equipment/tubulacao.js (tubos e itens)
 */
export function criarSetasTubos({ tubulacao }) {
  // velocidade real por trecho: t<i> (processo), r<i> (ramal), cab-<id>
  const dnDe = new Map(tubulacao.itens.map((it) => [it.id, it.dn]));
  const vel = new Map();
  for (const x of velocidades({ dnDoRamal: (r) => dnDe.get(`r${RAMAIS.indexOf(r)}`) })) {
    if (!x.semVazao && Number.isFinite(x.v)) vel.set(x.id, x.v);
  }
  // sentido: o desenho dos trechos ja vai de onde sai para onde chega; o
  // ramal vai do bocal ao cabecal (alimentacao corre ao contrario); o
  // cabecal vai de oeste a leste (alimentacao corre ao contrario)
  const aoContrario = (id) => {
    if (id.startsWith('cab-')) return SETAS.alimentacao.includes(id.slice(4));
    if (id.startsWith('r')) return SETAS.alimentacao.includes(RAMAIS[+id.slice(1)]?.cabecal);
    return false;
  };

  const pos = [], uv = [], velAttr = [], idx = [];
  const seg = 10, eixoY = new THREE.Vector3(0, 1, 0);
  const resumo = { linhas: 0, paradas: [] };
  for (const t of tubulacao.tubos) {
    if (!t.pts || t.pts.length < 2) continue;
    const pts = aoContrario(t.id) ? [...t.pts].reverse() : t.pts;
    const v = vel.get(t.id);
    const vt = velocidadeDeTela(v);
    if (v == null) resumo.paradas.push(t.id);
    resumo.linhas++;
    const r = t.r + SETAS.folga;
    // u em volta: `voltas` setas no perimetro; v em metros / passo
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], L = a.distanceTo(b);
      if (L < 1e-4) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(eixoY, b.clone().sub(a).normalize());
      const base = pos.length / 3;
      for (const [k, y] of [[0, 0], [1, L]]) {
        for (let j = 0; j <= seg; j++) {
          const ang = (j / seg) * Math.PI * 2;
          const p = new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r).applyQuaternion(q).add(a);
          pos.push(p.x, p.y, p.z);
          uv.push((j / seg) * SETAS.voltas, (s + (k ? L : 0)) / SETAS.passo);
          velAttr.push(vt / SETAS.passo);
        }
      }
      for (let j = 0; j < seg; j++) {
        const a0 = base + j, a1 = base + j + 1, b0 = base + seg + 1 + j, b1 = base + seg + 2 + j;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
      s += L;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aVel', new THREE.Float32BufferAttribute(velAttr, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const tempo = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({
    map: texturaSeta(), color: SETAS.cor, transparent: true, opacity: SETAS.opacidade,
    depthWrite: false, side: THREE.DoubleSide, name: 'setas-tubos',
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = tempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVel;\nuniform float uTempo;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv.y -= uTempo * aVel;\n#endif');
  };
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'setas-tubos';
  // Fora da oclusao de ambiente (core/realismo.js): o GTAO desenha a cena com
  // `overrideMaterial` para tirar normais e profundidade e so deixa de fora
  // pontos e linhas — a luva transparente, 8 mm acima do tubo, entrava como
  // solida e pintava o tubo de preto. Nessa passada ela nao desenha nada.
  malha.onBeforeRender = (r, cena) => { geo.setDrawRange(0, cena.overrideMaterial ? 0 : Infinity); };
  malha.renderOrder = 2;
  malha.userData.animar = true;
  const grupo = new THREE.Group();
  grupo.name = 'setas-tubos';
  grupo.userData.animar = true;                  // fora da fusao
  grupo.visible = false;
  grupo.add(malha);

  return {
    grupo, resumo,
    ligar: (v) => { grupo.visible = v; },
    // relogio do mundo: so anda quando o mundo anda (o passeio congela)
    atualizar: (dt) => { tempo.value += dt; },
    get tempo() { return tempo.value; },
  };
}
