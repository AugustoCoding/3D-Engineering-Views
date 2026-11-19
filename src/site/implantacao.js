import * as THREE from 'three';
import {
  BLOCOS, VIAS, LOTE, ROTAS_CAMINHAO, PORTOES, VENTO,
  DISTANCIAS, COTAS_PLANTA, CHAO, vetorBarlavento, ONIBUS,
} from '../data/site.js';
import { FICHA_AGUA } from '../data/agua.js';
import { ret, centro, distRetRet, pontosMaisProximos, folgaLimite, expandirAteVias } from '../lib/plano.js';
import { placa, placaArredondada, linhaTracejada, setaPlana, Y } from '../lib/terreno.js';
import { criarChao } from './chao.js';
import { rotulo, cota } from '../lib/dimensions.js';
import { triplanar } from '../lib/texturas.js';

/**
 * ===========================================================================
 *  IMPLANTACAO — o terreno em blocos
 * ===========================================================================
 *  Composicao, como equipment/: le src/data/site.js e combina as primitivas
 *  de lib/terreno.js. Cada bloco e uma placa colorida no chao; os predios,
 *  tanques e utilidades em cima delas estao em site/entorno.js (Fase 7).
 *
 *  As etiquetas dos blocos e as cotas de distancia ficam num grupo proprio,
 *  ligado so na vista de planta: na vista de perto elas boiariam no horizonte,
 *  porque etiqueta HTML nao some na neblina como a geometria.
 */

const CORES = {
  tanques: 0xb5652f, carga: 0xc98a2b, utilidade: 0x8a5bb5, torre: 0x2f7fa8,
  incendio: 0xc0392b, controle: 0x2e9e8a, apoio: 0x6d7b89, ocupado: 0x3a9d4f,
  efluentes: 0x6b8e23, estacionamento: 0x24282d, verde: 0x2f6b3a, encontro: 0x9ccc65,
  agua: 0x3aa0d8,
};

/* Piso de verdade de cada categoria, para a vista livre: a bacia dos tanques
 * e as bases de utilidade sao concreto, o patio de utilidade e brita, o redor
 * dos predios e calcada ou grama. A cor da categoria (CORES) so pinta o bloco
 * na vista de planta, onde ela e a legenda do desenho. */
const CONCRETO = { cor: 0x86847d, tex: ['concreto', 2] };
const BRITA = { cor: 0x8e8c85, tex: ['brita', 3] };
const CALCADA = { cor: 0x9a9ea2, tex: ['calcada', 2] };
const GRAMA = { cor: 0x8a8a74, tex: ['grama', 4] };
const PISO = {
  tanques: CONCRETO, carga: CONCRETO, torre: CONCRETO, incendio: CONCRETO,
  utilidade: BRITA, efluentes: BRITA, agua: BRITA, controle: CALCADA, apoio: CALCADA,
  ocupado: GRAMA, verde: GRAMA, encontro: GRAMA,
  estacionamento: { cor: 0x4a4e53, tex: ['asfalto', 4] },
};

const NOME_CATEGORIA = {
  processo: 'Área de processo (ISBL)', tanques: 'Armazenagem de inflamável',
  carga: 'Carga e descarga de caminhão', utilidade: 'Utilidade (fonte de ignição)',
  torre: 'Utilidade', incendio: 'Combate a incêndio', controle: 'Sala de controle',
  apoio: 'Apoio à operação', ocupado: 'Prédio ocupado', efluentes: 'Utilidade', agua: 'Utilidade',
  estacionamento: 'Estacionamento', verde: 'Paisagismo', encontro: 'Emergência',
};

const f1 = (v) => v.toFixed(1).replace('.', ',');

