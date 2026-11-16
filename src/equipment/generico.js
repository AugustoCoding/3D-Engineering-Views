import * as THREE from 'three';
import { MAT } from '../core/materials.js';
import { perfilTampo, alturaNoRaio } from '../lib/profiles.js';
import { criarCamisa } from '../lib/vessel.js';
import { criarAgitador } from '../lib/agitator.js';
import { rotulo } from '../lib/dimensions.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { PLINTO, criarPernas, cascaComJanelas, janelasDaSaia } from '../lib/supports.js';
import { criarBombaCentrifuga, criarBombaDeslocamento, criarBombaVacuo } from '../lib/bomba.js';
import { DN } from '../data/plant.js';
import { EXTRAS, BOCAIS_EXTRA } from '../data/plant-extra.js';

/**
 * ===========================================================================
 *  CONSTRUTOR GENERICO DAS DEMAIS OPERACOES UNITARIAS
 * ===========================================================================
 *  Cinco tipos cobrem tudo que falta na planta:
 *
 *    vaso-vertical    — flash, cristalizadores, dissolvedor (agitados ou nao,
 *                       encamisados ou nao)
 *    trocador         — casco e tubo horizontal, com carretel e espelhos
 *    filtro-rotativo  — tambor girando dentro de uma cuba
 *    skid             — base com equipamento de pacote (compressor)
 *    bomba-centrifuga — bomba de processo com motor (lib/bomba.js)
 *    bomba-deslocamento — bomba de torta com tremonha (lib/bomba.js)
 *    bomba-vacuo      — anel liquido com separador (lib/bomba.js)
 *
 *  Um arquivo por equipamento so se justifica quando ha detalhe proprio, como
 *  no R-01. Aqui a geometria e a mesma familia repetida com numeros
 *  diferentes, entao um construtor parametrico e mais honesto — e mantem os
 *  nove equipamentos coerentes entre si sem copiar codigo nove vezes.
 */

const SEG = 48;

/* O tambor em operacao e a tela coberta pela torta de cristais, clara e
 * fosca: e o que se ve pelo visor, contra o inox do capo. */
const TORTA = new THREE.MeshStandardMaterial({ color: 0xe6e0cf, metalness: 0, roughness: 0.95, name: 'torta' });

function marcar(obj, ficha) { obj.userData.ficha = ficha; return obj; }

function fichaDe(eq) {
  return {
    titulo: eq.tag,
    subtitulo: eq.nome,
    grupos: [
      { nome: 'Serviço', dados: { 'Função': eq.servico } },
      { nome: 'Dados de projeto', dados: eq.ficha },
    ],
  };
}

/** Casco de revolucao simples (sem espessura): suficiente para contexto. */
function cascoVertical(Di, Ltan, tampoTopo = 'eliptico', tampoFundo = tampoTopo) {
  const R = Di / 2;
  const pts = [];
  const pf = perfilTampo(tampoFundo, R);
  for (let i = pf.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(pf[i].x, -pf[i].y));
  pts.push(new THREE.Vector2(R, 0), new THREE.Vector2(R, Ltan));
  for (const p of perfilTampo(tampoTopo, R)) pts.push(new THREE.Vector2(p.x, p.y + Ltan));
  const geo = new THREE.LatheGeometry(pts, SEG);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, MAT.inox);
  m.castShadow = true;
  m.receiveShadow = true;
  return { mesh: m, R, alturaTopo: Ltan + perfilTampo(tampoTopo, R).at(-1).y };
}

/* Camisa sem geometria nos dados (cadastro antigo): proporcao do costado. */
const CAMISA_PADRAO = (g) => ({ base: g.Ltan * 0.03, altura: g.Ltan * 0.82, folga: 0.09 });

/* ==========================================================================
 *  VASO VERTICAL
 *  Apoio por saia (`saiaAltura`) ou por pernas (`elevacao` + `pernas`).
 * ======================================================================= */
