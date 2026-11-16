# Geração de documentos — croquis e folhas de especificação

> **Pasta histórica. Não é referência de dados.**
>
> Estes geradores produziram as primeiras versões dos croquis e das folhas de
> especificação. As versões **finais**, revisadas pelo grupo, estão em
> `Especificações dos Equipamentos/` (fora deste repositório, que é público:
> os documentos trazem os nomes do grupo)
> — `Croquis-unificados.pdf` e `Datasheet Global.docx` — e são elas a fonte da
> verdade do projeto. Rodar os geradores hoje produz documentos que **não**
> correspondem aos finais.
>
> A maquete 3D não importa nada daqui. Só abra esta pasta se a tarefa for
> explicitamente gerar ou corrigir croqui/folha de especificação.
>
> As saídas (`<TAG>/`, `Folhas-de-especificacao-consolidado.docx`) foram
> removidas em 22/10/2026 por estarem desatualizadas; continuam no histórico do
> git e são ignoradas se forem geradas de novo.

Documentos para entrega ao professor, gerados a partir dos **mesmos dados** que
alimentam a maquete 3D ([`src/data/plant.js`](../src/data/plant.js)).

Croqui, datasheet e modelo 3D não podem divergir: os três leem o mesmo arquivo.
O croqui usa inclusive a mesma matemática de tampo
([`src/lib/profiles.js`](../src/lib/profiles.js)) que gera a geometria 3D, e o
nível de líquido é calculado por integração do volume útil nos três casos.

## Gerar

```bash
npm run documentos
```

Gera tudo, para todos os equipamentos cadastrados. Para um só:

```bash
npm run documentos -- V-01
```

Ou um documento isolado:

```bash
npm run croqui -- V-01
```

```bash
npm run datasheet -- V-01
```

```bash
npm run pdf -- V-01
```

## Saídas

Uma subpasta por equipamento:

```
geracao-de-documentos/
  R-01/  R-01-croqui.svg   R-01-croqui.pdf   R-01-datasheet.docx
  V-01/  V-01-croqui.svg   V-01-croqui.pdf   V-01-datasheet.docx
         V-01-croqui-sem-cotas.svg   V-01-croqui-sem-cotas.pdf
  Folhas-de-especificacao-consolidado.docx
```

| Arquivo | O que é |
|---|---|
| `*-croqui.svg` | Croqui vetorial A4, vistas frontal e lateral |
| `*-croqui.pdf` | O mesmo croqui em PDF A4, para imprimir ou anexar |
| `*-croqui-sem-cotas.svg` · `.pdf` | O mesmo desenho **sem cotas**, para apresentação e para o corpo do relatório |
| `*-datasheet.docx` | Folha de especificação editável no Word |
| `Folhas-de-especificacao-consolidado.docx` | Todas as folhas num documento só, na ordem do processo |

### Croqui sem cotas

A folha cotada é o documento de fabricação; a limpa serve para apresentação e
para o P&I, onde a linha de cota só disputa espaço com o desenho. São a **mesma
geometria**, geradas do mesmo dado — não há versão que possa envelhecer
sozinha. Sem a faixa reservada às cotas o equipamento cresce na folha, então as
duas costumam sair em escalas diferentes; o carimbo de cada uma informa a sua.

Hoje sai para R-01, V-01, V-02 e TK-01. Para acrescentar outro, ponha a TAG em
`SEM_COTAS`, no alto de [`gerar-todos.mjs`](gerar-todos.mjs). Avulso:

```bash
node geracao-de-documentos/gerar-croqui.mjs R-01 --sem-cotas
```

### Croquis unificados e correção manual

`Novos croquis/Croquis-unificados.pdf` reúne os croquis dos dez equipamentos,
um por folha, na ordem do processo, com a moldura e o carimbo do R-01 e
**todas as cotas em metros**. Cada folha é uma prancha editável do Design do
Claude, em que cada cota, rótulo e peça do desenho é um elemento que se
arrasta à mão. O PDF é montado a partir das pranchas, então uma correção feita
no canvas entra no PDF sem passar de novo pelos geradores.

