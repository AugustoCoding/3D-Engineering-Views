/**
 * ===========================================================================
 *  PASSEIO AUTOMATICO DE CAMERA  (Fase 22, pedido do autor: "uma rota
 *  automatica ... movimentos suaves, curvos e lineares, numa ordem logica
 *  ... comecando da fachada. Priorizar pegar as animacoes enquanto elas
 *  ocorrem" — "nada de cortes para locais distantes, faca fluido" — "o
 *  usuario so apertar pra comecar e descansar vendo tudo se mexendo" — "a
 *  duracao do passeio pode ser longa, pois tem muita coisa pra mostrar")
 * ===========================================================================
 *  As paradas, na ordem de um visitante que chega e segue o produto: a
 *  portaria e os predios de apoio, o tolueno chegando de caminhao e indo
 *  para os tanques, o processo na ordem do fluxograma, o acido benzoico
 *  saindo pelo armazem, e as utilidades que mantem tudo de pe. Cada parada
 *  por regra — o bloco, o equipamento pela TAG, o objeto do entorno pelo
 *  nome, a cena de operacao pelo veiculo —, nunca coordenada:
 *  site/passeio.js tira dela o ponto que se olha e por onde a camera passa.
 *
 *  tipo      ceu | fachada | portaria | onibus | predio | equip | visor |
 *            objeto | descarga | armazem | rack
 *  tag       equipamento (ou lista: a camera enquadra o conjunto)
 *  nome      objeto do entorno (ou lista: com `mov: 'cadeia'` a camera passa
 *            ao lado de um por um, na ordem)
 *  mov       entra (pela porta, da a volta na sala e sai), cadeia
 *  perto     fracao do raio da orbita (o filtro de perto, para ver os visores)
 *  s         segundos na parada (o arco e percorrido devagar nesse tempo;
 *            mais, se o caminho for comprido para o teto `MOVIMENTO.lento`)
 *  evento    o que tem de estar acontecendo quando a camera chega: o
 *            passeio acerta o relogio do ator (site/passeio.js)
 *  [ADOTADO] tempos e ordem; os textos resumem o servico de cada peca
 *  (data/plant.js, plant-extra.js, entorno.js, agua.js).
 * ------------------------------------------------------------------------- */

export const CAPITULOS = ['Chegada', 'Portaria', 'Prédios de apoio', 'Matéria-prima', 'Processo', 'Produto', 'Utilidades', 'Vista geral'];