function vasoVertical(eq) {
  const g = eq.geom;
  const raiz = new THREE.Group();
  const tFundo = g.tampoFundo ?? g.tampo ?? 'eliptico';
  const c = cascoVertical(g.Di, g.Ltan, g.tampo ?? 'eliptico', tFundo);
  raiz.add(marcar(c.mesh, fichaDe(eq)));

  // camisa de troca termica, onde os dados dizem que ela esta: chapa de aco
  // fechada no costado por um anel em cima e outro embaixo (lib/vessel.js),
  // como a do R-01. Era um cilindro aberto e semitransparente, solto a 9 cm
  // do costado — a "pelicula" (Fase 25).
  const cam = g.camisa ? (typeof g.camisa === 'object' ? g.camisa : CAMISA_PADRAO(g)) : null;
  if (cam) {
    const camisa = criarCamisa({ R: c.R, base: cam.base, altura: cam.altura, folga: cam.folga });
    raiz.add(marcar(camisa, {
      titulo: `${eq.tag} — camisa`,
      subtitulo: 'Superfície de troca térmica',
      grupos: [{ nome: 'Dados', dados: eq.ficha }],
    }));
  }

  // liquido interno
  if (g.nivel) {
    const pts = [];
    const pf = perfilTampo(tFundo, c.R - 0.01);
    for (let i = pf.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(pf[i].x, -pf[i].y));
    pts.push(new THREE.Vector2(c.R - 0.01, 0), new THREE.Vector2(c.R - 0.01, g.nivel),
      new THREE.Vector2(0, g.nivel));
    const liq = new THREE.Mesh(new THREE.LatheGeometry(pts, SEG), MAT.liquido);
    raiz.add(liq);
  }

  // agitador: motor no topo, sobre o bocal de montagem — um pescoco que
  // nasce dentro do tampo (abaixo do apice o quanto o tampo cai no raio dele)
  // e leva o redutor; sem ele o redutor flutuava 7 cm acima do apice
  if (g.agitador) {
    const yF = c.alturaTopo;
    const acion = new THREE.Group();
    const rPesc = 0.2, queda = alturaNoRaio(g.tampo ?? 'eliptico', c.R, 0) - alturaNoRaio(g.tampo ?? 'eliptico', c.R, rPesc);
    const pesc = new THREE.Mesh(new THREE.CylinderGeometry(rPesc, rPesc, 0.07 + queda + 0.01, SEG), MAT.flange);
    pesc.position.y = yF + (0.07 - queda - 0.01) / 2;
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), MAT.redutor);
    red.position.y = yF + 0.28;
    acion.add(pesc);
    const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.7, 20), MAT.motor);
    mot.position.y = yF + 0.84;
    acion.add(red, mot);
    acion.castShadow = true;
    raiz.add(acion);
    // eixo e impelidores por dentro (Fase 27, item 5): so a parte que gira
    // de lib/agitator.js — o acionamento de fora e o de cima, ja apoiado.
    // Gira na rotacao do Datasheet (site/animacoes.js)
    if (typeof g.agitador === 'object') {
      // no referencial do casco a tangencia inferior e y = 0 (a elevacao vem
      // depois, para o conjunto): a altura do Datasheet vale direto
      const a = g.agitador;
      const gira = criarAgitador(a, yF, a.alturaPrimeiro - 0.15).userData.girante;
      gira.removeFromParent();
      gira.userData.girante = true;
      gira.userData.rpm = g.agitador.rotacao;
      raiz.add(gira);
    }
  }

  const elevacao = g.pernas ? g.elevacao : g.saiaAltura;

  if (g.pernas) {
    // Pernas encostam na camisa, se houver; senao, no costado.
    const rApoio = c.R + (cam ? cam.folga + 0.01 : 0);
    /* O contraventamento vive no plano entre duas pernas vizinhas, a uma
     * distancia do eixo de rp.cos(180°/n). So pode subir ate onde o fundo
     * ja se afastou desse plano, com 10 cm de folga. */
    const rp = rApoio + g.pernas.lado / 2;
    const dPlano = rp * Math.cos(Math.PI / g.pernas.n) - 0.1;
    const yMax = dPlano >= c.R ? 0 : -alturaNoRaio(tFundo, c.R, dPlano) - 0.1;
    raiz.add(criarPernas({
      R: rApoio,
      yPiso: -elevacao,
      yFixacao: g.pernas.fixacao,
      n: g.pernas.n,
      lado: g.pernas.lado,
      yContraventoMax: yMax,
    }));
  } else {
    // A saia encosta no costado na linha de tangencia; com 0,97 R ela subia
    // por dentro do tampo inferior. As janelas deixam passar a linha que sai
    // do bocal de fundo (supports.js).
    raiz.add(cascaComJanelas(
      c.R, g.saiaEspessura ?? 0.008, g.saiaAltura, -g.saiaAltura, MAT.acoCarbono, janelasDaSaia(g),
    ));

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(g.Di * 1.5, 0.3 + PLINTO, g.Di * 1.5), MAT.concreto,
    );
    base.position.y = -g.saiaAltura - 0.15 + PLINTO / 2;
    base.receiveShadow = true;
    raiz.add(base);
  }

  raiz.position.y = elevacao;
  return { raiz, altura: elevacao + c.alturaTopo };
}

