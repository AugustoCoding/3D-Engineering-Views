/**
 * ============================================================================
 *  IDENTIFICACAO DO PROJETO — carimbo do croqui e cabecalho do datasheet
 * ============================================================================
 *  Extraido do relatorio do grupo ("Relatorio de projetao"), secoes 4.2, 4.4
 *  e capa. Aparece em toda folha entregue.
 * ============================================================================
 */

import { existsSync, readFileSync } from 'node:fs';

export const IDENT = {
  projeto: 'Unidade Industrial de Produção de Ácido Benzóico — 15.840 t/ano',
  localidade: 'Região Metropolitana de Campinas — Paulínia, SP '
    + '(adjacente ao Polo Petroquímico / REPLAN)',

  // Versao curta para o carimbo do croqui, onde a celula tem largura fixa e
  // o texto nao quebra linha. A versao longa acima vai no datasheet.
  localidadeCurta: 'Paulínia — SP (Polo Petroquímico / REPLAN)',

  empresa: 'Benzoic Industries',
  empresaSubtitulo: '',

  // Logotipo: PNG ou JPG, caminho relativo a esta pasta.
  // Se o arquivo nao existir, o carimbo cai para o nome da empresa em texto.
  // O gerador desenha um retangulo branco atras, entao PNG com transparencia
  // funciona normalmente.
  logo: 'Logo.png',

  // Deixados em branco de proposito: os campos aparecem rotulados no carimbo
  // para serem preenchidos a mao na assinatura da folha.
  desenhadoPor: '',
  revisadoPor: '',
  aprovadoPor: '',

  data: '03/09/2026',
  revisao: '0',

  // Contexto academico (universidade, disciplina): em branco, porque o
  // repositorio e publico. Nenhum gerador os usa hoje.
  instituicao: '',
  disciplina: '',
};

/**
 * Assinaturas dos croquis: a equipe se reveza pelas folhas, na ordem do
 * processo. Quem desenha uma folha nao a revisa; quem revisa e quem aprova.
 * Os campos em branco de IDENT continuam valendo para folhas fora da lista.
 */
// Os nomes nao ficam no repositorio (ele e publico): vem de
// `equipe.local.json`, ao lado deste arquivo e fora do git — uma lista como
// ["Nome 1", "Nome 2", ...]. Sem ele, os croquis saem com "Membro n".
const LOCAL = new URL('./equipe.local.json', import.meta.url);
export const EQUIPE = existsSync(LOCAL)
  ? JSON.parse(readFileSync(LOCAL, 'utf8'))
  : ['Membro 1', 'Membro 2', 'Membro 3', 'Membro 4'];
export const ORDEM_FOLHAS = ['R-01', 'V-01', 'V-02', 'TK-01', 'T-01', 'CR-01', 'F-01',
  'D-01', 'CR-02', 'F-02'];

export function assinaturas(tag) {
  const i = ORDEM_FOLHAS.indexOf(tag);
  if (i < 0) {
    return { desenhadoPor: IDENT.desenhadoPor, revisadoPor: IDENT.revisadoPor, aprovadoPor: IDENT.aprovadoPor };
  }
  const revisor = EQUIPE[(i + 1) % EQUIPE.length];
  return { desenhadoPor: EQUIPE[i % EQUIPE.length], revisadoPor: revisor, aprovadoPor: revisor };
}

/** Codigo do equipamento no padrao do datasheet modelo ("Nome/ TAG"). */
export const EQUIPAMENTO = {
  nome: 'Reator de oxidação',
  tag: 'R-01',
};