export const PARADAS = [
  // --- chegada
  { cap: 0, tipo: 'ceu', nome: 'Benzoic Industries', linha: 'Planta de ácido benzóico', s: 16 },
  { cap: 0, tipo: 'fachada', nome: 'Fachada', linha: 'A placa da empresa, a via pública e a portaria', s: 14 },
  // --- portaria
  { cap: 1, tipo: 'portaria', nome: 'Portaria', linha: 'Cancelas, guarita e catracas: o carro do funcionário entra', s: 10,
    evento: { ator: 'carro-funcionario', fase: 3, antes: 6 } },   // o carro fica ~6 s atras do onibus na via
  { cap: 1, tipo: 'onibus', nome: 'Ponto de ônibus', linha: 'O fretado abre as portas: quem chega desce para o vestiário', s: 14,
    evento: { ator: 'onibus', fase: 4, antes: -1 } },
  // --- predios de apoio, pela calcada, de leste a oeste
  { cap: 2, tipo: 'predio', bloco: 'REFEITORIO', mov: 'entra', nome: 'Refeitório e vestiário', linha: 'Quem está no intervalo come à mesa', s: 16 },
  { cap: 2, tipo: 'predio', bloco: 'ADM', mov: 'entra', nome: 'Administração', linha: 'Recepção, escritório e, no andar de cima, a reunião', s: 16 },
  { cap: 2, tipo: 'predio', bloco: 'BRIGADA', nome: 'Ambulatório e brigada', linha: 'Primeiros socorros e equipe de emergência', s: 8 },
  { cap: 2, tipo: 'predio', bloco: 'LAB', mov: 'entra', nome: 'Laboratório', linha: 'Controle de qualidade das amostras do processo', s: 14 },
  { cap: 2, tipo: 'predio', bloco: 'CONTROLE', mov: 'entra', nome: 'Sala de controle', linha: 'Os operadores acompanham a planta no console', s: 16,
    evento: { pessoa: 'CONTROLE', acao: 'digitar', antes: 2 } },
  { cap: 2, tipo: 'predio', bloco: 'OFICINA', mov: 'entra', nome: 'Oficina de manutenção', linha: 'O mecânico na bancada; daqui sai a inspeção das bombas', s: 14 },
  // --- materia-prima: o tolueno chega de caminhao e vai para os tanques
  { cap: 3, tipo: 'descarga', nome: 'Descarga de tolueno', linha: 'O caminhão entra de ré; o operador calça, aterra, conecta o mangote e abre a válvula', s: 50,
    evento: { ator: 'caminhao-tanque', fase: 4, antes: 2 } },
  { cap: 3, tipo: 'objeto', nome: ['TQ-01', 'TQ-02', 'TQ-03'], titulo: 'Parque de tanques', linha: 'TQ-01 e TQ-02: tolueno de reposição; TQ-03: purga — na bacia de contenção', s: 12 },
  { cap: 3, tipo: 'equip', tag: 'TK-01', nome: 'TK-01 — tolueno', linha: 'Tanque de tolueno da área: reciclo e reposição', s: 9 },
  { cap: 3, tipo: 'visor', tag: 'TK-01', nome: 'TK-01 — boca de visita', linha: 'Pelo visor de vidro, o tolueno lá dentro', s: 9 },
  // --- processo, na ordem do fluxograma
  { cap: 4, tipo: 'rack', nome: 'Corredor central', linha: 'A área de processo por dentro: sob o pipe rack, como num túnel, com os equipamentos dos dois lados', s: 26 },
  { cap: 4, tipo: 'equip', tag: 'CP-01', nome: 'CP-01 — compressor de ar', linha: 'Comprime o ar de processo até a pressão do reator', s: 8 },
  { cap: 4, tipo: 'equip', tag: 'E-02', nome: 'E-02 — pré-aquecedor', linha: 'Aquece o reciclo de tolueno até a temperatura do reator', s: 7 },
  { cap: 4, tipo: 'equip', tag: 'R-01', nome: 'R-01 — reator', linha: 'Oxidação do tolueno a ácido benzóico com ar', s: 14 },
  { cap: 4, tipo: 'visor', tag: 'R-01', nome: 'R-01 — boca de visita', linha: 'Da plataforma, pelo visor: o licor agitado lá dentro', s: 11 },
  { cap: 4, tipo: 'equip', tag: ['E-01', 'V-01', 'V-02'], nome: 'Condensação e separação', linha: 'E-01 condensa o topo do reator; V-01 separa o gás, V-02 a água do tolueno', s: 11 },
  { cap: 4, tipo: 'equip', tag: ['T-01', 'E-04'], nome: 'T-01 — vaso flash', linha: 'Vaporiza parte do tolueno do licor; o E-04 condensa o vapor', s: 10 },
  { cap: 4, tipo: 'equip', tag: 'E-03', nome: 'E-03 — trocador de integração', linha: 'O concentrado do flash aquece o reciclo', s: 7 },
  { cap: 4, tipo: 'equip', tag: 'CR-01', nome: 'CR-01 — cristalizador', linha: 'O ácido benzóico cristaliza no resfriamento', s: 10 },
  { cap: 4, tipo: 'equip', tag: 'F-01', perto: 0.6, nome: 'F-01 — filtro rotativo', linha: 'Fechado por capô (tolueno); o tambor gira atrás dos visores', s: 12 },
  { cap: 4, tipo: 'equip', tag: ['BD-01', 'D-01'], nome: 'D-01 — dissolvedor', linha: 'A BD-01 traz a torta do F-01 para redissolver', s: 9 },
  { cap: 4, tipo: 'equip', tag: 'CR-02', nome: 'CR-02 — recristalizador', linha: 'Segunda cristalização: pureza acima de 99 %', s: 9 },
  { cap: 4, tipo: 'equip', tag: ['F-02', 'BD-02'], nome: 'F-02 — filtro final', linha: 'Separa o produto; a BD-02 o leva para fora da área', s: 10 },
  // --- produto
  { cap: 5, tipo: 'armazem', nome: 'Armazém e expedição', linha: 'O baú vira no pátio e entra de ré; a empilhadeira carrega', s: 40,
    evento: { ator: 'caminhao-bau', fase: 4, antes: 2 } },
  // --- utilidades
  { cap: 6, tipo: 'objeto', nome: ['casa-subestacao', 'trafo-1', 'trafo-2'], titulo: 'Subestação', linha: 'Média tensão: os transformadores e a casa de painéis', s: 9 },
  { cap: 6, tipo: 'objeto', nome: ['caldeira', 'cobertura-caldeira', 'compressor-ar'], titulo: 'Caldeira e ar de instrumento', linha: 'Vapor para a planta; ao lado, o ar dos atuadores das válvulas', s: 10 },
  { cap: 6, tipo: 'objeto', nome: ['TQ-AI', 'predio-BOMBAS-INC'], titulo: 'Combate a incêndio', linha: 'Tanque de água de incêndio e a casa de bombas: elétrica, diesel e jockey', s: 10 },
  { cap: 6, tipo: 'objeto', mov: 'cadeia', titulo: 'ETA', linha: 'Do poço ao castelo: filtros, abrandadores e reservatório da água de reposição', s: 18,
    nome: ['eta-poco', 'eta-filtro-1', 'eta-filtro-2', 'eta-abrandador-1', 'eta-abrandador-2', 'eta-salmoura', 'eta-reservatorio', 'eta-castelo'] },
  { cap: 6, tipo: 'objeto', nome: 'torre', titulo: 'Torre de resfriamento', linha: 'Água de resfriamento dos trocadores e cristalizadores', s: 10 },
  { cap: 6, tipo: 'objeto', mov: 'cadeia', titulo: 'ETE', linha: 'Separador água-óleo (API 421), equalização, biológico, decantador e leitos de secagem', s: 18,
    nome: ['ete-separador', 'ete-equalizacao', 'ete-biologico', 'ete-decantador', 'ete-leito-2', 'ete-leito-1'] },
  // --- vista geral
  { cap: 7, tipo: 'ceu', nome: 'Benzoic Industries', linha: 'Fim do passeio — recomeça sozinho', s: 10 },
];

