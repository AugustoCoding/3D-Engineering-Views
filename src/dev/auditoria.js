import * as THREE from 'three';

/**
 * ===========================================================================
 *  AUDITORIA DE COERENCIA FISICA
 * ===========================================================================
 *
 *  Por que isto existe.
 *
 *  A maquete tem 13 equipamentos, ~900 malhas e 17 linhas. Conferir isso a
 *  olho, equipamento por equipamento, e lento e — o que e pior — nao confiavel:
 *  foi assim que uma cuba de filtro ficou montada EM PE na lateral do tambor e
 *  que 100 faces horizontais coladas no piso passaram batido numa inspecao que
 *  so olhou as pecas de concreto.
 *
 *  Olho serve para julgar se a coisa PARECE certa. Para saber se ela ESTA
 *  certa, mede-se. Este modulo faz as perguntas que sempre voltam:
 *
 *    1. FACE_NO_PISO   face horizontal exposta rente ao topo da laje. Duas
 *                      superficies no mesmo plano disputam o z-buffer e o chao
 *                      cintila quando a camera anda.
 *    2. BOCAL_NO_AR    bocal cujo pescoco nao encosta no corpo do equipamento
 *                      que ele deveria perfurar.
 *    3. FORA_DA_BASE   peca do equipamento cuja projecao cai fora da fundacao.
 *    4. TUBO_ATRAVESSA linha que entra no corpo de um equipamento longe de
 *                      qualquer bocal dela — furando costado, tampo ou saia.
 *    5. TUBO_x_TUBO    duas linhas ocupando o mesmo espaco.
 *    6. CONTEUDO_VAZA  liquido (ou interno) que sai do recipiente.
 *    7. APOIO_ATRAVESSA apoio que sobe do chao e entra no corpo do vaso.
 *    8. SEM_APOIO      peca com vao livre por baixo e sem contato lateral.
 *    9. TUBO_x_RACK    linha que atravessa coluna ou viga do pipe rack.
 *   10. TUBO_NO_PISO   linha abaixo do piso acabado.
 *   +  Viabilidade da tubulacao, medida quando ela e montada
 *      (equipment/tubulacao.js): HIDRAULICA, SUCCAO_ALTA, PONTO_BAIXO,
 *      VAO_LIVRE, RISER_SEM_GUIA, ROTA_LONGA, LINHA_FALTANDO...
 *   +  Valvulas e instrumentos (equipment/instrumentacao.js): VALVULA_SEM_LUGAR,
 *      VALVULA_INACESSIVEL, VALVULA_TRES_VIAS, ORIFICIO_SEM_RETO, PECA_x_TUBO,
 *      PECA_x_EQUIPAMENTO e CONTAGEM contra o P&ID.
 *
 *  So roda em desenvolvimento (`import.meta.env.DEV`): nao entra no entregavel.
 *  No console: `__auditar()` para o relatorio, `__auditar('F-01')` para um so.
 */

const TOL_PISO = 0.045;      // faces a menos disto do piso brigam pelo z-buffer
const Y_PISO = 0;
const FOLGA_BOCAL = 0.45;    // quanto o pescoco pode procurar a parede
const FOLGA_NO_BOCAL = 0.8;  // raio em que um furo de tubo e legitimo (e bocal)

/** Camadas que nao sao corpo solido: nao valem como parede nem como obstaculo. */
const NAO_SOLIDO = new Set([
  'camada-cotas', 'camada-rotulos', 'camada-escala',
]);

/**
 * Raycast so acerta face cuja normal aponta CONTRA o raio, porque o material
 * nasce `FrontSide`. Metade das paredes da maquete e casca aberta (cuba de
 * filtro, saia, costado sem tampo), e um raio que chega pelo lado de dentro as
 * atravessa sem registrar nada — o auditor entao acusava bocal solto no ar
 * onde o bocal estava perfeitamente encostado. Durante a medicao, portanto,
 * toda face vale dos dois lados; no fim volta tudo como estava.
 */
