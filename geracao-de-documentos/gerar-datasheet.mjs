/**
 * ============================================================================
 *  FOLHA DE ESPECIFICACAO (DATASHEET)  ->  .docx
 * ============================================================================
 *
 *    node geracao-de-documentos/gerar-datasheet.mjs R-01
 *
 *  LAYOUT: o do modelo `Datasheet EXEMPLO.docx`, que e a especificacao do
 *  professor. Cinco tabelas por equipamento, uma folha cada:
 *
 *      1  cabecalho          FOLHA DE ESPECIFICACAO — NOME · Folha n de N
 *      2  identificacao      codigo, funcao, dimensao, posicao, estado, agitado
 *      3  utilizacao         + CONDICOES DE OPERACAO + CONDICOES DE PROJETO
 *      4  construcao         componentes e tubulacao principal
 *      5  notas e revisao
 *
 *  Detalhes de formatacao lidos do proprio modelo, nao inventados: Arial 6,5 pt
 *  (`w:sz` 13), borda simples de 1,5 pt no contorno e nas divisoes internas,
 *  SEM sombreamento — as faixas de secao sao negrito centralizado — e largura
 *  de tabela de 9914 dxa.
 *
 *  As condicoes de OPERACAO e as de PROJETO sao secoes separadas, como no
 *  modelo: a primeira e o ponto normal de trabalho, a segunda e a geometria
 *  que saiu do dimensionamento.
 *
 *  GENERICO: cadastrar um equipamento em src/data/plant.js basta. As secoes
 *  saem de `processo`, `mecanica`, `correntes`, `linhas` e `folha`.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, VerticalAlign, ImageRun, HeightRule, Header,
} from 'docx';
import { EQUIPAMENTOS, DN } from '../src/data/plant.js';
import { nivelDeVolume } from '../src/lib/vessel.js';
import { IDENT } from './identificacao.js';

const aqui = dirname(fileURLToPath(import.meta.url));

/* --------------------------------------------------------------------------
 * Metricas de pagina, em DXA (1440 por polegada). Copiadas do modelo.
 * ----------------------------------------------------------------------- */
/* `top` acomoda o cabecalho, que agora e header de secao e vive DENTRO da
 * margem superior: ele comeca em `header` e ocupa cerca de 1200 dxa. As
 * demais margens sao as do modelo. */
export const PAGINA = {
  size: { width: 11900, height: 16840 },
  margin: { top: 1900, right: 992, bottom: 280, left: 850, header: 400 },
};
export const LARGURA = 9914;

/* Metricas lidas do proprio modelo, nao arbitradas:
 *   fonte     Arial, w:sz 13  (6,5 pt)
 *   linha     w:trHeight 239 dxa, que e a altura dominante das 217 linhas
 *   paragrafo w:spacing before 47, sem `after`
 *   cabecalho grade de 3 colunas, 1965 / 6520 / 1408 dxa
 * O espacamento e o que faz o equipamento caber numa folha so. */
const SZ = 13;
const FONTE = 'Arial';
/* O CABECALHO usa o espacamento generoso do modelo (ver a montagem dele). O
 * CORPO vai mais justo: a folha do modelo tem menos linhas que a nossa — ele
 * nao traz nivel de liquido, agitador nem camisa — e com 239/47 no corpo dois
 * equipamentos passavam para uma segunda pagina, que o formato nao admite. */
const ANTES = 28;
const ALT = { value: 198, rule: HeightRule.ATLEAST };

/* Contorno em 1,5 pt, divisoes internas em 0,75 pt.
 * E o que o modelo faz na pratica: ele declara `tblBorders` com sz 12 em tudo
 * e depois sobrescreve celula a celula com `tcBorders` de sz 6 — 1513 bordas
 * superiores e 1360 inferiores. Declarar a diferenca direto em `insideH` e
 * `insideV` chega ao mesmo desenho sem repetir a borda em cada celula. */
