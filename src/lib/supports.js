import * as THREE from 'three';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  SUPORTACAO E ACESSO
 * ===========================================================================
 *  Saia, fundacao, plataforma de operacao, guarda-corpo e escada com gaiola.
 *
 *  Estes elementos nao sao enfeite: eles dao ESCALA HUMANA ao modelo. Sem
 *  plataforma e escada, ninguem consegue dizer se o vaso tem 2 m ou 20 m.
 *
 *  Convencao de altura (igual ao resto do equipamento):
 *      y = 0  ->  linha de tangencia inferior do vaso
 *      y = -saiaAltura  ->  piso acabado
 */

const SEG = 64;

/**
 * PLINTO — quanto o bloco de fundacao projeta ACIMA do piso acabado (y = 0).
 *
 * Nao e acabamento: sem essa projecao o topo do bloco cai EXATAMENTE no plano
 * do topo da laje, e as duas faces passam a disputar o mesmo valor no z-buffer.
 * O sintoma era a mancha quadrada que aparecia e sumia no chao sob cada
 * equipamento conforme a camera se movia — e so durante o movimento, porque e
 * a variacao de profundidade que decide qual face ganha em cada quadro.
 *
 * O valor tambem esta certo na obra: fundacao de equipamento e pedestal que
 * sobe do pavimento, com berco de graute; nunca e rasada com o piso. Com 10 cm
 * o anel de base da saia fica embutido e os chumbadores aparecem como pinos
 * saindo do concreto, que e o que se ve em campo.
 */
export const PLINTO = 0.10;