function comFaceDupla(raiz, fn) {
  const salvos = [];
  raiz.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      salvos.push([m, m.side]);
      m.side = THREE.DoubleSide;
    }
  });
  try {
    return fn();
  } finally {
    for (const [m, side] of salvos) m.side = side;
  }
}

function malhasSolidas(raiz) {
  const out = [];
  (function anda(no) {
    if (NAO_SOLIDO.has(no.name)) return;
    if (no.isMesh && no.geometry?.attributes?.position) out.push(no);
    for (const f of no.children) anda(f);
  }(raiz));
  return out;
}

function caixaDe(objetos) {
  const caixa = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const o of objetos) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    caixa.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  }
  return caixa;
}

/* =========================================================================
 *  SOLIDO DE REVOLUCAO — a matematica que sustenta as regras 6 e 7
 * ======================================================================
 *  Quase todo recipiente desta planta e um solido de revolucao: costado,
 *  tampo, saia, tambor de filtro, cuba. Caixa envolvente NAO serve para
 *  perguntar "isto esta dentro daquilo": o licor do F-01 era uma caixa de
 *  1,99 m dentro de um tambor de 2,09 m — mais ESTREITA que o tambor em
 *  bounding box, e mesmo assim furava a parede, porque num cilindro a largura
 *  disponivel encolhe conforme se desce. So um teste RADIAL pega isso.
 *
 *  Entao, para cada recipiente, levanta-se o perfil r_max(y) direto dos
 *  vertices da malha: percorre-se a geometria, converte-se cada vertice em
 *  (altura, raio) no eixo local e guarda-se o maior raio de cada faixa de
 *  altura. Funciona para CylinderGeometry, LatheGeometry e qualquer perfil
 *  torneado, com ou sem tampo, sem depender dos parametros da geometria.
 */
const FAIXAS = 48;

function perfilRevolucao(malha) {
  const g = malha.geometry;
  const pos = g.attributes?.position;
  if (!pos) return null;
  if (!g.boundingBox) g.computeBoundingBox();

  const y0 = g.boundingBox.min.y;
  const y1 = g.boundingBox.max.y;
  const alt = y1 - y0;
  if (alt < 1e-6) return null;

  const rmax = new Float64Array(FAIXAS).fill(-1);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    let k = Math.floor(((pos.getY(i) - y0) / alt) * (FAIXAS - 1));
    k = Math.max(0, Math.min(FAIXAS - 1, k));
    if (r > rmax[k]) rmax[k] = r;
  }
  // Faixa sem vertice herda a vizinha: malha grossa nao vira buraco no perfil.
  for (let k = 1; k < FAIXAS; k++) if (rmax[k] < 0) rmax[k] = rmax[k - 1];
  for (let k = FAIXAS - 2; k >= 0; k--) if (rmax[k] < 0) rmax[k] = rmax[k + 1];
  if (rmax[0] < 0) return null;

  return {
    malha, y0, y1, alt, rmax,
    paraLocal: new THREE.Matrix4().copy(malha.matrixWorld).invert(),
    raioMax: Math.max(...rmax),
  };
}

const _p = new THREE.Vector3();

/**
 * Quanto o ponto (em coordenadas de MUNDO) passa da parede do recipiente.
 * Negativo = dentro. Infinity = fora do trecho de altura do recipiente.
 */
function excessoRadial(pontoMundo, perfil) {
  _p.copy(pontoMundo).applyMatrix4(perfil.paraLocal);
  if (_p.y < perfil.y0 - 1e-3 || _p.y > perfil.y1 + 1e-3) return Infinity;
  const t = (_p.y - perfil.y0) / perfil.alt;
  const k = Math.max(0, Math.min(FAIXAS - 1, Math.round(t * (FAIXAS - 1))));
  return Math.hypot(_p.x, _p.z) - perfil.rmax[k];
}