const externa = { style: BorderStyle.SINGLE, size: 12, color: '000000' };
const interna = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const BORDAS = {
  top: externa, bottom: externa, left: externa, right: externa,
  insideHorizontal: interna, insideVertical: interna,
};

export const par = (texto, { b = false, al = AlignmentType.LEFT, sz = SZ, antes } = {}) =>
  new Paragraph({
    alignment: al,
    spacing: { before: antes ?? ANTES, after: 0 },
    children: [new TextRun({ text: String(texto), bold: b, size: sz, font: FONTE })],
  });

/* Grade de 12 colunas; as celulas se compoem por columnSpan. */
const G = 12;
const COL = (() => {
  const base = Math.floor(LARGURA / G);
  const c = Array(G).fill(base);
  c[G - 1] += LARGURA - base * G;
  return c;
})();
const larguraSpan = (s) => COL.slice(0, s).reduce((x, y) => x + y, 0);

const cel = (conteudo, { span = 1, rows, w, b, al, vm = true, antes, mv = 0 } = {}) =>
  new TableCell({
    columnSpan: span,
    ...(rows ? { rowSpan: rows } : {}),
    width: { size: w ?? larguraSpan(span), type: WidthType.DXA },
    verticalAlign: vm ? VerticalAlign.CENTER : undefined,
    margins: { top: mv, bottom: mv, left: 80, right: 80 },
    children: Array.isArray(conteudo) ? conteudo : [par(conteudo, { b, al, antes })],
  });

const tabela = (rows, colWidths = COL) => new Table({
  width: { size: LARGURA, type: WidthType.DXA },
  columnWidths: colWidths,
  borders: BORDAS,
  rows,
});

/** Faixa de secao: negrito centralizado, sem fundo — como no modelo. */
const faixa = (titulo) => new TableRow({
  height: ALT,
  children: [cel(titulo, { span: G, w: LARGURA, b: true, al: AlignmentType.CENTER })],
});

/** Linha rotulo/valor, com o rotulo em negrito a esquerda. */
const rv = (rotulo, valor, spanRot = 4) => new TableRow({
  height: ALT,
  children: [
    cel(rotulo, { span: spanRot, b: true }),
    cel(valor ?? '', { span: G - spanRot }),
  ],
});

/** Caixa de marcacao no estilo do modelo: `Vertical [X]  Horizontal [ ]`. */
const cx = (rotulo, marcado) => `${rotulo} [${marcado ? 'X' : ' '}]`;

/**
 * Logotipo do carimbo. Le a largura e a altura direto do cabecalho IHDR do
 * PNG para preservar a proporcao sem depender de biblioteca de imagem.
 * Sem o arquivo, cai para o nome da empresa em texto — a folha nao quebra.
 */
function blocoLogo() {
  const caminho = IDENT.logo ? join(aqui, IDENT.logo) : null;
  if (!caminho || !existsSync(caminho)) {
    return [par(IDENT.empresa, { b: true, al: AlignmentType.CENTER })];
  }
  const buf = readFileSync(caminho);
  let w = 16;
  let h = 9;
  if (buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) {
    w = buf.readUInt32BE(16);
    h = buf.readUInt32BE(20);
  }
  const larguraPt = (larguraSpan(2) - 240) / 20;
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new ImageRun({
      data: buf,
      type: caminho.toLowerCase().endsWith('.png') ? 'png' : 'jpg',
      transformation: { width: larguraPt, height: (larguraPt * h) / w },
    })],
  })];
}

export const vazio = () => new Paragraph({ spacing: { after: 60 }, children: [] });

/* ==========================================================================
 *  MONTAGEM DE UM EQUIPAMENTO
 * ======================================================================= */

/** Acha em `processo` a primeira chave que casa, e devolve o valor. */
function doProcesso(EQ, re) {
  const k = Object.keys(EQ.processo ?? {}).find((x) => re.test(x));
  return k ? EQ.processo[k] : null;
}

