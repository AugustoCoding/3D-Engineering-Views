import * as THREE from 'three';
import { criarValvulaGlobo, criarValvulaTresVias, orientar } from '../lib/valvula.js';
import {
  criarTransmissor, criarPoco, criarRadar, criarPlacaOrificio, criarDensimetro, criarCapilar, criarCapilarAoLongo, criarTomada,
} from '../lib/instrumento.js';
import { orientarPara } from '../lib/nozzle.js';
import { rotulo } from '../lib/dimensions.js';
import { EQUIPAMENTOS } from '../data/plant.js';
import { EXTRAS } from '../data/plant-extra.js';
import { LINHAS, VALVULAS, MALHAS, BOMBAS } from '../data/pid.js';
import { ACESSO_MAX, VALVULA_PERTO, RETO_ORIFICIO, INSTRUMENTOS } from '../data/instrumentos.js';
import { ancoraMundo } from './tubulacao.js';

/**
 * ===========================================================================
 *  VALVULAS E INSTRUMENTOS DE CAMPO  (Fase 6)
 * ===========================================================================
 *
 *  Depois da tubulacao: as valvulas montam SOBRE as linhas ja tracadas e os
 *  instrumentos, sobre linhas e vasos. O que liga em que vem de pid.js
 *  (VALVULAS, MALHAS); onde fica, de data/instrumentos.js.
 *
 *    - Valvula num no da tubulacao (V-03b, V-08, V-14, V-15, V-16) toma a
 *      forma que as linhas lhe dao: duas portas em linha e globo; tres, com
 *      um par em linha, tres vias. Sem par em linha, o corpo nao fecha — e
 *      isso vira achado, nao valvula torta.
 *    - Valvula na linha: no trecho que a via do P&ID indica, num segmento
 *      reto e horizontal que a caiba longe das curvas, perto da ponta que a
 *      regra de campo pede, ao alcance do piso quando ha como.
 *    - Instrumento: o elemento de campo de cada malha; a ficha conta a malha
 *      inteira, ate o elemento final.
 *
 *  Mede e reclama: valvula sem lugar ou fora de alcance, placa de orificio
 *  sem trecho reto, atuador ou instrumento batendo em tubo ou equipamento, e
 *  a contagem contra o P&ID.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CIMA = V(0, 1, 0);
const f1 = (v) => v.toFixed(1).replace('.', ',');
const f2 = (v) => v.toFixed(2).replace('.', ',');

function distSegSeg(p1, q1, p2, q2) {
  const d1 = new THREE.Vector3().subVectors(q1, p1);
  const d2 = new THREE.Vector3().subVectors(q2, p2);
  const r = new THREE.Vector3().subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a < 1e-9 && e < 1e-9) return r.length();
  if (a < 1e-9) { s = 0; t = THREE.MathUtils.clamp(f / e, 0, 1); } else {
    const c = d1.dot(r);
    if (e < 1e-9) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else {
      const b = d1.dot(d2);
      const den = a * e - b * b;
      s = den > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}

export function criarInstrumentacao({ todos, tubulacao }) {
  const grupo = new THREE.Group();
  grupo.name = 'instrumentacao';
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  const achados = [];
  const achar = (regra, peca, detalhe, ponto) => achados.push({
    regra, tag: '—', peca, detalhe,
    ponto: ponto ? [+ponto.x.toFixed(2), +ponto.y.toFixed(2), +ponto.z.toFixed(2)] : null,
  });
  const { itens, nos, tubos } = tubulacao;
  const ocupado = new Map();             // trecho -> intervalos de arco ja usados
  const pecas = [];                      // envelopes para o teste de choque
  const contagem = { valvulas: 0, instrumentos: 0 };

  const malhaDe = (tag) => MALHAS.find((m) => m.atua === tag);
  const textoMalha = (m) => `${m.instrumentos.join(' → ')} → ${m.atua}`;
  const etiqueta = (texto, p) => {
    const l = rotulo(texto, 'bocal-label');
    l.position.copy(p);
    rotulos.add(l);
  };

  /* ======================================================================
   *  Onde cabe uma peca numa linha
   * =================================================================== */
  /* Vaso vertical ocupa o cilindro dele do piso ao topo — saia ou pernas
   * incluidas. A linha 11 sai do fundo do R-01 por dentro da saia: a V-02 e
   * o densimetro foram parar ali, "perto da origem", onde ninguem os alcanca;
   * o raio do atuador nao pegava porque cabia sob o tampo. */
  const vasos = Object.entries(todos).map(([tag, e]) => {
    const g = EQUIPAMENTOS[tag]?.geom ?? EXTRAS[tag]?.geom;
    const vertical = EQUIPAMENTOS[tag] ? !!g.saiaAltura || !!g.elevacao : EXTRAS[tag]?.tipo === 'vaso-vertical';
    if (!g?.Di || !vertical) return null;
    const c = e.grupo.getWorldPosition(new THREE.Vector3());
    const topo = new THREE.Box3().setFromObject(e.grupo).max.y;
    return { c, r: g.Di / 2 + (g.isolamento ?? 0) + (g.camisa ? g.camisa.folga : 0) + 0.15, topo };
  }).filter(Boolean);
  const dentroDeVaso = (p, folga = 0) => vasos.some((v) => p.y < v.topo
    && Math.hypot(p.x - v.c.x, p.z - v.c.z) < v.r + folga);
  function retos(it, { vertical = false } = {}) {
    const segs = [];
    let s = 0;
    for (let i = 1; i < it.pts.length; i++) {
      const a = it.pts[i - 1], b = it.pts[i];
      const L = a.distanceTo(b);
      // Tomada radial (PT, poco) tambem vai em trecho vertical.
      if (vertical && L > 0.05 && Math.abs(b.y - a.y) > 0.99 * L) {
        segs.push({ a, L, s0: s, dir: b.clone().sub(a).normalize(), vertical: true });
        s += L;
        continue;
      }
      // Ate 3 % de inclinacao ainda e "horizontal": as linhas de suspensao
      // (20, 25) descem a 2 % e precisam do termometro delas.
      const horiz = Math.abs(a.y - b.y) <= 0.03 * L;
      const noRack = it.faixa && Math.abs(a.y - it.faixa.y) < 1e-6 && Math.abs(b.y - it.faixa.y) < 1e-6;
      if (horiz && L > 0.05 && !noRack) segs.push({ a, L, s0: s, dir: b.clone().sub(a).normalize() });
      s += L;
    }
    return { segs, total: s };
  }

  /**
   * Segmento reto e horizontal de `it` que caiba `comp`, longe das curvas e
   * de pecas ja postas; prefere o alcancavel do piso e, entre eles, o mais
   * perto da ponta `perto`. `antes`/`depois`: reto livre exigido em metros,
   * no sentido do escoamento (a rota vai da origem ao destino).
   */
  function lugar(it, comp, perto, { antes = 0, depois = 0, vertical = false } = {}) {
    const { segs, total } = retos(it, { vertical });
    const curva = 1.5 * it.od + 0.05;
    const usados = ocupado.get(it.id) ?? [];
    let melhor = null;
    for (const g of segs) {
      const ini = curva + antes + comp / 2;
      const fim = g.L - curva - depois - comp / 2;
      for (let u = ini; u <= fim + 1e-9; u += 0.05) {
        const s = g.s0 + u;
        if (usados.some(([a, b]) => s + comp / 2 + 0.3 > a && s - comp / 2 - 0.3 < b)) continue;
        const p = g.a.clone().addScaledVector(g.dir, u);
        if (dentroDeVaso(p, comp / 2)) continue;
        const c = { p, dir: g.dir, s, alcance: p.y <= ACESSO_MAX, d: perto === 'B' ? total - s : s, vertical: !!g.vertical };
        if (!melhor || (c.alcance && !melhor.alcance) || (c.alcance === melhor.alcance && c.d < melhor.d)) melhor = c;
      }
    }
    if (melhor) ocupado.set(it.id, [...usados, [melhor.s - comp / 2, melhor.s + comp / 2]]);
    return melhor;
  }

  /* O corpo da valvula que mora num no ocupa a ponta dos trechos que chegam
   * a ele: nada se monta ali. */
  const naNo = new Set(VALVULAS.map((v) => v.tag).filter((t) => nos[t]));
  for (const it of itens) {
    const total = retos(it).total;
    const r = [];
    if (it.A.tipo === 'no' && naNo.has(it.A.no)) r.push([0, 0.35]);
    if (it.B.tipo === 'no' && naNo.has(it.B.no)) r.push([total - 0.35, total]);
    if (r.length) ocupado.set(it.id, r);
  }

  const maiorReto = (it) => Math.max(0, ...retos(it).segs.filter((g) => g.a.y <= ACESSO_MAX).map((g) => g.L));

  /** Trecho de uma linha: pela origem `de`, pela posicao na via, ou o mais reto. */
  function trechoDe(numero, { de, tag } = {}) {
    const daLinha = itens.filter((i) => i.numero === numero);
    if (!daLinha.length) return null;
    if (de) return daLinha.find((i) => i.A.tag === de || i.A.no === de) ?? null;
    const L = LINHAS.find((l) => l.numero === numero);
    if (tag && L?.via?.includes(tag)) {
      const k = L.via.indexOf(tag);
      const fronteira = L.via.slice(0, k).reverse()
        .find((v) => BOMBAS.some((b) => b.tag === v) || nos[v]);
      if (fronteira) return daLinha.find((i) => i.A.tag === fronteira || i.A.no === fronteira) ?? daLinha[0];
      return daLinha.find((i) => i.A.tag === L.de) ?? daLinha[0];
    }
    return [...daLinha].sort((p, q) => maiorReto(q) - maiorReto(p))[0];
  }

  /* ======================================================================
   *  Valvulas
   * =================================================================== */
  function fichaValvula(v, m, extra) {
    return {
      titulo: v.tag,
      subtitulo: v.funcao,
      grupos: [{
        nome: 'Válvula de controle',
        dados: {
          'Malha': m ? textoMalha(m) : 'sem malha no P&ID',
          'Ação do controlador': m?.modo ?? '—',
          'Linha': v.linha,
          ...extra,
          ...(v.obs ? { 'Observação': v.obs } : {}),
        },
      }],
    };
  }

  function montar(v, obj, centro, haste, itensDela, extra) {
    const m = malhaDe(v.tag);
    if (centro.y > ACESSO_MAX && !extra['Altura do eixo']) {
      achar('VALVULA_INACESSIVEL', v.tag, `eixo a ${f1(centro.y)} m do piso (máx. ${f1(ACESSO_MAX)} m sem plataforma)`, centro);
    }
    obj.grupo.userData.ficha = fichaValvula(v, m, extra);
    obj.grupo.name = `valvula-${v.tag}`;
    grupo.add(obj.grupo);
    const topo = centro.clone().addScaledVector(haste, obj.altura);
    etiqueta(v.tag, topo.clone().add(V(0, 0.25, 0)));
    pecas.push({ tag: v.tag, a: centro.clone().addScaledVector(haste, 0.12), b: topo, r: obj.raioAtuador, itens: itensDela });
    contagem.valvulas++;
  }

  function bateEquipamento(p, dir, comp) {
    const ray = new THREE.Raycaster(p.clone().addScaledVector(dir, 0.1), dir, 0, comp);
    return ray.intersectObjects(Object.values(todos).map((e) => e.grupo), true).length > 0;
  }

  function valvulaNoNo(v, no) {
    const faces = no.faces.map((f) => f.dir);
    const dn = Math.max(...no.dns);
    const itensDela = no.faces.map((f) => f.item);
    if (faces.length === 2 && faces[0].dot(faces[1]) < -0.99) {
      const eixo = faces[0].clone();
      const haste = Math.abs(eixo.y) < 0.5 ? CIMA.clone() : V(0, 0, 1);
      const obj = criarValvulaGlobo({ dn });
      orientar(obj.grupo, no.pos, eixo, haste);
      montar(v, obj, no.pos, haste, itensDela, {
        'Tipo (estimado)': 'Globo com atuador pneumático de diafragma',
        'Diâmetro': `DN ${dn}`,
        'Face a face (estimado)': `${f2(obj.comprimento)} m`,
      });
      return;
    }
    if (faces.length === 3) {
      let par = null;
      for (let i = 0; i < 3 && !par; i++) {
        for (let j = i + 1; j < 3; j++) if (faces[i].dot(faces[j]) < -0.99) { par = [i, j]; break; }
      }
      if (!par) {
        achar('VALVULA_TRES_VIAS', v.tag, 'nenhum par de portas em linha: o corpo de três vias não fecha', no.pos);
        return;
      }
      const k = [0, 1, 2].find((x) => !par.includes(x));
      const eixo = faces[par[0]].clone();
      const ramal = faces[k].clone();
      let haste = new THREE.Vector3().crossVectors(eixo, ramal).normalize();
      if (haste.y < -1e-6) haste.negate();                 // atuador para cima quando da
      // Atuador deitado: vai para o lado onde nao bate em equipamento.
      if (Math.abs(haste.y) < 1e-6 && bateEquipamento(no.pos, haste, 0.7)) haste.negate();
      const z = new THREE.Vector3().crossVectors(eixo, haste);
      const obj = criarValvulaTresVias({ dn, ladoRamal: Math.sign(ramal.dot(z)) || 1 });
      orientar(obj.grupo, no.pos, eixo, haste);
      montar(v, obj, no.pos, haste, itensDela, {
        'Tipo (estimado)': 'Três vias com atuador pneumático',
        'Diâmetro': `DN ${dn}`,
        'Porta comum': 'no ramal, perpendicular às duas em linha',
      });
      return;
    }
    achar('VALVULA_TRES_VIAS', v.tag, `${faces.length} linha(s) no nó`, no.pos);
  }

  function valvulaNaLinha(v) {
    const it = trechoDe(v.linha, { tag: v.tag });
    if (!it) { achar('VALVULA_SEM_LINHA', v.tag, `a linha ${v.linha} não está traçada`); return; }
    const obj = criarValvulaGlobo({ dn: it.dn });
    const c = lugar(it, obj.comprimento + 0.05, VALVULA_PERTO[v.tag] ?? 'B');
    if (!c) {
      achar('VALVULA_SEM_LUGAR', v.tag, `nenhum trecho reto e horizontal de ${f2(obj.comprimento)} m na linha ${v.linha}`);
      return;
    }
    orientar(obj.grupo, c.p, c.dir, CIMA);
    if (!c.alcance) {
      achar('VALVULA_INACESSIVEL', v.tag, `eixo a ${f1(c.p.y)} m do piso (máx. ${f1(ACESSO_MAX)} m sem plataforma)`, c.p);
    }
    montar(v, obj, c.p, CIMA, [it.id], {
      'Tipo (estimado)': 'Globo com atuador pneumático de diafragma',
      'Diâmetro': `DN ${it.dn} (o da linha)`,
      'Face a face (estimado)': `${f2(obj.comprimento)} m`,
      'Altura do eixo': `${f2(c.p.y)} m do piso`,
    });
  }

  for (const v of VALVULAS) {
    if (nos[v.tag]) valvulaNoNo(v, nos[v.tag]);
    else valvulaNaLinha(v);
  }

  /* ======================================================================
   *  Instrumentos
   * =================================================================== */
  function geomDe(tag) { return EQUIPAMENTOS[tag]?.geom ?? EXTRAS[tag]?.geom; }

  /** Direcao radial no referencial do equipamento (graus de +X para +Z). */
  function radial(tag, ang) {
    const a = THREE.MathUtils.degToRad(ang);
    const q = todos[tag].grupo.getWorldQuaternion(new THREE.Quaternion());
    return V(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q);
  }
  const centroDe = (tag) => todos[tag].grupo.getWorldPosition(new THREE.Vector3());

  /** Raio externo do costado: chapa, camisa e isolamento. */
  function raioExterno(g) {
    return g.Di / 2 + (g.espessura ?? 0.008) + (g.camisa ? g.camisa.folga + 0.012 : 0) + (g.isolamento ?? 0);
  }

  /** Primeiro ponto do equipamento atingido por um raio. */
  function bater(tag, origem, dir) {
    const ray = new THREE.Raycaster(origem, dir.clone().normalize());
    const hits = ray.intersectObject(todos[tag].grupo, true)
      .filter((h) => h.object.isMesh && !/rotulo|cota|escala/.test(h.object.parent?.name ?? ''));
    return hits[0] ?? null;
  }

  function fichaInstrumento(m, ins, onde) {
    return {
      titulo: `${m.instrumentos[0]} · ${m.equip}`,
      subtitulo: `Malha de ${m.tipo}`,
      grupos: [{
        nome: 'Instrumento de campo',
        dados: {
          'Malha': textoMalha(m),
          'Controlador': `${m.instrumentos[1]}, no sistema de controle (sala de controle)`,
          'Elemento final': m.atua,
          'Ação': m.modo,
          'Sensor': m.sensor,
          'Onde': onde,
        },
      }],
    };
  }

  function porInstrumento(ins, m) {
    const o = ins.onde;
    const nomePeca = { dp: 'transmissor de pressão diferencial', pressao: 'transmissor de pressão',
      poco: 'poço termométrico com transmissor', radar: 'radar de nível', orificio: 'placa de orifício',
      densimetro: 'densímetro de linha' }[ins.peca];
    let obj, base, sobe, onde, itensDele = [];

    if (o.bocal) {
      const A = ancoraMundo(todos, o.bocal);
      if (!A) { achar('INSTRUMENTO_SEM_LUGAR', m.equip, `bocal ${o.bocal} não existe`); return; }
      obj = ins.peca === 'poco' ? criarPoco({ comprimento: 0.4 }) : criarTransmissor({ dp: ins.peca === 'dp' });
      orientarPara(obj, A.pos, A.dir);
      base = A.pos; sobe = A.dir; onde = `bocal ${o.bocal.split('.')[1]} do ${A.tag}`;
      if (o.ate) {
        const B = ancoraMundo(todos, o.ate);
        if (B) {
          // vaso vertical: o capilar acompanha o costado; senao, reto
          const tag = o.bocal.split('.')[0], gv = geomDe(tag);
          const a = A.pos.clone().addScaledVector(A.dir, 0.05), b = B.pos.clone().addScaledVector(B.dir, 0.05);
          grupo.add(gv?.Di && gv.orientacao !== 'horizontal'
            ? criarCapilarAoLongo({ a, b, centro: centroDe(tag), raio: raioExterno(gv) })
            : criarCapilar(a, b));
          onde += `, capilar até o ${o.ate.split('.')[1]}`;
        }
      }
    } else if (o.linha) {
      const it = trechoDe(o.linha, { de: o.de });
      if (!it) { achar('INSTRUMENTO_SEM_LUGAR', m.equip, `linha ${o.linha} não traçada`); return; }
      itensDele = [it.id];
      if (ins.peca === 'orificio' || ins.peca === 'densimetro') {
        const pr = ins.peca === 'orificio' ? criarPlacaOrificio({ dn: it.dn }) : criarDensimetro({ dn: it.dn });
        const D = it.od;
        let c = ins.peca === 'orificio'
          ? lugar(it, pr.comprimento, o.perto ?? 'A', { antes: RETO_ORIFICIO.antes * D, depois: RETO_ORIFICIO.depois * D })
          : lugar(it, pr.comprimento, o.perto ?? 'A');
        if (!c && ins.peca === 'orificio') {
          c = lugar(it, pr.comprimento, o.perto ?? 'A');
          if (c) {
            achar('ORIFICIO_SEM_RETO', `${m.instrumentos[0]} · ${m.equip}`,
              `sem ${RETO_ORIFICIO.antes} D a montante e ${RETO_ORIFICIO.depois} D a jusante retos na linha ${o.linha}`, c.p);
          }
        }
        if (!c) { achar('INSTRUMENTO_SEM_LUGAR', m.equip, `nenhum trecho reto na linha ${o.linha}`); return; }
        if (!c.alcance) achar('INSTRUMENTO_INACESSIVEL', `${m.instrumentos[0]} · ${m.equip}`, `a ${f1(c.p.y)} m do piso, na linha ${o.linha}`, c.p);
        obj = pr.grupo;
        orientar(obj, c.p, c.dir, CIMA);
        base = c.p; sobe = CIMA;
      } else {
        const c = lugar(it, 0.15, o.perto ?? 'A', { vertical: true });
        if (!c) { achar('INSTRUMENTO_SEM_LUGAR', m.equip, `nenhum trecho reto na linha ${o.linha}`); return; }
        if (!c.alcance) achar('INSTRUMENTO_INACESSIVEL', `${m.instrumentos[0]} · ${m.equip}`, `a ${f1(c.p.y)} m do piso, na linha ${o.linha}`, c.p);
        obj = ins.peca === 'poco' ? criarPoco({ comprimento: Math.max(0.05, it.od * 0.6) }) : criarTransmissor();
        // Em trecho vertical a tomada sai de lado, para longe do destino.
        sobe = CIMA;
        if (c.vertical) {
          const alvo = it.pts[it.pts.length - 1];
          sobe = V(c.p.x - alvo.x, 0, c.p.z - alvo.z);
          if (sobe.lengthSq() < 1e-6) sobe.set(1, 0, 0);
          sobe.normalize();
        }
        base = c.p.clone().addScaledVector(sobe, it.od / 2);
        orientarPara(obj, base, sobe);
      }
      onde = `linha ${o.linha}`;
    } else if (o.vaso) {
      const g = geomDe(o.vaso);
      const c0 = centroDe(o.vaso);
      const y0 = g.elevacao ?? g.saiaAltura;
      const r = raioExterno(g);
      const d = radial(o.vaso, o.ang);
      const ponto = (y) => V(c0.x, y, c0.z).addScaledVector(d, r);
      if (ins.peca === 'poco') {
        base = ponto(y0 + (o.altura ?? 0.3) * g.Ltan);
        obj = criarPoco({ comprimento: 0.3 });
      } else {
        // as duas tomadas saem da chapa e atravessam camisa e isolamento: a
        // de baixo leva o transmissor; a de cima, o selo do capilar
        const rChapa = g.Di / 2 + (g.espessura ?? 0.008);
        const chapa = (y) => V(c0.x, y, c0.z).addScaledVector(d, rChapa);
        const yBaixo = y0 + 0.3, yCima = y0 + g.Ltan - 0.3;
        base = ponto(yBaixo);
        obj = criarTransmissor({ dp: true });
        const selo = ponto(yCima).addScaledVector(d, 0.05);
        grupo.add(criarTomada(chapa(yBaixo), base), criarTomada(chapa(yCima), selo));
        grupo.add(criarCapilar(base.clone().addScaledVector(d, 0.05), selo));
      }
      orientarPara(obj, base, d);
      sobe = d;
      onde = `costado do ${o.vaso}, a ${o.ang}°`;
    } else if (o.horiz) {
      const g = geomDe(o.horiz);
      const c0 = centroDe(o.horiz);
      const r = raioExterno(g);
      const topo = bater(o.horiz, V(c0.x, 20, c0.z), V(0, -1, 0));
      if (!topo) { achar('INSTRUMENTO_SEM_LUGAR', m.equip, `não achei o costado do ${o.horiz}`); return; }
      const yEixo = topo.point.y - r;
      // lado que olha para o rack (sul): e por ali que se chega ao vaso
      const p = pegadaPlanta(o.horiz);
      const lado = (p.x1 - p.x0) > (p.z1 - p.z0) ? V(0, 0, Math.sign(2.6 - c0.z) || 1) : V(Math.sign(-c0.x) || 1, 0, 0);
      const h = 0.7 * r;
      const off = Math.sqrt(r * r - h * h);
      base = V(c0.x, yEixo - h, c0.z).addScaledVector(lado, off);
      const alto = V(c0.x, yEixo + h, c0.z).addScaledVector(lado, off);
      const normal = lado.clone().multiplyScalar(off).add(V(0, -h, 0)).normalize();
      obj = criarTransmissor({ dp: true });
      orientarPara(obj, base, normal);
      grupo.add(criarCapilar(base.clone().addScaledVector(normal, 0.05), alto.clone().addScaledVector(lado, 0.05)));
      sobe = normal;
      onde = `costado do ${o.horiz}, tomadas abaixo e acima do eixo`;
    } else if (o.topo) {
      const c0 = centroDe(o.topo);
      const d = radial(o.topo, o.ang);
      const alvo = V(c0.x, 40, c0.z).addScaledVector(d, o.r);
      const hit = bater(o.topo, alvo, V(0, -1, 0));
      if (!hit) { achar('INSTRUMENTO_SEM_LUGAR', m.equip, `nada sob o ponto do tampo do ${o.topo}`); return; }
      base = hit.point.clone();
      obj = ins.peca === 'radar' ? criarRadar() : criarTransmissor();
      obj.position.copy(base);
      sobe = CIMA;
      onde = `tampo do ${o.topo}`;
    } else if (o.cuba) {
      const g = geomDe(o.cuba);
      const c0 = centroDe(o.cuba);
      const Rc = 1.22 * g.D / 2;                      // raio da cuba (generico.js)
      const phi = THREE.MathUtils.degToRad(o.phi);
      const q = todos[o.cuba].grupo.getWorldQuaternion(new THREE.Quaternion());
      const normal = V(Math.sin(phi), -Math.cos(phi), 0).applyQuaternion(q);
      base = V(c0.x, g.alturaEixo, c0.z).add(V(0, 0, o.z).applyQuaternion(q)).addScaledVector(normal, Rc + 0.01);
      obj = criarTransmissor();
      orientarPara(obj, base, normal);
      sobe = normal;
      onde = `parede da cuba do ${o.cuba} (pressão hidrostática)`;
    }

    obj.userData.ficha = fichaInstrumento(m, ins, `${nomePeca}, ${onde}`);
    obj.name = `instrumento-${m.instrumentos[0]}-${m.equip}-${m.tipo}`;
    grupo.add(obj);
    etiqueta(`${m.instrumentos[0]}`, base.clone().addScaledVector(sobe, 0.35).add(V(0, 0.1, 0)));
    pecas.push({ tag: `${m.instrumentos[0]} · ${m.equip}`, a: base.clone().addScaledVector(sobe, 0.06),
      b: base.clone().addScaledVector(sobe, 0.28), r: 0.07, itens: itensDele, equip: m.equip });
    contagem.instrumentos++;
  }

  const pegadas = {};
  function pegadaPlanta(tag) {
    if (!pegadas[tag]) {
      const b = new THREE.Box3().setFromObject(todos[tag].grupo);
      pegadas[tag] = { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z };
    }
    return pegadas[tag];
  }

  for (const m of MALHAS) {
    const ins = INSTRUMENTOS.find((i) => i.equip === m.equip && i.tipo === m.tipo);
    if (!ins) {
      achar('INSTRUMENTO_FALTANDO', `${m.instrumentos[0]} · ${m.equip}`, `malha de ${m.tipo} sem lugar em data/instrumentos.js`);
      continue;
    }
    porInstrumento(ins, m);
  }

  /* ======================================================================
   *  Choques: atuador e instrumento contra tubo e equipamento
   * =================================================================== */
  const malhasEquip = [];
  for (const [tag, e] of Object.entries(todos)) {
    e.grupo.traverse((o) => {
      if (o.isMesh && !/rotulo|cota|escala/.test(o.parent?.name ?? '')) malhasEquip.push({ tag, o });
    });
  }
  for (const pc of pecas) {
    for (const t of tubos) {
      if (pc.itens.includes(t.id)) continue;
      for (let i = 1; i < t.pts.length; i++) {
        if (distSegSeg(pc.a, pc.b, t.pts[i - 1], t.pts[i]) < pc.r + t.r) {
          achar('PECA_x_TUBO', pc.tag, `encosta na linha ${t.id}`, pc.b);
          break;
        }
      }
    }
    const d = new THREE.Vector3().subVectors(pc.b, pc.a);
    const ray = new THREE.Raycaster(pc.a, d.clone().normalize(), 0, d.length());
    const alvo = malhasEquip.filter((x) => x.tag !== pc.equip).map((x) => x.o);
    const hit = ray.intersectObjects(alvo, false)[0];
    if (hit) {
      const dono = malhasEquip.find((x) => x.o === hit.object)?.tag;
      achar('PECA_x_EQUIPAMENTO', pc.tag, `entra no ${dono}`, hit.point);
    }
  }

  /* ======================================================================
   *  Contagem contra o P&ID
   * =================================================================== */
  if (contagem.valvulas !== VALVULAS.length) {
    achar('CONTAGEM', 'Válvulas', `${contagem.valvulas} na maquete, ${VALVULAS.length} no P&ID`);
  }
  if (contagem.instrumentos !== MALHAS.length) {
    achar('CONTAGEM', 'Instrumentos', `${contagem.instrumentos} na maquete, ${MALHAS.length} malhas no P&ID`);
  }

  grupo.add(rotulos);
  return { grupo, rotulos, achados, contagem };
}