/** Anel/casca de revolucao com espessura de parede. */
function casca(rExt, esp, altura, y0, mat, phiStart = 0, phiLength = Math.PI * 2) {
  const rInt = rExt - esp;
  const pts = [
    new THREE.Vector2(rInt, y0),
    new THREE.Vector2(rExt, y0),
    new THREE.Vector2(rExt, y0 + altura),
    new THREE.Vector2(rInt, y0 + altura),
    new THREE.Vector2(rInt, y0),
  ];
  const geo = new THREE.LatheGeometry(pts, SEG, phiStart, phiLength);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/**
 * Arco de casca medido no referencial dos bocais e das escadas: angulo `a`
 * de +X para +Z, direcao (cos a, 0, sin a). O LatheGeometry conta phi a
 * partir de +Z, direcao (sin phi, 0, cos phi), entao phi = 90° - a. Passar o
 * angulo direto ao LatheGeometry pos o vao da plataforma do R-01 a 250°
 * enquanto a escada chegava a 200° — o guarda-corpo fechava a subida.
 */
function cascaArco(rExt, esp, altura, y0, mat, a0 = 0, aL = Math.PI * 2) {
  return casca(rExt, esp, altura, y0, mat, Math.PI / 2 - a0 - aL, aL);
}

/** Intervalos angulares [a0, a0 + aL] que sobram de um circulo tirados os vaos. */
function arcosEntre(vaos) {
  const TAU = Math.PI * 2;
  if (!vaos.length) return [{ a0: 0, aL: TAU }];
  const v = vaos
    .map(({ centro, largura }) => ({ c: THREE.MathUtils.euclideanModulo(centro, TAU), l: largura }))
    .sort((p, q) => p.c - q.c);
  return v.map((p, i) => {
    const q = v[(i + 1) % v.length];
    const fimQ = (i + 1 < v.length ? q.c : q.c + TAU) - q.l / 2;
    return { a0: p.c + p.l / 2, aL: fimQ - (p.c + p.l / 2) };
  }).filter((a) => a.aL > 0.01);
}

/**
 * Casca cilindrica com janelas retangulares: abertura de acesso e passagem de
 * tubo na saia. Cada janela tira um gomo da casca e devolve, no mesmo gomo, o
 * pedaco de baixo e o de cima.
 *   janelas: [{ ang (graus), y (base, a partir de y0), largura, altura }]
 */
export function cascaComJanelas(rExt, esp, altura, y0, mat, janelas = []) {
  const grupo = new THREE.Group();
  const vaos = janelas.map((j) => ({
    centro: THREE.MathUtils.degToRad(j.ang), largura: j.largura / rExt, j,
  }));
  for (const { a0, aL } of arcosEntre(vaos)) {
    grupo.add(cascaArco(rExt, esp, altura, y0, mat, a0, aL));
  }
  for (const { centro, largura, j } of vaos) {
    const a0 = centro - largura / 2;
    if (j.y > 0.005) grupo.add(cascaArco(rExt, esp, j.y, y0, mat, a0, largura));
    const topo = j.y + j.altura;
    if (topo < altura - 0.005) {
      grupo.add(cascaArco(rExt, esp, altura - topo, y0 + topo, mat, a0, largura));
    }
  }
  grupo.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grupo;
}

/**
 * Janelas da saia: a abertura de acesso (croqui do R-01: arco na frente da
 * saia) e uma passagem por linha que sai de bocal de fundo. Sem a passagem,
 * a linha atravessava a chapa da saia.
 *   g.saiaAbertura  { ang }          — acesso de inspecao, 0,6 x 0,9 m
 *   g.saiaPassagens [{ ang, y, diam }] — y = eixo do tubo acima do piso
 */
export function janelasDaSaia(g) {
  const janelas = (g.saiaPassagens ?? []).map((p) => ({
    ang: p.ang, y: p.y - p.diam / 2, largura: p.diam, altura: p.diam,
  }));
  if (g.saiaAbertura) janelas.push({ ang: g.saiaAbertura.ang, y: 0.3, largura: 0.6, altura: 0.9 });
  return janelas;
}

/* -------------------------------------------------------------------------
 * SAIA CILINDRICA + ANEL DE BASE + CHUMBADORES
 * ---------------------------------------------------------------------- */
export function criarSaia(g, R) {
  const grupo = new THREE.Group();
  grupo.name = 'saia';

  const yPiso = -g.saiaAltura;

  grupo.add(cascaComJanelas(R, g.saiaEspessura, g.saiaAltura, yPiso, MAT.acoCarbono, janelasDaSaia(g)));

  // anel de base
  const anel = casca(R + g.baseAnelLargura, g.baseAnelLargura + g.saiaEspessura,
    0.04, yPiso, MAT.acoCarbono);
  anel.castShadow = true;
  grupo.add(anel);

  // cadeiras de chumbador (gussets) + parafusos de ancoragem
  const nChumb = 12;
  const geoGusset = new THREE.BoxGeometry(g.baseAnelLargura, 0.3, 0.014);
  const geoParafuso = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8);
  for (let i = 0; i < nChumb; i++) {
    const a = (i / nChumb) * Math.PI * 2;
    const rg = R + g.baseAnelLargura / 2;

    const gus = new THREE.Mesh(geoGusset, MAT.acoCarbono);
    gus.position.set(Math.cos(a) * rg, yPiso + 0.17, Math.sin(a) * rg);
    gus.rotation.y = -a;
    gus.castShadow = true;
    grupo.add(gus);

    const par = new THREE.Mesh(geoParafuso, MAT.acoCarbono);
    par.position.set(Math.cos(a) * rg, yPiso + 0.08, Math.sin(a) * rg);
    grupo.add(par);
  }

  // respiros da saia (a abertura de acesso e janela de verdade, acima)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const resp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16), MAT.redutor);
    resp.position.set(Math.cos(a) * (R - 0.02), -0.35, Math.sin(a) * (R - 0.02));
    resp.rotation.z = Math.PI / 2;
    resp.rotation.y = -a;
    grupo.add(resp);
  }

  return grupo;
}

