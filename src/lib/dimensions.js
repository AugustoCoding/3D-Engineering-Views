import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * ===========================================================================
 *  COTAS (linhas de dimensao)
 * ===========================================================================
 *  Linha de cota + tracos de extremidade + rotulo HTML.
 *  O rotulo usa CSS2DRenderer: e um <div> normal posicionado sobre o canvas,
 *  entao o texto sai sempre nitido, em qualquer zoom, sem carregar fonte 3D.
 */

/* Amarelo-ambar: contrasta tanto com o inox claro quanto com o chao escuro.
 * O azul anterior sumia contra o ceu e contra os reflexos do costado. */
const COR_COTA = 0xffc247;

const MAT_LINHA = new THREE.LineBasicMaterial({
  color: COR_COTA, transparent: true, opacity: 0.95,
});

/**
 * Linha de chamada TRACEJADA. LineDashedMaterial exige computeLineDistances(),
 * senao o tracejado nao aparece e a linha sai continua — foi o que acontecia
 * com as chamadas antes.
 */
const MAT_AUX = new THREE.LineDashedMaterial({
  color: COR_COTA, transparent: true, opacity: 0.55,
  dashSize: 0.13, gapSize: 0.09,
});

function linha(pontos, mat = MAT_LINHA) {
  const geo = new THREE.BufferGeometry().setFromPoints(pontos);
  const l = new THREE.Line(geo, mat);
  if (mat === MAT_AUX) l.computeLineDistances();
  return l;
}

/**
 * Etiqueta HTML ancorada num ponto do modelo.
 *
 * Sao DOIS divs, nao um. O CSS2DRenderer reescreve o `transform` do elemento
 * do CSS2DObject a cada quadro para posiciona-lo: qualquer escala que a gente
 * puser la e apagada no quadro seguinte. Entao o div EXTERNO fica so com a
 * posicao (do renderer) e a opacidade, e o INTERNO — que o renderer nao toca —
 * leva a escala. Quem mexe nos dois e core/rotulos.js.
 *
 * Como a escala do interno nao altera o tamanho de layout do externo, o
 * translate(-50%, -50%) do renderer continua centrando a etiqueta no ponto
 * ancorado, em qualquer escala.
 */
export function rotulo(texto, classe = 'cota-label') {
  const externo = document.createElement('div');
  externo.className = 'rotulo';

  const corpo = document.createElement('div');
  corpo.className = classe;
  corpo.textContent = texto;
  externo.appendChild(corpo);

  const obj = new CSS2DObject(externo);
  // A primeira classe e o TIPO da etiqueta ('cota-label cota-elev' -> cota).
  obj.userData.rotulo = { tipo: classe.split(' ')[0], corpo };
  return obj;
}

/**
 * Cota entre dois pontos.
 * @param {THREE.Vector3} a
 * @param {THREE.Vector3} b
 * @param {string} texto
 * @param {object} opts { chamadaA, chamadaB, tick, classe da etiqueta }
 */
export function cota(a, b, texto, opts = {}) {
  const g = new THREE.Group();
  g.name = 'cota';

  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  // vetor perpendicular estavel, mesmo para cotas verticais
  const ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const tick = opts.tick ?? 0.12;

  g.add(linha([a, b]));
  g.add(linha([a.clone().addScaledVector(perp, -tick), a.clone().addScaledVector(perp, tick)]));
  g.add(linha([b.clone().addScaledVector(perp, -tick), b.clone().addScaledVector(perp, tick)]));

  // linhas de chamada ate a peca cotada
  if (opts.chamadaA) g.add(linha([opts.chamadaA, a], MAT_AUX));
  if (opts.chamadaB) g.add(linha([opts.chamadaB, b], MAT_AUX));

  const meio = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const lbl = rotulo(texto, opts.classe);
  lbl.position.copy(meio);
  g.add(lbl);

  return g;
}

/** Marcador de elevacao (EL. +x,xx m) — convencao de desenho de tubulacao. */
export function elevacao(ponto, comprimento, texto) {
  const g = new THREE.Group();
  const fim = ponto.clone().add(new THREE.Vector3(comprimento, 0, 0));
  g.add(linha([ponto, fim], MAT_AUX));
  const lbl = rotulo(texto, 'cota-label cota-elev');
  lbl.position.copy(fim);
  g.add(lbl);
  return g;
}
