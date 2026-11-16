/**
 * Gera um HTML AUTOCONTIDO a partir do build do Vite.
 *
 * Por que isso existe: o entregavel final e um link/arquivo unico que precisa
 * abrir em qualquer navegador, sem servidor, sem CDN e sem internet. Este
 * script pega o bundle (JS + CSS) e costura tudo em um arquivo so.
 *
 *   npm run artifact   ->   artifact/maquete-planta.html
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const saidaDir = join(raiz, 'artifact');
const saida = join(saidaDir, 'maquete-planta.html');

if (!existsSync(join(dist, 'app.js'))) {
  console.error('dist/app.js nao encontrado. Rode `npm run build` antes.');
  process.exit(1);
}

const js = readFileSync(join(dist, 'app.js'), 'utf8');

// CSS lido da FONTE, nao do build.
//
// Motivo: no formato IIFE o Vite deixa de emitir dist/app.css e passa a injetar
// o CSS via JavaScript em tempo de execucao. Isso e fatal para um entregavel
// offline — se o JS falhar por qualquer motivo, a pagina fica sem estilo NENHUM
// (fundo branco, texto ilegivel) e o proprio aviso de erro some. Lendo o CSS
// direto de src/style.css, a folha de estilo vai literalmente dentro de <style>
// e nao depende de o JavaScript rodar.
const cssPath = join(raiz, 'src', 'style.css');
if (!existsSync(cssPath)) {
  console.error(`CSS nao encontrado em ${cssPath}`);
  process.exit(1);
}
const css = readFileSync(cssPath, 'utf8');

// Trava: o bug que gerou a pagina branca passou porque o script aceitou CSS
// vazio em silencio. Agora ele falha alto.
if (css.trim().length < 500) {
  console.error(`CSS suspeito de estar vazio ou truncado (${css.length} bytes).`);
  process.exit(1);
}

// Uma ocorrencia literal de "</script" dentro do bundle fecharia a tag antes
// da hora. Escapar a barra resolve sem alterar o valor da string em JS.
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

// <script> classico (sem type="module"): o bundle e IIFE e nao usa nenhuma
// sintaxe de modulo, entao o atributo seria inutil. Nao ha necessidade de
// module aqui — e testes mostraram que ambos funcionam em file://.
//
// O try/catch existe para que qualquer falha futura apareca NA TELA em vez de
// virar pagina em branco silenciosa. Duas rodadas de depuracao se perderam
// exatamente por essa falta de mensagem.
// A caixa de erro carrega estilo PROPRIO, inline, sem depender de nenhuma
// classe da folha de estilo. Na versao anterior ela usava texto cinza-claro
// contando com o fundo escuro do CSS; quando o CSS sumiu, virou texto claro
// sobre branco — invisivel. Um aviso de erro nao pode depender de nada.
const corpo = `<div id="app"></div>
<script>
try {
${jsSeguro}
} catch (err) {
  var alvo = document.getElementById('app') || document.body;
  alvo.setAttribute('style', 'display:block;background:#11151c;min-height:100vh;'
    + 'margin:0;padding:56px 24px;box-sizing:border-box;'
    + 'font:15px/1.6 system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3');
  alvo.innerHTML =
    '<div style="max-width:640px;margin:0 auto">'
    + '<h1 style="margin:0 0 12px;font-size:20px;color:#fff">Não foi possível carregar a maquete 3D</h1>'
    + '<p style="color:#9aa7b4;margin:0 0 20px">Copie a mensagem abaixo e envie — ela diz exatamente o que falhou.</p>'
    + '<pre style="background:#0b0e13;border:1px solid #30363d;padding:14px 16px;border-radius:8px;'
    + 'overflow:auto;color:#ff7b72;font:12.5px/1.5 ui-monospace,Consolas,monospace;margin:0 0 20px;'
    + 'white-space:pre-wrap;word-break:break-word">' + String((err && err.stack) || (err && err.message) || err) + '</pre>'
    + '<p style="color:#6e7681;margin:0;font-size:13px">Navegador: ' + navigator.userAgent + '</p>'
    + '</div>';
  if (window.console) console.error(err);
}
</script>`;

// Documento COMPLETO, com doctype. Um arquivo que a pessoa abre com duplo
// clique precisa ser um documento HTML de verdade, nao um fragmento.
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maquete 3D — Planta de Ácido Benzóico</title>
<style>
${css}
</style>
</head>
<body>
${corpo}
</body>
</html>
`;

mkdirSync(saidaDir, { recursive: true });
writeFileSync(saida, html, 'utf8');

const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`OK  ${saida}  (${mb} MB)`);
