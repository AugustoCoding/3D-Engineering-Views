import * as THREE from 'three';
import { tuboPorCaminho } from '../lib/pipe.js';
import { criarPSV, orientar } from '../lib/valvula.js';
import { criarChapeu } from '../lib/pontas.js';
import { orientarPara } from '../lib/nozzle.js';
import { rotulo } from '../lib/dimensions.js';
import { ancoraMundo, matCodigo } from './tubulacao.js';
import { DN, EQUIPAMENTOS } from '../data/plant.js';
import { ARRANJO, VENT } from '../data/arranjo.js';
import { VAO_ADMISSIVEL, RISER_LIVRE } from '../data/rotas.js';
import { PSVS, ALIVIO } from '../data/instrumentos.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  ALIVIO DE PRESSAO  (Fase 8)
 * ===========================================================================
 *  As valvulas de seguranca que o Datasheet preve nos vasos de 15 bar (R-01
 *  N5, V-01 N4) e o tubo de descarga de cada uma. Composicao: a valvula senta
 *  na face do bocal, a saida aponta para fora do vaso, e o tubo sobe ate a
 *  cota que a regra pede — medida contra as plataformas em volta, como a do
 *  vent. A ponta de cada descarga vira fonte de zona classificada na camada
 *  de seguranca.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f1 = (v) => v.toFixed(1).replace('.', ',');

/** Plataformas (cota do piso, posicao) — a mesma conta da auditoria do arranjo. */
function plataformas() {
  const out = [];
  for (const [tag, eq] of Object.entries(EQUIPAMENTOS)) {
    const pl = eq.geom.plataforma;
    const pos = ARRANJO.find((a) => a.tag === tag);
    if (pl && pos) out.push({ tag, x: pos.x, z: pos.z, cota: eq.geom.saiaAltura + pl.elevacao });
  }
  return out;
}

