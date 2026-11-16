# Instruções para sessões do Claude

Maquete 3D navegável (Three.js, entregue como **um HTML único** que abre por
duplo clique) da planta de ácido benzóico de um projeto de graduação em
engenharia química. Tudo em português.

**Antes de começar, leia [`ROTEIRO.md`](ROTEIRO.md):** diz em que fase a
maquete está e qual é a próxima tarefa. Marque o que concluir e registre
decisões no fim dele.

## Repositório público: o que não entra

Este repositório é (ou vai ser) **público**. Em nenhum commit entram:

- **nome de pessoa** nenhum — o autor, colegas do
  grupo, professor, terceiros —, RA, e-mail, telefone;
- **o que liga o projeto ao mundo real do autor**: universidade,
  departamento, código ou nome da disciplina, cidade onde estuda, turma.
  Diga "a universidade", "a disciplina". (O local da planta fictícia —
  Paulínia, RMC — é dado de projeto e fica.)
- **documento do grupo** (relatório, folhas, P&ID, fluxograma, croquis) ou
  qualquer `.docx`, `.xlsx`, `.pptx`, `.pdf`: trazem nomes no texto, no
  carimbo e nos metadados. Vale para o que se gera deles — `src/data/croquis.js`
  são as folhas com o carimbo;
- **segredo** (chave, token, senha, `.env`) e **caminho da máquina**
  (`C:\Users\...`);
- o `artifact/maquete-planta.html` sem conferir: ele empacota tudo o que o
  `main.js` importa.

Como isso se garante: o `.gitignore` já barra esses arquivos; o gancho
`.githooks/pre-commit` recusa documento, segredo, e-mail, caminho e os nomes
listados em `.nomes-privados.txt` (arquivo local, fora do git — um termo por
linha). **Num clone novo, ligue o gancho uma vez:**
`git config core.hooksPath .githooks`, e recrie o `.nomes-privados.txt`.
Não use `--no-verify` para passar por cima de um aviso sem ler o que ele
apontou. Ao escrever no `ROTEIRO.md` ou em comentário, diga "um colega",
"a equipe", "o professor", "o autor" — nunca o nome, nem o de quem pede.

O repositório tem **histórico novo** desde 16/11/2026 (um commit de partida).
O antigo, com os documentos e os nomes, existe só em
`../documentos-privados/historico-antigo.bundle` (o repositório antigo do
GitHub foi apagado). **Nunca junte nada de lá neste repositório** (ramo,
cherry-pick, remoto extra): traria os documentos de volta ao histórico.
Trabalho que só exista lá entra como conteúdo — junção de três vias
arquivo por arquivo, fora do repositório —, nunca como commit.

## Fonte da verdade

Os documentos ficam **fora do repositório**, em `../documentos-privados/`
(a pasta ao lado desta; `DOCS_PRIVADOS` aponta para outro lugar, se preciso).

**`Especificações dos Equipamentos/`** — documentos finais do grupo, como a
equipe os entregou. **Nunca altere nada nesta pasta.** Nenhum número de
processo vem de outro lugar. A hierarquia para conflitos e as divergências já
conhecidas entre esses documentos estão no `ROTEIRO.md`.

**`Especificações dos Equipamentos (revisão da maquete)/`** — cópia dos mesmos
documentos (feita em 23/10/2026) onde entram as mudanças que a maquete pedir
(bomba proposta, cota de apoio, divergência resolvida). Toda alteração nela
vira uma linha na tabela de decisões do `ROTEIRO.md`, para a equipe revisar.

Como ler os arquivos sem perder tempo:

- `Datasheet Global.docx` — `pandoc -t plain` funciona (10 folhas, uma por equipamento).
- `Relatório Atualizado.docx` — o pandoc **descarta os Quadros 03–12**
  (dimensionamento): são tabelas aninhadas em controle de conteúdo. Extraia com
  python-docx percorrendo os `w:tbl` descendentes de cada elemento do corpo.
