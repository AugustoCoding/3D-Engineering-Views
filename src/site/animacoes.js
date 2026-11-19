import * as THREE from 'three';
import { PLUMAS } from '../data/ambiente.js';
import { VENTO, vetorBarlavento } from '../data/site.js';

/**
 * ===========================================================================
 *  PLUMAS E VENTILADORES  (Fase 27, itens 2 e 3)
 * ===========================================================================
 *  As saidas que as primitivas marcam (`userData.saidas`: torre de
 *  resfriamento, chamine da caldeira) e as pontas abertas altas da
 *  tubulacao (o vent) soltam particulas que sobem, abrem, somem e vao com o
 *  vento de projeto. Uma nuvem de pontos por saida, com tamanho e opacidade
 *  por particula num shader proprio; o ventilador da torre gira.
 *  Numeros em PLUMAS (data/ambiente.js).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const VERT = `
  attribute float tam; attribute float alfa;
  uniform float escala; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = tam * escala / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    vA = alfa;
  }`;
const FRAG = `
  uniform vec3 cor; varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    gl_FragColor = vec4(cor, vA * smoothstep(0.5, 0.05, d));
  }`;

function criarPluma(origem, P) {
  const n = Math.ceil(P.taxa * P.vida);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('tam', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('alfa', new THREE.BufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { escala: { value: 600 }, cor: { value: new THREE.Color(P.cor) } },
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'pluma';
  pts.frustumCulled = false;
  // idade de cada particula ja espalhada: a pluma nasce formada
  const idade = Float32Array.from({ length: n }, (_, i) => (i / n) * P.vida);
  const sorte = Float32Array.from({ length: n * 2 }, () => Math.random() - 0.5);
  return { pts, origem, P, idade, sorte, n, cor0: new THREE.Color(P.cor) };
}

export function criarAnimacoes({ cena, entorno, tubulacao, todos = {}, seguranca = null }) {
  const grupo = new THREE.Group();
  grupo.name = 'animacoes';
  const [bx, bz] = vetorBarlavento(VENTO.de);
  const deriva = V(-bx, 0, -bz).multiplyScalar(PLUMAS.deriva);

  const plumas = [], rotores = [];
  entorno.grupo.updateMatrixWorld(true);
  entorno.grupo.traverse((o) => {
    for (const s of o.userData?.saidas ?? []) plumas.push(criarPluma(V(...s.p).applyMatrix4(o.matrixWorld), PLUMAS[s.tipo]));
    if (o.name === 'ventilador-torre') rotores.push(o);
  });
  // o vent: ponta aberta alta da tubulacao (as baixas sao respiro e dreno)
  for (const p of tubulacao.pontas ?? []) if (p.pos.y > 10) plumas.push(criarPluma(p.pos.clone(), PLUMAS.vent));
  for (const pl of plumas) grupo.add(pl.pts);

  /* bolhas de ar do sparger do R-01 (item 5): do anel ate a superficie do
   * liquido; so se veem no corte e pelo visor. O lado cortado do vaso as
   * esconde pelo mesmo plano que corta o liquido. */
  let bolhas = null;
  const r01 = todos['R-01']?.grupo;
  const sp = r01?.getObjectByName('sparger');
  let liq = null;
  r01?.traverse((o) => { if (!liq && o.isMesh && o.material?.name === 'liquido') liq = o; });
  if (sp && liq) {
    r01.updateMatrixWorld(true);
    const B = PLUMAS.bolhas, { r, y } = sp.userData.anel;
    const centro = V(0, y, 0).applyMatrix4(sp.matrixWorld);
    const topo = new THREE.Box3().setFromObject(liq).max.y - 0.05;
    const P = { taxa: B.n / ((topo - centro.y) / B.sobe), vida: (topo - centro.y) / B.sobe, d0: B.d[0], alfa: B.alfa, cor: B.cor };
    bolhas = criarPluma(centro, P);
    bolhas.r = r;
    bolhas.topo = topo;
    grupo.add(bolhas.pts);
  }
  const ponto = V();

  /* teste do canhao monitor (item 15): jato balistico com arrasto, um canhao
   * por vez, `duracao` s a cada `periodo` s (PLUMAS.jato) */
  const J = PLUMAS.jato, canhoes = [];
  seguranca?.grupo.updateMatrixWorld(true);
  seguranca?.grupo.traverse((o) => {
    if (!o.userData?.bocal) return;
    const { p, dir } = o.userData.bocal;
    canhoes.push({ p: V(...p).applyMatrix4(o.matrixWorld), d: V(...dir).transformDirection(o.matrixWorld) });
  });
  let jato = null;
  if (canhoes.length) {
    jato = criarPluma(canhoes[0].p, { taxa: J.n / 3, vida: 3, d0: J.d[0], alfa: J.alfa, cor: J.cor });
    grupo.add(jato.pts);
  }
  let tJato = 0;

  // ponte rolante da oficina (item 23): vai e volta nos trilhos e o carro
  // na viga, cada um no seu ritmo (periodo = ida e volta na velocidade)
  // (procurada no primeiro quadro: os interiores sao montados depois)
  let pontes = null, tPonte = 0;
  // cabecas de CFTV (item 25): varrem devagar em volta do rumo
  let cameras = null;
  // agitadores dos vasos do construtor generico (item 5), na rotacao deles
  let agitadores = null;

  const w = (PLUMAS.rpmVentilador / 60) * Math.PI * 2;
  function atualizar(dt, noite = 0) {
    for (const r of rotores) r.rotation.y += w * dt;
    tPonte += dt;
    if (!pontes) { pontes = []; cena.scene.traverse((o) => { if (o.name === 'ponte-movel') pontes.push(o); }); }
    if (!cameras) { cameras = []; cena.scene.traverse((o) => { if (o.userData?.varredura) cameras.push(o); }); }
    if (!agitadores) { agitadores = []; cena.scene.traverse((o) => { if (o.userData?.rpm) agitadores.push(o); }); }
    for (const a of agitadores) a.rotation.y += (a.userData.rpm / 60) * Math.PI * 2 * dt;
    cameras.forEach((c, i) => {
      const { rumo, amplitude } = c.userData.varredura;
      c.rotation.y = rumo + amplitude * Math.sin(tPonte * 0.12 + i * 1.3);
    });
    for (const p of pontes) {
      const { x, z } = p.userData.curso, v = PLUMAS.ponteRolante;
      // seno: para nas pontas, como o operador que posiciona a carga
      if (z > 0) p.position.z = z * Math.sin(tPonte * v.ponte / z);
      const carro = p.children.find((c) => c.name === 'carro-talha');
      if (carro && x > 0) carro.position.x = x * Math.sin(tPonte * v.carro / x + 1.3);
    }
    const cam = cena.camera, alt = cena.renderer.domElement.height;
    const escala = alt / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    for (const pl of plumas) {
      const { P, idade, sorte, n, origem } = pl;
      const at = pl.pts.geometry.attributes;
      for (let i = 0; i < n; i++) {
        idade[i] += dt;
        if (idade[i] > P.vida) idade[i] -= P.vida;
        const a = idade[i], f = a / P.vida;
        // sobe desacelerando, vai com o vento cada vez mais e abre
        const lado = P.d0 / 2 + P.abre * a * 0.5;
        at.position.setXYZ(i,
          origem.x + deriva.x * a * f + sorte[2 * i] * lado,
          origem.y + P.sobe * a * (1 - 0.35 * f),
          origem.z + deriva.z * a * f + sorte[2 * i + 1] * lado);
        at.tam.setX(i, P.d0 + P.abre * a);
        at.alfa.setX(i, P.alfa * Math.min(1, f * 6) * (1 - f) ** 1.5);
      }
      at.position.needsUpdate = at.tam.needsUpdate = at.alfa.needsUpdate = true;
      pl.pts.material.uniforms.escala.value = escala;
      // de noite a pluma escurece: so aparece onde a luz pega
      pl.pts.material.uniforms.cor.value.copy(pl.cor0).multiplyScalar(1 - 0.75 * noite);
    }
    if (jato) {
      tJato += dt;
      const ciclo = tJato % J.periodo, k = Math.floor(tJato / J.periodo) % canhoes.length;
      // abre e fecha a valvula em 3 s: o jato cresce e morre
      const vazao = Math.min(1, ciclo / 3, Math.max(0, (J.duracao - ciclo) / 3));
      const c = canhoes[k], at = jato.pts.geometry.attributes;
      jato.pts.visible = vazao > 0;
      if (vazao > 0) {
        const { idade, sorte, n } = jato, vida = jato.P.vida;
        for (let i = 0; i < n; i++) {
          idade[i] += dt;
          if (idade[i] > vida) idade[i] -= vida;
          const a = idade[i], f = a / vida;
          // velocidade com arrasto linear: x = v0/k (1 - e^-kt); y com gravidade
          const e = (1 - Math.exp(-J.arrasto * a)) / J.arrasto;
          const v0 = J.v0 * vazao * (1 + 0.04 * sorte[2 * i]);
          const abre = 0.05 + 0.6 * f;
          ponto.copy(c.p).addScaledVector(c.d, v0 * e);
          ponto.y -= 0.5 * 9.81 * a * a * 0.92;
          ponto.x += sorte[2 * i] * abre;
          ponto.z += sorte[2 * i + 1] * abre;
          const noChao = ponto.y < c.p.y - 1.9;
          at.position.setXYZ(i, ponto.x, Math.max(ponto.y, c.p.y - 1.9), ponto.z);
          at.tam.setX(i, J.d[0] + (J.d[1] - J.d[0]) * f);
          at.alfa.setX(i, noChao ? 0 : J.alfa * vazao * Math.min(1, f * 8) * (1 - 0.6 * f));
        }
        at.position.needsUpdate = at.tam.needsUpdate = at.alfa.needsUpdate = true;
        jato.pts.material.uniforms.escala.value = escala;
      }
    }
    if (bolhas) {
      const { P, idade, sorte, n, origem } = bolhas, at = bolhas.pts.geometry.attributes;
      const plano = liq.material.clippingPlanes?.[0];
      for (let i = 0; i < n; i++) {
        idade[i] += dt;
        if (idade[i] > P.vida) idade[i] -= P.vida;
        const a = idade[i], f = a / P.vida;
        // nasce num furo do anel (angulo e folga da sorte) e sobe girando
        // com o liquido agitado
        const ang = sorte[2 * i] * Math.PI * 2 + a * 0.8, rr = bolhas.r * (0.85 + 0.3 * sorte[2 * i + 1]) * (1 - 0.4 * f);
        ponto.set(origem.x + Math.cos(ang) * rr, origem.y + PLUMAS.bolhas.sobe * a, origem.z + Math.sin(ang) * rr);
        at.position.setXYZ(i, ponto.x, ponto.y, ponto.z);
        const d = PLUMAS.bolhas.d;
        at.tam.setX(i, d[0] + (d[1] - d[0]) * (0.5 + sorte[2 * i + 1]) * (0.6 + 0.4 * f));
        const corta = plano && plano.distanceToPoint(ponto) < 0;
        at.alfa.setX(i, corta ? 0 : P.alfa * Math.min(1, f * 10) * Math.min(1, (1 - f) * 8));
      }
      at.position.needsUpdate = at.tam.needsUpdate = at.alfa.needsUpdate = true;
      bolhas.pts.material.uniforms.escala.value = escala;
    }
  }
  return { grupo, atualizar, plumas, rotores, bolhas, canhoes };
}
