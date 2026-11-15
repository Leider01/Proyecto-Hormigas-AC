// =====================================================================
// Diccionario de constantes (sección 8.2 del documento de arquitectura)
// Valores tomados del motor NumPy del Subgrupo 3 (Sprint 3).
// =====================================================================

// --- Dimensiones del mundo: ALTO filas × ANCHO columnas ---------------
export const M = 500;
export const N = 500;
export const CELDAS = M * N;

// --- Capas del tensor M×N×6 -------------------------------------------
export const CAPAS = 6;
export const CAPA_FISICA = 0;
export const CAPA_RASTRO_COMIDA = 1;
export const CAPA_ALARMA = 2;
export const CAPA_FEROMONA_REAL = 3;
export const CAPA_NECROFEROMONAS = 4;
export const CAPA_RECLUTAMIENTO = 5;

// --- Σ: alfabeto de 16 estados de la Capa 0 (Cuadro 1) -----------------
export const VACIO = 0;
export const ARENA_SECA = 1;
export const MURO = 2;
export const COMIDA = 3;
export const VENENO = 4;
export const CADAVER = 5;
export const NIDO_N = 6;
export const REINA_N = 7;
export const OBRERA_N = 8;
export const SOLDADO_N = 9;
export const NIDO_R = 10;
export const REINA_R = 11;
export const OBRERA_R = 12;
export const SOLDADO_R = 13;
export const BASURERO = 14;
export const DEPREDADOR = 15;

export const MASCARA_ESTADO = 0x0f;

// --- Física química (motor del Sprint 3 con recolección) ----------------
// Cada turno la señal pierde 2 unidades y se propaga 2 pasos en cruz:
// la celda toma el máximo entre su valor y el del vecino menos una pérdida.
export const PASOS_DIFUSION = 2;
// Pérdida por turno de cada capa química, de la 1 a la 5. El cuaderno usa 2 en todas.
// Corrección: el rastro de comida pierde 1, para que un camino largo no se borre
// antes de que la obrera llegue al nido.
export const PERDIDAS_EVAPORACION = [1, 2, 2, 2, 2];
// Corrección: la arena seca acelera la evaporación (4 unidades más por turno).
export const PERDIDA_EXTRA_ARENA = 4;
const tablaPerdida = (p) => Uint8Array.from({ length: 256 }, (_, v) => Math.max(0, v - p));
export const TABLAS_EVAPORACION = PERDIDAS_EVAPORACION.map(tablaPerdida);
export const TABLAS_EVAPORACION_ARENA = PERDIDAS_EVAPORACION.map((p) => tablaPerdida(p + PERDIDA_EXTRA_ARENA));

// Kernels en cruz [0 l 0; l c l; 0 l 0]. La pérdida por paso es max(4, 12 - l // 2).
const perdida = (lado) => Math.max(4, 12 - (lado >> 1));
const KERNEL_LENTO = perdida(5);    // 10: feromona real
const KERNEL_MEDIO = perdida(10);   // 7
const KERNEL_RAPIDO = perdida(20);  // 4: alarma
// Pérdida por paso de cada capa química, de la 1 a la 5.
export const PERDIDAS_DIFUSION = [KERNEL_MEDIO, KERNEL_RAPIDO, KERNEL_LENTO, KERNEL_MEDIO, KERNEL_MEDIO];

// --- Biología ------------------------------------------------------------
// Objeto mutable para poder comparar el port contra los valores del cuaderno.
// Los marcados como "Corrección" difieren del cuaderno a propósito.
export const P = {
  PROB_EXPANSION_VENENO: 0.01,
  FRACCION_MAXIMA_VENENO: 0.08,
  PROB_MUERTE_VENENO: 0.125,
  PROB_MOVIMIENTO_DEPREDADOR: 0.35,
  PROB_ATAQUE_DEPREDADOR: 0.35,
  MIN_SOLDADOS_CONTRA_ARANA: 3,     // Corrección: el cuaderno pide 4
  PROB_NACIMIENTO: 0.05,
  PROB_NACIMIENTO_MAXIMA: 0.25,     // Corrección: con reservas altas nacen más
  FRACCION_SOLDADOS: 0.2,
  RADIO_RADAR_DEPREDADOR: 8,
  PROB_MOVIMIENTO_ARENA: 0.5,
  PROB_RETORNO_REAL: 0.03,          // Corrección: el cuaderno usa 0.2
  RADIO_BUSQUEDA_COMIDA: 60,        // Corrección: el cuaderno usa 16
  RESERVA_INICIAL: 150,             // Corrección: el cuaderno usa 100
  DESCENSO_RASTRO: 2,               // Corrección: el cuaderno usa 3 por paso
  RESERVA_MINIMA: 40,               // Corrección: no gastar en nacimientos lo que sostiene al nido
  CONSUMO_NIDO: 0.2,
  VALOR_COMIDA: 20,
  COSTO_NACIMIENTO: 5,
  LIMITE_HAMBRE: 300,
  PROB_MUERTE_HUERFANA: 0.01,       // Corrección: sin nido ni reina, las hormigas se extinguen
  ARANA_ATACA_REINAS: true,         // Corrección: el veneno ya las mataba
};
export const INTENSIDAD_FEROMONA_PINCEL = 220;

// Vecindad de Moore en el orden del motor: arriba, abajo, izq, der y diagonales.
export const DESPLAZAMIENTOS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// --- Tiempo (sección 7.3) ---------------------------------------------
export const DELAY_INICIAL = 0.05; // segundos

// --- Colormap (sección 6.1) -------------------------------------------
export const ESTADOS = [
  { id: VACIO, nombre: 'Tierra húmeda', color: '#5a3e26' },
  { id: ARENA_SECA, nombre: 'Arena seca', color: '#b89b62' },
  { id: MURO, nombre: 'Muro / roca', color: '#2f2f35' },
  { id: COMIDA, nombre: 'Comida', color: '#7cc142' },
  { id: VENENO, nombre: 'Veneno / ácido', color: '#c026ff' },
  { id: CADAVER, nombre: 'Cadáver', color: '#a8a29e' },
  { id: NIDO_N, nombre: 'Nido negro', color: '#15151b' },
  { id: REINA_N, nombre: 'Reina negra', color: '#ffd23f' },
  { id: OBRERA_N, nombre: 'Obrera negra', color: '#000000' },
  { id: SOLDADO_N, nombre: 'Soldado negro', color: '#3d3d6b' },
  { id: NIDO_R, nombre: 'Nido rojo', color: '#6e1010' },
  { id: REINA_R, nombre: 'Reina roja', color: '#ff5fa2' },
  { id: OBRERA_R, nombre: 'Obrera roja', color: '#ff2d2d' },
  { id: SOLDADO_R, nombre: 'Soldado rojo', color: '#ffa07a' },
  { id: BASURERO, nombre: 'Basurero', color: '#4e342e' },
  { id: DEPREDADOR, nombre: 'Depredador (araña)', color: '#22d3ee' },
];
export const COLOR_RASTRO_COMIDA = '#38bdf8';
export const COLOR_ALARMA = '#ffe14d';
export const COLOR_FEROMONA_REAL = '#f472b6';
export const COLOR_NECROFEROMONAS = '#a3e635';
export const COLOR_RECLUTAMIENTO = '#fb923c';
