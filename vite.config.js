import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Saida previsivel e sem code-splitting: um unico JS + um unico CSS,
        // que o scripts/build-artifact.mjs consegue inlinear em um HTML so.
        codeSplitting: false,

        // IIFE, nao modulo ES.
        //
        // Historico honesto: um build anterior em formato ESM abria em branco
        // quando o HTML era aberto por file:// (duplo clique). Eu atribui isso
        // ao <script type="module">, mas TESTEI DEPOIS e essa hipotese estava
        // errada — modulo inline executa normalmente em file://. A causa exata
        // do build ESM nao foi isolada.
        //
        // O que esta verificado: esta combinacao (IIFE + <script> classico)
        // renderiza a partir de file:// no Chrome e no Comet. Se algum dia
        // trocar para 'es', TESTE abrindo o arquivo por duplo clique antes de
        // entregar — servir por HTTP nao reproduz o caso.
        format: 'iife',
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});
