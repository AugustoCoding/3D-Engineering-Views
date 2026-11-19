import * as THREE from 'three';
import { V02, DN } from '../data/plant.js';
import { criarCostado, criarLiquidoHorizontal, nivelDeVolume } from '../lib/vessel.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { criarBercos } from '../lib/supports.js';
import { perfilTampo } from '../lib/profiles.js';
import { rotulo } from '../lib/dimensions.js';
import { MAT } from '../core/materials.js';

/**
 * ===========================================================================
 *  V-02  —  SEPARADOR LIQUIDO-LIQUIDO  (decantador HORIZONTAL)
 * ===========================================================================
 *  O costado e construido em pe pela mesma primitiva dos outros vasos e
 *  DEITADO por rotacao: assim a matematica de tampo continua sendo uma so.
 *
 *  Referencial do grupo: origem no EIXO do vaso, Z ao longo do comprimento,
 *  centrado. O grupo inteiro sobe depois para a altura do eixo.
 */

const n2 = (v) => v.toFixed(2).replace('.', ',');
const n1 = (v) => v.toFixed(1).replace('.', ',');
const n3 = (v) => v.toFixed(3).replace('.', ',');

function marcar(obj, ficha) { obj.userData.ficha = ficha; return obj; }

/** Altura da superficie do tampo (ao longo do eixo) a distancia `r` do centro. */
function saliencia(tipo, R, r) {
  const pf = perfilTampo(tipo, R);
  const a = Math.abs(r);
  for (let i = 0; i < pf.length - 1; i++) {
    if (a <= pf[i].x && a >= pf[i + 1].x) {
      const f = pf[i].x === pf[i + 1].x ? 0 : (pf[i].x - a) / (pf[i].x - pf[i + 1].x);
      return pf[i].y + f * (pf[i + 1].y - pf[i].y);
    }
  }
  return pf.at(-1).y;
}

