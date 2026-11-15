// =====================================================================
// Tensor M×N×CAPAS en uint8 con arquitectura doble búfer (sección 7.1)
// =====================================================================
import { CELDAS, CAPAS } from './constantes.js';

// Las capas se guardan una detrás de otra (tensor[:, :, c] es un bloque
// contiguo de CELDAS bytes). Así cada capa se recorre de forma lineal.
function crearTensor() {
  return new Uint8Array(CELDAS * CAPAS);
}

export const motor = {
  lectura: crearTensor(),
  escritura: crearTensor(),
  // terreno_arena: dónde hay arena seca debajo, aunque una hormiga la pise.
  terreno: new Uint8Array(CELDAS),
  // Estado que viaja con cada hormiga, fuera de las seis capas.
  carga: new Uint8Array(CELDAS),        // carga_comida
  pasos: new Uint16Array(CELDAS),       // pasos_con_carga
  rumbo: new Int8Array(CELDAS).fill(-1), // direccion_anterior
  // Economía de cada colonia (por color, como en el motor).
  colonias: null,
};

export function nuevaColonia(reservaInicial) {
  return { reservas: reservaInicial, hambre: 0, entregas: 0, existia: false };
}

// _iniciar_estado_biologico
export function reiniciarEstado(reservaInicial) {
  motor.terreno.fill(0);
  motor.carga.fill(0);
  motor.pasos.fill(0);
  motor.rumbo.fill(-1);
  motor.colonias = { negra: nuevaColonia(reservaInicial), roja: nuevaColonia(reservaInicial) };
}

// Vista de una capa: equivale a tensor[:, :, c] en NumPy.
export function capa(tensor, c) {
  return tensor.subarray(c * CELDAS, (c + 1) * CELDAS);
}

// Fin del tick: la matriz de escritura pasa a ser la de lectura.
// Intercambiar referencias equivale a copyto(actual, siguiente)
// sin copiar 1,75 MB por turno; la escritura se rellena completa en el siguiente tick.
export function intercambiar() {
  const anterior = motor.lectura;
  motor.lectura = motor.escritura;
  motor.escritura = anterior;
}
