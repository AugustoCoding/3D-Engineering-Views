import * as THREE from 'three';
import { CALCADAS, VIAS, TRAVESSIA, LOTE } from '../data/site.js';
import { mapaPedestre } from './pedestres.js';
import { distPontoSeg } from '../lib/plano.js';
import { rotulo } from '../lib/dimensions.js';

/**
 * ===========================================================================
 *  MAPA DE PEDESTRES NA VISTA DE PLANTA  (Fase 28, parte da sessao local)
 * ===========================================================================
 *  Pedido do autor: "mapear os caminhos de pedestres". Na tecla P, por cima
 *  da planta:
 *    verde     calcada e caminho de pedestre
 *    branco    travessia (faixa elevada)
 *    vermelho  trecho de calcada que corre NA PISTA fora de travessia — o
 *              grafo de calcadas o conta como ligado, mas a pe ali se anda
 *              no asfalto
 *    ponto verde / vermelho  destino alcancado / nao alcancado a partir da
 *              catraca e do abrigo do onibus (porta, rampa da laje, escada
 *              do dique, portao de utilidade, ponto de encontro)
 *  A rede e os destinos sao os da auditoria (`site/pedestres.js`,
 *  `mapaPedestre()`, sessao da nuvem): o que se ve e o que se mediu. O teste
 *  de trecho na pista fica aqui, pela calcada desenhada.
 */

const COR = { calcada: 0x2ecc71, caminho: 0x9be15d, travessia: 0xffffff, naPista: 0xff3b30, alcancado: 0x2ecc71, inacessivel: 0xff3b30 };
const Y = 0.7;           // acima de tudo o que e chao, abaixo dos rotulos
const LARGO = 1.1;       // largura da fita desenhada (m)

export function criarMapaPedestre({ chao }) {
  const grupo = new THREE.Group();
  grupo.name = 'mapa-pedestre';
  const travessias = chao?.travessias ?? [];

  const naTravessia = (x, z) => travessias.some((t) => {
    const dx = x - t.x, dz = z - t.z;
    const ao = Math.abs(dx * t.dv[0] + dz * t.dv[1]);
    const tr = Math.abs(-dx * t.dv[1] + dz * t.dv[0]);
    return ao < TRAVESSIA.plataforma / 2 + TRAVESSIA.rampa + 0.3 && tr < t.largura / 2 + 0.6;
  });
  const naPista = (x, z) => VIAS.some((v) => v.pontos.some((p, i, a) => i > 0
    && distPontoSeg([x, z], a[i - 1], p) < v.largura / 2 - 0.2));

  // fitas: um BufferGeometry por cor, de quads deitados
  const fitas = {};
  const fita = (cor, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 1e-3) return;
    const nx = (-dz / L) * LARGO / 2, nz = (dx / L) * LARGO / 2;
    (fitas[cor] ??= []).push(
      a[0] + nx, Y, a[1] + nz, b[0] + nx, Y, b[1] + nz, b[0] - nx, Y, b[1] - nz,
      a[0] + nx, Y, a[1] + nz, b[0] - nx, Y, b[1] - nz, a[0] - nx, Y, a[1] - nz,
    );
  };
  const mapa = mapaPedestre();
  const achados = { naPista: [], semAcesso: [], rede: mapa.achados };
  // a rede da auditoria: calcada, caminho e travessia
  for (const e of mapa.arestas) fita(COR[e.tipo] ?? COR.calcada, e.a, e.b);
  // e o teste daqui: calcada desenhada que corre na pista fora da faixa
  for (const c of CALCADAS) {
    for (let i = 1; i < c.pontos.length; i++) {
      const a = c.pontos[i - 1], b = c.pontos[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(L / 0.5));
      for (let k = 0; k < n; k++) {
        const p = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
        const q = [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        if (naTravessia(...m) || !naPista(...m)) continue;
        achados.naPista.push({ calcada: c.id, p: m });
        fita(COR.naPista, p, q);
      }
    }
  }
  // destinos: alcancado ou nao
  const pontos = [];
  for (const d of mapa.destinos) {
    if (!d.alcancado) achados.semAcesso.push(d.nome ?? d.id);
    pontos.push([d.p, d.alcancado ? COR.alcancado : COR.inacessivel]);
  }

  for (const [cor, v] of Object.entries(fitas)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: +cor, side: THREE.DoubleSide, toneMapped: false, depthTest: false, transparent: true, opacity: 0.9 }));
    m.renderOrder = 5;
    grupo.add(m);
  }
  const disco = new THREE.CircleGeometry(1.4, 20).rotateX(-Math.PI / 2);
  for (const [[x, z], cor] of pontos) {
    const d = new THREE.Mesh(disco, new THREE.MeshBasicMaterial({ color: cor, toneMapped: false, depthTest: false }));
    d.position.set(x, Y + 0.05, z);
    d.renderOrder = 6;
    grupo.add(d);
  }
  // legenda no canto do lote
  const leg = rotulo(`Pedestres — verde: calçada e caminho · branco: travessia · vermelho: anda na pista (${achados.naPista.length ? 'há' : 'nenhum'}) · pontos: ${mapa.destinos.length} destinos, ${achados.semAcesso.length} sem acesso`, 'zona-label');
  leg.position.set((LOTE.x[0] + LOTE.x[1]) / 2, 1.5, LOTE.z[1] + 44);      // abaixo da via publica: o HUD tapa o alto
  grupo.add(leg);
  grupo.userData.achados = achados;
  return { grupo, achados };
}