export function criarV02() {
  const g = V02.geom;
  const raiz = new THREE.Group();
  raiz.name = V02.tag;
  const camadas = {};
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';

  const meio = g.Ltan / 2;
  const ABA = g.abaReta ?? 0;
  const nivel = nivelDeVolume(g, g.volumeUtil);
  const interface_ = nivelDeVolume(g, g.volumeFasePesada);

  /* ------------------------------------------------------- costado deitado */
  const v = criarCostado(g);
  const deitado = new THREE.Group();
  deitado.add(v.mesh);
  // Rx(+90 graus) leva +Y para +Z: o vaso vertical passa a apontar ao longo
  // do eixo Z. Depois desloca para ficar centrado no comprimento.
  deitado.rotation.x = Math.PI / 2;
  deitado.position.z = -meio;

  marcar(v.mesh, {
    titulo: V02.tag,
    subtitulo: V02.nome,
    grupos: [
      { nome: 'Processo', dados: V02.processo },
      { nome: 'Mecânica', dados: V02.mecanica },
      {
        nome: 'Dimensões do modelo 3D',
        dados: {
          'Diâmetro interno': `${n2(g.Di)} m`,
          'Comprimento T/T': `${n2(g.Ltan)} m`,
          'Relação L/D': n2(g.Ltan / g.Di),
          'Comprimento total': `${n2(g.Ltan + 2 * (ABA + v.hTopo - ABA))} m`,
          'Altura do eixo': `${n2(g.alturaEixo)} m do piso`,
          'Nível de líquido': `${n2(nivel)} m (do fundo)`,
          'Interface água/orgânico': `${n3(interface_)} m (do fundo)`,
        },
      },
    ],
  });
  raiz.add(deitado);

  /* --------------------------------------------------------- fases liquidas */
  const internos = new THREE.Group();
  internos.name = 'camada-internos';

  const agua = criarLiquidoHorizontal(g, 0, interface_, MAT.agua);
  if (agua) {
    internos.add(marcar(agua, {
      titulo: 'Fase aquosa (pesada)',
      subtitulo: 'Água subproduto da oxidação — descartada pela Corrente 07',
      grupos: [{
        nome: 'Condições',
        dados: {
          'Vazão': '297,9 kg/h (0,302 m³/h)',
          'Densidade a 50 °C': '988 kg/m³',
          'Altura da camada': `${n3(interface_)} m do fundo`,
          'Volume retido': `${n3(g.volumeFasePesada)} m³`,
          'Saída': 'N2 — bocal de fundo',
        },
      }],
    }));
  }

  const tolueno = criarLiquidoHorizontal(g, interface_, nivel, MAT.tolueno);
  if (tolueno) {
    internos.add(marcar(tolueno, {
      titulo: 'Fase orgânica (leve)',
      subtitulo: 'Tolueno recuperado — Corrente 08 para o TK-01',
      grupos: [{
        nome: 'Condições',
        dados: {
          'Vazão': '2 983,2 kg/h (3,469 m³/h)',
          'Densidade a 50 °C': '860 kg/m³',
          'Diferença de densidade': '128 kg/m³',
          'Nível de líquido': `${n2(nivel)} m do fundo`,
          'Saída': 'N3 — bocal no tampo direito',
        },
      }],
    }));
  }
  raiz.add(internos);
  camadas.internos = internos;

  /* --------------------------------------------------------------- bocais */
  const bocais = new THREE.Group();
  bocais.name = 'camada-bocais';
  const ancoras = {};

  for (const b of V02.bocais) {
    let pos, dir, comp = 0.24;

    if (b.face === 'topo' || b.face === 'fundo') {
      const ehTopo = b.face === 'topo';
      const z = (b.u ?? meio) - meio;
      pos = new THREE.Vector3(0, ehTopo ? v.R - 0.02 : -(v.R - 0.02), z);
      dir = new THREE.Vector3(0, ehTopo ? 1 : -1, 0);
    } else {
      const lado = b.face === 'tampo-dir' ? 1 : -1;
      const alt = b.v ?? 0;
      const z = lado * (meio + ABA + saliencia(g.tampoTopo, v.R, alt) - 0.02);
      pos = new THREE.Vector3(0, alt, z);
      dir = new THREE.Vector3(0, 0, lado);
    }

    const bo = criarBocal({ dn: b.dn, comprimento: comp });
    orientarPara(bo, pos, dir);

    const corrente = V02.correntes.find((c) => c.bocal === b.id);
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
            ...(b.u !== undefined ? { 'Posição no eixo': `${n2(b.u)} m da tangência esq.` } : {}),
            ...(b.v !== undefined ? { 'Altura no tampo': `${n2(b.v)} m do eixo` } : {}),
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
  estrutura.add(marcar(criarBercos({
    R: v.R,
    b: g.bercos,
    Ltan: g.Ltan,
    hEixo: g.alturaEixo,
    hFund: g.fundacaoAltura,
    larguraFund: g.fundacaoLargura,
  }), {
    titulo: 'Berços de sustentação',
    subtitulo: 'Suporte de vaso horizontal',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Quantidade': '2',
        'Largura do berço': `${(g.bercos.largura * 1000).toFixed(0)} mm`,
        'Ângulo de contato': '120°',
        'Posição': `${(g.bercos.fracao * 100).toFixed(0)} % de L a partir de cada tangência`,
        'Altura do eixo': `${n2(g.alturaEixo)} m do piso`,
        'Material': 'SA-516 Gr. 70 sobre bloco de concreto (estimado)',
      },
    }],
  }));
  raiz.add(estrutura);
  camadas.estrutura = estrutura;

  /* ------------------------------------------------------------------ tag */
  const grupoTag = new THREE.Group();
  const tag = rotulo(V02.tag, 'tag-label');
  tag.position.set(0, v.R + 0.9, 0);
  grupoTag.add(tag);
  raiz.add(grupoTag);
  camadas.tag = grupoTag;

  raiz.position.y = g.alturaEixo;

  return {
    grupo: raiz,
    camadas,
    nivel,
    interface: interface_,
    alturaTotal: g.alturaEixo + v.R,
    ancoras,
    raio: v.R,
    fichaPadrao: v.mesh.userData.ficha,
  };
}
