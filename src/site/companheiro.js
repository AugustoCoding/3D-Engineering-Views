import * as THREE from 'three';
import { criarPessoa, PASSADA } from '../lib/human.js';
import { COMPANION } from '../data/ambiente.js';

/**
 * ===========================================================================
 *  COMPANION  (pedido do autor, 16/11/2026: "um npc atras de voce que
 *  ficara te seguindo, mas ele vai manter uma distancia de 2 a 3 metros")
 * ===========================================================================
 *  Chamado pelo botao da barra (tecla M, X no controle), aparece atras da
 *  camera quando ela esta no modo andar (core/controls.js) e a segue: alem
 *  de `longe` m ele vem, a menos de `perto` m ele recua, entre os dois fica
 *  parado olhando para voce. Anda no piso que a camera anda (y = 0 ou o topo
 *  da caixa de colisao sob os pes) e nao atravessa parede: eixo que bateria
 *  para, o outro segue. Se voce some (voou para longe, ou ele ficou preso
 *  atras de uma parede), reaparece atras de voce. Com a camera voando ele
 *  espera no chao. Os numeros estao em COMPANION (data/ambiente.js).
 */
export function criarCompanheiro({ cena, avisar }) {
  const controles = cena.controls, camera = cena.camera;
  const pessoa = criarPessoa(COMPANION.figura);
  const g = pessoa.grupo;
  g.name = 'pessoa-companion';
  g.userData.animar = true;                       // fora da fusao: ele se mexe
  g.visible = false;
  let chamado = false, passo = 0, ritmo = 0, relogio = 0;

  const ALTURA_OLHOS = 1.7, PEITO = 1.0;
  const pe = new THREE.Vector3(), teste = new THREE.Vector3();
  /** Onde a camera pisa. */
  const jogador = () => pe.set(camera.position.x, camera.position.y - ALTURA_OLHOS, camera.position.z);
  const livre = (x, y, z) => !controles.bate(teste.set(x, y + PEITO, z));

  /** Poe o companion a 2,5 m atras da camera; nao cabendo, de um lado ou
   *  do outro, ou mais perto. */
  function surgir() {
    const j = jogador(), yaw = controles.estado.yaw, d = (COMPANION.perto + COMPANION.longe) / 2;
    for (const [a, r] of [[0, d], [0.7, d], [-0.7, d], [1.4, d], [-1.4, d], [0, 1.2], [Math.PI, d]]) {
      const x = j.x + Math.sin(yaw + a) * r, z = j.z + Math.cos(yaw + a) * r;
      if (!livre(x, j.y, z)) continue;
      g.position.set(x, controles.piso(x, z, j.y), z);
      g.rotation.y = Math.atan2(j.x - x, j.z - z);
      g.visible = true;
      return;
    }
    g.visible = false;                             // sem lugar agora: tenta no quadro seguinte
  }

  function chamar(v = !chamado) {
    chamado = v;
    if (!chamado) { g.visible = false; avisar?.('Companion dispensado'); return; }
    if (controles.andando) { surgir(); avisar?.('Companion a caminho'); }
    else avisar?.('Companion: aparece no modo andar (A ou Espaço duas vezes)');
  }

  function atualizar(dt) {
    if (!chamado) return;
    if (!controles.andando || !controles.ativo) {
      // camera voando (ou vista de planta, passeio): espera onde esta
      if (g.visible) { ritmo += (0 - ritmo) * Math.min(1, dt / 0.25); pessoa.animar(passo, ritmo); pessoa.aguardar(relogio += dt); }
      return;
    }
    const j = jogador();
    let dx = j.x - g.position.x, dz = j.z - g.position.z, dist = Math.hypot(dx, dz);
    if (!g.visible || dist > COMPANION.sumiu || Math.abs(j.y - g.position.y) > 2.5) { surgir(); return; }
    // dentro da faixa fica parado; fora dela anda so o que falta para voltar
    // a borda dela (ate a velocidade de corrida): preso a voce como por uma
    // corda de 3 m e uma vara de 2 m, a distancia nao sai da faixa
    let v = 0;
    if (dist > COMPANION.longe) v = Math.min(COMPANION.correr * dt, dist - COMPANION.longe);
    else if (dist < COMPANION.perto) v = -Math.min(COMPANION.correr * dt, COMPANION.perto - dist);
    let andou = 0;
    if (v && dist > 1e-3) {
      const sx = (dx / dist) * v, sz = (dz / dist) * v;
      const p = g.position, x0 = p.x, z0 = p.z;
      if (livre(p.x + sx, p.y, p.z)) p.x += sx;
      if (livre(p.x, p.y, p.z + sz)) p.z += sz;
      andou = Math.hypot(p.x - x0, p.z - z0);
    }
    // o piso sob ele (degrau sobe aos poucos, como a camera)
    const y = controles.piso(g.position.x, g.position.z, g.position.y);
    g.position.y += THREE.MathUtils.clamp(y - g.position.y, -8 * dt, 8 * dt);
    // de frente para voce (recuando, anda de costas)
    const rumo = Math.atan2(dx, dz);
    const dr = ((rumo - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += THREE.MathUtils.clamp(dr, -6 * dt, 6 * dt);
    passo += ((v < 0 ? -1 : 1) * Math.PI * andou) / PASSADA;
    ritmo += (Math.min(1, dt > 0 ? andou / dt / COMPANION.andar : 0) - ritmo) * Math.min(1, dt / 0.2);
    pessoa.animar(passo, ritmo);
    if (ritmo < 0.05) pessoa.aguardar(relogio += dt);
  }

  return { grupo: g, chamar, atualizar, get chamado() { return chamado; } };
}
