/**
 * ===========================================================================
 *  REDE DE PEDESTRES — regras  (Fase 28)
 * ===========================================================================
 *  O mapa e a auditoria sao de site/pedestres.js; aqui, so as regras.
 *  [ADOTADO]
 *   origens            de onde se mede o caminho (tipos de destino): as
 *                      catracas, o abrigo do onibus e o estacionamento —
 *                      quem chega, chega por eles
 *   livres             blocos onde se anda livre (estacionamento, pontos de
 *                      encontro): o destino e o meio deles
 *   categoriasDeBloco  blocos sem predio que sao destino: o meio do lado
 *                      voltado para a rede (a regra da porta, entorno.js)
 *   blocosDePassagem   categorias de bloco que o acesso a pe pode cruzar
 *   acessoMax          o maior trecho a pe fora da calcada, do destino a
 *                      ela — o mesmo ACESSO_MAX da porta (entorno.js)
 *   fator, sobra       DESVIO: caminho maior que `fator` vezes a reta e
 *                      mais de `sobra` m acima dela (pedido da sessao local:
 *                      2×; a sobra tira o par perto, em que dar a volta na
 *                      quadra ja dobra a reta)
 * ===========================================================================
 */
export const PEDESTRES = {
  origens: ['catraca', 'onibus', 'estacionamento'],
  livres: ['ESTAC', 'ENCONTRO-1', 'ENCONTRO-2'],
  categoriasDeBloco: ['utilidade', 'torre', 'incendio', 'agua', 'efluentes', 'carga'],
  blocosDePassagem: ['verde', 'estacionamento', 'encontro'],
  acessoMax: 30,
  fator: 2, sobra: 20,
};
