/**
 * ============================================================================
 *  FOLHA DE ESPECIFICACAO CONSOLIDADA  ->  .docx
 * ============================================================================
 *
 *    npm run datasheet-geral
 *    node geracao-de-documentos/gerar-datasheet-geral.mjs R-01 V-01
 *
 *  Todos os equipamentos num documento so, UM POR PAGINA, na ordem em que
 *  aparecem no processo — que e a ordem de `EQUIPAMENTOS` em plant.js.
 *
 *  Nao ha montagem propria aqui. As tabelas sao as mesmas de
 *  `gerar-datasheet.mjs`, por `montarEquipamento()`: se houvesse duas
 *  montagens, a folha avulsa e a consolidada poderiam divergir sem ninguem
 *  notar, e o professor receberia dois numeros diferentes para o mesmo vaso.
 *
 *  UMA SECAO POR EQUIPAMENTO. No docx (e no Google Docs) o cabecalho de pagina
 *  pertence a SECAO, e cada folha precisa do cabecalho do seu proprio
 *  equipamento — dai uma secao para cada. A secao ja comeca em pagina nova,
 *  entao nao ha quebra de pagina explicita.
 *
 *  O modelo do professor traz esse carimbo como tabela no corpo, numa secao
 *  unica. O visual aqui e o mesmo, mas como header ele se repete quando a
 *  folha transborda, e ferramentas que leem o arquivo (o Google Docs, por
 *  exemplo) o reconhecem como cabecalho de pagina em vez de tabela solta.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Packer, Header } from 'docx';
import { EQUIPAMENTOS } from '../src/data/plant.js';
import { IDENT } from './identificacao.js';
import { montarEquipamento, PAGINA } from './gerar-datasheet.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));

const pedidos = process.argv.slice(2);
const tags = pedidos.length ? pedidos : Object.keys(EQUIPAMENTOS);

const desconhecidos = tags.filter((t) => !EQUIPAMENTOS[t]);
if (desconhecidos.length) {
  console.error(`Equipamento(s) desconhecido(s): ${desconhecidos.join(', ')}`);
  console.error(`Disponiveis: ${Object.keys(EQUIPAMENTOS).join(', ')}`);
  process.exit(1);
}

const secoes = [];
const resumo = [];

tags.forEach((tag, i) => {
  const { EQ, cabecalho, children, resumo: r } = montarEquipamento(
    tag, { folha: i + 1, total: tags.length },
  );
  resumo.push(`  ${tag.padEnd(6)} ${EQ.nome}`);
  console.log(`    ${tag.padEnd(6)} ${r}`);

  secoes.push({
    properties: { page: PAGINA },
    headers: { default: new Header({ children: [cabecalho] }) },
    children,
  });
});

const doc = new Document({
  creator: IDENT.empresa,
  title: `Folhas de Especificação — ${IDENT.projeto}`,
  description: `${tags.length} equipamentos: ${tags.join(', ')}`,
  sections: secoes,
});

mkdirSync(aqui, { recursive: true });
const saida = process.env.DATASHEET_OUT
  || join(aqui, 'Folhas-de-especificacao-consolidado.docx');
const buf = await Packer.toBuffer(doc);
try {
  writeFileSync(saida, buf);
} catch (e) {
  if (e.code === 'EBUSY' || e.code === 'EPERM') {
    console.error(`\n  ${saida}\n  esta aberto em outro programa (provavelmente o Word).`);
    console.error('  Feche o arquivo e rode de novo, ou use DATASHEET_OUT=<caminho>.\n');
    process.exit(1);
  }
  throw e;
}

console.log(`\nOK  ${saida}  (${Math.round(buf.length / 1024)} KB)`);
console.log(`    ${tags.length} equipamentos, um por página, na ordem do processo:`);
for (const l of resumo) console.log(l);
