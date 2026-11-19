import * as THREE from 'three';
import { criarTagPintada, criarTagPintadaDeitada } from '../lib/pintura.js';
import { EXTRAS } from '../data/plant-extra.js';
import { BLOCOS } from '../data/site.js';

/**
 * ===========================================================================
 *  TAGS PINTADAS NOS EQUIPAMENTOS
 * ===========================================================================
 *  Cada equipamento recebe a propria TAG pintada no costado — ou na capa do
 *  isolamento, ou na camisa, que e o que se ve por fora. A face sai medida:
 *
 *    - candidatas em volta do eixo, a cada 30°; no vaso deitado, so as que
 *      olham para o lado (a tinta de cima nao se le do chao);
 *    - descarta a face que tem bocal, escada, perna, tubo ou instrumento na
 *      frente: tres raios de fora para dentro, nas duas pontas e no meio do
 *      texto, tem de bater primeiro na propria superficie;
 *    - entre as livres, a virada para FORA da area de processo (pedido do
 *      o autor, 26/10: o centro da fabrica e o processo, quem le esta em
 *      volta — no anel, na faixa do perimetro), e depois a de mais espaco a
 *      frente (ate 12 m, contra os outros equipamentos).
 *
 *  Bomba nao recebe tinta: e pequena, e a placa dela nao se le de passagem.
 *  Equipamento pintado ganha `pintado` na etiqueta: de perto a etiqueta some
 *  e le-se a tinta (core/rotulos.js).
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PRIORIDADE = { isolamento: 3, camisa: 2.5, costado: 2 };
const isbl = BLOCOS.find((b) => b.id === 'ISBL');
const CENTRO = V((isbl.x[0] + isbl.x[1]) / 2, 0, (isbl.z[0] + isbl.z[1]) / 2);

/** Superficie cilindrica que se ve por fora: { malha, r, y0, y1, theta0, theta1 }. */
function superficie(grupo, excluir) {
  let melhor = null;
  grupo.traverse((m) => {
    if (!m.isMesh || !m.visible) return;
    for (let n = m; n; n = n.parent) if (excluir.has(n)) return;
    const g = m.geometry;
    let r, y0, y1, theta0 = 0, theta1 = Math.PI * 2, pri = 1;
    if (g.type === 'LatheGeometry') {
      const pts = g.parameters.points;
      r = Math.max(...pts.map((p) => p.x));
      const retos = pts.filter((p) => Math.abs(p.x - r) < 1e-6).map((p) => p.y);
      if (retos.length < 2) return;
      y0 = Math.min(...retos); y1 = Math.max(...retos);
      pri = PRIORIDADE[m.name] ?? 1.5;
    } else if (g.type === 'CylinderGeometry') {
      const p = g.parameters;
      if (Math.abs(p.radiusTop - p.radiusBottom) > 1e-6) return;
      r = p.radiusTop;
      y0 = -p.height / 2; y1 = p.height / 2;
      theta0 = p.thetaStart; theta1 = p.thetaStart + p.thetaLength;
    } else return;
    if (r < 0.14 || y1 - y0 < 0.6) return;
    const s = new THREE.Vector3();
    m.getWorldScale(s);
    const vol = r * r * (y1 - y0) * s.x * s.y * s.z;
    if (!melhor || pri > melhor.pri || (pri === melhor.pri && vol > melhor.vol)) {
      melhor = { malha: m, r, y0, y1, theta0, theta1, pri, vol };
    }
  });
  return melhor;
}

