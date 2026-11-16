import * as THREE from 'three';
import { criarPessoa, PASSADA } from '../lib/human.js';
import * as MV from '../lib/moveis.js';
import { Y } from '../lib/terreno.js';
import { PORTARIA_TRAFEGO } from '../data/ambiente.js';
import { DESCARGA, CARREGAMENTO, ONIBUS_PORTAS } from '../data/operacoes.js';

/**
 * ===========================================================================
 *  OPERACOES ANIMADAS  (Fase 21)
 * ===========================================================================
 *  Tres cenas, cada uma presa a espera de um veiculo do trafego
 *  (site/ambiente.js): em que segundo da espera ele esta decide o que
 *  acontece.
 *    - Descarga de tolueno: o operador calca a roda (agachado), puxa o cabo
 *      do carretel e prende a garra, leva o mangote nas duas maos ate a
 *      caixa de valvulas, engata, gira o volante, acompanha a descarga com
 *      a prancheta e desfaz. Cabo e mangote saem da mao dele de verdade.
 *    - Carregamento do bau: a porta de enrolar abre e fecha com ele; o
 *      conferente abre as portas traseiras, confere a carga de prancheta ao
 *      lado e as fecha; a empilhadeira, com o operador sentado, leva palete
 *      da expedicao a traseira dele.
 *    - Onibus: as portas abrem no ponto; quem passa nelas sobe ou desce o
 *      degrau.
 *  Os pontos de trabalho vem da geometria (pontos do caminhao em
 *  lib/ambiente.js, bocal do braco de carga, traseira do bau); os tempos, de
 *  data/operacoes.js. `achados` e a auditoria (__auditarOperacoes).
 */

const MANGOTE = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.8, name: 'mangote' });
const CABO = new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 0.6, name: 'cabo-aterramento' });
const CALCO = new THREE.MeshStandardMaterial({ color: 0xf2c12e, roughness: 0.7, name: 'calco' });
const AMARELO = new THREE.MeshStandardMaterial({ color: 0xf2c12e, roughness: 0.6, name: 'carretel' });

