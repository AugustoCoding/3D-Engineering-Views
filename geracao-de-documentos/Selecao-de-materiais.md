# Seleção de materiais de construção

Justificativa das especificações que aparecem nas folhas de especificação de
**R-01, V-01, V-02 e TK-01**. Documento de apoio: as folhas trazem só a decisão;
o porquê está aqui.

Critério aplicado a cada equipamento, nesta ordem:

1. **O meio ataca o material?** Fluido, temperatura, presença de oxidante,
   presença de halogeneto.
2. **O que acontece se falhar?** Vazamento de inflamável, contaminação do
   produto, parada de planta.
3. **Quanto custa a diferença?** Só depois de responder 1 e 2 — subir de liga
   sem necessidade é desperdício, e descer sem análise é risco.

Preços relativos de referência usados na comparação (chapa, base ago/2026):

| Material | R$/kg aprox. | Relativo |
|---|---|---|
| Aço carbono ASTM A516 Gr. 70 | 9 | 1,0 |
| AISI 304L | 30 | 3,3 |
| AISI 316L | 40 | 4,4 |
| Duplex UNS S32205 | 55 | 6,1 |
| Titânio Gr. 2 | 220 | 24 |

---

## R-01 — Reator de oxidação · **AISI 316L** (confirmado)

**Meio:** tolueno com até 20 % m/m de ácido benzóico, a **140 °C e 15 bar**, sob
borbulhamento de ar e com acetato de manganês como catalisador homogêneo.

É o ponto mais agressivo da planta: ácido carboxílico quente na presença de
oxigênio dissolvido e de um metal de transição.

**Por que não aço carbono.** Dois motivos independentes, e cada um bastaria.
Ácido benzóico a 140 °C ataca aço carbono a taxas incompatíveis com vida de
projeto. E, o que é pior, o ferro dissolvido é um metal de transição que
**participa do mesmo ciclo radicalar do manganês**: contaminar o meio com Fe
altera a cinética da oxidação de forma não controlada. O material do costado
aqui não é só uma questão de espessura — é uma variável de processo.

**Por que não 304L.** O 304L não tem molibdênio. Em ácidos carboxílicos acima
de 100 °C a diferença entre 304L e 316L deixa de ser marginal: o Mo é
justamente o que sustenta o filme passivo em meio orgânico ácido quente.

