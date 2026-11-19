import * as THREE from 'three';
import { TK01, DN } from '../data/plant.js';
import { criarCostado, criarLiquido, nivelDeVolume } from '../lib/vessel.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { criarSaia, criarFundacao } from '../lib/supports.js';
import { alturaNoRaio } from '../lib/profiles.js';
import { rotulo } from '../lib/dimensions.js';

/**
 * ===========================================================================
 *  TK-01  —  TANQUE DE TOLUENO  (pulmao atmosferico, fundo plano)
 * ===========================================================================
 *  Mesma composicao dos demais vasos verticais. O que muda e o tampo inferior
 *  PLANO, que a primitiva de perfil ja sabe gerar — nao ha codigo especial.
 */

const rad = THREE.MathUtils.degToRad;
const n2 = (v) => v.toFixed(2).replace('.', ',');
const n1 = (v) => v.toFixed(1).replace('.', ',');

function marcar(obj, ficha) { obj.userData.ficha = ficha; return obj; }

export function criarTK01() {
  const g = TK01.geom;
  const raiz = new THREE.Group();
  raiz.name = TK01.tag;
  const camadas = {};
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';
  const ancoras = {};

  const v = criarCostado(g);
  const nivel = nivelDeVolume(g, g.volumeUtil);

  marcar(v.mesh, {
    titulo: TK01.tag,
    subtitulo: TK01.nome,
    grupos: [
      { nome: 'Processo', dados: TK01.processo },
      { nome: 'Mecânica', dados: TK01.mecanica },
      {
        nome: 'Dimensões do modelo 3D',
        dados: {
          'Diâmetro interno': `${n2(g.Di)} m`,
          'Altura do costado (T/T)': `${n2(g.Ltan)} m`,
          'Relação H/D': n2(g.Ltan / g.Di),
          'Altura total': `${n2(v.topoY + g.saiaAltura)} m do piso`,
          'Nível de líquido': `${n2(nivel)} m (do fundo)`,
          'Tipo de fundo': 'Plano',
        },
      },
    ],
  });
  raiz.add(v.mesh);

  /* -------------------------------------------------------------- liquido */
  const internos = new THREE.Group();
  internos.name = 'camada-internos';
  internos.add(marcar(criarLiquido(g, nivel), {
    titulo: 'Inventário de tolueno',
    subtitulo: 'Pulmão regulador entre recuperação e consumo',
    grupos: [{
      nome: 'Condições',
      dados: {
        'Volume útil': `${n2(g.volumeUtil)} m³`,
        'Nível resultante': `${n2(nivel)} m do fundo`,
        'Tempo de residência': '15 min',
        'Temperatura': '50 °C',
        'Densidade': '832 kg/m³',
        'Ponto de fulgor do tolueno': '4 °C — área classificada',
      },
    }],
  }));
  raiz.add(internos);
  camadas.internos = internos;

  /* --------------------------------------------------------------- bocais */
  const bocais = new THREE.Group();
  bocais.name = 'camada-bocais';

  for (const b of TK01.bocais) {
    const ehVisita = b.dn >= 500;
    let pos, dir, comp;

    if (b.face === 'lateral') {
      const a = rad(b.ang);
      const rIni = v.R - 0.03;
      comp = (v.R + (ehVisita ? 0.24 : 0.18)) - rIni;
      pos = new THREE.Vector3(Math.cos(a) * rIni, b.y, Math.sin(a) * rIni);
      dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    } else {
      const a = rad(b.ang);
      const r = b.r ?? 0;
      const ehTopo = b.face === 'topo';
      const yS = ehTopo
        ? v.topoY - v.hTopo + alturaNoRaio(g.tampoTopo, v.R, r) + (g.abaReta ?? 0)
        : v.fundoY + v.hFundo - alturaNoRaio(g.tampoFundo, v.R, r) - (g.abaReta ?? 0);
      comp = 0.24;
      pos = new THREE.Vector3(Math.cos(a) * r, yS + (ehTopo ? -0.03 : 0.03), Math.sin(a) * r);
      dir = new THREE.Vector3(0, ehTopo ? 1 : -1, 0);
    }

    const bo = criarBocal({ dn: b.dn, comprimento: comp, visor: ehVisita });
    orientarPara(bo, pos, dir);

    const corrente = TK01.correntes.find((c) => c.bocal === b.id);
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
            ...(b.y !== undefined ? { 'Elevação (fundo)': `${n2(b.y)} m` } : {}),
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
    titulo: 'Berço anelar',
    subtitulo: 'Apoio do fundo plano sobre a laje',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Altura': `${n2(g.saiaAltura)} m`,
        'Espessura': `${(g.saiaEspessura * 1000).toFixed(0)} mm`,
        'Tipo de fundo apoiado': 'Plano',
        'Material': 'SA-516 Gr. 70 (estimado)',
      },
    }],
  }));
  estrutura.add(criarFundacao(g));
  raiz.add(estrutura);
  camadas.estrutura = estrutura;

  /* ------------------------------------------------------------------ tag */
  const grupoTag = new THREE.Group();
  const tag = rotulo(TK01.tag, 'tag-label');
  tag.position.set(0, v.topoY + 0.9, 0);
  grupoTag.add(tag);
  raiz.add(grupoTag);
  camadas.tag = grupoTag;

  raiz.position.y = g.saiaAltura;

  return {
    grupo: raiz,
    camadas,
    nivel,
    ancoras,
    alturaTotal: v.topoY + g.saiaAltura,
    raio: v.R,
    fichaPadrao: v.mesh.userData.ficha,
  };
}