/** Amostra vertices de uma malha, em coordenadas de mundo. */
function amostraVertices(malha, maxAmostras = 240) {
  const pos = malha.geometry.attributes?.position;
  if (!pos) return [];
  const passo = Math.max(1, Math.floor(pos.count / maxAmostras));
  const out = [];
  for (let i = 0; i < pos.count; i += passo) {
    out.push(new THREE.Vector3()
      .fromBufferAttribute(pos, i).applyMatrix4(malha.matrixWorld));
  }
  return out;
}

/* =========================================================================
 *  6. CONTEUDO QUE VAZA DO RECIPIENTE
 * ====================================================================== */
const MAT_CONTEUDO = /liquido|licor|torta|suspensao|nivel/i;
const TOL_VAZA = 0.02;                 // 2 cm de tolerancia de malha

function conteudoVaza(tag, malhas) {
  const conteudos = malhas.filter((o) => MAT_CONTEUDO.test(o.material?.name ?? ''));
  if (!conteudos.length) return [];

  const recipientes = malhas
    .filter((o) => !MAT_CONTEUDO.test(o.material?.name ?? ''))
    .map(perfilRevolucao)
    .filter((r) => r && r.raioMax > 0.05);
  if (!recipientes.length) return [];

  const achados = [];
  for (const c of conteudos) {
    const pontos = amostraVertices(c);
    if (!pontos.length) continue;

    // O conteudo pode morar em QUALQUER recipiente do equipamento (costado,
    // cuba...). Vale o mais generoso: basta um conter tudo.
    let melhor = Infinity;
    for (const rec of recipientes) {
      let pior = -Infinity;
      for (const pt of pontos) {
        const e = excessoRadial(pt, rec);
        if (e > pior) pior = e;
        if (pior > melhor) break;            // ja perdeu para outro recipiente
      }
      if (pior < melhor) melhor = pior;
    }
    if (melhor <= TOL_VAZA) continue;

    achados.push({
      regra: 'CONTEUDO_VAZA', tag, gravidade: 'alta',
      peca: `${c.geometry.type} / ${c.material?.name}`,
      detalhe: melhor === Infinity
        ? 'nao cabe em recipiente nenhum do equipamento'
        : `passa ${melhor.toFixed(3)} m da parede do recipiente`,
    });
  }
  return achados;
}

/* =========================================================================
 *  7. APOIO QUE SOBE DO CHAO E ENTRA NO CORPO
 * ======================================================================
 *  Um bocal atravessa o costado de proposito — e para isso que ele existe.
 *  Um APOIO, nao: perna, pedestal, mancal e berco nascem no piso e param na
 *  parede de fora. O criterio que separa os dois e a ORIGEM: so entra no teste
 *  o que desce ate perto do chao.
 */
const TOL_PENETRA = 0.03;              // nervura aplicada na superficie nao conta

function apoioAtravessa(tag, malhas) {
  const apoios = malhas.filter((o) => {
    if (!/aco-carbono|concreto/i.test(o.material?.name ?? '')) return false;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    return b.min.y < 0.4;                      // nasce no piso
  });
  if (!apoios.length) return [];

  const corpos = malhas
    .filter((o) => /inox|camisa/i.test(o.material?.name ?? ''))
    .map(perfilRevolucao)
    .filter((r) => r && r.raioMax > 0.2);
  if (!corpos.length) return [];

  const achados = [];
  for (const a of apoios) {
    for (const corpo of corpos) {
      if (corpo.malha === a) continue;
      let dentro = 0;
      let fundo = 0;
      for (const pt of amostraVertices(a, 120)) {
        const e = excessoRadial(pt, corpo);
        if (e < -TOL_PENETRA) { dentro++; fundo = Math.min(fundo, e); }
      }
      if (dentro < 2) continue;
      achados.push({
        regra: 'APOIO_ATRAVESSA', tag, gravidade: 'alta',
        peca: `${a.geometry.type} / ${a.material?.name}`,
        detalhe: `entra ${(-fundo).toFixed(3)} m dentro de `
          + `${corpo.malha.geometry.type} / ${corpo.malha.material?.name}`,
      });
      break;
    }
  }
  return achados;
}

