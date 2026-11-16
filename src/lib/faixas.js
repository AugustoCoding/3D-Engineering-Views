import * as THREE from 'three';

/**
 * ===========================================================================
 *  FAIXAS DE IDENTIFICACAO DA TUBULACAO  (Fase 25, NBR 6493)
 * ===========================================================================
 *  O corpo do tubo tem a cor da norma (aluminio nos inflamaveis); o fluido se
 *  le pelos aneis da cor dele, como em campo: perto de cada ponta de trecho
 *  reto e a cada `passo` m. Le a linha de centro que cada tubo guarda
 *  (`userData.caminho`, lib/pipe.js) e o codigo pelo nome do material
 *  (`linha-<codigo>`): nao mexe em quem monta a tubulacao.
 *
 *  Uma InstancedMesh por codigo: centenas de aneis, uma chamada de desenho
 *  cada cor. O anel sobra 6 mm do tubo (tinta e fita), sem disputar
 *  profundidade com ele.
 */
export function criarFaixas(raizes, { cores, largura, passo, ponta, retoMin }) {
  const porCodigo = new Map();
  for (const raiz of raizes) {
    raiz.updateMatrixWorld(true);
    raiz.traverse((o) => {
      const cam = o.userData?.caminho, diam = o.userData?.diam, nome = o.material?.name ?? '';
      if (!cam || !diam || !nome.startsWith('linha-')) return;
      const codigo = nome.slice(6);
      if (cores[codigo] === undefined) return;
      const pts = cam.map((p) => p.clone().applyMatrix4(o.matrixWorld));
      const lista = porCodigo.get(codigo) ?? [];
      porCodigo.set(codigo, lista);
      // trechos retos: pontos seguidos na mesma direcao (o cotovelo e denso)
      for (let i = 0; i < pts.length - 1;) {
        const dir = pts[i + 1].clone().sub(pts[i]).normalize();
        let j = i + 1;
        while (j + 1 < pts.length && pts[j + 1].clone().sub(pts[j]).normalize().dot(dir) > 0.9999) j++;
        const L = pts[i].distanceTo(pts[j]);
        if (L >= retoMin) {
          const ss = [ponta];
          for (let s = ponta + passo; s < L - ponta - passo / 2; s += passo) ss.push(s);
          if (L - 2 * ponta > largura) ss.push(L - ponta);
          for (const s of ss) lista.push({ c: pts[i].clone().addScaledVector(dir, s), dir, r: diam / 2 + 0.006 });
        }
        i = j;
      }
    });
  }

  const g = new THREE.Group();
  g.name = 'faixas-de-identificacao';
  const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
  const cima = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3();
  for (const [codigo, lista] of porCodigo) {
    if (!lista.length) continue;
    const mat = new THREE.MeshStandardMaterial({ color: cores[codigo], metalness: 0.15, roughness: 0.6, side: THREE.DoubleSide, name: `faixa-${codigo}` });
    const im = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach(({ c, dir, r }, k) => {
      q.setFromUnitVectors(cima, dir);
      im.setMatrixAt(k, m.compose(c, q, e.set(r, largura, r)));
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = false;
    im.name = `faixas-${codigo}`;
    g.add(im);
  }
  return g;
}