- `Diagrama PI.pdf` e `Fluxograma de Projeto.pdf` — são desenhos; a extração de
  texto sai embaralhada. Renderize para PNG (PyMuPDF) e olhe a imagem.
- `Croquis-unificados.pdf` — 10 folhas, uma por equipamento; também olhar como imagem.

## Não leia `geracao-de-documentos/`

É a pasta histórica dos geradores de croqui e folha de especificação. Está
**desatualizada** em relação aos documentos finais e a maquete não importa nada
dela. Só abra se a tarefa for, explicitamente, gerar ou corrigir croqui/folha.
`entregaveis/`, citado em sessões e commits antigos, é o nome antigo dela.

## Arquitetura

**Nada é desenhado à mão; tudo é derivado dos números.** Os dados ficam em
`src/data/`; mudar um diâmetro ali muda costado, tampos, bocais, nível de
líquido e ficha juntos. Se você se pegar digitando uma medida fora de
`src/data/`, pare: ou ela é dado, ou é parâmetro de desenho.

- `src/lib/` — primitivas geométricas reutilizáveis (tampo, costado, bocal,
  tubo, agitador, internos, suportes, cotas).
- `src/equipment/` — composição: **só combina primitivas**. Geometria nova vira
  primitiva em `lib/`. Exceção deliberada: `generico.js`, construtor
  paramétrico das famílias sem detalhe próprio.
- `src/data/plant.js` tem os equipamentos com cadastro completo (também lidos
  pelos geradores de documentos); `plant-extra.js`, os que só a maquete usa. Um
  equipamento que existe nos dois é **derivado** por `promovido()`, nunca copiado.
- `src/data/pid.js` — topologia do P&ID: linhas, bombas, válvulas e malhas. Diz
  o que liga em quê; posição e rota são da maquete.
- `src/data/site.js` — implantação: lote, blocos, vias, vento e as distâncias
  mínimas com a fonte de cada uma; calçadas (`REDE_PEDESTRE`), ônibus,
  praça da portaria, veículos de projeto e esquinas. Calçada ao lado de via
  encosta no meio-fio; travessia fica fora do arredondamento da esquina;
  raio de esquina fora da regra só com `motivo` (`ESQUINAS`).
  `src/site/` desenha; `lib/plano.js` faz as contas no plano do chão (as
  mesmas para a auditoria e para as cotas, e a rede de calçadas).
- `src/data/arranjo.js` — onde cada equipamento fica na laje (x, z, giro), regras
  do pipe rack, guindaste, contenção e vent. `main.js` só lê; `site/processo.js`
  desenha. Desde a Fase 11 a posição sai de busca, não de escolha: `GRUPOS`
  (o que anda junto), `ACESSO` (corredores e folgas) e `CUSTO` alimentam
  `src/dev/otimizador.js` (`__otimizarArranjo()`, `__plantaProposta()`), que
  gera `arranjo-proposto.js` — arquivo de saída, não se edita à mão.
- `src/data/rotas.js` — por onde passa cada linha, em passos de isométrico
  (`'y:lat'`, `'z:rack'`, `'x:B'`; a linguagem está em `lib/rota.js`). O rack
  (largura, faixas, pórticos) sai das rotas; `lib/apoios.js` põe postes e guias.
  Desvio de rota só com o motivo escrito no trecho (`desvio`).
- `src/data/instrumentos.js` — onde ficam válvulas e instrumentos;
  `equipment/instrumentacao.js` os monta sobre as linhas já traçadas.
  O bloqueio no limite de bateria (pendência O: gaveta, raquete e
  plataforma) é de `equipment/limiteBateria.js`, com os números em
  `BLOQUEIO_LIMITE` (`rotas.js`); a plataforma fica entre pórticos e com as
  colunas fora dos corredores da laje.
- `src/data/agua.js` — balanço de água da planta (Fase 13): reposição da
  torre e da caldeira, gente, ETA, ETE e a chuva da laje, lidos do Quadro B9
  e do balanço de massa, e o tamanho de cada peça da ETA e da ETE (o
  separador pela API 421). Onde cada peça fica no bloco é
  `arranjoEta()`/`arranjoEte()` em `entorno.js`; a cota da lâmina do
  separador e da equalização segue a drenagem que chega por gravidade
  (`NIVEIS_ETE`, em `pipeways.js`). Primitivas em `lib/tratamento.js`.
