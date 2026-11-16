import * as THREE from 'three';
import { PORTAS } from '../data/entorno.js';
import { CALCADAS, LARGURA_CALCADA, VIAS, VENTO, vetorBarlavento } from '../data/site.js';
import { PLACA } from '../data/ambiente.js';
import { distPontoSeg } from '../lib/plano.js';
import { criarMastroBandeira } from '../lib/bandeira.js';
import { Y } from '../lib/terreno.js';

/**
 * Mastros de bandeira (Fase 27, item 24) em frente a porta da ADM, no
 * gramado, um de cada lado do acesso: a `recuo` m da fachada e a `lado` m do
 * eixo da porta, no primeiro ponto livre (longe de calcada, via e arvore).
 * [ADOTADO] a bandeira nacional a direita de quem sai do predio.
 */
const NORMAL = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };

export function criarBandeiras({ ambiente }) {
  const g = new THREE.Group();
  g.name = 'bandeiras';
  const adm = PORTAS.find((p) => p.bloco === 'ADM');
  if (!adm) return g;
  const n = NORMAL[adm.lado], t = [-n[1], n[0]];
  const [bx, bz] = vetorBarlavento(VENTO.de);
  const para = [-bx, -bz];
  // troncos das arvores ja plantadas
  const arvores = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const tronco = ambiente.grupo.getObjectByName('arvores')?.children[0];
  for (let i = 0; i < (tronco?.count ?? 0); i++) { tronco.getMatrixAt(i, m); p.setFromMatrixPosition(m); arvores.push([p.x, p.z]); }
  const longeDe = (q, polis, d) => polis.every((pts) => pts.every((a, i) => i === 0 || distPontoSeg(q, pts[i - 1], a) > d));
  const livre = (q) => longeDe(q, CALCADAS.map((c) => c.pontos), LARGURA_CALCADA / 2 + 0.8)
    && VIAS.every((v) => longeDe(q, [v.pontos], v.largura / 2 + 1.5))
    && arvores.every(([x, z]) => Math.hypot(x - q[0], z - q[1]) > 2.4);
  const lugar = (s) => {
    for (const recuo of [5, 7, 4, 9]) {
      for (const lado of [3.5, 5, 6.5, 8]) {
        const q = [adm.porta[0] + n[0] * recuo + t[0] * s * lado, adm.porta[1] + n[1] * recuo + t[1] * s * lado];
        if (livre(q)) return q;
      }
    }
    return null;
  };
  // quem sai do predio olha para n: a direita dele e -t
  [['brasil', -1], ['empresa', 1]].forEach(([b, s], i) => {
    const q = lugar(s);
    if (!q) return;
    const mb = criarMastroBandeira({ bandeira: b, para, fase: i * 1.7 });
    mb.position.set(q[0], Y.bloco, q[1]);
    g.add(mb);
  });
  g.userData.ficha = { titulo: 'Mastros de bandeira', subtitulo: `${PLACA.texto} · em frente à ADM`, grupos: [] };
  return g;
}