const POL = {
  25: '1', 50: '2', 80: '3', 100: '4',
  150: '6', 200: '8', 250: '10', 300: '12', 500: '20',
};

/**
 * Monta as cinco tabelas da folha de um equipamento.
 *
 * Extraido para funcao porque a folha consolidada
 * (gerar-datasheet-geral.mjs) usa exatamente as mesmas tabelas. Duas
 * montagens poderiam divergir em silencio, e o professor receberia dois
 * numeros diferentes para o mesmo vaso.
 *
 * @param {string} TAG
 * @param {{folha:number, total:number}} pagina  numeracao "Folha n de N"
 */
export function montarEquipamento(TAG, pagina = { folha: 1, total: 1 }) {
  const EQ = EQUIPAMENTOS[TAG];
  if (!EQ) throw new Error(`Equipamento "${TAG}" nao existe em src/data/plant.js.`);
  const g = EQ.geom;
  const f = EQ.folha ?? {};
  const num = (v, d = 2) => v.toFixed(d).replace('.', ',');

  const NIVEL = g.volumeUtil ? nivelDeVolume(g, g.volumeUtil) : null;
  const HORIZ = g.orientacao === 'horizontal';
  const entradas = (EQ.correntes ?? []).filter((c) => c.sentido === 'entrada');
  const saidas = (EQ.correntes ?? []).filter((c) => c.sentido === 'saída');

  /* ---------------------------------------------------------- 1. cabecalho
   * Estrutura copiada do modelo, celula por celula. La sao tres colunas —
   * 1965 / 6520 / 1408 dxa — e duas mesclagens verticais:
   *
   *   +--------+------------------------------+---------------+
   *   |        | FOLHA DE ESPECIFICACAO — NOME | Folha n de N  |
   *   |  LOGO  +------------------------------+  (2 linhas)   |
   *   | 3 lin  | PROJETO: ...  LOCALIDADE: ... +---------------+
   *   |        |         (2 linhas)           | Data: ...     |
   *   +--------+------------------------------+---------------+
   *
   * O logo desce pelas tres linhas; "Folha n de N" ocupa as duas primeiras da
   * coluna da direita e a data fica sozinha embaixo. As larguras sao as do
   * modelo reescalonadas para os 9914 dxa desta folha.
   */
  /* O modelo NAO trava a altura destas tres linhas (`trHeight` auto): elas
   * crescem com o conteudo. E o `spacing before` la e bem maior que no resto
   * da folha — 140 no titulo, 46 no projeto, 14 na data. Travar em 239 com
   * espacamento uniforme, como estava, apertava o carimbo. */
  const COL_CAB = [1969, 6534, 1411];
  const MV_CAB = 60;                  // respiro vertical dentro da celula
  const cabecalho = new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: COL_CAB,
    borders: BORDAS,
    rows: [
      new TableRow({
        children: [
          cel(blocoLogo(), { rows: 3, w: COL_CAB[0], mv: MV_CAB }),
          cel(`FOLHA DE ESPECIFICAÇÃO — ${EQ.nome.toUpperCase()}`,
            { w: COL_CAB[1], b: true, al: AlignmentType.CENTER, antes: 140, mv: MV_CAB }),
          cel(`Folha ${pagina.folha} de ${pagina.total}`,
            { rows: 2, w: COL_CAB[2], al: AlignmentType.CENTER, antes: 97, mv: MV_CAB }),
        ],
      }),
      new TableRow({
        children: [
          cel([
            par(`PROJETO: ${IDENT.projeto}`, { al: AlignmentType.CENTER, antes: 46 }),
            par(`LOCALIDADE: ${IDENT.localidade}`, { al: AlignmentType.CENTER, antes: 18 }),
          ], { rows: 2, w: COL_CAB[1], mv: MV_CAB }),
        ],
      }),
      new TableRow({
        children: [cel(`Data: ${IDENT.data}`,
          { w: COL_CAB[2], al: AlignmentType.CENTER, antes: 14, mv: MV_CAB })],
      }),
    ],
  });

  /* ------------------------------------------------------ 2. identificacao */
  const dimensao = HORIZ
    ? `Diâmetro interno: ${num(g.Di)}     Comprimento: ${num(g.Ltan)}`
    : `Diâmetro interno: ${num(g.Di)}     Altura: ${num(g.Ltan)}`;

  const identificacao = tabela([
    rv('Equipamento/Código:', `${EQ.nome} / ${EQ.tag}`),
    rv('Função:', EQ.servico),
    rv('Dimensão (m):', dimensao),
    rv('Capacidade Total (m³):', g.volumeTotal ? num(g.volumeTotal) : '—'),
    rv('Posição:', `${cx('Vertical', !HORIZ)}      ${cx('Horizontal', HORIZ)}`),
    rv('Estado:', `${cx('Novo', true)}      ${cx('Recuperado', false)}`
      + `      ${cx('Modificado', false)}`),
    rv('Agitado:', `${cx('Não', !g.agitador)}      ${cx('Sim', !!g.agitador)}`),
  ]);

  /* ------------------ 3. utilizacao + cond. de operacao + cond. de projeto */
  const somaKgh = (cs) => cs
    .map((c) => parseFloat(String(c.vazao).replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.')))
    .filter((v) => Number.isFinite(v))
    .reduce((a, b) => a + b, 0);
  const vazaoTotal = somaKgh(entradas) || somaKgh(saidas);

  const primeira = entradas[0] ?? {};
  const ultima = saidas[0] ?? {};
  const soNum = (v) => (v ? String(v).replace(/[^\d,.-]/g, '') || '—' : '—');

  const linhasUso = [
    faixa('UTILIZAÇÃO'),
    rv('Condição de Operação:', `${cx('Contínuo', true)}      ${cx('Batelada', false)}`),
    new TableRow({
      height: ALT,
      children: [
        cel('Composição de corrente:', { span: 4, b: true }),
        cel('Entrada', { span: 4, b: true, al: AlignmentType.CENTER }),
        cel('Saída', { span: 4, b: true, al: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      height: ALT,
      children: [
        cel('', { span: 4 }),
        // `fluido` e o nome da corrente; `composicao` costuma trazer memoria
        // de calculo e observacao, que nao cabem nesta celula.
        cel(entradas.map((c) => c.fluido).filter(Boolean).join('; ') || '—', { span: 4 }),
        cel(saidas.map((c) => c.fluido).filter(Boolean).join('; ') || '—', { span: 4 }),
      ],
    }),
    rv('Vazão (kg/h):', vazaoTotal
      ? vazaoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'),

    faixa('CONDIÇÕES DE OPERAÇÃO'),
    rv('Condições normais de operação:',
      `T entrada (ºC): ${soNum(primeira.T)}      T final (ºC): ${soNum(ultima.T)}`
      + `      P entrada (bar): ${soNum(primeira.P)}      P saída (bar): ${soNum(ultima.P)}`),
  ];

  const carga = doProcesso(EQ, /carga t[eé]rmica|calor (fornecido|removido)/i);
  // O rotulo ja diz (kW): repetir a unidade no valor sairia "2 576 kW kW".
  if (carga) linhasUso.push(rv('Carga Térmica (kW):', String(carga).replace(/\s*kW/i, '')));

  linhasUso.push(
    rv('Material de Construção:', EQ.mecanica['Material do costado'] ?? '—'),
    rv('Isolamento:',
      [['Nenhum', 'nenhum'], ['Quente', 'quente'], ['Frio', 'frio'],
        ['Proteção Pessoal', 'pessoal']]
        .map(([rot, k]) => cx(rot, (f.isolamento ?? ['nenhum']).includes(k)))
        .join('      ')),
    new TableRow({
      height: ALT,
      children: [
        cel('Controles do processo:', { span: 4, b: true }),
        cel(['Temperatura', 'pH', 'Fluxo', 'Concentração']
          .map((c) => cx(c, (f.controles ?? []).includes(c))).join('      '),
        { span: 8 }),
      ],
    }),
    new TableRow({
      height: ALT,
      children: [
        cel('', { span: 4 }),
        cel(['Nível', 'Pressão', 'Vazão']
          .map((c) => cx(c, (f.controles ?? []).includes(c))).join('      '),
        { span: 8 }),
      ],
    }),

    faixa('CONDIÇÕES DE PROJETO'),
    rv(HORIZ ? 'Comprimento (m):' : 'Altura (m):', num(g.Ltan)),
    rv('Diâmetro (m):', num(g.Di)),
  );
  if (g.volumeTotal) linhasUso.push(rv('Volume Total (m³):', num(g.volumeTotal)));
  if (g.volumeUtil) linhasUso.push(rv('Volume Útil (m³):', num(g.volumeUtil)));
  if (NIVEL !== null) linhasUso.push(rv('Altura de líquido (m):', num(NIVEL)));
  /* So GEOMETRIA aqui, como no modelo: altura, diametro, volumes e o que for
   * proprio do equipamento (nivel, agitador, camisa). Temperatura e pressao de
   * projeto, espessura, sobrespessura e codigo sao dado de fabricacao e ficam
   * fora — o modelo nao os traz, e cada linha a mais empurra a folha para uma
   * segunda pagina. */
  if (g.agitador?.tipo) {
    const det = [
      g.agitador.Dimp ? `Ø impelidor ${num(g.agitador.Dimp)} m` : null,
      g.agitador.rotacao ? `${g.agitador.rotacao} rpm` : null,
      g.agitador.potencia ? `${g.agitador.potencia} kW` : null,
    ].filter(Boolean).join(' · ');
    linhasUso.push(rv('Agitador:', det ? `${g.agitador.tipo} — ${det}` : g.agitador.tipo));
  }
  if (g.camisa) {
    linhasUso.push(rv('Altura da camisa (m):', num(g.camisa.altura)));
  }

  const utilizacao = tabela(linhasUso);

  /* --------------------------------------------------------- 4. construcao */
  const BOCAIS = (EQ.bocais ?? []).filter((b) => !b.instrumento);
  const linhasTub = BOCAIS.filter((b) => EQ.linhas?.[b.id]).map((b) => {
    const [sigla, descricao, , sched] = EQ.linhas[b.id];
    const pol = POL[b.dn] ?? String(b.dn);
    const corrente = b.corrente ?? b.id;
    return {
      item: `${pol}-${sigla}-${corrente}-${sched ?? ''}`.replace(/-$/, ''),
      descricao,
      sched: (sched ?? '').replace(/\D/g, '') || '—',
      pol,
    };
  });

  const wc = [2400, 3400, 1300, 1600, LARGURA - 2400 - 3400 - 1300 - 1600];
  const construcao = tabela([
    new TableRow({
      height: ALT,
      children: [cel('CONSTRUÇÃO', { span: 5, w: LARGURA, b: true, al: AlignmentType.CENTER })],
    }),
    new TableRow({
      height: ALT,
      children: [
        cel('COMPONENTES:', { b: true }),
        cel(EQ.componentes ?? '—', { span: 4 }),
      ],
    }),
    new TableRow({
      height: ALT,
      children: [cel('TUBULAÇÃO PRINCIPAL:', { span: 5, w: LARGURA, b: true })],
    }),
    new TableRow({
      height: ALT,
      children: [
        cel('Item', { b: true, al: AlignmentType.CENTER }),
        cel('Descrição', { b: true, al: AlignmentType.CENTER }),
        cel('Schedule', { b: true, al: AlignmentType.CENTER }),
        cel('Diâmetro nominal (in)', { b: true, al: AlignmentType.CENTER }),
        cel('Material', { b: true, al: AlignmentType.CENTER }),
      ],
    }),
    ...linhasTub.map((l) => new TableRow({
      height: ALT,
      children: [
        cel(l.item),
        cel(l.descricao),
        cel(l.sched, { al: AlignmentType.CENTER }),
        cel(l.pol, { al: AlignmentType.CENTER }),
        // Material da linha em branco de proposito: a especificacao de material
        // de tubulacao e decisao propria e sera preenchida a mao.
        cel(''),
      ],
    })),
  ], wc);

  /* ---------------------------------------------------- 5. notas e revisao */
  const wr = [2400, 1878, 1878, 1879, LARGURA - 2400 - 1878 - 1878 - 1879];
  const notas = tabela([
    new TableRow({
      height: ALT,
      children: [
        cel('Notas:', { b: true }),
        cel(f.nota ?? '', { span: 4 }),
      ],
    }),
    new TableRow({
      height: ALT,
      children: [
        cel('Revisão nº:', { b: true }),
        ...['1', '2', '3', '4'].map((n) => cel(n, { al: AlignmentType.CENTER })),
      ],
    }),
    new TableRow({
      height: ALT,
      children: [cel('Executado em:', { b: true }), cel(IDENT.data, { al: AlignmentType.CENTER }),
        cel(''), cel(''), cel('')],
    }),
    new TableRow({
      height: ALT,
      children: [cel('Preparado por:', { b: true }), cel(IDENT.desenhadoPor || ''),
        cel(''), cel(''), cel('')],
    }),
    new TableRow({
      height: ALT,
      children: [cel('Aprovado por:', { b: true }), cel(IDENT.aprovadoPor || ''),
        cel(''), cel(''), cel('')],
    }),
  ], wr);

  return {
    EQ,
    /* O cabecalho vai SEPARADO dos demais, para virar header de secao.
     * Como tabela no corpo — que e o que o modelo faz — ele nao se repete
     * quando a folha transborda para uma segunda pagina, e no Google Docs nao
     * e reconhecido como cabeçalho de pagina. Como header, o visual e o mesmo
     * e o comportamento e o correto. */
    cabecalho,
    children: [
      identificacao, vazio(),
      utilizacao, vazio(),
      construcao, vazio(),
      notas,
    ],
    resumo: `${linhasTub.length} linhas de tubulação`
      + (NIVEL !== null ? ` · nível ${num(NIVEL)} m` : ''),
  };
}

/* ==========================================================================
 *  USO DIRETO: uma folha, um equipamento
 * ======================================================================
 *  So roda quando o arquivo E o programa. Importado por
 *  gerar-datasheet-geral.mjs, este bloco ficaria de fora — senao a folha
 *  consolidada gravaria, de quebra, um R-01-datasheet.docx a cada execucao.
 */
const EH_PROGRAMA = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (EH_PROGRAMA) {
  const TAG = process.argv[2] || 'R-01';
  if (!EQUIPAMENTOS[TAG]) {
    console.error(`Equipamento "${TAG}" nao existe em src/data/plant.js.`);
    console.error(`Disponiveis: ${Object.keys(EQUIPAMENTOS).join(', ')}`);
    process.exit(1);
  }

  const { EQ, cabecalho, children, resumo } = montarEquipamento(TAG);

  const doc = new Document({
    creator: IDENT.empresa,
    title: `Folha de Especificação — ${EQ.tag}`,
    description: `${EQ.nome} — ${IDENT.projeto}`,
    sections: [{
      properties: { page: PAGINA },
      headers: { default: new Header({ children: [cabecalho] }) },
      children,
    }],
  });

  const dir = join(aqui, TAG);
  mkdirSync(dir, { recursive: true });
  const saida = process.env.DATASHEET_OUT || join(dir, `${TAG}-datasheet.docx`);
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
  console.log(`OK  ${saida}  (${Math.round(buf.length / 1024)} KB)`);
  console.log(`    ${resumo}`);
}
