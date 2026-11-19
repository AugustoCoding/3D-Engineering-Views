# Maquete 3D — Planta de Ácido Benzóico

Visualização 3D navegável da planta, de um projeto de graduação em engenharia
química.

A maquete roda no navegador, num arquivo HTML único: quem recebe não instala nada.

**Vai mexer no projeto? Leia [`CLAUDE.md`](CLAUDE.md)** — método de trabalho,
arquitetura e armadilhas já pagas — e o [`ROTEIRO.md`](ROTEIRO.md).

---

## Fonte da verdade

Relatório, folhas de especificação, P&ID, fluxograma e croquis **finais** do
grupo. Esses documentos não estão neste repositório (trazem dados pessoais
da equipe); os números deles estão em `src/data/`, cada um com a procedência. A maquete reproduz o que está ali; o que ela acrescenta (entorno da
planta, geometria que os documentos não fixam) é marcado como estimado ou
adotado, com a justificativa.

## Estado e próximos passos

Ver [`ROTEIRO.md`](ROTEIRO.md): o que já existe, as divergências encontradas
entre os documentos e as fases de construção até a entrega.

---

## Como rodar

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:5180`.

Para gerar o entregável da maquete — um HTML autocontido, que abre por duplo
clique, sem servidor e sem internet:

```bash
npm run artifact
```

Os geradores de croqui e folha de especificação que produziram as primeiras
versões dos documentos estão em
[`geracao-de-documentos/`](geracao-de-documentos/README.md) — histórico: as
versões finais são as da pasta de especificações.

---

## A ideia central

O modelo **não é desenhado**. Ele é calculado a partir dos números do projeto.

Todos os dados estão em [`src/data/plant.js`](src/data/plant.js). Mudar o
diâmetro de um vaso ali faz o costado, os tampos, os bocais, os internos, a
suportação, o nível de líquido, as cotas do croqui, a escala escolhida e a folha
de especificação mudarem juntos — e continuarem coerentes entre si.

Procure por `[VERIFICAR]` nesse arquivo para achar todos os valores que ainda
são estimativa. No documento entregue, esses valores aparecem marcados
`(estimado)`, para o leitor não os confundir com dado de projeto.

---

## Estrutura

```
src/
  data/
    plant.js            Fonte única da verdade dos equipamentos com entregável:
                        dimensões, condições, bocais, correntes, materiais.
    plant-extra.js      Demais unidades — só para a maquete (ver CLAUDE.md).
    pid.js              Topologia do P&ID: linhas, bombas, válvulas, malhas.
    site.js             Implantação: lote, blocos, vias, vento, distâncias.
    arranjo.js          Posição de cada equipamento na laje, rack, contenção;
                        grupos, regras de acesso e custo do otimizador.
    arranjo-proposto.js Arranjo gerado pelo otimizador (Fase 11).
    rotas.js            Por onde passa cada linha; cabeçais, ramais, cores.
    instrumentos.js     Onde ficam válvulas de controle e instrumentos.
    agua.js             Balanço de água: torre, caldeira, ETA, ETE, chuva.
    entorno.js          Prédios, tanques e utilidades de cada bloco.
    pipeways.js         Corredores fora da laje e as linhas que seguem neles.
    seguranca.js        Zonas, regras de cobertura e rotas de fuga.
    ambiente.js         Árvores, postes, carros, pessoas e tráfego animado.
    interiores.js       Programa de cada prédio: salas, usos e folgas.
    vistas.js           Pontos de vista prontos (teclas 1 a 9).

  lib/                  Primitivas paramétricas reutilizáveis.
    profiles.js         Perfis de tampo (torisférico ASME F&D, elíptico 2:1,
                        hemisférico, plano, cônico) com a matemática correta.
    vessel.js           Costado como casca com espessura real; camisa; nível de
                        líquido por integração, vertical e horizontal.
    nozzle.js           Bocal = pescoço + flange + face + parafusos (ASME B16.5).
    pipe.js             Tubulação por vértices, com cotovelos de raio real.
    agitator.js         Turbina Rushton, pás inclinadas, acionamento.
    internals.js        Chicanas, serpentina, sparger, eliminador de névoa.
    supports.js         Saia, pernas com contraventamento, fundação,
                        plataforma, escada, berços de vaso horizontal.
    bomba.js            Bomba centrífuga, de cavidade progressiva (torta)
                        e de vácuo de anel líquido.
    valvula.js          Válvula globo com atuador e de três vias.
    instrumento.js      Transmissor, poço, radar, placa de orifício, densímetro.
    pontas.js           Chapéu, corta-chamas e filtro de admissão.
    predio.js           Prédio oco: fachada em canvas, janela de vidro, porta
                        que abre, piso, forro, escada; colisores da câmera.
    moveis.js           Móveis e equipamentos de interior (Fase 16).
    tanque.js           Tanque atmosférico de armazenagem (API 650).
    utilidades.js       Torre, caldeira, transformador, bacia, braço de carga.
    tratamento.js       ETA e ETE: poço, filtro, abrandador, castelo d'água,
                        caixa enterrada, separador água-óleo, decantador.
    portaria.js         Guarita de vidro, cobertura da praça, cancela,
                        catraca, abrigo de ônibus e pintura no chão.
    rota.js             Roteador: passos de isométrico → vértices; faixas e
                        pórticos do rack a partir das rotas.
    rack.js             Pipe rack: pórticos, vigas, longarinas, bandejas.
    apoios.js           Postes, guias de costado, estais, funil de dreno.
    plano.js            Contas no plano do chão (distâncias entre blocos).
    terreno.js          Placas, faixas, linhas e setas deitadas no terreno.
    dimensions.js       Linhas de cota com chamada tracejada e rótulo.
    human.js            Figura de 1,75 m para escala.
    pintura.js          TAG pintada no costado, em estêncil.

  equipment/            Composição — nenhuma geometria nova é escrita aqui.
    R-01.js, V-01.js, V-02.js, TK-01.js
    generico.js         Construtor paramétrico das demais famílias.
    tubulacao.js        Linhas do P&ID, rack, apoios e viabilidade.
    instrumentacao.js   Válvulas e instrumentos sobre as linhas e os vasos.
    alivio.js           Válvulas de segurança e a descarga delas.
    limiteBateria.js    Bloqueio, raquete e plataforma no limite de bateria.
    pinturas.js         Escolhe a face livre de cada vaso e pinta a TAG.

  site/
    implantacao.js      Terreno em blocos e cotas de distância.
    chao.js             Gramado, brita, vias, calçadas, travessias e meio-fio.
    processo.js         Mureta, caixa coletora, guindaste e faixas de saque.
    entorno.js          Prédios, tanques, utilidades, vagas e cerca.
    interiores.js       Salas e móveis de cada prédio, por regra; portas e
                        nível de detalhe.
    pipeways.js         Postes, pontes, linhas e bombas fora dos limites.
    seguranca.js        Combate e emergência pela cobertura; camada de projeto.
    ambiente.js         Ambientação instanciada e o tráfego que anda nas vias.

  core/                 Cena, câmera, materiais, seleção, interface.
    scene.js            Céu, terreno, laje, iluminação e loop.
    controls.js         Câmera em primeira pessoa, convenção de jogo, controle
                        de Xbox e voo até os pontos de vista.
    rotulos.js          Escala, alcance, desempilhamento e oclusão das etiquetas.
    planta.js           Vista de planta do terreno (tecla P).
    realismo.js         Oclusão de ambiente, que desliga se o quadro pesar.
    fundir.js           Funde o detalhe estático por material (desempenho).

  dev/
    auditoria.js        Mede coerência física da cena e a viabilidade da
                        tubulação (ver CLAUDE.md).
    implantacao.js      Mede a implantação contra as distâncias e o vento.
    chao.js             Mede z-fighting no chão e na laje (__auditarChao).
    interiores.js       Mede móveis e o acesso às salas (__auditarInteriores).
    inspecao.js         Ronda de inspeção visual: 40 postos (__inspecao).
    arranjo.js          Mede o arranjo da laje: folgas, saques, gravidade.
    otimizador.js       Busca o arranjo de menor custo (tubo, laje e rack)
                        dentro das regras de acesso; desenha a planta.
    entorno.js          Mede o entorno: nada flutua, afunda ou sai do bloco;
                        soma os achados dos pipeways.