/** Ficha de um bloco: tamanho e as distancias que a categoria dele exige. */
function fichaBloco(b) {
  const r = ret(b);
  const regras = DISTANCIAS.filter((d) => d.a === b.categoria || d.b === b.categoria);
  const exigencias = {};
  for (const d of regras) {
    const outro = d.a === b.categoria ? d.b : d.a;
    exigencias[`até ${outro.replace('via:', 'via ')}`] = `≥ ${f1(d.min)} m — ${d.fonte}`;
  }
  return {
    titulo: b.nome,
    subtitulo: NOME_CATEGORIA[b.categoria],
    grupos: [
      {
        nome: 'Implantação (adotado)',
        dados: {
          'Dimensões': `${f1(r.x1 - r.x0)} × ${f1(r.z1 - r.z0)} m`,
          'Área': `${Math.round((r.x1 - r.x0) * (r.z1 - r.z0))} m²`,
          ...(b.foraDoLote ? { 'Situação': 'Fora da cerca' } : {}),
        },
      },
      ...(Object.keys(exigencias).length ? [{ nome: 'Distâncias mínimas', dados: exigencias }] : []),
      // ETA e ETE: o balanco de agua que as dimensiona (agua.js)
      ...(FICHA_AGUA[b.id] ?? []),
    ],
  };
}

/**
 * Distancias que governam o desenho (COTAS_PLANTA): pontos mais proximos,
 * a medida e a regra. Uma conta so para a vista de planta e para a camada
 * de seguranca (Fase 8).
 */
export function medidasDePlanta() {
  const lote = ret(LOTE);
  const porId = Object.fromEntries(BLOCOS.map((b) => [b.id, b]));
  return COTAS_PLANTA.map(([idA, idB]) => {
    const A = porId[idA];
    const ra = ret(A);
    let p, q, d, cat;
    if (idB.startsWith('limite')) {
      const f = folgaLimite(ra, lote);
      [p, q, d, cat] = [f.de, f.ate, f.d, 'limite'];
    } else {
      const rb = ret(porId[idB]);
      [p, q] = pontosMaisProximos(ra, rb);
      d = distRetRet(ra, rb);
      cat = porId[idB].categoria;
    }
    const regra = DISTANCIAS.find((x) => (x.a === A.categoria && x.b === cat)
      || (x.b === A.categoria && x.a === cat));
    const texto = regra ? `${f1(d)} m · mín. ${f1(regra.min)}` : `${f1(d)} m`;
    return { a: idA, b: idB, p, q, d, regra, texto };
  });
}

