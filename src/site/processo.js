import * as THREE from 'three';
import { BLOCOS } from '../data/site.js';
import { ARRANJO, GUINDASTE, CONTENCAO, ACESSO, RACK, faixaSaque, corredoresDaLaje } from '../data/arranjo.js';
import { EXTRAS } from '../data/plant-extra.js';
import { ret, centro } from '../lib/plano.js';
import { mureta, grelha, contorno, setaPlana, placa, Y, materialChao } from '../lib/terreno.js';
import { rotulo } from '../lib/dimensions.js';

/**
 * ===========================================================================
 *  AREA DE PROCESSO — o que a laje tem alem dos equipamentos (Fase 4)
 * ===========================================================================
 *  Mureta de contencao com rampas, caixa coletora e a area de guindaste
 *  pintada no piso: isso fica sempre na cena, porque existe na obra.
 *  As faixas de saque, o caimento e as etiquetas sao informacao de projeto:
 *  ficam no grupo `planta`, ligado so na vista de planta.
 */
const Y_PINTURA = 0.03;            // pintura no piso: acima da laje (y = 0)

export function criarAreaProcesso() {
  const grupo = new THREE.Group();
  grupo.name = 'area-processo';
  const planta = new THREE.Group();
  planta.name = 'rotulos-planta-processo';
  grupo.add(planta);

  const isbl = ret(BLOCOS.find((b) => b.id === 'ISBL'));

  // --- contencao ---
  const m = mureta(isbl, { ...CONTENCAO.mureta, rampas: CONTENCAO.rampas });
  m.userData.ficha = {
    titulo: 'Mureta de contenção',
    subtitulo: 'Retém derrame na laje e o leva à caixa coletora',
    grupos: [{
      nome: 'Especificação (adotado)',
      dados: {
        'Altura': `${(CONTENCAO.mureta.altura * 100).toFixed(0)} cm`,
        'Volume retido': '≈ 270 m³ (maior vaso: CR-01, 74,6 m³)',
        'Rampas': CONTENCAO.rampas.map((r) => `${r.lado} (${r.motivo})`).join(' · '),
        'Caimento': `${(CONTENCAO.caimento * 100).toFixed(1).replace('.', ',')} % para a caixa coletora`,
      },
    }],
  };
  grupo.add(m);

  // --- corredores pintados no piso (Fase 12) ---
  // De pedestre: piso verde com borda amarela; o do rack, por onde passa o
  // veiculo de manutencao, so com a borda amarela. Amarelo para delimitar
  // circulacao (NBR 7195 / NR-26 — a confirmar). Topo a 1,5 e 2,5 cm da laje:
  // mais rente, a 50 m da camera a tinta e a laje disputam a profundidade.
  const VERDE = 0x4a8a5c, AMARELO = 0xf2c230, LINHA = 0.1;
  const pintura = new THREE.Group();
  pintura.name = 'corredores';
  // e deslocamento de profundidade (polygonOffset): a tinta ganha sempre da
  // laje e o amarelo do verde, a qualquer distancia
  const tintaVerde = materialChao(VERDE, null, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const tintaAmarela = materialChao(AMARELO, null, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const fita = (x0, x1, z0, z1) => pintura.add(placa({ x0, x1, z0, z1 }, 0.025, tintaAmarela, 0.008));
  for (const c of corredoresDaLaje()) {
    if (c.tipo !== 'rack') pintura.add(placa(c, 0.015, tintaVerde, 0.01));
    if (c.tipo === 'rack') {
      fita(c.x0, c.x1, c.z0, c.z0 + LINHA);
      fita(c.x0, c.x1, c.z1 - LINHA, c.z1);
    } else if (c.tipo === 'transversal') {
      fita(c.x0, c.x0 + LINHA, c.z0, c.z1);
      fita(c.x1 - LINHA, c.x1, c.z0, c.z1);
    } else {
      // perimetro: so a borda de dentro (a de fora e a mureta)
      const fino = c.x1 - c.x0 < c.z1 - c.z0;
      const dentroX = c.x0 === isbl.x0 ? c.x1 - LINHA : c.x0;
      const dentroZ = c.z0 === isbl.z0 ? c.z1 - LINHA : c.z0;
      if (fino) fita(dentroX, dentroX + LINHA, c.z0, c.z1);
      else fita(c.x0, c.x1, dentroZ, dentroZ + LINHA);
    }
  }
  pintura.userData.ficha = {
    titulo: 'Corredores pintados',
    subtitulo: 'Circulação segura entre os equipamentos',
    grupos: [{ nome: 'Regras (adotado)', dados: {
      'Corredor sob o rack': `${String(ACESSO.corredorRack).replace('.', ',')} m livres — empilhadeira, carrinho de bomba e maca`,
      'Transversais': `${String(ACESSO.corredor).replace('.', ',')} m, a cada ${ACESSO.trechoMax} m de equipamento no máximo`,
      'Faixa do perímetro': `${String(ACESSO.perimetro).replace('.', ',')} m junto da mureta`,
      'Pé-direito livre': `${String(ACESSO.peDireito).replace('.', ',')} m sobre o corredor`,
    } }],
  };
  grupo.add(pintura);

  const cx = CONTENCAO.caixa;
  const caixa = grelha(cx);
  caixa.userData.ficha = {
    titulo: 'Caixa coletora',
    subtitulo: 'Recebe a drenagem da laje e a envia à ETE',
    grupos: [{ nome: 'Especificação (adotado)', dados: { 'Grelha': `${cx.lado} × ${cx.lado} m`, 'Destino': 'Tratamento de efluentes (oeste)' } }],
  };
  grupo.add(caixa);

  // --- area de guindaste, pintada no piso (na via do anel, desde a Fase 11) ---
  const gz = { x0: GUINDASTE.x[0], x1: GUINDASTE.x[1], z0: GUINDASTE.z[0], z1: GUINDASTE.z[1] };
  grupo.add(contorno(gz, GUINDASTE.naVia ? Y.via + 0.03 : Y_PINTURA, 0xffc247, { hachura: 1.5 }));
  const [gcx, gcz] = centro(gz);
  const lblG = rotulo(`Área de guindaste (${GUINDASTE.atende})`, 'zona-label zona-carga');
  lblG.position.set(gcx, 1.5, gcz);
  planta.add(lblG);

  // --- so na planta: faixas de saque dos trocadores ---
  for (const item of ARRANJO.filter((a) => a.saque)) {
    const f = faixaSaque(item, EXTRAS[item.tag].geom);
    planta.add(contorno(f, 0.06, 0x7cc4ff));
    const [fx, fz] = centro(f);
    const lbl = rotulo(`saque ${item.tag}`, 'dist-label');
    lbl.position.set(fx, 1.0, fz);
    planta.add(lbl);
  }

  // --- so na planta: caimento para a caixa coletora ---
  // Saem da faixa do perimetro (piso livre, sem equipamento por cima) e do
  // corredor do rack, que e o caminho baixo ate a caixa.
  const meioX = (isbl.x0 + isbl.x1) / 2;
  const pf = ACESSO.perimetro / 2;
  const partidas = [
    [isbl.x1 - 3, isbl.z0 + pf], [meioX, isbl.z0 + pf], [isbl.x1 - 3, isbl.z1 - pf],
    [meioX, isbl.z1 - pf], [isbl.x1 - 3, RACK.z], [meioX, RACK.z],
  ];
  for (const [x, z] of partidas) {
    const dx = cx.x - x, dz = cx.z - z;
    const n = Math.hypot(dx, dz);
    planta.add(setaPlana({ x, z, dx: dx / n, dz: dz / n, comprimento: 5, largura: 0.7, y: 0.06, cor: 0x4fa6d0 }));
  }
  const lblC = rotulo('Caixa coletora → ETE', 'zona-label zona-efluentes');
  lblC.position.set(cx.x + 2, 1.2, cx.z + 2.5);
  planta.add(lblC);

  return { grupo, rotulosPlanta: planta };
}