- `src/data/entorno.js` — o que se constrói em cada bloco (prédios, tanques,
  utilidades, cerca); `site/entorno.js` compõe; `__auditarEntorno()` mede que
  nada flutua, afunda, sai do bloco ou se sobrepõe. Também a porta de cada
  prédio e a calçada até ela (`PORTAS`), e a entrada do caminhão no armazém
  (`ENTRADA_GARAGEM`: portão, pátio e percurso saem da mesma conta). A placa
  de nome (pictograma em `ICONES`) e o portão de garagem são de
  `lib/predio.js`.
- `src/data/pipeways.js` — corredores fora dos limites de bateria (árvore de
  polilinhas derivada dos blocos e vias), linhas que seguem por eles e as
  bombas de fora; `site/pipeways.js` põe postes e pontes e mede altura livre,
  poste na via, vão, choque e rota (achados no `__auditarEntorno()`).
- `src/data/seguranca.js` — zonas, regras de cobertura (hidrante, canhão,
  lava-olhos, extintor) e rotas de fuga; `site/seguranca.js` escolhe onde cada
  peça cabe e cobre, e `__auditarSeguranca()` mede cobertura, peça na via,
  ignição em zona e rota de fuga.
- `src/data/ambiente.js` — árvores, postes, carros, pessoas e o tráfego
  animado, inclusive o da portaria (`PORTARIA_TRAFEGO`: carros que
  estacionam, ônibus, cancelas); `site/ambiente.js` instancia o que se
  repete e anima o resto, e `__auditarAmbiente()` mede veículo fora da via,
  pedestre fora da calçada e cancela descendo sobre veículo (simula dez
  minutos). Guarita, cobertura, cancela, catraca e abrigo: `lib/portaria.js`.
  Pessoa a mais de 120 m da câmera vai para a camada 1 e não é desenhada
  (`distanciaPessoas`): de longe ela não é clicável, de propósito.
  Trânsito (Fase 19): percurso de veículo passa por `suavizar` (arcos do
  giro do veículo de projeto); manobras de caminhão em `data/ambiente.js`
  (`manobraTanque`, `manobraBau`, pátio `patio-expedicao` em `VIAS`); fila,
  preferência e previsão de 4 s em `bloqueado()`; o auditor mede
  `VEICULO_SALTO`, `_GIRO`, `_x_VEICULO`, `_x_PESSOA` e `_PRESO`.
  `ambiente.atores` e `ambiente.depurar` ficam expostos para o console.
- `src/data/interiores.js` — o programa de cada prédio (Fase 16): as salas
  de cada pavimento, com a fração do eixo maior e o uso, e as folgas.
  `site/interiores.js` divide e mobilia **por regra** (encostar, grade,
  centro; nunca coordenada), com os móveis de `lib/moveis.js` (origem no
  piso, frente em +z). A casca é de `lib/predio.js` (`userData.interno`:
  vão livre, pisos, forros, portas, janelas, escada; `userData.colisores`
  para a câmera). `__auditarInteriores()` (`dev/interiores.js`, com
  `?semfusao`) mede móvel fora da sala, na parede, na porta, sobre outro, e
  se a câmera chega a toda sala. Casa de bombas (incêndio, ETA): a regra
  `casaDeBombas` põe bombas, coletores e o tubo até o tanque; o que fica
  fora do prédio vai no grupo `tubulacao-utilidades`, nunca no do prédio
  (esticaria a caixa dele e a auditoria do entorno acusa).
- `src/data/rotinas.js` — pessoas com rotina (Fase 20): papéis, roupa e a
  agenda de cada um (bloco ou laje, ação, tempo). `site/rotinas.js` escolhe
  o lugar pela ação entre os `lugares` dos móveis (`lib/moveis.js`,
  registrados em `registro.lugares` por `site/interiores.js`) e o caminho
  por busca: `lib/navegacao.js` (grade e A*) dentro dos prédios e na laje,
  a rede de calçadas fora. `__auditarRotinas()`; `rotinas.depurar` no
  console. As portas abrem para elas (`interiores.atualizar(..., gente)`)
  e os veículos as respeitam (`ambiente.pedestres`).
