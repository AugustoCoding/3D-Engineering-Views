import * as THREE from 'three';

/**
 * ===========================================================================
 *  TEXTURAS PROCEDURAIS + PROJECAO TRIPLANAR
 * ===========================================================================
 *  O HTML entregue nao carrega imagem nenhuma: toda textura nasce aqui, em
 *  canvas, de ruido com semente fixa — sai igual em toda maquina e pesa zero
 *  no arquivo. Cada uma e periodica (sem emenda quando repete).
 *
 *  A textura sai em tons perto do branco e MULTIPLICA a cor do material: a
 *  cor continua vindo dos dados (o laranja do bloco de tanques, o cinza do
 *  concreto), a textura so poe o grao.
 *
 *  Projecao triplanar: em vez das UVs da geometria — que esticam a mesma
 *  textura numa sapata de 0,5 m e numa laje de 58 m, porque o material e o
 *  mesmo —, a textura e projetada pela posicao no MUNDO, de cima e dos dois
 *  lados, misturadas pela normal. Mesmo grao em tudo, em metros.
 *
 *  Canvas sem `colorSpace = SRGBColorSpace` sai lavado (armadilha ja paga).
 */

/** Gerador pseudoaleatorio com semente (mulberry32). */
function rng(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido de valor periodico: grade L x L interpolada em N x N, valores 0..1. */
function ruido(N, L, r) {
  const g = Float32Array.from({ length: L * L }, () => r());
  const out = new Float32Array(N * N);
  const suave = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) {
    const fy = (y * L) / N, iy = Math.floor(fy), ty = suave(fy - iy), iy1 = (iy + 1) % L;
    for (let x = 0; x < N; x++) {
      const fx = (x * L) / N, ix = Math.floor(fx), tx = suave(fx - ix), ix1 = (ix + 1) % L;
      const a = g[iy * L + ix], b = g[iy * L + ix1], c = g[iy1 * L + ix], d = g[iy1 * L + ix1];
      out[y * N + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/** Soma de oitavas (fbm), normalizada para 0..1. */
function fbm(N, L0, oitavas, semente) {
  const r = rng(semente);
  const out = new Float32Array(N * N);
  let amp = 1, total = 0;
  for (let o = 0; o < oitavas; o++) {
    const n = ruido(N, L0 * 2 ** o, r);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Monta a textura a partir de uma funcao de pixel (x, y, i) -> [r, g, b] 0..1. */
function textura(N, pixel) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const [r, g, b] = pixel(x, y, i);
      img.data[i * 4] = Math.max(0, Math.min(255, r * 255));
      img.data[i * 4 + 1] = Math.max(0, Math.min(255, g * 255));
      img.data[i * 4 + 2] = Math.max(0, Math.min(255, b * 255));
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const cinza = (v) => [v, v, v];

/** Pontinhos (agregado, brita) desenhados com quebra de borda. */
function pontos(N, n, r, raio, cor) {
  const m = new Float32Array(N * N).fill(-1);
  for (let k = 0; k < n; k++) {
    const cx = r() * N, cy = r() * N, rr = raio[0] + r() * (raio[1] - raio[0]), c = cor[0] + r() * (cor[1] - cor[0]);
    for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
      for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
        if (dx * dx + dy * dy > rr * rr) continue;
        const x = ((Math.floor(cx) + dx) % N + N) % N, y = ((Math.floor(cy) + dy) % N + N) % N;
        m[y * N + x] = c;
      }
    }
  }
  return m;
}

/* ------------------------------------------------------------------------
 *  Catalogo. Cada textura e criada uma vez, na primeira vez que se pede.
 * --------------------------------------------------------------------- */
const FABRICAS = {
  concreto() {
    const N = 256, f = fbm(N, 4, 5, 11), r = rng(12);
    const ag = pontos(N, 900, r, [0.5, 1.4], [0.7, 1.05]);
    return textura(N, (x, y, i) => cinza(ag[i] >= 0 ? ag[i] : 0.8 + 0.2 * f[i]));
  },
  laje() {
    // concreto com junta de dilatacao na borda do ladrilho (6 m) e mancha
    const N = 512, f = fbm(N, 4, 6, 21), m = fbm(N, 2, 3, 22), r = rng(23);
    const ag = pontos(N, 3000, r, [0.4, 1.0], [0.72, 1.0]);
    return textura(N, (x, y, i) => {
      if (x < 2 || y < 2) return cinza(0.45);
      const mancha = m[i] > 0.68 ? (m[i] - 0.68) * 0.9 : 0;
      return cinza((ag[i] >= 0 ? ag[i] : 0.82 + 0.18 * f[i]) - mancha);
    });
  },
  asfalto() {
    const N = 256, f = fbm(N, 8, 4, 31), r = rng(32);
    const ag = pontos(N, 2500, r, [0.4, 0.9], [0.85, 1.25]);
    return textura(N, (x, y, i) => cinza(ag[i] >= 0 ? ag[i] : 0.78 + 0.22 * f[i]));
  },
  brita() {
    const N = 256, f = fbm(N, 6, 3, 41), r = rng(42);
    const ag = pontos(N, 2200, r, [1.0, 2.6], [0.62, 1.08]);
    return textura(N, (x, y, i) => {
      const v = ag[i] >= 0 ? ag[i] : 0.7 + 0.15 * f[i];
      return [v, v * 0.98, v * 0.94];
    });
  },
  grama() {
    const N = 256, f = fbm(N, 4, 5, 51), g2 = fbm(N, 16, 3, 52);
    return textura(N, (x, y, i) => {
      const v = 0.55 + 0.35 * f[i] + 0.15 * (g2[i] - 0.5);
      return [v * 0.8, v * 0.94, v * 0.66];          // em sRGB: no linear o verde satura bem mais
    });
  },
  campo() {
    // capim seco e terra, fora da cerca
    const N = 256, f = fbm(N, 3, 5, 61), t = fbm(N, 8, 3, 62);
    return textura(N, (x, y, i) => {
      const terra = t[i] > 0.62;
      const v = 0.6 + 0.35 * f[i];
      return terra ? [v * 0.95, v * 0.82, v * 0.66] : [v * 0.78, v * 0.86, v * 0.6];
    });
  },
  calcada() {
    // placas de concreto de 1 m: a textura cobre 2 m, junta a cada metade
    const N = 256, f = fbm(N, 6, 4, 71);
    return textura(N, (x, y, i) => {
      if (x % (N / 2) < 2 || y % (N / 2) < 2) return cinza(0.62);
      return cinza(0.86 + 0.14 * f[i]);
    });
  },
  aco() {
    const N = 128, f = fbm(N, 4, 4, 81);
    return textura(N, (x, y, i) => cinza(0.9 + 0.1 * f[i]));
  },
  tinta() {
    // tinta de campo (Fase 25): manchado leve de demao e, aqui e ali, um
    // ponto de desgaste mais escuro — tubo, motor, atuador, guarda-corpo
    const N = 128, f = fbm(N, 6, 4, 131), r = rng(132);
    const gasto = new Float32Array(N * N);
    for (let k = 0; k < 18; k++) {
      const cx = r() * N, cy = r() * N, rr = 1 + r() * 2.5;
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
        const d = Math.hypot(x - cx, y - cy) / rr;
        if (d < 1) gasto[((y + N) % N) * N + ((x + N) % N)] = Math.max(gasto[((y + N) % N) * N + ((x + N) % N)], 1 - d);
      }
    }
    return textura(N, (x, y, i) => cinza(0.88 + 0.12 * f[i] - 0.18 * gasto[i]));
  },
  inox() {
    // escovado: riscos finos numa direcao
    const N = 256, r = rng(91);
    const riscos = Float32Array.from({ length: N }, () => r());
    const f = fbm(N, 4, 3, 92);
    return textura(N, (x, y, i) => cinza(0.86 + 0.08 * riscos[y] + 0.06 * f[i]));
  },
  chapa() {
    // costado de tanque: costura horizontal no topo do ladrilho (curso de 2,4 m)
    const N = 256, f = fbm(N, 3, 4, 101);
    return textura(N, (x, y, i) => (y < 2 ? cinza(0.72) : cinza(0.9 + 0.1 * f[i])));
  },
  isolamento() {
    // capa de aluminio: cinta a cada 1,2 m (borda do ladrilho) e sobreposicao
    const N = 128, f = fbm(N, 4, 3, 111);
    return textura(N, (x, y, i) => {
      if (y < 2) return cinza(0.62);
      if (y < 6) return cinza(0.8);
      return cinza(0.9 + 0.1 * f[i]);
    });
  },
  grade() {
    // piso de grade: barra portante a cada 3 cm, travessa a cada 10 cm
    const N = 128;
    return textura(N, (x, y) => {
      if (x % 13 < 3) return cinza(1.0);
      if (y % 43 < 3) return cinza(0.95);
      return cinza(0.38);
    });
  },
  gradeFuro() {
    // o vazio da grade (Fase 25): alfa 0 entre as barras, o mesmo desenho
    // da `grade`. Sem mipmap: a media do alfa de longe apagaria as barras;
    // quem usa (triplanar vazado) so fura de perto.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, barra = x % 13 < 3 || y % 43 < 3;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = barra ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    const tx = new THREE.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.generateMipmaps = false;
    tx.minFilter = THREE.LinearFilter;
    return tx;
  },
  telhaX() {
    // telha ondulada: onda variando em X (cumeeira em Z)
    const N = 128;
    return textura(N, (x) => cinza(0.78 + 0.22 * Math.sin((x / N) * Math.PI * 2 * 6)));
  },
  telhaZ() {
    const N = 128;
    return textura(N, (x, y) => cinza(0.78 + 0.22 * Math.sin((y / N) * Math.PI * 2 * 6)));
  },
  piso() {
    // ceramica de 60 cm com rejunte, quatro placas por ladrilho de 2,4 m
    const N = 256, f = fbm(N, 3, 4, 31);
    const placa = N / 4;
    return textura(N, (x, y, i) => (x % placa < 2 || y % placa < 2 ? cinza(0.62) : cinza(0.9 + 0.08 * f[i])));
  },
  painel() {
    // painel de fibra com nervura vertical
    const N = 128;
    return textura(N, (x) => cinza(x % 32 < 4 ? 0.8 : 1.0));
  },
};

/* Chao extenso deixa a repeticao aparecer como xadrez ao longe. Nestas, a
 * textura e misturada com ela mesma girada 37 graus e 3,7x maior: o periodo
 * conjunto fica longo demais para o olho achar. Peso da segunda amostra: */
const ANTI_LADRILHO = { campo: 0.5, grama: 0.45, brita: 0.4, asfalto: 0.35, concreto: 0.3 };

const cache = {};
export function texturaProcedural(nome) {
  cache[nome] ??= FABRICAS[nome]();
  return cache[nome];
}

/**
 * Aplica a textura `nome` ao material em projecao triplanar, com um
 * ladrilho a cada `metros` m. Devolve o proprio material.
 */
export function triplanar(material, nome, metros, { vazado = null, ateVazado = 10 } = {}) {
  // fora do navegador (Node: auditorias, geradores) nao ha canvas nem tela
  if (typeof document === 'undefined') return material;
  material.map = texturaProcedural(nome);
  const escala = 1 / metros;
  const mistura = (ANTI_LADRILHO[nome] ?? 0).toFixed(2);
  const furo = vazado ? texturaProcedural(vazado) : null;
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uEscalaT = { value: escala };
    if (furo) sh.uniforms.uFuroT = { value: furo };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosT;\nvarying vec3 vNorT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPosT = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vNorT = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosT;\nvarying vec3 vNorT;\nuniform float uEscalaT;' + (furo ? '\nuniform sampler2D uFuroT;' : ''))
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
        vec4 amostraT(vec2 p) {
          vec2 q = mat2(0.799, -0.602, 0.602, 0.799) * p / 3.7 + 0.37;
          return mix(texture2D(map, p), texture2D(map, q), ${mistura});
        }`)
      .replace('#include <map_fragment>', `
        vec3 pesoT = pow(abs(normalize(vNorT)), vec3(4.0));
        pesoT /= (pesoT.x + pesoT.y + pesoT.z);
        diffuseColor *= amostraT(vPosT.zy * uEscalaT) * pesoT.x
          + amostraT(vPosT.xz * uEscalaT) * pesoT.y
          + amostraT(vPosT.xy * uEscalaT) * pesoT.z;${furo ? `
        // vazado (Fase 25): fura entre as barras na face de cima (ou de
        // baixo), so de perto: de longe o vao fica do tom medio da textura
        if (pesoT.y > 0.5 && distance(vPosT, cameraPosition) < ${ateVazado.toFixed(1)}
            && texture2D(uFuroT, vPosT.xz * uEscalaT).a < 0.5) discard;` : ''}`);
  };
  material.customProgramCacheKey = () => `triplanar-${nome}-${metros}${vazado ? `-${vazado}` : ''}`;
  material.needsUpdate = true;
  return material;
}

/* ------------------------------------------------------------------------
 *  Bandeiras (Fase 27, item 24): pintadas no canvas, nunca imagem.
 *  'brasil' pela geometria da Lei 5.700 (modulo = largura/20): losango a
 *  1,7 M das bordas, circulo de raio 3,5 M, faixa branca curva; as estrelas
 *  so como pontos. 'empresa': branca, com o nome da placa da portaria.
 * --------------------------------------------------------------------- */
const bandeiras = {};
/** Listras horizontais (a camisa do companion): `cores` se alternam em
 *  `faixas` faixas ao longo de v — a altura do tronco e do braco. */
const LISTRAS = new Map();
export function texturaListras(cores, faixas = 8) {
  const k = `${cores.join('-')}-${faixas}`;
  if (LISTRAS.has(k)) return LISTRAS.get(k);
  const c = document.createElement('canvas');
  c.width = 4; c.height = faixas * 8;
  const x = c.getContext('2d');
  for (let i = 0; i < faixas; i++) {
    x.fillStyle = `#${cores[i % cores.length].toString(16).padStart(6, '0')}`;
    x.fillRect(0, i * 8, 4, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  LISTRAS.set(k, t);
  return t;
}

export function texturaBandeira(nome, texto = 'BENZOIC INDUSTRIES') {
  if (bandeiras[nome]) return bandeiras[nome];
  const W = 400, H = 280, M = W / 20;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  if (nome === 'brasil') {
    c.fillStyle = '#009c3b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffdf00';
    c.beginPath(); c.moveTo(1.7 * M, H / 2); c.lineTo(W / 2, 1.7 * M); c.lineTo(W - 1.7 * M, H / 2); c.lineTo(W / 2, H - 1.7 * M); c.closePath(); c.fill();
    c.fillStyle = '#002776';
    c.beginPath(); c.arc(W / 2, H / 2, 3.5 * M, 0, Math.PI * 2); c.fill();
    // faixa branca: arco de um circulo de raio 8 M com centro abaixo
    c.save();
    c.beginPath(); c.arc(W / 2, H / 2, 3.5 * M, 0, Math.PI * 2); c.clip();
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.5 * M;
    c.beginPath(); c.arc(W / 2 - 2 * M, H / 2 + 6.5 * M, 8 * M, -Math.PI * 0.62, -Math.PI * 0.2); c.stroke();
    c.fillStyle = '#ffffff';
    for (const [x, y] of [[0.2, 0.55], [-0.4, 0.6], [0.5, 0.75], [-0.1, 0.85], [0.05, 0.4], [-0.6, 0.45], [0.7, 0.4]]) {
      c.beginPath(); c.arc(W / 2 + x * 3 * M, H / 2 + (y - 0.4) * 5 * M, 0.18 * M, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  } else {
    c.fillStyle = '#f4f4f1'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1f5a8a'; c.fillRect(0, H - 34, W, 34);
    c.fillStyle = '#1f5a8a';
    c.font = 'bold 44px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const [a, b] = texto.split(' ');
    c.fillText(a ?? texto, W / 2, H * 0.36);
    c.font = 'bold 30px Arial, sans-serif';
    c.fillText(b ?? '', W / 2, H * 0.58);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  bandeiras[nome] = t;
  return t;
}
