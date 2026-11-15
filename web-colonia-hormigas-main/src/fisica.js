// =====================================================================
// Física química (port de avanzar_tick y difundir del motor del Sprint 3)
// Cada capa pierde 1 o 2 unidades por turno y la señal se propaga 2 pasos en cruz:
// cada celda toma el máximo entre su valor y el de un vecino menos la pérdida
// del kernel. Los muros no guardan ni dejan pasar química.
// =====================================================================
import {
  M, N, CELDAS, CAPAS, MURO, PASOS_DIFUSION, PERDIDAS_DIFUSION,
  TABLAS_EVAPORACION, TABLAS_EVAPORACION_ARENA,
} from './constantes.js';
import { capa } from './tensor.js';

const a = new Uint8Array(CELDAS);
const b = new Uint8Array(CELDAS);

// suelo: capa física de la matriz actual; siguiente: ya trae la emisión de este turno.
export function fisica(suelo, siguiente, terreno) {
  for (let c = 1; c < CAPAS; c++) {
    const destino = capa(siguiente, c);
    const perdida = PERDIDAS_DIFUSION[c - 1];
    const tabla = TABLAS_EVAPORACION[c - 1];
    const tablaArena = TABLAS_EVAPORACION_ARENA[c - 1];

    // Evaporación por tabla; corrección: la arena seca evapora más rápido.
    for (let i = 0; i < CELDAS; i++) {
      a[i] = suelo[i] === MURO ? 0 : (terreno[i] ? tablaArena : tabla)[destino[i]];
    }

    let origen = a, salida = b;
    for (let paso = 0; paso < PASOS_DIFUSION; paso++) {
      for (let y = 0; y < M; y++) {
        for (let x = 0; x < N; x++) {
          const i = y * N + x;
          if (suelo[i] === MURO) { salida[i] = 0; continue; }
          let v = origen[i];
          if (y > 0 && origen[i - N] - perdida > v) v = origen[i - N] - perdida;
          if (y < M - 1 && origen[i + N] - perdida > v) v = origen[i + N] - perdida;
          if (x > 0 && origen[i - 1] - perdida > v) v = origen[i - 1] - perdida;
          if (x < N - 1 && origen[i + 1] - perdida > v) v = origen[i + 1] - perdida;
          salida[i] = v;
        }
      }
      [origen, salida] = [salida, origen];
    }
    destino.set(origen);
  }
}
