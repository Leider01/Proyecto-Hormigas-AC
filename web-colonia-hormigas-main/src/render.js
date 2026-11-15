// =====================================================================
// Renderizado visual del tensor (sección 6.1)
// Convierte la Capa 0 en colores y superpone las capas químicas elegidas.
// =====================================================================
import {
  M, N, CELDAS, MASCARA_ESTADO, ARENA_SECA, DEPREDADOR, ESTADOS,
  COLOR_RASTRO_COMIDA, COLOR_ALARMA, COLOR_FEROMONA_REAL, COLOR_NECROFEROMONAS, COLOR_RECLUTAMIENTO,
} from './constantes.js';
import { capa } from './tensor.js';

const aRGB = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));

// Colormap por estado, separado en canales para mezclar rápido.
const ROJO = new Uint8Array(16);
const VERDE = new Uint8Array(16);
const AZUL = new Uint8Array(16);
for (const { id, color } of ESTADOS) [ROJO[id], VERDE[id], AZUL[id]] = aRGB(color);

// Color de cada capa química, de la 1 a la 5.
export const COLORES_CAPA = [null, COLOR_RASTRO_COMIDA, COLOR_ALARMA, COLOR_FEROMONA_REAL,
  COLOR_NECROFEROMONAS, COLOR_RECLUTAMIENTO];
const RGB_CAPA = COLORES_CAPA.map((c) => c && aRGB(c));

let contexto, imagen, pixeles;

export function prepararLienzo(canvas) {
  canvas.width = N;
  canvas.height = M;
  contexto = canvas.getContext('2d');
  imagen = contexto.createImageData(N, M);
  pixeles = new Uint32Array(imagen.data.buffer); // ABGR en little-endian
}

// visibles: índices de las capas químicas que se superponen.
export function dibujar(tensor, visibles) {
  const fisica = capa(tensor, 0);
  const capas = visibles.map((c) => [capa(tensor, c), RGB_CAPA[c]]);

  for (let i = 0; i < CELDAS; i++) {
    const e = fisica[i] & MASCARA_ESTADO;
    let r = ROJO[e], g = VERDE[e], b = AZUL[e];

    // Las feromonas se pintan solo sobre el suelo para no tapar a las hormigas.
    if (e <= ARENA_SECA) {
      for (let k = 0; k < capas.length; k++) {
        const v = capas[k][0][i];
        if (!v) continue;
        const color = capas[k][1];
        const a = Math.min(1, v / 160) * 0.9;
        r += (color[0] - r) * a; g += (color[1] - g) * a; b += (color[2] - b) * a;
      }
    }
    pixeles[i] = 0xff000000 | (b << 16) | (g << 8) | r;
  }

  // La araña ocupa una celda, pero se dibuja como un sprite de 3×3 centrado.
  const arana = 0xff000000 | (AZUL[DEPREDADOR] << 16) | (VERDE[DEPREDADOR] << 8) | ROJO[DEPREDADOR];
  for (let i = 0; i < CELDAS; i++) {
    if ((fisica[i] & MASCARA_ESTADO) !== DEPREDADOR) continue;
    const y = (i / N) | 0, x = i - y * N;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < M && xx >= 0 && xx < N) pixeles[yy * N + xx] = arana;
      }
    }
  }
  contexto.putImageData(imagen, 0, 0);
}
