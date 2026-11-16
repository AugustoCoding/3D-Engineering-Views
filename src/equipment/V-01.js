import * as THREE from 'three';
import { V01, DN } from '../data/plant.js';
import { criarCostado, criarLiquido, nivelDeVolume, volumeTotalInterno } from '../lib/vessel.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { criarDemister } from '../lib/internals.js';
import { criarSaia, criarFundacao } from '../lib/supports.js';
import { alturaNoRaio } from '../lib/profiles.js';
import { rotulo } from '../lib/dimensions.js';

/**
 * ===========================================================================
 *  V-01  —  SEPARADOR GAS-LIQUIDO  (knock-out drum vertical)
 * ===========================================================================
 *  Sem geometria propria: compoe as primitivas de src/lib com os numeros de
 *  src/data/plant.js. Origem local em y = 0 na linha de tangencia inferior.
 */

const rad = THREE.MathUtils.degToRad;
const n2 = (v) => v.toFixed(2).replace('.', ',');
const n1 = (v) => v.toFixed(1).replace('.', ',');

function marcar(obj, ficha) { obj.userData.ficha = ficha; return obj; }

export function criarV01() {
  const g = V01.geom;
  const raiz = new THREE.Group();
  raiz.name = V01.tag;
  const camadas = {};
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';

  const v = criarCostado(g);
  const nivel = nivelDeVolume(g, g.volumeUtil);

  marcar(v.mesh, {
    titulo: V01.tag,
    subtitulo: V01.nome,
    grupos: [
      { nome: 'Processo', dados: V01.processo },
      { nome: 'Mecânica', dados: V01.mecanica },
      {
        nome: 'Dimensões do modelo 3D',
        dados: {
          'Diâmetro interno': `${n2(g.Di)} m`,
          'Altura do costado (T/T)': `${n2(g.Ltan)} m`,
          'Relação L/D': n2(g.Ltan / g.Di),
          'Altura total do vaso': `${n2(v.alturaTotal)} m`,
          'Elevação do topo': `${n2(v.topoY + g.saiaAltura)} m do piso`,
          'Nível de líquido': `${n2(nivel)} m (da LT inf.)`,
          'Volume interno da geometria': `${n1(volumeTotalInterno(g))} m³`,
        },
      },
    ],
  });
  raiz.add(v.mesh);

  /* ------------------------------------------------------------- internos */
  const internos = new THREE.Group();
  internos.name = 'camada-internos';

  internos.add(marcar(criarLiquido(g, nivel), {
    titulo: 'Fase líquida retida',
    subtitulo: 'Tolueno + água condensados',
    grupos: [{
      nome: 'Condições',
      dados: {
        'Volume retido': `${g.volumeUtil.toFixed(3).replace('.', ',')} m³`,
        'Nível resultante': `${n2(nivel)} m acima da LT inf.`,
        'Tempo de retenção': '5 min a 50 % da capacidade',
        'Temperatura': '50 °C',
        'Densidade': '870 kg/m³',
      },
    }],
  }));

  internos.add(marcar(criarDemister(g.demister, g.Di / 2, g.Ltan + (g.abaReta ?? 0)), {
    titulo: 'Eliminador de névoa',
    subtitulo: 'Malha de arame AISI 304',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Espessura da pastilha': `${(g.demister.espessura * 1000).toFixed(0)} mm`,
        'Abaixo da tangência sup.': `${n2(g.demister.abaixoDoTopo)} m`,
        'Material': 'Malha de arame AISI 304',
        'Função': 'Reter gotículas arrastadas pelo gás',
        'Importância': 'O fator k = 0,11 m/s do dimensionamento pressupõe demister',
      },
    }],
  }));

  raiz.add(internos);
  camadas.internos = internos;

  /* --------------------------------------------------------------- bocais */
  const bocais = new THREE.Group();
  bocais.name = 'camada-bocais';
  const ancoras = {};

  for (const b of V01.bocais) {
    let pos, dir, comp;
    if (b.face === 'lateral') {
      const a = rad(b.ang);
      const rIni = v.R - 0.03;
      comp = (v.R + 0.20) - rIni;
      pos = new THREE.Vector3(Math.cos(a) * rIni, b.y, Math.sin(a) * rIni);
      dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    } else {
      const a = rad(b.ang);
      const r = b.r ?? 0;
      const ehTopo = b.face === 'topo';
      const yS = ehTopo
        ? v.topoY - v.hTopo + alturaNoRaio(g.tampoTopo, v.R, r) + (g.abaReta ?? 0)
        : v.fundoY + v.hFundo - alturaNoRaio(g.tampoFundo, v.R, r) - (g.abaReta ?? 0);
      comp = 0.26;
      pos = new THREE.Vector3(Math.cos(a) * r, yS + (ehTopo ? -0.03 : 0.03), Math.sin(a) * r);
      dir = new THREE.Vector3(0, ehTopo ? 1 : -1, 0);
    }

    const bo = criarBocal({ dn: b.dn, comprimento: comp });
    orientarPara(bo, pos, dir);

    const corrente = V01.correntes.find((c) => c.bocal === b.id);
    marcar(bo, {
      titulo: `${b.id} — DN ${b.dn}`,
      subtitulo: b.servico,
      grupos: [
        {
          nome: 'Bocal',
          dados: {
            'Identificação': b.id,
            'Diâmetro nominal': `DN ${b.dn} (Ø ext. ${n1(DN[b.dn].od * 1000)} mm)`,
            'Classe do flange': '150# RF (ASME B16.5)',
            'Serviço': b.servico,
            'Face': b.face,
            ...(b.y !== undefined ? { 'Elevação (LT inf.)': `${n2(b.y)} m` } : {}),
            'Posição angular': `${b.ang}°`,
          },
        },
        ...(corrente ? [{
          nome: `Corrente ${corrente.id}`,
          dados: {
            'Sentido': corrente.sentido,
            'Fluido': corrente.fluido,
            'Composição': corrente.composicao,
            'Vazão': corrente.vazao,
            'Temperatura': corrente.T,
            'Pressão': corrente.P,
          },
        }] : []),
      ],
    });
    bocais.add(bo);

    ancoras[b.id] = {
      pos: pos.clone().addScaledVector(dir, comp + DN[b.dn].esp + 0.01),
      dir: dir.clone(),
      dn: b.dn,
    };
    const lbl = rotulo(b.id, 'bocal-label');
    lbl.position.copy(pos).addScaledVector(dir, comp + 0.12);
    rotulos.add(lbl);
  }
  raiz.add(bocais, rotulos);
  camadas.rotulos = rotulos;

  /* ---------------------------------------------------------- suportacao */
  const estrutura = new THREE.Group();
  estrutura.name = 'camada-estrutura';
  estrutura.add(marcar(criarSaia(g, v.R), {
    titulo: 'Saia de sustentação',
    subtitulo: 'Suporte cilíndrico soldado',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Altura': `${n2(g.saiaAltura)} m`,
        'Espessura': `${(g.saiaEspessura * 1000).toFixed(0)} mm`,
        'Material': 'SA-516 Gr. 70 (estimado)',
      },
    }],
  }));
  estrutura.add(criarFundacao(g));
  raiz.add(estrutura);
  camadas.estrutura = estrutura;

  /* ------------------------------------------------------------------ tag */
  const grupoTag = new THREE.Group();
  const tag = rotulo(V01.tag, 'tag-label');
  tag.position.set(0, v.topoY + 1.1, 0);
  grupoTag.add(tag);
  raiz.add(grupoTag);
  camadas.tag = grupoTag;

  raiz.position.y = g.saiaAltura;

  return {
    grupo: raiz,
    camadas,
    nivel,
    alturaTotal: v.topoY + g.saiaAltura,
    ancoras,
    raio: v.R,
    fichaPadrao: v.mesh.userData.ficha,
  };
}
