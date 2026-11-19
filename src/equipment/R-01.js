import * as THREE from 'three';
import { R01, DN } from '../data/plant.js';
import {
  criarCostado, criarIsolamento, criarLiquido, criarCamisa,
  volumeTotalInterno, nivelParaVolume,
} from '../lib/vessel.js';
import { criarBocal, orientarPara } from '../lib/nozzle.js';
import { criarAgitador } from '../lib/agitator.js';
// Sem serpentina: o calor sai pela camisa de agua de resfriamento.
import { criarChicanas, criarSparger } from '../lib/internals.js';
import { criarSaia, criarFundacao, criarPlataforma, criarEscada } from '../lib/supports.js';
import { alturaNoRaio } from '../lib/profiles.js';
import { rotulo } from '../lib/dimensions.js';
import { criarOperador } from '../lib/human.js';

/**
 * ===========================================================================
 *  R-01  —  REATOR DE OXIDACAO DE TOLUENO
 * ===========================================================================
 *  Este arquivo nao contem geometria: ele COMPOE as primitivas de src/lib
 *  usando exclusivamente os numeros de src/data/plant.js.
 *
 *  Origem local: y = 0 na linha de tangencia inferior.
 *  Quem monta a cena eleva o grupo inteiro para por o piso em y = 0.
 */

const rad = THREE.MathUtils.degToRad;
const n1 = (v) => v.toFixed(1).replace('.', ',');
const n2 = (v) => v.toFixed(2).replace('.', ',');

/** Marca um objeto como clicavel e pendura a ficha tecnica nele. */
function marcar(obj, ficha) {
  obj.userData.ficha = ficha;
  return obj;
}