export function criarOperacoes({ ambiente, entorno, interiores, cena }) {
  const grupo = new THREE.Group();
  grupo.name = 'operacoes';
  const achados = [];
  const achar = (regra, peca, detalhe) => achados.push({ regra, peca, detalhe });
  const f1 = (v) => v.toFixed(1).replace('.', ',');
  const atores = ambiente.atores;
  const faseAgora = ambiente.depurar.faseAgora;
  /** Segundo da espera `k` (indice da fase) em que o ator esta, ou null. */
  function naEspera(a, k) {
    let t = a.t;
    for (let i = 0; i < k; i++) t -= a.fases[i].T;
    return t >= 0 && t < a.fases[k].T ? t : null;
  }
  /** Fracao do caminho no instante k de uma perna de T s: arranca e para em
   *  `rampa` s, no meio anda em velocidade constante (nao desliza de uma
   *  vez nem estaca). */
  function suave(k, T, rampa = 0.35) {
    const a = Math.min(rampa, T / 2) / T, u = THREE.MathUtils.clamp(k / T, 0, 1);
    if (u < a) return (u * u) / (2 * a * (1 - a));
    if (u > 1 - a) return 1 - ((1 - u) ** 2) / (2 * a * (1 - a));
    return (u - a / 2) / (1 - a);
  }
  /** Quanto da pose de uma tarefa (entra e sai em 0,4 s). */
  const dose = (te, e) => THREE.MathUtils.clamp(Math.min(te - e.t0, e.t0 + e.T - te) / 0.4, 0, 1);
  /** Vira o grupo para `rumo` pelo lado mais curto, a no maximo GIRO rad/s
   *  (dt grande ou nulo — acerto do passeio — vira de uma vez). */
  const GIRO = 4.5;
  function virar(g, rumo, dt) {
    const d = ((rumo - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += dt > 0 && dt < 1 ? THREE.MathUtils.clamp(d, -GIRO * dt, GIRO * dt) : d;
  }
  /** Anda o ator de pessoa `o` ({ pessoa, passo, ritmo, antes }) ate onde o
   *  grupo dele ja foi posto: a passada sai do que ele andou de fato. */
  function passada(o, dt, vel) {
    const p = o.pessoa.grupo.position;
    const andou = o.antes ? Math.hypot(p.x - o.antes.x, p.z - o.antes.z) : 0;
    (o.antes ??= new THREE.Vector3()).copy(p);
    const v = dt > 0 && dt < 1 ? andou / dt : 0;
    if (dt > 0 && dt < 1) o.passo += (Math.PI * andou) / PASSADA;
    o.ritmo += (Math.min(1, v / vel) - o.ritmo) * Math.min(1, dt / 0.25 || 1);
    o.pessoa.animar(o.passo, o.ritmo);
  }

  /* ================================================================ descarga */
  const tanque = atores.find((a) => a.g.name === 'caminhao-tanque');
  const braco = entorno.objetos.find((o) => o.nome === 'braco-1')?.grupo;
  let descarga = null;
  if (tanque && braco) {
    braco.updateMatrixWorld(true);
    const S = braco.userData.bocais.S;
    const inicioMangote = braco.localToWorld(new THREE.Vector3(...S.pos));
    const pe = new THREE.Vector3().setFromMatrixPosition(braco.matrixWorld);
    const yChao = pe.y;
    const aguarda = new THREE.Vector3(pe.x + DESCARGA.aguarda[0], yChao, pe.z + DESCARGA.aguarda[1]);
    const carretel = new THREE.Vector3(pe.x + DESCARGA.carretel[0], yChao, pe.z + DESCARGA.carretel[1]);
    // carretel do cabo de aterramento num poste
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), AMARELO);
    poste.position.set(carretel.x, yChao + 0.6, carretel.z);
    const rolo = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), AMARELO);
    rolo.rotation.z = Math.PI / 2;
    rolo.position.set(carretel.x, yChao + 1.0, carretel.z + 0.1);
    grupo.add(poste, rolo);
    const pontoCarretel = new THREE.Vector3(carretel.x, yChao + 1.0, carretel.z + 0.2);
    // lampada do aterramento no alto do poste do carretel (Fase 27, item 10)
    const lampada = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12),
      new THREE.MeshStandardMaterial({ color: 0x1d3d22, emissive: 0x2bff4a, emissiveIntensity: 0, roughness: 0.4, name: 'lampada-aterramento' }));
    lampada.position.set(carretel.x, yChao + 1.235, carretel.z);
    lampada.userData.animar = true;
    grupo.add(lampada);
    // regua de nivel no costado do tanque de destino, voltada para a baia:
    // o ponteiro sobe na descarga (Fase 27, item 10)
    const tq = entorno.objetos.find((o) => o.nome === DESCARGA.tanque)?.grupo;
    let regua = null;
    if (tq) {
      const b = new THREE.Box3().setFromObject(tq), c = b.getCenter(new THREE.Vector3());
      const R = (b.max.x - b.min.x) / 2, H = b.max.y - b.min.y;
      const u = new THREE.Vector3(carretel.x - c.x, 0, carretel.z - c.z).normalize();
      const base = new THREE.Vector3(c.x, b.min.y, c.z).addScaledVector(u, R + 0.08);
      const rumo = Math.atan2(u.x, u.z);
      const tabua = new THREE.Mesh(new THREE.BoxGeometry(0.14, H * 0.9, 0.03), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 }));
      tabua.position.copy(base).add(new THREE.Vector3(0, H * 0.48, 0));
      tabua.rotation.y = rumo;
      const ponteiro = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }));
      ponteiro.rotation.y = rumo;
      ponteiro.userData.animar = true;
      grupo.add(tabua, ponteiro);
      const area = Math.PI * R * R, delta = DESCARGA.volume / area;
      regua = { ponteiro, base, H, delta, nivel: DESCARGA.nivel0 * H };
    }
    // mangote em repouso: no chao, ao pe do braco
    const repouso = new THREE.Vector3(inicioMangote.x + 0.6, yChao + 0.08, inicioMangote.z + 0.8);
    const operador = criarPessoa({ roupa: 0xf2a03d, calca: 0xd88a2c, capacete: 0xf4f4f0, colete: 0xd8f03a });
    operador.grupo.name = 'pessoa-operador-descarga';
    operador.grupo.userData.animar = true;
    operador.grupo.userData.ficha = { titulo: 'Operador da descarga', subtitulo: 'Calça a roda, aterra, conecta o mangote e abre a válvula', grupos: [] };
    grupo.add(operador.grupo);
    const calco = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.35), CALCO);
    calco.visible = false;
    grupo.add(calco);
    const mangote = new THREE.Mesh(new THREE.BufferGeometry(), MANGOTE);
    const cabo = new THREE.Mesh(new THREE.BufferGeometry(), CABO);
    cabo.visible = false;
    grupo.add(mangote, cabo);
    const valvula = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.04), MANGOTE);
    valvula.visible = false;
    grupo.add(valvula);
    const tubo = (malha, pts, raio) => {
      malha.geometry.dispose();
      malha.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, raio, 8, false);
    };
    const pendurado = (a, b, flecha) => {
      const m = a.clone().lerp(b, 0.5);
      m.y = Math.max(yChao + 0.06, Math.min(a.y, b.y) - flecha);
      return [a, m, b];
    };
    tubo(mangote, pendurado(inicioMangote, repouso, 0.2), DESCARGA.mangoteDN / 2);
    descarga = { inicioMangote, aguarda, carretel, pontoCarretel, repouso, operador, pessoa: operador, calco, mangote, cabo, valvula, tubo, pendurado, plano: null, yChao, passo: 0, ritmo: 0, relogio: 0, lampada, regua };
  }

  /** Plano da descarga a partir da pose do caminhao parado: os pontos no mundo e a linha do tempo. */
  function planoDescarga() {
    const d = descarga, g = tanque.g, P = g.userData.pontos;
    g.updateMatrixWorld(true);
    const mundo = (p) => g.localToWorld(new THREE.Vector3(...p));
    const lado = new THREE.Vector3(P.lado, 0, 0).transformDirection(g.matrixWorld);
    const noChao = (v, m = 0) => new THREE.Vector3(v.x + lado.x * m, d.yChao, v.z + lado.z * m);
    const valv = mundo(P.valvula), terra = mundo(P.aterramento), roda = mundo(P.roda);
    const tras = new THREE.Vector3(0, 0, -1).transformDirection(g.matrixWorld);
    const pts = {
      calco: roda.clone().addScaledVector(tras, 0.65).setY(d.yChao + 0.1),
      peCalco: noChao(roda.clone().addScaledVector(tras, 0.65), 0.7),
      peTerra: noChao(terra, 0.8),
      peValvula: noChao(valv.clone().addScaledVector(tras, 0.6), 0.7),
      peMangote: noChao(d.repouso, 0.5),
      peCarretel: new THREE.Vector3(d.carretel.x + 0.6, d.yChao, d.carretel.z),
      valv, terra,
    };
    // linha do tempo: andar (pela distancia) e tarefas (pelo tempo)
    const L = [];
    let t = DESCARGA.espera, aqui = d.aguarda.clone();
    const ir = (p) => { const T = aqui.distanceTo(p) / DESCARGA.andar; L.push({ tipo: 'ir', de: aqui.clone(), ate: p.clone(), t0: t, T }); t += T; aqui = p.clone(); };
    const fazer = (nome, T) => { L.push({ tipo: nome, t0: t, T, em: aqui.clone() }); t += T; };
    ir(pts.peCalco); fazer('calcar', DESCARGA.calcar);
    ir(pts.peCarretel); fazer('pegarCabo', 1);
    ir(pts.peTerra); fazer('aterrar', DESCARGA.aterrar);
    ir(pts.peMangote); fazer('pegarMangote', 1);
    ir(pts.peValvula); fazer('conectar', DESCARGA.conectar); fazer('abrir', DESCARGA.abrirValvula);
    const meio = t;
    // o resto, de tras para frente, termina antes da espera do caminhao acabar
    const volta = [];
    const tFim = tanque.fases[0].T - DESCARGA.espera;
    let tv = tFim;
    let la = d.aguarda.clone();
    const irV = (p) => { const T = la.distanceTo(p) / DESCARGA.andar; tv -= T; volta.unshift({ tipo: 'ir', de: p.clone(), ate: la.clone(), t0: tv, T }); la = p.clone(); };
    const fazerV = (nome, T) => { tv -= T; volta.unshift({ tipo: nome, t0: tv, T, em: la.clone() }); };
    irV(pts.peCalco); fazerV('descalcar', DESCARGA.calcar);
    irV(pts.peCarretel); fazerV('guardarCabo', 1);
    irV(pts.peTerra); fazerV('desaterrar', DESCARGA.aterrar);
    irV(pts.peMangote); fazerV('largarMangote', 1);
    irV(pts.peValvula); fazerV('desconectar', DESCARGA.conectar); fazerV('fechar', DESCARGA.abrirValvula);
    if (tv < meio) achar('DESCARGA_SEM_TEMPO', 'caminhão-tanque', `a operação pede ${f1(meio + tFim - tv)} s e a espera tem ${f1(tanque.fases[0].T)} s`);
    L.push({ tipo: 'descarregar', t0: meio, T: Math.max(0, tv - meio), em: aqui.clone() });
    L.push(...volta);
    return { pts, L, ida: meio, vol: tv };
  }

  // nivel do tanque de destino: sobe `delta` durante a descarga e desce o
  // mesmo ao longo do ciclo do caminhao (o consumo); entre os dois limites
  function nivelar(d, dt, descarregando, Tdesc) {
    const r = d.regua;
    if (!r) return;
    const n0 = DESCARGA.nivel0 * r.H;
    r.nivel += descarregando ? (r.delta / Math.max(1, Tdesc)) * dt : -(r.delta / tanque.ciclo) * dt;
    r.nivel = THREE.MathUtils.clamp(r.nivel, n0, n0 + r.delta);
    r.ponteiro.position.copy(r.base).add(new THREE.Vector3(0, r.nivel, 0));
  }
  function atualizarDescarga(dt) {
    const d = descarga;
    const te = naEspera(tanque, 0);
    if (te === null) {
      d.lampada.material.emissiveIntensity = 0;
      d.lampada.material.color.set(0x1d3d22);
      nivelar(d, dt, false, 1);
      // sem caminhao na baia: o operador aguarda, o mangote no chao
      if (d.plano) {
        d.plano = null;
        d.calco.visible = d.cabo.visible = d.valvula.visible = false;
        d.tubo(d.mangote, d.pendurado(d.inicioMangote, d.repouso, 0.2), DESCARGA.mangoteDN / 2);
      }
      d.relogio += dt;
      d.operador.grupo.position.copy(d.aguarda);
      virar(d.operador.grupo, Math.PI / 2, dt);
      passada(d, dt, DESCARGA.andar);
      d.operador.aguardar(d.relogio);
      return;
    }
    d.plano ??= planoDescarga();
    const { pts, L } = d.plano;
    let etapa = L.find((e) => te >= e.t0 && te < e.t0 + e.T) ?? null;
    const feito = (nome) => L.some((e) => e.tipo === nome && te >= e.t0 + e.T);
    const fazendo = (nome) => etapa?.tipo === nome;
    /** Na segunda metade da tarefa (a peca troca de lugar no meio dela). */
    const jaFez = (nome) => feito(nome) || (fazendo(nome) && te - etapa.t0 > etapa.T / 2);
    // estado do que ele leva: decide a pose dos bracos ao andar
    const caboNoChassi = jaFez('aterrar') && !jaFez('desaterrar');
    const caboNaMao = (jaFez('pegarCabo') && !jaFez('aterrar')) || (jaFez('desaterrar') && !jaFez('guardarCabo'));
    const ligado = jaFez('conectar') && !jaFez('desconectar');
    const naMao = (jaFez('pegarMangote') && !jaFez('conectar')) || (jaFez('desconectar') && !jaFez('largarMangote'));
    // operador: onde esta e para onde olha
    const op = d.operador.grupo;
    const olhar = (alvo) => virar(op, Math.atan2(alvo.x - op.position.x, alvo.z - op.position.z), dt);
    if (etapa?.tipo === 'ir') {
      op.position.lerpVectors(etapa.de, etapa.ate, suave(te - etapa.t0, etapa.T));
      olhar(etapa.ate);
    } else if (etapa) {
      op.position.copy(etapa.em);
      const alvo = { calcar: pts.calco, descalcar: pts.calco, aterrar: pts.terra, desaterrar: pts.terra,
        pegarCabo: d.pontoCarretel, guardarCabo: d.pontoCarretel, pegarMangote: d.repouso, largarMangote: d.repouso,
        conectar: pts.valv, desconectar: pts.valv, abrir: pts.valv, fechar: pts.valv, descarregar: pts.valv }[etapa.tipo];
      if (alvo) olhar(alvo);
    } else {
      op.position.copy(d.aguarda);
    }
    passada(d, dt, DESCARGA.andar);
    // a pose da tarefa, por cima da de andar
    const P = d.operador;
    if (etapa?.tipo === 'ir') P.carregar(naMao || caboNaMao ? 1 : 0, naMao);
    else if (etapa) {
      const k = dose(te, etapa), hV = pts.valv.y - d.yChao;
      switch (etapa.tipo) {
        case 'calcar': case 'descalcar': case 'pegarMangote': case 'largarMangote': P.agachar(k, te); break;
        case 'pegarCabo': case 'guardarCabo': P.manusear(k, te, 1.0, true); break;
        case 'aterrar': case 'desaterrar': P.manusear(k, te, pts.terra.y - d.yChao, true); break;
        case 'conectar': case 'desconectar': P.manusear(k, te, hV); break;
        case 'abrir': case 'fechar': P.girarVolante(te, hV + 0.12); break;
        // a descarga leva tempo: ele acompanha com a prancheta, de olho no engate
        case 'descarregar': P.inspecionar(te, -0.25); break;
        default: P.trabalhar(te);
      }
    } else P.aguardar(te);
    // estado: calco, cabo, mangote e valvula
    d.calco.visible = jaFez('calcar') && !jaFez('descalcar');
    d.calco.position.copy(pts.calco);
    // verde enquanto o cabo esta preso ao chassi
    d.lampada.material.emissiveIntensity = caboNoChassi ? 2.5 : 0;
    d.lampada.material.color.set(caboNoChassi ? 0x2bff4a : 0x1d3d22);
    const desc = d.plano.L.find((e2) => e2.tipo === 'descarregar');
    nivelar(d, dt, fazendo('descarregar'), desc?.T ?? 1);
    const mao = P.mao(-1);                                 // a direita, ja na pose
    d.cabo.visible = caboNoChassi || caboNaMao;
    if (d.cabo.visible) d.tubo(d.cabo, d.pendurado(d.pontoCarretel, caboNoChassi ? pts.terra : mao, 0.4), 0.008);
    const ponta = ligado ? pts.valv : naMao ? mao : d.repouso;
    d.mangoteLigado = ligado;
    d.pontaMangote = ponta;
    d.tubo(d.mangote, d.pendurado(d.inicioMangote, ponta, 0.6), DESCARGA.mangoteDN / 2);
    // volante da valvula: gira ao abrir e ao fechar
    d.valvula.visible = true;
    d.valvula.position.copy(pts.valv).add(new THREE.Vector3(0, 0.12, 0));
    const giro = fazendo('abrir') ? (te - etapa.t0) / etapa.T : fazendo('fechar') ? 1 - (te - etapa.t0) / etapa.T : (feito('abrir') && !feito('fechar') ? 1 : 0);
    d.valvula.rotation.y = giro * Math.PI / 2;
  }

  /* ================================================================ armazem */
  const bau = atores.find((a) => a.g.name === 'caminhao-bau');
  const armazem = entorno.objetos.find((o) => o.nome === 'predio-ARMAZEM')?.grupo;
  const cortinas = armazem?.userData.portasEnrolar ?? [];
  const regArm = interiores.interiores.find((it) => it.registro.bloco === 'ARMAZEM')?.registro;
  const emp = regArm?.moveis.find((m) => m.nome === 'Empilhadeira');
  let carga = null;
  if (bau && emp) {
    const g = emp.obj;
    const casa = { x: g.position.x, z: g.position.z, rumo: g.rotation.y };
    const paletes = regArm.moveis.filter((m) => m.nome === 'Palete de sacaria');
    const palete = MV.criarPaleteSacaria({ camadas: 6 });
    palete.grupo.visible = false;
    palete.grupo.position.set(0, 0.15, 1.15);              // sobre os garfos (frente em +z)
    g.add(palete.grupo);
    // operador sentado no banco (o estofado de criarEmpilhadeira: tampo a
    // 1,04 m, a 0,6 m atras do centro); a pose de sentado poe o quadril a
    // 0,46 m da origem da figura. Maos a frente, no volante.
    const motorista = criarPessoa({ roupa: 0x2f6fb0, calca: 0x2f3a4a, capacete: 0xf4f4f0, colete: 0xd8f03a });
    motorista.grupo.name = 'pessoa-operador-empilhadeira';
    motorista.grupo.position.set(0, 1.04 - 0.46, -0.6);
    motorista.sentar(1, 'digitar', 0);
    g.add(motorista.grupo);
    // conferente da expedicao: abre e fecha as portas do bau e confere a carga
    const conferente = criarPessoa({ roupa: 0x3c6e9e, calca: 0x2f3a4a, capacete: 0xf4f4f0, colete: 0xf28c28 });
    conferente.grupo.name = 'pessoa-conferente';
    conferente.grupo.userData.animar = true;
    conferente.grupo.visible = false;
    grupo.add(conferente.grupo);
    carga = { g, casa, paletes, palete, plano: null, y: g.position.y, motorista,
      conf: { pessoa: conferente, passo: 0, ritmo: 0, antes: null } };
  }
  const portao = cortinas.length ? new THREE.Vector3().setFromMatrixPosition(cortinas[0].malha.matrixWorld) : null;

  function planoCarga() {
    const c = carga, b = bau.g;
    b.updateMatrixWorld(true);
    const tras = b.localToWorld(new THREE.Vector3(...b.userData.pontos.traseira));
    const frente = new THREE.Vector3(0, 0, 1).transformDirection(b.matrixWorld);   // para onde o bau olha
    // a empilhadeira encosta de frente na traseira: garfos (1,05 m a frente
    // do centro dela) ate 0,3 m dentro do bau
    const enc = { x: tras.x - frente.x * 1.35, z: tras.z - frente.z * 1.35, rumo: Math.atan2(frente.x, frente.z) };
    const recua = { x: enc.x - frente.x * 2.5, z: enc.z - frente.z * 2.5, rumo: enc.rumo };
    const P = c.paletes.length ? c.paletes.reduce((m, q) => {
      const cq = [(q.ret.x0 + q.ret.x1) / 2, (q.ret.z0 + q.ret.z1) / 2];
      const d = Math.hypot(cq[0] - recua.x, cq[1] - recua.z);
      return !m || d < m.d ? { c: cq, d } : m;
    }, null).c : [c.casa.x, c.casa.z];
    // pega o palete chegando por tras dele (do lado do recuo)
    const u = [P[0] - recua.x, P[1] - recua.z], Lu = Math.hypot(u[0], u[1]) || 1;
    const pega = { x: P[0] - (u[0] / Lu) * 1.65, z: P[1] - (u[1] / Lu) * 1.65, rumo: Math.atan2(u[0], u[1]) };
    // viagem: casa -> pega -> recuo -> encosta -> recuo (de re) -> ... -> casa
    const pernas = [];
    let aqui = c.casa;
    const ir = (p, carregado, re = false) => { pernas.push({ de: aqui, ate: p, carregado, re }); aqui = p; };
    for (let v = 0; v < CARREGAMENTO.viagens; v++) {
      ir(pega, false); ir(recua, true); ir(enc, true); ir(recua, false, true);
    }
    ir(c.casa, false);
    let t = 3;
    for (const p of pernas) { p.T = Math.hypot(p.ate.x - p.de.x, p.ate.z - p.de.z) / CARREGAMENTO.empilhadeira + 1.5; p.t0 = t; t += p.T; }
    if (t > bau.fases[0].T) achar('CARGA_SEM_TEMPO', 'caminhão-baú', `a empilhadeira pede ${f1(t)} s e a espera tem ${f1(bau.fases[0].T)} s`);
    // Conferente: do posto, ao lado da traseira e do lado oposto ao dos
    // paletes (fora do caminho da empilhadeira e do giro das portas), vai ao
    // meio da traseira, abre as portas, volta e confere; no fim, com a
    // empilhadeira ja recuada pela ultima vez, fecha.
    const T = bau.fases[0].T;
    const lat = new THREE.Vector3(frente.z, 0, -frente.x);
    const ladoPaletes = Math.sign((P[0] - tras.x) * lat.x + (P[1] - tras.z) * lat.z) || 1;
    const atras = (m, l = 0) => new THREE.Vector3(tras.x - frente.x * m + lat.x * l, c.y, tras.z - frente.z * m + lat.z * l);
    const posto = atras(CARREGAMENTO.posto[0], -ladoPaletes * CARREGAMENTO.posto[1]);
    const porta = atras(CARREGAMENTO.diantePortas);
    const anda = posto.distanceTo(porta) / CARREGAMENTO.andar;
    const abre = 0.5 + anda;                               // chega e comeca a abrir
    const ultimaRe = pernas.filter((q) => q.re).at(-1);
    const fecha = T - CARREGAMENTO.abrePortasBau - 0.5;    // comeca a fechar
    const sai = Math.max(ultimaRe.t0 + ultimaRe.T, fecha - anda - 0.5);
    if (sai + anda > fecha + 0.05) achar('CONFERENTE_SEM_TEMPO', 'caminhão-baú', `a empilhadeira so recua aos ${f1(ultimaRe.t0 + ultimaRe.T)} s e as portas fecham aos ${f1(fecha)} s`);
    const conf = [
      { tipo: 'ir', de: posto, ate: porta, t0: 0.5, T: anda },
      { tipo: 'abrir', em: porta, t0: abre, T: CARREGAMENTO.abrePortasBau },
      { tipo: 'ir', de: porta, ate: posto, t0: abre + CARREGAMENTO.abrePortasBau, T: anda },
      { tipo: 'conferir', em: posto, t0: abre + CARREGAMENTO.abrePortasBau + anda, T: Math.max(0, sai - (abre + CARREGAMENTO.abrePortasBau + anda)) },
      { tipo: 'ir', de: posto, ate: porta, t0: sai, T: anda },
      { tipo: 'fechar', em: porta, t0: fecha, T: CARREGAMENTO.abrePortasBau },
    ];
    return { pernas, enc, pega, recua, conf, posto, tras, abre, fecha };
  }

  /** O conferente, no segundo `te` da espera do bau (null: sem caminhao). */
  function atualizarConferente(te, dt) {
    const o = carga.conf, g = o.pessoa.grupo, pl = carga.plano;
    g.visible = te !== null && !!pl;
    if (!g.visible) { o.antes = null; return; }
    const e = pl.conf.find((q) => te >= q.t0 && te < q.t0 + q.T) ?? null;
    const olhar = (alvo) => virar(g, Math.atan2(alvo.x - g.position.x, alvo.z - g.position.z), dt);
    if (e?.tipo === 'ir') { g.position.lerpVectors(e.de, e.ate, suave(te - e.t0, e.T)); olhar(e.ate); }
    else { g.position.copy(e?.em ?? (te < pl.abre ? pl.posto : pl.conf.at(-1).em)); olhar(pl.tras); }
    passada(o, dt, CARREGAMENTO.andar);
    // abrindo e fechando: as duas maos nas trancas, a 1,3 m do piso
    if (e?.tipo === 'abrir' || e?.tipo === 'fechar') o.pessoa.manusear(dose(te, e), te, 1.3);
    else if (e?.tipo === 'conferir') o.pessoa.inspecionar(te, 0.1);
    else if (!e) o.pessoa.aguardar(te);
  }

  /** Portas traseiras do bau: abrem depois de ele parar e fecham antes de sair. */
  function portasDoBau(te, dt) {
    // (abrem quando o conferente chega a elas: planoCarga)
    const abertas = te !== null && !!carga?.plano && te > carga.plano.abre && te < carga.plano.fecha;
    const ang = THREE.MathUtils.degToRad(CARREGAMENTO.portasBau);
    for (const { pivo, s } of bau.g.userData.portasTraseiras ?? []) {
      const alvo = abertas ? -s * ang : 0;
      const a = pivo.rotation.y;
      pivo.rotation.y = a + Math.sign(alvo - a) * Math.min(Math.abs(alvo - a), (ang / CARREGAMENTO.abrePortasBau) * dt);
    }
  }

  function atualizarCarga(dt = 0) {
    const c = carga;
    const te = naEspera(bau, 0);
    if (te !== null) c.plano ??= planoCarga();
    portasDoBau(te, dt);
    atualizarConferente(te, dt);
    if (te === null) {
      c.plano = null;
      c.g.position.set(c.casa.x, c.y, c.casa.z);
      c.g.rotation.y = c.casa.rumo;
      c.palete.grupo.visible = false;
      return;
    }
    c.plano ??= planoCarga();
    const p = c.plano.pernas.find((q) => te >= q.t0 && te < q.t0 + q.T);
    if (!p) { c.g.position.set(c.casa.x, c.y, c.casa.z); c.g.rotation.y = c.casa.rumo; c.palete.grupo.visible = false; return; }
    // gira no lugar no primeiro 1,5 s da perna (empilhadeira esterca nas rodas de tras), depois anda
    const rumoAnda = Math.atan2(p.ate.x - p.de.x, p.ate.z - p.de.z) + (p.re ? Math.PI : 0);
    const k = te - p.t0;
    const girando = k < 1.5;
    const u = girando ? 0 : Math.min(1, (k - 1.5) / (p.T - 1.5));
    c.g.position.set(p.de.x + (p.ate.x - p.de.x) * u, c.y, p.de.z + (p.ate.z - p.de.z) * u);
    const r0 = p.de.rumo ?? c.g.rotation.y, r1 = Math.hypot(p.ate.x - p.de.x, p.ate.z - p.de.z) > 0.2 ? rumoAnda : (p.ate.rumo ?? r0);
    let dr = ((r1 - r0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.g.rotation.y = r0 + dr * (girando ? k / 1.5 : 1);
    c.palete.grupo.visible = p.carregado;
    c.palete.grupo.position.y = p.carregado ? 0.15 + Math.min(0.5, k * CARREGAMENTO.garfos) : 0.15;
  }

  function atualizarPortao(dt) {
    if (!portao || !cortinas.length) return;
    const dist = bau.g.visible ? bau.g.position.distanceTo(portao) : Infinity;
    const abrir = dist < CARREGAMENTO.abreA;
    for (const cz of cortinas) {
      const alvo = abrir ? cz.aberta : cz.fechada;
      const s = cz.malha.scale.y;
      cz.malha.scale.y = s + Math.sign(alvo - s) * Math.min(Math.abs(alvo - s), CARREGAMENTO.porta * dt);
    }
  }

  /* ================================================================ onibus */
  const onibus = atores.find((a) => a.g.name === 'onibus');
  const passageiros = atores.filter((a) => a.g.name === 'passageiro');
  const portaPonto = PORTARIA_TRAFEGO.onibus.porta;
  function atualizarOnibus(dt) {
    const te = naEspera(onibus, 4);                    // a espera no ponto (fasesBus[4])
    const T = onibus.fases[4].T;
    const aberta = te !== null && te > 0.5 && te < T - 1.5;
    const alvo = aberta ? THREE.MathUtils.degToRad(ONIBUS_PORTAS.angulo) : 0;
    for (const pv of onibus.g.userData.portas ?? []) {
      const a = pv.rotation.y;
      pv.rotation.y = a + Math.sign(alvo - a) * Math.min(Math.abs(alvo - a), (Math.PI / 2 / ONIBUS_PORTAS.abre) * dt);
    }
    // o degrau: quem passa pela porta com o onibus parado sobe ou desce
    if (te === null) return;
    for (const p of passageiros) {
      if (!p.g.visible) continue;
      const d = Math.hypot(p.g.position.x - portaPonto[0], p.g.position.z - portaPonto[1]);
      if (d < ONIBUS_PORTAS.alcance) p.g.position.y = Y.calcada + ONIBUS_PORTAS.degrau * (1 - d / ONIBUS_PORTAS.alcance);
    }
  }

  function atualizar(dt) {
    if (descarga) atualizarDescarga(dt);
    if (carga) { atualizarCarga(dt); atualizarPortao(dt); }
    if (onibus) atualizarOnibus(dt);
  }

  /* ================================================================ auditoria */
  // Simula um ciclo inteiro de cada veiculo, no tempo dele, e mede:
  //   MANGOTE_SOLTO      mangote "ligado" com a ponta a mais de 5 cm da valvula
  //   PESSOA_NO_CAMINHO  o operador dentro da caixa do caminhao com ele andando
  //   EMPILHADEIRA_NO_MOVEL  empilhadeira passando por porta-palete ou palete
  //   PORTA_ABERTA_ANDANDO   porta do onibus aberta com ele andando
  //   PESSOA_NO_CAMINHO      (tambem) o conferente na caixa da empilhadeira
  {
    const salvo = atores.map((a) => ({ t: a.t, s: a.s, fase: a.fase }));
    const conta = {};
    const marcar = (regra, peca, det) => { conta[regra] = (conta[regra] ?? 0) + 1; if (conta[regra] <= 3) achar(regra, peca, det); };
    const caixaDe = (g, L, W) => {
      const r = g.rotation.y;
      return { c: [g.position.x, g.position.z], f: [Math.sin(r), Math.cos(r)], l: [Math.cos(r), -Math.sin(r)], hl: L / 2, hw: W / 2 };
    };
    const dentroCaixa = (C, [x, z]) => {
      const dx = x - C.c[0], dz = z - C.c[1];
      return Math.abs(dx * C.f[0] + dz * C.f[1]) < C.hl && Math.abs(dx * C.l[0] + dz * C.l[1]) < C.hw;
    };
    const porta = regArm?.moveis.filter((m) => /Porta-palete/.test(m.nome)).map((m) => m.ret) ?? [];
    const ciclo = Math.max(tanque?.ciclo ?? 0, bau?.ciclo ?? 0, onibus?.ciclo ?? 0);
    let antesBus = onibus?.g.position.clone();
    for (let k = 0; k < ciclo / 0.2; k++) {
      ambiente.atualizar(0.2);
      atualizar(0.2);
      const t = `t = ${f1(k * 0.2)} s`;
      if (descarga && descarga.mangoteLigado && descarga.pontaMangote.distanceTo(descarga.plano.pts.valv) > 0.05) marcar('MANGOTE_SOLTO', 'descarga', t);
      if (descarga && tanque.g.visible && faseAgora(tanque)?.tipo === 'anda') {
        const C = caixaDe(tanque.g, tanque.dim[0] + 1, tanque.dim[1] + 1);
        const o = descarga.operador.grupo.position;
        if (dentroCaixa(C, [o.x, o.z])) marcar('PESSOA_NO_CAMINHO', 'operador da descarga', `${t}, em (${f1(o.x)}; ${f1(o.z)})`);
      }
      if (carga && naEspera(bau, 0) !== null) {
        const C = caixaDe(carga.g, 3.0, 1.15);
        const toca = porta.some((r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1], [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]].some((p) => dentroCaixa(C, p)));
        if (toca) marcar('EMPILHADEIRA_NO_MOVEL', 'empilhadeira', `${t}, em (${f1(carga.g.position.x)}; ${f1(carga.g.position.z)})`);
        const cf = carga.conf.pessoa.grupo.position;
        if (dentroCaixa(caixaDe(carga.g, 3.6, 1.7), [cf.x, cf.z])) marcar('PESSOA_NO_CAMINHO', 'conferente', `${t}, em (${f1(cf.x)}; ${f1(cf.z)})`);
      }
      if (bau && bau.g.visible && faseAgora(bau)?.tipo === 'anda' && (bau.g.userData.portasTraseiras ?? []).some(({ pivo }) => Math.abs(pivo.rotation.y) > 0.1)) {
        marcar('PORTA_ABERTA_ANDANDO', 'caminhão-baú', t);
      }
      if (onibus) {
        const andou = onibus.g.position.distanceTo(antesBus) > 0.01;
        antesBus.copy(onibus.g.position);
        if (andou && (onibus.g.userData.portas ?? []).some((pv) => Math.abs(pv.rotation.y) > 0.1)) marcar('PORTA_ABERTA_ANDANDO', 'ônibus', t);
      }
    }
    atores.forEach((a, i) => Object.assign(a, salvo[i], { passoT: undefined }));
    ambiente.atualizar(0);
    atualizar(0);
  }

  return { grupo, atualizar, achados };
}
