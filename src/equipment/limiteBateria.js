import * as THREE from 'three';
import { LIMITES, BLOQUEIO_LIMITE, DESTINOS } from '../data/rotas.js';
import { BLOCOS } from '../data/site.js';
import { corredoresDaLaje } from '../data/arranjo.js';
import { criarValvulaGaveta, criarRaquete, orientar } from '../lib/valvula.js';
import { criarPlataformaRetangular, criarEscada } from '../lib/supports.js';

/**
 * ===========================================================================
 *  BLOQUEIO NO LIMITE DE BATERIA  (Fase 18, pendencia O)
 * ===========================================================================
 *  Composicao: le as pontas das linhas no limite de bateria (tubulacao.js,
 *  `limites`) e poe em cada uma a gaveta de bloqueio e a raquete; depois,
 *  uma plataforma por nivel do rack em cada lado, ao lado do feixe (+z, onde
 *  o rack tem folga), entre os dois porticos mais perto, na altura em que os
 *  volantes ficam ao alcance. A plataforma mais baixa sobe por escada de
 *  marinheiro do piso; a de cima, da de baixo.
 *  Mede e devolve como achado (`BLOQUEIO_ALCANCE`) o volante fora do
 *  alcance: de 0,8 a 1,7 m acima do piso da plataforma e a ate 1,2 m da
 *  borda dela.
 */
const B = BLOQUEIO_LIMITE;
const CIMA = new THREE.Vector3(0, 1, 0);
const f2 = (v) => v.toFixed(2).replace('.', ',');