/* -------------------------------------------------------------------------
 * PERNAS — vaso vertical apoiado em pernas soldadas ao costado
 *
 *  E o apoio dos cristalizadores e do dissolvedor nos croquis: deixa livre o
 *  bocal de fundo e o espaco da valvula, que numa saia ficariam fechados.
 *  Cada perna e um tubo quadrado encostado no costado (ou na camisa), com
 *  placa de base, chumbadores e bloco de fundacao proprio.
 *
 *  Perna mais alta que 2 m ganha contraventamento em X entre vizinhas. As
 *  diagonais ficam no plano vertical entre duas pernas, que passa a uma
 *  distancia do eixo menor que o raio do vaso; por isso so podem subir ate
 *  onde o fundo ja se afastou desse plano — `yContraventoMax`, calculado por
 *  quem conhece o perfil do fundo.
 *
 *  Referencial: y = 0 na tangencia inferior; `yPiso` < 0.
 * ---------------------------------------------------------------------- */
export function criarPernas({
  R, yPiso, yFixacao, n = 4, lado = 0.25, angulo0 = 45, yContraventoMax = null,
}) {
  const grupo = new THREE.Group();
  grupo.name = 'pernas';

  const rp = R + lado / 2 + 0.004;             // face interna da perna encosta no costado
  const ESP_PLACA = 0.03;
  const yPe = yPiso + PLINTO + ESP_PLACA;      // a perna nasce sobre a placa de base
  const h = yFixacao - yPe;

  const pontos = [];
  for (let i = 0; i < n; i++) {
    const a = THREE.MathUtils.degToRad(angulo0 + (i * 360) / n);
    const x = Math.cos(a) * rp;
    const z = Math.sin(a) * rp;
    pontos.push(new THREE.Vector3(x, 0, z));

    const perna = new THREE.Mesh(new THREE.BoxGeometry(lado, h, lado), MAT.acoCarbono);
    perna.position.set(x, yPe + h / 2, z);
    perna.rotation.y = -a;
    perna.castShadow = true;
    grupo.add(perna);

    const placa = new THREE.Mesh(
      new THREE.BoxGeometry(lado * 1.7, ESP_PLACA, lado * 1.7), MAT.acoCarbono,
    );
    placa.position.set(x, yPiso + PLINTO + ESP_PLACA / 2, z);
    placa.rotation.y = -a;
    grupo.add(placa);

    const geoChumb = new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8);
    for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const c = new THREE.Mesh(geoChumb, MAT.acoCarbono);
      const du = (u * lado * 0.62), dv = (v * lado * 0.62);
      c.position.set(
        x + du * Math.cos(a) - dv * Math.sin(a),
        yPiso + PLINTO + 0.05,
        z + du * Math.sin(a) + dv * Math.cos(a),
      );
      grupo.add(c);
    }

    // Bloco proprio por perna: desce 0,4 m na laje e sobe PLINTO acima dela.
    const bloco = new THREE.Mesh(
      new THREE.BoxGeometry(lado * 2.8, 0.4 + PLINTO, lado * 2.8), MAT.concreto,
    );
    bloco.position.set(x, yPiso - 0.2 + PLINTO / 2, z);
    bloco.rotation.y = -a;
    bloco.receiveShadow = true;
    grupo.add(bloco);
  }

  // contraventamento em X
  if (h > 2 && yContraventoMax !== null) {
    const y0 = yPe + 0.35;
    const y1 = Math.min(yContraventoMax, yFixacao - 0.3);
    if (y1 - y0 > 0.8) {
      const geo = (comp) => new THREE.CylinderGeometry(0.03, 0.03, comp, 8);
      for (let i = 0; i < n; i++) {
        const p = pontos[i], q = pontos[(i + 1) % n];
        for (const [ya, yb] of [[y0, y1], [y1, y0]]) {
          const A = new THREE.Vector3(p.x, ya, p.z);
          const B = new THREE.Vector3(q.x, yb, q.z);
          const d = B.clone().sub(A);
          const barra = new THREE.Mesh(geo(d.length()), MAT.acoCarbono);
          barra.position.copy(A).addScaledVector(d, 0.5);
          barra.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
          barra.castShadow = true;
          grupo.add(barra);
        }
      }
    }
  }

  return grupo;
}

/* -------------------------------------------------------------------------
 * FUNDACAO DE CONCRETO
 * ---------------------------------------------------------------------- */
