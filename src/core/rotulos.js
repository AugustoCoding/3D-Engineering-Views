import * as THREE from 'three';

/**
 * ===========================================================================
 *  ETIQUETAS — ESCALA, NIVEL DE DETALHE E DESEMPILHAMENTO
 * ===========================================================================
 *
 *  Uma etiqueta CSS2D e um <div>: tem o MESMO tamanho em pixels a 3 m ou a
 *  80 m. Otimo para ler de perto, desastroso de longe — ao afastar a camera o
 *  equipamento encolhe, a etiqueta nao, e a planta desaparece atras de um
 *  amontoado de retangulos. Era exatamente o que acontecia no enquadramento
 *  inicial: 75 etiquetas de tamanho fixo sobre uma planta de 43 m vista de 55 m.
 *
 *  Tres mecanismos, recalculados a cada quadro:
 *
 *  1. ESCALA POR DISTANCIA.  escala = (dRef / d) ^ expoente, travada entre um
 *     piso e 1. Com expoente 1 a etiqueta seguiria a perspectiva exata —
 *     encolheria na mesma proporcao que o equipamento. Com 0,65 ela encolhe um
 *     pouco menos: o suficiente para continuar legivel, longe o bastante de
 *     "crescer" em relacao ao modelo. O piso impede que vire um borrao.
 *
 *  2. NIVEL DE DETALHE.  Cada classe tem um alcance proprio, e a ordem e a
 *     mesma de uma planta baixa: identificacao de bocal so existe de perto (de
 *     longe o proprio bocal nao se ve), numero de linha a media distancia, TAG
 *     do equipamento sempre. Perto do limite a etiqueta some por opacidade, e
 *     nao de estalo.
 *
 *  3. DESEMPILHAMENTO EM ESPACO DE TELA.  Do mais importante e mais proximo
 *     para o mais distante, guardando os retangulos ja ocupados; quem colide
 *     com um retangulo ja posto e apagado. E o que garante que sobre UMA
 *     etiqueta por regiao da tela em vez de uma pilha.
 *
 *  4. OCLUSAO.  Etiqueta CSS2D nao tem profundidade: a TAG de um equipamento no
 *     fundo da planta era desenhada por cima do vaso que esta na frente dele.
 *     Um raio da camera ate a ancora diz se ha algo solido no caminho —
 *     equipamento, predio, tanque, torre; se houver, a etiqueta some (pela
 *     transicao de opacidade, sem estalo). Antes ela ia a 30 %, mas a planta
 *     cresceu: de longe, as TAGs da laje vazavam atraves dos predios.
 *
 *     O raio testa UMA CAIXA por equipamento, nao as 870 malhas da planta.
 *     Nao e so questao de custo (era ~0,3 ms por raio, e virou desprezivel): a
 *     malha fina e instavel para esta pergunta. Um raio que passa raspando num
 *     balaustre de guarda-corpo ou num degrau de escada acenderia e apagaria a
 *     TAG inteira a cada quadro — de novo o piscar que se quer eliminar. A
 *     caixa responde a pergunta certa, que e "tem equipamento na frente?".
 *
 *  ESTABILIDADE.  Duas etiquetas a distancias quase iguais trocariam de vez a
 *  cada quadro e piscariam. Duas defesas: quem estava visivel entra na
 *  ordenacao com 15 % de vantagem (histerese), e toda troca passa por uma
 *  transicao de opacidade no CSS. Nada liga ou desliga de estalo.
 */

/**
 * dRef      distancia (m) em que a etiqueta ainda aparece em tamanho cheio
 * expoente  0 = tamanho fixo (o problema antigo); 1 = encolhe como o modelo
 * min       piso da escala, abaixo do qual o texto deixaria de ser legivel
 * dMax      alcance: alem disso a etiqueta nao existe
 * folga     margem em pixels somada ao retangulo no teste de colisao
 */