| Folhas | De onde vêm |
|---|---|
| R-01, V-01, V-02, TK-01 | `plant.js`, por `gerar-croqui-design.mjs` |
| T-01, CR-01, CR-02 | PDF vetorial de um colega: a vista é imagem; cotas e textos viram elementos |
| F-01, D-01, F-02 | imagens da pasta: os números em mm são apagados e reescritos em m |

```bash
node geracao-de-documentos/gerar-croqui-design.mjs --saida <pasta> --logo <url> --sem-bocais --sem-plataforma R-01 V-01 V-02 TK-01
```

```bash
python geracao-de-documentos/preparar-folhas-imagem.py <pasta de preparo>
```

```bash
node geracao-de-documentos/gerar-croqui-design.mjs --saida <pasta> --logo <url> --folhas-imagem <preparo>/folhas-imagem.json --blobs <mapa imagem -> url>
```

```bash
python geracao-de-documentos/unificar-croquis.py --pranchas <pasta com os .dc.html> --assets <mapa id -> arquivo local>
```

- `--sem-bocais` tira a tabela de bocais e os rótulos N1, N2… (os bocais
  continuam desenhados); `--sem-plataforma` tira a plataforma do R-01.
- Com agitador, as cotas verticais vão em cadeia (saia, T/T, tampo,
  acionamento) e a altura total vai do piso ao topo do motor; a altura do
  acionamento vem da maquete 3D e é estimada. Eixo, turbinas e chicanas
  aparecem nas duas vistas.
- Com `camisa`, o vão da camisa sai preenchido e o isolamento a veste; os
  bocais marcados `camisa: true` nascem na parede da camisa.
- As imagens das pranchas são uploads do canvas; o preparo as gera, e os
  mapas dizem a url de cada uma no canvas e a cópia local para o PDF. No
  canvas o R-01 é o `Main.dc.html`.
- O carimbo reveza a equipe pelas folhas (`assinaturas()` em
  [`identificacao.js`](identificacao.js)): quem revisa é quem aprova.

### Folha de especificação — formato

O layout segue o modelo `Datasheet EXEMPLO.docx` (fora do repositório: traz nomes de terceiros), que é a especificação do
professor. Cinco tabelas por equipamento, **uma folha cada**:

| | |
|---|---|
| 1 | cabeçalho — logotipo, `FOLHA DE ESPECIFICAÇÃO — NOME`, `Folha n de N` |
| 2 | identificação — código, função, dimensão, posição, estado, agitado |
| 3 | `UTILIZAÇÃO` + `CONDIÇÕES DE OPERAÇÃO` + `CONDIÇÕES DE PROJETO` |
| 4 | `CONSTRUÇÃO` — componentes e tubulação principal |
| 5 | notas e quadro de revisão |

Detalhes de formatação lidos do próprio modelo, não arbitrados: Arial 6,5 pt,
borda simples de 1,5 pt no contorno e nas divisões, **sem sombreamento** (as
faixas de seção são negrito centralizado) e tabela de 9914 dxa.

Condições de **operação** e de **projeto** são seções separadas: a primeira é o
ponto normal de trabalho, a segunda é a geometria que saiu do dimensionamento.
Não há tabela de bocais — ela é do croqui, não da folha. A coluna **Material**
da tubulação sai em branco, para preenchimento junto com a especificação de
linhas.

Cada equipamento tem de caber em **uma folha**. É o que dita o espaçamento
compacto e o corte da seção de condições de projeto ao essencial; acrescentar
linhas ali empurra para uma segunda página.

### Folha consolidada

```bash
npm run datasheet-geral
```

