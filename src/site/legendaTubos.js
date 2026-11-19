import { LEGENDA_CORPO, FAIXAS } from '../data/rotas.js';
import { CODIGOS } from '../data/pid.js';

/**
 * Legenda das cores dos tubos (Fase 25, tecla C): a cor do corpo pela NBR
 * 6493 e a da faixa de identificacao, que diz o fluido. Tudo das tabelas de
 * data/rotas.js e dos nomes do Quadro 13 (data/pid.js): codigos de mesma
 * faixa e mesmo nome (TOL/AB e AB/TOL) viram uma linha so.
 */
export function criarLegendaTubos(container) {
  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  const faixas = new Map();
  for (const [codigo, cor] of Object.entries(FAIXAS)) {
    const nome = CODIGOS[codigo] ?? codigo;
    const chave = `${cor}|${nome}`;
    if (!faixas.has(chave)) faixas.set(chave, { cor, nome, codigos: [] });
    faixas.get(chave).codigos.push(codigo);
  }
  const el = document.createElement('div');
  el.className = 'legenda-tubos';
  el.innerHTML = `
    <div class="lt-cab"><b>Cores da tubulação</b><span>NBR 6493 · tecla C</span></div>
    <div class="lt-sec">Cor do tubo</div>
    ${LEGENDA_CORPO.map((l) => `<div class="lt-l"><i class="lt-tubo" style="background:${hex(l.cor)}"></i>${l.nome}</div>`).join('')}
    <div class="lt-sec">Faixa: o fluido</div>
    ${[...faixas.values()].map((f) => `<div class="lt-l"><i class="lt-tubo lt-faixa" style="--f:${hex(f.cor)}"></i>${f.nome} <small>${f.codigos.join(', ')}</small></div>`).join('')}`;
  container.appendChild(el);
  const ligar = (v) => el.classList.toggle('aberta', v);
  return { el, ligar, alternar: () => ligar(!el.classList.contains('aberta')), get aberta() { return el.classList.contains('aberta'); } };
}
