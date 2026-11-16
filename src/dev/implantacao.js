/**
 * ===========================================================================
 *  AUDITORIA DE IMPLANTACAO
 * ===========================================================================
 *
 *  A planta baixa se aprova olhando, mas as distancias se aprovam medindo.
 *  Este modulo le src/data/site.js e responde, sem three.js (roda no Node
 *  tambem), as perguntas que o desenho precisa responder:
 *
 *    DISTANCIA     cada par da tabela DISTANCIAS, de borda a borda
 *    COSTADOS      espacamento entre tanques do parque (NFPA 30)
 *    BARLAVENTO    quem tem de ficar contra o vento de quem
 *    BOMBEIRO      blocos alcancados por via em pelo menos N lados
 *    CAMINHAO      rota de caminhao cruzando calcada ou area de pessoas
 *    LOTE          bloco fora da cerca sem ser declarado assim
 *    SOBREPOSICAO  bloco sobre bloco, ou via passando por dentro de bloco
 *    CALCADA       calcada correndo ou terminando na via, ou cortando bloco
 *    REDE          calcadas soltas umas das outras
 *    ALCANCE       bloco longe de calcada
 *    DESVIO        caminho a pe muito mais longo que a reta
 *    ONIBUS        rota do onibus fora da via, retorno apertado
 *    SOLTA         calcada ao lado da via sem encostar no meio-fio
 *    FILA          pouca fila antes da cancela de entrada
 *    CURVA         curva de via estreita ou fechada para o veiculo dela
 *    ESQUINA       raio de esquina que nao cabe ou invade bloco
 *    TRAVESSIA     travessia de pedestre dentro do arredondamento da esquina
 *
 *  No console: __auditarImplantacao(). No Node:
 *    node -e "import('./src/dev/implantacao.js').then(m => console.log(m.auditarImplantacao()))"
 */
import * as SITE from '../data/site.js';
import { auditarPedestres } from '../site/pedestres.js';
import {
  ret, centro, distRetRet, folgaLimite as folgaLimiteRet, distPontoSeg,
  segCruzaSeg, segEntraRet, segmentos, distRetVia, distRetSeg, dirPlana as SITE_dir, redeDePolilinhas,
  projetarNoSeg, distPontoRet, esquinasDasVias,
} from '../lib/plano.js';

/** Folga ate o limite, com o lote no formato de site.js. */
const folgaLimite = (r, lote) => folgaLimiteRet(r, ret(lote));

const f1 = (v) => v.toFixed(1).replace('.', ',');