export function criarFundacao(g) {
  const grupo = new THREE.Group();
  grupo.name = 'fundacao';

  const bloco = new THREE.Mesh(
    new THREE.BoxGeometry(g.fundacaoLado, g.fundacaoAltura + PLINTO, g.fundacaoLado),
    MAT.concreto,
  );
  bloco.position.y = -g.saiaAltura - g.fundacaoAltura / 2 + PLINTO / 2;
  bloco.receiveShadow = true;
  bloco.castShadow = true;
  grupo.add(bloco);

  return grupo;
}

/* -------------------------------------------------------------------------
 * PLATAFORMA DE OPERACAO + GUARDA-CORPO
 *
 * A escada de marinheiro chega pela BORDA: o guarda-corpo abre na largura
 * dela (mais 0,2 m) e o piso continua. Ate 23/10/2026 o vao tinha 46° — 2,2 m
 * sem piso nem guarda-corpo na chegada da escada — e piso, corrimao e
 * montantes usavam tres convencoes de angulo, entao o vao do piso, o do
 * corrimao e a escada caiam em tres lugares diferentes.
 *
 * Angulos no referencial dos bocais: de +X para +Z, em graus.
 *   angulosVao  onde chega cada escada (vao no guarda-corpo)
 *   furos       onde desce uma linha que sai de bocal acima do piso (vao so
 *               no piso, com rodape e corrimao continuos — senao vira queda)
 * ---------------------------------------------------------------------- */