/* ==========================================================================
 *  TROCADOR CASCO E TUBO
 * ======================================================================= */
function trocador(eq) {
  const g = eq.geom;
  const raiz = new THREE.Group();
  const R = g.Di / 2;

  const casco = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, g.L, SEG), MAT.inox,
  );
  casco.rotation.z = Math.PI / 2;
  casco.castShadow = true;
  raiz.add(marcar(casco, fichaDe(eq)));

  // espelhos e carreteis nas pontas
  for (const s of [-1, 1]) {
    const espelho = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 1.15, R * 1.15, 0.07, SEG), MAT.flange,
    );
    espelho.rotation.z = Math.PI / 2;
    espelho.position.x = s * g.L / 2;
    raiz.add(espelho);

    const carretel = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R * 0.92, R * 0.9, SEG), MAT.acoCarbono,
    );
    carretel.rotation.z = -s * Math.PI / 2;
    carretel.position.x = s * (g.L / 2 + R * 0.45);
    carretel.castShadow = true;
    raiz.add(carretel);
  }

  // Os bocais vem da tabela (plant-extra.js, derivados de GEOM): dois bocais
  // fixos de enfeite aqui chegaram a ficar sobre o casco sem linha nenhuma.

  // selas
  for (const s of [-1, 1]) {
    const sela = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, g.alturaEixo - R * 0.4, R * 1.7), MAT.acoCarbono,
    );
    sela.position.set(s * g.L * 0.3, -(g.alturaEixo - R * 0.4) / 2 - R * 0.6, 0);
    sela.castShadow = true;
    raiz.add(sela);
    const bloco = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.33, R * 2), MAT.concreto);
    bloco.position.set(s * g.L * 0.3, -g.alturaEixo + 0.14 - 0.025, 0);
    bloco.receiveShadow = true;
    raiz.add(bloco);
  }

  raiz.position.y = g.alturaEixo;
  return { raiz, altura: g.alturaEixo + R };
}

/* ==========================================================================
 *  FILTRO ROTATIVO A VACUO
 * ======================================================================= */
