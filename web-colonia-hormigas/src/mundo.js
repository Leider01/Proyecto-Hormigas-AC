// =====================================================================
// Mundo inicial (estado que restaura el botón Reset)
// Lienzo vacío: el usuario pone las colonias y el entorno con los pinceles.
// Solo queda el muro perimetral (crear_tensor con marco).
// =====================================================================
import { M, N, MURO } from './constantes.js';
import { capa } from './tensor.js';

export function generarMundo(tensor) {
  tensor.fill(0);
  const fisica = capa(tensor, 0);

  for (let x = 0; x < N; x++) {
    fisica[x] = MURO;
    fisica[(M - 1) * N + x] = MURO;
  }
  for (let y = 0; y < M; y++) {
    fisica[y * N] = MURO;
    fisica[y * N + N - 1] = MURO;
  }
}
