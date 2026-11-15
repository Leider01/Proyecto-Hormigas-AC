// =====================================================================
// Ciclo de vida del sandbox (sección 9) y conexión con el panel de control
// =====================================================================
import {
  M, N, ESTADOS, DELAY_INICIAL, MURO, COMIDA, VENENO, OBRERA_N, OBRERA_R, DEPREDADOR, VACIO,
  NIDO_N, NIDO_R, ARENA_SECA, CADAVER, BASURERO, SOLDADO_N, SOLDADO_R, P,
  CAPA_RASTRO_COMIDA, CAPA_ALARMA, CAPA_FEROMONA_REAL, CAPA_NECROFEROMONAS, CAPA_RECLUTAMIENTO,
} from './constantes.js';
import { motor, capa, intercambiar, reiniciarEstado } from './tensor.js';
import { generarMundo } from './mundo.js';
import { fisica } from './fisica.js';
import { biologia, censo, limpiarEstado, emisionInmutables } from './biologia.js';
import { prepararLienzo, dibujar, COLORES_CAPA } from './render.js';
import { pincel, GROSORES, PINTAR, BORRAR, COLONIA, QUIMICO, PUNTUAL, conectarLienzo, procesarCola } from './pinceles.js';

// Pincel -> [estado o capa, modo]
const PINCELES = {
  'colonia-n': [NIDO_N, COLONIA],
  'colonia-r': [NIDO_R, COLONIA],
  muro: [MURO, PINTAR],
  comida: [COMIDA, PINTAR],
  veneno: [VENENO, PINTAR],
  'hormiga-n': [OBRERA_N, PINTAR],
  'hormiga-r': [OBRERA_R, PINTAR],
  'soldado-n': [SOLDADO_N, PINTAR],
  'soldado-r': [SOLDADO_R, PINTAR],
  borrar: [VACIO, BORRAR],
  depredador: [DEPREDADOR, PUNTUAL],
  arena: [ARENA_SECA, PINTAR],
  cadaver: [CADAVER, PINTAR],
  basurero: [BASURERO, PINTAR],
  'f-rastro': [CAPA_RASTRO_COMIDA, QUIMICO],
  'f-alarma': [CAPA_ALARMA, QUIMICO],
  'f-real': [CAPA_FEROMONA_REAL, QUIMICO],
  'f-necro': [CAPA_NECROFEROMONAS, QUIMICO],
  'f-reclutamiento': [CAPA_RECLUTAMIENTO, QUIMICO],
};

const $ = (id) => document.getElementById(id);
const lienzo = $('lienzo');
const ui = {
  play: $('btn-play'),
  pausa: $('btn-pausa'),
  reset: $('btn-reset'),
  grosorMenos: $('grosor-menos'),
  grosorMas: $('grosor-mas'),
  grosorValor: $('grosor-valor'),
  visor: [...document.querySelectorAll('input[data-capa]')],
  delay: $('delay'),
  delayValor: $('delay-valor'),
  tick: $('stat-tick'),
  negras: $('stat-negras'),
  rojas: $('stat-rojas'),
  reservasNegras: $('stat-reservas-negras'),
  reservasRojas: $('stat-reservas-rojas'),
};

let DELAY = DELAY_INICIAL; // Variable global de tiempo que controla el deslizador
let corriendo = false;
let tick = 0;
let temporizador = null;

// La arena pintada queda como terreno; el perímetro siempre es muro.
function asentarTerreno() {
  const cf = capa(motor.lectura, 0);
  const terreno = motor.terreno;
  for (let i = 0; i < cf.length; i++) if (cf[i] === ARENA_SECA) terreno[i] = 1;
  for (let x = 0; x < N; x++) {
    terreno[x] = terreno[(M - 1) * N + x] = 0;
    cf[x] = cf[(M - 1) * N + x] = MURO;
  }
  for (let y = 0; y < M; y++) {
    terreno[y * N] = terreno[y * N + N - 1] = 0;
    cf[y * N] = cf[y * N + N - 1] = MURO;
  }
}

