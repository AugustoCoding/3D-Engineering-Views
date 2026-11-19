# Roteiro de construção da maquete

Plano de trabalho da maquete 3D, do estado atual até a entrega ao professor.
Escrito em 22/10/2026, a partir dos documentos finais em
`Especificações dos Equipamentos/`.

**Como usar:** cada fase tem objetivo, tarefas e um critério de "pronto" que se
verifica olhando ou medindo — não lendo código. Trabalhe uma fase por vez, na
ordem. Ao concluir uma tarefa, marque `[x]`; ao decidir algo, registre em
[Decisões](#decisões) no fim. Numa sessão nova com o Claude, basta pedir:
*"leia o CLAUDE.md e o ROTEIRO.md e faça a próxima tarefa aberta"*.

---

## Princípios

1. **Processo = só o que os documentos dizem.** Nenhum equipamento, linha ou
   número de processo é inventado. Quando a maquete precisa de algo que os
   documentos não fixam (a geometria de um trocador do qual só se conhece a
   carga térmica, por exemplo), estima-se *a partir do dado oficial*, com a
   memória de cálculo no comentário e a marcação `[ESTIMADO]`.
2. **Entorno = arbitrado, mas justificado.** Ruas, prédios, tanques de
   armazenagem e utilidades não estão nos documentos do grupo. Cada posição e
   cada distância vem de uma regra escrita (marcação `[ADOTADO]`), fica num
   arquivo de dados e é **medida pela auditoria** — do mesmo jeito que a
   geometria dos vasos é medida hoje.
3. **Gerar → olhar → medir.** O método descrito no [`CLAUDE.md`](CLAUDE.md)
   vale para tudo aqui, inclusive para o layout: planta baixa se aprova vendo.
4. **A entrega é um HTML que abre por duplo clique.** Peso do arquivo e taxa de
   quadros são requisitos desde a Fase 3, não acabamento da última.

---

## Fonte da verdade

| Documento | Revisão | Usar para |
|---|---|---|
| `Datasheet Global.docx` | 10 folhas, 03/09/2026 | Dimensões, materiais, condições, componentes e linhas de cada equipamento |
| `Diagrama PI.pdf` | Rev. 1, 27/09/2026 | Topologia: o que liga em quê, bombas, válvulas, instrumentos, número e classe de cada linha |
| `Relatório Atualizado.docx` | — | Balanços (Apêndices A e B), memorial (Apêndice C), Quadros 03–12, malhas de controle (§6.1), utilidades (Quadro B9) |
| `Croquis-unificados.pdf` | 10 folhas | Forma: tampos, suportação, posição de bocais, acessórios |
| `Fluxograma de Projeto.pdf` | Rev. 0, 14/06/2026 | Tabela de correntes S-01 a S-32 |

**Em conflito:** números → Datasheet, depois Relatório, depois Croqui;
topologia → P&ID. O Fluxograma é a revisão mais antiga e tem a legenda de
equipamentos trocada (E-01/E-02 e V-01/V-02); onde divergir, vale o P&ID.

### Divergências encontradas entre os documentos

A coluna "situação" diz o que vale na maquete hoje. "Padrão" é o que a
hierarquia acima dá enquanto o autor não decidir outra coisa.

| # | Item | O que diverge | Situação | Afeta |
|---|---|---|---|---|
| 1 | **Camisa do R-01** | O croqui final e a versão de 08/10 do `plant.js` traziam **camisa de aquecimento a vapor**. Datasheet (linhas `3"-CW-1A/1B`), P&ID (CW-1A/1B com a V-01), Relatório §6.1 ("utilidade fria") e Quadro B9 (87 m³/h de água) dizem **água de resfriamento** | **Decidido:** água de resfriamento (22/10) | Bocais, linhas e ficha do R-01 |
| 2 | **Dimensões do D-01** | Datasheet: Ø 1,29 × 3,82 m. Relatório (Quadro 08): 5 m³ e 3,82 m. Croqui: Ø 1,80 m, corpo 2,20 m, total 3,10 m sobre pernas | **Decidido:** Datasheet (22/10). Os 3,82 m são a altura do costado: só assim D = √(4V/πH) = 1,29 m fecha os 5 m³ | Nada a mudar |
| 3 | Suportação de CR-01, CR-02 e D-01 | Datasheet: "saia de sustentação". Croquis: fundo cônico sobre pernas/sapatas. A maquete usa fundo elíptico com saia | **Decidido (22/10):** forma dos croquis, números do Datasheet. CR-01 e CR-02 com fundo cônico de 90° sobre pernas — o cone de 90° tem o mesmo volume do tampo elíptico 2:1 (πD³/24), então volumes e níveis do Datasheet não mudam; é o fundo usual para descarregar suspensão. D-01 com fundo elíptico sobre pernas | Forma dos três vasos (Fase 2) |
| 4 | V-02 | Datasheet e memorial (eq. C16): Ø 0,64 × 1,92 m. Relatório, Quadro 05: Ø 0,60 × 1,80 m | Padrão: 0,64 × 1,92 | Nenhum |
| 5 | Material do R-01 | Datasheet e §5.3: AISI 316L. Quadro 03: 304L | Padrão: 316L | Só ficha |
| 6 | Bomba de vácuo | O P&ID usa a mesma TAG **BV-01** no F-01 e no F-02 | **Decidido (22/10):** são duas, uma por filtro — BV-01 (F-01) e BV-02 (F-02) | Quantidade de bombas |
| 7 | Torta F-01 → D-01 | P&ID: `3"-AB/TOL-21-SS304L`. Datasheet: `3"-AB/TOL-23-CS40` (a 21 é o licor-mãe) | Padrão: linha 23, CS40 | Nome e material da linha |
| 8 | Temperatura do TK-01 | Datasheet: 50 °C. Quadro B3 e correntes S-09/S-10: 60 °C | Padrão: 60 °C | Só ficha |
| 9 | Altura do T-01 | Quadro 06 e Datasheet: 2,94 m. Texto do memorial (eq. C19): 2,74 m | Padrão: 2,94 | Nenhum |
| 10 | TAG V-03 repetida | O P&ID usa **V-03** na entrada do reciclo do R-01 (linha 17) e na válvula de expansão antes do T-01 (linha 11/12) | Padrão: a segunda vira `V-03b` em `pid.js` | Identificação |
| 11 | Linha 28 (produto) | P&ID: "6-TORTA-AB-28". Datasheet: 3" | Padrão: 3" | Diâmetro |
| 12 | Material do T-01 | Datasheet: AISI 316L. Quadro 06: AISI 304 | Padrão: 316L | Só ficha |

Resolvidas pela hierarquia, sem ação: o texto do §5.2 troca as correntes 9 e
10 (P&ID e Datasheet: S-09 = lavagem do F-01, S-10 = dissolução no D-01); o
§5.2 chama de "Corrente 06" o que o P&ID separa em S-05 (saída do V-01) e S-06
(após a válvula, entrando no V-02); os Quadros 08 e 09 trazem TAG errada no
cabeçalho (T-01 e CR-01).

### Pendências para a equipe revisar

Coisas que a maquete adotou ou encontrou e que precisam do aval do grupo —
eventualmente com correção nos documentos finais. A maquete segue como se
estivessem aceitas e as marca na ficha de cada item.

| # | Pendência | O que a maquete fez | O que a equipe precisa fazer |
|---|---|---|---|
| A | **Bomba na linha 10 (TK-01 → D-01).** No P&ID a linha tem só as válvulas V-13 e V-20; com os dois vasos atmosféricos, só escoaria por gravidade, com o fundo do TK-01 ~5 m acima do piso | Acrescentou a **BC-09** (proposta, aceita provisoriamente em 22/10): centrífuga ANSI 1½ × 1 × 6, 3,4 m³/h, ~15 m, motor de 0,75 kW. Memória de cálculo em `src/data/plant-extra.js` | Aprovar (e incluir a BC-09 no P&ID) ou decidir por elevar o TK-01 |
| B | **Rótulo da camisa no croqui do R-01** diz "camisa de aquecimento" | Modela camisa de água de resfriamento (decisão 1) | Corrigir o rótulo no `Croquis-unificados.pdf` |
| C | **Linha 13 (topo do T-01) com 3".** Pela eq. C18 passam 0,871 m³/s de vapor: ~180 m/s numa linha de 3". *Medido na Fase 23:* S-13, 11 789 kg/h de tolueno a 110 °C e 1,3 bar; gás ideal, ρ = P·M/(R·T) = 1,3·10⁵ × 92,14 / (8 314 × 383,15) = 3,76 kg/m³ → 0,871 m³/s (a mesma da C18); 3" Sch 40 (Ø int 77,9 mm) → **182,6 m/s**. Para até 30 m/s, Ø int ≥ 192 mm: **8" Sch 40 dá 27 m/s**. (Antes estava "12" daria ~25 m/s": 12" dá ~12 m/s — conta corrigida.) | Segue o Datasheet (3") | Rever o diâmetro da linha 13 no Datasheet e no P&ID |
| D | **Purga S-27** (132 kg/h, no balanço) não está desenhada no P&ID | Desenha a linha ½"-LM-27 como tê na 21, depois da BC-10, até o limite de bateria oeste (tanque de purga TQ-03) | Desenhar a derivação da purga no P&ID |
| E | **Válvulas sem desenho:** o P&ID numera até V-21, mas não há V-04, V-06, V-10 e V-11; o Datasheet do V-01 cita a V-06 na saída de gases | Não modela as quatro | Conferir a numeração das válvulas |
| F | **Temperatura da S-29.** O balanço (Quadro A5) dá 110 °C entrando no TK-01, que opera a 50–60 °C; o E-04 do P&ID deveria resfriá-la, mas não tem carga calculada | Registra; não altera | Calcular a carga do E-04 e a temperatura de saída |
| G | **Suportação no Datasheet.** As folhas do CR-01, CR-02 e D-01 dizem "saia de sustentação"; os croquis desenham pernas | Segue os croquis (decisão 3) | Trocar o texto de componentes das três folhas |
| H | **TAGs repetidas no P&ID:** BV-01 nos dois filtros; V-03 na linha 17 e na válvula de expansão da linha 11/12 | Usa BV-01/BV-02 (decisão 6) e V-03/V-03b | Renumerar no P&ID |
| I | **Pressão do vapor de aquecimento.** O Quadro B9 dá vazões de vapor que correspondem a λ ≈ 2.200 kJ/kg — vapor de ~2 bar, a 120 °C. Isso não aquece o E-02 até 140 °C nem o T-01 a 154 °C; esses precisam de vapor de média pressão (8–10 bar, 170–180 °C), e a vazão sobe ~5–10 % (E-02 ≈ 693 kg/h, T-01 ≈ 1.750 kg/h). O D-01, a 76,7 °C, fica bem com os 2 bar | Mostra as duas vazões na ficha do E-02 | Definir a pressão do vapor por consumidor e refazer as vazões do Quadro B9 |
| J | **T-01 → CR-01 sem bomba.** O T-01 opera a 1,36 bar abs e a linha 32/19 chega ao CR-01 pelo topo, sem bomba no P&ID. A auditoria de viabilidade mede: o concentrado precisaria subir 8,3 m acima da superfície no T-01, e a pressão vence 4,3 m | Acrescentou a **BC-11** (proposta, 23/10), sob o rack, na descarga do T-01: centrífuga ANSI 3 × 2 × 8, 8,3 m³/h, ~30 m, motor de 2,2 kW; a V-05 (LIC do T-01) fica na descarga dela. *NPSH (Fase 23):* o T-01 é um flash, o concentrado sai saturado e só a cota empurra — 2,69 m da superfície (nivelDeVolume) ao eixo, menos 0,03 m de atrito = NPSHa 2,7 m. A 3 × 2 × 8 de antes pedia NPSHr ≈ 3,5 m (BEP ≈ 52 m³/h, trabalhando a 16 % dele); **a maquete passou a BC-11 para 1½ × 1 × 8, o tamanho da vazão** (NPSHr ≈ 1,5 m; a margem pede 2,5 m) | Aprovar a BC-11 (e incluí-la no P&ID). A margem é fina (0,16 m) no nível de operação: no nível baixo de alarme não fecha — se a equipe quiser folga, T-01 ~1 m mais alto |
| K | **BC-02 dispensável.** Aspira do V-01, a 15 bar, e entrega ao V-02, a 1 bar: a diferença de pressão já move o líquido, e a V-08 o despressuriza | Mantém a BC-02, porque está no P&ID; anota na ficha. *NPSH (Fase 23):* se fica, aspira líquido saturado de N₂ a 15 bar — só a cota empurra: 1,65 m − 0,04 m de atrito = **NPSHa 1,6 m, contra NPSHr ≈ 1,5 m** (a 1½ × 1 × 6, a menor ANSI); a margem (ANSI/HI 9.6.1) pede 2,5 m. A maquete não fecha sozinha: subir o V-01 0,9 m faz a linha 03 voltar a subir na saída do E-01 (sifão no condensado, medido) e tira o TT dela do alcance do piso — teria de subir o E-01 junto e pôr plataforma | Confirmar se a BC-02 fica (e por quê) ou tirá-la do P&ID — a diferença de 14 bar já move o líquido; se ficar, E-01 e V-01 ~1 m mais altos |
| M | **Interligação fora do limite de bateria.** O relatório para na flange. Para as linhas chegarem aos blocos faltam: a bomba do tolueno de reposição (TQ-01/02 são atmosféricos e a linha 30 corre a 5,2 m), as bombas de água de resfriamento na bacia da torre (224 m³/h) e o tanque de água de alimentação que recebe o condensado | Acrescentou **BT-01** (2,2 kW), **BAR-01A/B** (37 kW, uma de reserva) e **TQ-AA** (Ø 1,0 × 2,0 m), todos estimados, com memória em `src/data/pipeways.js`. A descarga do caminhão usa a bomba dele. *Velocidade (Fase 23):* com 224 m³/h, a sucção das BAR-01 em DN 200 dava 1,9 m/s (máx. 1,5) e a descarga em DN 150, 3,3 m/s (máx. 3,0); **a maquete passou a DN 250 e DN 200** (1,2 e 1,9 m/s; a sucção uma bitola acima do bocal, com redução excêntrica). O NPSH das três bombas fecha com folga | Confirmar os três e as vazões; incluí-los num fluxograma de utilidades |
| N | **Cenário de alívio das PSVs.** O Datasheet prevê PSV-01 (R-01 N5, DN 100) e PSV-02 (V-01 N4, DN 50), mas não o cenário, a vazão de alívio nem o ajuste. O R-01 é um oxidador: o cenário que governa pode ser reação fora de controle (escoamento bifásico, DIERS), não só fogo externo ou saída bloqueada | Desenha as duas com ajuste a 17,5 bar (pressão de projeto), corpo API 526 pelo DN de entrada (4P6 e 2J3) e descarga para a atmosfera 3 m acima das plataformas próximas — todos estimados | Calcular o cenário e a área de orifício (API 520/521) e decidir se a descarga vai à atmosfera ou a uma tocha |
| O | **Bloqueio no limite de bateria.** Toda linha que cruza o limite pede válvula de bloqueio (e raquete) para isolar a unidade; o P&ID não traz. No rack, a 5,2 e 7,0 m, ela pede plataforma de operação: volante de corrente não serve, porque as faixas do rack são próximas e a corrente cruzaria a linha vizinha | **Decidido em 27/10 (o autor): respeitar — pedido do professor. Feito (Fase 18):** gaveta e raquete nas sete linhas e plataforma por nível do rack nas duas pontas (`equipment/limiteBateria.js`) | Incluir os bloqueios e as raquetes no P&ID |
| P | **Capô dos filtros rotativos.** Com tolueno no licor e na torta, F-01 e F-02 trabalham fechados e inertizados; o P&ID não traz o N₂ do capô nem o vent dele | Desenhado (27/10): capô de borda a borda da cuba, visores e um bocal de vent com flange cega no alto. N1, N3 e N4 mudaram de lugar na cuba e no capô (ver Fase 18) | Incluir no P&ID a inertização (N₂) e o vent do capô para a recuperação de vapor; conferir os bocais no croqui |
| L | **Filtrado do F-01 sem bomba.** A linha 21 sai do filtro a vácuo e vai ao E-03 sem bomba; o F-02, no mesmo serviço, tem a BC-08 | Acrescentou a **BC-10** (proposta, 23/10), entre o F-01 e o rack: ANSI 2 × 1½ × 6, 15,9 m³/h, motor de 3 kW. A purga 27 sai da descarga dela | Aprovar a BC-10 (e incluí-la no P&ID) |
| Q | **Linha 12 (V-03b → T-01) já em duas fases** (Fase 23). A V-03b leva o licor de 15 a 1,3 bar a 154 °C, acima do ponto de bolha: o vapor que o T-01 separa (S-13, 11 789 kg/h) se forma na própria linha. Velocidade homogênea: vapor a 154 °C e 1,3 bar, 3,37 kg/m³ → 0,971 m³/s; líquido (S-12 − S-13 = S-32) 7 860 kg/h a 863 kg/m³ → 0,0025 m³/s; 3" 10S (Ø int 82,8 mm) → **181 m/s**. Mistura a 5,6 kg/m³: erosão pela API RP 14E (C = 100), Ve = 1,22 × 100 / √5,6 = **51,5 m/s**. Nesse regime a linha entra em escoamento crítico e o flash acontece dentro dela | Segue o Datasheet (3"); a V-03b fica na linha, como no P&ID | Levar a válvula de expansão ao bocal N1 do T-01, ou dimensionar a linha 12 para duas fases: ≥ 6" 10S (Ø int ≥ 155 mm, ~48 m/s) |
| R | **Linhas 1A/1B (água da camisa do R-01) com 3"** (Fase 23). 87 m³/h (Quadro B9) em 3" Sch 40 (Ø int 77,9 mm) → **5,1 m/s**, acima de 3 m/s (erosão, golpe de aríete ao manobrar a V-01). 4" Sch 40 (Ø int 102,3 mm) dá 2,9 m/s | Segue o Datasheet (3") | Rever o DN das linhas 1A/1B e dos bocais C1/C2 do R-01 |
| S | **Sucção da BC-04 (29A) com 1", menor que a descarga (29, 1¼")** (Fase 23). 2 690 kg/h a 110 °C (781 kg/m³) = 3,4 m³/h: **1,7 m/s** na sucção, acima de 1,5 m/s; 1¼" dá 1,0 m/s e 1½" (o bocal da bomba), 0,73 m/s. O NPSHa da BC-04 fecha mesmo assim (3,6 m, margem de 2,5 m) | Segue o P&ID (1") | Trocar a 29A para 1½" |
| T | **Linhas 20 e 25 (suspensão do cristalizador ao filtro) com 6"** (Fase 23). Correm afogadas pelo nível do cristalizador: 15 275 kg/h (S-20, 936 kg/m³ → 16,3 m³/h) e 7 780 kg/h (S-25, 961 kg/m³ → 8,1 m³/h) em 6" 10S (Ø int 161,5 mm) dão **0,22 e 0,11 m/s**. Cristal de ácido benzoico decanta abaixo de ~1 m/s (velocidade de deposição, ordem de grandeza de Durand): a linha assoreia. Para 1 m/s, Ø int ≈ 76 mm (3") e 54 mm (2") | Segue o Datasheet (6") | Rever o DN (3" e 2"), ou justificar o 6" (cristal grande, entupimento) e prever lavagem da linha |

### Lacunas de projeto

Coisas que os documentos não fecham e a maquete vai expor:

- **Escoamentos por gravidade:** CR-01 → F-01 (S-20) e CR-02 → F-02 (S-25)
  funcionam pelo nível de líquido do cristalizador, que fica bem acima da cuba
  do filtro. T-01 → CR-01 não (pendência J).
- **Armazenagem e utilidades** (tolueno fresco, produto, vapor, água de
  resfriamento, incêndio) estão fora do limite de bateria do relatório. Os
  números de partida para dimensioná-las estão na Fase 3.

---

## Estado atual (30/10/2026)

- **30 unidades** na cena: os 15 equipamentos principais do P&ID e as 15
  bombas — as oito centrífugas, as duas de torta e as duas de vácuo do P&ID,
  mais as propostas BC-09, BC-10 e BC-11. Com arquivo próprio e detalhe
  completo: R-01, V-01, V-02 e TK-01; as demais pelo construtor genérico.
- Dados de processo conferidos com o Datasheet (Fase 1); topologia do P&ID em
  `src/data/pid.js` — 40 linhas, 15 bombas, 18 válvulas, 26 malhas.
- **Válvulas e instrumentos** (Fase 6): as 18 válvulas de controle e os 26
  instrumentos de campo das malhas, cada um com a ficha da malha inteira;
  contagem igual à do P&ID.
- **Tubulação conforme o P&ID** (Fase 5): 60 trechos e ramais, todas as linhas
  do P&ID e do Datasheet, mais quatro cabeçais de utilidade; 768 m de tubo,
  4,8 % acima do caminho mínimo. Rotas em `src/data/rotas.js`, roteador em
  `lib/rota.js`, apoios em `lib/apoios.js`.
- Laje de 58 × 34 m e pipe rack de 57 m, dois níveis e 11 pórticos, que sai
  das rotas; céu e terreno.
- Câmera em primeira pessoa, corte em seção, "ir para", HUD com ocultação,
  etiquetas com nível de detalhe, auditoria física.
- **Auditoria física e de viabilidade da tubulação: zero achado** (eram 36
  antes da Fase 1). Mede também hidráulica, apoio, guias, sucção, descida e
  comprimento de rota.
- **Implantação em blocos** (Fase 3): terreno de 5,2 ha com processo, tanques,
  utilidades, apoio, prédios, vias e portões; vista de planta na tecla P;
  auditoria de implantação sem achados. Aprovada em 22/10/2026.
- **Arranjo da área de processo** (Fase 4) em `src/data/arranjo.js`: mureta
  com rampas, caixa coletora, área de guindaste, faixas de saque, vent a 15 m,
  CP-01 a barlavento; auditoria de arranjo sem achados.
- **Entorno** (Fase 7): prédios, tanques, utilidades, vias com meio-fio e
  faixas, estacionamento e cerca, texturas procedurais em tudo, e os
  pipeways que levam as linhas dos limites de bateria aos blocos, com as
  bombas de fora (pendência M); auditoria do entorno sem achados.
- **Segurança** (Fase 8): zonas classificadas, distâncias no chão, rotas de
  fuga, o equipamento de combate e emergência posto pela regra de cobertura e
  as válvulas de segurança do R-01 e do V-01; `__auditarSeguranca()` sem
  achados.
- **Ambientação** (Fase 9): árvores, postes, carros, pessoas, placa e o
  tráfego animado; `__auditarAmbiente()` sem achados.
- **Desempenho e navegação** (Fase 10): detalhe estático fundido por
  material, 13–18 ms por quadro na visão geral; vistas prontas nas teclas 1
  a 5, tela de ajuda e controle de Xbox (testado só com controle simulado).
- **Rearranjo** (Fases 11 e 12): laje de 31 × 22 m com rack central de 7 m,
  bombas sob as bordas e corredor de manutenção por baixo, corredores
  pintados, compressor a 15 m do reator; tubulação refeita (729 m) e as
  seis auditorias sem achados.
- **Terreno revisto** (Fase 13, aprovado em 26/10): estacionamento e
  retorno do ônibus dentro da cerca; portaria em ilha com a guarita na
  linha da cerca; acesso com faixas de desaceleração e aceleração; abrigo do
  ônibus de frente para o vestiário; 22 trechos de calçada no meio-fio;
  raio de esquina por veículo de projeto; gramado pela regra; travessias
  fora das esquinas; balanço de água com ETA de 12 m³/h e ETE
  redimensionada. Tudo medido em `__auditarImplantacao()`.
- **Chão** (Fase 14): vias com esquinas arredondadas e sem cruzamento
  piscando, calçada alta contornando as esquinas, 11 travessias elevadas,
  gramado e brita pela regra, 208 árvores e 152 arbustos; auditoria nova de
  z-fighting sem achados.
- **Portaria, ônibus, água e letreiros** (Fase 15): guarita de vidro com o
  porteiro, cobertura de praça de pedágio, cancelas que sobem para cada
  veículo, três carros que entram e estacionam, ônibus que deixa e leva
  operários; ETA e ETE peça por peça pelo balanço, com o separador e a
  equalização enterrados na cota da drenagem; letreiros voltados para o
  processo. Auditorias sem achados.
- **Prédios por dentro** (Fase 16): casca oca com janela de vidro e porta
  que abre, colisão da câmera com paredes e lajes, e o interior de cada
  prédio pelo uso — sala de controle com videowall, laboratório com
  capelas, oficina com ponte rolante, armazém com porta-paletes,
  escritórios, refeitório, vestiário, casas de bombas e de cubículos; só de
  perto. `__auditarInteriores()` sem achados.
- **Entrega** (Fase 17): controle de Xbox real e duplo clique testados no
  Chrome e no Edge; vistas 1 a 9 e ajuda revistas; desempenho medido.
- **Inspeção visual** (Fase 18): ronda de 40 postos (`__inspecao`) e os
  13 achados corrigidos — bloqueio no limite de bateria (pendência O),
  casas de bombas com tubulação, subestação cercada, vidro fosco, rótulos da
  planta, detalhes do compressor e dos filtros. Auditorias sem achados.
- **Vida na planta** (Fases 19 a 21): veículos com o giro do veículo de
  projeto, fila e preferência; pessoas com rotina dentro e fora dos
  prédios; descarga de tolueno, carregamento do baú e ônibus animados.
- **Passeio automático** (Fase 22): tecla G (ou View no controle) e a
  câmera percorre a planta sozinha em 12 min, sem corte, pegando cada
  animação na hora, em laço fechado; Espaço pausa, as setas pulam de
  parada; `__auditarPasseio()` sem achados.
- **Noite e croquis** (Fase 24): tecla N vira a planta para a noite (postes,
  janelas, refletores, balizamento, estrelas); a ficha dos dez equipamentos
  com croqui oficial mostra a folha dele.
- **Hidráulica** (Fase 23): velocidade e NPSH de cada linha com as cotas da
  maquete (`__auditarHidraulica()`); o que o número oficial não fecha virou
  pendência (C, K, Q, R, S, T), não ficha.
- **Nada flutuando** (Fase 25): bocais, apoios, consoles, escadas e camisas
  presos ao corpo; cores da NBR 6493 com faixas e legenda (tecla C), nuvens,
  bússola, texturas de tinta e grade vazada, operários com prancheta.
  `__auditarContato()` sem peça solta (só folgas pequenas) e
  `__auditarApoios()` sem achados.
- **Tudo no `main`** (30/10/2026): Fases 22 a 25, das duas sessões, juntas e
  medidas juntas; o HTML de entrega gerado desse estado.

---

## Fases

```
 0 Limpeza ─ 1 Dados ─ 2 Equipamentos ─ 3 Implantação ─ 4 Arranjo do processo
   ─ 5 Tubulação ─ 6 Bombas/válvulas/instrumentos ─ 7 Entorno ─ 8 Segurança
   ─ 9 Ambientação ─ 10 Desempenho e navegação
   ─ 11 Rearranjo do processo ─ 12 Tubulação no arranjo novo
   ─ 13 Terreno revisto ─ 14 Vias, calçadas e áreas verdes
   ─ 15 Portaria, ônibus, água e letreiros ─ 16 Prédios por dentro
   ─ 17 Controle de Xbox e entrega ─ 18 Inspeção visual
   ─ 19 Veículos de verdade ─ 20 Pessoas com rotina ─ 21 Operações animadas
   ─ 22 Passeio automático de câmera ─ 24 Noite e croquis na ficha
```

Por que nessa ordem: o que o professor avalia é o processo, então ele fica
certo primeiro (1–2). A implantação em blocos (3) vem antes do arranjo fino (4)
porque decide a orientação e o envelope da área de processo. Tubulação (5)
depende das posições; bombas e válvulas (6) ficam sobre as linhas. O entorno
detalhado (7–9) embrulha um processo já fixo. Desempenho é medido desde a 3, e
fechado na 10.

As Fases 11 a 17 vêm da revisão do autor em 26/10. O rearranjo (11) vem
primeiro porque decide o tamanho da laje, e a laje entra nas distâncias do
terreno; a tubulação (12) é refeita sobre as posições novas. Só então o
terreno é revisto (13), com a laje no tamanho final, e construído: primeiro
o chão — vias, calçadas e verde (14), porque portaria, ponto de ônibus e
tráfego andam sobre ele — e depois o que fica em cima (15) e dentro dos
prédios (16). O controle de Xbox e o duplo clique se testam por último,
sobre a cena que vai ser entregue.

### Fase 0 — Limpeza e base ✅ (22/10/2026)

- [x] Duplicatas dos documentos finais e a versão antiga do relatório enviadas
      para a Lixeira do Windows.
- [x] `entregaveis/` renomeada para `geracao-de-documentos/`; saídas
      desatualizadas removidas (ficam no histórico do git) e ignoradas se forem
      geradas de novo.
- [x] `CLAUDE.md` criado: fonte da verdade, aviso para não ler a pasta
      histórica, e o essencial do antigo `CONTRIBUINDO.md` (método,
      arquitetura, armadilhas), que foi removido.
- [x] README aponta para a pasta de especificações, para o `CLAUDE.md` e para este roteiro.
- [ ] **Commit** de tudo isso, incluindo a pasta `Especificações dos Equipamentos/`
      (11 MB; o repositório é privado) e o trabalho não commitado de 08/10.

### Fase 1 — Reconciliar os dados com as especificações ✅ (22/10/2026)

Objetivo: cada número da maquete aponta para um documento da pasta, e as
divergências estão decididas.

- [x] O autor decidiu as divergências 1, 2 e 6 e a lacuna da linha 10
      (pendência A); delegou a 3, decidida pela hierarquia (forma do croqui,
      números do Datasheet).
- [x] Camisa do R-01 como água de resfriamento: bocais C1 (entrada, embaixo) e
      C2 (saída, em cima) em 3", linhas CW-1A/CW-1B na tubulação, ficha com a
      conferência do U exigido (≈ 433 W/m²·K).
- [x] `src/data/plant.js` auditado contra o Datasheet, folha por folha (70
      correções): diâmetro de bocal = diâmetro da linha do Datasheet; material e
      tag de cada linha; T-01 e CR-02 em 316L; correntes 09/10 do TK-01 e do
      D-01 destrocadas; R-01 recebe a 17; V-01 libera a 05; CR-01 sem bocal
      próprio para a 26 (entra pela V-16); instrumentação do R-01 pelo §6.1.
- [x] `src/data/plant-extra.js` auditado: bocais de E-01, E-03, F-01, F-02 e
      CP-01 nos diâmetros das linhas; F-02 com 1,77 m (Quadro 11); fichas dos
      filtros com lavagem, rotação e material.
- [x] Filtros giram a 0,50 rpm (Datasheet). Antes davam uma volta a cada 36 s,
      que é o tempo de filtração por volta, não o período.
- [x] `src/data/pid.js` criado a partir do P&ID Rev. 1.
- [x] Bomba BC-09 proposta na linha 10, com primitiva nova `src/lib/bomba.js`
      (servirá às demais bombas na Fase 6).

**Pronto quando:** nenhum valor sem procedência no código; a auditoria física
não ganha achado novo (os 28 que restam são de traçado e suportação e têm fase
própria). Citar a fonte também nas fichas exibidas foi descartado pelo autor.

### Fase 2 — Completar os equipamentos de processo ✅ (22/10/2026)

Objetivo: os 15 equipamentos principais do P&ID na cena.

- [x] E-02 — pré-aquecedor casco-tubo, 394 kW, vapor no casco: Ø 0,40 × 3,0 m,
      ~17 m² (memória em `plant-extra.js`, `GEOM`).
- [x] E-04 — condensador de topo do T-01, ≈ 1.150 kW: Ø 0,50 × 3,0 m, ~19 m².
      Com ele entrou a BC-04 (do P&ID) e o caminho 13 → E-04 → 29A → BC-04 → 29.
- [x] E-01 e E-03 redimensionados pela memória de cálculo (o E-01 tinha o dobro
      da área necessária); CP-01 com o tamanho de um pacote de ~355 kW.
      Os bocais dos trocadores passaram a ser derivados da geometria.
- [x] Fundos e suportação pela decisão 3: CR-01 e CR-02 com fundo cônico de 90°
      sobre pernas contraventadas; D-01 sobre pernas. Perfil cônico novo em
      `lib/profiles.js`, pernas em `lib/supports.js`. O nível do CR-01 com o cone
      dá 3,31 m (Datasheet: 3,32), como previsto pela igualdade de volumes.
- [x] Camisa do R-01 desenhada (`criarCamisa` em `lib/vessel.js`), com o vão da
      água visível no corte; a faixa da camisa fica sem isolamento. Entrada e
      saída a 180° uma da outra; a saída, no vão da escada, não cruza mais o
      passadiço.
- [x] Achados de suportação corrigidos: a escada do R-01 pousa num bloco de
      concreto, e a saia dos vasos genéricos encosta na tangência em vez de
      subir por dentro do fundo.

**Pronto quando:** screenshot de cada equipamento novo ou alterado conferido
contra o croqui/folha; auditoria sem achado de equipamento (os 11 que restam
são de traçado de tubulação, Fase 5).

### Fase 3 — Plano de implantação (planta baixa em blocos) ✅ (22/10/2026)

Objetivo: decidir **onde fica cada coisa no terreno** antes de modelar qualquer
prédio. Saída: `src/data/site.js` e uma vista de planta aprovada.

Implementado e aprovado pelo autor em 22/10/2026. Os números estão
em `src/data/site.js`, cada um com a fonte; tecla **P** abre a vista de planta.

```text
                              N ↑                  vento predominante de SE ↖
 ┌────────────────────────────────────────────────────────────────────┐  cerca de 225 × 230 m
 │ [TANQUES: tolueno 2 × 377 m³ e purga 55 m³]   [DESCARGA de         │  a sotavento:
 │ [ em bacia, com anel de acesso em volta ]       caminhão-tanque]   │  o que pode
 │ ══════════════════════ via norte / serviço ═══════════════════════ │  ◄═ portão de serviço
 │              [TORRE de resfriamento]                               │
 │ [ETE]   ┌──── anel de acesso ────┐  ║  [ÁGUA DE INCÊNDIO]          │
 │         │   ÁREA DE PROCESSO     │  ║  [CALDEIRA] [SUBESTAÇÃO]     │
 │         │   laje de 58 × 34 m    │  ║                 [ARMAZÉM]    │  ◄═ portão de expedição
 │         └────────────────────────┘  ║ via principal                │
 │ [OFICINA] [SALA DE CONTROLE] [LAB]  ║                              │
 │ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ faixa verde ~~~~~~~~~~~~~~~~~~ │  a barlavento:
 │   [BRIGADA]  [ADMINISTRAÇÃO]  [REFEITÓRIO]          (encontro)     │  pessoas
 └────────────────────────────────── portaria ────────────────────────┘
   [ESTACIONAMENTO]
 ════════════════════════════ via pública ═════════════════════════════
```

Regras que o desenho segue — todas medidas por `src/dev/implantacao.js`
(`__auditarImplantacao()` no console, ou direto no Node):

- **Distâncias** de borda a borda pela BN-DS-C69 (Red-Bag, rev. 2014, matriz
  pública para refinaria e petroquímica) e, nos tanques, pelo NFPA 30. As de
  referência do setor (GAP.2.5.2, CCPS) são pagas: **a confirmar** com a
  bibliografia da disciplina, NR-20 e ABNT NBR 17505. As que governam o
  desenho: processo ↔ prédio ocupado 60 m, ↔ tanques 60 m, ↔ descarga de
  caminhão 45 m, ↔ caldeira/subestação 30 m, ↔ sala de controle e apoio 30 m,
  ↔ torre 15 m, ↔ limite do lote 60 m; tanques ↔ limite 15,2 m; costado a
  costado ≥ 1/6 da soma dos diâmetros.
- **Vento de SE** (estação experimental de Campinas, 1956–2004: 37,5 % das
  observações; de maio a julho aparece vento de S). Pessoas ficam a barlavento
  do processo, dos tanques e da descarga; caldeira e subestação, a barlavento
  do processo e dos tanques. O ponto de encontro alternativo fica a sudoeste,
  a barlavento quando o vento vira de S.
- **O R-01**, ponto de maior risco, já está no quadrante noroeste da laje, o
  mais longe das pessoas. A tomada de ar do CP-01 fica para a Fase 4.
- **Caminhões** entram por dois portões de serviço a leste e vão direto à
  descarga de tolueno ou à doca do armazém; nenhuma rota cruza calçada nem
  área de pessoas.
- **Bombeiro** alcança processo e tanques pelos quatro lados.
- **Vent do S-04**: fica dentro da área de processo, junto ao V-01, de onde a
  linha 04 sai (Fase 4) — não virou bloco separado.

Tarefas:

- [x] Tabela de distâncias mínimas com fonte citada (`DISTANCIAS` em `site.js`).
- [x] Vento predominante confirmado: de SE, com fonte registrada (`VENTO`).
- [x] Fora do limite de bateria, a partir dos documentos: tanques de tolueno
      para 15 dias de S-30 (2 × 377 m³) e de purga S-27 (55 m³), bacia para o
      maior tanque. Vapor 2.637 kg/h (Quadro B9, pendência I) e água de
      resfriamento 224 m³/h (158 do Quadro B9 + 66 do E-04) dimensionam caldeira
      e torre na Fase 7.
- [x] `src/data/site.js`: lote, blocos, tanques, vias, portões, calçadas, rotas
      de caminhão, distâncias, regras de vento e de acesso.
- [x] Blocos como placas coloridas, vias, calçadas e rotas no chão
      (`src/site/implantacao.js` + `lib/terreno.js`), e a **vista de planta**
      (`core/planta.js`, tecla P) com as cotas que governam o desenho.
      Câmera em perspectiva alta e de campo estreito, não ortográfica — ver o
      cabeçalho de `planta.js`.
- [x] Auditoria de implantação: distâncias, costados, barlavento, bombeiro,
      caminhão × pedestre, lote, sobreposição. Passa com zero achado.
- [x] O autor aprovou a planta baixa (22/10/2026).

**Pronto quando:** o autor aprovou a planta baixa (screenshot) e a auditoria de
implantação passa. Só então se constrói prédio.

### Fase 4 — Arranjo da área de processo ✅ (22/10/2026)

Objetivo: posicionar os 15 equipamentos dentro do bloco de processo como numa
planta real. O arranjo saiu de `main.js` e virou dado (`src/data/arranjo.js`);
`src/site/processo.js` desenha mureta, caixa coletora e área de guindaste, e
`src/dev/arranjo.js` (`__auditarArranjo()`) mede o resultado.

```text
 N ↑                                               vento de SE ↖
 ┌──────────────────────────────────────────────────────────────┐
 │ ┌─────────┐  R-01     E-01    V-01    V-02                    │
 ◄ │guindaste│                                    TK-01 (180°)  │
 │ └─────────┘           E-04  BC-04                             │
 │             E-02   T-01     E-03                 BC-09        ►
 │ caixa → ETE ═══════════════ pipe rack ═══════════════         │
 │             CR-01    F-01    D-01    CR-02    F-02            │
 │                                                       CP-01   │
 └──────────────────────────────▲───────────────────────────────┘
  rampas na mureta: ◄ guindaste (oeste)  ► manutenção (leste)  ▲ pedestres (sul)
```

- [x] Sequência do fluxo ao longo do pipe rack central: ao norte reação e
      recuperação de solvente, ao sul purificação, de oeste para leste.
- [x] Cotas que atendem os escoamentos por gravidade: nível do CR-01 e do
      CR-02 acima do eixo do tambor do filtro com 1,5 m de margem. (A linha
      TK-01 → D-01 não precisa: tem a BC-09, pendência A.)
- [x] Espaço de saque do feixe tubular de E-01, E-02, E-03 e E-04 (casco + 1 m,
      largura do casco + 1 m), desenhado na vista de planta.
- [x] Área livre de 12 × 12 m para guindaste a oeste do R-01, pintada no piso,
      com rampa na mureta para ele entrar.
- [x] Bombas com sucção curta (≤ 5 m): BC-09 na borda do rack junto ao TK-01,
      BC-04 junto ao E-04.
- [x] Contenção de derrame: mureta de 15 cm com rampas nos três acessos e
      caimento para uma caixa coletora a oeste (≈ 270 m³ retidos ≥ 74,6 m³ do
      CR-01).
- [x] Duas rotas de fuga da plataforma do R-01: segunda escada a 60°.

Achados da auditoria corrigidos no caminho: T-01 e E-03 estavam sobre sapatas
do rack; o CP-01 estava a sotavento e aspiraria vapor de tolueno; o vent do
S-04 saía abaixo da plataforma do R-01 (agora a 15 m, 3 m acima dela).

**Pronto quando:** auditoria mede folgas, saques e cotas de gravidade sem
falhas; vista de planta do bloco conferida. — Feito: `__auditarArranjo()` com
zero achado.

### Fase 5 — Tubulação conforme o P&ID ✅ (23/10/2026)

Toda linha sai de dados: o que liga em quê vem de `src/data/pid.js` (com as
correntes S-01…S-32 dos Quadros A3–A5, os códigos do Quadro 13 e as pressões
do Quadro B3); por onde passa vem de `src/data/rotas.js`, escrito em passos
de isométrico; `lib/rota.js` transforma os passos em vértices e tira das
rotas o pipe rack. Se um equipamento muda de lugar, linha, rack e apoios
acompanham.

- [x] `tubulacao.js` reconstruído a partir de `pid.js` e `rotas.js`: 44
      trechos de processo, 16 ramais de utilidade, 4 cabeçais (CWS, CWR, STM,
      COND) e 3 pontas abertas (vent, respiro, tomada de ar). Cada linha é
      clicável e mostra identificação, fluido, DN, material, corrente com
      vazão, composição, T e P, comprimento e curvas.
      Cor por código de fluido: utilidades pela NBR 6493, processo uma cor
      por código.
- [x] Pipe rack refeito a partir das rotas: 57 m de borda a borda da laje,
      dois níveis (processo a 5,2 m, utilidades a 7,0 m), largura e faixas
      por coloração de intervalos, 11 pórticos postos onde nenhuma linha
      cruza a estrutura, bandeja contínua sob as linhas de até 2".
- [x] Bocal de fundo sai pela passagem da saia (R-01, V-01, T-01) e chega por
      cima ao bocal de topo; nós com tê: V-14, V-15, V-16, V-03b, V-08 e a
      purga P-27.
- [x] Limites de bateria na borda da laje, com flange e destino: oeste (ETE,
      tanques de tolueno e de purga) e leste (torre, caldeira, armazém). Os
      pipeways até os blocos foram para a Fase 7, que constrói os blocos.
- [x] **Viabilidade física**, medida (regras em `rotas.js`, medição em
      `tubulacao.js`, relatório em `__auditar()`):
      - hidráulica: o líquido que sai de um vaso só sobe o que a pressão dele
        vence, seguindo a cadeia por nós e trocadores — apontou duas linhas
        sem bomba (pendências J e L) e a 07, que agora vai a dreno fechado;
      - suspensão e torta sempre descendo (CR-01 e CR-02 subiram nas pernas
        para isso); sucção de bomba sem ponto alto;
      - apoio a cada vão admissível (ASME B31.1, Tab. 121.5) fora do rack —
        35 postes e berços postos onde o piso deixa; riser alto guiado por
        costado (9 guias) ou pela borda do rack; vent de 15 m estaiado;
      - rota otimizada: cada trecho comparado ao caminho mínimo (ortogonal,
        ou o canônico pelo rack); desvio só com motivo escrito em `rotas.js`.
        No total, 768 m contra 733 m mínimos.

**Pronto quando:** cada linha do P&ID existe, é clicável e mostra a mesma
especificação do documento; nenhum tubo atravessa equipamento, via ou prédio.
— Feito: auditoria física e de viabilidade sem achados.

### Fase 6 — Bombas, válvulas e instrumentos ✅ (23/10/2026)

Válvulas e instrumentos montam sobre as linhas já traçadas
(`src/equipment/instrumentacao.js`); o que liga em quê vem de `pid.js`
(`VALVULAS`, `MALHAS`), onde fica vem de `src/data/instrumentos.js`.

- [x] Bomba centrífuga com motor e base: `lib/bomba.js` (nasceu com a BC-09).
- [x] Bomba de cavidade progressiva com tremonha (BD-01, BD-02) e todas as
      bombas de processo na cena — adiantado para a Fase 5, porque as linhas
      precisavam delas.
- [x] Primitivas: bomba de vácuo de anel líquido (`lib/bomba.js`), válvula
      globo com atuador de diafragma e de três vias (`lib/valvula.js`),
      transmissor, poço termométrico, radar, placa de orifício, densímetro e
      capilar (`lib/instrumento.js`), chapéu, corta-chamas e filtro de
      admissão (`lib/pontas.js`).
- [x] As 18 válvulas de `VALVULAS`. As de nó tomam a forma das linhas: duas
      portas em linha dão globo; três, com um par em linha, três vias — a V-15
      e a V-16 foram re-roteadas para isso. As de linha vão no trecho que a
      via do P&ID indica, em reto e horizontal, fora de vaso, ao alcance do
      piso (≤ 2,5 m). A V-03b desceu para 1,65 m (trecho bifásico de 2,5 m
      até o T-01, anotado em `rotas.js`).
- [x] BV-01 (22 kW) e BV-02 (11 kW) entre cada filtro e o rack, com a linha de
      vácuo (6" e 4", estimadas) do cabeçote de válvula do tambor e a
      exaustão com chapéu.
- [x] Os 26 instrumentos de `MALHAS`: no bocal (R-01: LT com capilar, TT), no
      costado, no tampo (radar), na cuba do filtro e na linha (PT, TT, placa
      de orifício com trecho reto de 10 D/5 D, densímetro). A ficha mostra a
      malha até o elemento final (ex.: LT → LIC → V-02).
- [x] Filtro de admissão no CP-01, chapéu no vent do S-04 e nas exaustões de
      vácuo, corta-chamas no respiro do TK-01.
- [x] Auditoria: válvula sem lugar ou fora de alcance, três vias que não
      fecha, placa de orifício sem trecho reto, atuador ou instrumento
      batendo em tubo ou equipamento, instrumento de linha fora de alcance e
      **contagem contra o P&ID: 18/18 válvulas, 26/26 malhas, 15/15 bombas.**

**Pronto quando:** a contagem bate com o P&ID, item por item. — Feito.

### Fase 7 — Construir o entorno ✅ (23/10/2026)

Sobre a planta aprovada na Fase 3. Prédios como volumes simples com fachada
gerada por canvas — sem texturas externas, para o HTML continuar leve. O que se
constrói em cada bloco está em `src/data/entorno.js`; `src/site/entorno.js`
compõe e `__auditarEntorno()` (`src/dev/entorno.js`) mede: nada flutua, nada
afunda, nada sai do bloco nem se sobrepõe.

- [x] Pipeways dos limites de bateria até os blocos (`src/data/pipeways.js`,
      `site/pipeways.js`): cada linha sai da flange da borda da laje na faixa
      e na cota que tinha no rack (5,2 ou 7,0 m) e segue sem bolsão até
      tanques, torre, caldeira e armazém. Coluna única no meio do
      acostamento, a 1 m do meio-fio; via e rampa de veículo só por cima, em
      ponte treliçada (10 pontes, altura livre mínima de 5,18 m contra 4,5 m
      da IT 06). Descarga de tolueno da baia aos TQ-01/02 e drenagem fechada
      enterrada da caixa coletora à ETE, com caixas de inspeção. Medido ao
      montar e mostrado no `__auditarEntorno()`: altura livre, poste na via,
      vão sem apoio, coluna e objeto atravessados, tubo × tubo, rota contra o
      caminho mínimo (todas ≤ 1,15 ×), sucção sem ponto alto. Pedem
      equipamento que o P&ID não traz: pendência M.
- [x] Parque de tanques de tolueno e de purga (API 650, teto cônico, escada
      com gaiola), bacia de contenção de 1,0 m com escadas de transposição, e
      baia de descarga com cobertura e dois braços.
- [x] Utilidades: caldeira de pacote com chaminé de 18 m e compressor de ar de
      instrumento, torre de resfriamento de duas células, subestação com dois
      transformadores e casa de cubículos, tanque de água de incêndio e casa
      de bombas, ETE com três bacias e casa de química. A chaminé do vent
      S-04 saiu da lista: o vent ficou junto ao V-01, estaiado (Fase 5).
- [x] Edificações: sala de controle (sem janela para o processo),
      laboratório, oficina, armazém com docas na via de serviço,
      administração, refeitório, brigada e portaria. A porta de cada uma fica
      no lado da calçada ou via mais próxima — medido, não digitado.
- [x] Meio-fio que abre nas esquinas e nas calçadas, faixa central nas vias
      principal e pública, faixas de pedestre onde a calçada cruza a via,
      estacionamento demarcado, cerca de tela e portões de correr.
- [x] "Ir para" agrupado por zona (Processo, Utilidades, Armazenagem, Apoio) e
      camadas Processo, Tubulação, Válvulas e instrumentos, Entorno. A camada
      Segurança chega com a Fase 8.
- [x] Texturas procedurais (`src/lib/texturas.js`): concreto, laje com junta a
      6 m, asfalto, brita, grama, capim, calçada, aço, inox escovado, chapa de
      tanque, capa de isolamento, grade de piso, telha e painel de torre.
      Nascem em canvas com semente fixa (≈ 180 ms na abertura, zero byte de
      imagem) e são projetadas pela posição no mundo (triplanar), no mesmo
      grão em metros em qualquer peça. Os blocos mostram o piso real na vista
      livre e a cor da categoria só na vista de planta, onde ela é legenda.

**Pronto quando:** auditoria de implantação continua passando com os prédios
reais; nada flutua nem afunda no terreno.

### Fase 8 — Camada de segurança ✅ (23/10/2026)

Uma camada ligável no HUD, para mostrar ao professor que o layout foi pensado.

Regras em `src/data/seguranca.js`, composição em `site/seguranca.js`,
medida em `__auditarSeguranca()`. Camada "Segurança" no HUD (desligada por
padrão); o equipamento de emergência fica sempre à vista.

- [x] Distâncias de separação desenhadas no chão, com cota e a fonte de cada
      mínimo — a mesma conta da vista de planta (`medidasDePlanta()`).
- [x] Zonas classificadas ilustrativas (API RP 505 / NFPA 497): respiros dos
      tanques, vent do V-01, respiro do TK-01 e exaustão das bombas de vácuo
      (Zona 1 a 1,5 m, Zona 2 a 3 m); dentro do dique até o topo da mureta;
      descarga de caminhão; área de processo (Zona 2 a 7,5 m e camada de
      0,6 m até 15 m — tolueno é 3,1 vezes mais denso que o ar). Nenhuma
      fonte de ignição (caldeira, subestação) dentro de zona: medido.
- [x] Rotas de fuga pintadas no piso: F1 da laje ao ponto de encontro a
      barlavento (200 m), F2 alternativa para vento de S (109 m), F3 dos
      tanques (156 m), F4 da baia de descarga (287 m). Medido: nada no
      caminho, nenhuma volta a zona classificada depois de sair dela.
- [x] Hidrantes, canhões monitores, chuveiros lava-olhos, extintores e
      birutas, postos pela regra de cobertura, não à mão: 10 hidrantes (todo
      equipamento a 40 m de dois — IT 22), 2 canhões (cada tanque a 45 m de
      um), 3 lava-olhos (bomba, filtro e descarga a 17 m — ANSI Z358.1), 7
      extintores (15 m — NFPA 10), 4 birutas. Alcance medido em planta, em
      linha reta; a escolha usa 85 % dele.
- [x] Válvulas de segurança PSV-01 (R-01 N5) e PSV-02 (V-01 N4): os bocais
      já estão no Datasheet, então nada muda nos documentos. Ajuste a 17,5 bar
      (pressão de projeto), corpo API 526 pelo DN de entrada e descarga para a
      atmosfera 3 m acima das plataformas num raio de 15 m — a mesma regra do
      vent (`equipment/alivio.js`). PSV-01 descarrega a 14,8 m; PSV-02 a
      11,8 m, guiada no vent estaiado. A ponta de cada uma é fonte de zona
      classificada. O cenário de alívio fica para a equipe (pendência N).
      Válvulas de bloqueio no limite de bateria: pendência O.

### Fase 9 — Ambientação ✅ (23/10/2026)

Pouca coisa, e barata: árvores na faixa verde e no estacionamento, gramado,
postes de iluminação, alguns carros, um caminhão-tanque na descarga, figuras
humanas em pontos de escala, placa da Benzoic Industries na entrada. Tudo que
se repete vai em `InstancedMesh`.

Regras em `src/data/ambiente.js`, composição em `site/ambiente.js`, medida em
`__auditarAmbiente()`.

- [x] 52 árvores (faixa verde e bordas do estacionamento, a 15 m ou mais de
      processo, tanques e descarga), 47 postes de 9 m a cada 30 m de via
      (nunca sob ponte de tubos), 25 carros nas vagas — a mesma conta das
      faixas pintadas (`vagasDe`) —, todos em `InstancedMesh`. Placa da
      Benzoic Industries à direita da portaria; operadores, motorista e vigia
      em pontos livres.
- [x] **Tráfego animado** (ideia do autor, 22/10): pessoas, carros e
      caminhões andando pela fábrica. Cada um segue um percurso sobre as vias e
      calçadas de `site.js` — caminhão-tanque do portão de serviço à descarga
      de tolueno, caminhão de produto à expedição, carros ao estacionamento,
      pessoas nas calçadas e faixas de pedestre. Os percursos respeitam a
      separação pedestre/caminhão da Fase 3; a animação liga e desliga no HUD.
      Feito: caminhão-tanque do portão de serviço à baia (25 s de descarga),
      caminhão baú à doca, 4 carros na via pública, 5 pessoas nas calçadas, na
      mão direita, 15 km/h dentro da cerca. Medido: veículo só em via, pessoa
      só em calçada.
- [x] **Gráficos mais realistas** (pedido do autor, 23/10): reflexo de céu
      aberto no metal; sombra na planta inteira, com a janela de sombra
      acompanhando a câmera e refeita só quando muda de texel ou a 12 Hz;
      oclusão de ambiente (GTAO) que desliga sozinha se o quadro passar de
      1/28 s — nesta máquina ela desliga (31 → 65 ms por quadro), e é a
      Fase 10 que a deixa ligada.
- [x] Pessoas articuladas: quadril, joelho, ombro e cotovelo, ciclo de
      caminhada com a cadência amarrada à passada de 0,7 m (o pé não
      escorrega); roupa por função, EPI na área industrial. Carros com
      carroceria de perfil, faróis e lanternas, e rodas que giram pelo que o
      veículo anda; árvores de copa irregular, um verde por árvore.
- [x] **TAG pintada no costado** de 13 equipamentos, como tinta de estêncil:
      de pé nos vasos verticais, ao longo do eixo nos deitados, na face medida
      sem bocal, tubo, escada ou camisa na frente. De perto, a etiqueta
      flutuante some e lê-se a tinta. Filtros (tambor girando, cuba cercada) e
      bombas continuam só com a etiqueta.
- [x] Etiqueta de equipamento atrás de algo sólido — equipamento, prédio,
      costado de tanque, torre, caldeira — some, em vez de ficar a 30 %.

### Fase 10 — Desempenho e navegação ✅ (26/10/2026)

- [x] Medido e cortado: detalhe estático de cada peça fundido por material
      (`core/fundir.js`, 4 213 → 1 199 malhas, sem perder ficha, camada, corte
      nem realce) e sombra só em peça de mais de 15 cm. Visão geral: 13 ms por
      quadro (18 ms quando a sombra é refeita), 1 850 chamadas, 0,8 milhão de
      triângulos — eram ~25/36 ms. Com oclusão de ambiente, 32 ms: nesta
      máquina ela segue desligando sozinha. Auditar peça por peça: `?semfusao`.
- [x] Pontos de vista prontos (`src/data/vistas.js`), teclas 1 a 5, com voo suave.
- [x] Tela de ajuda com os controles (tecla ?), feita da mesma lista de vistas.
- [x] **Controle de Xbox** (ideia do autor, 22/10), pela Gamepad API do
      navegador: analógico esquerdo anda, direito olha, gatilhos sobem e
      descem, direcional troca o "ir para", A abre a ficha do que está na
      mira, LB/RB trocam de vista, Y oculta o HUD. Testado com controle
      simulado; o teste com o controle real foi para a Fase 17.
- [x] Neblina que se afasta conforme a câmera sobe.

O teste por duplo clique no Chrome e no Edge e a cópia do HTML para envio
foram para a Fase 17, depois das mudanças pedidas em 26/10.

### Fase 11 — Rearranjo da área de processo ✅ (26/10/2026)

Pedido do autor (26/10): o meio da laje ficou confuso e de difícil acesso.
A Fase 4 encaixou 30 unidades em 58 × 34 m com o rack no meio — entre a
fileira norte e o rack ficam T-01, E-04, BC-04 e E-03; entre os filtros e o
rack, BC-10, BV-01 e BV-02 — e não há nenhum corredor demarcado. E a Fase 5
otimizou a tubulação **tomando as posições como fixas**, o que nunca foram.
Aqui toda posição é variável: equipamento, bomba, rack (posição, forma e
comprimento) e o próprio tamanho da laje. Só a área de processo; o resto do
terreno é a Fase 13.

A fase trabalha na vista de planta (pegadas, corredores e rack). A cena 3D
muda junto com a Fase 12, para nenhum commit ficar com tubo atravessando
equipamento.

**Continuam valendo** (Fase 4): fluxo em sequência; R-01 longe das pessoas;
CR → filtro por gravidade com 1,5 m de margem; sucção ≤ 5 m; faixa de saque
dos trocadores; área de guindaste de 12 × 12 m com rampa; contenção maior
que o maior vaso; vent e PSVs 3 m acima de qualquer plataforma num raio de
15 m; duas escadas por plataforma.

**Regras novas**, cada uma com fonte e medida pela `__auditarArranjo()`.
Números de partida, a confirmar no começo da fase:

- Corredores pintados no piso: um principal, que atravessa a laje e liga as
  rampas, e secundários até cada equipamento. Largura livre de 1,20 m no
  mínimo (NR-12, item 12.2 — a confirmar) e algo como 3 m no principal, onde
  passa carrinho de manutenção e maca [ADOTADO]. Nada — tubo, válvula,
  instrumento, base, sapata — dentro do corredor abaixo de 2,1 m (pé-direito
  livre, prática da PIP PNE00003 — a confirmar).
- Todo ponto de operação (válvula de controle, instrumento, bomba, ponto de
  amostra, escada) a poucos passos de um corredor (partida: 3 m).
- Folga mínima entre equipamentos por par de famílias (bomba–bomba,
  bomba–vaso, vaso–vaso, reator–demais), de uma tabela com fonte
  (Mecklenburgh, *Process Plant Layout*, ou PIP PNE00003 — a confirmar com a
  bibliografia da disciplina).
- Manutenção: cada bomba sai pelo corredor, cada faixa de saque dá para um
  corredor ou para o anel, e o veículo de manutenção entra pela rampa até os
  equipamentos pesados.
- Fuga: de qualquer ponto da laje, duas direções até uma rampa, com a
  distância de caminhada medida (limite a fixar com fonte — NFPA 101 trata
  de ocupação industrial).

**Compressor junto do reator** (pergunta do autor, 26/10). O CP-01 foi
para o canto sudeste na Fase 4 por uma regra só: a tomada de ar tem de
estar a barlavento, senão aspira vapor de tolueno e o manda para um reator
de oxidação. Como o R-01 ficou a noroeste (a sotavento, longe das pessoas),
as duas regras os puseram em cantos opostos, a ~38 m. Mas a regra é da
tomada, não da máquina, e a distância custa pouco de qualquer lado: 40 m de
duto de 12" na sucção perdem ~0,25 kPa (~0,3 kW a mais no motor); 40 m da
linha 01, de 2½" a 15 bar, perdem ~0,35 bar (~3 kW) [ESTIMADO]. O que pesa:
tomada em ar limpo (fora de zona classificada, longe do vent e das PSVs),
motor de 355 kW fora de zona ou à prova de explosão, e ruído (casa de
compressor). Na fase: CP-01 o mais perto do R-01 que essas três condições
deixarem, medidas.

- [x] Regras novas em `arranjo.js` (`ACESSO`, com a fonte de cada número) e
      o diagnóstico medindo-as nos dois arranjos (`diagnosticar` em
      `src/dev/otimizador.js`). Hoje: 29 das 30 peças a mais de 3 m de
      qualquer caminho livre (não há corredor; só a borda da laje), 11 pares
      a menos de 1 m um do outro, o mais justo com 2 cm (F-01 e BD-01).
- [x] Custo de tubulação para comparar arranjos (`custo`, mesmo arquivo):
      cada trecho de `rotas.js` bocal a bocal, direto no chão se os dois
      estão do mesmo lado do rack, senão subindo a ele; peso ~DN^0,75 e inox
      2×; cabeçais de utilidade com o diâmetro de cada trecho pela vazão que
      ainda passa; trecho fora do limite de bateria até o bloco de destino;
      laje e rack pela área e pelo comprimento (`CUSTO`, estimado — só
      compara arranjos).
- [x] **Uma versão só, a mais econômica** (pedido do autor, 26/10), em vez
      de alternativas. O arranjo é montado por uma gramática (`GRUPOS` em
      `arranjo.js`): rack central de 7 m com as bombas sob as duas bordas e
      um corredor de manutenção de 3,2 m por baixo dele, de ponta a ponta;
      uma fileira de cada lado; corredores transversais a cada 12 m no
      máximo; trocadores com o feixe saindo para fora. A busca (recozimento
      simulado, `__otimizarArranjo()`) escolhe a fileira e a ordem dos
      grupos. Quatro sementes: as duas que respeitam todas as regras chegaram
      ao mesmo arranjo; as outras duas custavam 0,5 % menos, mas cada uma
      quebrava uma regra (penalizada). Saída gerada em
      `src/data/arranjo-proposto.js`; planta em `__plantaProposta()`.
      Resultado, no mesmo modelo de custo: laje de 58 × 34 m para
      30,7 × 22,0 m, tubo de 857 para 672 m, custo total 3 043 → 1 886
      (−38 %); 281 m² de corredor pintado, nenhuma peça a mais de 3 m de um
      corredor, menor folga 0,90 m (entre bombas, que é a regra).
- [x] **CP-01 junto do R-01**: o reator no canto nordeste e o compressor no
      sudeste, do outro lado do rack — 14,9 m entre eles (eram 38,8 m), com
      a tomada no ponto mais a barlavento da laje, o que o otimizador mede.
      Motor de 355 kW dentro da Zona 2 da área de processo: precisa ser à
      prova de faísca (Ex ec), anotar na ficha na Fase 12.
- [x] Rampas da mureta: de veículo nas duas pontas do corredor do rack, de
      pedestre nos quatro transversais. O guindaste do R-01 trabalha da via
      norte do anel, ao lado dele (patolamento de 10 × 10 m, guindaste de
      ~50 t para o acionamento de ~3 t a ~9 m de raio [ESTIMADO]) — sem
      gastar laje.
- [x] O autor aprovou a planta da área de processo (26/10/2026).

A nova laje fica dentro da antiga, com o mesmo centro: toda distância do
terreno só aumenta. O bloco ISBL, o anel e as ligações mudam em `site.js`
junto com a Fase 12.

**Pronto quando:** o autor aprovou a planta do arranjo novo.

### Fase 12 — Tubulação e instrumentos no arranjo novo ✅ (26/10/2026)

Tudo o que a Fase 5 em diante pôs sobre as posições antigas, refeito sobre
as novas.

- [x] `ARRANJO` de `arranjo.js` passou a ser o `ARRANJO_PROPOSTO`; bloco
      ISBL, anel, ligações e calçada do apoio em `site.js` saem da laje nova;
      `__auditarImplantacao()` sem achados. Ao refazer as rotas, três
      correções no arranjo aprovado, remontado pelo otimizador com as regras
      novas (custo 1 886, igual ao aprovado): o corredor transversal norte
      saiu de entre o E-01 e o E-04 — a sucção da BC-04 e da BC-01, que corre
      baixa, o atravessaria — e foi para entre o TK-01 e o V-01; o vão entre
      o T-01 e o E-02 ficou largo (1,8 m), porque ali descem a válvula de
      expansão e as linhas 11, 12 e 16; V-01 e T-01 giraram 180°, com a
      entrada para quem os alimenta. A fileira sul ganhou um terceiro
      corredor transversal.
- [x] Corredores pintados no piso (`site/processo.js`): verde com borda
      amarela os de pedestre, só a borda amarela o do rack. Uma fonte só para
      pintura, apoios, pórticos e auditoria: `corredoresDaLaje()`.
- [x] `__auditarArranjo()` com as regras novas, medidas na cena: CORREDOR
      (equipamento, tubo, válvula ou apoio abaixo do pé-direito de 2,1 m),
      FOLGA, ALCANCE, saque que pode sair para a via, guindaste sobre a via
      do anel, tomada de ar como o ponto mais a barlavento, e a sucção lida
      do P&ID (antes ela dependia de um campo que o arranjo gerado não tem).
- [x] Contenção: a mureta de 15 cm retém 81,9 m³ contra 74,6 m³ do CR-01 —
      fecha, sem subir. Caixa coletora na ponta oeste, sob a borda sul do
      rack.
- [x] Pórtico de virada: o rack avança até o meio do acostamento nas duas
      pontas, e o último pórtico apoia a virada dos pipeways — as colunas
      ficam fora da rampa e o veículo de manutenção passa sob a viga, a 5 m.
      O limite de bateria continua na borda da laje.
- [x] `rotas.js` refeito: 37 trechos, 16 ramais e 6 nós. A bomba sob o rack
      sobe na própria fila de bombas; as faixas ficam sobre o corredor do
      meio (sobre a fila de bombas, o riser de descarga furaria a linha) e
      cada linha do lado de onde vem. Passagens de saia do R-01 e do T-01
      viradas para o rack (`plant.js`), furos da plataforma do R-01 no
      referencial do vaso, que girou 90°.
- [x] Apoios novos que o rack de 7 m pede: a linha que cruza o rack de lado
      apoia na longarina de borda e, se o vão ainda passar, num pé sobre a
      viga do pórtico, posto perto dela; a que corre baixa no recuo, colada
      ao rack, vai pendurada na longarina do nível 1. Poste de piso usa as
      peças com altura (cabe sob a plataforma do R-01). Vent do V-01 com os
      três estais sem 120° exatos — o lado do rack não tem âncora.
- [x] Viabilidade inteira de novo, sem achados: 729 m de tubo contra 677 m
      mínimos (eram 768 m); a cena peça por peça (`?semfusao`) também zera.
- [x] Bombas propostas: as três continuam necessárias — o arranjo não muda
      as cotas que as pedem (TK-01 atmosférico abaixo do D-01, T-01 a
      1,36 bar abaixo do topo do CR-01, filtrado de filtro a vácuo).
      Pendências A, J e L sem mudança.
- [x] Válvulas, instrumentos e PSVs ao alcance; contagem do P&ID igual
      (18/18, 26/26, 15/15). A V-17 foi para junto do CR-01 (a descida da
      32 passava por cima dela junto à V-16).
- [x] Pipeways re-derivados (o de oeste desvia a meio caminho para entrar no
      anel dos tanques pelo ponto de antes; a purga para antes da última
      curva, que a 30 faz por dentro dela); segurança e ambientação
      recalculadas, operadores nos corredores; seis auditorias sem achados.
- [x] **TAG pintada voltada para fora** da área de processo (13 equipamentos;
      F-01 e F-02 seguem só com a etiqueta). O CP-01 ficou com a TAG virada
      para o rack: a face de fora dele não tem superfície cilíndrica livre.
- [x] Curvas da tubulação lisas e cilíndricas (pedido do autor, 26/10):
      o tubo era um `TubeGeometry` reamostrado em passos iguais, e o
      cotovelo caía entre dois anéis — parecia canudo dobrado. Agora a casca
      é varrida com um anel em cada ponto e 12 no arco do cotovelo
      (`lib/pipe.js`).

**Pronto quando:** as seis auditorias passam com zero achado, a contagem
bate com o P&ID e se anda a pé do R-01 ao F-02 só por corredor. — Feito.

### Fase 13 — Terreno revisto ✅ (26/10/2026)

A planta baixa da Fase 3 com o que faltou, aprovada de novo antes de
construir.

- [x] **Estacionamento dentro da cerca**, depois da portaria (pedido do
      O autor, 26/10). A cerca desceu até 1 m da via pública (lote de
      225 × 259 m, 5,8 ha); o estacionamento (40 vagas; 38 desde a Fase 14) entra pela via que
      sai da principal logo depois da guarita. Carro é fonte de ignição:
      ≥ 60 m do processo, dos tanques e da descarga, como prédio ocupado
      [ADOTADO, BN-DS-C69], e a barlavento deles — mede 94,5 m do processo.
- [x] **Portaria**: guarita do lado leste da via, logo dentro do portão,
      com a calçada passando entre ela e a pista (o porteiro vê o carro na
      cancela e o pedestre na janela) e um portão de pedestre separado do de
      veículos. A ADM recuou 4 m para a calçada passar na frente dela.
- [x] **Ponto de ônibus interno**: o ônibus entra pela portaria, vira a
      leste e dá a volta num retorno circular; na volta para numa baia de
      24 m fora da faixa, do lado norte, e a calçada leva ao vestiário (32 m
      a pé). Retorno com eixo de 10 m e pista de 7 m: borda externa de
      13,5 m e ilha de 6,5 m, contra 12,8 e 7,1 m do veículo de projeto O do
      DNIT (Manual de Projeto de Interseções, 2005 — **a confirmar**), com
      0,5 m de folga. Medido: a rota inteira do ônibus fica sobre via.
- [x] **Rede de calçadas cobrindo a planta** (pedido 1): de 5 para 17
      trechos — portaria, ponto de ônibus, frente e fundo dos prédios, as
      duas rampas de pedestre da laje (sul e, nova, a do corredor do
      reator), torre, ETA, tanques (pela escada da bacia), descarga, ETE,
      utilidades, armazém e os dois pontos de encontro, com faixa onde cruza
      via. Ao lado da via principal, 1,25 m de faixa de serviço entre a pista
      e a calçada, onde ficam poste de luz e pé de ponte de tubos. Largura de
      2 m, faixa livre de 1,20 m (NBR 9050 — a confirmar).
      Medido (`__auditarImplantacao()`, regras novas): nenhuma calçada corre
      ou termina na pista nem corta bloco; a rede é uma só (a laje liga as
      duas rampas); todo bloco com gente a até 10 m dela; 13 pares de
      origem e destino a no máximo 1,45 vez a linha reta; caminhão e
      pedestre ainda separados. O pipeway passou a tratar calçada como
      obstáculo de poste, e o canhão monitor M-01 ditou onde passa a calçada
      dos tanques.
- [x] **Água** (pedido 6): balanço em `src/data/agua.js`, que lê as vazões
      do Quadro B9 e o balanço de massa. O processo não consome água; a
      torre leva 92 % da tratada.

      | | m³/h |
      |---|---|
      | Reposição da torre (evapora 6,3; purga 2,0 com 4 ciclos; arraste) | 8,4 |
      | Reposição da caldeira (90 % de condensado volta; purga de 5 %) | 0,4 |
      | Consumo humano (50 pessoas/dia) e laboratório | 0,3 |
      | **Demanda de água tratada** | **9,1** |

      **ETA** de 12 m³/h ao lado da torre (poço, filtros de areia
      Ø 1,3 m, abrandador, reservatório de 218 m³ = 24 h, castelo d'água
      de 5 m³), bloco de 18 × 26 m. **ETE** redimensionada: 3,0 m³/h
      contínuos (S-07, purgas, rejeito da ETA, esgoto, laboratório) mais a
      chuva da laje; equalização de 130 m³ (o que a mureta segura + 8 h),
      biológico de 15 m³ só para o que tem carga orgânica, decantador de
      Ø 2 m; bloco de 26 × 20 m, encostado na calçada que vem da laje.
      Todos [ESTIMADO]/[ADOTADO], com a conta no arquivo; a ficha do bloco
      na vista de planta mostra o balanço.
- [x] **Números que não fechavam**, achados no balanço:
      a ficha da torre dizia 3,9 MW — era a vazão com 15 K de faixa; a
      soma dos consumidores é 5,0 MW, e a faixa sai 19 K porque o R-01
      devolve a água a 50,5 °C. E a drenagem fechada da laje seguia com
      DN 150 da laje antiga: a chuva de 100 mm/h na laje nova dá 68 m³/h e o
      DN 150 a 1 % leva 55 — passou a DN 200, escolhido pela conta.
- [x] `__auditarImplantacao()` sem achados, e as outras cinco também, com e
      sem fusão. De passagem: no `?semfusao` a auditoria de arranjo acusava a
      plataforma do R-01, a 9,4 m, sobre a faixa do perímetro — desde a
      Fase 12; a regra de corredor passou a medir só abaixo do pé-direito,
      como já fazia com tubo e válvula.

**Segunda rodada** (26/10) — o autor olhou a planta e pediu mais. A
primeira versão da portaria, do ponto de ônibus e das calçadas acima foi
substituída por esta. Os arredondamentos e o chão em 3D são da Fase 14; o
que fica em cima, da 15.

- [x] **Portaria numa ilha no meio da via**, como a entrada de um campus
      (desenhado pela descrição do autor): guarita
      envidraçada na ilha entre a pista de entrada e a de saída, com visão
      de 360°, **o porteiro dentro dela**; uma cancela em cada pista, ao lado
      da guarita; cobertura sobre as duas pistas, a ilha e as calçadas, como
      numa praça de pedágio, com 5 m livres. A cerca do sul passa pela linha
      das cancelas — nada entra sem passar por elas —, e o pedestre entra
      pela catraca, na calçada de cada lado, debaixo da cobertura.
      `PRACA_PORTARIA` em `site.js`. Fila antes da cancela: 26,5 m, contra
      15 m pedidos (um ônibus ou dois carros).
- [x] **Acesso da via pública sem curva de 90°**: a via pública desceu para
      z = 155; quem entra sai por uma faixa de desaceleração paralela e faz
      uma curva de 14 m, quem sai faz a mesma curva e entra numa faixa de
      aceleração. Comprimentos pela cinemática [ESTIMADO] enquanto a tabela
      do DNIT não é conferida: 25 + 15 m (de 40 para 20 km/h a 2 m/s²) e
      55 + 15 m (de 15 para 40 km/h a 1 m/s², ônibus carregado). Os portões
      de caminhão ganharam curva de 15 m fora da cerca (a via pública leste
      foi 15 m para leste).
- [x] **Veículos de projeto** do DNIT (VP, CO e O) em `VEICULOS`, com a
      regra nova **CURVA**: a pista da curva comporta o veículo dela
      (largura do veículo mais o arraste da roda traseira, L²/2R). As pistas
      da portaria passaram a 5 m: o ônibus varre 4,7 m na curva de 14 m.
      Dimensões e raios dos veículos **a confirmar** na tabela do DNIT.
- [x] **Ponto de ônibus que se entende**: o ônibus entra, vira a leste logo
      depois da portaria, dá a volta no retorno e para na baia, de frente
      para o **abrigo coberto** (12 × 2,85 m, ~40 pessoas). O mesmo ponto
      serve de manhã, para descer, e no fim do turno, para esperar. Do lado
      do abrigo sai um caminho único, em linha reta até a porta do vestiário
      (20 m a pé). A sinalização no chão é da Fase 15.
- [x] **Calçada na borda da via, como na cidade**: encostada no meio-fio,
      com 2 m = 0,70 m de faixa de serviço + 1,30 m de faixa livre (NBR
      9050:2020: serviço ≥ 0,70 e livre ≥ 1,20 m). Onde não há via, caminho
      pelo gramado. Regra nova **SOLTA**: calçada paralela a uma via, a
      menos de 8 m dela, tem de encostar no meio-fio. Rede refeita: 22
      trechos, uma rede só, todo bloco a ≤ 10 m, 13 pares a no máximo 1,44
      vez a reta.
- [x] **Esquinas arredondadas**: raio pelo menor veículo que faz a curva
      [ADOTADO] — 6 m carro, 10 m caminhão (e bombeiro), 12 m ônibus —, com
      exceção escrita e o motivo (`ESQUINAS`, como o desvio de rota). Regra
      nova **ESQUINA**: as 30 esquinas têm via para a curva dos dois lados e
      nenhum arredondamento invade bloco (a ETA recuou 2 m e o estacionamento
      7 m por causa disso). A calçada contorna a esquina; a geometria é da
      Fase 14.
- [x] **Meio-fio só onde faz sentido** (confirmado: as "muretas" eram o
      meio-fio): onde há calçada, canteiro ou gramado do lado; na brita das
      áreas industriais, a borda da pista fica no nível do chão, com
      sarjeta. Construído na Fase 14.
- [x] **Áreas verdes no espaço vazio**: regra `CHAO` — o que não é bloco,
      via ou calçada é gramado, menos a faixa de brita a 15 m de processo,
      tanques e descarga (a mesma regra das árvores) e um contorno de 3 m nas
      utilidades. Nada fica sem uso por construção. Gramado, canteiros e
      árvores em 3D são da Fase 14.
- [x] **Travessia elevada** em 11 pontos, onde a calçada cruza a via.
      Regra nova **TRAVESSIA**: nenhuma fica dentro do arredondamento de uma
      esquina (o pedestre atravessaria na curva, numa travessia comprida);
      por isso as travessias ficam 1,5 m além da esquina. Dimensões pelo
      CONTRAN, Res. 738/2018 — plataforma de 5 a 7 m na altura da calçada
      (até 15 cm) e rampas — **a confirmar** se a Res. 973/2022 a
      substituiu.
- [x] `__auditarImplantacao()` sem achados com as regras novas (SOLTA,
      FILA, CURVA, ESQUINA, TRAVESSIA), e as outras cinco também, com e sem
      fusão. De passagem: clicar num prédio dava erro no realce (a fachada
      tem um material por face) — desde a Fase 7, corrigido.
- [x] **O autor aprovando a planta baixa** — aprovada em 26/10, na segunda rodada.

### Fase 14 — Vias, calçadas e áreas verdes ✅ (27/10/2026)

O chão da Fase 13 construído de verdade (`site/chao.js`). Vem antes da
portaria e do ônibus porque eles andam sobre ele.

- [x] **Rede viária sem cruzamento piscando**, com as esquinas arredondadas
      e as faixas de aceleração e desaceleração. Sem operação de polígono:
      a via é a soma de faixas, curvas e arredondamentos de esquina, todos no
      **mesmo material e na mesma altura** — a sobreposição entre eles sai
      da mesma cor e não pisca. O que piscava eram faixas de cores
      diferentes (via principal, de acesso e pública) e a zebra no plano da
      calçada. As curvas do próprio eixo (os cantos do anel) viram arco no
      raio da esquina; cada esquina em T ganha a peça que o arredondamento
      acrescenta. A conta das esquinas saiu da auditoria para
      `esquinasDasVias()` em `lib/plano.js`: a mesma serve à auditoria e ao
      desenho.
- [x] **Alturas novas do chão** (`lib/terreno.js`, Y), a 4 cm ou mais uma da
      outra: gramado (lote), brita, via, placa de bloco e calçada — esta 15
      cm acima da pista, a altura do meio-fio.
- [x] **Calçada contornando a esquina** com o arco concêntrico ao dela
      (`contornarEsquinas()`), alta, com a lateral servindo de meio-fio.
      **Meio-fio** separado só onde a pista encosta no gramado; na brita a
      borda fica no nível do chão.
- [x] **Travessia elevada** nas 11 travessias: a calçada é cortada onde
      cruza a pista e no lugar entra a plataforma na altura dela, com 5 m no
      sentido do tráfego, rampas de 1,5 m e a zebra pintada em cima. O
      veículo sobe a rampa e desce do outro lado (o ônibus da Fase 15 passa
      por uma).
- [x] **Gramado e brita**: o lote é gramado; a brita é a da regra `CHAO`,
      com cantos redondos. **Paisagismo**: 208 árvores — as filas da faixa
      verde e do estacionamento, mais o alinhamento ao longo das calçadas (a
      cada 10 m, 2,5 m fora da borda) e bosques nos gramados grandes, sempre
      a 15 m ou mais do que pega fogo, fora da brita e longe de pipeway — e
      152 arbustos nos canteiros em volta dos prédios de gente, com a frente
      da porta livre. Tudo instanciado: a vista geral foi de 1 797 para 1 821
      chamadas de desenho e de 0,67 para 0,82 M triângulos; `render()` leva
      12,6 ms na CPU (a GPU não foi medida — Fase 17).
- [x] **Auditoria nova `__auditarChao()`** (`dev/chao.js`): Z_FIGHTING —
      superfícies de materiais diferentes a menos de 4 cm, sobrepostas em
      planta, em tudo o que deita no chão ou na laje — e travessia sem
      calçada dos dois lados. Mede peça por peça (`?semfusao`): 1 507
      superfícies, sem achado. Na primeira passada achou, além do
      cruzamento, defeitos antigos: as fitas pintadas dos corredores da laje
      (1,5 e 2,5 cm acima dela), a base de extintor e lava-olhos, a grelha
      da caixa coletora e o fundo das bacias da ETE no plano da placa do
      bloco. Pintura passou a usar deslocamento de profundidade; as peças
      subiram.
- [x] Pipeway, segurança e ambientação passaram a ver a pista nova das
      esquinas (em faixas de 0,5 m que seguem o arco).
- [x] **Revisão do autor (27/10), com prints**: arredondado demais, e
      três lugares com defeito — pontas soltas na ligação leste com o anel,
      um triângulo de brita no meio do asfalto onde a via norte nasce no
      anel dos tanques, e linhas na brita da caldeira e da subestação.
      - Raios de esquina **pela metade**: 3 m carro, 5 m caminhão, 6 m
        ônibus. As travessias, postas além da esquina, chegaram mais perto
        dela sozinhas.
      - As pontas soltas e o triângulo tinham a mesma causa: a peça de
        arredondamento de uma esquina em T se apoiava num trecho do anel que
        já tinha virado curva, e o canto onde outra via nasce virava curva e
        cortava o pé dela. Agora o vértice onde outra via nasce não vira
        curva — ganha só o arredondamento de dentro (`juncao`) — e a esquina
        em T só conta o trecho reto da outra via (a regra ESQUINA mede isso).
      - As linhas eram o degrau de 12 cm entre a placa do bloco e a brita em
        volta. Nas utilidades de piso de brita (caldeira, subestação, ETA e
        ETE) a placa do bloco virou o próprio piso: cresce 3 m, de cantos
        redondos, e para antes da pista (`expandirAteVias`).
      - A exceção de 6 m da esquina da lig-norte com o anel caiu (a regra já
        dá 5 m); o caminho ao sul da torre passou a 3 m dela, longe do anel.
- [x] O estacionamento ficou com **38 vagas**: a coluna da borda leste deu
      lugar à passagem da calçada da portaria.
- [x] As sete auditorias sem achados (`?semfusao`); as seis de sempre também
      na cena fundida.

### Fase 15 — Portaria, ônibus, água e letreiros ✅ (27/10/2026)

Construir o que fica sobre o chão da Fase 14, como a Fase 13 aprovou.
Primitivas novas em `lib/portaria.js` (guarita, cobertura, cancela, catraca,
abrigo, pintura no chão) e `lib/tratamento.js` (poço, vaso de pressão,
castelo d'água, caixa enterrada, separador, decantador).

- [x] **Portaria em ilha**: guarita de vidro nos quatro lados (de 1,0 a
      2,6 m), com balcão e **o porteiro dentro, visível pelo vidro**, de
      frente para a pista de entrada; **cobertura tipo praça de pedágio** de
      21 × 12 m sobre as duas pistas, a ilha e as calçadas, em seis pilares,
      5 m livres (a IT 06 do CBPMESP pede 4,5 m) e o letreiro
      "BENZOIC INDUSTRIES · PORTARIA"; uma catraca em cada calçada, na linha
      da cerca.
- [x] **Duas cancelas**, uma por pista. O veículo para com a frente a 1,2 m
      do braço, espera 3 s (o porteiro libera), o braço sobe a 85° em 1,5 s
      e desce depois que ele passa. **Três carros** de funcionário entram,
      estacionam de frente nas vagas da fileira norte (que ficam reservadas
      para eles), ficam um tempo, saem de ré e vão embora pela pista de
      saída; o resto do estacionamento tem os carros parados de antes.
- [x] **Abrigo do ônibus** coberto, para 40 pessoas, com banco e operários
      esperando, e o caminho até o vestiário com as bordas pintadas de
      amarelo e "VESTIÁRIO" / "ÔNIBUS" escritos no chão.
- [x] **Ônibus**: vem pela via pública, entra pela faixa de desaceleração,
      para na cancela, dá a volta no retorno (anti-horário) e para na baia;
      quatro operários descem e vão pelo caminho até o vestiário, três que
      esperavam no abrigo embarcam, e ele sai pela pista de saída. Para 30 s
      no ponto e volta 70 s depois.
- [x] **ETA e ETE detalhadas**, cada peça no tamanho da conta (`agua.js`) e
      no lugar de `arranjoEta()` / `arranjoEte()` (`entorno.js`):
      - **ETA**: poço tubular com laje sanitária e quadro da bomba no canto
        mais longe das vias; dois filtros de areia pressurizados de Ø 1,3 m;
        abrandador de duas colunas com tanque de salmoura; reservatório de
        218 m³ (Ø 7 × 6 m); castelo d'água de 5 m³ (Ø 2,0 × 1,6 m) com fundo
        a 12 m; casa de química e bombas junto da calçada. **Sem
        clarificador nem desmineralização**, que o roteiro citava como
        exemplo: água de poço tem pouca turbidez, e a caldeira é
        flamotubular de 8–10 bar — abrandar basta.
      - **ETE**: separador água-óleo pelo **método da API 421** — gota de
        150 µm de tolueno, 2,0 × 8,5 m com 1,0 m de lâmina, 5,9 vt de
        velocidade horizontal no pico de chuva (a norma aceita até 15);
        equalização de 130 m³ (7 × 7 m, 3 m de lâmina); aeração de 15 m³
        (2,5 × 2,5 m) com o borbulhar dos difusores; decantador de Ø 2 m
        com ponte e calha; dois leitos de secagem de lodo; casa de química
        e sopradores junto da calçada. O efluente anda em U e a faixa norte
        fica livre para o caminhão de vácuo.
      - **A cota não fechava**: a drenagem chega por gravidade a 1 %, com o
        fundo do tubo 1,54 m abaixo do piso, e as bacias da ETE (já na Fase
        7) eram abertas acima do chão. Separador e equalização agora são
        **enterrados, com laje e tampas** (o separador com respiro e
        corta-chamas, por causa do tolueno); a lâmina fica 0,1 m abaixo do
        tubo, a da equalização 0,15 m abaixo dela (`NIVEIS_ETE`, em
        `pipeways.js`, que segue a drenagem). Da equalização, bomba
        submersível manda ao tanque de aeração (recalque de DN 50 desenhado),
        e dele o efluente desce por gravidade ao decantador.
      - A drenagem, que atravessava o bloco até o oeste, entra direto no
        separador pela borda leste: 37 m de DN 200 em vez de 62.
      - **Rota das purgas — para a equipe revisar**: o `agua.js` dimensiona
        o biológico para 0,56 m³/h (só o que tem carga orgânica: S-07,
        esgoto e laboratório), mas mandava as purgas também à equalização,
        de onde tudo seguiria junto. Desenhado como fecha com os números:
        purgas da torre e da caldeira e rejeito da ETA vão direto ao
        lançamento; S-07 vem pela drenagem → separador → equalização →
        biológico; esgoto e laboratório chegam pela rede sanitária.
- [x] **Letreiros voltados para o centro da fábrica**: o nome grande vai na
      fachada que olha o meio da área de processo, quando ela está à vista
      (nenhum prédio a menos de 8 m na frente; no refeitório não está, e o
      letreiro fica sobre a porta). A porta continua do lado da calçada, com
      uma plaquinha. No prédio de dois pavimentos o letreiro vai no alto, e
      no galpão acima dos portões. Não se planta árvore nos 15 m diante do
      letreiro (208 → 201 árvores). Vale para as casas da subestação, da ETA
      e da ETE.
- [x] **Auditorias**: `__auditarAmbiente()` simula dez minutos do tráfego e
      mede a cancela (CANCELA_SOBRE_VEICULO: braço abaixo de 80° com
      veículo debaixo), o veículo fora da via (o ônibus inclusive) e o
      pedestre fora da calçada ou do abrigo. A primeira passada achou o
      ônibus parando atrás do fim da curva e voltando de ré pelo braço:
      agora ele para sobre a curva. As sete auditorias sem achados
      (`?semfusao`); as seis de sempre também na cena fundida.
- [x] O braço da cancela não subia na tela embora o ângulo medisse 85°: a
      fusão (`core/fundir.js`) o juntava ao estático. Marcado `girante`.
- [ ] Não medido aqui: o HTML aberto por duplo clique (o painel do navegador
      não abre `file://`; o build passou) — fica para a Fase 17.

### Fase 16 — Prédios por dentro ✅ (27/10/2026)

Pedido do autor (26/10): os prédios **entráveis e com coisas dentro**.
Eram volumes fechados com a fachada pintada.

- [x] **Prédio oco** (`lib/predio.js`): parede de 20 cm com a fachada de
      fora e o reboco de dentro; **janela de verdade**, recortada nas duas
      faces, com vidro fumê no meio da espessura; **vão de porta** de 1,8 ×
      2,3 m no lado da calçada, com duas folhas que **abrem para dentro
      quando a câmera chega** a 3,5 m e fecham quando ela sai; piso cerâmico,
      forro, laje com platibanda ou telhado de galpão. No ADM (dois
      pavimentos), laje entre eles e **escada reta** (espelho de 17,5 cm,
      piso de 28 cm, 1,2 m de largura, 1,5 m livres antes do primeiro
      degrau) com o vão na laje e guarda-corpo. Os vãos de porta e de janela
      saem de uma conta só (`vaosDaFachada`), que a pintura e a geometria
      leem.
- [x] **Colisão** (`core/controls.js`): paredes, lajes, telhado e divisórias
      são caixas; a câmera (esfera de 0,3 m) anda eixo a eixo e para no eixo
      que bateria, escorregando ao longo da parede. Medido: para a 0,3 m da
      face, passa pela porta, não atravessa a laje. O voo até um ponto de
      vista não colide. A guarita de vidro também colide (a porta dela fica
      fechada: é o porteiro quem abre). 109 caixas.
- [x] **Interior pelo uso** (`site/interiores.js`, programa em
      `data/interiores.js`, móveis em `lib/moveis.js`): as salas de cada
      pavimento se dividem ao longo do eixo maior, com divisória de 12 cm e
      porta de 0,9 m no meio — nunca sobre a porta do prédio nem sobre a
      escada. Os móveis entram **por regra, nunca por coordenada**:
      encostados na parede (o que é mais alto que o peitoril não tapa
      janela), em grade com a passagem de 0,9 m, ou no meio; 1,2 m livres
      diante de cada porta e no pé e na chegada da escada.
      - **Sala de controle**: videowall na parede cega, a que olha o
        processo, e o console de frente para ele a 2,6 m, com três telas
        do sinótico por posição; supervisão com mesa de reunião.
      - **Laboratório**: duas capelas de exaustão no fundo, bancadas com
        prateleira longe das janelas e sem prateleira embaixo delas, a
        bancada central; sala de reagentes com armários.
      - **Oficina**: bancadas com painel de ferramentas, torno, furadeiras e
        **ponte rolante** de 5 t sobre a oficina; **almoxarifado** com
        estantes em fileiras.
      - **Administração**: térreo com arquivo e escada, **recepção** (balcão
        de frente para a porta, longarinas) e escritório; em cima,
        escritório e sala de reunião. 20 postos de trabalho em ilhas.
      - **Refeitório** para um turno (25 lugares, buffet) e **vestiário**
        com armários, bancos e três chuveiros (NR-24: um para cada 10).
      - **Ambulatório** (maca, pia, armário de medicamentos) e **brigada**
        (armários de EPI, mesa, quadro de ocorrências).
      - **Armazém**: 60 porta-paletes com sacaria, costas com costas e
        corredor de empilhadeira de 3 m; faixa de expedição de 5 m diante
        das docas com a empilhadeira e paletes esperando.
      - **Casa de bombas de incêndio**: bomba principal elétrica, reserva a
        diesel (com escape) e jockey, NFPA 20; **subestação**: fileira de
        cubículos de média tensão e quadros de baixa; **ETA**: bombas de
        água tratada, dosagem de cloro e painel; **ETE**: sopradores da
        aeração e dosagem. A **guarita** já tinha balcão e monitor (Fase 15).
- [x] **Desempenho**: o interior é uma unidade da fusão (uma malha por
      material em cada prédio) e **só aparece a menos de 40 m** do prédio.
      Medido com a mesma rotina antes e depois: vista geral de 1 977 para
      2 044 chamadas de desenho (+3 %) e de 883 k para 893 k triângulos;
      dentro do ADM, de 101 para 184 chamadas. Dentro do prédio a oclusão de
      ambiente se suspende sozinha: o GTAO de 0,8 m manchava de branco a
      parede lisa vista de perto.
- [x] **Auditoria `__auditarInteriores()`** (`dev/interiores.js`), pela
      caixa de cada malha (`?semfusao`): móvel fora da sala, entrando em
      parede ou laje, invadindo a faixa livre de porta ou escada, sobre
      outro móvel, flutuando ou afundando; e **acesso**: uma grade de 10 cm
      por pavimento, varrida a partir da porta do prédio (ou da chegada da
      escada) com a esfera da câmera, tem de chegar a toda sala e a toda
      porta. 232 peças em 11 prédios, sem achado.
      - A primeira passada achou a escada do ADM colada na parede do fundo
        (sem como chegar ao primeiro degrau), a recepção numa ponta do
        prédio enquanto a porta fica no meio, cubículo de 2,2 m que não
        cabia diante de janela baixa (a casa de cubículos ficou sem janela,
        ventilação por veneziana alta), a casa da ETA pequena para três
        bombas (foi de 5 × 5 para 7 × 5 m) e a faixa de expedição do
        armazém reservada só diante da última doca.
- [ ] Não medido aqui: o HTML por duplo clique (fica para a Fase 17).

### Fase 17 — Controle de Xbox e entrega ✅ (27/10/2026)

- [x] **Teste com o controle de Xbox real** (27/10), com o HTML aberto por
      duplo clique — o Chrome trata `file://` como contexto seguro, que é o
      que a Gamepad API exige, e o teste confirmou. Controle lido como
      "Xbox 360 Controller (XInput STANDARD GAMEPAD)", mapeamento padrão,
      17 botões. Medido parado: deriva máxima de 0,064 (eixo X do analógico
      direito), menos da metade da zona morta de 0,15 — mantida. Andar (11
      m/s, ×2,6 correndo) e olhar (~130°/s) aprovados pelo autor com o
      controle na mão, sem ajuste.
- [x] **Vistas prontas** revistas (`data/vistas.js`, teclas 1 a 9): a da
      portaria agora mostra a praça de fora, por cima da via pública, e
      entraram **6 ônibus e estacionamento**, **7 tratamento de água**, **8
      tratamento de efluentes** e **9 sala de controle por dentro** (de trás
      dos operadores, olhando o videowall; calculada do bloco e do programa
      dos interiores). Medido que nenhuma cai dentro de parede. No "Ir para"
      entraram a ETA e o ponto de ônibus. **Ajuda** com as nove vistas, os
      prédios entráveis e o que o tráfego anima. O painel Exibição ganhou
      altura máxima com rolagem: em tela baixa (notebook) o topo dele, com as
      vistas, saía da tela sem como rolar.
- [x] **Desempenho medido de novo**: na vista geral, 2 068 chamadas de
      desenho e 0,89 M triângulos (Fase 10: 1 850 e 0,8 M). As pessoas eram
      o maior grupo animado — 11 visíveis custavam 204 chamadas — e a mais de
      120 m deixam de ser desenhadas: a vista geral foi para 1 855–1 950
      chamadas. Nas vistas fechadas (tanques, ETA, ETE), 110 a 340 chamadas.
      O tempo de CPU do quadro na vista geral oscilou de 25 a 48 ms nesta
      máquina na mesma hora, com o mesmo número de chamadas (carga e
      energia), então não serve de comparação com os 13 ms da Fase 10; o
      teste do autor no Chrome e no Edge rodou bem.
- [x] `npm run artifact` e **teste por duplo clique** no Chrome e no Edge
      (27/10, pelo autor, com o build da Fase 16): carrega, o controle é
      reconhecido e todos os comandos funcionam nos dois.
- [x] Commit final (aprovado pelo autor em 27/10). O arquivo para envio é
      `artifact/maquete-planta.html` (1,0 MB, abre por duplo clique).

### Fase 18 — Inspeção visual ✅ (27/10/2026)

Pedido do autor: uma série de testes visuais para achar o que não faz
sentido ou está pouco detalhado. As auditorias medem o que tem regra; isto
é a ronda do que só se acha olhando.

- [x] **Ronda de inspeção** (`src/dev/inspecao.js`): 40 postos, cada um com
      a câmera derivada dos dados e o que olhar nele — geral (2), processo
      (8), utilidades (8), entorno (8), interiores (14). No console,
      `__inspecao.lista()` e `__inspecao.ir(i)`. Em todo posto: geometria,
      detalhe, sentido, estética e comportamento.
- [x] **Comportamento medido**: 150 s de tráfego simulado, comparando para
      onde cada veículo e pessoa anda com para onde está virado. Só os
      carros de funcionário andam de ré (na saída da vaga, de propósito);
      caminhões e pessoas só ficam de lado nas curvas. Nada errado.
- [x] Primeira ronda feita (27/10). Achados, do que mais destoa para o que
      só falta detalhe — corrigidos com o aval do autor ("Pode começar"):

**Não faz sentido**
- [x] **Limite de bateria** (pendência O): gaveta de bloqueio a 0,9 m da
      flange e raquete figura 8 entre elas, nas sete linhas que cruzam o
      limite (27 e 30 a oeste; 28, CWS, CWR, STM e COND a leste);
      plataforma de grade ao lado do feixe, uma por nível do rack, entre dois
      pórticos, com os volantes de 0,9 a 1,6 m acima do piso; escada de
      marinheiro na ponta de dentro (na borda do rack ficavam os pilares e o
      contraventamento). Colunas fora do corredor de perímetro, com o piso em
      balanço sobre ele. Não se desceram as linhas ao piso: faria ponto baixo
      no vapor e no condensado. `equipment/limiteBateria.js`, números em
      `BLOQUEIO_LIMITE` (`rotas.js`); achado `BLOQUEIO_ALCANCE` no
      `__auditar()`.
- [x] **Casas de bombas com tubulação** (incêndio e ETA, a mesma regra):
      bombas lado a lado com a sucção virada para o tanque, coletor de sucção
      ao longo dessa parede, recalque subindo de cada bomba ao coletor a
      ~2,5 m, que sai pela lateral e desce enterrado; do tanque (TQ-AI, e o
      reservatório da ETA) à casa, a sucção corre sobre dormentes. O escape
      do diesel sobe até 1,2 m acima da laje, com chapéu. Água de incêndio em
      vermelho e água tratada em verde (NBR 6493).
- [x] Setas do norte e do vento só na planta baixa.
- [x] Vestiário e ambulatório com **vidro fosco** (`VIDRO_FOSCO_EM`,
      `data/interiores.js`).
- [x] **Subestação**: pátio dos transformadores cercado (NR-10) com
      portão, canaleta de cabos com tampa de cada transformador à casa, e a
      média tensão chegando enterrada por uma caixa de passagem na borda do
      bloco (linha aérea cruzaria a fábrica).
- [x] Casa da ETA com as três bombas, o painel e a dosagem.

**Planta baixa e interface**
- [x] **Planta baixa**: rótulo curto para os blocos de nome longo
      (`rotulo` em `BLOCOS`; o nome inteiro segue na ficha), letra de 11 px
      e rótulo do ponto de ônibus. Medido em 1600 × 950: os 30 rótulos
      aparecem. A planta enquadra o lote com mais folga em cima, abaixo da
      barra do HUD.

**Pouco detalhado**
- [x] CP-01 como compressor de pacote: venezianas, porta de inspeção,
      painel de comando, grade do ventilador do resfriador e caixa de ligação
      do motor.
- [x] Filtros rotativos: lâmina raspadora, calha de torta entre as pernas
      do pórtico e barra de lavagem com bicos (o cabeçote de vácuo já
      existia).
- [x] Capilar de selo remoto rente ao costado (6 cm), com abraçadeiras.
- [x] Bosque com 6 m de sorteio e 20 % das células vazias.
- [x] Fachada cega com venezianas altas (sala de controle e casa de
      cubículos) e duas condensadoras no telhado da sala de controle.
- [x] Ônibus com colunas entre as janelas, letreiro de destino e
      retrovisores (os caminhões já tinham cabine, chassi e eixos).

**Depois da ronda (27/10, pedidos do autor ao ver a cena)**
- [x] Topo das paredes sem z-fighting: laje 1 cm para dentro, platibanda
      sem sobrepor nos cantos.
- [x] **Janelas atravessáveis** pela câmera: o colisor da parede é
      decomposto em colunas em volta da porta, das janelas e do portão.
- [x] **Letreiros**: placa própria em canvas a 200 px por metro de letra (a
      fachada pintada a 20 px/m pixelava); chapa de cantos arredondados,
      afastada 2 cm da parede, pictograma do uso num quadrado da cor dele
      (`icone` em `PREDIOS`; `ICONES` em `lib/predio.js`), nome em branco,
      filete embaixo e um pouco de luz própria.
- [x] **Calçada de acesso** de 1,5 m da porta de cada prédio até a rede
      (`PORTAS`, `data/entorno.js`): reta ou em L, sem cruzar via. O
      armazém não tem (a porta dá para a via de serviço).
- [x] Casa de bombas: o recalque saía pela parede da porta, a 2,6 m, e
      atravessava o letreiro; sai agora pela outra lateral (desce
      enterrado logo depois).
- [x] **Filtros rotativos fechados**: licor-mãe e torta levam tolueno
      (ponto de fulgor 4 °C), então o filtro trabalha com capô de inox de
      borda a borda da cuba, testeiras antes dos mancais e dois visores no
      alto, onde se vê o tambor (com a torta clara) girar. O raspador
      passou para o lado do N3, que é a descarga da linha 23 (a calha da
      Fase 18 ficava do outro lado); o tambor gira no sentido que leva a
      torta do licor à lavagem e ao raspador. Bocais: N1 (suspensão) na
      lateral da cuba, abaixo do nível — a linha 20 só ganha queda —, N4
      (lavagem) no alto do capô, sobre a barra, e N3 no capô logo acima da
      borda, acima do licor. Vent do capô com flange cega (pendência P).
- [x] **Isolamento opaco**: a capa de alumínio era translúcida (0,35) e
      parecia uma película, com a TAG pintada flutuando nela. O vaso por
      dentro se vê desligando a camada, no corte ou pelo visor.
- [x] **Visor nas bocas de visita** (R-01 e TK-01): tampa com vidro, e a
      chapa do vaso abre atrás dele — o shader de costado, camisa e
      isolamento descarta o que cai no vão do pescoço (`lib/furos.js`).
      Vê-se o licor e o eixo do agitador.
- [x] **Armazém com portão de garagem** de 5 × 5,5 m, porta de enrolar
      aberta, no fim da via de serviço e na faixa por onde o caminhão chega
      (`ENTRADA_GARAGEM`); pátio de concreto entre a via e o portão. O baú
      entra, para dentro com 2 m livres à frente, e sai de ré até ficar
      fora do prédio. Por dentro, baia de 14 m livre e a expedição
      (paletes e empilhadeira) ao lado dela. Eram três docas pintadas, com
      a porta de pessoas no meio de uma delas.
- [x] Roteador: na chegada a bocal horizontal com queda, a descida final
      desconta o que os trechos horizontais ainda vão descer — a linha
      acabava abaixo do bocal e voltava a subir.

### Fase 19 — Veículos de verdade ✅ (27/10/2026)

Pedido do autor: "verifique o comportamento dos veículos, e os caminhões
podem ser um pouco mais detalhados". Medido em 10 min simulados (passo de
0,2 s), com a auditoria do ambiente em zero:

- **Giro instantâneo** (mais de 60° num passo), 35 vezes: meia-volta de 180°
  no fim da rota (caminhão-tanque na descarga; baú depois da ré); curva de
  90° sem arco na entrada da rota de caminhão (167; 152), de 62 a 72°;
  manobra do estacionamento, 64°.
- **Salto**: o carro de passagem some numa ponta da via pública e reaparece
  na outra (287 m) ainda à vista.
- **Choque** (centros a menos de 3 m): dois carros de funcionário na fila da
  portaria; baú × carro de passagem na entrada da rota de caminhão; carro
  de funcionário × carro de passagem na via pública; carro de funcionário ×
  ônibus perto da portaria. Ninguém dá preferência nem guarda distância.

Feito:
- [x] **Curvas com raio**: todo percurso de veículo tem as quinas trocadas
      por arcos do raio do eixo dele no giro mínimo do veículo de projeto
      (`suavizar` em `lib/plano.js`; carro 5,75 m, caminhão 10 m —
      `GIRO_CAMINHAO` em `site.js` —, ônibus 8,4 m). Entrada e saída do
      retorno do ônibus por curva reversa tangente ao anel (a quina girava
      9° em 0,4 m). A pose usa a corda que encolhe perto das pontas: na
      troca de frente para ré o rumo não pula. Manobra de vaga com raio de
      4 m — o corredor de 6 m não comporta mais; o carro real faz ~5,5 m.
- [x] **Manobras de caminhão** (`manobraTanque`, `manobraBau` em
      `data/ambiente.js`): o tanque passa do entroncamento da via da
      descarga e entra de ré em arco até os braços; o baú, num **pátio de
      manobra** novo entre o armazém e a cerca (`patio-expedicao` em
      `VIAS`), entra de frente virando para o norte, volta de ré em arco
      até a faixa do portão e entra de ré no armazém. Os dois saem de
      frente. O motorista do tanque saiu da faixa por onde ele entra de ré.
- [x] **Fila e preferência** (`site/ambiente.js`): o veículo para atrás de
      quem vai no mesmo sentido e de quem está parado; para cruzamento e
      entrada de via, prevê os próximos 4 s (cápsulas do tamanho de cada
      um) e, havendo choque, cede quem chega onde o outro está, quem vai
      entrar na via pública (linha de parada) e, no empate, o de menor
      prioridade (ônibus, carro de passagem, caminhão, carro de
      funcionário). Pedestre andando sempre tem a vez. Quem espera tem o
      relógio parado (a fase não acaba com ele no meio do caminho); os
      passageiros andam no relógio do ônibus. Ré só começa com o caminho
      livre, e quem entra em cena espera fora dela se o lugar está
      ocupado. Os carros de funcionário têm um ciclo só (o defasamento
      entre eles fica fixo).
- [x] **Carro de passagem** aparece e some a 5 m das pontas da via pública
      (nas pontas do mundo), e conta na fila mesmo escondido.
- [x] **Caminhões detalhados** (`lib/ambiente.js`): cabine com para-brisa,
      janelas, defletor, grade, faróis, para-choque, retrovisores, degraus,
      para-lamas e tanque de combustível; o tanque com cintas, três bocas
      de carga, passadiço com guarda-corpo, escada, caixa de válvulas,
      painel de segurança laranja 33/1294 na frente e atrás e rótulo de
      risco classe 3 (NBR 7500); o baú com portas, dobradiças, trancas,
      faixa refletiva, para-choque traseiro e o nome da empresa.
- [x] **Auditoria** no `__auditarAmbiente()` (dez minutos simulados):
      `VEICULO_SALTO`, `VEICULO_GIRO` (rumo que muda mais que o raio do
      veículo permite, com 50 % de folga), `VEICULO_x_VEICULO` (caixas que
      se tocam), `VEICULO_x_PESSOA` (andando por cima de alguém) e
      `VEICULO_PRESO` (60 s parado na fila: impasse). Zero, e zero também
      em 90 min simulados no console (maior espera, 7,3 s).
- Achado de passagem: os passageiros desciam do ônibus quando ele já ia
  embora — o instante da parada somava a espera no ponto (Fase 15).
  Corrigido. Quem vai ao abrigo não atravessa mais a baia.
- A rota de caminhão na via pública passou a usar o eixo dela: com a mão de
  direção, o caminhão voltava para leste pela pista do oeste.

### Fase 20 — Pessoas com rotina ✅ (28/10/2026)

Pedido do autor: "trajetórias longas e cíclicas de caminhada, alguns
entrando e saindo dos prédios, sentando nas cadeiras na frente dos
PCzinhos, usando as mesas de reunião".

- [x] **Caminhos por busca**, nunca coordenada: por dentro de cada prédio
      uma grade de 0,2 m (as salas do térreo, com as portas e as divisórias
      abertas, menos os móveis, com 0,28 m de folga do corpo); na laje uma
      grade de 0,5 m (corredores, menos equipamento, rack e apoios); por
      fora a rede de calçadas mais as calçadas de acesso às portas
      (`redeDePolilinhas`, que agora devolve os pontos). A* em oito
      vizinhos, esticado por linha de visada (`lib/navegacao.js`). A rede
      tem dois componentes (os prédios e o norte da laje); entra-se na laje
      pelo dos prédios e cruza-se a laje pela grade.
- [x] **Lugares** nos móveis (`lugares` em `lib/moveis.js`): estação e
      console (digitar), mesa de reunião (conversar), mesa do refeitório
      (comer), bancada, ilha e capela do laboratório e bancada da oficina
      (em pé). Um por pessoa — ninguém senta na cadeira de outro.
- [x] **Agendas cíclicas** (`data/rotinas.js`, ciclos de 8,6 a 12,6 min):
      três operadores (console, ronda por três pontos da laje, amostra no
      laboratório, refeitório), quatro administrativos (posto no ADM,
      reunião na supervisão da sala de controle, refeitório), dois
      laboratoristas e um mecânico. Roupa pelo papel (macacão e capacete,
      camisa, jaleco).
- [x] **Corpo**: senta e levanta (quadril e joelho, 1,2 s), digita, come,
      conversa (gira a cabeça), trabalha em pé na bancada; anda com a
      passada da Fase 9. De longe (120 m) ou dentro de prédio apagado, não
      se desenha.
- [x] **Portas** abrem a 2 m de quem passa (medido: 284 passagens a menos
      de 0,5 m da porta, todas com a folha aberta) e os **veículos** cedem
      a quem anda (30 min simulados com o trânsito: nenhum toque; maior
      espera de veículo, 8,8 s).
- [x] `__auditarRotinas()`: caminho que não existe, sem lugar, pessoa na
      parede (colisores dos prédios a 1 m do piso), no móvel e fora da
      calçada fora dos prédios. Zero. No caminho ela achou: bancada de
      menos no laboratório, corredor da laje que vira bolsão, entrada da
      laje com equipamento na frente, calçada que começa a 0,25 m da outra
      sem tocá-la (a rede agora junta a 0,5 m) e a ronda saindo pelo
      componente do norte — corrigidos.
- [x] **Andar de cima** (28/10): uma grade por pavimento e a escada entre
      elas — o caminho vai ao pé dela, sobe pelos degraus (a altura acompanha)
      e segue pela grade de cima. Os administrativos usam os postos dos dois
      andares do ADM e a sala de reunião do 1º pavimento.
- Ficou de fora: a chegada de ônibus ou carro e o vestiário seguem com os
  passageiros da Fase 15.

### Fase 21 — Operações animadas ✅ (28/10/2026)

Pedido do autor: "o trabalhador conectando a mangueira no caminhão,
pessoas subindo e descendo do ônibus, essas coisas". Usa as pessoas da
Fase 20 e os veículos da 19.

Cada cena fica presa à espera do veículo (`site/operacoes.js`, tempos em
`data/operacoes.js`); os pontos de trabalho são da geometria do veículo
(`pontos` dos caminhões em `lib/ambiente.js`) e da baia.

- [x] **Descarga de tolueno** (espera de 72 s): o operador sai de onde
      aguarda, calça a roda de trás, puxa o cabo de aterramento do
      carretel até o chassi, leva o mangote do pé do braço à caixa de
      válvulas, conecta e abre; espera; fecha, desconecta, larga o
      mangote, desaterra, tira o calço e volta — o aterramento sai por
      último antes do calço. Mangote e cabo pendem em catenária e são
      refeitos enquanto ele os leva. Substitui o motorista parado.
- [x] **Armazém**: a cortina da porta de enrolar desce até o chão e sobe
      quando o baú está a 25 m do portão; a empilhadeira faz duas
      viagens da expedição à traseira do baú com um palete nos garfos
      (gira, anda, ergue, encosta, recua de ré). A baia livre passou de 14
      para 18 m: com o baú dentro, a empilhadeira não tinha onde recuar e
      encostava no porta-palete (achado da auditoria).
- [x] **Ônibus**: as portas abrem (80°) com ele parado no ponto e fecham
      antes de sair; quem passa a 1 m da porta sobe ou desce o degrau de
      0,35 m. A fila no abrigo já existia (Fase 15).
- [x] `__auditarOperacoes()`: `MANGOTE_SOLTO` (ponta a mais de 5 cm da
      válvula com ele ligado), `PESSOA_NO_CAMINHO` (operador dentro da
      caixa do caminhão andando), `EMPILHADEIRA_NO_MOVEL` (contra
      porta-palete), `PORTA_ABERTA_ANDANDO`, e se a operação cabe na
      espera (`DESCARGA_SEM_TEMPO`, `CARGA_SEM_TEMPO`). Zero.
- [x] **Portas traseiras do baú** (28/10): duas folhas na dobradiça da
      borda, abrem 260° até encostar na lateral depois que ele para e fecham
      antes de ele sair; atrás delas, o vão de carga. A auditoria mede porta
      aberta com o baú andando.

### Fase 22 — Passeio automático de câmera (28/10/2026)

Pedido do autor: "uma rota automática de movimentação de câmera que
mostrasse tudo de forma detalhada e movimentos suaves, curvos e lineares,
numa ordem lógica de cada coisa da planta, que desse para ter noção de onde
estamos indo, começando da fachada. Priorizar pegar as animações enquanto
elas ocorrem." Depois: "nada de cortes para locais distantes, faça fluido",
"o usuário só apertar pra começar e descansar vendo tudo se mexendo
sozinho" e "a duração do passeio pode ser longa".

**Roteiro** (a ordem de um visitante que chega e segue o produto): 35
paradas em oito capítulos, **12 min**, e recomeça sozinho
(`data/passeio.js`, cada parada por regra — bloco, TAG, nome do objeto,
ator —, nunca coordenada).
1. *Chegada* — plano alto do lote, descendo até a placa da fachada.
2. *Portaria* — o carro do funcionário passa a cancela; o ônibus abre as
   portas e o pessoal desce (a câmera olha pela ponta do abrigo).
3. *Prédios de apoio*, de leste a oeste — refeitório, ADM, laboratório,
   sala de controle e oficina **por dentro** (entra pela porta, dá a volta
   na sala de entrada e sai); brigada por fora.
4. *Matéria-prima* — o caminhão-tanque de ré e o operador calçando,
   aterrando e ligando o mangote; parque de tanques; TK-01 e o **visor**
   da boca de visita dele.
5. *Processo*, na ordem do fluxograma — CP-01, E-02, R-01 e o **visor da
   plataforma**, E-01/V-01/V-02, T-01/E-04, E-03, CR-01, F-01 de perto
   (capô e visores), D-01, CR-02, F-02, e o **corredor por baixo do rack**
   com as bombas dos dois lados.
6. *Produto* — o baú vira no pátio e entra de ré; lá dentro a volta é por
   cima das estantes, olhando a baia e a empilhadeira.
7. *Utilidades* — subestação, caldeira e ar de instrumento, combate a
   incêndio, ETA e ETE (o olhar passa de peça em peça na ordem do
   tratamento), torre de resfriamento.
8. *Vista geral* — sobe para o plano alto.

**Movimento** — *sem corte nenhum*: um trajeto só, contínuo; longe se
percorre por cima (tanto mais alto quanto mais longe, até 45 m).
- [x] Posição e alvo em duas splines Catmull-Rom centrípetas.
- [x] Perfil de velocidade cinemático (v² = v₀² + 2·a·s, para a frente e
      para trás): acelera e freia a 2,1 m/s², sem degrau entre amostras
      (aceleração constante dentro de cada uma); o olhar gira no máximo a
      40°/s. Três tipos de trecho: órbita (arco numa altura só, a menor em
      que ele inteiro passa livre), travelling (fachada, rack) e grua
      (céu, armazém, visor do TK-01).
- [x] Nunca dentro de parede, laje, móvel alto, equipamento, objeto do
      entorno, rack ou tubo: a curva é amostrada e o trecho que bate ganha
      um ponto subido até ficar livre (fora de prédio). Dentro de prédio,
      a volta é um anel recuado das paredes, o menor recuo em que ele passa
      livre com 0,3 m de folga; não cabendo, olha da porta. Visor: chega pelo
      eixo do bocal e, se algo estiver na frente (o V-02, a 1,5 m do TK-01),
      desce por cima.

**Pegar as animações enquanto ocorrem**
- [x] O ator de cada evento é posto no fim da fase fora de cena e retido
      (`a.retido`, invisível) até a hora de entrar; quem tem rotina tem o
      relógio acertado no começo. Medido: carro na cancela, ônibus abrindo
      as portas, caminhão-tanque de ré e baú de ré estão na fase certa na
      chegada da câmera. O carro vai ~6 s atrás do ônibus na via e é solto
      6 s antes.
- [x] Ator já à vista na hora do acerto (28/10, segunda sessão): acontecia
      na virada do laço — a câmera no alto ainda via o ônibus, até 41 px de
      altura numa tela de 1080, e ele sumia no lugar. Agora, depois que a
      câmera deixa a parada do evento, o ator é acertado para a volta
      seguinte no primeiro instante em que sai do quadro (abaixo de 1,5 px);
      só o começo (a câmera chega de onde o usuário estava) e o pulo de
      parada (tela escura) acertam de uma vez. Medido numa volta inteira:
      cada um acertado no meio dela, nenhum à vista, e os seis eventos das
      duas voltas na fase certa e no quadro.
- [x] O laço fechava com um corte de 83 m (o fim do céu não era o começo):
      a última parada chega ao ponto do começo vindo do lado oposto, na
      direção em que o passeio parte. Medido: 6 cm num passo de 0,1 s.

**Saber onde se está e para onde se vai**
- [x] Legenda embaixo à esquerda (capítulo, nome, uma linha, "A seguir"),
      barra de progresso dos oito capítulos; mini-mapa no canto direito
      com a rota feita, a por fazer e o ponto da câmera.

**Controle**
- [x] Tecla **G**, botão "Passeio" do HUD e **View** do controle começam e
      param; **Esc** para. O mouse não interrompe (o pedido é apertar e
      descansar). Na ajuda.
- [x] Pausar, avançar e voltar de parada: **Espaço** (ou **A** no
      controle) pausa e congela o mundo junto, como um vídeo; **← →** (ou
      **LB/RB** e o direcional) pulam de parada — a tela escurece 0,35 s,
      os atores dos eventos vão para onde estariam naquele instante
      (`ambiente.posicionarEm`) e clareia; **←** passados 3 s da chegada
      volta ao começo da mesma parada. Botões na legenda e cada capítulo da
      barra clicável; o botão Passeio fica aceso. Medido: os quatro eventos
      com ator acontecem no quadro depois de um pulo até eles.

**Auditoria** `__auditarPasseio()` — **zero**
- [x] A cada 0,5 s: câmera dentro de algo, velocidade (pelo caminho, não
      pela corda), tranco, giro do olhar; evento sem tempo de preparar e
      evento perdido (lido na chegada); duração.
- [x] Parada sem nada no quadro: `ALVO_ESCONDIDO` — cinco raios a cada
      segundo contra a geometria de verdade (caixa engana: a do R-01 leva a
      plataforma), vidro não tapa, tubo fino e longe bate em um raio só. Achou
      o F-02 atrás do CR-02 em 80 % da parada; a órbita do equipamento
      passou a escolher, por regra, o lado livre mais perto de onde se chega.
      Também `LACO_COM_SALTO` e `ACERTO_A_VISTA`. Zero achados.
- [ ] Ainda não olhado no navegador de verdade (só no Chromium sem tela, com
      renderização por software): a fluidez do escurecer e a legenda com os
      botões numa tela pequena.
- [ ] (Opcional) gravar o passeio em vídeo (MediaRecorder do canvas).

### Fase 23 — Verificações hidráulicas (28/10/2026)

Pedido do autor (pela sessão local): a velocidade em cada linha e o NPSH
disponível de cada bomba, medidos com as cotas da maquete. Número que não
fecha vira pendência da equipe, com a memória de cálculo — não se muda dado
oficial. **Nada na ficha** (decisão do autor, 28/10): a informação técnica
vai no relatório final; a maquete fica no visual.

Onde está: `src/data/fluidos.js` (propriedades com fonte, schedules, faixas,
NPSH requerido, margem e a lista `ACEITOS`), `src/lib/hidraulica.js` (as
contas: velocidade, Churchill, NPSH — arquivo novo, porque a tubulação e os
pipeways, que têm o 3D, calculam o NPSH ao montar a sucção, e eles não podem
importar de `dev/`) e `src/dev/hidraulica.js` (`__auditarHidraulica()`; a
velocidade também no Node: `auditarVelocidades()`).

- [x] **Propriedades** de cada corrente em função de T e da composição
      (Quadros A3–A5): densidade do líquido por DIPPR 105 (Perry, Tab. 2-32;
      o ácido benzoico abaixo da fusão extrapolado) com volumes aditivos;
      água por Tilton e Taylor; gás e vapor por gás ideal com a massa molar
      da mistura; torta pelo cristal (1 266 kg/m³) com o tolueno; pressão de
      vapor por Antoine (Lange) com Raoult na fase orgânica, mais a da água
      quando há água (não se misturam); viscosidade do tolueno (DIPPR 101).
      Conferidos: tolueno 864 kg/m³ a 25 °C; ponto de ebulição a 110,6 °C;
      0,871 m³/s de vapor na linha 13, igual à eq. C18.
- [x] **Diâmetro interno** pelo schedule: CS40 → Sch 40; SS304L → 10S do
      DN 50 para cima, 40S abaixo (decisão abaixo).
- [x] **Velocidade em 77 trechos** com vazão conhecida — os de processo, os
      ramais e os cabeçais de utilidade (água pelo Quadro B9, vapor a 9 bar
      da pendência I) e os de fora do limite (27, 28, 30, CWS/CWR, STM, COND,
      sucções da BT-01 e das BAR-01) — contra a faixa do serviço: sucção,
      líquido, suspensão, torta, gás, duas fases (erosão API RP 14E), vapor,
      água, condensado. Lento só é achado se o DN logo abaixo couber.
      Duas correntes já chegam em duas fases, pelo balanço: S-12 (o vapor do
      T-01 se forma depois da V-03b) e S-03 (o N₂ segue com o condensado).
- [x] **NPSH de 16 bombas** (BC-01 a BC-11, BD-01/02, BT-01, BAR-01A/B):
      NPSHa = (P_sup − P_v)/ρg + (z_sup − z_eixo) − h_f, com a superfície da
      malha de líquido (que sai de `nivelDeVolume`), o bocal de sucção da
      bomba no 3D e o atrito na linha traçada (Churchill, curvas contadas na
      rota a L/D = 30, entrada e gaveta pelo Crane TP-410). A bomba segue a
      sucção pelos nós até o vaso, sem atravessar outra bomba nem trocador.
      T-01 e V-01 em equilíbrio: a pressão de vapor é a do vaso. Filtros
      (filtrado a 0,5 bar abs, a mesma das BV) e trocadores pela cota do
      bocal; tanques e bacia no nível mínimo (a boca de sucção). NPSHr pelo
      tamanho ANSI (Nss 8 500 no BEP do bocal de sucção a 3 m/s); margem de
      1,3 × (1,5 × na torre) e nunca menos de 1 m (ANSI/HI 9.6.1).

      | Bomba | Aspira de | NPSHa | NPSHr | Margem pede |
      |---|---|---|---|---|
      | BC-01 | E-04 (pela V-14 e V-15) | 7,1 | 3,5 | 4,6 |
      | BC-02 | V-01 (saturado) | **1,6** (K) | 1,5 | 2,5 |
      | BC-03 | V-02 | 11,0 | 1,5 | 2,5 |
      | BC-04 | E-04 | 3,6 | 1,5 | 2,5 |
      | BC-05 | E-03 (em série com a BC-10) | 9,6 | 2,1 | 3,1 |
      | BC-06 | TK-01 | 10,6 | 1,5 | 2,5 |
      | BC-07 | D-01 | 12,9 | 2,1 | 3,1 |
      | BC-08 | F-02 (vácuo) | 3,8 | 2,1 | 3,1 |
      | BC-09 | TK-01 | 10,7 | 1,5 | 2,5 |
      | BC-10 | F-01 (vácuo) | 4,1 | 2,7 | 3,7 |
      | BC-11 | T-01 (saturado) | 2,7 | 1,5 | 2,5 |
      | BD-01 / BD-02 (NPIP) | F-01 / F-02 | 9,3 / 8,5 | 3,0 | 4,0 |
      | BT-01 | TQ-01 (o pior tanque) | 11,2 | 1,5 | 2,5 |
      | BAR-01A/B | bacia da torre | 9,8 | 5,0 | 7,5 |

- [x] **O que é da maquete se adaptou até fechar** (pedido do autor: o
      NPSH serve para ver se as rotas têm sentido físico):
      - BC-11 (proposta): de 3 × 2 × 8 para 1½ × 1 × 8, o tamanho dos
        8,3 m³/h — a de antes trabalhava a 16 % do BEP e pedia NPSHr de
        3,5 m, mais do que a saia do T-01 dá (2,7 m). Agora fecha (2,5 m).
      - BAR-01A/B (proposta): sucção de DN 200 para DN 250 e descarga de
        DN 150 para DN 200 (1,9 → 1,2 m/s e 3,3 → 1,9 m/s).
      - CR-02, bocais de água (estimados): de DN 80 para DN 50 (8 m³/h:
        0,47 → 1,0 m/s).
      - Rotas: nenhuma mudou. As sucções já são curtas — o maior atrito é
        o da BC-04, 1,0 m em 1" (linha 29A, pendência S) — e sem ponto alto
        (`SUCCAO_ALTA` do `__auditar`); o que faltava era cota ou tamanho
        de bomba, não traçado.
      - Tentado e desfeito: subir a saia do V-01 de 1,2 para 2,2 m (NPSH da
        BC-02). A linha 03 passou a descer 0,3 m e subir 0,3 m na saída do
        E-01 — sifão no condensado — e o TT dela foi a 3,0 m do piso
        (`INSTRUMENTO_INACESSIVEL`). Fecharia subindo o E-01 junto, com
        plataforma: fica para a equipe decidir (pendência K).
- [x] **Achados restantes: 8, todos de número oficial; zero novos.** Linha
      13 (C, conta corrigida), linha 12 (Q, nova), 1A/1B (R, nova), 29A (S,
      nova), 20 e 25 (T, nova), NPSH da BC-02 (K).
- [x] Medido: `__auditarHidraulica()` = 0 novos (8 aceitos), e `__auditar`,
      `__auditarArranjo`, `__auditarEntorno`, `__auditarAmbiente`,
      `__auditarRotinas`, `__auditarOperacoes`, `__auditarPasseio`,
      `__auditarSeguranca` e `__auditarInteriores` = 0, no Chromium sem
      tela (renderização por software). `npm run artifact` gera o HTML.
- [ ] **Não medido:** as linhas de vácuo V1 e V2 (sem corrente no
      balanço); a descarga do caminhão (DT; a vazão da bomba dele não está
      nos dados); o vapor de flash no retorno de condensado (só o líquido);
      a viscosidade da mistura com ácido benzoico (usa a do tolueno — no
      turbulento o atrito muda pouco); o NPSH no nível baixo de alarme (usa
      o nível de operação; com o vaso no fundo, a cota cai); NPSHr de
      catálogo (estimado pelo tamanho); a pressão atmosférica do local (os
      vasos atmosféricos a 1 bar, como no balanço — a 850 m de altitude
      seriam ~0,92 bar, ~1 m a menos em todo NPSH de vaso atmosférico, e
      nenhuma bomba cairia abaixo da margem por isso, exceto as que já
      estão nas pendências J e K, que não dependem dela).
- [ ] Não olhado no navegador de verdade: a BC-11 menor (olhada só no
      Chromium sem tela), o bocal de água do CR-02 (DN 80 → 50) e as
      linhas das BAR-01 mais grossas.
- [ ] `CLAUDE.md` não foi alterado nesta fase: o item de Arquitetura sobre
      `fluidos.js`, `lib/hidraulica.js` e `dev/hidraulica.js` fica para o
      O autor aprovar.
### Fase 24 — Noite e croquis oficiais na ficha (28/10/2026)

Pedido do autor (28/10), da lista de melhorias: "modo noite com as luzes
da planta acesas" e "o croqui oficial dentro da ficha de cada equipamento".
Feita em paralelo com a Fase 23 (sessão na nuvem), em arquivos separados.

**Croquis na ficha**
- [x] `scripts/croquis-ficha.py` (`npm run croquis-ficha`, PyMuPDF + Pillow)
      lê o `Croquis-unificados.pdf` dos documentos finais (só leitura), acha a
      TAG de cada folha no carimbo ("Equipamento: … — R-01") e grava
      `src/data/croquis.js` — arquivo de saída, não se edita à mão. Falha
      alto se uma folha não tiver TAG ou se ela se repetir.
- [x] As dez folhas: R-01, V-01, V-02, TK-01, T-01, CR-01, F-01, D-01, CR-02,
      F-02 — WebP a 150 dpi, de 30 a 60 kB cada (o carimbo se lê). O HTML
      único passou de 1,10 para 1,77 MB.
- [x] A ficha de **toda peça** do equipamento (costado, bocal, camisa,
      isolamento…) mostra a miniatura com folha, escala, quem desenhou e quem
      aprovou; a ligação é pela árvore do equipamento, não pelo título (a
      ficha do isolamento do R-01 não diz "R-01"). Medido: 44 fichas das
      peças de R-01, F-01, CR-02 e TK-01 com o croqui certo, nenhuma errada;
      trocadores, bombas e compressor não têm folha no PDF e ficam sem.
- [x] Clique abre a folha na altura da tela; outro clique amplia para a
      largura; Esc ou clique fora fecha (sem disparar o Esc do passeio).

**Noite** (`site/noite.js`, números em `NOITE`, `data/ambiente.js`)
- [x] Tecla **N** (botão "Noite" no HUD, na ajuda): o dia vira noite em
      2,5 s e volta. Céu escuro com 1 800 estrelas (sorteio com semente),
      neblina azul-escura, a lua no lugar do sol, na mesma direção (a sombra
      não troca de lado), e o reflexo do metal de céu noturno.
- [x] Acende **pelo nome do material**: luminária dos postes, farol e
      lanterna dos veículos, janelas (luz de dentro), vidro fosco, todos os
      letreiros (prédios, portaria, abrigo do ônibus) e a placa da empresa
      (que ganhou `emissiveMap` apagado de dia).
- [x] Poça de luz de cada poste no chão, sob a luminária (39, uma chamada
      de desenho, soma de cor sem escrever profundidade, 4 cm acima da
      calçada).
- [x] Refletores de verdade (SpotLight sem sombra), nove: quatro nas pontas
      do rack, por cima, mirando a laje; sob as coberturas da descarga, da
      portaria e da caldeira, um a cada 12 m do lado maior, de facho aberto;
      um sobre o portão do armazém, abaixo do letreiro, mirando o pátio.
- [x] Balizamento vermelho piscando no ponto mais alto da chaminé da
      caldeira e do castelo d'água.
- [x] Dentro de prédio, a lâmpada **da sala em que a câmera está** acende no
      teto dela (intensidade pela meia diagonal da sala). A primeira versão
      subia a luz ambiente inteira e o lado de fora, visto da porta, ficava
      claro como de dia.
- [x] Custo: na vista inicial, 57–59 quadros/s de dia e de noite (o painel
      do app limita a ~60). A primeira noite recompilava todos os shaders
      (oito luzes a mais) e travava a tela ~3 s; agora `noite.preparar()`
      compila em segundo plano 6 s depois de carregar (contra uma cena só
      com as luzes da noite): o quadro mais longo da primeira troca caiu
      para 0,8 s, e as trocas seguintes, ~0,1 s.
- [x] Auditorias com a noite acesa: `__auditar`, passeio, rotinas,
      operações, ambiente, entorno, segurança, arranjo e implantação zero;
      `__auditarChao` e `__auditarInteriores` (com `?semfusao`) zero.
- [ ] Não medido aqui: o HTML por duplo clique e o desempenho num notebook
      mais fraco.

### Fase 25 — Nada flutuando, tudo ligado (28/10/2026)

Pedido do autor: "falta acrescentar mais realismo e sentido físico a todas
as estruturas dos equipamentos da área de processo, que são a parte mais
importante da planta e precisa de uma excelente apresentação"; "principalmente
me refiro a coisas flutuando e desconectadas"; "elimine películas
transparentes também dos equipamentos".

O critério é físico: cada peça chega ao chão por uma cadeia de contatos
(perna soldada ao costado, console sob a plataforma, grampo da escada, mancal
sobre a estrutura, motor sobre a base, poste sob o tubo), e o que deveria
estar ligado está ligado (tubo no bocal, válvula na linha, instrumento na
tomada). Primeiro se mede, depois se conserta — e o conserto é por regra, em
primitiva de `lib/`, nunca coordenada à mão.

**Divisão** (duas sessões em paralelo, arquivos separados)
- *Nuvem* (`claude/fase-25-contato`): a medida — `__auditarContato()`
  (`dev/contato.js`, com `?semfusao`): grafo de contato ponto–triângulo
  (2 cm) entre as malhas da área de processo, raízes na laje e nas
  fundações; achados FLUTUANDO, FOLGA, PONTA_SOLTA e SOLTO_NA_LINHA, com o
  arquivo responsável. Depois conserta tubulação, apoios e rack,
  instrumentação e válvulas, bombas, alívio e bloqueio do limite.
- *Local* (`claude/fase-25-realismo`): os equipamentos e suas estruturas —
  `lib/supports.js`, `lib/vessel.js`, `lib/nozzle.js`, `lib/agitator.js`,
  `lib/internals.js`, `equipment/R-01.js`, `V-01.js`, `V-02.js`,
  `TK-01.js`, `equipment/generico.js` —, mais o céu e a noite.

**Parte local**
- [x] Sem película: a camisa do CR-01, do D-01 e do CR-02 era um cilindro
      aberto e semitransparente (opacidade 0,42), solto a 9 cm do costado;
      virou a camisa de chapa do R-01 (`criarCamisa`, opaca, fechada no
      costado por um anel em cima e outro embaixo). O líquido e o demister,
      transparentes, ficam: só aparecem no corte e pelo visor.
- [x] O redutor do agitador do CR-01, D-01 e CR-02 flutuava 7 cm acima do
      ápice do tampo: ganhou o bocal de montagem (pescoço que nasce dentro do
      tampo, pela queda dele no raio do pescoço).
- [x] Os refletores da Fase 24 presos (estavam no ar): sobre o rack, num
      mastro que continua a coluna do pórtico; sob as coberturas, num
      pendural até o telhado (achado por um raio de cima); no armazém, num
      braço até a fachada. Medido: nove refletores, nove suportes.
- [x] Foco (o autor, 28/10): "os apoios dos equipamentos no chão (se não
      tem nada flutuando, desconexo, cores irreais)" e "se os apoios estão
      bem conectados aos equipamentos, não só ao chão". `__auditarApoios()`
      (`dev/apoios.js`): em cada equipamento, grafo de contato entre as
      malhas dele (vértices e pontos a cada 2 cm nas arestas até 1,5 cm de um
      triângulo da outra), a busca parte do que desce ao piso. Achou **139**
      peças que não chegavam ao chão por nenhuma cadeia de contato:
      - a plataforma inteira do R-01 (grade, estrutura, guarda-corpo): os
        consoles eram chapinhas de 2 cm que começavam 2 cm fora do
        isolamento — viraram braço soldado ao casco (atravessa o isolamento)
        com mão-francesa a 45° até o costado;
      - a escada do R-01: os degraus saíam girados na radial, soltos no meio
        da escada, e os aros da gaiola tinham o giro com o sinal trocado (a
        gaiola ficava 27° torta, com as pontas no ar). Degrau de longarina a
        longarina, aro que termina nas longarinas, longarinas 1 m acima do
        piso, chapa até a borda da plataforma e grampo no costado a cada
        2,5 m. Vale para toda escada (tanques, ETE, utilidades, bloqueio);
      - o bocal de fundo DN150 do CR-01 e do CR-02 terminava na ponta do
        cone (a borda dele no ar): todo bocal de equipamento genérico agora
        tem o pescoço embutido até onde a superfície está, medido por raios
        na borda; o flange fica onde estava.
      Medido depois: **zero** (1,6 s, com `?semfusao`); `__auditar()` zero.
- [ ] Ronda de perto em cada equipamento (os 30), olhando o que a medida
      não pega: pernas e saias soldadas ao costado, consoles sob as
      plataformas, grampos das escadas, mancais e acionamento dos filtros,
      motor e redutor dos agitadores sobre o tampo, trocadores sobre as
      selas, internos presos ao costado.
- [ ] `__auditarContato()` zero nos arquivos locais.
- [x] Nuvens no céu (pedido do autor, 28/10): ruído fractal no shader
      do céu (nenhuma imagem), num plano alto — achatam perto do horizonte —,
      sombreadas na direção da luz, andando com o vento (`CEU`,
      `data/ambiente.js`). À noite ficam cinza-escuras, e as estrelas foram
      para o mesmo shader, atrás delas.

- [x] Bússola no canto superior direito (pedido do autor, 28/10: "para
      o user não se perder"): a rosa gira com a câmera, N para o norte do
      terreno (−Z), letras N, L, S, O de pé (`core/bussola.js`). Medido:
      olhando para o norte, giro 0°; para leste, −90° (N à esquerda).
- [x] Operários na área de processo (pedido do autor, 28/10): "mexendo
      nas válvulas, olhando as coisas de perto … inspecionando com
      prancheta". A ronda da Fase 20 virou **postos de inspeção** tirados da
      cena (`site/rotinas.js`): válvula de controle ao alcance do piso
      (girar o volante, com as mãos na altura dela e o tronco inclinado se
      está baixa), instrumento de campo (prancheta na esquerda a ~50° do
      rosto, a direita anotando, a cabeça alternando entre o instrumento e
      a folha) e, para o mecânico, bomba. Posto = ponto livre da grade da
      laje a ~0,9 m do alvo, ligado a uma entrada, de frente para ele; sem
      repetir alvo. Medido: 14 postos (três operadores × 4, mecânico × 2),
      poses conferidas parando o relógio; `__auditarRotinas` zero. O volante
      da válvula não gira (a válvula é fundida, e é da instrumentação).
- [x] Texturas realistas onde importa (pedido do autor, 28/10), sempre
      procedurais (`lib/texturas.js`):
      - **piso de grade vazado**: de perto (até 10 m) o vão entre as barras
        é furado de verdade (`triplanar(..., { vazado })`, alfa sem mipmap
        só no furo) — vê-se a laje, os consoles e quem passa embaixo; de
        longe fica o tom médio, sem cintilar;
      - **tinta de campo** (manchado de demão e pontos de desgaste) nos
        tubos, motores, redutores, atuadores e guarda-corpos — antes,
        plástico liso.
      Medido no corredor sob o rack: 48 quadros/s com, ~47 sem.

- [x] Medido junto com a entrega 2 da nuvem (`claude/fase-25-contato`, numa
      junção local de teste, não enviada), na GPU, com `?semfusao`:
      `__auditarContato` **0 FLUTUANDO, 0 PONTA_SOLTA, 0 SOLTO_NA_LINHA**,
      65 FOLGA (vãos de 2 a 30 cm entre coisas que não se apoiam: tubo a
      5 cm da plataforma, escada a 9 cm da saia; nada solto). Os dois que
      sobravam, sem dono, eram a placa do chuveiro lava-olhos LO-01 e LO-04,
      10 cm acima do topo do poste — o poste sobe até o alto da placa
      (`lib/seguranca.js`). Atenção: sem `?semfusao` a medida não vale (a
      fusão junta peças e acusa instrumento fora da linha que não está).
- [x] Oclusão de ambiente (GTAO) pintava os tubos finos quase de preto: com
      espessura suposta de 1,5 m o tubo DN 25–100 "se ocultava". Medido: com a
      oclusão zerada o mesmo tubo saía claro. Espessura de 5 cm, raio de
      0,5 m, intensidade 0,8 (`core/realismo.js`): alumínio claro, junta e pé
      de coluna ainda escurecidos. Antes isso não aparecia porque nesta
      máquina o GTAO costumava se desligar sozinho por lentidão.

**Cores reais** (o autor, 28/10: "selecione bem as cores das coisas pra não
ficar parecendo de mentira")
- [x] Tubulação pela NBR 6493: os inflamáveis de processo (tolueno e as
      misturas, licor-mãe, torta) em alumínio; vapor e condensado na capa de
      alumínio; água verde, ar azul, vácuo cinza-claro, incêndio vermelho —
      em tons de tinta de campo. Antes cada linha de processo tinha uma cor
      viva própria.
- [x] O fluxo ainda se lê: faixas de identificação da cor do fluido perto
      de cada ponta de trecho reto e a cada 8 m (`lib/faixas.js`, lido da
      linha de centro de cada tubo, sem mexer em quem monta a tubulação):
      361 anéis em dez cores, uma chamada de desenho por cor.
- [x] Legenda das cores dos tubos (pedido do autor, 28/10): tecla **C**
      ou botão "Cores" — a cor do tubo pela norma e a faixa de cada fluido,
      tiradas das tabelas (`LEGENDA_CORPO`, `FAIXAS`) e dos nomes do
      Quadro 13; as três águas ficaram num verde só.
- [x] Motor e atuador num azul de campo desbotado; piso de grade
      galvanizado; a serpentina em cobre (era turquesa).
- [ ] Cor dos apoios: saia, perna, sela e chapa de base em aço pintado,
      fundação em concreto — conferir equipamento por equipamento.
### Fase 25 — parte da nuvem (contato)

Pedido do autor: "nada flutuando, tudo ligado" na área de processo. A
sessão da nuvem faz a medida (entrega 1) e o conserto nos arquivos dela
(entrega 2); o que cair nos arquivos da sessão local vai para a lista
dela, abaixo.

**Entrega 1 — a medida** (`src/dev/contato.js`, `__auditarContato()`, com
`?semfusao`)
- [x] Grafo de contato entre as malhas da área de processo: os grupos
      inteiros (equipamentos, tubulação, apoios, rack, instrumentação,
      válvulas, alívio, bloqueio do limite, área de processo) e o que
      estiver sobre a laje do ISBL, com o objeto inteiro (o pipeway que
      passa por cima entra com os postes de fora). Contato: ponto a até
      2 cm de um triângulo do outro — vértices e pontos nas arestas a cada
      5 cm (o tubo reto só tem anel nas pontas: a viga no meio do vão não
      tem vértice perto dele). Grade espacial de triângulos (células de
      0,25 m). Peça embutida noutra (haste no castelo) conta como presa:
      ponto dentro do sólido por paridade de raios em três direções, só
      onde muda a resposta.
- [x] Raízes: laje, fundações (plintos e sapatas) e terreno.
- [x] Achados: FLUTUANDO (componente sem raiz, com a peça, a posição e a
      folga ao vizinho mais perto), FOLGA (2–30 cm, um dos dois apoio,
      perna, plataforma, guia, escada, berço, estai, rack ou saia; entre
      peças do mesmo apoio não conta), PONTA_SOLTA (ponta de tubo sem
      bocal, flange, outro tubo ou tampão), SOLTO_NA_LINHA (válvula ou
      instrumento que não chega à linha nem à tomada, nem pelo capilar).
      Resumo por equipamento, por arquivo e por sessão, e `agrupados` (o
      mesmo defeito repetido — os degraus de uma escada — numa linha).
- [x] Medido (28/10, no `main`, Chromium sem tela): 3 003 malhas, 138
      raízes, 465 762 triângulos, 6 270 pares em contato, **48 s**.
      **FLUTUANDO 125, FOLGA 410, PONTA_SOLTA 3, SOLTO_NA_LINHA 2.**
      - Nuvem (entrega 2): o posicionador das 18 válvulas de controle (a
        caixa ao lado da arcada, a 3–5 cm, sem suporte); os transmissores
        de nível do T-01 e do D-01 (a 5–7 cm do vaso, com o capilar); o
        chapéu da exaustão do vácuo e o do alívio (3–9 cm do tubo); as
        pontas dos tubos t8 (dreno da 07), t34 e t41 (chegada da torta à
        tremonha da BD-01 e da BD-02); 35 folgas de apoio de tubo e 64 do
        rack; a escada do bloqueio do limite (37 peças: usa `criarEscada`,
        já consertada pela sessão local).
      - Sessão local (**não consertar aqui**): os degraus e aros das duas
        escadas de marinheiro da plataforma (62 peças, `lib/supports.js` —
        já corrigido em `claude/fase-25-realismo`); 2 peças no alto do
        CR-01 e do CR-02 a ~0,5 m do resto (`equipment/generico.js`); 202
        folgas de plataforma e escada contra costado e bocal
        (`lib/supports.js`).
      - Sem dono: os chuveiros lava-olhos LO-01 e LO-04 (uma peça a 10 cm,
        `site/seguranca.js`).
- [ ] Não medido: malha instanciada (não há na área de processo hoje);
      o que se mexe (agitador, tambor) só na posição em que está; contato
      de dentro do equipamento é da `__auditarApoios` da sessão local.

**Entrega 2 — o conserto nos arquivos da nuvem** (28/10, mesmo ramo)
- [x] Posicionador das 18 válvulas de controle preso a uma barra da arcada
      por um suporte de chapa (montagem lateral da IEC 60534-6-1, "NAMUR"),
      em `lib/valvula.js`; caixa, folga da alavanca e chapa [ESTIMADO].
- [x] Transmissor de nível do T-01 e do D-01: primitiva nova
      `criarTomada` (`lib/instrumento.js`), luva flangeada DN 50
      [ESTIMADO] da chapa do vaso até o transmissor (embaixo) e até o selo
      do capilar (em cima), atravessando camisa e isolamento. O do D-01
      passou de 300° para 270° (`data/instrumentos.js`), no meio do vão
      entre as pernas de 225° e 315°: com a tomada, o flange ficava a 4 cm
      da perna e o transmissor atrás dela (visto na imagem).
- [x] Chapéu da exaustão do vácuo e do alívio (`lib/pontas.js`): as três
      hastes sobem até a parede do cone; paravam 0,6 × o diâmetro abaixo
      dele.
- [x] Pontas t34 e t41 (torta de 3", linhas 23 e 28, chegando ao bocal de
      6" da tremonha da BD-01 e da BD-02): primitiva nova `criarReducao`
      (`lib/pipe.js`, comprimento H da ASME B16.9), posta por regra em
      `equipment/tubulacao.js` onde o bocal é maior que a linha.
- [x] Ponta t8 (dreno da linha 07): dreno aberto sobre o funil, de
      propósito (vê-se o que escorre e o esgoto não volta para a linha). A
      auditoria aceita ponta até 25 cm acima de funil.
- [x] Guias de riser: iam só até o isolamento, a 7–8 cm da camisa sem
      tocar nada; `criarGuia` recebe o raio da chapa e chega a ela.
- [x] Bombas (`lib/bomba.js`): bloco, graute de 40 mm (a API 686 pede
      de 25 a 50 mm [VERIFICAR]) e base de aço, com chumbadores M16 a no
      máximo 0,6 m nas duas bordas; uma função para as três famílias, que
      eram três cópias. O bloco desce o graute: base e bocais na mesma
      cota. Motor e mancais já pousavam na base (nenhum achado neles).
- [x] Auditoria: escada e plataforma do bloqueio do limite contam para
      `lib/supports.js` (saem de `criarEscada` e da plataforma de lá);
      tomada e capilar andam com o instrumento, mas não contam como linha;
      FOLGA é de objeto contra objeto (o apoio que já toca a linha pela
      travessa não tem folga contra ela na coluna; a guia presa ao costado,
      contra a camisa do mesmo vaso), uma por par, e o chão não conta para
      o que já está no chão.
- [x] Medido (28/10, Chromium sem tela, `?semfusao`): 3 272 malhas, 138
      raízes, 473 406 triângulos, 7 190 pares em contato, 80 s.
      **FLUTUANDO 103, FOLGA 66, PONTA_SOLTA 0, SOLTO_NA_LINHA 0** (eram
      125, 410, 3 e 2). Nenhum FLUTUANDO em arquivo da nuvem. As outras
      auditorias seguem em zero (`__auditar`, arranjo, entorno, segurança,
      ambiente, rotinas, operações, interiores, passeio, chão e a
      implantação no Node); o HTML de entrega abre por `file://` sem erro.
      - FOLGA que fica na nuvem, 37 (26 do rack, 11 dos apoios de tubo):
        lidas uma a uma, são vãos de 3 a 30 cm entre coisas que não se
        apoiam uma na outra — bomba sob o pórtico do rack (19–24 cm), tubo
        que cruza a longarina sem apoiar ali (ramal de condensado a 3 cm,
        linha 31 a 8 cm), estai a 8–29 cm de um respiro ou ramal vizinho.
        Ficam como estão; o ramal de condensado a 3 cm da longarina é o
        mais apertado, a olhar numa próxima ronda.
      - As plataformas do limite de bateria (12 FOLGA) contam para
        `lib/supports.js`, de onde sai a geometria, mas o lugar delas é
        do `equipment/limiteBateria.js` (nuvem): a oeste fica a 3 cm da
        caixa coletora e a 24 cm da mureta; a leste, a 15 cm do pipeway.
        Vãos, não peça solta: ficam.
- Para a sessão local (**não consertado aqui**), no `main` de hoje:
  - degraus e aros das escadas de marinheiro (62 peças) e a escada do
    bloqueio do limite (37 peças, `criarEscada`) — `lib/supports.js`, já
    mexido em `claude/fase-25-realismo`;
  - uma peça no alto do CR-01 e do CR-02 a ~0,5 m do resto
    (`equipment/generico.js`);
  - 17 FOLGA de `lib/supports.js` fora as plataformas do limite: escada
    do bloqueio contra ela mesma a 2 cm (7), escada de marinheiro a 2 cm
    da plataforma de operação (3), plataforma de operação a 4 cm da camisa
    do R-01, saia a 11 cm da linha 05 (2), berços a 22–28 cm de dreno e
    da linha 10 (3), perna do CR-02 a 21 cm de apoio de tubo;
  - sem dono: os chuveiros lava-olhos LO-01 e LO-04, uma peça a 10 cm
    (`site/seguranca.js`).
- [x] Medido junto com `claude/fase-25-realismo` (fusão local de teste,
      não enviada): **FLUTUANDO 2** (só os lava-olhos LO-01 e LO-04, sem
      dono), FOLGA 65 (37 da nuvem, 28 de `lib/supports.js`), PONTA_SOLTA
      0, SOLTO_NA_LINHA 0; `__auditar` e `__auditarApoios` em zero. Ao
      juntar os dois ramos, o `main.js` dá conflito de uma linha (cada
      ramo pôs a sua auditoria no mesmo lugar): ficam as duas.
- [ ] Não medido: a vista em placa de vídeo de verdade (só SwiftShader).

---

### Fase 26 — Iluminação (30/10/2026)

Pedido do autor: "precisa de muito mais postes de iluminação em quase
todo lugar, planeje isso, atenção especial à área de processo". Hoje são 39
postes de via (9 m, a cada 30 m, um lado só) e 9 refletores (Fase 24); a
laje não tem luminária própria.

**Norma e alvos** [VERIFICAR — de memória até abrir a norma]: dentro da
cerca a planta é local de trabalho externo, EN 12464-2; a NBR 5101 só nas
faixas de aceleração e desaceleração da via pública; emergência pela NBR
10898. Fator de manutenção 0,8 [ADOTADO]; na laje, IRC ≥ 60 (as cores da
NBR 6493 de noite).

| Lugar | Em (lx) | Uo |
|---|---|---|
| Calçada e caminho de pedestre | 5 | 0,25 |
| Via interna (15 km/h) | 10–20 | 0,40 |
| Estacionamento | 10 | 0,25 |
| Portaria, travessia, giro de caminhão, carga e descarga | 50 | 0,40 |
| Parque de tanques e descarga de tolueno (luminária Ex) | 50 | 0,40 |
| Laje: circulação e operação de válvula | 20 | 0,25 |
| Laje: bombas, leitura de instrumento, inspeção de vazamento | 50 | 0,40 |
| Rota de fuga, só luminárias de emergência | ≥ 3 (5 em escada) | — |

O espaçamento sai do alvo, não de regra fixa: coloca pela regra, mede e
adensa até fechar Em e Uo. Via de 7 m com poste de 9 m: um lado basta; a
principal da portaria, os dois. O "muito mais" vem de calçada, fachada,
pátio, perímetro e laje.

**Interface**: toda luminária leva `userData.luminaria = { fluxo, facho,
dir, ex, emergencia }` — `fluxo` em lm saindo da luminária, `facho` o
ângulo total a 50 % da intensidade máxima; em InstancedMesh,
`userData.luminarias = [{ p, dir, fluxo, facho, ex, emergencia }]` no
mundo. A parte que acende tem o material `luminaria`. Fotometria numa
primitiva só (`lib/fotometria.js`, I(θ) = I0·cos^m θ): a auditoria e a poça
de luz da noite saem da mesma conta.

**Divisão** (limite: o contorno da laje)
- *Nuvem* (`claude/fase-26-iluminacao`): `lib/fotometria.js`,
  `data/iluminacao.js` (alvos, fontes, regras), primitivas de fora (poste
  de pedestre, poste de estacionamento com 2 projetores, projetor,
  arandela, perimetral, luminária no poste do pipeway) e a colocação fora
  da laje: fora do giro do veículo de projeto, a ≥ 0,5 m do meio-fio, nunca
  na frente de porta, portão, hidrante, canhão ou sobre rota de fuga.
  `__auditarIluminacao()` mede a cena inteira (grade da EN 13201-3; 1 m na
  laje): Em e Uo por área, rota de fuga só com as de emergência, luminária
  sem apoio, poste na via ou na calçada.
- *Local* (`claude/fase-26-laje`): luminárias Ex na coluna de cada pórtico
  do rack (acima de 2,1 m), no guarda-corpo das plataformas, em cada
  patamar e topo de escada; projetor no alto do equipamento só onde há
  plataforma para a troca; dois mastros de 15–18 m fora do giro do
  guindaste e do saque de feixe. Cada uma com braçadeira, eletroduto e
  caixa de junção (nada solto: `__auditarContato()`). E a noite inteira:
  acender, poça de luz, poucos SpotLight, FPS medido na placa de vídeo.

- [x] Nuvem: fotometria, dados, primitivas e colocação de fora, auditoria e emergência.
  - [x] Bloco 1 (30/10, `claude/fase-26-iluminacao`): `lib/fotometria.js`
        (perfil `cos` e `larga` — asa de morcego para ótica viária: com
        cos^m o pico fica no pé do poste e o passo pelo alvo encheria a
        via); `data/iluminacao.js` com alvos, luminárias [ESTIMADO] e
        regras, e `areasDeLuz()` (as mesmas áreas para quem adensa e quem
        mede); postes de via, de pedestre (4,5 m) e de estacionamento (10
        m, duas cabeças); colocação com poste nas duas pontas e vão
        dividido por igual, depois **mede e adensa** no ponto mais escuro;
        `__auditarIluminacao()` (Em e Uo por área, laje e cada bomba com as
        luminárias da sessão local, poste na via ou na calçada).
        Via interna a **20 lx**: os 15 km/h do `ambiente.js` passam dos 10
        km/h do tráfego "lento" da EN, e luminária de 150 W (18 klm) para o
        passo dar 20–23 m (2,3–2,6 H) em vez de 13 m.
        Medido: 147 luminárias (94 de via, 41 de pedestre, 12 cabeças no
        estacionamento; eram 39 postes), 6 491 pontos em 0,1 s; demais
        auditorias em zero. Fora da laje ficam 7 abaixo do alvo, todas
        para os próximos blocos: lig-leste e lig-ete (sob pipeway: poste
        proibido, vão para o poste do pipeway), a principal e a calçada
        dela em z ≈ 6 (idem) e a calçada da portaria (bloco de pátios e
        portaria, 50 lx). Laje: Em 38,8 lx, Uo 0,51 só com os postes de
        fora; as 15 bombas a 26–48 lx, abaixo dos 50 (sessão local).
  - [x] Bloco 2, parcial (30/10): pátios com mastro de 12 m e dois
        projetores (Ex na descarga e nos tanques, `ex: true`), luminárias
        de embutir no forro da cobertura da portaria (a face 1 cm abaixo:
        os 5 m livres ficam). Quantos mastros: o menor número que fecha o
        alvo na área, medido com o que já está posto em volta (a luz da
        via ao lado sobe o Em sem subir o Emin) e só com os mastros que
        cabem de fato. Debaixo da cobertura só conta luz de baixo do
        forro (a conta não tem obstrução). Medido: descarga 112,6 lx / Uo
        0,42, tanques 57,4 / 0,42, portaria 70,8 / 0,47, estacionamento
        45,7 / 0,48 (alvo 10: o mínimo de postes já passa). Falta o pátio
        de expedição (46,1 lx < 50): não cabe mastro entre o armazém e a
        cerca — vai com projetor de fachada no bloco 3. Parado aqui pela
        Fase 28 (rede de pedestres), prioridade do autor.
  - [x] Bloco 3 (30/10): perímetro (poste de 6 m a 1 m por dentro da
        cerca, braço para dentro, fora dos portões; 36 postes), arandela
        sobre cada porta (8) e projetor na fachada do armazém para o pátio
        de expedição, apontado: o pátio em faixas ao longo da parede, cada
        projetor mirando o meio da sua a 70 % da profundidade. O perímetro
        se mede pelo mínimo junto da cerca (Em ≥ 5, Emin ≥ 2 lx [ADOTADO]),
        não por Uo: na faixa de 254 m a luz da via e da portaria sobe o Em
        sem subir o mínimo (Uo 0,13 com a cerca acesa). Uma regra só para
        colocar, adensar e medir (`fecha`, lib/fotometria.js). Medido: as
        8 portas a 40–84 lx; perímetro Emin 2,0–5,3 lx nos quatro lados.
        Pendente: o pátio de expedição fecha o Em (130 lx) mas não o Uo
        (0,29 < 0,40) — o canto sudeste fica além da ponta da parede; pede
        um mastro ao sul do pátio (a regra de área só tenta os lados
        longos).
  - [x] Bloco 4, pipeway (30/10): onde o adensamento não acha lugar para
        poste (sob o pipeway), luminária presa por braçadeira na coluna W
        200 do pipeway mais perto do ponto escuro, 0,6 m abaixo do nível
        mais baixo, braço para a via (`postes` exportados por
        `site/pipeways.js`); terceiro recuo de poste, 5 m, atrás do
        pipeway (o passo segue saindo do de 2,6 m); pátio com mastro a
        mais por fora da borda, perto do ponto escuro (o de expedição: ao
        sul). Calçada medida só dentro da cerca (fora é a pública, da
        cidade). Medido: **`__auditarIluminacao()` = 0**, 268 luminárias
        (233 de fora, 35 da laje); pátio de expedição 164,6 lx / Uo 0,48
        (sobra: os projetores foram escolhidos antes do mastro); demais
        auditorias em zero; contato sem FLUTUANDO, 100 FOLGA.
  - [x] Bloco 4, emergência (30/10): as 4 rotas de fuga (`ROTAS_FUGA`)
        medidas só com as luminárias de emergência (NBR 10898: Emin ≥ 3 lx
        [VERIFICAR]); quais vão para o circuito de emergência: o menor
        conjunto das já postas que fecha as rotas (escolha gulosa pelo
        ganho), e poste de pedestre a mais onde nada alcança (o oeste da
        F2 e da F3 corria sobre grama sem luz). Circuito de emergência a
        100 % do fluxo, de gerador [ADOTADO]: com kit de bateria de LED
        (15–25 %) o poste de pedestre não passa de ~2 lx nem embaixo dele.
        **Pendência da equipe: o gerador de emergência (ou central de
        baterias) não está nos documentos.** Medido: 62 luminárias no
        circuito, rotas com Emin 3,0–5,5 lx; `__auditarIluminacao()` = 0
        com 271 luminárias. Interface: `emergencia: true` e
        `fluxoEmergencia` em cada luminária (a noite pode acender só elas).
- [x] Local, bloco 1 (30/10): `lib/luminaria.js` (luminária Ex d de
      alumínio fundido com globo e grade; braço com braçadeira na coluna e
      eletroduto subindo até a viga, com caixa de junção; poste preso ao
      montante do guarda-corpo; mastro com cruzeta e projetores) e
      `equipment/iluminacaoLaje.js` pela regra de `LUZ_LAJE`
      (`data/arranjo.js`): 22 no rack (uma por coluna, a 4,6 m), 7 nas
      plataformas (R-01 e limite de bateria; vão entre luminárias ≤ 6 m
      medido pelo arco no anel, uma na chegada de cada escada), 2 mastros
      de 16 m com 3 projetores, nos dois pontos livres mais afastados da
      volta da laje — (−4; −12) e (22; 13). As plataformas registram os
      montantes (`userData.montantes`, `lib/supports.js`). Medido:
      `__auditarContato()` sem FLUTUANDO/PONTA_SOLTA/SOLTO (as folgas
      passaram de 65 para 102: luminária a 2–28 cm de viga, escada e
      plataforma, sem encostar onde não deve); `__auditar`, arranjo,
      segurança, apoios, entorno, passeio e rotinas em zero.
- [x] Local, bloco 1: a noite acende as lentes (material `luminaria`) e
      põe poça de luz sob as do rack e onde o eixo dos projetores bate na
      laje — raio de desenho (60 % do facho) até a fotometria da nuvem
      dar a poça medida. O grupo entra na fusão (9 malhas); FPS com e sem
      as luminárias igual dentro do ruído (~40 de dia e de noite na vista
      do canto sudeste da laje, GPU deste PC).
- [x] Local, bloco 2 (30/10): o fluxo saiu da conta (`lib/fotometria.js`,
      Fm 0,8, sem obstrução, grade de 1 m): 1000 lm nas luminárias do rack
      e das plataformas e 6000 lm nos projetores — sob o rack Em 57 lx, Uo
      0,63 (alvo 50 / 0,40); resto da laje 35 lx, Uo 0,26 (20 / 0,25);
      pisos das plataformas 46–69 lx, Uo ≥ 0,73. O primeiro chute (6000 e
      20000 lm) dava 3 a 4 vezes o alvo. À noite a laje recebe a própria
      grade de iluminância virada textura (`luz-na-laje`, `NOITE.luzLaje`):
      o que se vê é o que se mediu. Poste de plataforma só em montante com
      caminho livre para subir e para o braço (a do limite leste furava o
      piso da plataforma de cima).
- [x] Juntas (30/10, em `claude/fase-27-local`): 182 luminárias (147 de
      fora, 35 da laje); `__auditarIluminacao()` com 7 achados, todos fora
      da laje e na lista da nuvem (vias e calçadas sob pipeway, calçada da
      portaria); laje e as 15 bombas acima do alvo.
- [x] Juntas: `__auditarIluminacao()` sem área abaixo do alvo (30/10, 0 achados).

### Fase 27 — Animações (30/10/2026)

Pedido do autor: "quero muito mais animações em todo lugar". Lista
aprovada por ele inteira em 30/10. Toda animação nova fica fora da fusão
(`girante`/`animar`), roda pelo relógio do mundo (o passeio congela e
reposiciona) e o passeio passa a pegar as que valem parada.

**Processo**
1. Tambor dos filtros rotativos F-01/F-02 girando (~1 rpm), a torta saindo na faca. *Local*
2. Torre de resfriamento: ventilador girando e pluma de vapor. *Local*
3. Plumas da chaminé da caldeira e do vent. *Local*
4. Ventoinha dos motores (bombas, agitadores, CP-01) só na que opera; a reserva parada. *Local*
5. Modo corte: bolhas de ar no R-01, agitadores girando (R-01, CR-01/02, D-01), cristais caindo. *Local*
6. Setas do P&ID correndo nos tubos com a legenda de cores (C), na velocidade da Fase 23 (escala log); linha da reserva parada. *Nuvem*
   - [x] Feito (30/10, `claude/fase-27-nuvem`): `site/setasTubos.js` e
     `data/setas.js`. Uma luva fina de setas (chevron claro com contorno
     escuro) 8 mm acima de cada tubo, uv ao longo do escoamento; o shader
     desliza a textura pelo relógio do mundo (o passeio congela), na
     velocidade de `lib/hidraulica.js` em escala log (0,1 m/s → 0,22 m/s
     de tela; 1 → 0,44; 10 → 0,66). Sentido: trecho de processo de onde
     sai para onde chega; ramal e cabeçal de alimentação (CWS, STM) do
     limite leste para o consumidor, retorno ao contrário. Uma geometria,
     uma chamada de desenho, fora da fusão; liga e desliga com a legenda
     (tecla C). 71 linhas; 7 com setas paradas (sem vazão nos dados: as
     linhas de vácuo t43/t44 e as abertas de vent e dreno). Fora da
     oclusão de ambiente: o GTAO desenha normais com `overrideMaterial` e
     só exclui pontos e linhas — a luva entraria como sólida; nessa
     passada ela não desenha nada. Olhado com e sem pós-processamento.
     Não há bomba reserva dentro da laje; as da torre (com reserva) estão
     no pipeway, ainda sem setas — fica para depois.
7. Haste do atuador das válvulas de controle, ponteiro de manômetro, luz dos painéis locais. *Local*
8. Biruta virada pelo vento de `site.js`. *Local*
9. Purgador de vapor soltando um sopro de tempos em tempos. *Local*
10. Descarga de tolueno: luz verde do aterramento ao prender a garra; nível do TK subindo. *Nuvem*
   - [x] Feito (30/10, `site/operacoes.js`): lâmpada no alto do poste do
     carretel, verde enquanto o cabo está preso ao chassi (sistema de
     verificação de aterramento); régua de nível no costado do TQ-01,
     voltada para a baia, com o ponteiro subindo na descarga — 30 m³ do
     caminhão no tanque de Ø 8 m = 0,6 m [ADOTADO, `DESCARGA.volume`] — e
     descendo no consumo ao longo do ciclo do caminhão (fecha sem salto).
     Medido: lâmpada acesa ~40 s, do aterrar ao desaterrar; ponteiro de
     3,84 m a 4,21 m (o teto) na descarga e descendo depois. Operações e
     demais auditorias em zero. Olhado: o poste e o cabo; a régua só pela
     medida.

**Gente** (rotinas novas com auditoria)

11. Coleta de amostra levada ao laboratório; o técnico analisa. *Nuvem*
   - [x] Feito (30/10): pontos de amostragem por regra na descarga das
     bombas das correntes que o laboratório acompanha (`AMOSTRAS`,
     data/rotinas.js [ADOTADO]: BC-02 conversão do reator, BC-07 solução
     antes da cristalização final, BD-02 pureza do produto, BC-03 tolueno
     recuperado); cada operador colhe num, em rodízio. Pose nova `colher`
     (lib/human.js: braço direito estendido, frasco em pé debaixo da
     válvula) e `segurar` (objeto na mão direita); frasco âmbar de amostra
     (`criarFrascoAmostra`). O frasco aparece na metade da coleta, vai na
     mão até a bancada do LAB e fica lá no primeiro terço da parada; o
     laboratorista segue na bancada dele. `__auditarRotinas` em zero.
     Olhado: o operador colhendo na BC-02.
12. Operador sobe a escada do R-01 para ler instrumento; mecânico lubrifica bomba. *Nuvem*
   - [x] Feito (30/10): as escadas de marinheiro do vaso saem da cena
     (`escadasDe`: pé por dentro da gaiola, alto da escada, piso da
     plataforma = alto − 1,0 m de corrimão — `SUBIDA`, data/rotinas.js
     [ADOTADO]); fase nova `sobe` (reta em 3D, de frente para o vaso) a
     0,35 m/s, passo para a plataforma, leitura com a prancheta, volta e
     descida; um operador por escada, alternando. Mecânico agachado no
     mancal com a almotolia (`lubrificar` e `criarAlmotolia`, lib/human.js:
     coxa a 52°, joelho o dobro, quadril desce o que a perna encurta).
     `__auditarRotinas` em zero. Olhado: o operador na gaiola e o mecânico
     na bomba.
13. Ronda noturna com lanterna. *Nuvem*
   - [x] Feito (30/10): papel novo `vigia` (data/rotinas.js) que anda pela
     rede de calçadas de um destino de pedestre a outro (blocos de
     utilidade, escadas do dique, descarga — `destinosPedestre()`, Fase
     28), na ordem em volta da planta, e ilumina cada um. Parada nova na
     calçada (`tipo: 'calcada'`, onde o acesso do destino toca a rede).
     A rede das rotinas não liga o norte (tanques, ETA, torre) ao leste
     sem a laje: entre duas paradas sem caminho por calçada, a ronda
     atravessa a laje — uma parada junto da borda a que se chega a pé e
     outra junto da que leva à seguinte, cada uma com a sua entrada.
     Lanterna (`criarLanterna`, lib/human.js: corpo, lente e facho, um cone
     aditivo só de desenho, fora da oclusão de ambiente) e pose `iluminar`
     (braço erguido varrendo, facho a δ abaixo da horizontal seguindo o
     alvo); o facho acende com a noite (k > 0,5, `rotinas.atualizar` recebe
     o k). `__auditarRotinas` em zero; ciclo do vigia de 14 min. Olhado de
     noite: o facho no piso da baia de descarga.
14. Troca de turno: ônibus, vestiário, área; os que saem, o inverso. *Nuvem*
   - [x] Feito (30/10, `site/ambiente.js`, com o ônibus): quem desce troca
     de roupa no vestiário (`turno.troca` = 40 s, data/ambiente.js
     [ADOTADO]) e sai de macacão de operador para a rampa da laje mais
     perto, pela rede de calçadas (com a laje ligando as rampas; só cruza
     via na travessia); quem embarca veio da laje de macacão, a tempo de
     trocar e chegar ao abrigo antes do ônibus. Tudo no relógio do ônibus;
     a caminhada (145 s, mais que meio ciclo de 181 s) que passa do fim do
     ciclo é cortada nele. `__auditarAmbiente` (10 min simulados),
     operações e rotinas em zero.
15. Treino da brigada com jato no hidrante. *Local*
16. Almoço no refeitório e reunião na ADM. *Nuvem*
   - [x] Feito (30/10): comer e conversar já existiam, mas cada pessoa
     tinha um ciclo (521 a 914 s) e quase nunca coincidiam. Relógio comum
     (`RELOGIO`, data/rotinas.js [ADOTADO]): todos no mesmo ciclo (o maior,
     para cima no minuto: 960 s; a sobra vai para o trabalho de cada um);
     o instante inicial de cada pessoa põe o almoço em 420 s, um chegando
     5 s depois do outro; para os administrativos, o intervalo da reunião
     da ADM ao almoço é igualado (a diferença no trabalho de mesa entre os
     dois), e a reunião cai junta. Medido (um ciclo, a cada 5 s): 10 pessoas
     comendo juntas, 4 na reunião juntas; `__auditarRotinas` em zero.

**Veículos e luzes**

17. Fotocélula: ao escurecer as luminárias acendem por grupo, com atraso. *Local*
18. Faróis acesos à noite; luz de ré e giroflex âmbar em caminhão e empilhadeira. *Local*
19. Luz de obstáculo piscando na chaminé e nos mastros. *Local*

**Entorno**

20. Árvores e arbustos balançando ao vento (shader). *Local*
21. Pássaros em bando, desviando de estrutura (a auditoria mede pássaro dentro de geometria). *Nuvem*
   - [x] Feito (30/10): `site/passaros.js` e `data/passaros.js` [ADOTADO].
     Dois bandos de 12, boids (separação, alinhamento, coesão) atrás de
     alvos trocados a cada 12–25 s, de 12 a 32 m de altura; desvio quando
     um de três pontos a frente cai na caixa de um obstáculo (+3 m) — as
     caixas de tudo o que passa de 4 m, cada instância de poste por si,
     5 537 numa grade de 10 m, tiradas da cena antes da fusão. Parede a 20
     m da borda do lote, piso cada vez mais duro abaixo de 12 m, separação
     mais de lado que de cima (empilhadas, um bando mergulhou de 12 a 3 m).
     A ave é um "V" numa InstancedMesh; a batida de asa é a escala Y; de
     noite somem. `__auditarPassaros(seg, sementes)` simula a partir do
     estado inicial (não do que já rodou) em várias sementes: 10 × 10 min
     sem ave na geometria, fora do lote nem baixa, com o desvio agindo em
     8 154 passos de ave. Olhado só de longe (pontos no céu); de perto,
     não.
22. Ponte raspadora do decantador da ETA e aerador da ETE. *Nuvem*
   - [x] Feito (30/10). A ETA não tem decantador (decisão de 27/10: água
     de poço, só abrandador); o decantador é o secundário da ETE, e a ponte
     é a dele. Ponte do raspador num subgrupo girante em volta do poço
     central, 3 cm/s na borda [ADOTADO, raspador periférico de 1 a 3 cm/s];
     o borbulhar do biológico vira uma InstancedMesh só, cada círculo de
     espuma pulsando fora de fase. Relógio do mundo para as duas pelo
     `userData.animarTempo` (main.js anda todos). Auditorias em zero;
     olhado: a ponte girada e a espuma do biológico.
23. Ponte rolante da oficina. *Local*
24. Bandeiras tremulando no mastro. *Local*
25. Câmeras de segurança girando. *Local*

Começa depois da Fase 26 de cada sessão.

**Feito (sessão local, `claude/fase-27-local`, 30/10)**
- [x] 1 — já existia: tambor dos filtros a 0,50 rpm (Datasheet).
- [x] 2 e 3 — plumas da torre (duas células), da chaminé e do vent, com o
      vento de projeto (`site/animacoes.js`, `PLUMAS`); ventilador de seis
      pás na torre, 50 rpm desenhados (o real, ~180 rpm, estroboscopa).
- [x] 5 — bolhas de ar do sparger do R-01 subindo no líquido, vistas no
      corte (escondidas pelo plano de corte) e pelo visor. Os agitadores
      de CR-01/02 e D-01 não giram: o construtor genérico não desenha
      agitador interno (fica para depois).
- [x] 8 e 20 — copas balançando no shader (fase por árvore, mais no
      sentido do vento) e biruta oscilando em volta do rumo (`site/vento.js`).
- [x] 17 — fotocélula: cada grupo de luminárias acende em degrau no seu
      limiar de escuridão (`NOITE.fotocelula`).
- [x] 18 — giroflex âmbar nos caminhões e na empilhadeira; luz de ré acesa
      só na ré.
- [x] 19 — balizamento piscando também no topo dos dois mastros da laje.
- [x] 23 — ponte rolante da oficina andando nos trilhos, carro na viga.
- [x] 5 (resto) — eixo e impelidores girando no CR-01, CR-02 e D-01 (o
      genérico recebe o bloco do agitador; 60, 65 e 90 rpm).
- [x] 15 — teste do canhão monitor: jato d'água em arco, 40 s a cada 5 min,
      um canhão por vez; os canhões passam a apontar para o parque.
- [x] 24 — mastros de bandeira (nacional e da empresa) em frente à ADM.
- [x] 25 — câmeras de CFTV nos quatro cantos do lote, varrendo; as duas do
      portão não acharam lugar livre na praça da portaria.
- [x] 6 (nuvem, `claude/fase-27-nuvem`) — conferido na placa de vídeo:
      as setas correm sobre os tubos com a legenda ligada e não custam
      quadro (17,3 fps com e sem).
- [x] **Desempenho** (30/10, medido a pedido do autor antes de juntar
      no `main`): `main` e esta branch recarregados com minutos de
      diferença, mesma vista (canto sudeste da laje), mesmo canvas
      1177×830, Intel integrada: **44 fps no `main`, 39 na branch**. Os 14
      fps de antes eram o estado da máquina (a cena era a mesma: 2 652
      chamadas e 1,38 M triângulos, contadas num quadro com sombra). Em
      quadro sem sombra são 1 764 chamadas contra 1 679 (+85); o custo está
      nos triângulos (+570 k: 216 k nas luminárias de fora, 39 k nas da
      laje). Se precisar, menos segmentos na cabeça das luminárias.
- [ ] 4, 7 e 9 — pendentes (ventoinha de motor, haste de válvula e
      manômetro quase não se veem; purgador não está modelado).

---

### Fase 28 — Rede de pedestres (30/10/2026)

Pedido do autor: "mapear os caminhos de pedestres. Tem muitos lugares
inacessíveis a pedestres pois não há calçadas conectadas nem faixas de
pedestres." O `__auditarImplantacao()` dava zero porque o acesso de cada
bloco entrava na rede pela perpendicular mais perto — através de via ou de
prédio — e só 13 pares eram medidos.

- [x] `site/pedestres.js` (roda no Node): destinos tirados dos dados — porta
      de cada prédio (`PORTAS`), as duas catracas, o abrigo do ônibus, o
      estacionamento, as 5 rampas de pedestre da laje, as 2 escadas do
      dique, cada bloco de utilidade e a descarga (meio do lado voltado para
      a rede, a regra da porta) e os 2 pontos de encontro (28 destinos);
      grafo das calçadas (`redeDePolilinhas`) com o acesso de cada destino,
      que só vale se não cruzar via nem bloco alheio; trecho de calçada
      sobre a pista é travessia. Regras em `data/pedestres.js`.
- [x] Achados: INACESSIVEL, TRAVESSIA_FALTANDO, CALCADA_SEM_SAIDA (fora do
      lote a calçada segue pela cidade), DESVIO (> 2× a reta e 20 m, das
      catracas, do ônibus e do estacionamento) e SEM_ROTA_DE_FUGA (até o
      ponto de encontro mais perto, em metros por destino). Entram no
      `__auditarImplantacao()` como `PEDESTRE_*`; `__auditarPedestres()` e
      `mapaPedestre()` (arestas calçada/caminho/travessia, destinos com
      alcançado, metros e fuga) para a vista de planta.
- [x] Antes, nos dados do `main`: **7** — porta do armazém no portão do
      caminhão, a 30 m da calçada do outro lado da via; escada oeste do
      dique sem calçada; abrigo → porta da ADM 51 m contra 23,5; quatro
      calçadas terminando em nada (principal-leste em z = −30, frente-apoio
      a 11 m da calçada da principal, a do armazém e torre-eta 8 m além
      da ETA).
- [x] Conserto por regra: prédio com garagem põe a porta de pedestre do
      lado da calçada (`PORTAS`, entorno.js); principal-leste até o caminho
      das utilidades; frente-apoio até a calçada oeste da principal;
      torre-eta até o meio do lado da ETA; caminho do abrigo, entre a ADM e
      o refeitório, à frente dos prédios e ao armazém; volta do dique por
      dentro do anel, pelo sul e no meio-fio (pelo norte a linha 27 desce
      do pipeway e corre a 1,4 m colada nela). No `__auditarImplantacao`,
      bloco aberto entra por qualquer lado com calçada perto, e o par passa
      se alguma porta passa.
- [x] Depois: **0** achados de pedestre, 28 de 28 destinos alcançados, 12
      travessias, 757 m de calçada e 645 de caminho. Em zero: implantação,
      `__auditar`, arranjo, entorno, segurança, ambiente, operações,
      interiores e chão (`?semfusao`), passeio. Tanques de volta a 1,5 m
      da borda (a 2,5 a fila sul caía na volta do dique): 60,6 lx / 0,41.
      Olhado de cima: a volta do dique.
- [ ] `__auditarRotinas`: 2 (PESSOA_NO_MOVEL, administrativo 1 na ADM em
      (82,1; 90,3)). O caminho dele começa 0,4 m dentro de um móvel de 2 m
      de altura (z 89,5–90,4) — o lugar de chegada cai no móvel vizinho.
      Defeito antigo do arranjo interno: aparece agora porque, com as
      calçadas novas, os tempos de chegada mudaram e ele ficou com outro
      lugar. Para a sessão local (interiores e móveis). → Consertado pela
      sessão local em `lib/navegacao.js` (a reta do assento à célula livre
      atravessava o armário vizinho).
- [x] Calçada na entrada do estacionamento sem faixa (achado da sessão
      local): a via de acesso terminava na borda do bloco e a calçada da
      portaria cruza a entrada 1 m dentro dele. A via entra 3 m no bloco
      (no estacionamento o carro anda por dentro; o `__auditarImplantacao`
      deixa via entrar em bloco de estacionamento) e o cruzamento vira
      travessia pela regra de sempre. Olhado: a faixa aparece na entrada.
- [x] Local (30/10): mapa — verde calçada, branco travessia, vermelho
      trecho na pista (hoje 5,5 m na calçada portaria-oeste), ponto
      vermelho porta sem caminho (hoje a do armazém).
- [x] Local (30/10): o mapa passa a ler a `mapaPedestre()` da nuvem (28
      destinos, verde alcançado e vermelho não); a pessoa que saía da
      cadeira atravessando o armário vizinho na ADM (PESSOA_NO_MOVEL) foi
      corrigida em `lib/navegacao.js` (a saída do assento não atravessa
      móvel). Tudo junto em zero: implantação, chão, interiores, rotinas,
      ambiente, operações, passeio e a geral.
- [ ] A calçada portaria-oeste cruza a entrada do estacionamento em
      x ≈ 44 (5,5 m) sem travessia: pede travessia ou rebaixo (nuvem).

---

## Decisões

Registro do que foi decidido, com data. Uma linha por decisão.

| Data | Decisão |
|---|---|
| 22/10/2026 | `Especificações dos Equipamentos/` passa a ser a fonte da verdade. |
| 22/10/2026 | `entregaveis/` vira `geracao-de-documentos/`, mantida como histórico; saídas antigas removidas. |
| 22/10/2026 | `CONTRIBUINDO.md` removido; o essencial passou para o `CLAUDE.md` e, no que é de croqui, para o README de `geracao-de-documentos/`. |
| 22/10/2026 | Camisa do R-01 é de **água de resfriamento** (a reação é exotérmica). |
| 22/10/2026 | D-01 segue o Datasheet: Ø 1,29 m e 3,82 m de costado. |
| 22/10/2026 | Linha 10 ganha a bomba **BC-09** em vez de elevar o TK-01 — proposta aceita provisoriamente, pendente de revisão da equipe (pendência A). |
| 22/10/2026 | Divergências 4, 5, 7, 8, 9, 10, 11 e 12 seguem o padrão da hierarquia até decisão em contrário. |
| 22/10/2026 | CR-01 e CR-02 com fundo cônico de 90° sobre pernas; D-01 sobre pernas (divergência 3, delegada). |
| 22/10/2026 | Duas bombas de vácuo, uma por filtro: BV-01 e BV-02 (divergência 6). |
| 22/10/2026 | Fichas da maquete não precisam citar documento e folha. |
| 22/10/2026 | Planta baixa da Fase 3 aprovada: vento de SE, distâncias da BN-DS-C69 e do NFPA 30 (a confirmar com a bibliografia), terreno de 5,2 ha. |
| 22/10/2026 | Arranjo da Fase 4: CP-01 no canto SE da laje (a barlavento), TK-01 girado 180° junto ao rack, T-01 e E-03 fora das sapatas, segunda escada do R-01 a 60°, vent do S-04 a 15 m. Mureta, guindaste e vent são [ADOTADO]. |
| 23/10/2026 | `Especificações dos Equipamentos/` fica intacta; as revisões que a maquete pedir vão para a cópia `Especificações dos Equipamentos (revisão da maquete)/`, com uma linha nesta tabela. |
| 23/10/2026 | Ficha, Exibição e Ajuda abrem ocultas; a ficha abre ao clicar num componente. |
| 23/10/2026 | Tubulação viável e otimizada: a auditoria mede hidráulica, apoio a cada vão (ASME B31.1), guias de riser, sucção sem ponto alto, suspensão sempre descendo e comprimento contra o caminho mínimo. |
| 23/10/2026 | Bombas propostas **BC-10** (filtrado do F-01, pendência L) e **BC-11** (concentrado do T-01, pendência J); BC-02 mantida, com a dúvida na pendência K. |
| 23/10/2026 | CR-01 e CR-02 sobem nas pernas (tangência a 5,4 e 4,8 m) para a suspensão descer a 2 % até o filtro, sem ponto baixo. Linha 07 vai a dreno fechado (o V-02 a 1 bar não a eleva ao rack). |
| 23/10/2026 | Escadas do R-01 a 90° e 270°: a 200° e a 60° desciam sobre os bocais N2 e N9. A plataforma tinha vão e guarda-corpo em lugares trocados (três convenções de ângulo); corrigido, com o piso contínuo e furo onde passa tubo. |
| 23/10/2026 | CR-01, CR-02 e D-01 girados 180°, com os bocais de camisa para o rack; caixa coletora ao sul do rack e rampa leste em z = −2,5, fora das linhas de colunas. |
| 23/10/2026 | Válvula de controle e instrumento de linha ao alcance do piso (eixo ≤ 2,5 m); V-03b desce para 1,65 m, com trecho bifásico de 2,5 m até o T-01 (a equipe pode preferir a válvula no bocal, com plataforma). |
| 23/10/2026 | Linhas de vácuo V1 (6") e V2 (4"): desenhadas sem rótulo no P&ID; nome, código VAC e DN da maquete (estimados). BV-01 22 kW e BV-02 11 kW (estimados). |
| 23/10/2026 | Entorno: volumes e utilidades em `entorno.js`, todos [ADOTADO]/[ESTIMADO] — torre de 2 células para 224 m³/h, caldeira de pacote para 2 637 kg/h com chaminé de 18 m, 2 × 1 MVA, água de incêndio de ≈ 477 m³. |
| 23/10/2026 | Pipeways nas cotas do rack (5,2/7,0 m), coluna única no meio do acostamento a 1 m do meio-fio, via e rampa de veículo só por ponte com ≥ 4,5 m livres (IT 06 do CBPMESP). Vapor e condensado sobem com a água e viram para a caldeira na latitude dela: pelo sul davam 65 m contra 48,5 m do mínimo. Drenagem fechada até a ETE enterrada, a 1 %. |
| 23/10/2026 | Segurança: equipamento de emergência posto pela regra de cobertura (escolha gulosa entre pontos livres), não à mão; zonas classificadas só ilustrativas, com a ordem de grandeza da API RP 505 / NFPA 497. Ponto de encontro principal a barlavento (ENCONTRO-1). Tudo [ADOTADO], a confirmar com NR-20 e as IT do CBPMESP. |
| 23/10/2026 | PSV-01 e PSV-02 desenhadas nos bocais que o Datasheet já prevê (R-01 N5, V-01 N4), sem mudar os documentos; dimensionamento e bloqueios no limite de bateria ficam como pendências N e O. |
| 23/10/2026 | TAG pintada no costado (tinta, sem placa) e etiqueta flutuante só de longe; etiqueta atrás de algo sólido some. Oclusão de ambiente com desligamento automático por desempenho. |
| 23/10/2026 | Texturas só procedurais (canvas + projeção triplanar), nenhuma imagem no HTML. Piso dos blocos é o real (concreto, brita, calçada, grama, asfalto); a cor de categoria fica para a vista de planta. |
| 26/10/2026 | As posições dos equipamentos deixam de ser fixas: a área de processo é rearranjada com corredores pintados e o custo de tubulação como critério (Fases 11 e 12), e o terreno é revisto com estacionamento dentro da cerca, ponto de ônibus, rede de calçadas e ETA (Fases 13 e 14). Pedidos do autor. |
| 26/10/2026 | Cotas dimensionais flutuantes do R-01 retiradas, com a opção delas na Exibição: a ficha já traz os números. |
| 26/10/2026 | Arranjo proposto da área de processo (Fase 11), uma versão só, a mais econômica: rack central de 7 m com bombas sob as bordas e corredor de manutenção de 3,2 m; reação e recuperação de solvente ao norte, purificação ao sul, em U; R-01 a nordeste com guindaste pela via do anel; CP-01 a sudeste, a 14,9 m do R-01, com a tomada a barlavento; laje de 30,7 × 22,0 m; custo estimado −38 %. Aprovado pelo autor em 26/10. |
| 26/10/2026 | Etiquetas nascem ocultas (a TAG pintada identifica de perto) e acendem sozinhas na vista de planta. |
| 26/10/2026 | Fase 12: rack de 7 m com as faixas sobre o corredor do meio; travessia lateral apoiada na longarina e em pórtico posto perto dela; linha baixa do recuo pendurada na longarina; rack avança até o acostamento e o último pórtico apoia a virada dos pipeways (a rampa do corredor fica livre). Corredor transversal norte entre o TK-01 e o V-01, vão de 1,8 m entre o T-01 e o E-02, V-01 e T-01 girados 180°, passagens de saia do R-01 e do T-01 viradas para o rack. |
| 26/10/2026 | Tubo varrido com um anel por ponto e 12 no arco do cotovelo, no lugar do TubeGeometry: a curva era uma corda achatada. |
| 26/10/2026 | Fase 13: cerca até 1 m da via pública, estacionamento dentro, depois da guarita; carro a ≥ 60 m de processo, tanques e descarga, como prédio ocupado. Ônibus por um retorno circular (eixo de 10 m, pista de 7 m, veículo O do DNIT a confirmar) e baia de 24 m do lado do vestiário. |
| 26/10/2026 | Rede de calçadas medida: só cruza via, uma rede só (a laje liga as rampas), bloco a ≤ 10 m, caminho ≤ 1,5 × a reta; ao lado da via principal, 1,25 m de faixa de serviço para poste e pé de ponte. |
| 26/10/2026 | Balanço de água (`agua.js`): demanda de 9,1 m³/h, ETA de 12 m³/h junto da torre; ETE de 3,0 m³/h contínuos com equalização de 130 m³. Calor da torre corrigido para 5,0 MW; drenagem da laje de DN 150 para DN 200. |
| 26/10/2026 | Segunda rodada da Fase 13 (pedido do autor): portaria numa ilha no meio da via, como a entrada de um campus, guarita envidraçada com visão de 360°, uma cancela por pista e cobertura tipo praça de pedágio; acesso da via pública com faixas de aceleração e desaceleração e curvas suaves; abrigo coberto e caminho único até o vestiário; calçada encostada no meio-fio; esquinas arredondadas; meio-fio só onde faz sentido; áreas verdes no espaço vazio; travessia elevada. Nova Fase 14 (vias, calçadas e verde, com o fim do z-fighting nos cruzamentos); portaria e ônibus passam à 15, entrega à 16. |
| 26/10/2026 | Segunda rodada da Fase 13 feita: cerca do sul na linha das cancelas (lote de 225 × 254 m), via pública em z = 155 com faixas de desaceleração (25 + 15 m) e aceleração (55 + 15 m), curvas de 14 m e pistas de 5 m na portaria; via pública leste 15 m para leste, com curvas de 15 m para os caminhões fora da cerca. Raio de esquina pelo menor veículo que faz a curva (6/10/12 m), exceção só com motivo; travessia sempre fora do arredondamento. Porteiro dentro da guarita. |
| 26/10/2026 | Pedido do autor: prédios entráveis e com coisas dentro — nova Fase 16; a entrega passa à 17. |
| 27/10/2026 | Fase 14: chão sem operação de polígono — via, curva e arredondamento de esquina no mesmo material e na mesma altura (a sobreposição não pisca); camadas de materiais diferentes a 4 cm ou mais; pintura no piso com deslocamento de profundidade. Calçada 15 cm acima da pista. Esquina da lig-norte com o anel em 6 m por causa do pipeway da torre. 38 vagas. |
| 27/10/2026 | Raios de esquina pela metade (3/5/6 m), pedido do autor. Vértice onde outra via nasce não vira curva (só o arredondamento de dentro); esquina em T só no trecho reto da outra via. Utilidades de piso de brita com a placa do bloco crescida 3 m, sem brita separada por baixo. |
| 27/10/2026 | Fase 15: portaria com guarita de vidro e o porteiro visível, cobertura de 21 × 12 m com 5 m livres, uma cancela por pista (para, espera 3 s, sobe a 85°), três carros de funcionário que estacionam em vagas reservadas e saem de ré, ônibus com desembarque e embarque no abrigo. Peça que se mexe fica fora da fusão (`userData.girante`). |
| 27/10/2026 | ETA sem clarificador nem desmineralização (água de poço; caldeira flamotubular de 8–10 bar pede só abrandador). Separador água-óleo pela API 421 (gota de 150 µm de tolueno): 2,0 × 8,5 m. A drenagem chega a 1,54 m abaixo do piso, então separador e equalização ficam enterrados, com laje, e a equalização bombeia ao biológico. Drenagem de 62 para 37 m. |
| 27/10/2026 | Purgas da torre e da caldeira e rejeito da ETA vão direto ao lançamento, sem passar pelo biológico — é o que fecha com o biológico de 15 m³ do `agua.js` (0,56 m³/h orgânicos). A equipe revisa. |
| 27/10/2026 | Letreiro de cada prédio na fachada voltada para o centro da área de processo, se à vista (nenhum prédio a 8 m na frente dela) e sem árvore nos 15 m diante dele; a porta continua do lado da calçada. |
| 27/10/2026 | Fase 16: prédio oco com parede de 20 cm, janela recortada com vidro fumê e porta de duas folhas que abre sozinha a 3,5 m; câmera colide com parede, laje e divisória (esfera de 0,3 m). Interior por regra a partir do programa de cada prédio (`data/interiores.js`), com 1,2 m livres diante de porta e escada; só a menos de 40 m. |
| 27/10/2026 | ADM com a recepção no meio (onde fica a porta), arquivo com a escada numa ponta e escritório na outra; 20 postos para os ~25 do horário administrativo. Casa de cubículos sem janela baixa; casa da ETA de 7 × 5 m. Dentro de prédio, sem oclusão de ambiente. |
| 27/10/2026 | Fase 17: controle de Xbox real aprovado (zona morta de 0,15 mantida: deriva medida de 0,064); vistas 6 a 9 (ônibus, ETA, ETE, sala de controle por dentro); pessoa a mais de 120 m não é desenhada; painel Exibição com rolagem em tela baixa. |
| 27/10/2026 | Pendência O: o limite de bateria tem de ser respeitado (pedido do professor) — bloqueio e raquete em toda linha que o cruza, a desenhar. A rota das purgas na ETE e a pendência N ficam como estão. |
| 27/10/2026 | Fase 18 (proposta): ronda de inspeção visual em `src/dev/inspecao.js` (40 postos) e a primeira lista de achados, a corrigir com o aval do autor. |
| 27/10/2026 | Fase 18: bloqueio no limite de bateria por plataforma ao lado do feixe (não descendo as linhas ao piso: ponto baixo em vapor e condensado); casas de bombas com coletores; subestação com pátio cercado e entrada de média tensão enterrada; vidro fosco no vestiário e no ambulatório; rótulo curto na planta. |
| 27/10/2026 | Depois da ronda: janelas atravessáveis, placa de nome com pictograma, calçada de acesso às portas, filtros rotativos fechados por capô (tolueno), isolamento opaco, visor nas bocas de visita com a chapa aberta atrás (`lib/furos.js`), armazém com portão de garagem e o baú carregado lá dentro. Fases 19 (veículos), 20 (pessoas com rotina) e 21 (operações animadas) propostas, a começar com o aval do autor. |
| 27/10/2026 | Fase 19: percursos com arcos do giro do veículo de projeto; caminhões entram de ré (tanque pelo entroncamento da descarga, baú por um pátio de manobra novo entre o armazém e a cerca) e saem de frente; fila e preferência com previsão de 4 s, linha de parada na via pública e relógio parado de quem espera; caminhões detalhados com painel 33/1294 e rótulo classe 3. Manobra de vaga com raio de 4 m (corredor de 6 m). |
| 28/10/2026 | Fase 20: dez pessoas com agenda cíclica por papel (operador, administrativo, laboratorista, mecânico), lugar escolhido pela ação do móvel e caminho por busca (grade nos prédios e na laje, rede de calçadas fora); sentam, digitam, comem, conversam e trabalham na bancada; portas abrem e veículos cedem. Térreo só (a escada fica para depois). |
| 28/10/2026 | Fase 21: descarga de tolueno com operador, calço, aterramento, mangote e válvula; porta de enrolar e empilhadeira no armazém (baia livre de 18 m); portas e degrau do ônibus; espera do tanque de 72 s e do baú de 64 s, do tamanho da operação. |
| 28/10/2026 | Pendências das Fases 20 e 21: rotinas sobem a escada (grade por pavimento; administrativos no 1º pavimento do ADM) e as portas traseiras do baú abrem na carga. |
| 28/10/2026 | Fase 22 (proposta): passeio automático de câmera — roteiro em sete capítulos a partir da fachada, splines de posição e alvo com velocidade constante e frenagem suave, relógio dos atores acertado para pegar as animações, legenda, mini-mapa e auditoria. Aguarda o aval do autor. |
| 28/10/2026 | Fase 22 feita: 35 paradas em oito capítulos, 12 min, em laço. A ordem segue o produto (tolueno chegando → tanques → processo → armazém) em vez de deixar a logística para o fim; utilidades depois. O mouse não interrompe o passeio (só G, Esc ou View). O botão View do controle, que abria a planta, passou a ser o passeio (a planta segue na tecla P). Rack e tubos entraram como sólidos da câmera do passeio. |
| 28/10/2026 | Fase 22, controles: pausar congela o mundo junto (como vídeo), não só a câmera — senão os eventos se perdem ao continuar. Pular de parada é corte, então se faz com a tela escura (0,35 s), e é nesse escuro que os atores são reposicionados. O ator de evento é reposicionado para a volta seguinte só fora do quadro. A órbita de equipamento escolhe o lado em que o assunto aparece (F-02). Testado no Chromium sem tela (renderização por software), inclusive o HTML por file://; falta olhar no navegador de verdade. |
| 28/10/2026 | Fase 23: verificações hidráulicas com as cotas da maquete, fora da ficha (o autor: a informação técnica vai no relatório final). Schedule do inox: 10S do DN 50 para cima, 40S abaixo. Número oficial que não fecha vira pendência (C corrigida; K acrescida; Q, R, S e T novas); número da própria maquete se adapta até fechar — BC-11 de 3 × 2 × 8 para 1½ × 1 × 8 (NPSH), sucção e descarga das BAR-01 em DN 250 e DN 200, bocais de água do CR-02 de DN 80 para DN 50. A saia do V-01 não sobe pelo NPSH da BC-02: faria sifão na linha 03 do E-01. NPSH no nível de operação (`nivelDeVolume`); filtros e trocadores pela cota do bocal; tanques e bacia no nível mínimo. |
| 28/10/2026 | Fase 24 feita: modo noite (tecla N) e croquis oficiais na ficha. A folha vem do PDF final por script (`npm run croquis-ficha`), nunca editada. A luz de dentro dos prédios é uma lâmpada na sala da câmera, não a luz ambiente da cena (que clareava o lado de fora). Os shaders da noite compilam em segundo plano depois de carregar. |
| 28/10/2026 | Fase 25 (plano): "nada flutuando, tudo ligado" na área de processo. Primeiro a medida (auditoria de contato, sessão na nuvem), depois o conserto, cada sessão nos seus arquivos: a nuvem cuida do que liga os equipamentos (tubos, apoios, válvulas, instrumentos, bombas), a local cuida dos equipamentos e das estruturas deles, do céu e da noite. |
| 30/10/2026 | Fases 22 a 25 juntas no `main` (as duas sessões). Conflitos resolvidos somando os dois lados; medido no `main` junto: as auditorias de sempre, a hidráulica (0 novos, 8 aceitos), e com `?semfusao` apoios, chão, interiores e contato (65 folgas, nenhuma peça solta). Daqui para a frente todo trabalho novo parte do `origin/main`. |
| 30/10/2026 | Grama no meio da via principal (perto da Brigada e da ADM): a placa da faixa verde ficava 8 cm acima do asfalto. A faixa é o gramado do próprio chão, cruzado por via e calçada; a placa só aparece na vista de planta (legenda), abaixo da pista. Árvores da faixa no gramado; veículo que a cruza fica na via. |
| 30/10/2026 | Fase 26 (iluminação) aprovada pelo autor: EN 12464-2 dentro da cerca, NBR 5101 só na via pública, emergência pela NBR 10898; espaçamento saído do alvo de lux (mede e adensa), não de regra fixa. Laje com a sessão local, fora dela com a nuvem; uma fotometria só para a auditoria e para a luz da noite. |
| 30/10/2026 | Fase 27 (animações) aprovada inteira pelo autor: as 25 ideias da lista. A nuvem pega o que é lógica e dado (setas nos tubos, rotinas novas de gente, pássaros, ETA/ETE, descarga); a local, o que depende de olhar. A sessão da nuvem não pergunta nada ao autor: dúvidas vão para a sessão local. |
| 16/11/2026 | Pedido do autor: sai o clique no objeto (seleção, realce e ficha do componente) e saem o botão e o atalho das etiquetas — a ficha fica só para o equipamento do "Ir para" (tecla F) e as etiquetas só acendem na vista de planta, onde são a legenda. Controle de Xbox como no Minecraft: A duas vezes troca entre voar e andar (gravidade, olhos a 1,7 m, A pula; voando, A sobe e B desce); o analógico anda sempre no plano do chão. Andando, o piso é y = 0 ou o topo da caixa de colisão sob os pés; a escada do ADM continua só voando. Botões Tanque (K), Baú (B) e Ônibus (O) levam a câmera ao veículo na hora; fora de cena, avisam em quanto tempo ele volta. Testado com controle simulado no console, não com o controle real. |
| 16/11/2026 | Passeio (pedido do autor): em vez de trajeto contínuo, cada parada é uma tomada lenta (teto de 1,6 m/s no chão, mais com a altura; a tomada estica até 1,6 vez o tempo dela) e a seguinte entra com corte em fade de 0,7 s; saiu a regra `LACO_COM_SALTO`. A volta ficou em 9 min 46 s, com a descarga alongada para 50 s para mostrar o operador. Saiu também o botão/atalho do título (ele some com H). |
| 16/11/2026 | Operadores dos caminhões: o da descarga agacha para calçar e pegar o mangote, leva cabo e mangote na mão de verdade, engata, gira o volante e acompanha a descarga de prancheta; vira e arranca suave. No baú, um conferente abre e fecha as portas traseiras (elas passaram a abrir quando ele chega) e confere a carga ao lado; a empilhadeira ganhou operador sentado. `__auditarOperacoes()` em zero, com `CONFERENTE_SEM_TEMPO` e o conferente em `PESSOA_NO_CAMINHO`. |
| 16/11/2026 | Companion (tecla M, X no controle): NPC que surge atrás da câmera no modo andar e a segue preso à faixa de 2 a 3 m; reaparece atrás se ficar a mais de 18 m; espera no chão enquanto a câmera voa. |
| 16/11/2026 | Passeio, de novo (o autor): cada tomada é uma reta — a câmera começa e segue na mesma direção. Dos pontos de cada parada fica o par mais afastado com o caminho livre; o visor termina diante do vidro; prédio que se entra e o armazém são um travelling pela porta, à altura dos olhos (no armazém, olhando a baia do caminhão). Nada é inserido nem subido no caminho; `CAMERA_DENTRO` confere. Volta de 8 min 36 s, auditoria em zero. |
| 16/11/2026 | Passeio: o capítulo Processo abre com o "Corredor central" (o autor: uma passagem como túnel) — 49 m em linha reta sob o pipe rack, a 2,8 m (acima de quem anda ali), de fora da área até sair do outro lado, olhando em frente; 29 s. É a antiga parada "Pipe rack e bombas", que ficava no fim do capítulo. Volta de 8 min 47 s, auditoria em zero. |
| 16/11/2026 | Saem da maquete o título escrito na tela e os painéis Ficha e Exibição (o autor: não servem à apresentação), com os atalhos F e Tab. O código dos painéis fica em `src/arquivo/paineis.js`, que ninguém importa — nem ele nem `data/croquis.js` (680 kB) entram mais no HTML. As vistas seguem nas teclas 1 a 9 e o "ir para" no direcional do controle; camadas e corte em seção ficam sem comando na tela. |
| 16/11/2026 | Maquete mais leve para a apresentação (o autor aprovou os itens 1 e 2 da lista): a ficha deixa de separar unidade na fusão, menos nos objetos do entorno (de 1 702 para 1 074 malhas); etiquetas só são calculadas e desenhadas na vista de planta; saem o corte em seção, a camada de projeto da segurança (zonas, distâncias, rotas — os equipamentos de combate ficam) e a oclusão de ambiente; sombra de 4096 para 2048 px; 1 pixel por pixel de CSS. Medido na mesma sessão, mesma máquina: quadro de 72 para 36 ms na vista geral e de 68 para 25 ms na área de processo (chamadas de 2 391 para 1 954 e de 1 716 para 1 109). `__auditar()` passa a pedir `?semfusao` (fundida, acusa 14 `APOIO_ATRAVESSA` falsos). Corrigido de passagem: noite e planta juntas davam erro (neblina nula). |
| 16/11/2026 | Repositório preparado para ficar público (ainda privado). Varredura: nenhum segredo, e-mail ou caminho de máquina nos arquivos nem no histórico; nomes do grupo e RA estavam nos documentos das duas pastas de especificações (texto, carimbo e metadados), no `src/data/croquis.js`, no modelo de datasheet dos geradores (nomes de terceiros) e no HTML de entrega antigo. Tudo isso saiu do repositório para `../documentos-privados/`; os geradores leem os nomes de `equipe.local.json` (fora do git); HTML regerado sem nomes (1,17 MB, era 1,95). `.gitignore` e gancho `.githooks/pre-commit` barram documento, segredo, e-mail, caminho e os nomes de `.nomes-privados.txt`. |
| 16/11/2026 | **Pendência antes de publicar:** o histórico do git (109 commits, no GitHub inclusive) ainda tem os documentos com nomes e RA — pastas de especificações, `entregaveis/`, `docs/`. Publicar exige histórico novo (um commit só a partir do estado atual) ou reescrita com `git filter-repo`, e empurrar com força. Decisão do autor. |
| 16/11/2026 | Histórico novo (decisão do autor): o `main` local passou a ter um commit só, com o estado atual; o histórico antigo (109 commits e todos os ramos) está guardado em `../documentos-privados/historico-antigo.bundle`. **Falta, antes de publicar:** levar isso ao GitHub — o repositório de lá ainda tem o histórico antigo e os ramos `claude/*`. O `main` local não segue mais o `origin/main`: **não dar `git pull`** (traria o histórico antigo de volta). Dois ramos remotos têm trabalho que não está no estado atual: `claude/fase-27-nuvem` e `claude/nuvem-respostas` (estão no bundle). |
| 16/11/2026 | No GitHub: o repositório antigo foi renomeado para `3D-Engineering-Views-historico-privado` (privado, intacto, com os ramos `claude/*`) e um repositório novo, **ainda privado**, recebeu o nome `3D-Engineering-Views` com o `main` de histórico novo. O `git pull` voltou a ser seguro (o `origin` é o repositório novo). Tornar público é só mudar a visibilidade do novo — decisão do autor. Sessão na nuvem: aponta para o repositório antigo; precisa ser refeita no novo. |
| 16/11/2026 | Entra o que a sessão da nuvem fez da Fase 27 e tinha ficado fora do `main` (ramo `claude/fase-27-nuvem` do repositório antigo): itens 11 (amostra levada ao laboratório), 13 (ronda noturna com lanterna), 14 (troca de turno com o ônibus), 12 (escada do R-01 e lubrificação de bomba), 16 (almoço e reunião no relógio comum), 21 (pássaros em bando), 22 (ponte do raspador e aeração da ETE) e 10 (luz do aterramento e régua de nível do TQ-01). Entrou como conteúdo, por junção de três vias arquivo por arquivo, sem trazer commit do histórico antigo; 4 conflitos, com as poses novas do operador da descarga (ficaram as duas). Medido depois: rotinas, operações, ambiente, passeio e pássaros com zero achados. Não rodados: interiores, entorno, chão, iluminação e o `__auditar()`. |
| 16/11/2026 | Saem do repositório as menções ao mundo real ligadas ao autor (pedido dele): universidade, departamento, código e nome da disciplina — no `README.md`, no `CLAUDE.md`, na legenda de abertura do passeio, na ficha da placa da entrada e nos comentários. Os termos entraram na lista local do gancho. O local da planta fictícia (dado de projeto) fica. |
| 16/11/2026 | Repositório antigo do GitHub apagado (pedido do autor), depois de conferido: todos os ramos já estavam no `main`, menos o `claude/fase-27-nuvem` (que entrou, linha acima) e o `claude/nuvem-respostas` (14 commits vazios, só mensagens); sem pull requests, issues, tags, releases, wiki ou forks. A cópia em `../documentos-privados/historico-antigo.bundle` foi refeita antes, com os ramos mais novos da nuvem (138 commits, verificada). O repositório novo foi regravado num commit só, para o histórico não guardar as menções retiradas. |
| 16/11/2026 | Sai também o primeiro nome do autor (pedido dele): 120 menções em 33 arquivos viraram "o autor"; o nome entrou na lista local do gancho. |
| 16/11/2026 | Companion com outra figura (pedido do autor): forte, camisa de listras rubro-negras, cabelo preto, shorts azul-escuro e chinelo. `criarPessoa` ganhou `porte`, `listras`, `manga`, `shorts` e `chinelo` (o padrão não muda as outras pessoas); os números ficam em `COMPANION.figura`. Olhado na tela parado; não olhado andando. |
| 16/11/2026 | Companion (pedido do autor): corpo forte refeito — tronco em V por perfil de revolução, peitoral, deltoide, bíceps e tríceps, antebraço e perna afinando, panturrilha (`atletico` em `criarPessoa`, no lugar do `porte`) —, cabeça 18 % maior e uma foto no rosto. A foto é de uma pessoa de verdade e **não entra no git**: `scripts/rosto-companion.py` a recorta de `../Imagens para a maquete/` para `src/data/rosto.local.js` (ignorado); sem esse arquivo a cabeça sai lisa. O `artifact/maquete-planta.html` do repositório é gerado sem a foto; a versão com ela é `artifact/maquete-planta.local.html`, também ignorada. Olhado de frente e de lado, parado; não olhado andando. |
| 19/11/2026 | Preparação final para abrir o repositório (pedido do autor; equipe e professor avisados). No GitHub: alertas e correções do Dependabot, regra `proteger-main` (sem apagar nem forçar push), token das Actions só leitura, wiki e Projects desligados. Varredura dos 3 commits: sem nomes da lista local, e-mail, caminho, segredo ou foto (inclusive no `artifact/`). Mescladas as correções do Dependabot (vite 8.2.2 → 8.2.4, source-map-js 1.2.1 → 1.2.4; 7 alertas, só no servidor de desenvolvimento): hashes conferidas no registro, o HTML gerado sai byte a byte igual. Licença MIT. Maquete ao vivo pelo GitHub Pages (`.github/workflows/pages.yml`): gera o HTML num clone limpo, sem `*.local.js`, e só roda com o repositório público. Falta ao abrir: varredura de segredos com bloqueio no push, relato privado de falha, CodeQL e o limite de interação (só colaboradores), que não existem para privado no plano gratuito. |
| 19/11/2026 | **Repositório público** (o autor autorizou). Ligados em seguida: varredura de segredos com bloqueio no push, relato privado de falha, CodeQL (configuração padrão) e, na conta toda, limite de interação só para colaboradores (PR, issue e comentário), até 19/05/2027 — renovar. Pages no ar, com o link no "About" do repositório (fora do git: a URL leva o nome de usuário); conferido no navegador: carrega, sem erro no console e sem foto. |
| 19/11/2026 | README reescrito em inglês e enxuto (pedido do autor): saem "Fonte da verdade", "Estado e próximos passos", a lista de arquivos linha a linha e os recursos que já não existem (corte em seção, fichas); entram recursos e atalhos atuais (conferidos na tela de ajuda de `core/ui.js`). Sai o `SECURITY.md` (o autor: só chama atenção); o relato privado de falha continua ligado nas configurações. |
| 19/11/2026 | Repositório renomeado para `Three.js-Industrial-Plant` (pedido do autor; o GitHub não aceita espaço). O GitHub redireciona o endereço antigo do repositório e do git, mas **não o do Pages**: o site passou para o caminho `/Three.js-Industrial-Plant/` e o link antigo deixou de abrir. Atualizados o `origin` local, o "About", `LICENSE`, título do README e o `name` do `package.json`. A pasta local continua com o nome antigo (só muda o caminho na máquina). |