/* =========================================================================
 *  8. PECA SEM APOIO
 * ======================================================================
 *  Duas perguntas, nesta ordem, porque a segunda so faz sentido se a primeira
 *  falhar: (a) ha solido logo abaixo? (b) se nao ha, ela ao menos ENCOSTA em
 *  alguma coisa? Peca que responde nao as duas esta boiando.
 *
 *  O contato lateral e o que evita acusar bocal, agitador, serpentina e tudo
 *  mais que legitimamente se pendura numa parede em vez de pousar no chao.
 */
const VAO_MIN = 0.03;
const VOL_MIN = 0.004;                 // 4 litros: abaixo disso e parafuso

function semApoio(tag, malhas) {
  const achados = [];
  const raio = new THREE.Raycaster();
  const caixas = malhas.map((o) => {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
  });

  for (let i = 0; i < malhas.length; i++) {
    const o = malhas[i];
    const b = caixas[i];
    const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
    if (dx * dy * dz < VOL_MIN) continue;
    if (b.min.y < 0.05) continue;                  // ja pousa no piso

    const outros = malhas.filter((m) => m !== o);

    let apoiado = false;
    for (const fx of [0.25, 0.5, 0.75]) {
      for (const fz of [0.25, 0.5, 0.75]) {
        raio.set(
          new THREE.Vector3(b.min.x + dx * fx, b.min.y + 0.002, b.min.z + dz * fz),
          new THREE.Vector3(0, -1, 0),
        );
        raio.far = VAO_MIN + b.min.y;
        if (raio.intersectObjects(outros, false).length) { apoiado = true; break; }
      }
      if (apoiado) break;
    }
    if (apoiado) continue;

    const inflada = b.clone().expandByScalar(VAO_MIN);
    const encosta = caixas.some((c, j) => j !== i && inflada.intersectsBox(c));
    if (encosta) continue;

    achados.push({
      regra: 'SEM_APOIO', tag, gravidade: 'alta',
      peca: `${o.geometry.type} / ${o.material?.name ?? '?'}`,
      detalhe: `base em y = ${b.min.y.toFixed(3)} m, sem solido abaixo nem contato`,
    });
  }
  return achados;
}

/* =========================================================================
 *  1. FACE HORIZONTAL EXPOSTA RENTE AO PISO
 * ====================================================================== */
function faceNoPiso(tag, malhas, pads) {
  const achados = [];
  const tmp = new THREE.Box3();

  for (const o of malhas) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).clone();

    for (const [lado, y] of [['topo', b.max.y], ['base', b.min.y]]) {
      if (Math.abs(y - Y_PISO) > TOL_PISO) continue;

      // Face rente ao piso so incomoda se estiver EXPOSTA. Enterrada sob um
      // bloco de fundacao cujo topo passa por cima dela, ninguem ve.
      const cx = (b.min.x + b.max.x) / 2;
      const cz = (b.min.z + b.max.z) / 2;
      const coberta = pads.some((p) => (
        p.caixa.max.y > y + 0.02
        && cx > p.caixa.min.x && cx < p.caixa.max.x
        && cz > p.caixa.min.z && cz < p.caixa.max.z
      ));
      if (coberta) continue;

      // Face de TOPO e a que cintila: ela e a laje disputam o mesmo pixel.
      // Face de BASE aponta para baixo, fica de costas para qualquer camera
      // acima do piso e no maximo denuncia peca apenas encostada.
      achados.push({
        regra: 'FACE_NO_PISO', tag,
        gravidade: lado === 'topo' ? 'alta' : 'baixa',
        peca: `${o.geometry.type} / ${o.material?.name ?? '?'}`,
        detalhe: `face ${lado} em y = ${y.toFixed(4)} m, exposta`,
        area: +((b.max.x - b.min.x) * (b.max.z - b.min.z)).toFixed(3),
      });
    }
  }
  return achados;
}

/* =========================================================================
 *  2. BOCAL QUE NAO ENCOSTA EM PAREDE NENHUMA
 * ====================================================================== */