export function criarBloqueioLimite({ tubulacao }) {
  const grupo = new THREE.Group();
  grupo.name = 'bloqueio-limite';
  const achados = [];
  const isbl = BLOCOS.find((b) => b.id === 'ISBL');
  const xs = tubulacao.rack.xs;
  const perimetro = corredoresDaLaje().filter((c) => c.tipo === 'perimetro');

  for (const lado of ['oeste', 'leste']) {
    const linhas = tubulacao.limites.filter((l) => l.lado === lado);
    if (!linhas.length) continue;
    const dir = new THREE.Vector3(...LIMITES[lado].dir);        // para dentro da unidade
    const niveis = new Map();
    for (const l of linhas) {
      const ficha = {
        titulo: `Bloqueio da linha ${l.id}`, subtitulo: `Limite de bateria ${lado} → ${DESTINOS[l.id] ?? ''}`,
        grupos: [{ nome: 'Pendência O (adotado)', dados: {
          'Válvula': `Gaveta DN ${l.dn}, classe 150, haste ascendente`,
          'Raquete': 'Figura 8 entre a válvula e a flange do limite: virada, isola a unidade',
          'Por quê': 'Toda linha que cruza o limite de bateria tem bloqueio — pedido do professor (27/10)',
        } }],
      };
      const v = criarValvulaGaveta({ dn: l.dn });
      const c = l.pos.clone().addScaledVector(dir, B.recuo);
      orientar(v.grupo, c, dir, CIMA);
      v.grupo.userData.ficha = ficha;
      grupo.add(v.grupo);
      const r = criarRaquete({ dn: l.dn });
      orientar(r.grupo, l.pos.clone().addScaledVector(dir, B.raquete), dir, CIMA);
      r.grupo.userData.ficha = ficha;
      grupo.add(r.grupo);
      const nivel = Math.round(l.pos.y);
      if (!niveis.has(nivel)) niveis.set(nivel, []);
      niveis.get(nivel).push({ l, volante: c.clone().setY(c.y + v.alturaVolante) });
    }

    // a plataforma fica entre os dois porticos que cercam as valvulas e
    // dentro do limite de bateria (fora dele e acostamento e via)
    const xv = linhas[0].pos.x + dir.x * B.recuo;
    const antes = Math.max(...xs.filter((x) => x < xv)), depois = Math.min(...xs.filter((x) => x > xv));
    const x0 = Math.max(antes + 0.2, isbl.x[0] + 0.1, xv - B.comprimento / 2);
    const x1 = Math.min(depois - 0.2, isbl.x[1] - 0.1, xv + B.comprimento / 2);
    // as colunas ficam fora do corredor de perimetro da laje, que corre ao
    // longo do limite; o piso passa em balanco sobre ele (bem acima de 2,1 m)
    const corr = perimetro.find((c) => c.x0 < x1 && c.x1 > x0 && c.z0 < 3 && c.z1 > 3);
    // 0,2 m: meia sapata (0,175) e folga
    const xc0 = corr && corr.x0 < x0 + 0.1 ? Math.max(x0 + 0.06, corr.x1 + 0.2) : x0 + 0.06;
    const xc1 = corr && corr.x1 > x1 - 0.1 ? Math.min(x1 - 0.06, corr.x0 - 0.2) : x1 - 0.06;

    const decks = [];
    for (const [, vs] of [...niveis].sort((a, b) => a[0] - b[0])) {
      const ys = vs.map((q) => q.volante.y);
      const y = (Math.max(...ys) + Math.min(...ys)) / 2 - B.alturaVolante;
      const z0 = Math.max(...vs.map((q) => q.l.pos.z + q.l.od / 2)) + B.folgaLinha;
      decks.push({ y, z0, z1: z0 + B.largura, vs });
    }
    decks.forEach((d, i) => {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      // a escada na ponta de dentro (longe do limite e do corredor de perimetro)
      const escadaX = dir.x < 0 ? -w / 2 + 0.3 : w / 2 - 0.3;
      // A de baixo sobe do piso pela ponta de dentro, no meio do piso dela:
      // na borda +z ficam os pilares e o contraventamento da lateral do rack.
      // A de cima sobe da de baixo, pela borda +z dela.
      const ladoDentro = dir.x < 0 ? '-x' : '+x';
      const vao = i ? { lado: '+z', u: escadaX } : { lado: ladoDentro, u: 0 };
      // a de cima tem colunas so na borda de fora (+z): a de dentro fica sobre
      // o corredor de manutencao que passa sob o rack (nada nele abaixo de 2,1 m)
      const p = criarPlataformaRetangular({
        w, d: d.z1 - d.z0, y: d.y, vao, colunas: i ? '+z' : 'cantos',
        xColunas: [xc0 - cx, xc1 - cx],
      });
      p.grupo.position.set(cx, 0, (d.z0 + d.z1) / 2);
      p.grupo.userData.ficha = {
        titulo: `Plataforma do limite de bateria ${lado}`, subtitulo: `Nível ${f2(d.y)} m`,
        grupos: [{ nome: 'Adotado', dados: {
          'Opera': d.vs.map((q) => `linha ${q.l.id}`).join(', '),
          'Volantes': `de ${f2(Math.min(...d.vs.map((q) => q.volante.y)) - d.y)} a ${f2(Math.max(...d.vs.map((q) => q.volante.y)) - d.y)} m acima do piso`,
          'Acesso': i ? 'Escada de marinheiro a partir da plataforma de baixo' : 'Escada de marinheiro com gaiola, do piso',
        } }],
      };
      grupo.add(p.grupo);
      const yBase = i ? decks[i - 1].y : 0;
      const e = criarEscada({ yBase, yTopo: d.y, raio: 0, angulo: i ? 90 : (dir.x < 0 ? 180 : 0), largura: 0.5 });
      if (i) e.position.set(cx + escadaX, 0, decks[i - 1].z0 + 0.2);
      else e.position.set(dir.x < 0 ? x0 - 0.15 : x1 + 0.15, 0, (d.z0 + d.z1) / 2);
      grupo.add(e);
      for (const q of d.vs) {
        const h = q.volante.y - d.y, dz = Math.max(0, d.z0 - q.volante.z);
        if (h < 0.8 || h > 1.7 || dz > 1.2) {
          achados.push({ regra: 'BLOQUEIO_ALCANCE', onde: `linha ${q.l.id} (${lado})`, detalhe: `volante a ${f2(h)} m do piso e ${f2(dz)} m da borda` });
        }
      }
    });
  }
  return { grupo, achados };
}