export function pintarTags({ todos, obstaculos = [] }) {
  const caixas = Object.fromEntries(Object.entries(todos).map(([t, e]) => [t, new THREE.Box3().setFromObject(e.grupo)]));
  const ray = new THREE.Raycaster();
  const feitas = [];
  const pulados = [];

  for (const [tag, e] of Object.entries(todos)) {
    if (/^bomba/.test(EXTRAS[tag]?.tipo ?? '')) continue;
    const excluir = new Set([e.girante].filter(Boolean));         // o tambor do filtro gira
    const sup = superficie(e.grupo, excluir);
    if (!sup) { pulados.push({ tag, motivo: 'sem superfície cilíndrica' }); continue; }
    const m = sup.malha;
    m.updateWorldMatrix(true, false);
    const escala = new THREE.Vector3();
    m.getWorldScale(escala);
    const R = sup.r * escala.x;
    const L = (sup.y1 - sup.y0) * escala.y;
    const eixoW = V(0, 1, 0).transformDirection(m.matrixWorld);
    const deitado = Math.abs(eixoW.y) < 0.5;
    const cor = m.material.color ?? new THREE.Color(0xcccccc);
    // para fora: do centro da laje ate o equipamento, no plano
    const c = caixas[tag].getCenter(V(0, 0, 0));
    const FORA = V(c.x - CENTRO.x, 0, c.z - CENTRO.z).normalize();
    const escuro = (0.299 * cor.r + 0.587 * cor.g + 0.114 * cor.b) < 0.3;

    // altura da letra pelo raio; o texto nao passa de ~95° de arco (de pe)
    // nem de 70 % do comprimento (deitado)
    let h = THREE.MathUtils.clamp(R * (deitado ? 0.4 : 0.35), 0.16, 0.55);
    const asp = 0.62 * tag.length + 0.3;           // largura / altura do texto, aproximado
    if (!deitado) h = Math.min(h, (1.65 * R) / (1.3 * asp));
    else h = Math.min(h, (0.7 * L) / (1.3 * asp));

    // obstaculos perto: as malhas do proprio equipamento e da vizinhanca
    const perto = new THREE.Box3().setFromObject(e.grupo).expandByScalar(3);
    const alvos = [];
    const juntar = (raiz) => raiz.traverse((o) => {
      // transparente tambem conta: a camisa translucida do cristalizador
      // cobriria a tinta (o liquido fica por dentro, o raio para antes dele)
      if (!o.isMesh || !o.visible || o === m || o.name === 'tag-pintada') return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (b.intersectsBox(perto)) alvos.push(o);
    });
    for (const g of [e.grupo, ...obstaculos]) juntar(g);

    // Busca a face livre; sem nenhuma, tenta letra menor (75 % e 55 %) antes
    // de desistir — uma TAG menor num vaso cheio de bocal ainda e melhor que
    // nenhuma.
    let melhor = null;
    const h0 = h;
    for (const fator of [1, 0.75, 0.55]) {
      h = h0 * fator;
      melhor = buscar();
      if (melhor) break;
    }

    function buscar() {
      // posicoes ao longo do eixo, da preferida (um terco da altura de pe, o
      // meio deitado) para as outras, em passos de meia letra
      const hl = h / Math.max(escala.y, 1e-6);
      const pref = deitado ? 0.5 : 0.33;
      const ys = [];
      for (let y = sup.y0 + hl; y <= sup.y1 - hl + 1e-6; y += hl * 0.5) ys.push(y);
      ys.sort((a, b) => Math.abs((a - sup.y0) / (sup.y1 - sup.y0) - pref) - Math.abs((b - sup.y0) / (sup.y1 - sup.y0) - pref));
      let achado = null;
      for (const yLoc of ys) {
        for (let k = 0; k < 12; k++) {
          const az = (k / 12) * Math.PI * 2;
          // cuba aberta: so o arco que existe (o intervalo pode comecar negativo)
          const dentroArco = [az, az - Math.PI * 2].some((a) => a > sup.theta0 + 0.3 && a < sup.theta1 - 0.3);
          if (!dentroArco) continue;
          const nW = V(Math.sin(az), 0, Math.cos(az)).transformDirection(m.matrixWorld);
          if (deitado && Math.abs(nW.y) > 0.6) continue;
          const pW = m.localToWorld(V(sup.r * Math.sin(az), yLoc, sup.r * Math.cos(az)));
          // cinco pontos do texto: meio, as duas pontas, o alto e o pe da letra
          const meia = (h * asp * 0.5) / Math.max(escala.x, 1e-6);
          const meiaH = hl * 0.55;
          const em = (ds, dv) => {
            if (deitado) {
              const a = az + dv / sup.r;
              return m.localToWorld(V(sup.r * Math.sin(a), yLoc + ds, sup.r * Math.cos(a)));
            }
            const a = az + ds / sup.r;
            return m.localToWorld(V(sup.r * Math.sin(a), yLoc + dv, sup.r * Math.cos(a)));
          };
          const pontos = [em(0, 0), em(-meia, 0), em(meia, 0), em(0, meiaH), em(0, -meiaH)];
          let coberto = false;
          for (const p of pontos) {
            ray.set(p.clone().addScaledVector(nW, 4), nW.clone().negate());
            ray.far = 3.98;
            if (ray.intersectObjects(alvos, false).length) { coberto = true; break; }
          }
          if (coberto) continue;
          // espaco livre a frente, contra os outros equipamentos
          let livre = 12;
          for (let d = 0.5; d <= 12; d += 0.5) {
            const q = pW.clone().addScaledVector(nW, d);
            if (Object.entries(caixas).some(([t, c]) => t !== tag && c.containsPoint(q))) { livre = d; break; }
          }
          // para fora pesa mais que o espaco: so perde se a face de fora
          // estiver tomada
          const nota = Math.min(livre, 6) + 8 * nW.dot(FORA);
          if (!achado || nota > achado.nota) achado = { nota, az, yLoc, nW };
        }
        if (achado) break;
      }
      return achado;
    }
    if (!melhor) { pulados.push({ tag, motivo: 'toda face tem algo na frente', malha: m.name || m.geometry.type }); continue; }

    let tinta;
    if (!deitado) {
      tinta = criarTagPintada({ texto: tag, raio: sup.r, altura: h / escala.y, azimute: melhor.az, y: melhor.yLoc, escuro });
    } else {
      // o texto le da esquerda para a direita de quem olha a face; a letra
      // fica de pe para o lado de cima do mundo
      const direita = new THREE.Vector3().crossVectors(V(0, 1, 0), melhor.nW).normalize();
      const sentido = eixoW.dot(direita) >= 0 ? 1 : -1;
      const tg = V(Math.cos(melhor.az), 0, -Math.sin(melhor.az)).transformDirection(m.matrixWorld);
      const cima = tg.y >= 0 ? 1 : -1;
      tinta = criarTagPintadaDeitada({ texto: tag, raio: sup.r, altura: h / escala.x, azimute: melhor.az, y: melhor.yLoc, sentido, cima, escuro });
    }
    m.add(tinta.malha);
    // a etiqueta flutuante so aparece de onde a tinta ja nao se le
    e.grupo.traverse((o) => {
      if (o.isCSS2DObject && o.userData.rotulo?.tipo === 'tag-label') {
        o.userData.rotulo.pintado = THREE.MathUtils.clamp(h * 45, 10, 25);
      }
    });
    feitas.push({ tag, altura: +h.toFixed(2), deitado, livre: +melhor.nota.toFixed(1) });
  }
  return { feitas, pulados };
}
