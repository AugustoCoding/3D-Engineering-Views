import * as THREE from 'three';
import { triplanar } from '../lib/texturas.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { criarControlesLivres } from './controls.js';
import { CEU } from '../data/ambiente.js';

/**
 * Cena, ceu, terreno, iluminacao e loop de render.
 *
 * Tudo e gerado por codigo — nenhuma textura ou HDRI externo — para o
 * entregavel continuar sendo UM arquivo HTML que abre sem internet.
 */

/* Matrizes do ACESFilmicToneMapping do three (as colunas do GLSL, aqui por
 * linha) e suas inversas, para o ceu desfazer o tone mapping do fim da cadeia. */
const ACES_INV = {
  entrada: new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777).invert(),
  saida: new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602).invert(),
};

/** Ceu: esfera invertida com gradiente do horizonte ao zenite, nuvens e
 *  estrelas (Fase 25), tudo no shader: nenhuma textura. As nuvens sao ruido
 *  fractal projetado num plano alto (a projecao achata perto do horizonte,
 *  como nuvem de verdade), sombreadas pela diferenca do ruido na direcao da
 *  luz e somem rente ao horizonte; as estrelas sao pontos sorteados numa
 *  grade da esfera e ficam atras das nuvens. */
function criarCeu(raio = 600) {
  const N = CEU.nuvens;
  const geo = new THREE.SphereGeometry(raio, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    // O ceu e fundo, nao superficie iluminada: passar pelo ACES o escurecia
    // ate virar cinza-chumbo. Fora do tone mapping ele sai na cor declarada.
    toneMapped: false,
    uniforms: {
      corAlto: { value: new THREE.Color(0x2f6fb5) },
      corHorizonte: { value: new THREE.Color(0xcfe3f2) },
      corBaixo: { value: new THREE.Color(0x8fa2ae) },
      // Com pos-processamento (core/realismo.js) o tone mapping vai para o fim
      // da cadeia e pega o ceu tambem. Ai o ceu sai pela INVERSA do ACES, e o
      // ACES do fim devolve a cor declarada.
      compor: { value: false },
      exposicao: { value: 1 },
      tempo: { value: 0 },
      cobertura: { value: N.cobertura },
      escalaNuvem: { value: N.escala },
      vento: { value: new THREE.Vector2(...N.vento) },
      corNuvem: { value: new THREE.Color(N.cor) },
      sombraNuvem: { value: new THREE.Color(N.sombra) },
      opacidadeNuvem: { value: N.opacidade },
      estrelas: { value: 0 },
      invEntrada: { value: ACES_INV.entrada },
      invSaida: { value: ACES_INV.saida },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 corAlto, corHorizonte, corBaixo, corNuvem, sombraNuvem;
      uniform bool compor;
      uniform float exposicao, tempo, cobertura, escalaNuvem, opacidadeNuvem, estrelas;
      uniform vec2 vento;
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * ruido(p); p = p * 2.03 + 17.1; a *= 0.5; }
        return v;
      }
      uniform mat3 invEntrada, invSaida;
      varying vec3 vPos;
      // inversa da curva RRT+ODT do ACESFilmicToneMapping do three: a / b = y
      // vira uma equacao de 2o grau em v, por canal
      vec3 invRRT(vec3 y) {
        vec3 A = 1.0 - 0.983729 * y;
        vec3 B = 0.0245786 - 0.432951 * y;
        vec3 C = -(0.000090537 + 0.238081 * y);
        return (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
      }
      void main() {
        vec3 d = normalize(vPos);
        float h = d.y;
        vec3 c = h > 0.0
          ? mix(corHorizonte, corAlto, pow(clamp(h, 0.0, 1.0), 0.55))
          : mix(corHorizonte, corBaixo, pow(clamp(-h, 0.0, 1.0), 0.4));
        if (h > 0.0) {
          // estrelas: um ponto por celula sorteada de uma grade na esfera
          vec3 q = d * 280.0, cel = floor(q);
          float s = step(0.9965, hash3(cel)) * smoothstep(0.45, 0.05, length(fract(q) - 0.5)) * smoothstep(0.02, 0.2, h);
          // nuvens: ruido num plano alto, andando com o vento
          vec2 uv = d.xz / (h + 0.12) * escalaNuvem + vento * tempo;
          float n = fbm(uv);
          float dens = smoothstep(cobertura, cobertura + 0.22, n) * smoothstep(0.0, 0.16, h) * opacidadeNuvem;
          float luz = clamp(0.55 + (n - fbm(uv + vec2(0.06, 0.04))) * 4.0, 0.0, 1.0);
          c += estrelas * s * (1.0 - dens) * vec3(0.9, 0.92, 1.0);
          c = mix(c, mix(sombraNuvem, corNuvem, luz), dens);
        }
        if (compor) {
          vec3 alvo = clamp(pow(c, vec3(2.2)), 0.0, 0.98);   // o fim da cadeia codifica em sRGB
          c = max(invEntrada * invRRT(invSaida * alvo), 0.0) * 0.6 / exposicao;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const ceu = new THREE.Mesh(geo, mat);
  ceu.name = 'ceu';
  return ceu;
}

export function criarCena(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9db4c6, 130, 520);

  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // 1 pixel de desenho por pixel de CSS (16/11/2026): em tela de densidade
  // alta eram ate 4 vezes mais pixels por quadro, e a apresentacao vai a um projetor
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap saiu na r186 do three; o PCFShadowMap passou a ser o suave
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.localClippingEnabled = true;      // habilita o corte em secao
  renderer.domElement.classList.add('canvas3d');
  container.appendChild(renderer.domElement);

  /* ---------------- rotulos HTML sobre o 3D ---------------- */
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.classList.add('camada-rotulos');
  container.appendChild(labelRenderer.domElement);

  /* ---------------- camera e controles ---------------- */
  // near/far apertados de proposito: a precisao do z-buffer depende da RAZAO
  // far/near. Com 0,05 / 1200 (24 000:1) duas superficies a 2 cm uma da outra
  // ja disputavam profundidade a 60 m e cintilavam. 0,1 / 900 (9 000:1) da
  // quase tres vezes mais margem, e nada e visivel alem de 520 m (fim da
  // neblina) nem mais perto que 0,6 m (altura minima da camera).
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  camera.position.set(22, 9, 26);

  const controls = criarControlesLivres(camera, renderer.domElement);

  /* ---------------- ceu ---------------- */
  const ceu = criarCeu();
  scene.add(ceu);

  /* ---------------- iluminacao ---------------- */
  /* Reflexo de ceu aberto: o metal reflete o azul em cima e o chao embaixo,
   * como ao ar livre. O RoomEnvironment era um estudio fechado e deixava o inox
   * com cara de foto de catalogo. O PMREM renderiza com near/far de 0,1/100,
   * dai o ceu de raio 50 nesta cena auxiliar. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cenaReflexo = new THREE.Scene();
  cenaReflexo.add(criarCeu(50));
  const chaoReflexo = new THREE.Mesh(new THREE.CircleGeometry(48, 32), new THREE.MeshBasicMaterial({ color: 0x55574f }));
  chaoReflexo.rotation.x = -Math.PI / 2;
  chaoReflexo.position.y = -1.5;
  cenaReflexo.add(chaoReflexo);
  scene.environment = pmrem.fromScene(cenaReflexo, 0.03).texture;

  // Hemisferica com chao escuro: sem isso o inox recebia um verde de baixo que
  // sujava a cor do equipamento. Intensidade contida para o sol dar o contraste.
  const hemi = new THREE.HemisphereLight(0xd6e6f7, 0x2a3037, 0.75);
  scene.add(hemi);

  /* Sol com sombra na planta inteira: a janela de sombra (140 m) acompanha a
   * camera, em vez de ficar presa em volta da laje — arvores, predios,
   * tanques e caminhoes passam a sombrear o chao. Ver seguirSombra(). */
  const sol = new THREE.DirectionalLight(0xfff4e2, 2.5);
  const DIR_SOL = new THREE.Vector3(30, 40, 22).normalize();
  sol.castShadow = true;
  // 2048 (era 4096): um quarto dos pixels de sombra; a borda fica um pouco mais mole
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 400;
  sol.shadow.bias = -0.0007;
  sol.shadow.normalBias = 0.03;
  scene.add(sol, sol.target);
  /* O mapa de sombra custava ~10 ms por quadro (2 mil desenhos a mais).
   * Refaz-se so quando a janela muda de texel ou a cada 1/12 s, que e o
   * bastante para a sombra de um caminhao andando. */
  renderer.shadowMap.autoUpdate = false;
  let desdeSombra = Infinity;
  const ultimoFoco = new THREE.Vector3(NaN, NaN, NaN);
  let meiaSombra = 0;
  const _f = new THREE.Vector3(), _bx = new THREE.Vector3(), _by = new THREE.Vector3();
  _bx.crossVectors(new THREE.Vector3(0, 1, 0), DIR_SOL).normalize();
  _by.crossVectors(DIR_SOL, _bx);
  /**
   * Centra a sombra no chao a frente da camera. A janela cresce com a altura
   * (vista de planta) e o centro cai num multiplo do texel no referencial da
   * luz: sem isso a borda das sombras cintila a cada passo da camera.
   */
  function seguirSombra() {
    const fwd = camera.getWorldDirection(_f);
    const foco = camera.position.clone();
    if (fwd.y < -0.08) foco.addScaledVector(fwd, Math.min(camera.position.y / -fwd.y, 70));
    else foco.addScaledVector(fwd.setY(0).normalize(), 40);
    foco.y = 0;
    const meia = THREE.MathUtils.clamp(camera.position.y * 0.6, 70, 170);
    if (Math.abs(meia - meiaSombra) > 1) {
      meiaSombra = meia;
      const c = sol.shadow.camera;
      c.left = -meia; c.right = meia; c.top = meia; c.bottom = -meia;
      c.updateProjectionMatrix();
    }
    const texel = (2 * meiaSombra) / sol.shadow.mapSize.x;
    const fx = Math.round(foco.dot(_bx) / texel) * texel;
    const fy = Math.round(foco.dot(_by) / texel) * texel;
    const fz = foco.dot(DIR_SOL);
    sol.target.position.set(0, 0, 0).addScaledVector(_bx, fx).addScaledVector(_by, fy).addScaledVector(DIR_SOL, fz);
    sol.position.copy(sol.target.position).addScaledVector(DIR_SOL, 200);
    if (!sol.target.position.equals(ultimoFoco) || desdeSombra > 1 / 12) {
      ultimoFoco.copy(sol.target.position);
      renderer.shadowMap.needsUpdate = true;
      desdeSombra = 0;
    }
  }

  // `position` e somente-leitura em Object3D: atribuir com Object.assign
  // levanta TypeError. Usa-se sempre o .set() do vetor.
  const preenchimento = new THREE.DirectionalLight(0xbcd6ff, 0.35);
  preenchimento.position.set(-20, 14, -16);
  scene.add(preenchimento);

  /* ---------------- cotas verticais do chao ----------------
   * Uma unica escada de alturas, declarada aqui, para nada ficar coplanar com
   * nada. Duas faces no MESMO plano disputam o mesmo valor de profundidade e o
   * resultado e a mancha que aparece e some conforme a camera anda — era o caso
   * do terreno (-0,02) contra o topo da laje (0,00), a 2 cm de distancia. */
  const Y_PISO = 0;            // topo da laje = piso acabado = datum do modelo
  const Y_TERRENO = -0.25;     // o pavimento de processo e um degrau acima do terreno
  const ESP_LAJE = 0.35;
  const TOPO_BORDA = -0.06;    // viga de borda, um pouco abaixo do piso
  const BASE_BORDA = -0.60;

  /* ---------------- terreno ----------------
   * Capim seco e terra, num tom escuro e apagado: verde vivo competia com as
   * etiquetas coloridas das linhas, e o chao escuro faz o inox saltar. */
  const campo = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    triplanar(new THREE.MeshStandardMaterial({ color: 0x4f5848, roughness: 1, metalness: 0 }), 'campo', 8),
  );
  campo.rotation.x = -Math.PI / 2;
  campo.position.y = Y_TERRENO;
  campo.receiveShadow = true;
  campo.name = 'campo';
  scene.add(campo);

  /**
   * Laje de concreto da area de processo, sobre uma viga de borda.
   *
   * A laje sobe 25 cm acima do terreno em vez de ficar rente a ele: alem de
   * ser o que se faz em obra (o pavimento de processo drena para fora), separa
   * as duas superficies o bastante para nenhuma disputar profundidade com a
   * outra. A viga de borda para 6 cm abaixo do piso, e nao no mesmo plano.
   */
  function criarLaje(largura, profundidade, centro = new THREE.Vector3()) {
    const g = new THREE.Group();
    g.name = 'laje';

    // Concreto com junta de dilatacao a cada 6 m (a borda do ladrilho).
    const laje = new THREE.Mesh(
      new THREE.BoxGeometry(largura, ESP_LAJE, profundidade),
      triplanar(new THREE.MeshStandardMaterial({ color: 0x6c7176, roughness: 0.95, metalness: 0 }), 'laje', 6),
    );
    laje.position.set(centro.x, Y_PISO - ESP_LAJE / 2, centro.z);
    laje.receiveShadow = true;
    g.add(laje);

    const hBorda = TOPO_BORDA - BASE_BORDA;
    const borda = new THREE.Mesh(
      new THREE.BoxGeometry(largura + 0.6, hBorda, profundidade + 0.6),
      triplanar(new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.95 }), 'concreto', 2),
    );
    borda.position.set(centro.x, BASE_BORDA + hBorda / 2, centro.z);
    borda.receiveShadow = true;
    g.add(borda);

    scene.add(g);
    return g;
  }

  /* ---------------- redimensionamento ---------------- */
  function ajustar() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  ajustar();
  window.addEventListener('resize', ajustar);

  /* ---------------- loop ----------------
   * Dois ganchos, e a ORDEM entre eles importa:
   *
   *   antesDeRenderizar  roda com a camera do quadro anterior — serve para
   *                      animacao (agitador, filtros), que nao depende dela.
   *   antesDosRotulos    roda DEPOIS de controls.update() e do render, ou seja
   *                      com a camera e as matrizes de mundo ja do quadro
   *                      corrente. Quem posiciona etiqueta tem de estar aqui:
   *                      no gancho de cima, a etiqueta usaria a camera de
   *                      ontem e arrastaria um quadro atras do modelo em toda
   *                      movimentacao. */
  const antesDeRenderizar = [];
  const antesDosRotulos = [];
  // Quem desenha o quadro: o render direto, ou o pos-processamento (realismo.js)
  let renderizar = () => renderer.render(scene, camera);
  const trocarRenderizacao = (f) => { renderizar = f ?? (() => renderer.render(scene, camera)); };
  // Timer no lugar do Clock (obsoleto no three): ligado ao documento, da dt
  // zero enquanto a aba esta oculta, em vez de um salto ao voltar. Sem a marca
  // do requestAnimationFrame (inicio do quadro, pode ser anterior ao instante
  // em que o Timer nasceu): com ela o primeiro dt saia negativo.
  const relogio = new THREE.Timer();
  relogio.connect(document);

  function loop() {
    requestAnimationFrame(loop);
    relogio.update();
    const dt = Math.min(Math.max(relogio.getDelta(), 0), 0.1);
    for (const f of antesDeRenderizar) f(dt);
    ceu.material.uniforms.tempo.value += dt;          // as nuvens andam
    controls.update(dt);
    desdeSombra += dt;
    seguirSombra();
    // A neblina afasta com a altura: no chao ela da profundidade; do alto (vista
    // geral) apagaria metade da planta. A vista de planta a desliga de todo.
    if (scene.fog) {
      const h = Math.max(0, camera.position.y - 10);
      scene.fog.near = 130 + 1.4 * h;
      scene.fog.far = 520 + 2.2 * h;
    }
    renderizar();
    for (const f of antesDosRotulos) f(dt);
    // as etiquetas so aparecem na vista de planta: com a camada oculta, nao
    // se percorre a cena inteira a cada quadro para posiciona-las
    if (!labelRenderer.domElement.classList.contains('oculto')) labelRenderer.render(scene, camera);
  }
  loop();

  /** Enquadra um objeto confortavelmente na tela. */
  function enquadrar(objeto, margem = 1.35) {
    const caixa = new THREE.Box3().setFromObject(objeto);
    controls.enquadrarCaixa(caixa, margem);
  }

  return {
    scene, camera, renderer, labelRenderer, controls,
    enquadrar, criarLaje, antesDeRenderizar, antesDosRotulos, sol, hemi, preenchimento, trocarRenderizacao, criarCeu, pmrem,
  };
}
