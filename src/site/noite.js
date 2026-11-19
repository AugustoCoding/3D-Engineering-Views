import * as THREE from 'three';
import { NOITE } from '../data/ambiente.js';
import { Y } from '../lib/terreno.js';
import { grade } from '../lib/fotometria.js';
import { LAJE_PROPOSTA } from '../data/arranjo-proposto.js';

/**
 * ===========================================================================
 *  MODO NOITE  (Fase 24)
 * ===========================================================================
 *  Tecla N: o dia vira noite em `NOITE.transicao` segundos (e volta). O que
 *  muda, tudo por regra a partir do que ja esta na cena:
 *    - ceu escuro com estrelas e nuvens escuras (shader do ceu, Fase 25), neblina azul-escura, a lua no lugar do sol
 *      (mesma direcao: a sombra nao troca de lado) e o reflexo do metal de
 *      ceu noturno;
 *    - acende pelo NOME do material o que e lampada: luminaria dos postes,
 *      farol e lanterna dos veiculos, janelas (luz de dentro), letreiros e a
 *      placa da empresa;
 *    - a "poca" de luz de cada poste no chao, sob a luminaria (instancias,
 *      uma chamada de desenho, soma de cor sem escrever profundidade);
 *    - refletores de verdade (SpotLight, sem sombra) onde ha trabalho a
 *      noite: nas pontas do rack, sob a cobertura da descarga e da
 *      portaria, sobre o portao do armazem e na caldeira;
 *    - balizamento vermelho piscando no ponto mais alto da chamine e do
 *      castelo d'agua;
 *    - dentro de predio, a lampada da sala em que a camera esta acende no
 *      teto dela (uma PointLight que existe desde o comeco, apagada de dia:
 *      acende-la nao recompila nada). Subir a luz ambiente inteira, como na
 *      primeira versao, clareava tambem o lado de fora visto da porta.
 *  Refletores e pocas nascem em `preparar()`, chamado pelo main.js
 *  alguns segundos depois de carregar: os shaders da noite (oito luzes a
 *  mais) compilam em segundo plano contra uma cena so com as luzes da noite.
 *  Sem isso, a primeira tecla N travava a tela ~3 s. De dia as luzes ficam
 *  invisiveis: nao custam nada, e cada troca reaproveita os programas.
 */
