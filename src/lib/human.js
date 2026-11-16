import * as THREE from 'three';
import { texturaListras } from './texturas.js';

/**
 * ===========================================================================
 *  FIGURA HUMANA ARTICULADA  (1,75 m)
 * ===========================================================================
 *  Para escala e para o trafego (Fase 9). Articulada de verdade: quadril,
 *  joelho, ombro e cotovelo sao pivos (grupos) com o eixo de giro em X, e a
 *  caminhada e um ciclo procedural — a coxa vai e volta, o joelho dobra na
 *  fase de balanco, o braco oposto acompanha, o corpo sobe e desce duas vezes
 *  por ciclo. A passada (0,7 m) amarra a cadencia a velocidade: o pe nao
 *  escorrega no chao.
 *
 *  Frente em +Z, como os veiculos. Proporcoes do corpo medio adulto
 *  (altura do quadril ~0,53 H, ombro ~0,82 H).
 */

export const PASSADA = 0.7;                       // m por passo; ciclo = 2 passos

const cache = new Map();
function material(cor, extra = {}) {
  const k = `${cor}-${JSON.stringify(extra)}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75, metalness: 0.02, ...extra }));
  return cache.get(k);
}
const GEO = {};
function geo(nome, f) { GEO[nome] ??= f(); return GEO[nome]; }

/** Poe o v da textura pela altura (m acima do quadril, dada por `f(y local)`):
 *  as listras da camisa ficam com o mesmo passo em todas as pecas. */
const ALTURA_LISTRAS = 0.64;                      // m que as 8 faixas da textura cobrem
function listrar(g, f) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setY(i, f(p.getY(i)) / ALTURA_LISTRAS);
  return g;
}

function malha(g, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

/**
 * @param {object} p
 *   roupa    cor da camisa/macacao
 *   calca    cor da calca
 *   pele     tom de pele
 *   capacete cor do capacete, ou null (cabelo)
 *   colete   cor do colete refletivo, ou null
 *   atletico true: corpo forte — tronco em V (cintura fina, dorsal e ombro
 *            largos), peitoral, deltoide, biceps e triceps, antebraco e
 *            perna afinando, panturrilha; de manga curta e shorts
 *   cabecaEscala  tamanho da cabeca (1 = proporcao media)
 *   rosto    imagem (URL de dados) posta na frente da cabeca, ou null
 *   listras  [cor, cor]: camisa de listras horizontais, em vez de `roupa`
 *   manga    'curta': braco de fora, com a manga so no alto
 *   shorts   true: a calca acaba no joelho (canela de fora)
 *   chinelo  cor do chinelo, em vez da bota
 * @returns {{ grupo: THREE.Group, animar: (fase: number, intensidade?: number) => void }}
 */
export function criarPessoa({ roupa = 0xf2a03d, calca = 0x2f3a4a, pele = 0xc89a7a, capacete = 0xffd24a, colete = null, cabelo = 0x2a211b,
  atletico = false, rosto = null, cabecaEscala = 1, listras = null, manga = 'longa', shorts = false, chinelo = null } = {}) {
  const g = new THREE.Group();
  g.name = 'pessoa';
  const mRoupa = listras
    ? new THREE.MeshStandardMaterial({ map: texturaListras(listras), roughness: 0.75, metalness: 0.02, name: 'camisa-listrada' })
    : material(roupa);
  const curta = manga === 'curta';
  const mCalca = material(calca), mPele = material(pele, { roughness: 0.6 });
  const mBota = material(0x2a2522, { roughness: 0.9 });

  const corpo = new THREE.Group();               // sobe e desce na caminhada
  g.add(corpo);
  const yQuadril = 0.92;

  // --- pernas: coxa (pivo no quadril) > canela (pivo no joelho) > bota ---
  const pernas = [];
  for (const s of [-1, 1]) {
    const coxa = new THREE.Group();
    coxa.position.set(s * (atletico ? 0.105 : 0.1), yQuadril, 0);
    const joelho = new THREE.Group();
    joelho.position.set(0, -0.44, 0);
    if (atletico) {
      // a coxa afina ate o joelho; o shorts, folgado, cobre ate pouco acima dele
      coxa.add(malha(geo('coxa-forte', () => new THREE.CylinderGeometry(0.088, 0.06, 0.44, 14)), mPele, 0, -0.22, 0));
      coxa.add(malha(geo('perna-shorts', () => new THREE.CylinderGeometry(0.1, 0.094, 0.3, 14)), mCalca, 0, -0.13, 0));
      joelho.add(malha(geo('joelho', () => new THREE.SphereGeometry(0.06, 12, 8)), mPele, 0, 0, 0.005));
      joelho.add(malha(geo('canela-forte', () => new THREE.CylinderGeometry(0.052, 0.036, 0.36, 12)), mPele, 0, -0.21, 0));
      joelho.add(malha(geo('panturrilha', () => new THREE.SphereGeometry(0.05, 12, 8)), mPele, 0, -0.15, -0.024, 1.05, 1.9, 1.1));
    } else {
      coxa.add(malha(geo('coxa', () => new THREE.CapsuleGeometry(0.075, 0.34, 4, 10)), mCalca, 0, -0.22, 0));
      joelho.add(malha(geo('canela', () => new THREE.CapsuleGeometry(0.06, 0.34, 4, 10)), shorts ? mPele : mCalca, 0, -0.2, 0));
    }
    if (chinelo == null) joelho.add(malha(geo('bota', () => new THREE.BoxGeometry(0.11, 0.08, 0.26)), mBota, 0, -0.43, 0.05));
    else {
      // chinelo: sola fina, o pe de fora e a tira por cima do peito do pe
      const mCh = material(chinelo, { roughness: 0.9 });
      joelho.add(malha(geo('sola', () => new THREE.BoxGeometry(0.105, 0.022, 0.28)), mCh, 0, -0.459, 0.05));
      joelho.add(malha(geo('pe', () => new THREE.BoxGeometry(0.09, 0.05, 0.23)), mPele, 0, -0.423, 0.05));
      joelho.add(malha(geo('tira', () => new THREE.BoxGeometry(0.1, 0.012, 0.03)), mCh, 0, -0.394, 0.1));
    }
    coxa.add(joelho);
    corpo.add(coxa);
    pernas.push({ coxa, joelho, s });
  }

  // --- tronco, quadril e pescoco ---
  const yOmbro = atletico ? yQuadril + 0.5 : 1.43, xOmbro = atletico ? 0.268 : 0.22;
  if (atletico) {
    /* Tronco em V: perfil de revolucao (raio, altura acima do quadril), achatado
     * de frente para tras — cintura fina, dorsal larga, e o trapezio subindo
     * ate o pescoco. Proporcao de quem treina: ombros ~1,6 vez a cintura. */
    const PERFIL = [[0.02, 0], [0.15, 0], [0.163, 0.05], [0.15, 0.14], [0.166, 0.26], [0.2, 0.4], [0.206, 0.47], [0.186, 0.54], [0.12, 0.6], [0.066, 0.635], [0.052, 0.66]];
    corpo.add(malha(geo('quadril', () => new THREE.CapsuleGeometry(0.15, 0.08, 4, 12)), mCalca, 0, yQuadril + 0.02, 0, 1.04, 1, 0.85));
    corpo.add(malha(geo('tronco-forte', () => listrar(new THREE.LatheGeometry(PERFIL.map(([r, y]) => new THREE.Vector2(r, y)), 22), (y) => y)),
      mRoupa, 0, yQuadril, 0, 1.12, 1, 0.66));
    for (const s of [-1, 1]) {
      corpo.add(malha(geo('peitoral', () => listrar(new THREE.SphereGeometry(0.1, 14, 10), (y) => 0.43 + 0.6 * y)),
        mRoupa, s * 0.09, yQuadril + 0.43, 0.074, 1.1, 0.6, 0.42));
    }
    corpo.add(malha(geo('pescoco-forte', () => new THREE.CylinderGeometry(0.056, 0.066, 0.11, 12)), mPele, 0, 1.535, 0));
  } else {
    corpo.add(malha(geo('quadril', () => new THREE.CapsuleGeometry(0.15, 0.08, 4, 12)), mCalca, 0, yQuadril + 0.02, 0, 1, 1, 0.8));
    corpo.add(malha(geo('tronco', () => new THREE.CapsuleGeometry(0.17, 0.36, 4, 14)), mRoupa, 0, yQuadril + 0.33, 0, 1, 1, 0.72));
    if (colete) {
      corpo.add(malha(geo('colete', () => new THREE.CapsuleGeometry(0.178, 0.26, 4, 14)), material(colete, { emissive: colete, emissiveIntensity: 0.15 }),
        0, yQuadril + 0.37, 0, 1, 1, 0.76));
    }
    corpo.add(malha(geo('pescoco', () => new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10)), mPele, 0, 1.53, 0));
  }

  // --- bracos: braco (pivo no ombro) > antebraco (pivo no cotovelo) > mao ---
  const bracos = [];
  for (const s of [-1, 1]) {
    const ombro = new THREE.Group();
    ombro.position.set(s * xOmbro, yOmbro, 0);
    const cotovelo = new THREE.Group();
    cotovelo.position.set(0, -0.3, 0);
    let mao;
    if (atletico) {
      // deltoide e manga curta (da camisa); biceps a frente e triceps atras
      ombro.add(malha(geo('deltoide', () => listrar(new THREE.SphereGeometry(0.092, 14, 10), (y) => 0.5 + y)), mRoupa, 0, -0.005, 0, 1, 1.05, 1.05));
      ombro.add(malha(geo('manga-forte', () => listrar(new THREE.CylinderGeometry(0.08, 0.084, 0.13, 14, 1, true), (y) => 0.4 + y)), mRoupa, 0, -0.1, 0));
      ombro.add(malha(geo('braco-forte', () => new THREE.CylinderGeometry(0.067, 0.052, 0.3, 12)), mPele, 0, -0.15, 0));
      ombro.add(malha(geo('biceps', () => new THREE.SphereGeometry(0.06, 12, 8)), mPele, 0, -0.16, 0.026, 0.95, 1.6, 0.95));
      ombro.add(malha(geo('triceps', () => new THREE.SphereGeometry(0.054, 12, 8)), mPele, 0, -0.14, -0.028, 0.95, 1.7, 0.9));
      cotovelo.add(malha(geo('cotovelo', () => new THREE.SphereGeometry(0.052, 10, 8)), mPele, 0, 0, 0));
      cotovelo.add(malha(geo('antebraco-forte', () => new THREE.CylinderGeometry(0.056, 0.037, 0.25, 12)), mPele, 0, -0.125, 0));
      mao = malha(geo('mao', () => new THREE.SphereGeometry(0.045, 10, 8)), mPele, 0, -0.28, 0, 1.08, 1.15, 1.08);
    } else {
      ombro.add(malha(geo('braco', () => new THREE.CapsuleGeometry(0.052, 0.22, 4, 8)), curta ? mPele : mRoupa, 0, -0.15, 0));
      if (curta) ombro.add(malha(geo('manga', () => new THREE.CapsuleGeometry(0.058, 0.07, 4, 8)), mRoupa, 0, -0.08, 0));
      cotovelo.add(malha(geo('antebraco', () => new THREE.CapsuleGeometry(0.045, 0.2, 4, 8)), curta ? mPele : mRoupa, 0, -0.13, 0));
      mao = malha(geo('mao', () => new THREE.SphereGeometry(0.045, 10, 8)), mPele, 0, -0.28, 0);
    }
    cotovelo.add(mao);
    ombro.add(cotovelo);
    ombro.rotation.z = s * (atletico ? 0.13 : 0.06);   // bracos levemente abertos (mais, com a dorsal larga)
    corpo.add(ombro);
    bracos.push({ ombro, cotovelo, s, mao });
  }

  // --- cabeca: rosto, e capacete ou cabelo ---
  const cabeca = new THREE.Group();
  // cabeca maior: cresce para cima, com o queixo no mesmo lugar
  cabeca.position.set(0, 1.66 + 0.1 * (cabecaEscala - 1), 0);
  cabeca.scale.setScalar(cabecaEscala);
  cabeca.add(malha(geo('cabeca', () => new THREE.SphereGeometry(0.1, 16, 12)), mPele, 0, 0, 0, 0.92, 1.08, 1));
  if (rosto) {
    /* A foto num gomo de esfera a frente da cabeca, 3,5 mm por fora dela e do
     * cabelo na testa; dos lados o cabelo (mais largo) o cobre. A imagem ja
     * vem desfeita no tom de pele nas bordas (scripts/rosto-companion.py). */
    const tx = new THREE.TextureLoader().load(rosto);
    tx.colorSpace = THREE.SRGBColorSpace;
    const m = malha(new THREE.SphereGeometry(0.1035, 28, 20, Math.PI / 2 - 1.0, 2.0, 0.38, 2.2),
      new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6, metalness: 0.02, name: 'rosto' }), 0, 0, 0, 0.92, 1.08, 1);
    m.castShadow = false;
    cabeca.add(m);
  } else cabeca.add(malha(geo('nariz', () => new THREE.SphereGeometry(0.018, 8, 6)), mPele, 0, -0.01, 0.095));
  if (capacete) {
    const mc = material(capacete, { roughness: 0.4, metalness: 0.05 });
    cabeca.add(malha(geo('casco', () => new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mc, 0, 0.03, 0, 1, 0.9, 1.05));
    cabeca.add(malha(geo('aba', () => new THREE.CylinderGeometry(0.13, 0.13, 0.012, 18)), mc, 0, 0.035, 0.03, 1, 1, 1.12));
  } else {
    // com foto no rosto, cabelo curto e para tras: a testa e a linha do cabelo sao da foto
    if (rosto) {
      const c = malha(geo('cabelo-curto', () => new THREE.SphereGeometry(0.103, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), material(cabelo, { roughness: 0.9 }), 0, 0.006, -0.012, 0.95, 1.06, 1);
      c.rotation.x = -0.5;
      cabeca.add(c);
    } else cabeca.add(malha(geo('cabelo', () => new THREE.SphereGeometry(0.105, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), material(cabelo, { roughness: 0.9 }), 0, 0.015, -0.01));
  }
  corpo.add(cabeca);

  /**
   * Pose do ciclo de caminhada. `fase` em radianos (2pi = dois passos);
   * `intensidade` 0 = parado em pe, 1 = caminhando.
   */
  function animar(fase, intensidade = 1) {
    const k = intensidade;
    for (const { coxa, joelho, s } of pernas) {
      const f = fase + (s > 0 ? Math.PI : 0);
      coxa.rotation.x = -0.42 * Math.sin(f) * k;                 // + frente = rotacao negativa
      // o joelho dobra no balanco (perna indo a frente) e quase estica no apoio
      joelho.rotation.x = (0.08 + 0.75 * Math.max(0, Math.cos(f - 0.4))) * k;
    }
    for (const { ombro, cotovelo, s } of bracos) {
      const f = fase + (s > 0 ? 0 : Math.PI);                    // oposto a perna do mesmo lado
      ombro.rotation.x = -0.32 * Math.sin(f) * k + 0.04;
      cotovelo.rotation.x = -(0.15 + 0.25 * Math.max(0, Math.sin(f))) * k - 0.08;
    }
    corpo.position.y = 0.028 * Math.cos(2 * fase) * k - 0.012 * k;
    corpo.rotation.y = 0.05 * Math.sin(fase) * k;                 // o tronco gira um pouco
    corpo.rotation.x = 0;
    cabeca.rotation.y = -0.04 * Math.sin(fase) * k;
    cabeca.rotation.x = 0;
    for (const { ombro, s } of bracos) ombro.rotation.z = s * 0.06;
    if (prancheta) prancheta.visible = false;
    // andando: o que esta na mao segue o braco, com a inclinacao propria
    // dele (a lanterna aponta o chao a frente)
    if (segurado) segurado.rotation.x = segurado.userData.inclinacao ?? 0;
  }
  /**
   * Sentado (Fase 20), por cima da pose de andar: `k` de 0 (em pe) a 1
   * (sentado), coxas na horizontal e canelas na vertical, o quadril na
   * altura do assento (0,46 m); `maos`: 'digitar' poe os antebracos na mesa
   * e mexe os dedos, 'comer' e 'conversar' os apoiam. `t` em segundos.
   */
  function sentar(k, maos = 'digitar', t = 0) {
    if (k <= 0) return;
    for (const { coxa, joelho } of pernas) {
      coxa.rotation.x = (-Math.PI / 2) * k;
      joelho.rotation.x = (Math.PI / 2) * k;
    }
    corpo.position.y = -(yQuadril - 0.47) * k;
    corpo.rotation.y = 0;
    for (const { ombro, cotovelo, s } of bracos) {
      const mexe = maos === 'digitar' ? 0.05 * Math.sin(t * 9 + s) : maos === 'conversar' ? 0.12 * Math.sin(t * 1.7 + s) : 0.08 * Math.sin(t * 2.2 + s);
      ombro.rotation.x = (-0.55 + mexe) * k;
      cotovelo.rotation.x = -0.95 * k;
    }
    cabeca.rotation.y = maos === 'conversar' ? 0.25 * Math.sin(t * 0.6) * k : 0;
  }
  /** Em pe trabalhando na bancada: bracos a frente, leve vaivem. */
  function trabalhar(t) {
    for (const { ombro, cotovelo, s } of bracos) {
      ombro.rotation.x = -0.7 + 0.08 * Math.sin(t * 2 + s * 1.3);
      cotovelo.rotation.x = -0.9;
    }
  }

  /* Prancheta (Fase 25): nasce na primeira inspecao, presa a mao esquerda
   * (s = +1: de frente para +z, a esquerda fica em +x), virada para o rosto.
   * Eucatex, folha e prendedor. [ADOTADO] 23 x 31 cm, A4 com folga. */
  let prancheta = null;
  let segurado = null;                            // o que esta na mao direita (segurar)
  function pegarPrancheta() {
    if (prancheta) return prancheta;
    prancheta = new THREE.Group();
    prancheta.name = 'prancheta';
    prancheta.add(malha(geo('prancheta', () => new THREE.BoxGeometry(0.23, 0.012, 0.31)), material(0x8b6a47, { roughness: 0.8 }), 0, 0, 0));
    prancheta.add(malha(geo('folha', () => new THREE.BoxGeometry(0.2, 0.003, 0.26)), material(0xf3f1ea, { roughness: 0.9 }), 0, 0.007, 0.015));
    prancheta.add(malha(geo('prendedor', () => new THREE.BoxGeometry(0.08, 0.018, 0.035)), material(0x9aa0a6, { metalness: 0.7, roughness: 0.4 }), 0, 0.012, -0.135));
    const esq = bracos.find((b) => b.s > 0).cotovelo;
    // na mao, e girada ~75° a mais que o antebraco: a folha fica a ~45°,
    // voltada para o rosto (com o antebraco da pose ela olhava para a barriga)
    prancheta.position.set(0, -0.31, 0.02);
    prancheta.rotation.set(1.15, 0, 0.2);
    esq.add(prancheta);
    return prancheta;
  }

  /**
   * Inspecionando com prancheta (Fase 25): a esquerda segura a prancheta a
   * frente do peito, a direita anota; a cabeca alterna entre o que se
   * inspeciona (`olhar`: inclinacao do olhar em rad, + para cima) e a folha.
   * `t` em segundos.
   */
  function inspecionar(t, olhar = 0) {
    pegarPrancheta().visible = true;
    for (const { ombro, cotovelo, s } of bracos) {
      if (s > 0) {                                   // esquerda: segura
        ombro.rotation.x = -0.75;
        ombro.rotation.z = -0.25;
        cotovelo.rotation.x = -1.35;
      } else {                                       // direita: escreve, sobre a folha
        ombro.rotation.x = -0.72 + 0.03 * Math.sin(t * 5.3);
        ombro.rotation.z = 0.62;
        cotovelo.rotation.x = -1.55 + 0.06 * Math.sin(t * 7.1);
      }
    }
    // ~4 s olhando o instrumento, ~2,5 s anotando
    const ciclo = (t % 6.5) / 6.5;
    const naFolha = THREE.MathUtils.smoothstep(ciclo, 0.55, 0.65) * (1 - THREE.MathUtils.smoothstep(ciclo, 0.92, 1));
    cabeca.rotation.x = THREE.MathUtils.lerp(-olhar * 0.8, 0.55, naFolha);
    cabeca.rotation.y = 0.12 * Math.sin(t * 0.7) * (1 - naFolha);
    corpo.rotation.x = 0.04 + 0.05 * naFolha;
  }

  /**
   * Girando o volante de uma valvula (Fase 25): as duas maos na altura `h`
   * do volante (m acima do piso), andando em roda com meia volta de
   * defasagem; abaixo de 1 m o tronco se inclina e os joelhos dobram.
   */
  function girarVolante(t, h = 1.2) {
    if (prancheta) prancheta.visible = false;
    const baixo = THREE.MathUtils.clamp((1.05 - h) / 0.6, 0, 1);
    corpo.rotation.x = 0.45 * baixo;
    for (const { coxa, joelho } of pernas) { coxa.rotation.x = -0.35 * baixo; joelho.rotation.x = 0.6 * baixo; }
    corpo.position.y = -0.12 * baixo;
    const alcance = THREE.MathUtils.clamp(-(1.0 + 0.9 * (h - 1.2)), -1.75, -0.6) + 0.45 * baixo;
    const w = 2.2;                                   // rad/s: uma volta de volante a cada ~3 s
    for (const { ombro, cotovelo, s } of bracos) {
      const f = w * t + (s > 0 ? Math.PI : 0);
      ombro.rotation.x = alcance + 0.14 * Math.sin(f);
      ombro.rotation.z = s * (0.06 - 0.16) + 0.1 * s * Math.cos(f);
      cotovelo.rotation.x = -0.45 - 0.12 * Math.cos(f);
    }
    cabeca.rotation.x = 0.25 + 0.3 * baixo;
  }
  /* Poses de servico (operadores dos caminhoes, 16/11/2026). Todas por cima
   * da pose de andar e com `k` de 0 a 1, para entrar e sair sem estalo: cada
   * junta vai da pose em que esta ate a da tarefa. */
  const para = (obj, eixo, alvo, k) => { obj.rotation[eixo] += (alvo - obj.rotation[eixo]) * k; };

  /** Agachado, mexendo em algo no chao a frente (calco da roda, mangote no
   *  piso): coxas a frente, joelhos dobrados, quadril a ~0,36 m do piso. */
  function agachar(k, t = 0) {
    if (k <= 0) return;
    for (const { coxa, joelho } of pernas) { para(coxa, 'x', -1.7, k); para(joelho, 'x', 2.3, k); }
    corpo.position.y += (-(yQuadril - 0.36) - corpo.position.y) * k;
    para(corpo, 'x', 0.22, k);
    para(corpo, 'y', 0, k);
    for (const { ombro, cotovelo, s } of bracos) {
      para(ombro, 'x', -0.95 + 0.1 * Math.sin(t * 3.1 + s), k);
      para(cotovelo, 'x', -0.35 - 0.12 * Math.sin(t * 3.1 + s * 2), k);
    }
    para(cabeca, 'x', 0.35, k);
  }

  /** Em pe, as maos em algo a altura `h` do piso (garra do aterramento,
   *  engate do mangote): abaixo de 1 m o tronco se inclina e os joelhos
   *  dobram. `umaMao`: so a direita trabalha; a outra fica ao lado do corpo. */
  function manusear(k, t = 0, h = 1.0, umaMao = false) {
    if (k <= 0) return;
    const baixo = THREE.MathUtils.clamp((1.05 - h) / 0.6, 0, 1);
    para(corpo, 'x', 0.45 * baixo, k);
    for (const { coxa, joelho } of pernas) { para(coxa, 'x', -0.35 * baixo, k); para(joelho, 'x', 0.6 * baixo, k); }
    corpo.position.y += (-0.12 * baixo - corpo.position.y) * k;
    const alcance = THREE.MathUtils.clamp(-(1.0 + 0.9 * (h - 1.2)), -1.75, -0.6) + 0.45 * baixo;
    for (const { ombro, cotovelo, s } of bracos) {
      if (umaMao && s > 0) continue;
      para(ombro, 'x', alcance + 0.07 * Math.sin(t * 4.3 + s), k);
      para(ombro, 'z', s * -0.12, k);
      para(cotovelo, 'x', -0.5 - 0.15 * Math.sin(t * 5.1 + s * 2), k);
    }
    para(cabeca, 'x', 0.25 + 0.3 * baixo, k);
  }

  /** Levando algo na mao enquanto anda: o antebraco direito a frente, na
   *  cintura (cabo); com `duas`, os dois (mangote). As pernas seguem andando. */
  function carregar(k, duas = false) {
    if (k <= 0) return;
    for (const { ombro, cotovelo, s } of bracos) {
      if (!duas && s > 0) continue;
      para(ombro, 'x', -0.3, k);
      para(cotovelo, 'x', -1.15, k);
      para(ombro, 'z', s * -0.1, k);
    }
  }

  /** Parado, esperando: o peso muda de perna e a cabeca olha em volta. */
  function aguardar(t) {
    para(cabeca, 'y', 0.5 * Math.sin(t * 0.37) + 0.15 * Math.sin(t * 1.1), 1);
    para(corpo, 'y', 0.06 * Math.sin(t * 0.23), 1);
    for (const { ombro, s } of bracos) para(ombro, 'x', 0.04 + 0.03 * Math.sin(t * 0.5 + s), 1);
  }

  /** Posicao da mao no mundo (s = -1 direita, +1 esquerda), depois da pose. */
  function mao(s = -1, alvo = new THREE.Vector3()) {
    g.updateMatrixWorld(true);
    return bracos.find((b) => b.s === s).mao.getWorldPosition(alvo);
  }
  animar(0, 0);
  /** Poe um objeto na mao direita (Fase 27: o frasco de amostra), pendurado
   *  abaixo da palma, como quem segura pelo gargalo; quem chama decide
   *  quando ele aparece. (s < 0 e o braco direito: o s > 0 segura a
   *  prancheta.) */
  function segurar(obj) {
    const dir = bracos.find((b) => b.s < 0).cotovelo;
    obj.position.set(0, -0.38, 0.02);
    dir.add(obj);
    segurado = obj;
    return obj;
  }

  /**
   * Colhendo amostra (Fase 27, item 11): o braco direito estendido ate a
   * valvula de amostragem, o frasco debaixo dela, o corpo um pouco curvado;
   * `olhar`: angulo de baixar a cabeca ate a valvula.
   */
  function colher(t, olhar = 0) {
    if (prancheta) prancheta.visible = false;
    for (const { ombro, cotovelo, s } of bracos) {
      if (s < 0) {                                   // direita: o frasco na valvula
        ombro.rotation.x = -0.95 + 0.02 * Math.sin(t * 1.3);
        ombro.rotation.z = 0.12;
        cotovelo.rotation.x = -0.45;
      } else {                                       // esquerda: solta
        ombro.rotation.x = 0.05;
        ombro.rotation.z = s * 0.06;
        cotovelo.rotation.x = -0.15;
      }
    }
    corpo.rotation.x = 0.18;
    cabeca.rotation.x = 0.25 - olhar * 0.6;
    cabeca.rotation.y = 0;
    // o frasco em pe debaixo da valvula: desfaz a inclinacao do braco
    const dir = bracos.find((b) => b.s < 0);
    if (segurado) segurado.rotation.x = -(dir.ombro.rotation.x + dir.cotovelo.rotation.x);
  }
  /**
   * Iluminando com a lanterna (Fase 27, item 13): braco direito erguido a
   * frente, varrendo devagar de um lado a outro; `olhar`: angulo de baixar
   * ate o alvo. A lanterna fica apontada para a frente e para baixo.
   */
  function iluminar(t, olhar = 0) {
    if (prancheta) prancheta.visible = false;
    for (const { ombro, cotovelo, s } of bracos) {
      if (s < 0) {
        ombro.rotation.x = -1.25;
        ombro.rotation.z = 0.1 + 0.25 * Math.sin(t * 0.8);
        cotovelo.rotation.x = -0.2;
      } else {
        ombro.rotation.x = 0.05;
        ombro.rotation.z = s * 0.06;
        cotovelo.rotation.x = -0.15;
      }
    }
    corpo.rotation.x = 0.03;
    cabeca.rotation.x = -olhar * 0.6;
    cabeca.rotation.y = 0.2 * Math.sin(t * 0.8);
    const dir = bracos.find((b) => b.s < 0);
    // o eixo (-Y da lanterna) a delta abaixo da horizontal, para a frente:
    // a rotacao total em X e delta - 90°; delta segue o alvo (olhar < 0 e
    // abaixo do olho)
    const delta = THREE.MathUtils.clamp(-olhar, 0.15, 0.9);
    if (segurado) segurado.rotation.x = delta - Math.PI / 2 - (dir.ombro.rotation.x + dir.cotovelo.rotation.x);
  }
  /**
   * Subindo (ou descendo) escada de marinheiro (Fase 27, item 12): de frente
   * para os degraus, maos no alto alternando e uma coxa erguida de cada vez,
   * no passo dos degraus (~0,3 m).
   */
  function subir(t) {
    if (prancheta) prancheta.visible = false;
    const f = t * 3.6;                                // ~0,35 m/s em degraus de 0,3 m
    for (const { ombro, cotovelo, s } of bracos) {
      ombro.rotation.x = -2.7 + 0.25 * Math.sin(f + (s > 0 ? 0 : Math.PI));
      ombro.rotation.z = s * 0.15;
      cotovelo.rotation.x = -0.45;
    }
    for (const { coxa, joelho, s } of pernas) {
      const sobe = Math.max(0, Math.sin(f + (s > 0 ? Math.PI : 0)));
      coxa.rotation.x = -0.15 - 0.85 * sobe;
      joelho.rotation.x = 0.2 + 1.3 * sobe;
    }
    corpo.position.y = 0;
    corpo.rotation.x = -0.05;
    cabeca.rotation.x = -0.15;
  }

  /**
   * Agachado lubrificando (Fase 27, item 12): coxa a ~52° para a frente e o
   * joelho dobrado o dobro, o quadril desce o que a perna encurta (os pes
   * ficam no chao); braco direito com a almotolia no mancal, apertando.
   */
  function lubrificar(t, olhar = 0) {
    if (prancheta) prancheta.visible = false;
    const th = 0.9;
    for (const { coxa, joelho } of pernas) { coxa.rotation.x = -th; joelho.rotation.x = 2 * th; }
    corpo.position.y = -(yQuadril - 0.91 * Math.cos(th));
    corpo.rotation.x = 0.25;
    for (const { ombro, cotovelo, s } of bracos) {
      // o braco desce ate o mancal (~0,4 m do chao): a -1,1 rad a almotolia
      // ficava na altura do ombro do agachado
      if (s < 0) { ombro.rotation.x = -0.55 + 0.05 * Math.sin(t * 4); ombro.rotation.z = 0.15; cotovelo.rotation.x = -0.35; }
      else { ombro.rotation.x = -0.4; ombro.rotation.z = -0.1; cotovelo.rotation.x = -0.9; }   // apoiada no joelho
    }
    cabeca.rotation.x = 0.3 - olhar * 0.5;
  }
  return { grupo: g, animar, sentar, trabalhar, inspecionar, girarVolante, agachar, manusear, carregar, aguardar, mao,
    segurar, colher, iluminar, subir, lubrificar };
}

/**
 * Lanterna (Fase 27, item 13): corpo e lente, e o facho — um cone aditivo,
 * so de desenho (nenhuma luz de verdade), que quem chama acende a noite
 * (`userData.facho`). O eixo da lanterna e o -Y dela (aponta para baixo na
 * mao solta); `userData.inclinacao` a leva para a frente e para baixo
 * enquanto anda. Fora da oclusao de ambiente, como as setas dos tubos.
 */
export function criarLanterna({ alcance = 6, abertura = 0.35 } = {}) {
  const f = new THREE.Group();
  f.name = 'lanterna';
  f.add(malha(geo('lanterna', () => new THREE.CylinderGeometry(0.022, 0.018, 0.16, 10)), material(0x2a2d31, { roughness: 0.5, metalness: 0.4 }), 0, 0, 0));
  f.add(malha(geo('lente-lanterna', () => new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10)), material(0xfff4d0, { emissive: 0xfff0c0, emissiveIntensity: 0.6 }), 0, -0.088, 0));
  const r = Math.tan(abertura) * alcance;
  const cone = new THREE.ConeGeometry(r, alcance, 20, 1, true).translate(0, -alcance / 2 - 0.1, 0);
  const facho = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({
    color: 0xfff1c8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  facho.name = 'facho-lanterna';
  facho.visible = false;
  facho.onBeforeRender = (r2, cena) => { cone.setDrawRange(0, cena.overrideMaterial ? 0 : Infinity); };
  f.add(facho);
  f.userData.facho = facho;
  f.userData.inclinacao = -0.9;
  return f;
}

/** Almotolia (Fase 27, item 12): o corpo e o bico comprido para o mancal;
 *  a origem e a mao. */
export function criarAlmotolia() {
  const f = new THREE.Group();
  f.name = 'almotolia';
  f.add(malha(geo('almotolia', () => new THREE.CylinderGeometry(0.04, 0.045, 0.09, 12)), material(0xb8312a, { roughness: 0.5, metalness: 0.3 }), 0, 0, 0));
  const bico = malha(geo('bico-almotolia', () => new THREE.CylinderGeometry(0.004, 0.009, 0.2, 8)), material(0x8a9097, { metalness: 0.7, roughness: 0.3 }), 0, -0.13, 0.05);
  bico.rotation.x = -0.4;
  f.add(bico);
  f.visible = false;
  return f;
}

/** Frasco de amostra (Fase 27, item 11): vidro ambar de ~250 mL e tampa,
 *  0,13 m de altura [ADOTADO]; a origem e o meio dele (na palma). */
export function criarFrascoAmostra() {
  const f = new THREE.Group();
  f.name = 'frasco-amostra';
  f.add(malha(geo('frasco', () => new THREE.CylinderGeometry(0.035, 0.035, 0.11, 12)), material(0x9a5a1e, { roughness: 0.2, metalness: 0.1 }), 0, 0, 0));
  f.add(malha(geo('tampa-frasco', () => new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10)), material(0xf2f2ee, { roughness: 0.6 }), 0, 0.07, 0));
  f.visible = false;
  return f;
}

/**
 * Operador de macacao laranja e capacete, parado em pe — a figura de escala
 * de sempre (R-01 e ambientacao).
 */
export function criarOperador(cor = 0xf2a03d) {
  const { grupo } = criarPessoa({ roupa: cor, calca: cor === 0xf2a03d ? 0xd88a2c : 0x2f3a4a, capacete: 0xf4f4f0, colete: null });
  grupo.name = 'operador-escala';
  return grupo;
}
