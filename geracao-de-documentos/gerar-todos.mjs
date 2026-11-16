/**
 * Gera croqui (SVG + PDF) e folha de especificacao de TODOS os equipamentos
 * cadastrados, cada um na sua subpasta.
 *
 *   npm run documentos            -> todos
 *   npm run documentos -- V-01    -> so o V-01
 *
 * Roda cada gerador num processo separado de proposito: se um equipamento
 * falhar (arquivo aberto no Word, por exemplo), os outros seguem, e o codigo
 * de saida ainda acusa a falha.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EQUIPAMENTOS } from '../src/data/plant.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const pedidos = process.argv.slice(2);
const tags = pedidos.length ? pedidos : Object.keys(EQUIPAMENTOS);

const desconhecidos = tags.filter((t) => !EQUIPAMENTOS[t]);
if (desconhecidos.length) {
  console.error(`Equipamento(s) desconhecido(s): ${desconhecidos.join(', ')}`);
  console.error(`Disponiveis: ${Object.keys(EQUIPAMENTOS).join(', ')}`);
  process.exit(1);
}

/**
 * Equipamentos que tambem ganham a folha LIMPA, sem cotas.
 *
 * Sao os quatro que vao no corpo do relatorio e na apresentacao, onde a cota
 * atrapalha mais do que informa. Os demais saem so na versao cotada, que e a
 * de fabricacao. Para acrescentar um, basta por a TAG aqui.
 */
const SEM_COTAS = ['R-01', 'V-01', 'V-02', 'TK-01'];

let falhas = 0;
for (const tag of tags) {
  console.log(`\n=== ${tag} — ${EQUIPAMENTOS[tag].nome} ===`);
  for (const script of ['gerar-croqui.mjs', 'gerar-pdf.mjs', 'gerar-datasheet.mjs']) {
    const r = spawnSync(process.execPath, [join(aqui, script), tag], { stdio: 'inherit' });
    if (r.status !== 0) falhas++;
  }
  if (!SEM_COTAS.includes(tag)) continue;
  for (const script of ['gerar-croqui.mjs', 'gerar-pdf.mjs']) {
    const r = spawnSync(process.execPath, [join(aqui, script), tag, '--sem-cotas'],
      { stdio: 'inherit' });
    if (r.status !== 0) falhas++;
  }
}

/* A folha consolidada e sempre a de TODOS os equipamentos, mesmo quando a
 * execucao pediu um so: ela e um documento unico do projeto, e regera-la
 * parcialmente a deixaria incompleta. */
if (!falhas) {
  console.log('');
  console.log('=== Folha consolidada ===');
  const r = spawnSync(process.execPath, [join(aqui, 'gerar-datasheet-geral.mjs')],
    { stdio: 'inherit' });
  if (r.status !== 0) falhas++;
}

console.log(falhas
  ? `\n${falhas} etapa(s) falharam.`
  : `\n${tags.length} equipamento(s) gerados com sucesso.`);
process.exit(falhas ? 1 : 0);
