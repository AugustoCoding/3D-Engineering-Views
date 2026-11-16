import { VENTO, vetorBarlavento } from '../data/site.js';
import { balancarCopas, TEMPO_VENTO } from '../lib/ambiente.js';

/**
 * ===========================================================================
 *  VENTO  (Fase 27, itens 8 e 20)
 * ===========================================================================
 *  O vento de projeto (site.js, VENTO: de SE) mexe o que se mexe com ele: a
 *  copa das arvores (no shader, lib/ambiente.js) e o cone das birutas, que
 *  oscila em volta do rumo dele e sobe e desce com as rajadas.
 *  [ADOTADO, parametros de desenho] rajada de ~0,15 Hz, ±7° de rumo.
 */
export function criarVento({ seguranca }) {
  const [bx, bz] = vetorBarlavento(VENTO.de);
  balancarCopas({ para: [-bx, -bz] });
  const cones = [];
  seguranca.grupo.traverse((o) => { if (o.name === 'biruta-cone') cones.push(o); });
  let t = 0;
  function atualizar(dt) {
    t += dt;
    TEMPO_VENTO.value = t;
    cones.forEach((c, i) => {
      const f = i * 1.9;
      const rajada = 0.5 + 0.5 * Math.sin(t * 0.9 + f);               // 0 a 1
      c.rotation.y = c.userData.rumo.y + 0.12 * Math.sin(t * 0.55 + f) + 0.04 * Math.sin(t * 2.7 + f);
      // com rajada o cone levanta; na calmaria cai
      c.rotation.z = c.userData.rumo.z * (1.6 - rajada) + 0.03 * Math.sin(t * 6.1 + f);
    });
  }
  return { atualizar, cones };
}