function filtroRotativo(eq) {
  const g = eq.geom;
  const raiz = new THREE.Group();
  const R = g.D / 2;

  const tambor = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, g.L, SEG), TORTA,
  );
  tambor.rotation.x = Math.PI / 2;
  tambor.castShadow = true;
  const girante = new THREE.Group();
  girante.add(marcar(tambor, fichaDe(eq)));

  // setores da tela filtrante, para o tambor nao ficar liso
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const nervura = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, g.L * 0.98), MAT.acoCarbono,
    );
    nervura.position.set(Math.cos(a) * R * 1.01, Math.sin(a) * R * 1.01, 0);
    girante.add(nervura);
  }
  girante.rotation.x = 0;
  raiz.add(girante);
  raiz.userData.girante = girante;

  /* --------------------------------------------------------------------
   * CUBA (trough) E LICOR
   *
   * A cuba e um BERCO: abraca a metade de BAIXO do tambor, que mergulha nela.
   * O setor do cilindro precisa portanto apontar para -Y depois de deitado.
   *
   * Como se chega ai: `rotation.x = PI/2` leva o eixo do cilindro de Y para Z
   * (deita o tambor) e, no caminho, leva a direcao +Z local para -Y. Logo o
   * setor tem de estar centrado em +Z ANTES de girar, e theta = 0 e exatamente
   * +Z no CylinderGeometry. Dai `thetaStart = -metade` e nenhuma outra rotacao.
   *
   * Estava com `thetaStart = 0,15 PI` (setor centrado em +X) mais um
   * `rotation.z = PI` que o jogava para -X: a cuba nascia grudada na LATERAL do
   * tambor, em pe, em vez de embaixo dele.
   * ------------------------------------------------------------------ */
  const R_CUBA = R * 1.22;
  const MEIA_CUBA = Math.PI * 0.42;          // meio-angulo de abraco
  // a cuba e o capo terminam nas testeiras, logo antes dos mancais (L/2 + 0,04)
  const H = g.L / 2 + 0.025;

  const cuba = new THREE.Mesh(
    new THREE.CylinderGeometry(R_CUBA, R_CUBA, 2 * H, SEG, 1, true,
      -MEIA_CUBA, MEIA_CUBA * 2),
    MAT.acoCarbono,
  );
  cuba.rotation.x = Math.PI / 2;
  cuba.receiveShadow = true;
  raiz.add(cuba);

  /* Licor: a regiao entre o arco da cuba e a linha HORIZONTAL do nivel.
   * Era uma caixa de R*1,9 de largura — mais larga que o proprio tambor na
   * altura em que ficava, entao atravessava a parede dele e escapava da cuba
   * pelos lados. Um perfil extrudado acompanha o arco e ainda assim deixa a
   * superficie plana, que e como liquido se comporta. O tambor mergulha ~29 %
   * do diametro, dentro da faixa usual de 30 % de um filtro rotativo. */
  const R_LICOR = R_CUBA * 0.99;             // um fio dentro da chapa da cuba
  const Y_NIVEL = -R * 0.42;
  const phi = Math.acos(-Y_NIVEL / R_LICOR);

  const perfil = new THREE.Shape();
  perfil.moveTo(-R_LICOR * Math.sin(phi), Y_NIVEL);
  for (let i = 0; i <= 40; i++) {
    const a = -phi + (i / 40) * 2 * phi;
    perfil.lineTo(R_LICOR * Math.sin(a), -R_LICOR * Math.cos(a));
  }
  perfil.closePath();

  const licor = new THREE.Mesh(
    new THREE.ExtrudeGeometry(perfil, { depth: 2 * H, bevelEnabled: false }),
    MAT.liquido,
  );
  licor.position.z = -H;                     // ExtrudeGeometry cresce de z = 0
  raiz.add(licor);

  /* --------------------------------------------------------------------
   * EIXO E ACIONAMENTO
   * O eixo era 1,5 L — 0,63 m de balanco para fora do bloco de fundacao — e o
   * motor comecava 10 cm DEPOIS da ponta dele: boiava no ar a 1,9 m do chao,
   * sem eixo e sem apoio. Agora o eixo cabe no bloco, o motor encosta na ponta
   * e ambos descarregam em mancais que descem ate a fundacao.
   * ------------------------------------------------------------------ */
  /* Todo o acionamento vive FORA do vulto do tambor, que vai ate z = L/2.
   * Na primeira versao o motor ficava em L/2 + 0,11 e o pedestal descia do
   * chao no eixo x = 0: o pedestal entrava 0,82 m DENTRO do tambor. Um apoio
   * que nasce no piso nunca pode cruzar o corpo que ele sustenta — e a regra
   * APOIO_ATRAVESSA da auditoria existe justamente para nao deixar passar. */
  const Z_MANCAL = g.L / 2 + 0.15;           // logo depois da tampa do tambor
  const Z_ACION = g.L / 2 + 0.56;            // motor e seu pedestal
  const L_EIXO = g.L + 1.7;                  // ponta em L/2 + 0,85

  const eixo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, L_EIXO, 16), MAT.inox);
  eixo.rotation.x = Math.PI / 2;
  raiz.add(eixo);

  for (const s of [-1, 1]) {                 // mancais nas duas pontas do eixo
    const mancal = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, g.alturaEixo - 0.1, 0.22), MAT.acoCarbono,
    );
    mancal.position.set(0, -(g.alturaEixo - 0.1) / 2 - 0.1, s * Z_MANCAL);
    mancal.castShadow = true;
    mancal.receiveShadow = true;
    raiz.add(mancal);
  }

  const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.55, 20), MAT.motor);
  mot.rotation.x = Math.PI / 2;
  mot.position.z = Z_ACION;
  mot.castShadow = true;
  raiz.add(mot);

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, g.alturaEixo - 0.17, 0.3), MAT.acoCarbono,
  );
  pedestal.position.set(0, -(g.alturaEixo - 0.17) / 2 - 0.17, Z_ACION);
  pedestal.castShadow = true;
  raiz.add(pedestal);

  /* Cabecote de valvula na ponta oposta ao acionamento: e por ele que o vacuo
   * chega aos setores do tambor (bocal V em BOCAIS_EXTRA, a L/2 + 0,45).
   * Encosta na face do mancal, que o segura; o eixo passa por dentro. */
  const cabecote = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 24), MAT.acoCarbono);
  cabecote.rotation.x = Math.PI / 2;
  cabecote.position.z = -(g.L / 2 + 0.43);
  cabecote.castShadow = true;
  raiz.add(cabecote);

  /* Pernas do portico. Ficavam em 1,15 R, DENTRO do raio da cuba (1,22 R):
   * nesse x o arco da cuba passa em y = -0,41 R, e a perna, que sobe do chao
   * ate o eixo, atravessava a chapa. Agora correm por fora do berco. */
  const X_PERNA = R_CUBA * 1.12;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const perna = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, g.alturaEixo, 0.12), MAT.acoCarbono,
      );
      perna.position.set(sx * X_PERNA, -g.alturaEixo / 2, sz * g.L * 0.42);
      perna.castShadow = true;
      raiz.add(perna);
    }
  }
  const base = new THREE.Mesh(                // cobre ate a ponta do eixo
    new THREE.BoxGeometry(X_PERNA * 2.3, 0.25 + PLINTO, g.L + 1.9), MAT.concreto,
  );
  base.position.y = -g.alturaEixo - 0.12 + PLINTO / 2;
  base.receiveShadow = true;
  raiz.add(base);

  /* CAPO (27/10, pedido do autor: a cuba aberta deixava o licor a mostra).
   * Licor-mae e torta levam tolueno (ponto de fulgor 4 °C): o filtro trabalha
   * fechado e inertizado, com o capo aparafusado na borda da cuba [ADOTADO,
   * pratica de filtro rotativo com solvente inflamavel]. O capo e um arco do
   * mesmo raio da cuba, de uma borda dela a outra, por cima; a torta raspada
   * cai no N3, no capo logo acima da borda +x (linha 23). Testeiras fecham
   * as pontas antes dos mancais. Dois visores no alto mostram o tambor girar.
   *
   * O tambor gira no sentido horario visto de +z: sai do licor no lado -x,
   * passa pela lavagem, seca por cima e e raspado no lado +x, sobre o N3.
   * (Na Fase 18 o raspador e a calha estavam no lado -x, longe do N3.)
   * ------------------------------------------------------------------ */
  const setor = (phi0, phi1, z0, z1, mat) => {
    // phi no plano do tambor (0 = +x, 90° = topo); theta do cilindro = phi + 90°
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(R_CUBA, R_CUBA, z1 - z0, SEG, 1, true, phi0 + Math.PI / 2, phi1 - phi0), mat,
    );
    m.rotation.x = Math.PI / 2;
    m.position.z = (z0 + z1) / 2;
    return m;
  };
  const grau = THREE.MathUtils.degToRad;
  const PHI_DESC = -(Math.PI / 2 - MEIA_CUBA);         // borda da cuba no lado +x (descarga)
  const PHI_BORDA = Math.PI + (Math.PI / 2 - MEIA_CUBA); // borda da cuba no lado -x
  const VISOR = [grau(50), grau(95)];                  // faixa dos visores, no alto
  const zVisor = [[-0.4 * g.L, -0.04 * g.L], [0.04 * g.L, 0.4 * g.L]];
  const capo = new THREE.Group();
  capo.add(setor(PHI_DESC, VISOR[0], -H, H, MAT.inox));
  capo.add(setor(VISOR[1], PHI_BORDA, -H, H, MAT.inox));
  // entre os visores e nas pontas, chapa; nos visores, vidro
  for (const [z0, z1] of [[-H, zVisor[0][0]], [zVisor[0][1], zVisor[1][0]], [zVisor[1][1], H]]) capo.add(setor(VISOR[0], VISOR[1], z0, z1, MAT.inox));
  for (const [z0, z1] of zVisor) capo.add(setor(VISOR[0], VISOR[1], z0, z1, MAT.visor));
  capo.traverse((o) => { if (o.isMesh && o.material !== MAT.visor) { o.castShadow = true; o.receiveShadow = true; } });
  raiz.add(capo);
  // flanges: na junta capo-cuba e em volta dos visores, ao longo do tambor
  // (barra de pe no eixo y local, deitada depois: a auditoria le caixa larga
  // como corpo de revolucao em volta do y dela)
  for (const [phi, s] of [[PHI_DESC, 0.05], [PHI_BORDA, 0.05], [VISOR[0], 0.035], [VISOR[1], 0.035]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(s, 2 * H, s * 0.6), MAT.inox);
    f.position.set(Math.cos(phi) * (R_CUBA + s * 0.3), Math.sin(phi) * (R_CUBA + s * 0.3), 0);
    f.rotation.set(Math.PI / 2, 0, 0);
    f.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), phi);
    raiz.add(f);
  }
  // testeiras, com a gaxeta onde o eixo passa
  for (const s of [-1, 1]) {
    const testeira = new THREE.Mesh(new THREE.CylinderGeometry(R_CUBA, R_CUBA, 0.012, SEG), MAT.acoCarbono);
    testeira.rotation.x = Math.PI / 2;
    testeira.position.z = s * (H + 0.006);
    testeira.castShadow = true;
    raiz.add(testeira);
    const gx = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.003, 24), MAT.inox);
    gx.rotation.x = Math.PI / 2;
    gx.position.z = s * (H + 0.0135);
    raiz.add(gx);
  }

  /* Raspador e lavagem, por dentro do capo [ESTIMADO, proporcao de catalogo].
   * A lamina encosta no tambor 5° abaixo da horizontal, do lado +x, sobre o
   * N3; a barra de lavagem corre de testeira a testeira sobre o tambor que
   * sobe (lado -x), entre ele e o capo, e recebe a linha de lavagem pelo N4,
   * no alto do capo. */
  const aR = grau(-5);
  const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, g.L * 0.95), MAT.inox);
  lamina.position.set(Math.cos(aR) * (R + 0.04), Math.sin(aR) * (R + 0.04), 0);
  lamina.rotation.z = aR - Math.PI / 2 - 0.4;
  raiz.add(lamina);
  const folga = R_CUBA - R;
  const aB = grau(125), rB = R + folga * 0.6, rBarra = Math.min(0.035, folga * 0.15);
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(rBarra, rBarra, 2 * H, 12), MAT.inox);
  barra.rotation.x = Math.PI / 2;
  barra.position.set(Math.cos(aB) * rB, Math.sin(aB) * rB, 0);
  raiz.add(barra);
  for (let i = 0; i < 7; i++) {
    const rBico = R + folga * 0.35;
    const bico = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, folga * 0.3, 8), MAT.inox);
    bico.position.set(Math.cos(aB) * rBico, Math.sin(aB) * rBico, -g.L * 0.4 + (i * g.L * 0.8) / 6);
    bico.rotation.z = aB + Math.PI / 2;
    raiz.add(bico);
  }

  /* Vent do capo, com flange cega: a inertizacao com N2 e o vent para a
   * recuperacao de vapor nao estao no P&ID (pendencia no ROTEIRO). */
  const aV = grau(105), zV = -0.3 * g.L;
  const pV = [Math.cos(aV) * R_CUBA, Math.sin(aV) * R_CUBA];
  const pescoco = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 16), MAT.inox);
  pescoco.position.set(pV[0], pV[1] + 0.1, zV);
  raiz.add(pescoco);
  for (const [dy, r] of [[0.225, 0.075], [0.245, 0.075]]) {
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 20), MAT.acoCarbono);
    fl.position.set(pV[0], pV[1] + dy, zV);
    raiz.add(fl);
  }

  raiz.position.y = g.alturaEixo;
  return { raiz, altura: g.alturaEixo + R, girante };
}

