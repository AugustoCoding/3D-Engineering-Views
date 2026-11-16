/**
 * Converte o croqui SVG de um equipamento em PDF A4.
 *
 *   node geracao-de-documentos/gerar-pdf.mjs R-01
 *   node geracao-de-documentos/gerar-pdf.mjs V-01
 *
 * Usa o motor de impressao de um Chromium ja instalado (Chrome ou Edge) —
 * evita depender de LibreOffice/Inkscape, que nao existem nesta maquina. O SVG
 * e embutido numa pagina com @page A4 e margem zero, para sair na escala exata
 * quando impresso em A4.
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const SEM_COTAS = args.includes('--sem-cotas');
const TAG = args.find((a) => !a.startsWith('--')) || 'R-01';
const SUFIXO = SEM_COTAS ? '-croqui-sem-cotas' : '-croqui';

const CANDIDATOS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

const navegador = CANDIDATOS.find((p) => existsSync(p));
if (!navegador) {
  console.error('Nenhum Chrome/Edge encontrado. Defina CHROME_PATH para o executavel.');
  process.exit(1);
}

const svgPath = join(aqui, TAG, `${TAG}${SUFIXO}.svg`);
if (!existsSync(svgPath)) {
  console.error(`${svgPath} nao existe.`);
  console.error(`Rode antes: node geracao-de-documentos/gerar-croqui.mjs ${TAG}`
    + (SEM_COTAS ? ' --sem-cotas' : ''));
  process.exit(1);
}

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; }
  svg { display: block; width: 210mm; height: 297mm; }
</style>
${readFileSync(svgPath, 'utf8')}
`;

const tmp = mkdtempSync(join(tmpdir(), 'croqui-'));
const htmlPath = join(tmp, 'croqui.html');
writeFileSync(htmlPath, html, 'utf8');

const saida = join(aqui, TAG, `${TAG}${SUFIXO}.pdf`);
try {
  execFileSync(navegador, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${saida}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'pipe', timeout: 120000 });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!existsSync(saida)) {
  console.error('O navegador nao produziu o PDF.');
  process.exit(1);
}
console.log(`OK  ${saida}  (${Math.round(readFileSync(saida).length / 1024)} KB)`);