export function criarR01() {
  const g = R01.geom;
  const raiz = new THREE.Group();
  raiz.name = R01.tag;

  const camadas = {};   // grupos que a interface liga/desliga
  const rotulos = new THREE.Group();
  rotulos.name = 'camada-rotulos';

  /* --------------------------------------------------------------------
   * 1. COSTADO
   * ------------------------------------------------------------------ */
  const v = criarCostado(g);

  // O nivel de liquido NAO e digitado: e resolvido a partir do volume util
  // oficial, integrando a geometria real do vaso (tampo inferior incluso).
  const nivel = nivelParaVolume(g, g.volumeUtil);
  const volGeometrico = volumeTotalInterno(g);

  marcar(v.mesh, {
    titulo: R01.tag,
    subtitulo: R01.nome,
    grupos: [
      { nome: 'Processo', dados: R01.processo },
      { nome: 'Mecânica', dados: R01.mecanica },
      {
        nome: 'Dimensões do modelo 3D',
        dados: {
          'Diâmetro interno': `${n2(g.Di)} m`,
          'Altura do costado (T/T)': `${n2(g.Ltan)} m`,
          'Relação L/D': n2(g.Ltan / g.Di),
          'Espessura do costado': `${(g.espessura * 1000).toFixed(0)} mm`,
          'Altura total do vaso': `${n2(v.alturaTotal)} m`,
          'Altura da saia': `${n2(g.saiaAltura)} m`,
          'Elevação do topo': `${n2(v.topoY + g.saiaAltura)} m do piso`,
          'Nível de líquido': `${n2(nivel)} m (da LT inf.)`,
          'Volume interno da geometria': `${n1(volGeometrico)} m³`,
        },
      },
    ],
  });
  raiz.add(v.mesh);

  /* --------------------------------------------------------------------
   * 1b. CAMISA DE AGUA DE RESFRIAMENTO
   * ------------------------------------------------------------------ */
  const cam = g.camisa;
  raiz.add(marcar(criarCamisa({ R: v.R, base: cam.base, altura: cam.altura, folga: cam.folga }), {
    titulo: `${R01.tag} — camisa`,
    subtitulo: 'Água de resfriamento, remove o calor de reação',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Altura': `${n2(cam.altura)} m (da LT inf. ${n2(cam.base)} a ${n2(cam.base + cam.altura)} m)`,
        'Vão anular': `${(cam.folga * 1000).toFixed(0)} mm`,
        'Área de troca (estimada)': `${n1(Math.PI * 2 * v.R * cam.altura)} m²`,
        'Carga térmica': '2 576 kW',
        'Água de resfriamento': '87 m³/h, 25 → 50,5 °C',
        'Linhas': '3"-CW-1A (entrada) · 3"-CW-1B (saída)',
        'Controle': 'TIC do R-01 → válvula V-01',
      },
    }],
  }));

  /* --------------------------------------------------------------------
   * 2. ISOLAMENTO TERMICO
   * A faixa da camisa fica descoberta: a parede ali esta na temperatura da
   * agua (25 a 50 °C), entao isolar so atrapalharia a troca. [ESTIMADO]
   * ------------------------------------------------------------------ */
  const iso = new THREE.Group();
  iso.name = 'camada-isolamento';
  iso.add(marcar(criarIsolamento(g, g.isolamento, {
    semFaixa: [cam.base, cam.base + cam.altura],
  }), {
    titulo: 'Isolamento térmico',
    subtitulo: 'Lã de rocha + revestimento de alumínio',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Espessura': `${(g.isolamento * 1000).toFixed(0)} mm`,
        'Material': 'Lã de rocha 100 kg/m³',
        'Acabamento': 'Chapa de alumínio 0,6 mm',
        'Temperatura do meio': '140 °C',
        'Temperatura de face': '< 60 °C',
      },
    }],
  }));
  raiz.add(iso);
  camadas.isolamento = iso;

  /* --------------------------------------------------------------------
   * 3. INTERNOS  (liquido, chicanas, serpentina, sparger)
   * ------------------------------------------------------------------ */
  const internos = new THREE.Group();
  internos.name = 'camada-internos';

  internos.add(marcar(criarLiquido(g, nivel), {
    titulo: 'Massa reacional',
    subtitulo: 'Tolueno + ácido benzóico + acetato de manganês',
    grupos: [{
      nome: 'Condições',
      dados: {
        'Volume útil': `${n1(g.volumeUtil)} m³`,
        'Nível resultante': `${n2(nivel)} m acima da LT inf.`,
        'Temperatura': '140 °C',
        'Pressão': '15,0 bar',
        'Catalisador': 'Acetato de manganês (homogêneo)',
        'Holdup de gás previsto': '15 % do volume',
      },
    }],
  }));

  internos.add(marcar(criarChicanas(g.chicanas, g.Di / 2, 0.4, nivel + 0.6), {
    titulo: 'Chicanas (baffles)',
    subtitulo: `${g.chicanas.n} chapas verticais`,
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Quantidade': `${g.chicanas.n}`,
        'Largura': `${(g.chicanas.largura * 1000).toFixed(0)} mm (= D/10)`,
        'Folga da parede': `${(g.chicanas.folgaParede * 1000).toFixed(0)} mm`,
        'Função': 'Suprimir vórtice e melhorar dispersão do gás',
      },
    }],
  }));

  internos.add(marcar(criarSparger(g.sparger, g.Di / 2, 200), {
    titulo: 'Anel aspersor perfurado',
    subtitulo: 'Ring sparger — distribuição do ar de processo',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Tipo': 'Anel aspersor perfurado (ring sparger)',
        'Diâmetro do anel': `${n2(g.sparger.diamAnel)} m (≈ 0,8 × D imp.)`,
        'Furos': `${g.sparger.nFuros}`,
        'Elevação': `${n2(g.sparger.altura)} m acima da LT inf.`,
        'Posição': 'Abaixo do 1º impelidor',
        'Vazão de ar': '5 800 Nm³/h',
      },
    }],
  }));

  raiz.add(internos);
  camadas.internos = internos;

  /* --------------------------------------------------------------------
   * 4. AGITACAO
   * ------------------------------------------------------------------ */
  const agit = criarAgitador(g.agitador, v.topoY, 0.28);
  marcar(agit, {
    titulo: 'Sistema de agitação',
    subtitulo: g.agitador.tipo,
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Tipo de impelidor': g.agitador.tipo,
        'Material': g.agitador.material,
        'Nº de impelidores': `${g.agitador.nImpelidores}`,
        'Diâmetro do impelidor': `${n2(g.agitador.Dimp)} m (≈ D/3)`,
        'Rotação': `${g.agitador.rotacao} rpm`,
        'Potência do motor': `${g.agitador.potencia} kW`,
        'Potência específica': `≈ ${n1((g.agitador.potencia * 0.7) / g.volumeUtil)} kW/m³`,
        'Diâmetro do eixo': `${(g.agitador.diamEixo * 1000).toFixed(0)} mm`,
        'Selagem': 'Selo mecânico duplo pressurizado',
      },
    }],
  });
  raiz.add(agit);
  camadas.agitador = agit;

  /* --------------------------------------------------------------------
   * 5. BOCAIS  (gerados a partir da tabela de plant.js)
   * ------------------------------------------------------------------ */
  const bocais = new THREE.Group();
  bocais.name = 'camada-bocais';
  const ancoras = {};

  for (const b of R01.bocais) {
    const ehVisita = b.dn >= 500;
    let pos, dir, comp;

    if (b.face === 'lateral') {
      const a = rad(b.ang);
      const rIni = v.R - 0.06;
      const rFim = v.R + g.isolamento + (ehVisita ? 0.22 : 0.16);
      comp = rFim - rIni;
      pos = new THREE.Vector3(Math.cos(a) * rIni, b.y, Math.sin(a) * rIni);
      dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    } else if (b.face === 'topo') {
      const a = rad(b.ang);
      const r = b.r ?? 0;
      const ySup = v.topoY - v.hTopo + alturaNoRaio(g.tampoTopo, v.R, r) + (g.abaReta ?? 0);
      comp = 0.06 + g.isolamento + 0.24;
      pos = new THREE.Vector3(Math.cos(a) * r, ySup - 0.06, Math.sin(a) * r);
      dir = new THREE.Vector3(0, 1, 0);
    } else {
      const a = rad(b.ang);
      const r = b.r ?? 0;
      const yInf = v.fundoY + v.hFundo - alturaNoRaio(g.tampoFundo, v.R, r) - (g.abaReta ?? 0);
      comp = 0.06 + g.isolamento + 0.24;
      pos = new THREE.Vector3(Math.cos(a) * r, yInf + 0.06, Math.sin(a) * r);
      dir = new THREE.Vector3(0, -1, 0);
    }

    const n = criarBocal({ dn: b.dn, comprimento: comp, visor: ehVisita });
    orientarPara(n, pos, dir);

    const corrente = R01.correntes.find((c) => c.bocal === b.id);
    marcar(n, {
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
            'Vazão': corrente.vazao,
            'Temperatura': corrente.T,
            'Pressão': corrente.P,
          },
        }] : []),
      ],
    });
    bocais.add(n);

    // Ancora da linha: face do flange e direcao de saida. E daqui que a
    // tubulacao parte, entao ela nunca "flutua" perto do bocal.
    ancoras[b.id] = {
      pos: pos.clone().addScaledVector(dir, comp + DN[b.dn].esp + 0.01),
      dir: dir.clone(),
      dn: b.dn,
    };

    const lbl = rotulo(b.id, 'bocal-label');
    lbl.position.copy(pos).addScaledVector(dir, comp + 0.14);
    rotulos.add(lbl);
  }

  raiz.add(bocais);
  raiz.add(rotulos);
  camadas.rotulos = rotulos;

  /* --------------------------------------------------------------------
   * 6. SUPORTACAO E ACESSO
   * ------------------------------------------------------------------ */
  const estrutura = new THREE.Group();
  estrutura.name = 'camada-estrutura';

  estrutura.add(marcar(criarSaia(g, v.R), {
    titulo: 'Saia de sustentação',
    subtitulo: 'Suporte cilíndrico soldado ao tampo inferior',
    grupos: [{
      nome: 'Especificação',
      dados: {
        'Altura': `${n2(g.saiaAltura)} m`,
        'Espessura': `${(g.saiaEspessura * 1000).toFixed(0)} mm`,
        'Material': 'SA-516 Gr. 70 (estimado)',
        'Chumbadores': '12 × M36 (estimado)',
        'Acessos': 'Abertura de inspeção + 4 respiros',
      },
    }],
  }));

  estrutura.add(criarFundacao(g));

  /* A plataforma e refeita quando a tubulacao fica pronta: as linhas que a
   * atravessam (a saida da camisa, o vapor de topo e o reciclo, que correm
   * colados ao costado) pedem um furo no piso cada uma — `furarPlataforma`,
   * chamado de main.js com os angulos medidos nas rotas. */
  function montarPlataforma(furos = []) {
    const pl = criarPlataforma(
      g.plataforma, v.R + g.isolamento, g.escada.angulos, furos, g.escada.largura, v.R,
    );
    return marcar(pl, {
      titulo: 'Plataforma de operação',
      subtitulo: 'Acesso à boca de visita e instrumentos',
      grupos: [{
        nome: 'Especificação',
        dados: {
          'Elevação (LT inf.)': `${n2(g.plataforma.elevacao)} m`,
          'Elevação (piso)': `${n2(g.plataforma.elevacao + g.saiaAltura)} m`,
          'Largura': `${n2(g.plataforma.largura)} m`,
          'Piso': 'Grade de aço galvanizado',
          'Guarda-corpo': `${(g.plataforma.guardaCorpo * 1000).toFixed(0)} mm com rodapé`,
          ...(furos.length ? { 'Passagens de tubo no piso': String(furos.length) } : {}),
        },
      }],
    });
  }
  let plat = montarPlataforma();
  estrutura.add(plat);

  // Uma escada por angulo: a segunda e a rota de fuga alternativa.
  g.escada.angulos.forEach((angulo, i) => {
    estrutura.add(marcar(criarEscada({
      yBase: -g.saiaAltura,
      yTopo: g.plataforma.elevacao + 0.05,
      raio: v.R + g.isolamento + g.plataforma.largura + 0.05,
      angulo,
      largura: g.escada.largura,
      // presa na borda da plataforma (raio externo da grade) e no isolamento
      fixarEm: v.R + g.isolamento + 0.02 + g.plataforma.largura,
      costado: v.R + g.isolamento,
    }), {
      titulo: `Escada de marinheiro ${i + 1} de ${g.escada.angulos.length}`,
      subtitulo: 'Acesso vertical com gaiola de segurança',
      grupos: [{
        nome: 'Especificação',
        dados: {
          'Altura vencida': `${n2(g.plataforma.elevacao + 0.05 + g.saiaAltura)} m`,
          'Largura': `${(g.escada.largura * 1000).toFixed(0)} mm`,
          'Espaçamento dos degraus': '300 mm',
          'Gaiola': 'A partir de 2,20 m do piso (NR-12)',
          'Posição': `${angulo}°`,
          'Rotas de fuga da plataforma': String(g.escada.angulos.length),
        },
      }],
    }));
  });

  raiz.add(estrutura);
  camadas.estrutura = estrutura;

  /* --------------------------------------------------------------------
   * 7. ESCALA HUMANA
   * ------------------------------------------------------------------ */
  const escala = new THREE.Group();
  escala.name = 'camada-escala';
  const op = criarOperador();
  op.position.set(3.0, -g.saiaAltura, 1.8);
  op.rotation.y = -Math.PI * 0.7;
  escala.add(op);
  raiz.add(escala);
  camadas.escala = escala;

  /* --------------------------------------------------------------------
   * 8. TAG DO EQUIPAMENTO
   * ------------------------------------------------------------------ */
  const grupoTag = new THREE.Group();
  const tag = rotulo(R01.tag, 'tag-label');
  tag.position.set(0, v.topoY + 2.6, 0);
  grupoTag.add(tag);
  raiz.add(grupoTag);
  camadas.tag = grupoTag;

  /* --------------------------------------------------------------------
   * Posiciona o conjunto: piso acabado em y = 0 no mundo.
   * ------------------------------------------------------------------ */
  raiz.position.y = g.saiaAltura;

  return {
    grupo: raiz,
    camadas,
    nivel,
    alturaTotal: v.topoY + g.saiaAltura,
    raio: v.R + g.isolamento,
    ancoras,
    fichaPadrao: v.mesh.userData.ficha,
    /* Piso da plataforma (cota no mundo) e anel que ele ocupa, para quem
     * mede onde a tubulacao o atravessa. */
    plataforma: {
      y: g.plataforma.elevacao + g.saiaAltura,
      r1: v.R + g.isolamento + 0.02,
      r2: v.R + g.isolamento + 0.02 + g.plataforma.largura,
    },
    furarPlataforma(angulos) {
      estrutura.remove(plat);
      plat = montarPlataforma(angulos);
      estrutura.add(plat);
    },
  };
}