/* ==========================================================================
 *  SKID (equipamento de pacote)
 * ======================================================================= */
function skid(eq) {
  const g = eq.geom;
  const raiz = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(g.L, 0.22, g.W), MAT.acoCarbono,
  );
  base.position.y = 0.11;
  base.receiveShadow = true;
  raiz.add(base);

  const corpo = new THREE.Mesh(
    new THREE.BoxGeometry(g.L * 0.72, g.H * 0.62, g.W * 0.78), MAT.motor,
  );
  corpo.position.set(-g.L * 0.1, 0.22 + g.H * 0.31, 0);
  corpo.castShadow = true;
  raiz.add(marcar(corpo, fichaDe(eq)));

  /* O acionamento POUSA no skid. Antes o centro ficava em 0,22 + H*0,28 e o
   * raio era H*0,24, o que deixava a geratriz de baixo em 0,22 + H*0,04 —
   * 7,6 cm de ar entre um redutor de varias toneladas e a base dele. */
  const rMotor = g.H * 0.24;
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(rMotor, rMotor, g.L * 0.34, 24), MAT.redutor,
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(g.L * 0.3, 0.22 + rMotor, 0);
  motor.castShadow = true;
  raiz.add(motor);

  const bloco = new THREE.Mesh(
    new THREE.BoxGeometry(g.L * 1.1, 0.26 + PLINTO, g.W * 1.2), MAT.concreto,
  );
  bloco.position.y = -0.13 + PLINTO / 2;
  bloco.receiveShadow = true;
  raiz.add(bloco);

  /* Cabine acustica de compressor de pacote (Fase 18): era uma caixa lisa.
   * Venezianas de ar nos lados longos, porta de inspecao, o painel de
   * comando na ponta oposta ao motor, a grade do ventilador do resfriador
   * em cima e a caixa de ligacao do motor. Proporcoes de catalogo [ESTIMADO]. */
  const xc = -g.L * 0.1, lc = g.L * 0.72, hc = g.H * 0.62, wc = g.W * 0.78, yTopo = 0.22 + hc;
  const peca = (dx, dy, dz, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), mat);
    m.position.set(x, y, z);
    raiz.add(m);
    return m;
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) peca(lc * 0.34, 0.035, 0.03, MAT.grade, xc - lc * 0.2, 0.22 + hc * 0.3 + i * hc * 0.07, s * (wc / 2 + 0.012));
    const xp = xc + lc * 0.22, wp = lc * 0.22, hp = hc * 0.75;
    for (const [dx, dy, x, y] of [[wp, 0.025, xp, 0.22 + 0.1], [wp, 0.025, xp, 0.22 + 0.1 + hp], [0.025, hp, xp - wp / 2, 0.22 + 0.1 + hp / 2], [0.025, hp, xp + wp / 2, 0.22 + 0.1 + hp / 2]]) {
      peca(dx, dy, 0.02, MAT.grade, x, y, s * (wc / 2 + 0.008));
    }
    peca(0.04, 0.12, 0.03, MAT.inox, xp + wp / 2 - 0.08, 0.22 + 0.1 + hp / 2, s * (wc / 2 + 0.02));
  }
  peca(0.18, hc * 0.55, wc * 0.5, MAT.instrumento, xc - lc / 2 - 0.09, 0.22 + hc * 0.45, 0);
  peca(0.02, hc * 0.14, wc * 0.22, MAT.grade, xc - lc / 2 - 0.185, 0.22 + hc * 0.58, 0);
  const grade = new THREE.Mesh(new THREE.CylinderGeometry(wc * 0.3, wc * 0.3, 0.08, 24), MAT.grade);
  grade.position.set(xc + lc * 0.22, yTopo + 0.04, 0);
  raiz.add(grade);
  for (let i = -2; i <= 2; i++) peca(0.02, 0.02, wc * 0.58, MAT.acoCarbono, xc + lc * 0.22 + i * wc * 0.1, yTopo + 0.09, 0);
  peca(rMotor * 0.9, rMotor * 0.55, rMotor * 0.9, MAT.redutor, g.L * 0.33, 0.22 + 2 * rMotor + rMotor * 0.27, 0);
  const tampa = new THREE.Mesh(new THREE.CylinderGeometry(rMotor * 1.05, rMotor * 1.05, g.L * 0.05, 24), MAT.redutor);
  tampa.rotation.z = Math.PI / 2;
  tampa.position.set(g.L * 0.3 + g.L * 0.17 - g.L * 0.025, 0.22 + rMotor, 0);
  raiz.add(tampa);

  return { raiz, altura: g.H };
}