Um `.docx` com todos os equipamentos, um por página, na ordem do processo. As
tabelas são as mesmas da folha avulsa, por `montarEquipamento()`: duas
montagens poderiam divergir em silêncio, e o professor receberia dois números
diferentes para o mesmo vaso.

### Seleção de materiais

As decisões de material de R-01, V-01, V-02 e TK-01 estão justificadas em
[`Selecao-de-materiais.md`](Selecao-de-materiais.md). A folha traz só a
decisão; o porquê, o que foi rejeitado e a comparação de custo ficam lá.

## Como cadastrar um equipamento novo

Tudo acontece em [`src/data/plant.js`](../src/data/plant.js). Acrescente o
objeto do equipamento e registre-o em `EQUIPAMENTOS`. **Os geradores não
precisam ser tocados.**

Cada elemento do croqui só é desenhado se o dado existir. Um vaso sem agitador
simplesmente não declara `agitador` na geometria, e o desenho sai sem
acionamento; declare `demister` e a malha aparece; declare `plataforma` e a
plataforma com guarda-corpo aparece, com a cota correspondente; declare
`camisa` (`{ base, altura, folga }`) e a camisa de troca térmica aparece em
corte, rente ao costado.

As seções de condições e de materiais do datasheet são geradas a partir dos
dicionários `processo` e `mecanica`, então o que você escrever lá aparece na
folha, na ordem em que estiver.

**A escala do croqui é escolhida automaticamente**: o gerador testa as escalas
normalizadas (1:5 … 1:500) e usa a maior em que o equipamento, mais a faixa
reservada às cotas, cabe na folha. O R-01 sai em 1:75 e o V-01 em 1:20, sem
nenhum ajuste manual.

Ao final, o gerador varre as coordenadas emitidas e avisa se alguma caiu fora
da moldura — uma cota que vaza da folha não aparece no código, só no papel.

## Convenções do croqui

- **Duas vistas, frontal e lateral.** Cada bocal é projetado pela sua posição
  angular real. Um bocal que aponta para o observador não é desenhado naquela
  vista — ele aparece de perfil na outra, que é a razão de existirem duas.
- **Sem instrumentação.** Tomadas de instrumento levam `instrumento: true` na
  tabela de bocais e ficam fora do croqui e do datasheet; a folha reserva um
  campo em branco para a malha de controle ser preenchida à mão.
- **Só linhas que significam algo.** Nada de internos em linha oculta nem de
  estruturas de acesso que se confundam com as cotas.

## Identificação

Campos do carimbo e do cabeçalho em
[`identificacao.js`](identificacao.js), já preenchidos com os dados do
relatório. O logotipo é o `Logo.png` desta pasta; sem ele, os geradores avisam
e caem para o nome da empresa em texto.

Os campos Desenhado / Revisado / Aprovado ficam em branco de propósito, para
assinatura.

## Sobre os valores

Números vindos do dimensionamento oficial aparecem sem ressalva. Os que foram
arbitrados estão marcados **"(estimado)"** no próprio documento, para o
professor não os confundir com dado de projeto.

## Armadilhas já pagas

- **Linha de chamada precisa tocar o objeto.** Encurtá-las para reduzir
  poluição criou tocos flutuantes ligados a nada. A chamada vai do ponto cotado
  até um pouco além da linha de cota.
- **Deslocamento em metros escala junto.** Sobra de linha, recuo de cota e
  deslocamento de etiqueta são em **mm de papel**, convertidos na hora de usar:
  a 1:20, uma "sobra de 0,3 m" vira 15 mm e estoura a moldura.
- **O aviso de moldura não substitui olhar.** Renderize o SVG (Chrome headless,
  `--screenshot`) e confira; "a escada desenhada em cima da cota" só aparece na imagem.
- **Folha de especificação se confere em PDF.** Um `.docx` sintaticamente
  válido pode sair desmontado no Word; exportar via COM do Word e olhar as
  páginas foi o único jeito confiável.