// Un turno completo: MotorNumPy.avanzar_tick() del Subgrupo 3.
function paso() {
  procesarCola(motor.lectura, motor.terreno, motor); // 1. Cola Modo Dios sobre la matriz actual
  asentarTerreno();
  const suelo = capa(motor.lectura, 0);
  limpiarEstado(suelo, motor);
  motor.escritura.set(motor.lectura);                // copyto(siguiente, actual)
  emisionInmutables(suelo, motor.escritura);         // Las fuentes emiten antes de propagar
  fisica(suelo, motor.escritura, motor.terreno);     // 2. Evaporación y propagación
  biologia(motor.escritura, motor.terreno, motor);   // 3. Reglas biológicas
  intercambiar();                                    // 4. Doble búfer
  tick++;
}

const reservas = (c) => (c.existia ? `${Math.round(c.reservas)} · ${c.entregas} entregas` : '—');

function capasVisibles() {
  return ui.visor.filter((c) => c.checked).map((c) => Number(c.dataset.capa));
}

function pintarPantalla() {
  dibujar(motor.lectura, capasVisibles()); // 5. Renderizado
  const { negras, rojas } = censo(motor.lectura);
  ui.tick.textContent = tick;
  ui.negras.textContent = negras;
  ui.rojas.textContent = rojas;
  ui.reservasNegras.textContent = reservas(motor.colonias.negra);
  ui.reservasRojas.textContent = reservas(motor.colonias.roja);
}

function ciclo() {
  if (!corriendo) return;
  paso();
  pintarPantalla();
  temporizador = setTimeout(ciclo, DELAY * 1000); // 6. Control de tiempo
}

function play() {
  if (corriendo) return;
  corriendo = true;
  actualizarBotones();
  ciclo();
}

function pausar() {
  corriendo = false;
  clearTimeout(temporizador);
  actualizarBotones();
}

function reiniciar() {
  pausar();
  tick = 0;
  generarMundo(motor.lectura);
  reiniciarEstado(P.RESERVA_INICIAL);
  pintarPantalla();
}

function actualizarBotones() {
  ui.play.classList.toggle('activo', corriendo);
  ui.pausa.classList.toggle('activo', !corriendo);
}

// --- Panel de control -----------------------------------------------------
ui.play.addEventListener('click', play);
ui.pausa.addEventListener('click', pausar);
ui.reset.addEventListener('click', reiniciar);

function elegirPincel(valor) {
  [pincel.estado, pincel.modo] = PINCELES[valor];
}
for (const radio of document.querySelectorAll('input[name="pincel"]')) {
  radio.addEventListener('change', () => elegirPincel(radio.value));
  const [estado, modo] = PINCELES[radio.value];
  const muestra = radio.parentElement.querySelector('.muestra');
  muestra.style.background = modo === QUIMICO ? COLORES_CAPA[estado] : ESTADOS[estado].color;
}
elegirPincel(document.querySelector('input[name="pincel"]:checked').value);

function cambiarGrosor(delta) {
  const k = GROSORES.indexOf(pincel.grosor) + delta;
  pincel.grosor = GROSORES[Math.max(0, Math.min(GROSORES.length - 1, k))];
  ui.grosorValor.textContent = `${pincel.grosor}×${pincel.grosor}`;
}
ui.grosorMenos.addEventListener('click', () => cambiarGrosor(-1));
ui.grosorMas.addEventListener('click', () => cambiarGrosor(1));

ui.delay.addEventListener('input', () => {
  DELAY = Number(ui.delay.value);
  ui.delayValor.textContent = `${DELAY.toFixed(2)} s`;
});

// Con la simulación en pausa, los cambios se ven al instante.
for (const casilla of ui.visor) {
  casilla.parentElement.querySelector('.muestra').style.background = COLORES_CAPA[casilla.dataset.capa];
  casilla.addEventListener('change', () => { if (!corriendo) pintarPantalla(); });
}

// --- Lienzo ----------------------------------------------------------------
prepararLienzo(lienzo);
conectarLienzo(lienzo, () => {
  if (corriendo) return; // En marcha, el paso 1 del ciclo drena la cola
  procesarCola(motor.lectura, motor.terreno, motor);
  pintarPantalla();
});

// --- Leyenda del alfabeto Σ -------------------------------------------------
$('leyenda').innerHTML = ESTADOS
  .map(({ id, nombre, color }) => `<li><span class="muestra" style="background:${color}"></span>${id} · ${nombre}</li>`)
  .join('');

reiniciar();