/* ==========================================================================
 *  BOMBA CENTRIFUGA
 *  A geometria e os bocais vem prontos da primitiva; aqui so a ficha.
 * ======================================================================= */
function bombaCentrifuga(eq) {
  const b = criarBombaCentrifuga(eq.geom);
  marcar(b.raiz, fichaDe(eq));
  return { raiz: b.raiz, altura: b.altura, bocais: b.bocais };
}

function bombaVacuo(eq) {
  const b = criarBombaVacuo(eq.geom);
  marcar(b.raiz, fichaDe(eq));
  return { raiz: b.raiz, altura: b.altura, bocais: b.bocais };
}

function bombaDeslocamento(eq) {
  const b = criarBombaDeslocamento(eq.geom);
  marcar(b.raiz, fichaDe(eq));
  return { raiz: b.raiz, altura: b.altura, bocais: b.bocais };
}

/* ==========================================================================
 *  Fachada
 * ======================================================================= */
const CONSTRUTORES = {
  'vaso-vertical': vasoVertical,
  trocador,
  'filtro-rotativo': filtroRotativo,
  skid,
  'bomba-centrifuga': bombaCentrifuga,
  'bomba-deslocamento': bombaDeslocamento,
  'bomba-vacuo': bombaVacuo,
};

/**
 * Bocais dos equipamentos extras: mesma primitiva flangeada dos demais, para
 * a tubulacao encostar num flange de verdade em vez de terminar no ar.
 * A ancora devolvida fica na FACE do flange.
 */
