import * as THREE from 'three';
import { VISTAS } from '../data/vistas.js';
import { LIMITES } from '../data/rotas.js';
import { RACK } from '../data/arranjo.js';
import { BLOCOS } from '../data/site.js';

/**
 * ===========================================================================
 *  INSPECAO VISUAL  (pedido do autor, 27/10)
 * ===========================================================================
 *  As auditorias medem o que tem regra (peca no ar, tubo no costado, movel
 *  na porta). O que nao tem regra — coisa sem sentido, pouco detalhada,
 *  feia — so se acha olhando. Aqui fica a ronda: uma lista de POSTOS, cada
 *  um com a camera (derivada dos dados, como as vistas) e o que olhar nele.
 *  No console:
 *    __inspecao.lista()         os postos, numerados
 *    __inspecao.ir(i)           leva a camera ao posto i e devolve o que olhar
 *  O painel do navegador tem de estar visivel para o screenshot.
 *
 *  O que olhar, em todo posto (alem do que cada um pede):
 *    GEOMETRIA   peca no ar, enterrada, atravessando outra; fresta; tampo
 *                ou costado com forma errada; escala (a pessoa tem 1,75 m)
 *    DETALHE     superficie lisa demais, faltando o que existe de verdade
 *                (guarda-corpo, escada, suporte, placa, junta)
 *    SENTIDO     coisa que nao faz sentido para quem opera: acesso, porta,
 *                caminho, o que liga em que
 *    ESTETICA    cor, textura esticada, piscar, luz e sombra, neblina
 *    COMPORTAMENTO  o que anda anda direito (veiculo na via, pessoa na
 *                calcada, cancela, porta, agitador)
 * ===========================================================================
 */

const v3 = (a) => new THREE.Vector3(...a);