const NIVEIS = {
  /* Implantacao: so existem na vista de planta, vista de 150 a 400 m. Alcance
   * longo e escala que quase nao encolhe; prioridade abaixo da TAG, para nao
   * esconder equipamento quando as duas disputam a mesma regiao da tela. */
  'zona-label':  { prioridade: 3.6, dRef: 160, expoente: 0.4, min: 0.7, dMax: 2000, folga: 6 },
  'dist-label':  { prioridade: 3.5, dRef: 160, expoente: 0.4, min: 0.7, dMax: 2000, folga: 4 },
  'tag-label':   { prioridade: 4, dRef: 42, expoente: 0.65, min: 0.55, dMax: 400, folga: 10 },
  'linha-num':   { prioridade: 3, dRef: 15, expoente: 0.80, min: 0.60, dMax: 48,  folga: 5 },
  'cota-label':  { prioridade: 2, dRef: 13, expoente: 0.80, min: 0.65, dMax: 38,  folga: 5 },
  'linha-label': { prioridade: 1, dRef: 13, expoente: 0.80, min: 0.60, dMax: 34,  folga: 5 },
  'bocal-label': { prioridade: 0, dRef: 8,  expoente: 0.85, min: 0.60, dMax: 20,  folga: 3 },
};
const PADRAO = NIVEIS['cota-label'];

/** Faixa de esmaecimento antes do alcance maximo, em metros. */
const FAIXA_FADE = 8;

/** Vantagem de quem ja estava visivel, na disputa por espaco de tela. */
const HISTERESE = 0.85;

/** Quanto sobra de uma etiqueta cuja ancora esta atras de outro equipamento. */
const ALFA_OCLUIDO = 0;                 // atras de algo solido: some

/** Raios de oclusao lancados por quadro. Em rodizio: 13 TAGs, ~2 quadros. */
const ORCAMENTO_RAIOS = 6;

/** Folga antes da ancora: o proprio equipamento nao pode se ocluir. */
const FOLGA_RAIO = 0.5;

/**
 * Camadas que NAO entram na caixa de oclusao.
 *
 * Sao as vazadas e as auxiliares. Plataforma, guarda-corpo e escada
 * (`camada-estrutura`) sao aco aberto: ve-se atraves delas, e no R-01 elas
 * levam a caixa de 2,2 m para 7,8 m de largura — com elas dentro, a TAG do
 * CP-01, que esta em campo aberto e perfeitamente visivel, era esmaecida como
 * se estivesse escondida atras do reator.
 */
const NAO_OCLUI = new Set([
  'camada-estrutura', 'camada-escala', 'camada-cotas', 'camada-rotulos',
]);

/** Piso acabado: datum do modelo (ver core/scene.js). */
const Y_PISO = 0;

const clamp = THREE.MathUtils.clamp;

/** Um objeto so conta como visivel se NENHUM ancestral estiver desligado. */
function ligado(obj) {
  for (let n = obj; n; n = n.parent) if (n.visible === false) return false;
  return true;
}