export function criarAlivio({ todos, tubulacao }) {
  const grupo = new THREE.Group();
  grupo.name = 'alivio';
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  grupo.add(rotulos);
  const achados = [];
  const achar = (regra, peca, detalhe, p) => achados.push({
    regra, tag: '—', peca, detalhe, ponto: p ? [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] : null,
  });
  const pontas = [];
  const pls = plataformas();
  const mat = matCodigo('MRV');

  for (const psv of PSVS) {
    const A = ancoraMundo(todos, psv.bocal);
    if (!A) { achar('PSV_SEM_BOCAL', psv.tag, `bocal ${psv.bocal} não existe`); continue; }
    const c = todos[psv.vaso].grupo.getWorldPosition(V(0, 0, 0));
    const fora = V(A.pos.x - c.x, 0, A.pos.z - c.z);
    if (fora.length() < 1e-3) fora.set(1, 0, 0);
    fora.normalize();

    // valvula sentada na face do bocal, saida para fora do vaso
    const p = criarPSV({ dnEntrada: A.dn, dnSaida: psv.dnSaida });
    orientar(p.grupo, A.pos, fora, A.dir);
    p.grupo.updateMatrixWorld(true);
    const s0 = p.grupo.localToWorld(V(...p.saida.pos));

    // descarga: sai na horizontal, curva e sobe ate a cota da regra
    const s1 = s0.clone().addScaledVector(fora, 0.45);
    const perto = pls.filter((q) => Math.hypot(q.x - s1.x, q.z - s1.z) <= VENT.raio);
    const yPlat = perto.length ? Math.max(...perto.map((q) => q.cota)) : -Infinity;
    const H = Math.max(s0.y + ALIVIO.acimaDaValvula, yPlat + VENT.folga);
    const s2 = V(s1.x, H, s1.z);
    const tubo = tuboPorCaminho([s0, s1, s2], { dn: psv.dnSaida, mat });
    const chapeu = criarChapeu({ dn: psv.dnSaida });
    orientarPara(chapeu, s2, V(0, 1, 0));

    const ficha = {
      titulo: psv.tag, subtitulo: `Válvula de segurança do ${psv.vaso}`,
      grupos: [
        { nome: 'Datasheet', dados: { 'Bocal': `${psv.bocal} — DN ${A.dn}`, 'Serviço': 'Alívio de pressão' } },
        { nome: 'Proposta da maquete (estimado)', dados: {
          'Pressão de ajuste': `${f1(psv.ajuste)} bar — a de projeto (ASME VIII, UG-134)`,
          'Corpo': `${psv.corpo}: entrada DN ${A.dn}, saída DN ${psv.dnSaida}`,
          'Descarga': `Atmosfera, a ${f1(H)} m${perto.length ? ` (plataforma do ${perto.map((q) => q.tag).join(', ')} a ${f1(yPlat)} m + ${f1(VENT.folga)} m)` : ''}`,
          'Cenário de alívio': 'Não calculado — pendência N (fogo, saída bloqueada, reação fora de controle)',
        } },
      ],
    };
    p.grupo.userData.ficha = ficha;
    tubo.userData.ficha = ficha;
    tubo.name = `descarga-${psv.tag}`;
    grupo.add(p.grupo, tubo, chapeu);
    const lbl = rotulo(psv.tag, 'bocal-label');
    lbl.position.copy(s0).add(V(0, 0.5, 0));
    rotulos.add(lbl);
    pontas.push({ id: psv.tag, destino: 'Descarga de válvula de segurança', pos: s2.clone() });

    // tubo de descarga alto: guiado a cada 3 m num tubo vertical vizinho
    const subida = H - s1.y;
    const od = DN[psv.dnSaida].od;
    if (subida > RISER_LIVRE * (VAO_ADMISSIVEL[psv.dnSaida] ?? 3)) {
      let guia = null;
      for (const t of tubulacao.tubos) {
        for (let i = 1; i < t.pts.length && !guia; i++) {
          const a = t.pts[i - 1], b = t.pts[i];
          if (Math.hypot(a.x - b.x, a.z - b.z) > 1e-3) continue;          // so trecho vertical
          const d = Math.hypot(a.x - s1.x, a.z - s1.z);
          if (d > ALIVIO.alcanceGuia || Math.min(a.y, b.y) > s1.y + 1 || Math.max(a.y, b.y) < H - 1) continue;
          guia = { x: a.x, z: a.z, d, r: t.r, id: t.id };
        }
        if (guia) break;
      }
      if (!guia) achar('RISER_SEM_GUIA', psv.tag, `descarga sobe ${f1(subida)} m sem tubo vizinho para guiar`, s1);
      else {
        for (let y = s1.y + ALIVIO.guia; y < H - 0.3; y += ALIVIO.guia) {
          const a = V(s1.x, y, s1.z), b = V(guia.x, y, guia.z);
          const dd = new THREE.Vector3().subVectors(b, a);
          const barra = new THREE.Mesh(new THREE.BoxGeometry(0.05, dd.length(), 0.05), MAT.acoCarbono);
          barra.position.copy(a).addScaledVector(dd, 0.5);
          barra.quaternion.setFromUnitVectors(V(0, 1, 0), dd.normalize());
          grupo.add(barra);
        }
        tubo.userData.ficha.grupos[1].dados['Suporte'] = `Guiado a cada ${f1(ALIVIO.guia)} m no ${guia.id.replace('aberta-', 'vent ')}`;
      }
    }

    // choque da descarga com a tubulacao ja tracada
    const amostras = [];
    for (const [a, b] of [[s0, s1], [s1, s2]]) {
      const n = Math.max(2, Math.ceil(a.distanceTo(b) / 0.2));
      for (let k = 1; k < n; k++) amostras.push(a.clone().lerp(b, k / n));
    }
    for (const t of tubulacao.tubos) {
      let bateu = null;
      for (const q of amostras) {
        for (let i = 1; i < t.pts.length && !bateu; i++) {
          const a = t.pts[i - 1], b = t.pts[i];
          const ab = new THREE.Vector3().subVectors(b, a);
          const u = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(q, a).dot(ab) / Math.max(ab.lengthSq(), 1e-12), 0, 1);
          if (q.distanceTo(a.clone().addScaledVector(ab, u)) < od / 2 + t.r + 0.01) bateu = q;
        }
        if (bateu) break;
      }
      if (bateu) achar('PECA_x_TUBO', psv.tag, `descarga encosta em ${t.id}`, bateu);
    }
  }
  return { grupo, rotulos, achados, pontas };
}