export function criarPlataforma(p, rVaso, angulosVao = [0], furos = [], larguraEscada = 0.6, rCasco = rVaso) {
  const grupo = new THREE.Group();
  grupo.name = 'plataforma';

  const rad = THREE.MathUtils.degToRad;
  const r1 = rVaso + 0.02;
  const r2 = r1 + p.largura;
  const rMeio = (r1 + r2) / 2;

  const vaos = [].concat(angulosVao).map((g) => ({ centro: rad(g), largura: (larguraEscada + 0.2) / r2 }));
  const cortes = furos.map((g) => ({ centro: rad(g), largura: 0.3 / rMeio }));
  const dentroDe = (lista, a, folga) => lista.some((c) => {
    const d = THREE.MathUtils.euclideanModulo(a - c.centro + Math.PI, Math.PI * 2) - Math.PI;
    return Math.abs(d) < c.largura / 2 + folga;
  });

  // piso de grade: o anel inteiro, menos os furos de passagem de tubo
  for (const { a0, aL } of arcosEntre(cortes)) {
    const piso = cascaArco(r2, p.largura, 0.05, p.elevacao, MAT.grade, a0, aL);
    piso.receiveShadow = true;
    piso.castShadow = true;
    grupo.add(piso);
  }

  /* Consoles (Fase 25): o piso se apoia num braco soldado ao CASCO — atraves
   * do isolamento, de `rCasco` ate a borda —, com o topo rente a grade, e
   * numa mao-francesa a 45° do braco ate o costado. Eram chapinhas de 2 cm
   * que comecavam 2 cm fora do isolamento: a plataforma inteira ficava no
   * ar, sem tocar o vaso. [ADOTADO] perfil de 120 x 80 mm, mao-francesa de
   * tubo de 60 mm a 3/4 da largura. */
  const hBraco = 0.12;
  const lBraco = r2 - rCasco + 0.005;
  const geoCons = new THREE.BoxGeometry(lBraco, hBraco, 0.08);
  const nCons = 10;
  const rMao = r1 + 0.75 * p.largura, quedaMao = rMao - rCasco;
  const geoMao = new THREE.CylinderGeometry(0.03, 0.03, Math.SQRT2 * quedaMao, 8);
  for (let i = 0; i < nCons; i++) {
    const a = ((i + 0.5) / nCons) * Math.PI * 2;
    if (dentroDe(cortes, a, 0.06)) continue;
    const dirA = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const c = new THREE.Mesh(geoCons, MAT.acoCarbono);
    c.position.copy(dirA).multiplyScalar(rCasco - 0.005 + lBraco / 2).setY(p.elevacao - hBraco / 2);
    c.rotation.y = -a;
    c.castShadow = true;
    grupo.add(c);
    // mao-francesa: da face de baixo do braco, a 3/4 da largura, ate o costado
    const de = dirA.clone().multiplyScalar(rMao).setY(p.elevacao - hBraco);
    const ate = dirA.clone().multiplyScalar(rCasco - 0.01).setY(p.elevacao - hBraco - quedaMao);
    const m = new THREE.Mesh(geoMao, MAT.acoCarbono);
    m.position.copy(de).add(ate).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), de.clone().sub(ate).normalize());
    m.castShadow = true;
    grupo.add(m);
  }

  // guarda-corpo: um arco entre cada par de escadas vizinhas. Os montantes
  // ficam registrados (local do grupo) para o que se prende neles — a
  // luminaria da Fase 26: pe no piso, normal para fora, e se e ponta de vao
  const geoPoste = new THREE.CylinderGeometry(0.022, 0.022, p.guardaCorpo, 8);
  const montantes = [];
  for (const { a0, aL } of arcosEntre(vaos)) {
    // rodape (toe board)
    grupo.add(cascaArco(r2 + 0.01, 0.012, 0.1, p.elevacao + 0.05, MAT.guardaCorpo, a0, aL));

    // montantes, com um em cada ponta do vao da escada
    const nPostes = Math.max(3, Math.round((aL * r2) / 1.4));
    for (let i = 0; i <= nPostes; i++) {
      const a = a0 + (i / nPostes) * aL;
      const poste = new THREE.Mesh(geoPoste, MAT.guardaCorpo);
      poste.position.set(
        Math.cos(a) * (r2 - 0.05),
        p.elevacao + 0.05 + p.guardaCorpo / 2,
        Math.sin(a) * (r2 - 0.05),
      );
      poste.castShadow = true;
      grupo.add(poste);
      montantes.push({
        p: new THREE.Vector3(Math.cos(a) * (r2 - 0.05), p.elevacao + 0.05, Math.sin(a) * (r2 - 0.05)),
        fora: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), r: 0.022, vao: i === 0 || i === nPostes,
      });
    }

    // corrimao superior e intermediario: o toro nasce em +X e vai para +Y no
    // plano dele. Euler XYZ aplica z antes de x: girado de a0 em z e deitado
    // (x = 90°, que leva +Y a +Z), cobre exatamente [a0, a0 + aL].
    for (const h of [p.guardaCorpo, p.guardaCorpo * 0.5]) {
      const rail = new THREE.Mesh(
        new THREE.TorusGeometry(r2 - 0.05, 0.02, 8, 96, aL),
        MAT.guardaCorpo,
      );
      rail.rotation.x = Math.PI / 2;
      rail.rotation.z = a0;
      rail.position.y = p.elevacao + 0.05 + h;
      grupo.add(rail);
    }
  }

  grupo.userData.montantes = montantes;
  grupo.userData.anel = r2 - 0.05;          // o guarda-corpo e um anel: distancia pelo arco
  return grupo;
}

/* -------------------------------------------------------------------------
 * ESCADA VERTICAL COM GAIOLA DE SEGURANCA
 * ---------------------------------------------------------------------- */
