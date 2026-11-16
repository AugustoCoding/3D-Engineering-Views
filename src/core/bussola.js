import * as THREE from 'three';

/**
 * Bussola (Fase 25, pedido do autor: "uma mini bussola no canto superior
 * direito da tela para o user nao se perder"). A rosa gira com a camera: o
 * N aponta sempre para o norte do terreno (-Z; X e leste, data/site.js),
 * visto de onde a camera olha. Desenhada em SVG (nada de imagem), atualizada
 * depois do movimento da camera (antesDosRotulos), so quando o rumo muda.
 */
export function criarBussola(container, cena) {
  const el = document.createElement('div');
  el.className = 'bussola';
  el.title = 'Norte do terreno';
  // Agulha curta no meio (ponta a 24) e letras num anel por fora dela (raio
  // 36), com os riscos na borda (41 a 45): nada se sobrepoe em giro nenhum.
  const LETRAS = [['N', 0], ['L', 90], ['S', 180], ['O', 270]];
  const pos = (r, g) => [r * Math.sin((g * Math.PI) / 180), -r * Math.cos((g * Math.PI) / 180)].map((v) => +v.toFixed(2));
  el.innerHTML = `
    <svg viewBox="-50 -50 100 100" width="100%" height="100%" aria-hidden="true">
      <circle r="48" class="b-fundo"/>
      <g class="b-rosa">
        ${[...Array(24)].map((_, i) => (i % 6 ? `<line x1="0" y1="-45" x2="0" y2="${i % 2 ? -43 : -41}" transform="rotate(${i * 15})" class="b-risco"/>` : '')).join('')}
        <path d="M0,-24 L5,0 L-5,0 Z" class="b-norte"/>
        <path d="M0,24 L5,0 L-5,0 Z" class="b-sul"/>
        <circle r="2.6" class="b-eixo"/>
        ${LETRAS.map(([l, g]) => { const [x, y] = pos(36, g); return `<text x="${x}" y="${y}" class="b-letra${l === 'N' ? ' b-n' : ''}">${l}</text>`; }).join('')}
      </g>
    </svg>`;
  container.appendChild(el);
  const rosa = el.querySelector('.b-rosa');
  const letras = [...el.querySelectorAll('.b-letra')];
  const f = new THREE.Vector3();
  let antes = NaN;
  cena.antesDosRotulos.push(() => {
    cena.camera.getWorldDirection(f);
    // olhando quase reto para baixo o rumo vem do "para cima" da tela
    if (Math.hypot(f.x, f.z) < 1e-3) f.set(0, 0, -1).applyQuaternion(cena.camera.quaternion);
    const rumo = THREE.MathUtils.radToDeg(Math.atan2(f.x, -f.z));      // 0 = norte, 90 = leste
    if (Math.abs(rumo - antes) < 0.2) return;
    antes = rumo;
    rosa.setAttribute('transform', `rotate(${-rumo})`);
    // as letras ficam de pe
    for (const t of letras) t.setAttribute('transform', `rotate(${rumo} ${t.getAttribute('x') ?? 0} ${t.getAttribute('y') ?? 0})`);
  });
  return { el };
}
