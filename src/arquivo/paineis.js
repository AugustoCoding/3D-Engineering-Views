/**
 * ===========================================================================
 *  ARQUIVO — paineis FICHA e EXIBICAO  (fora da maquete desde 16/11/2026)
 * ===========================================================================
 *  O autor tirou os dois paineis da maquete: a ficha tecnica do
 *  equipamento (com o croqui oficial) e o painel de exibicao (vistas, "ir
 *  para", camadas, corte em secao) nao servem a apresentacao. O codigo fica
 *  aqui, como estava em core/ui.js, para quem precisar deles de novo.
 *
 *  NINGUEM IMPORTA ESTE ARQUIVO: assim ele nao entra no HTML de entrega —
 *  nem ele nem os 680 kB de data/croquis.js, que so a ficha usava.
 *
 *  Para religar:
 *    1. em core/ui.js, depois de criar `barra`/`alternarPeca`:
 *         const P = criarPaineis(hud, opts);
 *         registrar('ficha', P.painel, 'Ficha', 'F');
 *         registrar('exibicao', P.controles, 'Exibição', 'Tab');
 *       trocar os tres `() => {}` (mostrarFicha, definirFaixaCorte,
 *       marcarCamada) pelos de P, e devolver F e Tab ao `keydown`;
 *    2. em main.js, voltar a importar CROQUIS/FONTE_CROQUIS de
 *       data/croquis.js, passar `croquis` e `fonteCroquis` ao criarUI e
 *       marcar `ficha.croqui = TAG` na arvore de cada equipamento (git log
 *       de 16/11/2026 mostra o trecho).
 *    3. as opcoes que o painel de exibicao recebia do main.js (`camadas`,
 *       `aoAlternar`, `aoCortar`, `corte`, `equipamentos`, `aoFocar`,
 *       `aoEnquadrar`) e o corte em secao (`planoCorte`, `aplicarCorte`)
 *       tambem sairam de la: `git show 93cefa0:src/main.js` os tem.
 *  O CSS (.painel, .controles, .chips, .croqui-*) continua em style.css.
 */

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** `aoAbrirFicha`: chamado quando uma ficha pede para o painel aparecer. */
export function criarPaineis(hud, opts, aoAbrirFicha = () => {}) {
  const alternarPeca = (id, v) => { if (id === 'ficha' && v) aoAbrirFicha(); };

  /* --------------------------- ficha tecnica ----------------------------- */
  const painel = el('aside', 'painel');
  hud.appendChild(painel);

  function mostrarFicha(ficha, selecionado = true) {
    painel.innerHTML = '';
    if (!ficha) { painel.classList.add('vazio'); return; }
    painel.classList.remove('vazio');
    if (selecionado) alternarPeca('ficha', true);

    const cab = el('div', 'painel-cab');
    if (selecionado) cab.appendChild(el('div', 'etiqueta', 'Componente selecionado'));
    cab.appendChild(el('h2', null, ficha.titulo));
    if (ficha.subtitulo) cab.appendChild(el('p', 'painel-sub', ficha.subtitulo));
    painel.appendChild(cab);

    // croqui oficial do equipamento (Fase 24): a peca marca de quem e
    // (`ficha.croqui`, a TAG) e a folha vem de opts.croquis
    const cq = ficha.croqui && opts.croquis?.[ficha.croqui];
    if (cq) {
      const sec = el('section', 'ficha-grupo ficha-croqui');
      sec.appendChild(el('h3', null, 'Croqui oficial'));
      const img = el('img');
      img.src = cq.img;
      img.alt = `Croqui de ${ficha.croqui}`;
      img.title = 'Abrir o croqui (clique)';
      img.onclick = () => abrirCroqui(ficha.croqui, cq);
      sec.appendChild(img);
      sec.appendChild(el('p', 'croqui-legenda', `${opts.fonteCroquis}, folha ${cq.folha} · ${cq.escala ?? ''} · desenhado por ${cq.desenhado}, aprovado por ${cq.aprovado}`));
      painel.appendChild(sec);
    }

    for (const grupo of ficha.grupos ?? []) {
      const sec = el('section', 'ficha-grupo');
      sec.appendChild(el('h3', null, grupo.nome));
      const tbl = el('dl');
      for (const [k, v] of Object.entries(grupo.dados)) {
        tbl.appendChild(el('dt', null, k));
        tbl.appendChild(el('dd', null, v));
      }
      sec.appendChild(tbl);
      painel.appendChild(sec);
    }
  }

  /* Visualizador do croqui: a folha inteira na altura da tela; um clique
   * amplia para a largura (le-se o carimbo) e outro volta. Esc ou clique fora
   * fecha. Fica fora do HUD: H esconde o HUD, nao a folha aberta. */
  let visor = null;
  function abrirCroqui(tag, cq) {
    if (!visor) {
      visor = el('div', 'croqui-visor');
      visor.innerHTML = '<div class="croqui-cab"><b></b><span>Clique na folha para ampliar · Esc fecha</span></div><div class="croqui-folha"><img></div>';
      visor.onclick = (e) => { if (e.target === visor) fechar(); };
      const img = visor.querySelector('img');
      img.onclick = () => visor.classList.toggle('ampliado');
      const fechar = () => { visor.classList.remove('aberto', 'ampliado'); };
      window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && visor.classList.contains('aberto')) { e.stopImmediatePropagation(); fechar(); } }, true);
      document.body.appendChild(visor);
    }
    visor.querySelector('b').textContent = `${tag} — ${cq.nome} · ${opts.fonteCroquis}, folha ${cq.folha} · ${cq.data}`;
    visor.querySelector('img').src = cq.img;
    visor.classList.add('aberto');
  }

  /* ----------------------------- controles ------------------------------- */
  const controles = el('div', 'controles');

  const cabCtrl = el('div', 'ctrl-cab');
  cabCtrl.appendChild(el('span', null, 'Exibição'));

  const acoes = el('div', 'ctrl-acoes');
  const btnReset = el('button', 'btn-mini', 'Enquadrar');
  btnReset.onclick = () => opts.aoEnquadrar?.();
  acoes.appendChild(btnReset);

  // Em tela pequena os paineis competem com o modelo. O painel de exibicao
  // nasce recolhido no celular e vira um botao.
  const btnRecolher = el('button', 'btn-mini btn-recolher', '–');
  btnRecolher.onclick = () => {
    const r = controles.classList.toggle('recolhido');
    btnRecolher.textContent = r ? '+' : '–';
  };
  acoes.appendChild(btnRecolher);
  cabCtrl.appendChild(acoes);
  controles.appendChild(cabCtrl);

  if (window.matchMedia('(max-width: 760px)').matches) {
    controles.classList.add('recolhido');
    btnRecolher.textContent = '+';
  }

  /* --------------------------- pontos de vista ---------------------------- */
  // Teclas 1 a 5 (e LB/RB no controle): a camera voa ate o ponto.
  if (opts.vistas?.length) {
    const secVistas = el('div', 'equipamentos');
    secVistas.appendChild(el('div', 'ctrl-titulo', 'Vistas'));
    const lista = el('div', 'chips');
    for (const v of opts.vistas) {
      const b = el('button', 'chip');
      b.innerHTML = `<b>${v.tecla}</b><span>${v.nome}</span>`;
      b.title = `${v.nome} — tecla ${v.tecla}`;
      b.onclick = () => opts.aoVista?.(v.id);
      lista.appendChild(b);
    }
    secVistas.appendChild(lista);
    controles.appendChild(secVistas);
  }

  /* ------------------------ foco por equipamento ------------------------- */
  // Com tres equipamentos espalhados por 20 m, chegar a cada um so pela
  // navegacao livre e trabalhoso. Estes botoes levam a camera direto.
  // Agrupado por zona (Fase 7): a planta inteira nao cabe numa lista so.
  if (opts.equipamentos?.length) {
    const secEquip = el('div', 'equipamentos');
    secEquip.appendChild(el('div', 'ctrl-titulo', 'Ir para'));
    const zonas = opts.equipamentos[0].zona ? opts.equipamentos : [{ zona: null, itens: opts.equipamentos }];
    const todosChips = [];
    for (const z of zonas) {
      if (z.zona) secEquip.appendChild(el('div', 'ctrl-zona', z.zona));
      const lista = el('div', 'chips');
      for (const e of z.itens) {
        const b = el('button', 'chip');
        b.innerHTML = `<b>${e.rotulo ?? e.tag}</b><span>${e.nome}</span>`;
        b.onclick = () => {
          for (const outro of todosChips) outro.classList.remove('ativo');
          b.classList.add('ativo');
          opts.aoFocar?.(e.tag);
        };
        lista.appendChild(b);
        todosChips.push(b);
      }
      secEquip.appendChild(lista);
    }
    todosChips[0]?.classList.add('ativo');
    controles.appendChild(secEquip);
  }

  const listaToggles = el('div', 'toggles');
  const caixas = {};                             // para o codigo marcar/desmarcar
  for (const t of opts.camadas) {
    const linha = el('label', 'toggle');
    const cb = el('input');
    cb.type = 'checkbox';
    caixas[t.id] = cb;
    cb.checked = t.ativo !== false;
    cb.onchange = () => opts.aoAlternar?.(t.id, cb.checked);
    linha.appendChild(cb);
    linha.appendChild(el('span', null, t.rotulo));
    listaToggles.appendChild(linha);
  }
  controles.appendChild(listaToggles);

  /* ------------------------- corte em secao ------------------------------ */
  const secCorte = el('div', 'corte');
  const linhaCorte = el('label', 'toggle destaque');
  const cbCorte = el('input');
  cbCorte.type = 'checkbox';
  linhaCorte.appendChild(cbCorte);
  linhaCorte.appendChild(el('span', null, 'Corte em seção'));
  secCorte.appendChild(linhaCorte);

  const slider = el('input', 'slider');
  slider.type = 'range';
  slider.min = String(opts.corte?.min ?? -2);
  slider.max = String(opts.corte?.max ?? 2);
  slider.step = '0.01';
  slider.value = '0';
  slider.disabled = true;
  secCorte.appendChild(slider);

  cbCorte.onchange = () => {
    slider.disabled = !cbCorte.checked;
    opts.aoCortar?.(cbCorte.checked, parseFloat(slider.value));
  };
  slider.oninput = () => opts.aoCortar?.(cbCorte.checked, parseFloat(slider.value));

  controles.appendChild(secCorte);
  hud.appendChild(controles);

  /** Reajusta a faixa do corte quando o equipamento focado muda. */
  function definirFaixaCorte(faixa) {
    slider.min = String(faixa.min);
    slider.max = String(faixa.max);
    slider.value = String(faixa.meio ?? (faixa.min + faixa.max) / 2);
    if (cbCorte.checked) opts.aoCortar?.(true, parseFloat(slider.value));
  }

  /** Marca a caixa sem disparar o aoAlternar (quem chama ja aplicou). */
  const marcarCamada = (id, v) => { if (caixas[id]) caixas[id].checked = v; };

  return { painel, controles, mostrarFicha, definirFaixaCorte, marcarCamada };
}