export function criarEscada({ yBase, yTopo, raio, angulo, largura = 0.6, fixarEm = null, costado = null, alemDoTopo = 1.0 }) {
  const grupo = new THREE.Group();
  grupo.name = 'escada';

  const a = THREE.MathUtils.degToRad(angulo);
  const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const tang = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
  const altura = yTopo - yBase;
  if (altura <= 0) return grupo;

  const base = dir.clone().multiplyScalar(raio);

  // As longarinas pousam num bloco de concreto, como na obra (o pe da escada
  // e chumbado num pedestal). Nascendo rentes ao piso, a face de baixo delas
  // disputava o z-buffer com a laje e o apoio ficava fora de qualquer base.
  const pe = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2 + PLINTO, largura + 0.3), MAT.concreto,
  );
  pe.position.copy(base);
  pe.position.y = yBase - 0.1 + PLINTO / 2;
  pe.rotation.y = -a;
  pe.receiveShadow = true;
  grupo.add(pe);

  // longarinas: passam `alemDoTopo` do piso de chegada (NR-12: onde segurar
  // ao sair da escada para a plataforma)
  const hLong = altura - PLINTO + alemDoTopo;
  const geoLong = new THREE.CylinderGeometry(0.025, 0.025, hLong, 8);
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(geoLong, MAT.guardaCorpo);
    l.position.copy(base).addScaledVector(tang, (s * largura) / 2);
    l.position.y = yBase + PLINTO + hLong / 2;
    l.castShadow = true;
    grupo.add(l);
  }

  // degraus a cada 300 mm, de longarina a longarina (na tangente: girados
  // por Euler eles saiam na radial, soltos no meio da escada — Fase 25)
  const nDeg = Math.floor(altura / 0.3);
  const geoDeg = new THREE.CylinderGeometry(0.014, 0.014, largura, 6);
  const qDeg = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tang);
  for (let i = 1; i <= nDeg; i++) {
    const d = new THREE.Mesh(geoDeg, MAT.guardaCorpo);
    d.position.copy(base);
    d.position.y = yBase + i * 0.3;
    d.quaternion.copy(qDeg);
    grupo.add(d);
  }

  /* Gaiola: aros a cada 900 mm a partir de 2,2 m do piso. Cada aro e um arco
   * de raio rG que passa por fora da escada e termina NAS longarinas (Fase
   * 25): o centro fica a sqrt(rG² - (L/2)²) para fora do plano delas e o arco
   * cobre +-phi em volta da direcao para fora, com sin(phi) = (L/2)/rG do
   * lado de tras. Antes o giro do arco tinha o sinal trocado: a gaiola saia
   * torta, 27° fora da escada, com as pontas soltas no ar. */
  const rG = 0.36, meiaL = largura / 2;
  const cG = Math.sqrt(Math.max(0, rG * rG - meiaL * meiaL));
  const meioArco = Math.PI - Math.asin(Math.min(0.99, meiaL / rG));
  const centroG = base.clone().addScaledVector(dir, cG);
  const yGaiola0 = yBase + 2.2;
  const aros = [];
  for (let y = yGaiola0; y <= yTopo - 0.2; y += 0.9) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(rG, 0.016, 6, 28, 2 * meioArco), MAT.guardaCorpo);
    aro.rotation.x = Math.PI / 2;
    aro.rotation.z = a - meioArco;          // o arco cobre [a - meioArco, a + meioArco]
    aro.position.copy(centroG);
    aro.position.y = y;
    grupo.add(aro);
    aros.push(y);
  }

  // barras verticais da gaiola, entre as pontas do arco
  if (aros.length > 1) {
    const yA = aros[0], yB = aros[aros.length - 1];
    const h = yB - yA;
    const geoBarra = new THREE.CylinderGeometry(0.012, 0.012, h, 6);
    for (let i = 1; i <= 5; i++) {
      const ang = a - meioArco + (i / 6) * 2 * meioArco;
      const b = new THREE.Mesh(geoBarra, MAT.guardaCorpo);
      b.position.set(centroG.x + Math.cos(ang) * rG, yA + h / 2, centroG.z + Math.sin(ang) * rG);
      grupo.add(b);
    }
  }

  /* Fixacao (Fase 25): no topo, uma chapa de cada longarina ate a borda da
   * plataforma (`fixarEm`, raio dela); no corpo, um grampo de cada longarina
   * ate o costado (`costado`, raio dele) a cada 2,5 m — sem isso a escada
   * ficava de pe sozinha, a 3 cm do piso a que serve. */
  const barra = (p0, p1, secao = 0.04) => {
    const d = p1.clone().sub(p0), L = d.length();
    const b = new THREE.Mesh(new THREE.BoxGeometry(secao, L, secao), MAT.guardaCorpo);
    b.position.copy(p0).addScaledVector(d, 0.5);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    grupo.add(b);
  };
  for (const s of [-1, 1]) {
    const lat = (s * largura) / 2;
    if (fixarEm !== null) {
      const y = yTopo - 0.04;
      const p0 = base.clone().addScaledVector(tang, lat).setY(y);
      barra(p0, dir.clone().multiplyScalar(Math.sqrt(Math.max(0, fixarEm * fixarEm - lat * lat)) - 0.02).addScaledVector(tang, lat).setY(y), 0.05);
    }
    if (costado !== null) {
      const rIn = Math.sqrt(Math.max(0, costado * costado - lat * lat)) - 0.01;
      for (let y = yBase + 1.5; y < yTopo - 0.6; y += 2.5) {
        const p0 = base.clone().addScaledVector(tang, lat).setY(y);
        barra(p0, dir.clone().multiplyScalar(rIn).addScaledVector(tang, lat).setY(y));
      }
    }
  }

  return grupo;
}