- `src/site/companheiro.js` — o companion (tecla M): segue a câmera no
  modo andar de `core/controls.js` (A ou Espaço duas vezes), a 2–3 m;
  números em `COMPANION` (`data/ambiente.js`).
- `src/data/operacoes.js` — tempos das operações animadas (Fase 21);
  `site/operacoes.js` prende cada cena à espera de um veículo do trânsito
  (descarga de tolueno, carregamento do baú com a porta de enrolar e a
  empilhadeira, portas do ônibus) e roda `__auditarOperacoes()`. Os pontos
  de trabalho são `pontos` dos caminhões (`lib/ambiente.js`); a cortina é
  `userData.portasEnrolar` do prédio; a empilhadeira, móvel com `animar`.
- `src/data/passeio.js` — o passeio automático de câmera (Fase 22; desde
  16/11/2026 cada parada é uma tomada lenta em linha reta (`reta()`) e a seguinte entra com corte
  em fade, sem trecho de ligação): as
  paradas na ordem (capítulo, tipo, TAG/bloco/objeto/ator, segundos, o
  evento a pegar) e os limites de movimento. `site/passeio.js` tira de cada
  parada os pontos (órbita, volta na sala pela porta, visor da boca de
  visita, corredor sob o rack), faz as splines e o perfil de velocidade,
  acerta o relógio dos atores (`a.retido`: fora de cena até a hora) e
  desenha legenda e mini-mapa. `__auditarPasseio()` mede câmera dentro de
  algo (parede, móvel alto, equipamento, rack, tubo), velocidade, tranco,
  giro do olhar, evento perdido,
  parada com o assunto tapado (`ALVO_ESCONDIDO`) e ator que só poderia ser
  reposicionado à vista (`ACERTO_A_VISTA`). Espaço pausa (e congela o
  mundo: `passeio.congelado`), as setas pulam de parada com a tela escura
  e reposicionam os atores (`ambiente.posicionarEm`). Para inspecionar:
  `passeio.pausado = true` e `passeio.inspecionar(dt)` à mão — anda a
  câmera e roda os ganchos de `cena.antesDeRenderizar` juntos.
- `src/site/noite.js` — modo noite (Fase 24, tecla N), números em `NOITE`
  (`data/ambiente.js`): céu, lua, estrelas, refletores (SpotLight) em
  lugares tirados da cena (pontas do rack, sob coberturas, portão do
  armazém), poça de luz sob cada poste, balizamento e a lâmpada da sala em
  que a câmera está. Acende material **pelo nome** (`luminaria`, `farol`,
  `lanterna`, `vidro-janela`, `vidro-fosco`, `letreiro-*`, `placa-empresa`):
  material novo que deva acender a noite leva nome e, se tiver textura,
  `emissiveMap` desde a criação (`emissiveIntensity: 0` de dia).
- Iluminação (Fase 26): `lib/fotometria.js` é a conta de luz única
  (I = I0·cos^m θ ou asa de morcego; `grade()` e `iluminancia()`), usada
  pela `__auditarIluminacao()` (`dev/iluminacao.js`, alvos em
  `data/iluminacao.js`) e pela luz da laje à noite (a grade de lux vira
  textura). Toda luminária leva `userData.luminaria = { fluxo, facho, dir,
  ex, emergencia }`. Na laje: `equipment/iluminacaoLaje.js` com `LUZ_LAJE`
  (`arranjo.js`) e as primitivas de `lib/luminaria.js` (braçadeira na
  coluna, poste no montante — as plataformas registram `userData.montantes`
  —, mastro). O fluxo sai da conta, não de chute.