function montarBocais(tag, alvo, lista) {
  const ancoras = {};
  // o corpo, para medir onde o pescoco encosta (sem os bocais ja postos)
  alvo.updateMatrixWorld(true);
  const corpo = [];
  alvo.traverse((o) => { if (o.isMesh && !/^bocal/.test(o.parent?.name ?? '')) corpo.push(o); });
  const rc = new THREE.Raycaster();
  for (const b of lista) {
    const pos = new THREE.Vector3(...b.pos);
    const dir = new THREE.Vector3(...b.dir).normalize();
    const comp = b.comprimento ?? 0.22;
    /* Pescoco embutido (Fase 25): a ancora fica no costado, no EIXO do
     * bocal; na borda dele a superficie pode estar mais para dentro (no
     * cone do fundo do cristalizador, 26 cm: a borda do bocal ficava no ar
     * sob a ponta do cone). Um raio de cada lado da borda mede ate onde a
     * superficie vai; o pescoco desce ate la e 1 cm alem. O flange fica no
     * mesmo lugar. */
    const r = DN[b.dn].od / 2;
    const u = new THREE.Vector3(1, 0, 0).cross(dir);
    if (u.lengthSq() < 1e-6) u.set(0, 0, 1).cross(dir);
    u.normalize();
    const w = dir.clone().cross(u);
    let embute = 0;
    for (const v of [u, u.clone().negate(), w, w.clone().negate()]) {
      const o = alvo.localToWorld(pos.clone().addScaledVector(v, r * 0.95).addScaledVector(dir, 0.05));
      rc.set(o, alvo.localToWorld(pos.clone().sub(dir)).sub(alvo.localToWorld(pos.clone())).normalize());
      rc.far = 0.6;
      const h = rc.intersectObjects(corpo, false)[0];
      if (h) embute = Math.max(embute, h.distance - 0.05);
    }
    embute = embute > 0.002 ? embute + 0.01 : 0;
    const bo = criarBocal({ dn: b.dn, comprimento: comp + embute });
    orientarPara(bo, pos.clone().addScaledVector(dir, -embute), dir);
    bo.userData.ficha = {
      titulo: `${tag} · ${b.id} — DN ${b.dn}`,
      subtitulo: b.servico,
      grupos: [{
        nome: 'Bocal',
        dados: {
          'Equipamento': tag,
          'Identificação': b.id,
          'Diâmetro nominal': `DN ${b.dn}`,
          'Serviço': b.servico,
        },
      }],
    };
    alvo.add(bo);
    ancoras[b.id] = {
      pos: pos.clone().addScaledVector(dir, comp + DN[b.dn].esp + 0.01),
      dir: dir.clone(),
      dn: b.dn,
    };
  }
  return ancoras;
}

