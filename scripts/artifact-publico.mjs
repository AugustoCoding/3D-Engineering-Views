/**
 * Gera o HTML do repositorio (publico) SEM a foto do rosto do companion.
 *
 * O `npm run artifact` comum embute `src/data/rosto.local.js` quando ele
 * existe, e por isso grava em `artifact/maquete-planta.local.html` (fora do
 * git). Este tira o arquivo do caminho, gera `artifact/maquete-planta.html` e
 * o devolve — mesmo se o build falhar.
 *
 *   npm run artifact:publico
 */
import { existsSync, renameSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const rosto = join(raiz, 'src', 'data', 'rosto.local.js');
const fora = rosto + '.fora';
const havia = existsSync(rosto);
if (havia) renameSync(rosto, fora);
try {
  execSync('npm run build', { cwd: raiz, stdio: 'inherit' });
} finally {
  if (havia) renameSync(fora, rosto);
}