export function criarGerenciadorRotulos({ camera, container, camadaDOM, obstaculos = [] }) {
  const itens = [];
  const pos = new THREE.Vector3();
  const olho = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const vp = new THREE.Matrix4();
  const postos = [];
  const raio = new THREE.Ray();
  const toque = new THREE.Vector3();
  const caixas = [];                     // um proxy por equipamento
  let vez = 0;                           // cursor do rodizio de oclusao

  function ehDescendente(no, ancestral) {
    for (let n = no; n; n = n.parent) if (n === ancestral) return true;
    return false;
  }

  /**
   * Caixa envolvente do CORPO de cada equipamento, em coordenadas de mundo.
   *
   * Duas exclusoes deliberadas, ambas para nao esmaecer etiqueta que esta a
   * vista: as camadas de NAO_OCLUI (aco vazado e auxiliares), e tudo que nao
   * for malha — as cotas sao THREE.Line que se afastam ate 1 m da peca.
   *
   * Depois a caixa desce ate o piso: a saia fica em `camada-estrutura` e sai
   * junto com a plataforma, mas ela e macica e esta exatamente sob o vaso, com
   * o mesmo diametro. Baixar a base recupera essa oclusao sem herdar a largura
   * da plataforma.
   */
  function medirObstaculos() {
    caixas.length = 0;
    const daPeca = new THREE.Box3();

    for (const grupo of obstaculos) {
      grupo.updateWorldMatrix(true, true);
      const caixa = new THREE.Box3();

      (function percorrer(no) {
        if (NAO_OCLUI.has(no.name)) return;              // poda a subarvore
        if (no.isMesh) {
          if (!no.geometry.boundingBox) no.geometry.computeBoundingBox();
          caixa.union(daPeca.copy(no.geometry.boundingBox).applyMatrix4(no.matrixWorld));
        }
        for (const f of no.children) percorrer(f);
      }(grupo));

      if (caixa.isEmpty()) continue;
      caixa.min.y = Math.min(caixa.min.y, Y_PISO);
      caixas.push({ grupo, caixa });
    }
  }

  /** Varre a cena e registra toda etiqueta criada por lib/dimensions.js. */
  function sincronizar(raiz) {
    itens.length = 0;
    medirObstaculos();
    raiz.traverse((o) => {
      const info = o.isCSS2DObject ? o.userData.rotulo : null;
      if (!info) return;
      const nivel = NIVEIS[info.tipo] ?? PADRAO;
      // O CSS2DRenderer ordena o z-index por renderOrder antes da distancia:
      // com isto uma TAG nunca fica atras de uma identificacao de bocal.
      o.renderOrder = nivel.prioridade;
      itens.push({
        obj: o, nivel, corpo: info.corpo, externo: o.element, pintado: info.pintado ?? 0,
        // O proprio equipamento nomeado nunca conta como obstaculo da sua TAG.
        dono: caixas.find((c) => ehDescendente(o, c.grupo)) ?? null,
        larg: 0, alt: 0,
        escalaEscrita: -1, alfaEscrito: -1, mostrado: false,
        x: 0, y: 0, d: 0, escala: 1, alfa: 1, ocluido: false,
      });
    });
    return itens.length;
  }

  /**
   * Mede o chip UMA vez e guarda. offsetWidth force layout, entao so se le
   * enquanto o valor ainda nao existe — depois do primeiro quadro em que o
   * CSS2DRenderer insere o elemento no DOM, nunca mais.
   */
  function medido(r) {
    if (r.larg > 0) return true;
    const w = r.corpo.offsetWidth;
    if (w <= 0) return false;              // ainda fora do DOM
    r.larg = w;
    r.alt = r.corpo.offsetHeight;
    return true;
  }

  function apagar(r) {
    if (r.alfaEscrito !== 0) {
      r.externo.style.opacity = '0';
      r.alfaEscrito = 0;
    }
    r.mostrado = false;
  }

  function acender(r) {
    if (Math.abs(r.escala - r.escalaEscrita) > 0.008) {
      r.corpo.style.transform = `scale(${r.escala.toFixed(3)})`;
      r.escalaEscrita = r.escala;
    }
    if (Math.abs(r.alfa - r.alfaEscrito) > 0.01) {
      r.externo.style.opacity = r.alfa.toFixed(2);
      r.alfaEscrito = r.alfa;
    }
    r.mostrado = r.alfa > 0.05;
  }

  /**
   * Ha equipamento entre a camera e a ancora desta etiqueta?
   *
   * O alcance util do raio para FOLGA_RAIO antes da ancora — sem essa margem, a
   * caixa do equipamento vizinho encostada na ancora ja contaria. O equipamento
   * DONO da etiqueta fica de fora por construcao: a TAG do R-01 mora acima do
   * proprio R-01, e sem essa excecao ele ocluiria a si mesmo.
   *
   * `grupo.visible` e consultado a cada teste porque o corte em secao esconde
   * os equipamentos fora de foco: escondido nao pode continuar bloqueando.
   */
  function testarOclusao(r) {
    if (!caixas.length) { r.ocluido = false; return; }
    r.obj.getWorldPosition(pos);
    dir.subVectors(pos, olho);
    const dist = dir.length() - FOLGA_RAIO;
    if (dist <= 0) { r.ocluido = false; return; }
    raio.set(olho, dir.normalize());

    for (const c of caixas) {
      if (c === r.dono || !ligado(c.grupo)) continue;
      // intersectBox devolve o ponto de entrada, ou a origem se ela ja estiver
      // dentro da caixa; em ambos os casos so vale se vier ANTES da ancora.
      if (raio.intersectBox(c.caixa, toque) && olho.distanceTo(toque) < dist) {
        r.ocluido = true;
        return;
      }
    }
    r.ocluido = false;
  }

  const candidatos = [];

  function atualizar() {
    if (!itens.length) return;
    // Camada inteira desligada pela tecla L: nao ha o que calcular.
    if (camadaDOM?.classList.contains('oculto')) return;

    const W = container.clientWidth || 1;
    const H = container.clientHeight || 1;
    olho.setFromMatrixPosition(camera.matrixWorld);
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    /* ---- 1 e 2: quem sobrevive a distancia, e em que tamanho ---- */
    candidatos.length = 0;
    for (const r of itens) {
      const n = r.nivel;
      if (!ligado(r.obj)) { apagar(r); continue; }

      r.obj.getWorldPosition(pos);
      const d = pos.distanceTo(olho);
      if (d > n.dMax) { apagar(r); continue; }

      pos.applyMatrix4(vp);                                  // -> NDC
      if (pos.z < -1 || pos.z > 1) { apagar(r); continue; }  // atras da camera

      const x = (pos.x * 0.5 + 0.5) * W;
      const y = (-pos.y * 0.5 + 0.5) * H;
      if (x < -160 || x > W + 160 || y < -80 || y > H + 80) { apagar(r); continue; }

      r.d = d;
      r.x = x;
      r.y = y;
      r.escala = clamp(Math.pow(n.dRef / Math.max(d, 0.1), n.expoente), n.min, 1);
      r.alfa = clamp((n.dMax - d) / Math.min(FAIXA_FADE, n.dMax * 0.5), 0, 1);
      // TAG que esta pintada no costado: de perto le-se a tinta, e a etiqueta
      // so aparece de onde a letra pintada ja nao se le (equipment/pinturas.js)
      if (r.pintado) r.alfa *= clamp((d - r.pintado) / 6, 0, 1);
      if (r.alfa <= 0.01) { apagar(r); continue; }
      candidatos.push(r);
    }

    /* ---- 4: oclusao, so nas TAGs e em rodizio ---- */
    const tags = candidatos.filter((r) => r.nivel.prioridade === NIVEIS['tag-label'].prioridade);
    for (let i = 0; i < Math.min(ORCAMENTO_RAIOS, tags.length); i++) {
      testarOclusao(tags[(vez + i) % tags.length]);
    }
    vez = tags.length ? (vez + ORCAMENTO_RAIOS) % tags.length : 0;
    for (const r of tags) if (r.ocluido) r.alfa *= ALFA_OCLUIDO;

    /* ---- 3: desempilhamento ---- */
    // Prioridade da classe; depois distancia, com bonus de histerese para quem
    // ja estava na tela e penalidade para quem esta atras de um equipamento.
    const peso = (r) => r.d * (r.mostrado ? HISTERESE : 1) * (r.ocluido ? 2.5 : 1);
    candidatos.sort((a, b) => (
      b.nivel.prioridade - a.nivel.prioridade || peso(a) - peso(b)
    ));

    postos.length = 0;
    for (const r of candidatos) {
      // Antes da primeira medicao, estima pelo texto para nao deixar passar
      // uma etiqueta larga como se fosse pontual.
      const base = medido(r) ? r.larg : r.corpo.textContent.length * 7 + 16;
      const w = base * r.escala + r.nivel.folga;
      const h = (r.alt || 18) * r.escala + r.nivel.folga;

      let livre = true;
      for (const p of postos) {
        if (Math.abs(r.x - p.x) * 2 < w + p.w && Math.abs(r.y - p.y) * 2 < h + p.h) {
          livre = false;
          break;
        }
      }
      if (!livre) { apagar(r); continue; }

      postos.push({ x: r.x, y: r.y, w, h });
      acender(r);
    }
  }

  return { sincronizar, atualizar, get total() { return itens.length; } };
}
