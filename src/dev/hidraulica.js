import { velocidades } from '../lib/hidraulica.js';
import { ACEITOS } from '../data/fluidos.js';

/**
 * ===========================================================================
 *  AUDITORIA HIDRAULICA  (Fase 23) — __auditarHidraulica()
 * ===========================================================================
 *  LINHA_RAPIDA       acima da faixa do servico (data/fluidos.js, FAIXAS)
 *  LINHA_LENTA        abaixo dela, havendo DN menor em que caberia
 *  NPSH_INSUFICIENTE  NPSH disponivel abaixo do requerido
 *  NPSH_MARGEM_CURTA  acima do requerido, abaixo da margem (ANSI/HI 9.6.1)
 *
 *  Numero de projeto que nao fecha nao se conserta mudando dado oficial:
 *  vira pendencia da equipe, e entra em ACEITOS (fluidos.js) com
 *  a letra dela. O achado aceito e contado a parte; `novos` tem de dar zero.
 *
 *  A velocidade sai so dos dados e roda no Node:
 *    node -e "import('./src/dev/hidraulica.js').then((m) => console.log(m.auditarVelocidades().novos))"
 *  (sem os ramais de utilidade sem numero de linha, cujo DN e o do bocal); o
 *  NPSH, do 3D — o que equipment/tubulacao.js e site/pipeways.js calcularam
 *  ao montar a ficha das bombas.
 * ===========================================================================
 */

const f1 = (x) => x.toFixed(1).replace('.', ',');
const f2 = (x) => x.toFixed(2).replace('.', ',');

function separar(achados) {
  const novos = [], aceitos = [];
  for (const a of achados) {
    const p = ACEITOS[`${a.regra}:${a.id}`];
    if (p) aceitos.push({ ...a, pendencia: p }); else novos.push(a);
  }
  const porRegra = {};
  for (const a of novos) porRegra[a.regra] = (porRegra[a.regra] ?? 0) + 1;
  return { novos, aceitos, porRegra };
}

/** Velocidade em todo trecho com vazao conhecida; `dnDoRamal` da o DN dos
 *  ramais de utilidade sem numero de linha (o do bocal, so no 3D). */
export function auditarVelocidades({ dnDoRamal = null } = {}) {
  const lista = velocidades({ dnDoRamal });
  const achados = [];
  for (const r of lista) {
    if (r.semVazao) continue;
    const fx = r.faixa;
    const onde = `linha ${r.linha} (${r.onde})`;
    if (r.rapida) achados.push({ regra: 'LINHA_RAPIDA', id: r.linha, detalhe: `${onde}: ${f1(r.v)} m/s, acima de ${f1(fx.max)} m/s (${fx.nome}${fx.porErosao ? ', erosão API RP 14E' : ''})` });
    if (r.lenta) achados.push({ regra: 'LINHA_LENTA', id: r.linha, detalhe: `${onde}: ${f2(r.v)} m/s, abaixo de ${f1(fx.min)} m/s (${fx.nome}) e o DN logo abaixo caberia` });
  }
  const semVazao = lista.filter((r) => r.semVazao).map((r) => `${r.linha}: ${r.motivo}`);
  return { lista, achados, semVazao, ...separar(achados) };
}

/** No navegador: velocidade de tudo e NPSH de cada bomba de liquido. */
export function auditarHidraulica({ tubulacao, pipeways }) {
  const dnDoRamal = (r) => tubulacao.itens.find((i) => i.t === r)?.dn ?? null;
  const vel = auditarVelocidades({ dnDoRamal });
  const achados = [...vel.achados];
  const bombas = { ...tubulacao.npsh, ...(pipeways?.npsh ?? {}) };
  const tabela = [];
  for (const [tag, r] of Object.entries(bombas)) {
    const nome = r.deslocamento ? 'NPIP' : 'NPSH';
    tabela.push({ tag, de: r.origem, disponivel: +r.disponivel.toFixed(2), requerido: +r.requerido.toFixed(2), margem: +r.margem.toFixed(2),
      pressao: +r.pressao.toFixed(2), cota: +r.estatica.toFixed(2), atrito: +r.atrito.toFixed(2) });
    const det = `${tag} (de ${r.origem}): ${nome}a ${f1(r.disponivel)} m — pressão ${f1(r.pressao)}, cota ${f1(r.estatica)}, atrito ${f2(r.atrito)} — contra ${nome}r ${f1(r.requerido)} m`;
    if (r.insuficiente) achados.push({ regra: 'NPSH_INSUFICIENTE', id: tag, detalhe: det });
    else if (r.curto) achados.push({ regra: 'NPSH_MARGEM_CURTA', id: tag, detalhe: `${det}; a margem pede ${f1(r.margem)} m` });
  }
  const { novos, aceitos, porRegra } = separar(achados);
  return {
    total: novos.length, porRegra, achados: novos,
    aceitos: aceitos.map((a) => `${a.regra} ${a.id} — pendência ${a.pendencia}: ${a.detalhe}`),
    bombas: tabela,
    naoMedido: vel.semVazao,
    linhas: vel.lista.filter((r) => !r.semVazao).length,
  };
}