function bocalNoAr(tag, equip, malhas) {
  const achados = [];
  const raio = new THREE.Raycaster();
  raio.far = FOLGA_BOCAL;

  // O corpo do proprio equipamento, menos os bocais (senao o bocal acha a si).
  const corpo = malhas.filter((o) => {
    for (let n = o; n; n = n.parent) if (n.name === 'bocal') return false;
    return true;
  });

  /* Um raio so nao basta, e o motivo e numerico.
   *
   * Um bocal a 90° tem `Math.cos(PI/2) = 6,1e-17` em vez de zero, e o costado
   * e um LatheGeometry de 64 segmentos — 90° cai EXATAMENTE sobre um vertice.
   * O raio entao raspa a aresta entre dois triangulos, onde o teste de
   * Moller-Trumbore e instavel, e a interseccao mais proxima se perde: o
   * auditor via a parede oposta do vaso, a 1,54 m, e nao a de tras do flange,
   * a 0,25 m. Quatro bocais de utilidade do D-01 e do CR-02 foram acusados de
   * flutuar no ar estando encostados.
   *
   * Tres raios levemente abertos resolvem sem afrouxar o criterio: se a peca
   * estiver mesmo solta, nenhum dos tres acha parede. */
  const desvios = [0, 0.6, -0.6].map((graus) => THREE.MathUtils.degToRad(graus));
  const perp = new THREE.Vector3();
  const perp2 = new THREE.Vector3();
  const tiro = new THREE.Vector3();

  for (const [id, anc] of Object.entries(equip.ancoras ?? {})) {
    // A ancora fica na FACE DO FLANGE; caminha-se de volta, contra `dir`,
    // procurando a parede que o pescoco deveria atravessar.
    const partida = anc.pos.clone().applyMatrix4(equip.grupo.matrixWorld);
    const d = anc.dir.clone()
      .applyQuaternion(equip.grupo.getWorldQuaternion(new THREE.Quaternion()))
      .normalize()
      .negate();

    // Inclina em DOIS eixos perpendiculares: girar so num deles pode manter o
    // raio no mesmo plano degenerado que causou o problema.
    perp.set(0, 1, 0);
    if (Math.abs(d.dot(perp)) > 0.9) perp.set(1, 0, 0);
    perp.crossVectors(d, perp).normalize();
    perp2.crossVectors(d, perp).normalize();

    let bateu = false;
    for (const eixo of [perp, perp2]) {
      for (const ang of desvios) {
        tiro.copy(d).applyAxisAngle(eixo, ang);
        raio.set(partida, tiro);
        if (raio.intersectObjects(corpo, false).length) { bateu = true; break; }
      }
      if (bateu) break;
    }
    if (bateu) continue;

    achados.push({
      regra: 'BOCAL_NO_AR', tag, peca: id,
      detalhe: `nenhuma parede a ate ${FOLGA_BOCAL} m atras da face do flange`,
    });
  }
  return achados;
}

/* =========================================================================
 *  3. PECA FORA DA FUNDACAO
 * ====================================================================== */
function foraDaBase(tag, malhas, pads) {
  if (!pads.length) return [];
  const achados = [];
  const tmp = new THREE.Box3();

  for (const o of malhas) {
    // So interessa o que desce ate perto do chao: tubo aereo e plataforma
    // ficam em balanco de proposito.
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).clone();
    if (b.min.y > 0.35) continue;

    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    const sobre = pads.some((p) => (
      cx > p.caixa.min.x - 0.05 && cx < p.caixa.max.x + 0.05
      && cz > p.caixa.min.z - 0.05 && cz < p.caixa.max.z + 0.05
    ));
    if (sobre) continue;

    achados.push({
      regra: 'FORA_DA_BASE', tag,
      peca: `${o.geometry.type} / ${o.material?.name ?? '?'}`,
      detalhe: `apoia em y = ${b.min.y.toFixed(2)} fora da fundacao`,
    });
  }
  return achados;
}

/* =========================================================================
 *  4. TUBO ATRAVESSANDO O CORPO DE UM EQUIPAMENTO
 * ====================================================================== */
