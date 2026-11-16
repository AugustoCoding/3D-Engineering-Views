import * as THREE from 'three';
import { criarNaColuna, criarNoGuardaCorpo, criarMastro } from '../lib/luminaria.js';
import { PERFIL_COLUNA, ALTURA_VIGA } from '../lib/rack.js';
import { LUZ_LAJE, GUINDASTE } from '../data/arranjo.js';
import { LAJE_PROPOSTA } from '../data/arranjo-proposto.js';
import { Y } from '../lib/terreno.js';

/**
 * ===========================================================================
 *  ILUMINACAO DA LAJE  (Fase 26, parte da sessao local)
 * ===========================================================================
 *  Onde vai cada luminaria da area de processo, por regra (LUZ_LAJE):
 *    - uma em cada coluna de cada portico do rack, voltada para dentro;
 *    - nos montantes do guarda-corpo de toda plataforma (dos equipamentos
 *      e do bloqueio no limite de bateria): na chegada de cada escada e a
 *      cada `passo` m;
 *    - dois mastros de projetores, nos pontos livres mais afastados da
 *      volta da laje.
 *  Fora da laje e da sessao da nuvem (data/iluminacao.js). A medida de lux
 *  e a mesma para as duas (__auditarIluminacao()).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function criarIluminacaoLaje({ rack, raizes, obstaculos, cena }) {
  const grupo = new THREE.Group();
  grupo.name = 'iluminacao-laje';
  const L = LUZ_LAJE;
  const luminarias = [];
  const resumo = { rack: 0, plataforma: 0, projetores: 0 };

  /* ---------------------------------------------------- 1. pipe rack */
  const meio = rack.largura / 2;
  const yViga = rack.niveis[0] - ALTURA_VIGA;
  for (const x of rack.xs) {
    for (const s of [-1, 1]) {
      const { grupo: g, luminaria } = criarNaColuna({
        centro: V(x, L.rack.altura, rack.z + s * meio), n: V(0, 0, -s),
        lado: PERFIL_COLUNA, yViga, braco: L.rack.braco, luminaria: L.luminaria,
      });
      grupo.add(g);
      luminarias.push(luminaria);
      resumo.rack++;
    }
  }

  /* -------------------------------------------------- 2. plataformas */
  const raio = new THREE.Raycaster();
  const alvosRaio = cena ? cena.children.filter((c) => c !== grupo && c.visible) : [];
  const bate = (de, dir, ate) => {
    raio.set(de, dir);
    raio.far = ate;
    return raio.intersectObjects(alvosRaio, true).some((h) => h.object.visible);
  };
  // do alto do corrimao ao topo do poste, e o braco para dentro
  const livreAcima = (m) => {
    const eixo = m.p.clone().addScaledVector(m.fora, m.r + 0.024);
    const h = L.plataforma.altura;
    return !bate(eixo.clone().add(V(0, 1.2, 0)), V(0, 1, 0), h - 1.2 + 0.15)
      && !bate(eixo.clone().add(V(0, h - 0.02, 0)), m.fora.clone().negate(), L.plataforma.braco + 0.15);
  };
  // os montantes que cada plataforma registrou (lib/supports.js), no mundo
  const plataformas = [];
  for (const r of raizes) {
    r.updateMatrixWorld(true);
    r.traverse((o) => { if (o.userData?.montantes?.length) plataformas.push(o); });
  }
  for (const pl of plataformas) {
    const anel = pl.userData.anel;
    // so montante com caminho livre para o poste subir e o braco entrar:
    // a plataforma do limite leste tem outra logo acima, e o poste de 2,6 m
    // furava o piso dela
    const ms = pl.userData.montantes.map((m) => {
      const fora = m.fora.clone().transformDirection(pl.matrixWorld).setY(0).normalize();
      return { ...m, a: Math.atan2(m.p.z, m.p.x), p: m.p.clone().applyMatrix4(pl.matrixWorld), fora };
    }).filter((m) => livreAcima(m));
    if (!ms.length) continue;
    // distancia ao longo do guarda-corpo: no anel, pelo arco (a corda do
    // R-01 nunca passa de 6 m e ficavam so as duas da escada)
    const ao = (m, e) => (anel
      ? anel * Math.abs(THREE.MathUtils.euclideanModulo(m.a - e.a + Math.PI, 2 * Math.PI) - Math.PI)
      : e.p.distanceTo(m.p));
    // a chegada de cada escada primeiro (um montante por vao); depois,
    // enquanto algum montante ficar a mais de meio passo da luminaria mais
    // perto, uma no mais longe — vao entre luminarias <= `passo`
    const escolhidos = [];
    const perto = (m) => Math.min(...escolhidos.map((e) => ao(m, e)));
    for (const m of ms.filter((q) => q.vao)) if (!escolhidos.length || perto(m) >= 1.5) escolhidos.push(m);
    if (!escolhidos.length) escolhidos.push(ms[0]);
    for (;;) {
      const pior = ms.reduce((a, m) => (perto(m) > perto(a) ? m : a), ms[0]);
      if (perto(pior) <= L.plataforma.passo / 2) break;
      escolhidos.push(pior);
    }
    for (const m of escolhidos) {
      const { grupo: g, luminaria } = criarNoGuardaCorpo({
        p: m.p, fora: m.fora, rMontante: m.r, altura: L.plataforma.altura, braco: L.plataforma.braco, luminaria: L.luminaria,
      });
      grupo.add(g);
      luminarias.push(luminaria);
      resumo.plataforma++;
    }
  }

  /* ------------------------------------------------------- 3. mastros */
  // pegada do que esta em volta da laje (pipeway, seguranca), em planta
  const caixas = [];
  const b = new THREE.Box3();
  for (const o of obstaculos) {
    o.updateMatrixWorld(true);
    // so o que se ve: as zonas e cotas da camada de seguranca, ocultas,
    // cobririam a volta inteira da laje
    o.traverseVisible((m) => {
      if (!m.isMesh) return;
      b.setFromObject(m);
      if (b.max.y < 0.05 || b.min.y > L.mastro.altura) return;
      caixas.push({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z });
    });
  }
  const f = L.mastro.folga;
  const livre = (x, z) => !caixas.some((c) => x > c.x0 - f && x < c.x1 + f && z > c.z0 - f && z < c.z1 + f)
    && !(x > GUINDASTE.x[0] - f && x < GUINDASTE.x[1] + f && z > GUINDASTE.z[0] - f && z < GUINDASTE.z[1] + f);
  // a volta da laje, a `afastamento` m da mureta
  const a = L.mastro.afastamento;
  const [x0, x1] = [LAJE_PROPOSTA.x[0] - a, LAJE_PROPOSTA.x[1] + a];
  const [z0, z1] = [LAJE_PROPOSTA.z[0] - a, LAJE_PROPOSTA.z[1] + a];
  const volta = [];
  for (let x = x0; x <= x1 + 1e-6; x += L.mastro.passo) volta.push([x, z0], [x, z1]);
  for (let z = z0 + L.mastro.passo; z < z1 - 1e-6; z += L.mastro.passo) volta.push([x0, z], [x1, z]);
  const livres = volta.filter(([x, z]) => livre(x, z));
  let par = null, dMax = 0;
  for (let i = 0; i < livres.length; i++) {
    for (let j = i + 1; j < livres.length; j++) {
      const d = Math.hypot(livres[i][0] - livres[j][0], livres[i][1] - livres[j][1]);
      if (d > dMax) { dMax = d; par = [livres[i], livres[j]]; }
    }
  }
  const cx = (LAJE_PROPOSTA.x[0] + LAJE_PROPOSTA.x[1]) / 2, cz = (LAJE_PROPOSTA.z[0] + LAJE_PROPOSTA.z[1]) / 2;
  const mastros = [];
  for (const [x, z] of par ?? []) {
    // projetores no meio da laje e a 8 m para cada lado, perpendicular ao olhar
    const d = V(cx - x, 0, cz - z).normalize(), lado = V(-d.z, 0, d.x);
    const n = L.mastro.projetores;
    const alvos = Array.from({ length: n }, (_, i) => V(cx, 0, cz).addScaledVector(lado, (i - (n - 1) / 2) * 8));
    const m = criarMastro({ x, z, yChao: Y.lote, altura: L.mastro.altura, alvos, projetor: L.mastro.projetor });
    grupo.add(m.grupo);
    luminarias.push(...m.luminarias);
    resumo.projetores += m.luminarias.length;
    mastros.push([x, z]);
  }

  grupo.userData.ficha = {
    titulo: 'Iluminação da área de processo',
    subtitulo: 'Luminárias Ex na laje, no rack e nas plataformas',
    grupos: [{ nome: 'Adotado (Fase 26)', dados: {
      'No rack': `${resumo.rack} luminárias, uma por coluna`,
      'Nas plataformas': `${resumo.plataforma} luminárias`,
      'Mastros': `${mastros.length} de ${String(L.mastro.altura)} m, ${resumo.projetores} projetores`,
    } }],
  };
  return { grupo, luminarias, mastros, resumo };
}
