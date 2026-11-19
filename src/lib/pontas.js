import * as THREE from 'three';
import { DN } from '../data/plant.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  TERMINAIS DE PONTA ABERTA  (Fase 6)
 * ===========================================================================
 *  Tubo que acaba aberto para cima junta chuva e passaro. Cada ponta aberta
 *  da planta leva o terminal do servico dela:
 *
 *    chapeu        vent e exaustao: cone sobre tres hastes, o gas sai por
 *                  baixo da aba e a chuva nao entra
 *    corta-chamas  respiro de tanque de inflamavel (TK-01): elemento de
 *                  placas que nao deixa a chama voltar, e o chapeu em cima
 *    filtro        admissao do compressor: caixa de filtro com aba de chuva
 *
 *  Origem na ponta do tubo, corpo para +Y. Proporcoes [ESTIMADO] pelo DN.
 */

const SEG = 24;

function cil(r, h, mat, y) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, SEG), mat);
  m.position.y = y;
  m.castShadow = true;
  return m;
}

export function criarChapeu({ dn }) {
  const od = DN[dn].od;
  const g = new THREE.Group();
  g.name = 'chapeu';
  const folga = Math.max(0.06, od * 0.8);
  const rAba = od * 1.5;
  // A haste sobe da borda do tubo ate a parede do cone: no raio od/2 o cone
  // (altura 0,6 rAba, base na folga) ja esta 0,6 (rAba - od/2) acima da base.
  // Ate a base so, ela parava 0,6 od abaixo do cone (Fase 25).
  const hHaste = folga + 0.6 * (rAba - od * 0.5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.01, hHaste, 0.01), MAT.acoCarbono);
    h.position.set(Math.cos(a) * od * 0.5, hHaste / 2, Math.sin(a) * od * 0.5);
    g.add(h);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(rAba, rAba * 0.6, SEG, 1, true), MAT.acoCarbono);
  cone.material = cone.material.clone();
  cone.material.side = THREE.DoubleSide;
  cone.position.y = folga + rAba * 0.3;
  cone.castShadow = true;
  g.add(cone);
  return g;
}

export function criarCortaChamas({ dn }) {
  const d = DN[dn];
  const g = new THREE.Group();
  g.name = 'corta-chamas';
  const rCorpo = d.fl * 0.75;
  const hCorpo = d.od * 2.2;
  g.add(cil(d.fl / 2, d.esp, MAT.flange, d.esp / 2));
  g.add(cil(rCorpo, hCorpo, MAT.acoCarbono, d.esp + hCorpo / 2));
  g.add(cil(d.fl / 2, d.esp, MAT.flange, d.esp * 1.5 + hCorpo));
  const chapeu = criarChapeu({ dn });
  chapeu.position.y = 2 * d.esp + hCorpo;
  g.add(chapeu);
  return g;
}

export function criarFiltroAdmissao({ dn }) {
  const od = DN[dn].od;
  const g = new THREE.Group();
  g.name = 'filtro-admissao';
  const r = od * 1.6;
  const h = od * 2.4;
  g.add(cil(od * 0.55, 0.08, MAT.acoCarbono, 0.04));
  const caixa = cil(r, h, MAT.instrumento, 0.08 + h / 2);
  g.add(caixa);
  // tela: anel mais escuro no meio da altura, onde o ar entra
  const tela = cil(r * 1.01, h * 0.5, MAT.acoCarbono, 0.08 + h / 2);
  tela.material = MAT.acoCarbono;
  g.add(tela);
  const aba = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.03, SEG), MAT.instrumento);
  aba.position.y = 0.08 + h + 0.015;
  aba.castShadow = true;
  g.add(aba);
  return g;
}