/**
 * ===========================================================================
 *  BERCOS (saddles) — suportacao de vaso HORIZONTAL
 * ===========================================================================
 *  Cada berco e uma chapa em arco que abraca o costado por ~120 graus, sobre
 *  um bloco de concreto. O perfil e desenhado no plano XY e extrudado ao longo
 *  de Z, que e o eixo do vaso deitado.
 *
 *  Origem local: y = 0 no EIXO do vaso, z = 0 no meio do comprimento.
 */
export function criarBercos({ R, b, Ltan, hEixo, hFund, larguraFund = 0.45 }) {
  const grupo = new THREE.Group();
  grupo.name = 'bercos';
  const meio = Ltan / 2;
  const abraco = Math.PI / 3;                  // meio-angulo de contato
  const sen = Math.sin(abraco), cos = Math.cos(abraco);
  const yBase = -hEixo + hFund;                // topo do bloco, no referencial do eixo

  for (const s of [-1, 1]) {
    const z = s * (meio - b.fracao * Ltan);

    const forma = new THREE.Shape();
    forma.moveTo(-R * sen, yBase);
    forma.lineTo(-R * sen, -R * cos);
    // arco por baixo do costado, de -sen para +sen
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + (Math.PI / 2 - abraco) + (i / 24) * (2 * abraco);
      forma.lineTo(R * Math.cos(a), R * Math.sin(a));
    }
    forma.lineTo(R * sen, yBase);
    forma.closePath();

    const chapa = new THREE.Mesh(
      new THREE.ExtrudeGeometry(forma, { depth: b.largura, bevelEnabled: false }),
      MAT.acoCarbono,
    );
    chapa.position.z = z - b.largura / 2;
    chapa.castShadow = true;
    chapa.receiveShadow = true;
    grupo.add(chapa);

    // Estende 5 cm para baixo do piso: a face inferior nao pode cair no plano
    // do topo da laje, mesmo sendo uma face que so se ve por baixo.
    const bloco = new THREE.Mesh(
      new THREE.BoxGeometry(2 * R * sen + 0.25, hFund + 0.05, larguraFund),
      MAT.concreto,
    );
    bloco.position.set(0, -hEixo + hFund / 2 - 0.025, z);
    bloco.receiveShadow = true;
    grupo.add(bloco);
  }
  return grupo;
}

/**
 * Plataforma retangular de operacao (Fase 18): piso de grade de w (x) por d
 * (z) a `y` m, sobre quatro colunas ate o piso, com rodape e guarda-corpo
 * de 1,1 m (NR-12) nos lados que nao estao em `abertos`. `vao` deixa uma
 * abertura de 0,8 m no guarda-corpo onde chega a escada: { lado, u } com u
 * a partir do meio do lado. Origem no centro do piso, no chao.
 */