- Animações (Fase 27): `site/animacoes.js` (plumas das `userData.saidas`,
  ventilador da torre, bolhas do sparger escondidas pelo plano de corte,
  jato do canhão, ponte rolante, CFTV, agitadores com `userData.rpm`),
  `site/vento.js` (copas no shader, biruta; relógio `TEMPO_VENTO`) e
  `site/bandeiras.js`; números em `PLUMAS` (`data/ambiente.js`). Pássaros
  em bando (`data/passaros.js`, `site/passaros.js`, `__auditarPassaros()`);
  quem anda pelo relógio do mundo leva `userData.animarTempo`. Peça que
  gira leva `userData.girante` (fora da fusão).
- `site/mapaPedestre.js` — o mapa da rede de pedestres na tecla P (Fase 28):
  calçada, travessia, trecho na pista e porta sem caminho.
- `src/data/croquis.js` — as folhas do `Croquis-unificados.pdf` (Fase 24),
  geradas por `scripts/croquis-ficha.py` (`npm run croquis-ficha`): saída de
  script, não se edita. **Fora do git** (leva os nomes do carimbo) e fora da
  maquete desde que a ficha saiu; a cópia está em `../documentos-privados/`. O `main.js` marca `ficha.croqui = TAG` em toda ficha
  da árvore do equipamento; `core/ui.js` mostra a miniatura e o visor.
- `src/site/chao.js` — o chão (Fase 14): gramado, brita, vias com as
  esquinas arredondadas, calçadas, travessias elevadas e meio-fio, tudo
  derivado de `site.js` com as contas de `lib/plano.js` (`esquinasDasVias`,
  `contornarEsquinas`, `cortarTravessias`). `__auditarChao()`
  (`dev/chao.js`) mede z-fighting na cena inteira — abra com `?semfusao`.
- `src/lib/furos.js` — furo na chapa atrás do visor da boca de visita: o
  shader de costado, camisa e isolamento descarta o vão do pescoço (marcado
  pelo bocal em `userData.furo`, registrado no `main.js` antes da fusão).
- `src/core/` — cena, câmera, materiais, HUD, etiquetas.
- `src/arquivo/` — o que saiu da maquete mas se guarda (os painéis Ficha e
  Exibição, 16/11/2026). Nada daqui é importado, então não entra no HTML;
  cada arquivo diz no cabeçalho como religar.

## Método: gerar → olhar → medir

Quase todo defeito real deste projeto foi achado **vendo a imagem ou medindo**,
nenhum relendo o código. Depois de mudar algo visível:

1. `preview_start` com o nome `maquete` (`npm run dev`, porta 5180) e screenshot.
   Olhe de verdade: o tampo tem a curvatura certa? o bocal encosta no costado?
2. Rode `__auditar()` no console (`src/dev/auditoria.js`): mede face colada no
   piso, bocal no ar, peça fora da fundação, tubo atravessando costado. Se mexeu
   no terreno, `__auditarImplantacao()` (`src/dev/implantacao.js`, roda também
   no Node) mede distâncias, vento, acesso de bombeiro e caminhão × pedestre.
   Se moveu equipamento, `__auditarArranjo()` (`src/dev/arranjo.js`) mede
   sobreposição, saque de feixe, guindaste, gravidade, sucção e rota de fuga.
   Tubulação: o `__auditar()` traz também a viabilidade medida ao montá-la —
   hidráulica (o líquido só sobe o que a pressão vence), apoio a cada vão,
   guia de riser, sucção sem ponto alto, suspensão descendo, rota contra o
   caminho mínimo. Linha nova que não fecha pede bomba proposta e pendência
   no `ROTEIRO.md`, como a BC-09. E também válvulas e instrumentos: alcance do
   piso, três vias que fecha, trecho reto da placa de orifício, choque, e a
   contagem contra o P&ID.
   A cena é fundida por material ao carregar (`core/fundir.js`); para medir
   peça por peça, abra com `?semfusao`. Desde 16/11/2026 a ficha não separa
   mais unidade (só nos objetos do entorno), e o `__auditar()` na cena
   fundida acusa `APOIO_ATRAVESSA` falso (14): **rode-o com `?semfusao`**.