export function criarImplantacao() {
  const grupo = new THREE.Group();
  grupo.name = 'implantacao';
  const planta = new THREE.Group();          // etiquetas e cotas: so na vista de planta
  planta.name = 'rotulos-planta';
  grupo.add(planta);

  const lote = ret(LOTE);

  // --- chao: gramado, brita, vias, calcadas, travessias e meio-fio (Fase 14) ---
  const chao = criarChao();
  grupo.add(chao.grupo);
  for (const rota of ROTAS_CAMINHAO) grupo.add(linhaTracejada(rota.pontos, Y.linha, 0xff9f43));

  // --- blocos (o de processo ja e a laje dos equipamentos) ---
  // Um material por categoria: a vista de planta troca a cor dele.
  const pisos = {};
  const pisoDe = (cat) => {
    const piso = PISO[cat] ?? BRITA;
    pisos[cat] ??= {
      material: triplanar(new THREE.MeshStandardMaterial({ color: piso.cor, roughness: 0.95 }), ...piso.tex),
      real: new THREE.Color(piso.cor), legenda: new THREE.Color(CORES[cat]),
    };
    return pisos[cat].material;
  };
  const soNaPlanta = [];
  for (const b of BLOCOS) {
    const [cx, cz] = centro(ret(b));
    if (b.categoria === 'verde') {
      // A faixa verde e o proprio gramado do chao, cruzado por via e calcada:
      // placa por cima dela tapava o asfalto da via principal (o autor, 30/10).
      // Fica so como legenda da vista de planta, abaixo da pista.
      const p = placa(ret(b), Y.brita, pisoDe(b.categoria));
      p.userData.ficha = fichaBloco(b);
      p.visible = false;
      soNaPlanta.push(p);
      grupo.add(p);
    } else if (b.categoria !== 'processo') {
      // bloco de piso de brita (regra CHAO, `piso`): a placa dele se estende a
      // faixa, de cantos redondos, sem passar da pista — uma superficie so,
      // sem a brita por baixo nem o degrau entre as duas
      const ext = CHAO.brita.find((rg) => rg.piso && rg.categorias.includes(b.categoria));
      const p = ext
        ? placaArredondada(expandirAteVias(ret(b), ext.faixa, VIAS), 1, Y.bloco, pisoDe(b.categoria), 0.2)
        : placa(ret(b), Y.bloco, pisoDe(b.categoria));
      p.userData.ficha = fichaBloco(b);
      grupo.add(p);
    }
    // na planta, o rotulo curto: os nomes longos de blocos vizinhos se
    // tocavam e o gerenciador apagava um deles (o nome inteiro vai na ficha)
    const lbl = rotulo(b.rotulo ?? b.nome, `zona-label zona-${b.categoria}`);
    lbl.position.set(cx, 1.5, cz);
    planta.add(lbl);
  }
  // o ponto de onibus nao e bloco: rotulo proprio, no abrigo
  {
    const ab = ONIBUS.abrigo;
    const lbl = rotulo('Ônibus', 'zona-label zona-apoio');
    lbl.position.set((ab.x[0] + ab.x[1]) / 2, 1.5, (ab.z[0] + ab.z[1]) / 2);
    planta.add(lbl);
  }

  // --- portoes (o de pedestre fica ao lado da portaria: um rotulo so) ---
  for (const p of PORTOES.filter((q) => q.uso !== 'pedestres')) {
    const lbl = rotulo(p.nome, 'zona-label zona-portao');
    lbl.position.set(p.x, 1.5, p.z);
    planta.add(lbl);
  }

  // --- cotas das distancias que governam o desenho ---
  for (const { p, q, texto } of medidasDePlanta()) {
    planta.add(cota(
      new THREE.Vector3(p[0], 0.4, p[1]), new THREE.Vector3(q[0], 0.4, q[1]),
      texto, { classe: 'dist-label', tick: 2.5 },
    ));
  }

  // --- norte e vento, na area livre a nordeste: so na planta baixa (em 3D
  // eram setas de 14 e 20 m pintadas no gramado) ---
  planta.add(setaPlana({ x: 118, z: -36, dx: 0, dz: -1, comprimento: 14, largura: 2, cor: 0xe8edf3 }));
  const lblN = rotulo('N', 'zona-label zona-norte');
  lblN.position.set(118, 1.5, -54);
  planta.add(lblN);

  // A seta do vento aponta para onde ele VAI, saindo do lado de onde vem.
  const [bx, bz] = vetorBarlavento(VENTO.de);
  planta.add(setaPlana({
    x: 128 + bx * 10, z: -12 + bz * 10, dx: -bx, dz: -bz, comprimento: 20, largura: 2.4, cor: 0x7cc4ff,
  }));
  const lblV = rotulo(`Vento predominante de ${VENTO.rotulo}`, 'zona-label zona-vento');
  lblV.position.set(128, 1.5, -2);
  planta.add(lblV);

  /* A vista de planta enquadra tudo o que foi desenhado, e nao so o lote: o
   * estacionamento e a via publica ficam fora da cerca, ao sul. */
  const limites = { ...lote };
  const incluir = (x, z, folga = 0) => {
    limites.x0 = Math.min(limites.x0, x - folga); limites.x1 = Math.max(limites.x1, x + folga);
    limites.z0 = Math.min(limites.z0, z - folga); limites.z1 = Math.max(limites.z1, z + folga);
  };
  for (const b of BLOCOS) { incluir(b.x[0], b.z[0]); incluir(b.x[1], b.z[1]); }
  for (const v of VIAS) for (const [x, z] of v.pontos) incluir(x, z, v.largura / 2);

  /** Vista de planta: blocos na cor da categoria; vista livre: o piso real. */
  function pintarLegenda(ligada) {
    for (const p of Object.values(pisos)) p.material.color.copy(ligada ? p.legenda : p.real);
    for (const p of soNaPlanta) p.visible = ligada;
  }

  return { grupo, rotulosPlanta: planta, limites, pintarLegenda, chao };
}