export function criarNoite({ cena, ambiente, entorno, tubulacao, interiores, iluminacao = null, aoMudar }) {
  const { scene, sol, hemi, preenchimento } = cena;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (c) => new THREE.Color(c);
  const caixa = (o) => new THREE.Box3().setFromObject(o);
  const objeto = (nome) => entorno.objetos.find((o) => o.nome === nome)?.grupo;

  /* ------------------------------------------------ o dia, como esta */
  const ceu = scene.getObjectByName('ceu');
  const u = ceu.material.uniforms;
  const dia = {
    alto: u.corAlto.value.clone(), horizonte: u.corHorizonte.value.clone(), baixo: u.corBaixo.value.clone(),
    nuvem: u.corNuvem.value.clone(), sombraNuvem: u.sombraNuvem.value.clone(),
    neblina: scene.fog.color.clone(),
    sol: { cor: sol.color.clone(), i: sol.intensity },
    hemi: { ceu: hemi.color.clone(), chao: hemi.groundColor.clone(), i: hemi.intensity },
    preenchimento: preenchimento.intensity,
    ambiente: scene.environment, reflexo: scene.environmentIntensity ?? 1,
  };
  const noite = {
    alto: C(NOITE.ceu.alto), horizonte: C(NOITE.ceu.horizonte), baixo: C(NOITE.ceu.baixo), neblina: C(NOITE.neblina),
    nuvem: C(NOITE.nuvem.cor), sombraNuvem: C(NOITE.nuvem.sombra),
    lua: C(NOITE.lua.cor), hemi: { ceu: C(NOITE.hemi.ceu), chao: C(NOITE.hemi.chao) },
  };

  /* ------------------------------------------------ a lampada da sala */
  const lampada = new THREE.PointLight(C(NOITE.lampada.cor), 0, 10, 2);
  lampada.name = 'lampada-da-sala';
  scene.add(lampada);
  const salas = (interiores?.interiores ?? []).flatMap((it) => it.registro.salas);
  let desdeSala = 1;
  function acharSala() {
    const p = cena.camera.position;
    const s = salas.find((q) => p.x > q.ret.x0 && p.x < q.ret.x1 && p.z > q.ret.z0 && p.z < q.ret.z1 && p.y > q.y && p.y < q.teto);
    if (!s) { lampada.userData.forca = 0; return; }
    const r = Math.hypot(s.ret.x1 - s.ret.x0, s.ret.z1 - s.ret.z0, s.teto - s.y) / 2;
    lampada.position.set((s.ret.x0 + s.ret.x1) / 2, s.teto - 0.25, (s.ret.z0 + s.ret.z1) / 2);
    lampada.distance = 2 * r;
    lampada.userData.forca = NOITE.lampada.e * r * r;       // E = I / r^2 na meia diagonal
  }

  /* ------------------------------------------------ o que acende, pelo nome */
  // dia -> noite de cada material: [cor emissiva, intensidade]
  const REGRAS = [
    [(n) => n === 'luminaria', NOITE.luminaria.cor, NOITE.luminaria.intensidade],
    [(n) => n === 'farol', 0xfff3d6, NOITE.farol],
    [(n) => n === 'lanterna', 0xff2418, NOITE.lanterna],
    [(n) => n === 'vidro-janela', NOITE.janela.cor, NOITE.janela.intensidade],
    [(n) => n === 'vidro-fosco', 0xffe8c4, NOITE.janela.intensidade * 1.6],
    [(n) => n.startsWith('letreiro-'), null, NOITE.letreiro],
    [(n) => n === 'placa-empresa', null, NOITE.placa],
  ];
  let lampadas = null;
  function colher() {
    lampadas = [];
    const vistos = new Set();
    let grupoLuz = 0;
    scene.traverse((o) => {
      for (const m of [o.material].flat()) {
        if (!m || vistos.has(m) || !m.emissive) continue;
        vistos.add(m);
        const r = REGRAS.find(([f]) => f(m.name ?? ''));
        if (!r) continue;
        // cada material de luminaria e um grupo da fotocelula
        if (m.name === 'luminaria') m.userData.limiar = NOITE.fotocelula.limiares[grupoLuz++ % NOITE.fotocelula.limiares.length];
        lampadas.push({ m, cor0: m.emissive.clone(), i0: m.emissiveIntensity, cor1: r[1] === null ? m.emissive.clone() : C(r[1]), i1: r[2] });
      }
    });
  }

  /* ------------------------------------------------ montado na primeira noite */
  let montado = false, pocas = null, luzLaje = null, ambienteNoite = null;
  const refletores = [], balizas = [];
  function montar() {
    montado = true;
    colher();

    // poca de luz de cada poste: um disco com gradiente, no chao sob a
    // luminaria, 4 cm acima da calcada (o degrau mais alto do chao)
    const fontes = [];
    const luminarias = ambiente.grupo.getObjectByName('postes')?.children.find((c) => c.material?.name === 'luminaria');
    if (luminarias) {
      const m = new THREE.Matrix4(), p = V(), q = new THREE.Quaternion(), e = V();
      for (let i = 0; i < luminarias.count; i++) {
        luminarias.getMatrixAt(i, m);
        m.decompose(p, q, e);
        fontes.push({ x: p.x, y: Y.calcada + 0.04, z: p.z, r: NOITE.poca.raio });
      }
    }
    // luz na laje (Fase 26): a iluminancia de todas as luminarias da laje
    // numa grade do piso (lib/fotometria.js, a mesma conta da auditoria)
    // vira uma textura somada ao chao — o que se ve e o que se mediu
    if (iluminacao) {
      const lums = [];
      iluminacao.updateMatrixWorld(true);
      iluminacao.traverse((o) => {
        const L = o.userData?.luminaria;
        if (L) lums.push({ ...L, p: o.getWorldPosition(V()) });
      });
      const LL = NOITE.luzLaje, [x0, x1] = LAJE_PROPOSTA.x, [z0, z1] = LAJE_PROPOSTA.z;
      const gr = grade({ x0: x0 - LL.margem, x1: x1 + LL.margem, z0: z0 - LL.margem, z1: z1 + LL.margem, passo: LL.passo, y: 0 }, lums);
      const dados = new Uint8Array(gr.nx * gr.nz * 4);
      for (let k = 0; k < gr.E.length; k++) {
        const b = Math.round(255 * Math.min(1, gr.E[k] / LL.eRef) ** LL.gama);
        dados.set([b, b, b, 255], 4 * k);
      }
      const tex = new THREE.DataTexture(dados, gr.nx, gr.nz);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const w = (gr.nx - 1) * gr.passo, d = (gr.nz - 1) * gr.passo;
      // a textura tem a linha j em z crescente: o plano deitado leva v para -z
      const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      luzLaje = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: tex, color: C(LL.cor), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
      }));
      luzLaje.position.set(gr.x0 + w / 2, 0.02, gr.z0 + d / 2);
      luzLaje.name = 'luz-na-laje';
      // acende com o grupo das lentes da laje (fotocelula)
      iluminacao.traverse((o) => { if (o.material?.name === 'luminaria') luzLaje.userData.limiar ??= o.material.userData.limiar; });
      luzLaje.visible = false;
      luzLaje.userData.grade = gr;
      scene.add(luzLaje);
    }
    if (fontes.length) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
      pocas = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
        map: tex, color: C(NOITE.poca.cor), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }), fontes.length);
      fontes.forEach((f, i) => pocas.setMatrixAt(i, new THREE.Matrix4().makeTranslation(f.x, f.y, f.z).scale(V(f.r, 1, f.r))));
      pocas.instanceMatrix.needsUpdate = true;
      pocas.computeBoundingSphere();
      pocas.name = 'pocas-de-luz';
      pocas.userData.limiar = luminarias?.material.userData.limiar;
      pocas.frustumCulled = false;
      scene.add(pocas);
    }

    // refletores: onde fica cada um e para onde aponta, pela regra
    const lugares = [];
    if (tubulacao?.rack) {
      // nas pontas do rack, por cima das vigas, mirando o meio da laje
      const R = tubulacao.rack, ya = R.niveis.at(-1) + 1.2;
      const xa = Math.min(...R.xs), xb = Math.max(...R.xs), xm = (xa + xb) / 2;
      for (const x of [xa, xb]) for (const z of [R.z - R.largura / 2, R.z + R.largura / 2]) {
        // num mastro que continua a coluna do portico acima da ultima viga
        lugares.push({ p: V(x, ya, z), alvo: V(xm + (x - xm) * 0.25, 0, R.z + (z - R.z) * 3), preso: { ate: V(x, R.niveis.at(-1) - 0.1, z) } });
      }
    }
    // sob as coberturas: logo abaixo do telhado, mirando o chao embaixo, de
    // facho aberto (luminaria de teto) e um a cada `vaoTeto` m do lado maior
    for (const nome of ['cobertura-descarga', 'cobertura-portaria', 'cobertura-caldeira']) {
      const g = objeto(nome);
      if (!g) continue;
      const b = caixa(g), c = b.getCenter(V()), t = b.getSize(V());
      const eixoX = t.x >= t.z, L = eixoX ? t.x : t.z, n = Math.max(1, Math.round(L / NOITE.refletor.vaoTeto));
      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) / n - 0.5;
        const x = c.x + (eixoX ? s * L : 0), z = c.z + (eixoX ? 0 : s * L);
        // pendurado no telhado: o pendural vai ate o telhado, achado por um
        // raio que desce de cima da cobertura (de baixo, a face do telhado
        // virada para cima nao conta para o raio)
        lugares.push({ p: V(x, b.max.y - 0.5, z), alvo: V(x, 0, z), abertura: NOITE.refletor.aberturaTeto, forca: NOITE.refletor.intensidadeTeto,
          preso: { de: V(x, b.max.y + 1, z), raio: V(0, -1, 0), em: g } });
      }
    }
    // sobre o portao do armazem, para fora, onde o bau manobra
    const arm = interiores?.interiores.find((it) => it.registro.bloco === 'ARMAZEM');
    const portao = arm?.predio.userData.portasEnrolar?.[0]?.malha;
    if (portao) {
      const pb = caixa(portao), pc = pb.getCenter(V()), cc = caixa(arm.predio).getCenter(V());
      const fora = V(pc.x - cc.x, 0, pc.z - cc.z);
      fora.set(Math.abs(fora.x) > Math.abs(fora.z) ? Math.sign(fora.x) : 0, 0, Math.abs(fora.x) > Math.abs(fora.z) ? 0 : Math.sign(fora.z));
      // logo acima da verga, afastado da fachada: o letreiro fica mais acima
      // num braco ate a fachada (o raio de volta para o predio acha a parede)
      lugares.push({ p: V(pc.x, pb.max.y + 0.35, pc.z).addScaledVector(fora, 0.5), alvo: V(pc.x, 0, pc.z).addScaledVector(fora, 12),
        preso: { raio: fora.clone().negate(), em: arm.predio } });
    }
    const caixaLuz = new THREE.BoxGeometry(0.55, 0.3, 0.4);
    // o que prende o refletor (Fase 25: nada solto no ar): barra de aco do
    // centro da luminaria ate o apoio — o ponto dado ou onde um raio bate
    const matBarra = new THREE.MeshStandardMaterial({ color: 0x5f666d, metalness: 0.5, roughness: 0.5, name: 'suporte-refletor' });
    const rc = new THREE.Raycaster();
    function prender(p, preso) {
      let ate = preso.ate;
      if (!ate) {
        rc.set(preso.de ?? p, preso.raio.clone().normalize());
        rc.far = 6;
        ate = rc.intersectObject(preso.em, true).find((h) => h.object.isMesh)?.point;
      }
      if (!ate) return;
      const d = ate.clone().sub(p), L = d.length();
      const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, L, 8), matBarra);
      barra.position.copy(p).addScaledVector(d, 0.5);
      barra.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
      barra.name = 'suporte-refletor';
      scene.add(barra);
    }
    const matLuz = new THREE.MeshStandardMaterial({ color: 0x3a3f45, emissive: C(NOITE.refletor.cor), emissiveIntensity: 0, name: 'refletor' });
    for (const { p, alvo, abertura = NOITE.refletor.abertura, forca = NOITE.refletor.intensidade, preso } of lugares) {
      if (preso) prender(p, preso);
      const l = new THREE.SpotLight(C(NOITE.refletor.cor), 0, NOITE.refletor.alcance, THREE.MathUtils.degToRad(abertura / 2), 0.55, 2);
      l.position.copy(p);
      l.target.position.copy(alvo);
      l.visible = false;
      l.userData.forca = forca;
      scene.add(l, l.target);
      // a luminaria que se ve: uma caixa voltada para o alvo
      const f = new THREE.Mesh(caixaLuz, matLuz);
      f.position.copy(p);
      f.lookAt(alvo);
      f.name = 'refletor';
      scene.add(f);
      refletores.push(l);
    }
    lampadas.push({ m: matLuz, cor0: C(NOITE.refletor.cor), i0: 0, cor1: C(NOITE.refletor.cor), i1: 1.5 });

    // balizamento: no ponto mais alto da malha mais alta de cada objeto
    const matBaliza = new THREE.MeshBasicMaterial({ color: C(NOITE.balizamento.cor), transparent: true, opacity: 0, fog: false });
    // os do entorno pelo nome, e os mastros de projetores da laje (Fase 27,
    // item 19): 16 m, o ponto mais alto da area de processo
    const balizar = NOITE.balizamento.nomes.map((nome) => [nome, objeto(nome)]);
    iluminacao?.traverse((o) => { if (o.name === 'mastro-iluminacao') balizar.push([`mastro-${balizar.length}`, o]); });
    for (const [nome, g] of balizar) {
      if (!g) continue;
      if (g.userData.topo) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), matBaliza);
        b.position.set(...g.userData.topo);
        b.name = `balizamento-${nome}`;
        scene.add(b);
        balizas.push(b);
        continue;
      }
      let topo = null;
      g.traverse((o) => { if (o.isMesh) { const b = caixa(o); if (!topo || b.max.y > topo.max.y) topo = b; } });
      if (!topo) continue;
      const c = topo.getCenter(V());
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), matBaliza);
      b.position.set(c.x, topo.max.y + 0.2, c.z);
      b.name = `balizamento-${nome}`;
      scene.add(b);
      balizas.push(b);
    }

    // reflexo do metal: ceu noturno no PMREM (o mesmo ceu, cores da noite)
    const cenaReflexo = new THREE.Scene();
    const ceuR = cena.criarCeu(50);
    Object.assign(ceuR.material.uniforms, {
      corAlto: { value: noite.alto }, corHorizonte: { value: noite.horizonte }, corBaixo: { value: noite.baixo },
      corNuvem: { value: noite.nuvem }, sombraNuvem: { value: noite.sombraNuvem },
    });
    cenaReflexo.add(ceuR);
    const chao = new THREE.Mesh(new THREE.CircleGeometry(48, 32), new THREE.MeshBasicMaterial({ color: 0x0c0d0e }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.y = -1.5;
    cenaReflexo.add(chao);
    ambienteNoite = cena.pmrem.fromScene(cenaReflexo, 0.03).texture;
  }

  /* ------------------------------------------------ aplicar k (0 dia, 1 noite) */
  let k = 0, alvo = 0, dentro = false, relogio = 0;
  const neblinaDaCena = scene.fog;
  const L = (a, b, t) => a + (b - a) * t;
  function aplicar() {
    const t = k * k * (3 - 2 * k);                          // suave nas pontas
    u.corAlto.value.lerpColors(dia.alto, noite.alto, t);
    u.corHorizonte.value.lerpColors(dia.horizonte, noite.horizonte, t);
    u.corBaixo.value.lerpColors(dia.baixo, noite.baixo, t);
    u.corNuvem.value.lerpColors(dia.nuvem, noite.nuvem, t);
    u.sombraNuvem.value.lerpColors(dia.sombraNuvem, noite.sombraNuvem, t);
    u.estrelas.value = NOITE.estrelas * t;
    // (a vista de planta tira a neblina da cena: a cor vai na que foi guardada)
    neblinaDaCena.color.lerpColors(dia.neblina, noite.neblina, t);
    sol.color.lerpColors(dia.sol.cor, noite.lua, t);
    sol.intensity = L(dia.sol.i, NOITE.lua.intensidade, t);
    preenchimento.intensity = L(dia.preenchimento, NOITE.preenchimento, t);
    hemi.color.lerpColors(dia.hemi.ceu, noite.hemi.ceu, t);
    hemi.groundColor.lerpColors(dia.hemi.chao, noite.hemi.chao, t);
    hemi.intensity = L(dia.hemi.i, NOITE.hemi.intensidade, t);
    scene.environment = t > 0.5 && ambienteNoite ? ambienteNoite : dia.ambiente;
    scene.environmentIntensity = L(dia.reflexo, NOITE.reflexo, t);
    // fotocelula: luminaria acende em degrau no limiar do grupo dela
    const degrau = (lim) => (lim == null ? t : Math.min(1, Math.max(0, (t - lim) / NOITE.fotocelula.rampa)));
    for (const l of lampadas ?? []) {
      const tl = degrau(l.m.userData.limiar);
      l.m.emissive.lerpColors(l.cor0, l.cor1, tl);
      l.m.emissiveIntensity = L(l.i0, l.i1, tl);
    }
    const tp = degrau(pocas?.userData.limiar), tq = degrau(luzLaje?.userData.limiar), tr = degrau(NOITE.fotocelula.refletores);
    if (pocas) { pocas.visible = tp > 0.01; pocas.material.opacity = NOITE.poca.forca * tp; }
    if (luzLaje) { luzLaje.visible = tq > 0.01; luzLaje.material.opacity = NOITE.luzLaje.forca * tq; }
    for (const l of refletores) { l.visible = tr > 0.01; l.intensity = l.userData.forca * tr; }
    for (const b of balizas) b.visible = t > 0.01;
    renderer().shadowMap.needsUpdate = true;
  }
  const renderer = () => cena.renderer;

  cena.antesDeRenderizar.push((dt) => {
    // a lampada: procura a sala 5 vezes por segundo, so dentro de predio
    if (dentro && k > 0 && (desdeSala += dt) > 0.2) { desdeSala = 0; acharSala(); }
    const kk = k * k * (3 - 2 * k);
    lampada.intensity = dentro ? (lampada.userData.forca ?? 0) * kk : 0;
    if (k !== alvo) {
      k = alvo > k ? Math.min(alvo, k + dt / NOITE.transicao) : Math.max(alvo, k - dt / NOITE.transicao);
      aplicar();
    }
    // balizamento: aceso um terco do periodo
    if (balizas.length && k > 0) {
      relogio = (relogio + dt) % NOITE.balizamento.periodo;
      balizas[0].material.opacity = (relogio < NOITE.balizamento.periodo / 3 ? 1 : 0.08) * Math.min(1, k * 2);
    }
  });

  /** Monta a noite e compila os shaders dela sem desenhar: a cena de
   *  verdade e compilada com as luzes de uma cena so de luzes (o terceiro
   *  argumento do compileAsync), a neblina e o reflexo da noite. */
  let preparo = null;
  function preparar() {
    if (preparo) return preparo;
    if (!montado) montar();
    const so = new THREE.Scene();
    so.fog = scene.fog;
    so.environment = ambienteNoite;
    for (const l of [sol, hemi, preenchimento, lampada, ...refletores]) { const c = l.clone(); c.visible = true; so.add(c); }
    preparo = cena.renderer.compileAsync(scene, cena.camera, so).catch(() => {});
    return preparo;
  }

  function ligar(v = alvo === 0) {
    if (v && !montado) montar();
    alvo = v ? 1 : 0;
    aoMudar?.(v);
  }
  return {
    ligar, preparar, alternar: () => ligar(alvo === 0),
    /** Camera dentro de predio: a noite, as lampadas de dentro acesas. */
    dentro(v) { if (v !== dentro) { dentro = v; desdeSala = 1; } },
    get ativa() { return alvo === 1; },
    get k() { return k; },
    depurar: { refletores, balizas, get lampadas() { return lampadas; }, get pocas() { return pocas; }, get luzLaje() { return luzLaje; } },
  };
}