/* ---------------------------------------------------------------- auditoria */
export function auditarImplantacao(site = SITE) {
  const { BLOCOS, VIAS, LOTE, DISTANCIAS, TANQUES, ESPACAMENTO_TANQUES, BARLAVENTO,
    ACESSO_BOMBEIRO, CALCADAS, ROTAS_CAMINHAO } = site;
  const achados = [];
  const medidas = [];
  const daCat = (c) => BLOCOS.filter((b) => b.categoria === c);

  // DISTANCIA
  for (const regra of DISTANCIAS) {
    let pior = null;
    for (const A of daCat(regra.a)) {
      const ra = ret(A);
      const alvos = regra.b === 'limite'
        ? [{ nome: 'limite do lote', medir: () => folgaLimite(ra, LOTE).d }]
        : regra.b.startsWith('via:')
          ? VIAS.filter((v) => v.tipo === regra.b.slice(4))
            .map((v) => ({ nome: `via ${v.id}`, medir: () => distRetVia(ra, v) }))
          : daCat(regra.b).map((B) => ({ nome: B.id, medir: () => distRetRet(ra, ret(B)) }));
      for (const alvo of alvos) {
        const d = alvo.medir();
        if (!pior || d < pior.d) pior = { d, de: A.id, para: alvo.nome };
      }
    }
    if (!pior) continue;
    const ok = pior.d + 1e-6 >= regra.min;
    medidas.push({ ...regra, medido: pior.d, de: pior.de, para: pior.para, ok });
    if (!ok) {
      achados.push({
        regra: 'DISTANCIA',
        detalhe: `${pior.de} ↔ ${pior.para}: ${f1(pior.d)} m, mínimo ${f1(regra.min)} m (${regra.fonte})`,
      });
    }
  }

  // COSTADOS
  for (let i = 0; i < TANQUES.length; i++) {
    for (let j = i + 1; j < TANQUES.length; j++) {
      const a = TANQUES[i], b = TANQUES[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z) - (a.D + b.D) / 2;
      const min = Math.max(ESPACAMENTO_TANQUES.minimo, ESPACAMENTO_TANQUES.fracao * (a.D + b.D));
      if (d < min) {
        achados.push({ regra: 'COSTADOS', detalhe: `${a.id} ↔ ${b.id}: ${f1(d)} m, mínimo ${f1(min)} m` });
      }
    }
  }
  const parque = BLOCOS.find((b) => b.categoria === 'tanques');
  if (parque) {
    const r = ret(parque);
    for (const t of TANQUES) {
      const R = t.D / 2;
      if (t.x - R < r.x0 || t.x + R > r.x1 || t.z - R < r.z0 || t.z + R > r.z1) {
        achados.push({ regra: 'COSTADOS', detalhe: `${t.id} sai da bacia de contenção` });
      }
    }
  }

  // BARLAVENTO
  const [vx, vz] = SITE.vetorBarlavento(site.VENTO.de);
  for (const regra of BARLAVENTO) {
    const deA = regra.so ? BLOCOS.filter((b) => b.id === regra.so) : daCat(regra.a);
    for (const A of deA) {
      const [ax, az] = centro(ret(A));
      for (const B of regra.b.flatMap(daCat)) {
        const [bx, bz] = centro(ret(B));
        if ((ax - bx) * vx + (az - bz) * vz <= 0) {
          achados.push({
            regra: 'BARLAVENTO',
            detalhe: `${A.id} não está a barlavento de ${B.id} (${regra.motivo})`,
          });
        }
      }
    }
  }

  // BOMBEIRO
  const viasInternas = VIAS.filter((v) => v.tipo !== 'publica');
  for (const B of ACESSO_BOMBEIRO.blocos.flatMap(daCat)) {
    const r = ret(B);
    const lados = {
      norte: [[r.x0, r.z0], [r.x1, r.z0]], sul: [[r.x0, r.z1], [r.x1, r.z1]],
      oeste: [[r.x0, r.z0], [r.x0, r.z1]], leste: [[r.x1, r.z0], [r.x1, r.z1]],
    };
    const servidos = Object.entries(lados).filter(([, [p, q]]) => {
      // amostra o lado: cada ponto precisa de via a ate `alcance` da borda
      let cobertos = 0;
      const N = 20;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        const perto = viasInternas.some((v) => segmentos(v.pontos)
          .some(([a, b]) => distPontoSeg(pt, a, b) - v.largura / 2 <= ACESSO_BOMBEIRO.alcance));
        if (perto) cobertos++;
      }
      return cobertos / (N + 1) >= 0.5;
    }).map(([lado]) => lado);
    medidas.push({ a: B.id, b: 'acesso de bombeiro', lados: servidos, ok: servidos.length >= ACESSO_BOMBEIRO.lados });
    if (servidos.length < ACESSO_BOMBEIRO.lados) {
      achados.push({
        regra: 'BOMBEIRO',
        detalhe: `${B.id}: acesso por ${servidos.length} lado(s) (${servidos.join(', ') || 'nenhum'}), mínimo ${ACESSO_BOMBEIRO.lados}`,
      });
    }
  }

  // CAMINHAO
  const areasPessoas = BLOCOS.filter((b) => ['ocupado', 'estacionamento', 'encontro'].includes(b.categoria));
  for (const rota of ROTAS_CAMINHAO) {
    for (const [p, q] of segmentos(rota.pontos)) {
      for (const c of CALCADAS) {
        for (const [a, b] of segmentos(c.pontos)) {
          if (segCruzaSeg(p, q, a, b)) {
            achados.push({ regra: 'CAMINHAO', detalhe: `rota ${rota.id} cruza a calçada ${c.id}` });
          }
        }
      }
      for (const A of areasPessoas) {
        if (segEntraRet(p, q, ret(A))) {
          achados.push({ regra: 'CAMINHAO', detalhe: `rota ${rota.id} passa por ${A.id}` });
        }
      }
    }
  }

  // LOTE
  const lote = { x0: LOTE.x[0], x1: LOTE.x[1], z0: LOTE.z[0], z1: LOTE.z[1] };
  for (const B of BLOCOS) {
    const r = ret(B);
    const dentro = r.x0 >= lote.x0 && r.x1 <= lote.x1 && r.z0 >= lote.z0 && r.z1 <= lote.z1;
    // a portaria fica na linha da cerca de proposito (naDivisa)
    if (!dentro && !B.foraDoLote && !B.naDivisa) achados.push({ regra: 'LOTE', detalhe: `${B.id} sai do lote` });
  }

  // SOBREPOSICAO — a faixa verde e atravessada de proposito por via e calcada
  const solidos = BLOCOS.filter((b) => b.categoria !== 'verde');
  for (let i = 0; i < solidos.length; i++) {
    for (let j = i + 1; j < solidos.length; j++) {
      const a = ret(solidos[i]), b = ret(solidos[j]);
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) {
        achados.push({ regra: 'SOBREPOSICAO', detalhe: `${solidos[i].id} sobre ${solidos[j].id}` });
      }
    }
  }
  // no estacionamento o carro anda por dentro (o corredor das vagas): a via
  // de acesso entra nele ate depois da calcada que cruza a entrada, para o
  // cruzamento ser travessia (Fase 28)
  for (const v of VIAS) {
    for (const B of solidos.filter((b) => b.categoria !== 'estacionamento')) {
      const r = ret(B);
      const h = v.largura / 2;
      /* A faixa da via e o eixo com meia largura para os LADOS. Engordar o
       * bloco nas duas direcoes acusava a via que so termina encostada nele —
       * que e exatamente o acesso a um bloco (ETE, doca, descarga). */
      const invade = segmentos(v.pontos).some(([p, q]) => {
        const emX = Math.abs(q[0] - p[0]) >= Math.abs(q[1] - p[1]);
        const gordo = emX
          ? { x0: r.x0, x1: r.x1, z0: r.z0 - h, z1: r.z1 + h }
          : { x0: r.x0 - h, x1: r.x1 + h, z0: r.z0, z1: r.z1 };
        return segEntraRet(p, q, gordo, 0.01);
      });
      if (invade) achados.push({ regra: 'SOBREPOSICAO', detalhe: `via ${v.id} passa por ${B.id}` });
    }
  }

  /* CALCADA — a calcada cruza via, nunca corre nela nem termina nela, e nao
   * passa por dentro de bloco (a faixa verde se atravessa). Correr na via e
   * a faixa da calcada sobrepor a da via com as duas a menos de 60° uma da
   * outra; cruzar e o resto, e ali o entorno pinta a faixa de pedestre. */
  const R = site.REDE_PEDESTRE;
  const meiaC = R.largura / 2;
  for (const c of CALCADAS) {
    for (const [a, b] of segmentos(c.pontos)) {
      const dc = SITE_dir(a, b);
      for (const v of VIAS) {
        const corre = segmentos(v.pontos).some(([p, q]) => {
          const dv = SITE_dir(p, q);
          if (Math.abs(dc[0] * dv[0] + dc[1] * dv[1]) < 0.5) return false;
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let s = 0; s <= L; s += 0.5) {
            const pt = [a[0] + dc[0] * s, a[1] + dc[1] * s];
            if (distPontoSeg(pt, p, q) < v.largura / 2 + meiaC - 0.01) return true;
          }
          return false;
        });
        if (corre) achados.push({ regra: 'CALCADA', detalhe: `calçada ${c.id} corre na via ${v.id}` });
      }
    }
    for (const pt of [c.pontos[0], c.pontos.at(-1)]) {
      for (const v of VIAS) {
        if (segmentos(v.pontos).some(([p, q]) => distPontoSeg(pt, p, q) < v.largura / 2 - 0.01)) {
          achados.push({ regra: 'CALCADA', detalhe: `calçada ${c.id} termina dentro da via ${v.id}` });
        }
      }
    }
    for (const B of BLOCOS.filter((b) => !(R.blocosDePassagem ?? ['verde']).includes(b.categoria))) {
      if (segmentos(c.pontos).some(([p, q]) => segEntraRet(p, q, ret(B), 0.01))) {
        achados.push({ regra: 'CALCADA', detalhe: `calçada ${c.id} passa por dentro de ${B.id}` });
      }
    }
  }

  // REDE — uma rede so, contando a laje como ligacao entre as calcadas dela
  const conectores = R.conectores.map((id) => ret(BLOCOS.find((b) => b.id === id)));
  const rede = redeDePolilinhas(CALCADAS, { conectores });
  const comps = rede.componentes();
  if (comps.length > 1) {
    achados.push({ regra: 'REDE', detalhe: `${comps.length} redes de calçada soltas: ${comps.map((l) => l.join('+')).join(' | ')}` });
  }

  // ALCANCE — cada bloco a ate `alcance` m da borda de alguma calcada
  for (const B of BLOCOS.filter((b) => R.categorias.includes(b.categoria))) {
    const r = ret(B);
    const d = Math.min(...CALCADAS.flatMap((c) => segmentos(c.pontos).map(([p, q]) => distRetSeg(r, p, q)))) - meiaC;
    if (d > R.alcance) {
      achados.push({ regra: 'ALCANCE', detalhe: `${B.id} a ${f1(d)} m da calçada mais perto (máx. ${f1(R.alcance)})` });
    }
  }

  /* DESVIO — caminho pela calcada entre os pares, contra a reta. A "porta"
   * de um bloco e o meio do lado dele mais perto da rede — o mesmo criterio
   * com que site/entorno.js poe a porta dos predios. */
  const portas = (id) => {
    if (R.pontos?.[id]) return [R.pontos[id]];
    const r = ret(BLOCOS.find((b) => b.id === id));
    // a laje entra pelas rampas: os nos da rede encostados nela
    if (R.conectores.includes(id)) return rede.nos.filter((n) => distPontoRet(n.p, r) <= 1).map((n) => n.p);
    const [cx, cz] = centro(r);
    const meios = [[r.x0, cz], [r.x1, cz], [cx, r.z0], [cx, r.z1]].map((p) => ({ p, d: rede.entrar(p).d })).sort((x, y) => x.d - y.d);
    // bloco aberto entra-se por qualquer lado que tenha calcada perto (Fase
    // 28: com a volta do dique, o lado mais perto dos tanques virou a escada
    // oeste, do outro lado do parque); o par fica com o melhor deles
    const perto = meios.filter((m) => m.d <= R.alcance);
    return (perto.length ? perto : meios.slice(0, 1)).map((m) => m.p);
  };
  // com mais de uma porta possivel, o par passa se alguma combinacao passa
  // (a porta mais perto da laje encurta a reta mais do que o caminho)
  const passa = ({ total, reta }) => total <= R.fator * reta + 1e-6 || total - reta <= R.sobra;
  for (const [a, b] of R.pares) {
    let melhor = null;
    for (const pa of portas(a)) {
      for (const pb of portas(b)) {
        const { total } = rede.caminho(pa, pb);
        const m = { total, reta: Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) };
        if (!melhor || (passa(m) && !passa(melhor)) || (passa(m) === passa(melhor) && total < melhor.total)) melhor = m;
      }
    }
    const { total, reta } = melhor;
    const ok = passa(melhor);
    medidas.push({ a, b: `${b} a pé`, medido: total, reta, ok });
    if (!ok) {
      achados.push({ regra: 'DESVIO', detalhe: `${a} → ${b}: ${f1(total)} m pela calçada contra ${f1(reta)} m em linha reta` });
    }
  }

  /* ONIBUS — a rota inteira sobre via, o retorno no raio do veiculo de
   * projeto e nenhuma area de pessoas no caminho. */
  {
    const O = site.ONIBUS;
    const rr = O.retorno;
    const larguraDe = Object.fromEntries(VIAS.map((v) => [v.id, v.largura]));
    const largRet = larguraDe['retorno-onibus'] ?? rr.largura;
    if (rr.raio + largRet / 2 < O.veiculo.raioExterno + O.folga) {
      achados.push({ regra: 'ONIBUS', detalhe: `retorno com borda externa de ${f1(rr.raio + largRet / 2)} m; o ônibus pede ${f1(O.veiculo.raioExterno)} + ${f1(O.folga)} m (${site.FONTE_VEICULOS})` });
    }
    if (rr.raio - largRet / 2 > O.veiculo.raioInterno - O.folga) {
      achados.push({ regra: 'ONIBUS', detalhe: `ilha do retorno de ${f1(rr.raio - largRet / 2)} m; a roda interna passa a ${f1(O.veiculo.raioInterno)} m` });
    }
    let fora = 0;
    for (const [p, q] of segmentos(O.rota)) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let s = 0; s <= L; s += 0.5) {
        const pt = [p[0] + ((q[0] - p[0]) * s) / L, p[1] + ((q[1] - p[1]) * s) / L];
        const naVia = VIAS.some((v) => segmentos(v.pontos).some(([a, b]) => distPontoSeg(pt, a, b) <= v.largura / 2 + 0.01));
        if (!naVia && fora++ < 3) achados.push({ regra: 'ONIBUS', detalhe: `rota do ônibus fora da via em (${f1(pt[0])}; ${f1(pt[1])})` });
      }
      for (const A of areasPessoas) {
        if (segEntraRet(p, q, ret(A))) achados.push({ regra: 'ONIBUS', detalhe: `rota do ônibus passa por ${A.id}` });
      }
    }
  }

  /* SOLTA — calcada paralela a uma via, a menos de `solta` m dela, encosta
   * no meio-fio, como na cidade (o vao certo e so o meio-fio). Mede-se pela
   * via mais perto: a calcada da baia encosta na baia, nao na pista. */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  for (const c of CALCADAS) {
    for (const [a, b] of segmentos(c.pontos)) {
      // trecho que cruza a via e travessia, nao calcada ao lado dela
      if (VIAS.some((v) => !v.circulo && segmentos(v.pontos).some(([p, q]) => segCruzaSeg(a, b, p, q)))) continue;
      const dc = SITE_dir(a, b);
      let menor = null;
      for (const v of VIAS) {
        for (const [p, q] of segmentos(v.pontos)) {
          const dv = SITE_dir(p, q);
          if (Math.abs(dot(dc, dv)) < 0.95) continue;
          const Lv = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const ta = dot([a[0] - p[0], a[1] - p[1]], dv), tb = dot([b[0] - p[0], b[1] - p[1]], dv);
          if (Math.min(Math.max(ta, tb), Lv) - Math.max(Math.min(ta, tb), 0) < 5) continue;
          const lat = Math.abs((a[0] - p[0]) * dv[1] - (a[1] - p[1]) * dv[0]);
          const vao = lat - v.largura / 2 - meiaC;
          if (!menor || vao < menor.vao) menor = { vao, via: v.id };
        }
      }
      if (menor && menor.vao > 0.3 && menor.vao < R.solta) {
        achados.push({ regra: 'SOLTA', detalhe: `calçada ${c.id} a ${f1(menor.vao)} m da via ${menor.via}: encosta no meio-fio ou se afasta` });
      }
    }
  }

  // FILA — da cancela de entrada para tras, pela pista, ate a faixa de desaceleracao
  const P = site.PRACA_PORTARIA;
  if (P) {
    const ent = VIAS.find((v) => v.id === 'entrada');
    const ca = P.cancelas.find((c) => c.pista === 'entrada');
    const alvo = [ca.x + (ca.sentido * ca.comprimento) / 2, ca.z];
    let acum = 0, fila = null;
    for (const [p, q] of segmentos(ent.pontos)) {
      const { p: pe } = projetarNoSeg(alvo, p, q);
      if (Math.hypot(pe[0] - alvo[0], pe[1] - alvo[1]) < 0.5) { fila = acum + Math.hypot(pe[0] - p[0], pe[1] - p[1]); break; }
      acum += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    medidas.push({ a: 'cancela de entrada', b: 'fila até a via pública', medido: fila, ok: fila >= P.fila });
    if (fila == null || fila < P.fila) {
      achados.push({ regra: 'FILA', detalhe: `cabem ${f1(fila ?? 0)} m de fila antes da cancela; pede ${f1(P.fila)} m` });
    }
  }

  /* CURVA — na via que faz curva (`curva` nos dados), a pista comporta o
   * veiculo dela: a largura varrida e a do veiculo mais o arraste da roda
   * traseira, L²/2R [ESTIMADO, formula simplificada de veiculo rigido], e a
   * borda externa passa do raio externo minimo dele. */
  const V = site.VEICULOS;
  for (const v of VIAS.filter((q) => q.curva)) {
    const ve = V[v.veiculo ?? 'caminhao'];
    const varre = ve.largura + ve.entreEixos ** 2 / (2 * v.curva.raio);
    medidas.push({ a: v.id, b: `curva de ${f1(v.curva.raio)} m`, medido: varre, ok: varre <= v.largura });
    if (varre > v.largura + 1e-6) {
      achados.push({ regra: 'CURVA', detalhe: `${v.id}: o ${ve.nome} varre ${f1(varre)} m na curva de ${f1(v.curva.raio)} m; a pista tem ${f1(v.largura)} m` });
    }
    if (v.curva.raio + v.largura / 2 < ve.raioExterno) {
      achados.push({ regra: 'CURVA', detalhe: `${v.id}: borda externa a ${f1(v.curva.raio + v.largura / 2)} m; o ${ve.nome} pede ${f1(ve.raioExterno)} m (${site.FONTE_VEICULOS})` });
    }
  }

  /* ESQUINA — toda esquina de via ganha meio-fio arredondado (Fase 14), com
   * o raio do menor veiculo que faz a curva ali. Aqui se mede se o raio
   * cabe: a via tem comprimento para a curva dos dois lados, e a pista nova
   * do arredondamento nao invade bloco. Esquina e o canto concavo entre a
   * ponta de uma via e a lateral de outra (T) e o canto de dentro de uma
   * via que vira 90°; o canto que ja tem outra pista dentro nao e esquina. */
  const solidosEsq = BLOCOS.filter((b) => b.categoria !== 'verde');
  const esquinas = esquinasDasVias(VIAS, site);
  for (const k of esquinas) {
    if (k.livre1 < k.r - 1e-6 || k.livre2 < k.r - 1e-6) {
      achados.push({ regra: 'ESQUINA', detalhe: `${k.nome}: raio de ${f1(k.r)} m não cabe (${f1(Math.min(k.livre1, k.livre2))} m de via) em (${f1(k.c[0])}; ${f1(k.c[1])})` });
    }
    const inv = solidosEsq.find((b) => k.regiao.some(([x, z]) => x > b.x[0] + 0.05 && x < b.x[1] - 0.05 && z > b.z[0] + 0.05 && z < b.z[1] - 0.05));
    if (inv) achados.push({ regra: 'ESQUINA', detalhe: `${k.nome}: o arredondamento de ${f1(k.r)} m invade ${inv.id}` });
  }
  medidas.push({ a: 'esquinas arredondáveis', b: 'medidas', medido: esquinas.length, ok: true });

  /* TRAVESSIA — onde a calcada cruza a via (travessia elevada, Fase 14).
   * Fica fora do arredondamento das esquinas: dentro dele a travessia
   * cresceria sobre a pista nova e o pedestre atravessaria na curva. */
  const naEsquina = (pt) => esquinas.some((k) => {
    const i = (pt[0] - k.c[0]) * k.u1[0] + (pt[1] - k.c[1]) * k.u1[1];
    const j = (pt[0] - k.c[0]) * k.u2[0] + (pt[1] - k.c[1]) * k.u2[1];
    if (i <= 0 || j <= 0 || i >= k.r || j >= k.r) return false;
    return Math.hypot(i - k.r, j - k.r) > k.r;
  });
  let nTrav = 0;
  for (const c of CALCADAS) for (const [a, b] of segmentos(c.pontos)) {
    for (const v of VIAS) for (const [p, q] of segmentos(v.pontos)) {
      if (!segCruzaSeg(a, b, p, q)) continue;
      nTrav++;
      // a faixa da travessia: o trecho da calcada sobre a via e as duas pontas
      const d = SITE_dir(a, b);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const qp = [q[0] - p[0], q[1] - p[1]];
      const meio = ((p[0] - a[0]) * qp[1] - (p[1] - a[1]) * qp[0]) / (d[0] * qp[1] - d[1] * qp[0]);
      const alcance = v.largura / 2 + R.largura;
      const amostras = [];
      for (let s = Math.max(0, meio - alcance); s <= Math.min(L, meio + alcance); s += 0.25) {
        for (const w of [-meiaC, 0, meiaC]) amostras.push([a[0] + d[0] * s - d[1] * w, a[1] + d[1] * s + d[0] * w]);
      }
      if (amostras.some(naEsquina)) {
        achados.push({ regra: 'TRAVESSIA', detalhe: `calçada ${c.id} atravessa a via ${v.id} dentro do arredondamento de uma esquina` });
      }
    }
  }
  medidas.push({ a: 'travessias elevadas', b: 'contagem', medido: nTrav, ok: true });

  /* PEDESTRE_* — a rede de pedestres da Fase 28 (site/pedestres.js): os
   * destinos de verdade (portas, catracas, abrigo, rampas da laje, escadas
   * do dique, blocos de utilidade, encontros), todos a partir da catraca,
   * do onibus e do estacionamento; calcada so cruza via na travessia e
   * ponta solta conta. O par a par de cima fica (DESVIO e ALCANCE). So na
   * implantacao do repositorio: a rede le os dados dele, nao `site`. */
  if (site === SITE) {
    for (const a of auditarPedestres().achados) achados.push({ regra: `PEDESTRE_${a.regra}`, detalhe: a.detalhe });
  }

  const porRegra = {};
  for (const a of achados) (porRegra[a.regra] ??= []).push(a);
  return { total: achados.length, porRegra, achados, medidas, esquinas: esquinas.map(({ regiao, ...k }) => k) };
}