/** Constroi um equipamento do registro EXTRAS pela TAG. */
export function criarExtra(tag) {
  const eq = EXTRAS[tag];
  if (!eq) throw new Error(`Equipamento extra "${tag}" nao cadastrado`);
  const fn = CONSTRUTORES[eq.tipo];
  if (!fn) throw new Error(`Tipo "${eq.tipo}" sem construtor`);

  const r = fn(eq);
  const grupo = new THREE.Group();
  grupo.name = tag;
  grupo.add(r.raiz);

  // Os bocais entram no MESMO no que o corpo, para herdarem o deslocamento
  // vertical (saia, altura de eixo) aplicado la dentro. Quem calcula os
  // proprios bocais (a bomba) os devolve; os demais vem da tabela.
  const ancoras = montarBocais(tag, r.raiz, r.bocais ?? BOCAIS_EXTRA[tag] ?? []);

  /* ...mas a ANCORA que sai daqui nasce no referencial de `r.raiz`, e quem a
   * consome (equipment/tubulacao.js) aplica a matriz do GRUPO. Faltava
   * exatamente o deslocamento que `r.raiz` carrega: a malha do bocal aparecia
   * na altura certa e a linha ia procura-la `saiaAltura` metros abaixo, muitas
   * vezes debaixo do piso. Dai linha que nao encosta no bocal e linha que
   * atravessa o costado para chegar num ponto que nao existe.
   *
   * Converte-se pela matriz, e nao somando `position`, para continuar valendo
   * se algum construtor passar a girar a raiz. */
  r.raiz.updateMatrix();
  for (const a of Object.values(ancoras)) {
    a.pos.applyMatrix4(r.raiz.matrix);
    a.dir.transformDirection(r.raiz.matrix).normalize();
  }

  // Etiqueta de TAG, na mesma camada que o toggle de rotulos controla.
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  const lbl = rotulo(tag, 'tag-label');
  lbl.position.set(0, r.altura + 0.8, 0);
  rotulos.add(lbl);
  grupo.add(rotulos);

  return {
    grupo,
    camadas: { rotulos, tag: rotulos },
    girante: r.girante ?? null,
    ancoras,
    alturaTotal: r.altura,
    fichaPadrao: fichaDe(eq),
  };
}

export { EXTRAS };