function tuboAtravessa(tubos, equipamentos) {
  const achados = [];
  const raio = new THREE.Raycaster();
  const seg = new THREE.Vector3();

  for (const t of tubos) {
    const caminho = t.userData.caminho;
    if (!caminho || caminho.length < 2) continue;

    // Pontas da linha: perto delas o furo E o bocal, e portanto legitimo.
    const pontas = [caminho[0], caminho[caminho.length - 1]];

    for (let i = 1; i < caminho.length; i++) {
      const a = caminho[i - 1];
      const b = caminho[i];
      const comp = seg.subVectors(b, a).length();
      if (comp < 1e-4) continue;
      raio.set(a, seg.clone().normalize());
      raio.far = comp;

      for (const eq of equipamentos) {
        const hits = raio.intersectObjects(eq.corpo, false);
        for (const h of hits) {
          if (pontas.some((p) => h.point.distanceTo(p) < FOLGA_NO_BOCAL)) continue;
          achados.push({
            regra: 'TUBO_ATRAVESSA',
            tag: eq.tag,
            peca: t.userData.ficha?.titulo ?? 'linha',
            detalhe: `entra em ${h.object.material?.name ?? '?'} a `
              + `${Math.min(...pontas.map((p) => h.point.distanceTo(p))).toFixed(2)} m `
              + 'do bocal mais proximo',
            ponto: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
          });
          break;                       // um aviso por trecho ja basta
        }
      }
    }
  }
  return achados;
}

/* =========================================================================
 *  5. LINHA CONTRA LINHA
 * ====================================================================== */
function tuboContraTubo(tubos) {
  const achados = [];
  const vistos = new Set();

  // Distancia minima entre dois segmentos de reta, resolvida no fecho.
  // `perto` recebe os dois pontos mais proximos, para saber ONDE se tocam.
  const perto = [new THREE.Vector3(), new THREE.Vector3()];
  function distSeg(p1, q1, p2, q2) {
    const d1 = new THREE.Vector3().subVectors(q1, p1);
    const d2 = new THREE.Vector3().subVectors(q2, p2);
    const r = new THREE.Vector3().subVectors(p1, p2);
    const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
    let s, t;
    if (a < 1e-8 && e < 1e-8) return r.length();
    if (a < 1e-8) { s = 0; t = THREE.MathUtils.clamp(f / e, 0, 1); }
    else {
      const c = d1.dot(r);
      if (e < 1e-8) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else {
        const b = d1.dot(d2);
        const den = a * e - b * b;
        s = den > 1e-8 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
      }
    }
    perto[0].copy(p1).addScaledVector(d1, s);
    perto[1].copy(p2).addScaledVector(d2, t);
    return perto[0].distanceTo(perto[1]);
  }

  /* Ponta de uma linha encostada na outra e um te (no da tubulacao, ramal
   * no cabecal): ali as duas se tocam de proposito. O encontro so e
   * desculpado perto desse ponto. */
  function pontosDeTe(ca, cb, folga) {
    const tes = [];
    for (const p of [ca[0], ca[ca.length - 1]]) {
      for (let n = 1; n < cb.length; n++) if (distSeg(p, p, cb[n - 1], cb[n]) < folga + 0.02) { tes.push(p); break; }
    }
    for (const p of [cb[0], cb[cb.length - 1]]) {
      for (let m = 1; m < ca.length; m++) if (distSeg(p, p, ca[m - 1], ca[m]) < folga + 0.02) { tes.push(p); break; }
    }
    return tes;
  }

  for (let i = 0; i < tubos.length; i++) {
    for (let j = i + 1; j < tubos.length; j++) {
      const A = tubos[i], B = tubos[j];
      const ca = A.userData.caminho, cb = B.userData.caminho;
      if (!ca || !cb) continue;
      const folga = (A.userData.diam + B.userData.diam) / 2;
      const tes = pontosDeTe(ca, cb, folga);

      let pior = Infinity;
      let onde = null;
      for (let m = 1; m < ca.length; m++) {
        for (let n = 1; n < cb.length; n++) {
          const d = distSeg(ca[m - 1], ca[m], cb[n - 1], cb[n]);
          if (d >= pior) continue;
          // Encontro a menos de 0,6 m de um te e o proprio te.
          if (tes.some((t) => perto[0].distanceTo(t) < 0.6)) continue;
          pior = d;
          onde = perto[0].clone();
        }
      }
      if (pior >= folga * 0.9) continue;

      const nomeA = A.userData.ficha?.titulo ?? `linha ${i}`;
      const nomeB = B.userData.ficha?.titulo ?? `linha ${j}`;
      const k = [nomeA, nomeB].sort().join(' x ');
      if (vistos.has(k)) continue;
      vistos.add(k);

      achados.push({
        regra: 'TUBO_x_TUBO', tag: '—', peca: k,
        detalhe: `eixos a ${pior.toFixed(3)} m; soma dos raios = ${folga.toFixed(3)} m`,
        ponto: onde ? [+onde.x.toFixed(2), +onde.y.toFixed(2), +onde.z.toFixed(2)] : null,
      });
    }
  }
  return achados;
}