**Por que não titânio ou Hastelloy.** Esta é a decisão que mais economiza, e
depende de um detalhe do processo. Na oxidação industrial de alquilaromáticos,
titânio só se torna obrigatório quando o sistema catalítico usa **promotor de
bromo** — é o caso do processo Amoco para ácido tereftálico (Co/Mn/**Br**), em
que o brometo destrói a passivação do inox. O catalisador **deste** projeto é
acetato de manganês, **sem bromo**. Sem halogeneto, o 316L passiva normalmente
e o titânio custa 24 vezes mais para entregar uma vida que já se tem.

**Decisão:** costado, tampos e internos em **AISI 316L**. Confere com a
especificação do relatório (seção 5.3).

### Duas correções que a análise trouxe

**1. Isolamento — risco de corrosão sob tensão externa (ESCC).**
Aço inoxidável austenítico isolado, operando entre ~50 °C e ~150 °C, é o caso
clássico de **corrosão sob tensão por cloretos vinda de fora**: a água de chuva
lixivia cloreto do próprio isolante, ele concentra na parede quente e trinca o
costado — de fora para dentro, onde nenhuma inspeção interna encontra. O R-01
opera a 140 °C isolado: está exatamente na faixa.

A especificação passa de "lã de rocha 100 mm" para **lã de rocha com baixo teor
de cloreto certificada conforme ASTM C795, com barreira de vapor e pintura de
proteção do costado sob o isolamento**. O custo adicional é pequeno diante do
modo de falha que ele elimina.

**2. Eixo do agitador — em duplex, não em 316L.**
O eixo tem **8,7 m** e carrega três impelidores. O 316L tem limite de
escoamento baixo (~170 MPa) e resistência à fadiga modesta; num eixo esbelto e
longo, quem governa o dimensionamento é a rigidez e a fadiga, não a corrosão.

O **duplex UNS S32205** tem cerca do dobro do escoamento (~450 MPa) e melhor
comportamento em fadiga, permitindo eixo mais fino para a mesma deflexão — o
que reduz a carga no selo mecânico e no mancal. Custa 6,1 contra 4,4 do 316L,
mas incide sobre uma peça só, não sobre o casco.

Os **impelidores permanecem em 316L**: neles manda a corrosão, não a fadiga.

---

## V-01 — Separador gás-líquido · **AISI 304L** (confirmado)

**Meio:** tolueno e água condensados mais N₂ e O₂ residuais, a **50 °C e
14,9 bar**. Sem ácido benzóico — o AB fica na fase líquida do reator e não sobe
com os vapores.

**Por que não aço carbono.** A economia seria real (3,3 vezes), e a taxa de
corrosão de água aerada a 50 °C, isolada, seria tolerável com sobrespessura.
O que descarta é o destino da corrente: **o tolueno recuperado aqui volta ao
reator**. Óxido de ferro arrastado no reciclo entrega ao R-01 exatamente o
contaminante que a seção anterior explica que não pode entrar. A economia no
vaso reapareceria como perda de controle na reação.

**Por que não 316L.** O molibdênio do 316L compra resistência a **cloretos** e
a ácidos fortes. Não há fonte de cloreto neste circuito e não há ácido nesta
corrente. Pagar 4,4 em vez de 3,3 aqui é comprar uma propriedade que o serviço
não usa.

**Decisão:** **AISI 304L**, costado e tampos. Eliminador de névoa em malha de
arame AISI 304 — o mesmo critério, e é o material padrão do componente.

---

## V-02 — Separador líquido-líquido · **AISI 304L** (confirmado)

**Meio:** tolueno e água em separação de fases, a **50 °C e pressão
atmosférica**.

A diferença em relação ao V-01 está na **fase aquosa**: ela sai do sistema como
descarte e carrega ácido benzóico dissolvido (o AB tem solubilidade apreciável
em água quente). É uma água levemente ácida e aerada.

**Por que não aço carbono.** Aqui os dois argumentos se somam: a fase aquosa
ácida corrói mais rápido que a água neutra do V-01, e a fase orgânica separada
também retorna ao processo, com o mesmo problema de arraste de ferro.

**Por que não 316L.** Mesmo raciocínio do V-01 — ácido benzóico diluído a 50 °C
não exige molibdênio, e não há halogeneto.

**Decisão:** **AISI 304L**, costado e tampos.

---

## TK-01 — Tanque de tolueno · **muda para aço carbono A516 Gr. 70**

**Meio:** tolueno recuperado, **50 °C, atmosférico**, tanque-pulmão de
inventário com 15 min de residência.

Este é o único dos quatro em que a análise **muda** a especificação, e o
raciocínio é o inverso dos anteriores.

**Tolueno seco não corrói aço carbono.** A taxa fica abaixo de 0,025 mm/ano.
Tanques atmosféricos de solvente aromático em unidade petroquímica são aço
carbono por padrão, sob API 650 — não por economia mal feita, mas porque o
serviço não pede mais que isso.

**A única ameaça real é água livre no fundo.** O tolueno chega do decantador
V-02 saturado de água a 50 °C; ao resfriar, o excesso separa e decanta. É água,
não tolueno, que corrói — e ela fica num lugar conhecido.

**A resposta certa a um problema localizado não é trocar o vaso inteiro de
material.** É atacar o local: fundo com **revestimento epóxi-fenólico**, **bota
de decantação com dreno** para retirar a água separada na rotina de operação, e
**3 mm de sobrespessura de corrosão** no costado.

**O que isso economiza.** O casco tem cerca de 700 kg. A 9 R$/kg contra
30 R$/kg do 304L, a diferença é de aproximadamente **R$ 15 000** em material,
dos quais o revestimento do fundo consome cerca de R$ 2 000. Economia líquida
da ordem de **R$ 13 000** num equipamento cujo serviço é benigno.

**E a contaminação do produto?** O tolueno do TK-01 alimenta o dissolvedor
D-01 e a lavagem no F-02, ou seja, encosta no produto. Mas o ácido benzóico é
recuperado por **cristalização** a jusante, e a cristalização é justamente uma
etapa de purificação: traços de ferro dissolvido permanecem no licor-mãe e não
se incorporam ao cristal. O risco que existia no reciclo ao reator — onde o Fe
entra na cinética — não existe aqui.

**Decisão:** costado, teto e fundo em **aço carbono ASTM A516 Gr. 70**, fundo
revestido com epóxi-fenólico, bota de decantação com dreno, sobrespessura de
3,0 mm.

### Uma consequência a tratar no projeto de tubulação

O relatório (seção 6.1) especifica **AISI 304L para as linhas de processo** em
contato com tolueno. Com o tanque em aço carbono, cada conexão entre o costado
e uma linha de inox forma um **par galvânico**, e quem corrói é o aço carbono,
que é o anodo — de forma acelerada e localizada junto ao bocal.

A mitigação é conhecida e barata: **kit de isolamento galvânico nos flanges**
de ligação do TK-01 às linhas (luva e arruelas isolantes, junta não condutiva).
Fica registrado aqui porque é uma decisão que nasce da escolha de material do
tanque e precisa aparecer na especificação da tubulação, não na do vaso.

---

## Resumo

| Equipamento | Antes | Depois | Natureza |
|---|---|---|---|
| R-01 | AISI 316L | **AISI 316L** | confirmado; isolamento e eixo revistos |
| V-01 | AISI 304L | **AISI 304L** | confirmado com critério explícito |
| V-02 | AISI 304L | **AISI 304L** | confirmado com critério explícito |
| TK-01 | AISI 304L | **Aço carbono A516 Gr. 70** | alterado |

Três dos quatro permanecem. Isso é resultado da análise, não ausência dela: o
valor de uma seleção de materiais está tanto em confirmar o que já estava certo
— sabendo dizer por quê e o que se rejeitou — quanto em trocar o que estava
errado. As mudanças que a análise produziu foram o isolamento e o eixo do
agitador do R-01, e o material do TK-01.

---

## O que ainda não foi verificado

Honestidade sobre os limites deste documento:

- As **taxas de corrosão** citadas são de literatura geral, não de ensaio nem
  de tabela do fabricante para estas condições exatas.
- Os **preços** são ordens de grandeza para comparação relativa; uma decisão de
  compra pede cotação.
- A **espessura do costado do R-01** merece recálculo à parte: o cadastro traz
  28 mm, mas a memória de cálculo registrada (`t = 27,4 + 3`) fecha em 30,4 mm.
  A divergência é de espessura, não de material, e por isso não foi tratada
  aqui — mas precisa ser resolvida antes da entrega.