export function criarPlataformaRetangular({ w, d, y, abertos = [], vao = null, colunas = 'cantos', xColunas = null }) {
  const g = new THREE.Group();
  g.name = 'plataforma';
  const piso = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), MAT.grade);
  piso.position.y = y - 0.025;
  g.add(piso);
  // colunas nos quatro cantos, ou so na borda +z com mao-francesa ate a
  // borda -z (quando embaixo do lado -z passa um corredor)
  // `xColunas`: onde ficam as colunas em x (local), quando a ponta do piso
  // passa em balanco sobre algo que nao pode ter coluna (corredor)
  const [xa, xb] = xColunas ?? [-w / 2 + 0.06, w / 2 - 0.06];
  const pes = colunas === '+z'
    ? [[xa, d / 2 - 0.06], [xb, d / 2 - 0.06]]
    : [[xa, -d / 2 + 0.06], [xb, -d / 2 + 0.06], [xb, d / 2 - 0.06], [xa, d / 2 - 0.06]];
  if (colunas === '+z') {
    for (const [x, z] of pes) {
      const a = new THREE.Vector3(x, y - 1.1, z), b = new THREE.Vector3(x, y - 0.2, -d / 2 + 0.06);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, a.distanceTo(b), 0.08), MAT.acoCarbono);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(m);
    }
  }
  for (const [x, z] of pes) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, y - 0.05, 0.12), MAT.acoCarbono);
    col.position.set(x, (y - 0.05) / 2, z);
    col.castShadow = true;
    g.add(col);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.35), MAT.concreto);
    base.position.set(x, 0.05, z);
    g.add(base);
  }
  // vigas de borda sob o piso
  for (const [lw, ld, x, z] of [[w, 0.1, 0, -d / 2 + 0.05], [w, 0.1, 0, d / 2 - 0.05], [0.1, d, -w / 2 + 0.05, 0], [0.1, d, w / 2 - 0.05, 0]]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.15, ld), MAT.acoCarbono);
    v.position.set(x, y - 0.125, z);
    g.add(v);
  }
  const montantes = [];
  const FORA = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] };
  const LADOS = {
    '-z': { a: [-w / 2, -d / 2], b: [w / 2, -d / 2] }, '+z': { a: [-w / 2, d / 2], b: [w / 2, d / 2] },
    '-x': { a: [-w / 2, -d / 2], b: [-w / 2, d / 2] }, '+x': { a: [w / 2, -d / 2], b: [w / 2, d / 2] },
  };
  for (const [lado, { a, b }] of Object.entries(LADOS)) {
    if (abertos.includes(lado)) continue;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    // trechos do lado, menos o vao da escada
    const trechos = vao?.lado === lado ? [[0, L / 2 + vao.u - 0.4], [L / 2 + vao.u + 0.4, L]] : [[0, L]];
    for (const [s0, s1] of trechos) {
      if (s1 - s0 < 0.05) continue;
      const m = [(a[0] + t[0] * (s0 + s1) / 2), (a[1] + t[1] * (s0 + s1) / 2)];
      const deitado = Math.abs(t[0]) > 0.5;
      for (const [h, alt] of [[1.1, 0.04], [0.55, 0.04], [0.075, 0.15]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(deitado ? s1 - s0 : 0.03, alt, deitado ? 0.03 : s1 - s0),
          h < 0.1 ? MAT.acoCarbono : MAT.guardaCorpo);
        p.position.set(m[0], y + h, m[1]);
        g.add(p);
      }
      const n = Math.max(1, Math.ceil((s1 - s0) / 1.2));
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n;
        const poste = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.04), MAT.guardaCorpo);
        poste.position.set(a[0] + t[0] * s, y + 0.55, a[1] + t[1] * s);
        g.add(poste);
        montantes.push({
          p: new THREE.Vector3(a[0] + t[0] * s, y, a[1] + t[1] * s),
          fora: new THREE.Vector3(FORA[lado][0], 0, FORA[lado][1]), r: 0.02,
          vao: vao?.lado === lado && Math.abs(s - (L / 2 + vao.u)) < 0.45,
        });
      }
    }
  }
  g.userData.montantes = montantes;
  return { grupo: g };
}