scripts/                Empacotamento do HTML autocontido.
artifact/               O HTML autocontido gerado — o arquivo que vai para o professor.

geracao-de-documentos/  Geradores de croqui e folha (histórico, desatualizado).
ROTEIRO.md              Fases de construção da maquete e decisões tomadas.
CLAUDE.md               Método, arquitetura e armadilhas — lido pelas sessões do Claude Code.
```

Regra que mantém isso administrável conforme a planta cresce:
**geometria nova vira primitiva em `lib/`; equipamento novo só combina primitivas.**

---

## Recursos da maquete

- **Câmera em primeira pessoa**, na convenção de jogo: arrastar olha em volta,
  WASD anda, Shift corre, Espaço/Ctrl sobe e desce, scroll avança, botão direito
  desloca.
- **Clique em qualquer componente ou linha** → ficha com as especificações reais.
- **Corte em seção** com plano deslizante — revela internos, níveis e, no V-02,
  a interface água/orgânico.
- **Ir para**: a câmera voa até qualquer equipamento.
- **Vista de planta** (tecla P): o terreno de cima, norte para cima, com os
  blocos da implantação, as vias e as distâncias de segurança cotadas.
- **HUD ocultável por peça**, com atalhos de teclado (H esconde tudo).
- Etiquetas de bocal e figura humana de escala, desligáveis.
- Agitação e tambores dos filtros animados nas rotações reais de projeto.
- **Etiquetas com nível de detalhe**: identificação de bocal só de perto, número
  de linha a média distância, TAG sempre — encolhendo com a distância, sem se
  sobrepor, e esmaecidas quando o equipamento está atrás de outro.

---

## Licença

[MIT](LICENSE). A planta é fictícia, de um projeto acadêmico: os números de
processo servem para a maquete e não substituem projeto de engenharia.