/* Movimento [ADOTADO]: cada parada e uma tomada lenta e a seguinte entra
 * com um corte (16/11/2026: demonstracao, nao trajeto continuo); aceleracao
 * e giro do olhar limitados para nao enjoar. */
export const MOVIMENTO = {
  // teto de velocidade dentro da tomada: [m/s ao nivel do chao, m/s a mais
  // por metro de altura da camera]; caminho comprido alonga a tomada
  lento: [1.6, 0.03],
  alongar: 1.6,             // a tomada estica ate isso vezes o `s` dela para caber no teto
  corte: 0.7,               // s para escurecer antes do corte, e para clarear depois
  aMax: 3.5,                // m/s² que a auditoria aceita
  giroMax: 50,              // graus/s do olhar que a auditoria aceita
  vMax: 18,                 // m/s
  // pular de parada (setas, LB/RB): a tela escurece e clareia nesse tempo
  // cada (s), e o acerto dos atores se faz no escuro; "anterior" passados
  // `voltarAte` s da chegada volta ao comeco da mesma parada (como num
  // tocador de musica)
  escurecer: 0.35, voltarAte: 3,
  // ator de evento e acertado para a volta seguinte so fora do quadro:
  // abaixo de `acertoPx` de altura aparente nao se ve o salto (1,5 px numa
  // tela de 1080), e so `acertoDepois` s depois de a camera sair da parada
  acertoPx: 1.5, acertoDepois: 5,
  // ALVO_ESCONDIDO: o que a parada mostra atras de outra coisa em mais
  // dessa fracao do tempo dela
  escondidoMax: 0.5,
};
