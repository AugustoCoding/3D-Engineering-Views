/**
 * ===========================================================================
 *  SETAS DO P&ID CORRENDO NOS TUBOS  (Fase 27, item 6) — parametros
 * ===========================================================================
 *  site/setasTubos.js desenha; aqui so os numeros [ADOTADO, parametros de
 *  desenho]. A seta corre no sentido do escoamento, na velocidade de
 *  lib/hidraulica.js (Fase 23) levada a escala logaritmica — a de 0,3 m/s e
 *  a de 20 m/s (vapor) cabem na mesma tela:
 *      v_tela = base · (1 + log10(max(v, vMin) / vRef))
 *  0,1 m/s -> base; 1 m/s -> 2·base; 10 m/s -> 3·base.
 *   passo     distancia entre setas ao longo do tubo, m
 *   folga     a luva das setas fica tanto acima da parede do tubo, m
 *   voltas    setas em volta do tubo (de qualquer lado se ve uma)
 *   sentido   o dos cabecais: alimentacao entra pelo limite leste (x1) e
 *             corre para oeste; retorno, ao contrario. O dos ramais sai
 *             disso: alimentacao do cabecal ao bocal, retorno ao contrario.
 * ===========================================================================
 */
export const SETAS = {
  passo: 0.5, folga: 0.008, voltas: 3,
  base: 0.22, vRef: 0.1, vMin: 0.05,
  cor: 0xffffff, opacidade: 0.9,
  alimentacao: ['CWS', 'STM'],
};