3. Para entrega: `npm run artifact` gera `artifact/maquete-planta.html`. Teste
   **abrindo por duplo clique** (file://) — servir por HTTP não reproduz o caso
   que já deu tela branca. O build é IIFE de propósito (ver `vite.config.js`).

4. Ronda visual (`src/dev/inspecao.js`): `__inspecao.lista()` e
   `__inspecao.ir(i)` levam a câmera a cada um dos 40 postos e dizem o que
   olhar. As auditorias pegam o que tem regra; a ronda, o que não faz
   sentido ou está pobre. Depois de mudança grande, percorra o grupo
   afetado; posto novo entra na lista com a câmera derivada dos dados.

Se não mediu, diga que não mediu. E quando um número de engenharia não fechar
(balanço, cota de gravidade, carga térmica), aponte — é um projeto de
engenharia química, não só de código.

## Armadilhas já pagas

- Para screenshot, o painel do navegador tem de estar visível
  (`mcp__ccd_view__show_pane` com `preview`); oculto, a imagem vem velha.
- `requestAnimationFrame` **para** com o painel do navegador oculto
  (`document.hidden`): câmera e animação medem zero e parecem defeito. Para
  testar a lógica, chame o update na mão: `cena.controls.update(1 / 60)` em laço.
- `LineDashedMaterial` exige `computeLineDistances()`, senão sai contínua.
- Fundo do céu em `ShaderMaterial` precisa de `toneMapped: false` (com ACES vira cinza).
- Textura de canvas precisa de `colorSpace = SRGBColorSpace`, senão sai lavada.
  E o tom dela é sRGB: um verde discreto no canvas satura no linear (a grama
  saiu limão). Textura procedural vem de `lib/texturas.js`, nunca de imagem.
- (A oclusão de ambiente saiu da maquete em 16/11/2026: `core/realismo.js`
  existe mas ninguém importa. O que segue vale se for religada.)
  Com pós-processamento (`core/realismo.js`), o tone mapping vai para o
  `OutputPass` e pega o céu também: o shader do céu compensa com a inversa do
  ACES (uniforme `compor`). Material novo com `toneMapped: false` precisa da
  mesma conta.
- O mapa de sombra não é refeito todo quadro (`shadowMap.autoUpdate = false`;
  `seguirSombra` em `scene.js`): refaz quando a janela muda de texel ou a
  12 Hz. Medir com `renderer.shadowMap.needsUpdate = true` na mão.
- Chão (Fase 14): sobreposição de peças do MESMO material na mesma altura
  não pisca (é assim que via, curva e esquina se juntam sem operação de
  polígono); material diferente pede 4 cm de altura ou pintura com
  `polygonOffset`. Peça nova no chão: rode `__auditarChao()` com `?semfusao`.
  Arredondamento de esquina só se apoia em trecho reto: o vértice onde
  outra via nasce não vira curva (`juncao` em `esquinasDasVias`).
- Rack de 7 m (Fase 11): as faixas ficam sobre o corredor do meio
  (`RACK.larguraFaixas`), nunca sobre a fila de bombas — o riser de descarga
  furaria a linha. Linha que cruza o rack de lado apoia na longarina e num pé
  do pórtico mais perto (`porticosDoRack` recebe os X dela); a que corre
  baixa no recuo vai pendurada na longarina. Corredor (`corredoresDaLaje`)
  não recebe poste, pórtico nem tubo abaixo de 2,1 m.
- Ângulo de bocal, escada e furo de plataforma é no referencial do vaso: com
  o vaso girado, o do mundo precisa somar o giro (o furo da plataforma do
  R-01 já caiu no lugar errado assim).
- `position` de `Object3D` é somente-leitura: use `.set()`, nunca `Object.assign`.
- Interior de prédio (Fase 16): é uma unidade da fusão (`userData.unidade`)
  para poder apagar de longe; peça que se mexe dentro dele (folha de porta)
  leva `girante`. Por dentro nada projeta nem recebe sombra (a laje
  escureceria tudo), e o pós-processamento se suspende — o GTAO mancha a
  parede lisa de perto. A câmera colide: posição de vista nova não pode
  cair dentro de parede (ela sai livre, mas o enquadramento fica errado).
- Face no mesmo plano pisca também fora do chão: a laje de cobertura do
  prédio, do tamanho exato dele, disputava o pixel com o alto da fachada
  (listras sob a platibanda). Ela fica 1 cm para dentro; peças que se
  encontram num canto (platibanda) não se sobrepõem.
- Peça que se mexe tem de ficar fora da fusão (`core/fundir.js`): marque o
  grupo com `userData.girante` (ou `animar`), senão o ângulo muda e a tela
  não — o braço da cancela ficou abaixado assim, medindo 85°.
- Letreiro de prédio vai na fachada voltada para o centro da área de
  processo (`letreiroPara`, `site/entorno.js`); a porta, na da calçada. São
  lados diferentes de propósito.
- Cálculo duplicado diverge: o nível de líquido vive só em `nivelDeVolume`. Se
  precisar do mesmo número em dois lugares, extraia.
- Trânsito (Fase 19): checagem de início de fase (entrar em cena, começar
  uma ré) olha a fase em que o ator *vai* entrar — no passo seguinte ele já
  andou. Decisão de quem cede não pode depender de o outro ter parado no
  passo anterior: os dois paravam e andavam juntos até se encostar. Os
  ciclos de duração diferente se defasam: impasse aparece aos 40 min e não
  aos 10 — rode `ambiente.atualizar(0.1)` por 90 min no console ao mexer
  nas regras.
- `APOIO_ATRAVESSA` (`__auditar()`) lê toda malha de inox como corpo de
  revolução em volta do y local dela: chapa ou barra larga deitada vira um
  "corpo" que engole as pernas. Barra comprida de pé no y local, depois
  girada (as flanges do capô do filtro).
- Material com `onBeforeCompile` próprio (grão `triplanar`, furo do visor)
  encadeia o anterior: `furar()` chama o que já havia.
- Falha silenciosa é pior que erro: o empacotador do HTML falha alto de propósito.
- Noite (Fase 24): luz nova muda o número de luzes, e isso recompila o
  shader de todo material na primeira vez (~3 s de tela parada). Por isso
  os refletores nascem invisíveis e `noite.preparar()` compila em segundo
  plano (`compileAsync` contra uma cena só com as luzes da noite). Luz que
  liga e desliga sem recompilar: existe sempre, com intensidade 0 (a
  lâmpada da sala). E luz ambiente não serve para "dentro do prédio": ela
  vale para a cena inteira e clareia o lado de fora visto da porta.
- Passeio (Fase 22): checar só os pontos de passagem não basta — a spline
  passa por fora das retas (o arco do F-01 raspava o CR-02); amostre a
  curva. E subir ponto a ponto dá pulo: suba o arco ou a sequência inteira
  junto (`nivelar`). Dentro de prédio nada sobe (furaria a laje).
  Velocidade medida pela corda de 0,5 s encurta na curva e acusa tranco que
  não existe: some cordas curtas.

- FPS muda muito com o estado da máquina (bateria, temperatura, app em
  segundo plano): na mesma vista e com a mesma cena deu 14 e 39 fps com
  uma hora de diferença. Regressão se mede comparando `main` e branch no
  mesmo momento (troca de branch no servidor que já roda, recarrega,
  mede). `renderer.info.render.calls` dobra no quadro que refaz a sombra
  (12 Hz): compare quadros iguais.

## Convenções

Código e comentários em português, sem acento em identificador; comentário
explica **por quê**. Metros na geometria; graus nos dados, radianos no código;
vírgula decimal no que o usuário lê. Todo número novo leva a procedência:
`[OFICIAL]` (documento e folha/seção/equação), `[ESTIMADO]`/`[VERIFICAR]` (com
memória de cálculo no comentário) ou `[ADOTADO]` (entorno da planta, com a
regra usada). Na ficha exibida ao usuário, estimado aparece como `(estimado)`.