export function criarInspecao(M) {
  const { cena, todos, entorno, interiores, ambiente, planta } = M;
  const C = cena.controls;
  const bloco = (id) => BLOCOS.find((b) => b.id === id);
  const caixaDe = (obj) => new THREE.Box3().setFromObject(obj);
  const objeto = (nome) => entorno.objetos.find((o) => o.nome === nome)?.grupo;
  const vista = (id) => { const v = VISTAS.find((x) => x.id === id); return { pos: v.pos, alvo: v.alvo }; };

  /** Olha o objeto de `dir` (de onde a camera vem), a `dist` vezes o tamanho dele. */
  function perto(obj, { dir = [1, 0.5, 1], dist = 1.6, olho = null } = {}) {
    const c = caixaDe(obj), centro = c.getCenter(new THREE.Vector3()), t = c.getSize(new THREE.Vector3());
    const r = Math.max(t.x, t.y, t.z) / 2;
    const d = v3(dir).normalize().multiplyScalar(r * dist + 2);
    const pos = centro.clone().add(d);
    if (olho !== null) pos.y = olho;
    return { pos: pos.toArray(), alvo: centro.toArray() };
  }
  /** Na altura dos olhos (1,7 m), a `dist` m do centro do objeto, vindo de `dir`. */
  function aPe(obj, { dir = [1, 0, 1], dist = 8 } = {}) {
    const c = caixaDe(obj).getCenter(new THREE.Vector3());
    const d = v3(dir).setY(0).normalize().multiplyScalar(dist);
    return { pos: [c.x + d.x, 1.7, c.z + d.z], alvo: [c.x, 1.5, c.z] };
  }
  /** Num canto da sala, olhando o canto oposto. */
  function sala(blocoId, k, nome, canto = [0.08, 0.08]) {
    const it = interiores.interiores.find((i) => i.registro.bloco === blocoId);
    const s = it.registro.salas.find((q) => q.k === k && q.nome === nome);
    const r = s.ret, y = s.y + 1.65;
    const [fx, fz] = canto;
    return {
      pos: [r.x0 + fx * (r.x1 - r.x0), y + 0.4, r.z0 + fz * (r.z1 - r.z0)],
      alvo: [r.x0 + (1 - fx) * (r.x1 - r.x0), y - 0.5, r.z0 + (1 - fz) * (r.z1 - r.z0)],
    };
  }
  const centroBloco = (id) => { const b = bloco(id); return [(b.x[0] + b.x[1]) / 2, (b.z[0] + b.z[1]) / 2]; };

  const zR = RACK.z;                              // eixo do rack
  const POSTOS = [
    /* ------------------------------------------------------------ geral */
    { grupo: 'Geral', nome: 'Visão geral', ...vista('geral'),
      olhar: 'Composição: horizonte, céu, neblina, o que fica fora do lote; proporção entre blocos.' },
    { grupo: 'Geral', nome: 'Planta baixa', planta: true,
      olhar: 'Rótulos sobrepostos ou cortados, cores de categoria, cotas legíveis, norte.' },
    /* --------------------------------------------------------- processo */
    { grupo: 'Processo', nome: 'Laje de cima', camera: () => perto(todos['R-01'].grupo, { dir: [-0.6, 1.4, 0.7], dist: 4 }),
      olhar: 'Corredores pintados, rampas, mureta, caixa coletora, o que fica sem acesso.' },
    { grupo: 'Processo', nome: 'R-01 de perto', camera: () => perto(todos['R-01'].grupo, { dir: [1, 0.3, 0.6], dist: 1.2 }),
      olhar: 'Tampos, bocais encostados, plataforma e escadas, isolamento, TAG pintada, saia e fundação.' },
    { grupo: 'Processo', nome: 'Sob o rack, a pé', camera: () => ({ pos: [LIMITES.oeste.x + 4, 1.7, zR], alvo: [LIMITES.leste.x, 4, zR] }),
      olhar: 'Altura livre, apoio de cada tubo, bombas sob as bordas, válvulas ao alcance, iluminação.' },
    { grupo: 'Processo', nome: 'Limite de bateria leste', camera: () => ({ pos: [LIMITES.leste.x + 9, 6, zR + 6], alvo: [LIMITES.leste.x, 5.5, zR] }),
      olhar: 'Linhas cruzando o limite — bloqueio, raquete, plataforma (pendência O).' },
    { grupo: 'Processo', nome: 'Limite de bateria oeste', camera: () => ({ pos: [LIMITES.oeste.x - 9, 6, zR + 6], alvo: [LIMITES.oeste.x, 5.5, zR] }),
      olhar: 'Idem: o que sai para tanques, ETE e purga.' },
    { grupo: 'Processo', nome: 'Cristalização e filtros', camera: () => perto(todos['F-01'].grupo, { dir: [0.4, 0.5, 1], dist: 2.2 }),
      olhar: 'Cristalizador nas pernas, filtro rotativo com cuba e tambor, suspensão descendo, bomba de torta.' },
    { grupo: 'Processo', nome: 'T-01 e trocadores', camera: () => perto(todos['T-01'].grupo, { dir: [0.3, 0.7, 1], dist: 2.6 }),
      olhar: 'Trocadores casco-tubo com berço, feixe a sacar, ligações.' },
    { grupo: 'Processo', nome: 'Compressor', camera: () => aPe(todos['CP-01'].grupo, { dir: [1, 0, 0.5], dist: 7 }),
      olhar: 'Compressor, tomada de ar, base, abrigo.' },
    /* -------------------------------------------------------- utilidades */
    { grupo: 'Utilidades', nome: 'Torre de resfriamento', camera: () => perto(objeto('torre'), { dir: [1, 0.5, 1], dist: 1.5 }),
      olhar: 'Células, ventiladores, bacia, tubos entrando, bombas BAR.' },
    { grupo: 'Utilidades', nome: 'Caldeira', camera: () => perto(objeto('caldeira'), { dir: [-0.6, 0.5, 1], dist: 2.2 }),
      olhar: 'Caldeira sob a cobertura, chaminé, queimador, vapor e condensado saindo.' },
    { grupo: 'Utilidades', nome: 'Subestação', camera: () => perto(objeto('casa-subestacao'), { dir: [1, 0.6, -1], dist: 2 }),
      olhar: 'Transformadores, cerca e brita da subestação, entrada de cabos.' },
    { grupo: 'Utilidades', nome: 'ETA', ...vista('eta'), olhar: 'Poço, filtros, reservatório, castelo, tubos entre eles.' },
    { grupo: 'Utilidades', nome: 'ETE', ...vista('ete'), olhar: 'Separador e equalização enterrados, biológico, decantador, leitos, acesso do caminhão.' },
    { grupo: 'Utilidades', nome: 'Parque de tanques', ...vista('tanques'), olhar: 'Tanques, bacia, escadas de transposição, tubos.' },
    { grupo: 'Utilidades', nome: 'Descarga de tolueno', camera: () => perto(objeto('laje-descarga'), { dir: [1, 0.6, 0.6], dist: 1.4 }),
      olhar: 'Baia, braços, cobertura, caminhão, aterramento.' },
    { grupo: 'Utilidades', nome: 'Água de incêndio', camera: () => perto(objeto('TQ-AI'), { dir: [1, 0.4, 1], dist: 1.8 }),
      olhar: 'Tanque, casa de bombas, rede e hidrantes.' },
    /* ---------------------------------------------------------- entorno */
    { grupo: 'Entorno', nome: 'Portaria de fora', ...vista('portaria'), olhar: 'Cobertura, guarita, cancelas, faixas, catracas, letreiro.' },
    { grupo: 'Entorno', nome: 'Portaria a pé', camera: () => ({ pos: [PRACA_X() + 9, 1.7, 140], alvo: [PRACA_X(), 1.5, 128] }),
      olhar: 'Escala da cobertura, porteiro no vidro, catraca, calçada até ela.' },
    { grupo: 'Entorno', nome: 'Ponto de ônibus a pé', camera: () => aPe(objeto('abrigo-onibus'), { dir: [1, 0, 1.2], dist: 9 }),
      olhar: 'Abrigo, banco, pintura do caminho, operários esperando.' },
    { grupo: 'Entorno', nome: 'Estacionamento', camera: () => { const [x, z] = centroBloco('ESTAC'); return { pos: [x + 20, 6, z + 14], alvo: [x, 0, z] }; },
      olhar: 'Vagas, carros dentro da vaga, passagem, árvores, iluminação.' },
    { grupo: 'Entorno', nome: 'Prédios de apoio a pé', camera: () => aPe(objeto('predio-CONTROLE'), { dir: [0.3, 0, -1], dist: 16 }),
      olhar: 'Fachadas, letreiros para o processo, portas na calçada, canteiros.' },
    { grupo: 'Entorno', nome: 'Armazém e docas', camera: () => perto(objeto('predio-ARMAZEM'), { dir: [1, 0.35, 0.2], dist: 1.4 }),
      olhar: 'Docas no lado da via de serviço, pátio de manobra, caminhão.' },
    { grupo: 'Entorno', nome: 'Pipeway cruzando a via', camera: () => { const [x, z] = centroBloco('TANQUES'); return { pos: [x + 30, 4, z + 50], alvo: [x + 10, 5, z + 30] }; },
      olhar: 'Ponte do pipeway, altura livre, postes fora da via.' },
    { grupo: 'Entorno', nome: 'Limite do lote', camera: () => ({ pos: [-100, 25, 150], alvo: [0, 0, 60] }),
      olhar: 'Cerca, via pública, o que há fora do lote, borda do terreno.' },
    /* -------------------------------------------------------- interiores */
    { grupo: 'Interiores', nome: 'Sala de controle', ...vista('controle'), olhar: 'Videowall, console, telas, cadeiras, forro e luz.' },
    { grupo: 'Interiores', nome: 'Laboratório', camera: () => sala('LAB', 0, 'Laboratório de controle de qualidade'), olhar: 'Capelas, bancadas, bancada central, pia.' },
    { grupo: 'Interiores', nome: 'Oficina', camera: () => sala('OFICINA', 0, 'Oficina de manutenção', [0.05, 0.1]), olhar: 'Bancadas, torno, ponte rolante, portões.' },
    { grupo: 'Interiores', nome: 'Almoxarifado', camera: () => sala('OFICINA', 0, 'Almoxarifado'), olhar: 'Estantes, corredores.' },
    { grupo: 'Interiores', nome: 'Armazém por dentro', camera: () => sala('ARMAZEM', 0, 'Armazém de produto acabado', [0.05, 0.5]), olhar: 'Porta-paletes, corredores, empilhadeira, docas.' },
    { grupo: 'Interiores', nome: 'Recepção do ADM', camera: () => sala('ADM', 0, 'Recepção', [0.5, 0.9]), olhar: 'Balcão, espera, porta, escada no arquivo.' },
    { grupo: 'Interiores', nome: 'Escritório do 1º andar', camera: () => sala('ADM', 1, 'Escritório'), olhar: 'Ilhas de mesas, armários, vão da escada.' },
    { grupo: 'Interiores', nome: 'Sala de reunião', camera: () => sala('ADM', 1, 'Sala de reunião'), olhar: 'Mesa, cadeiras, quadro.' },
    { grupo: 'Interiores', nome: 'Refeitório', camera: () => sala('REFEITORIO', 0, 'Refeitório'), olhar: 'Mesas, buffet, fila.' },
    { grupo: 'Interiores', nome: 'Vestiário', camera: () => sala('REFEITORIO', 0, 'Vestiário'), olhar: 'Armários, bancos, chuveiros.' },
    { grupo: 'Interiores', nome: 'Ambulatório', camera: () => sala('BRIGADA', 0, 'Ambulatório'), olhar: 'Maca, pia, armários.' },
    { grupo: 'Interiores', nome: 'Casa de bombas de incêndio', camera: () => sala('BOMBAS-INC', 0, 'Casa de bombas de incêndio'), olhar: 'Bombas, painel, tubos (entram e saem?).' },
    { grupo: 'Interiores', nome: 'Subestação por dentro', camera: () => sala('SUBESTACAO', 0, 'Cubículos de média tensão', [0.95, 0.5]), olhar: 'Cubículos, quadros, cabos.' },
    { grupo: 'Interiores', nome: 'Casa da ETA', camera: () => sala('ETA', 0, 'Casa de química e bombas'), olhar: 'Bombas, dosagem, tubos.' },
  ];
  // centro da ilha da portaria (lazy: site.js ja carregado)
  const PRACA_X = () => { const b = bloco('PORTARIA'); return (b.x[0] + b.x[1]) / 2; };

  function ir(i) {
    const p = POSTOS[i];
    if (!p) return null;
    if (p.planta) { if (!planta.ativa) planta.alternar(); return `${i} ${p.grupo} · ${p.nome}: ${p.olhar}`; }
    if (planta.ativa) planta.alternar();
    const { pos, alvo } = p.camera ? p.camera() : p;
    C.irPara(v3(pos), v3(alvo));
    interiores.atualizar(cena.camera, 1 / 60);
    ambiente.distanciaPessoas(cena.camera);
    return `${i} ${p.grupo} · ${p.nome}: ${p.olhar}`;
  }
  return {
    postos: POSTOS,
    lista: () => POSTOS.map((p, i) => `${i} ${p.grupo} · ${p.nome}`),
    ir,
  };
}