/* =========================================================================
 *  RELATORIO
 * ====================================================================== */
/* =========================================================================
 *  10. LINHA ABAIXO DO PISO
 * ====================================================================== */
function tuboNoPiso(tubos) {
  const achados = [];
  for (const t of tubos) {
    const r = t.userData.diam / 2;
    const p = t.userData.caminho.find((q) => q.y - r < 0.02);
    if (p) {
      achados.push({
        regra: 'TUBO_NO_PISO', tag: '—', peca: t.userData.ficha?.titulo ?? 'linha',
        detalhe: `fundo do tubo a ${(p.y - r).toFixed(2)} m`, ponto: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      });
    }
  }
  return achados;
}

export function auditar({ todos, tubulacao, instrumentacao, rack, scene }, filtro = null) {
  scene.updateMatrixWorld(true);

  const equipamentos = [];
  for (const [tag, e] of Object.entries(todos)) {
    if (filtro && tag !== filtro) continue;
    const malhas = malhasSolidas(e.grupo);
    const pads = malhas
      .filter((o) => /concreto/i.test(o.material?.name ?? ''))
      .map((o) => ({ caixa: caixaDe([o]) }));
    equipamentos.push({ tag, e, malhas, pads, corpo: malhas });
  }

  const tubos = [];
  tubulacao?.grupo?.traverse((o) => {
    if (o.isMesh && o.userData.caminho) tubos.push(o);
  });

  const achados = [];
  comFaceDupla(scene, () => {
    for (const eq of equipamentos) {
      achados.push(...faceNoPiso(eq.tag, eq.malhas, eq.pads));
      achados.push(...bocalNoAr(eq.tag, eq.e, eq.malhas));
      achados.push(...foraDaBase(eq.tag, eq.malhas, eq.pads));
      achados.push(...conteudoVaza(eq.tag, eq.malhas));
      achados.push(...apoioAtravessa(eq.tag, eq.malhas));
      achados.push(...semApoio(eq.tag, eq.malhas));
    }
    achados.push(...tuboAtravessa(tubos, equipamentos));
    if (rack && !filtro) {
      // O rack entra como obstaculo: tubo apoiado na viga so a tangencia.
      const doRack = tuboAtravessa(tubos, [{ tag: 'pipe-rack', corpo: malhasSolidas(rack) }]);
      achados.push(...doRack.map((a) => ({ ...a, regra: 'TUBO_x_RACK' })));
    }
  });
  if (!filtro) {
    achados.push(...tuboContraTubo(tubos));
    achados.push(...tuboNoPiso(tubos));
    achados.push(...(tubulacao?.achados ?? []));
    achados.push(...(instrumentacao?.achados ?? []));
  }

  const porRegra = {};
  for (const a of achados) (porRegra[a.regra] ??= []).push(a);

  return { total: achados.length, porRegra, achados };
}
