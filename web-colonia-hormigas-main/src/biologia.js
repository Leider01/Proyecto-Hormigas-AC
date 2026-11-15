// =====================================================================
// Reglas biológicas: port de MotorNumPy.aplicar_reglas_biologicas
// (motor del Subgrupo 3, Sprint 3, con recolección, reservas y arañas),
// más las correcciones de la web, marcadas con "Corrección".
//
// Las reglas se aplican en el orden del motor sobre la matriz de escritura.
// Cuando el motor calcula una máscara antes de escribir, aquí se toma una foto
// de la capa física. Las vecindades no dan la vuelta en los bordes.
// =====================================================================
import {
  M, N, CELDAS, CAPAS, VACIO, ARENA_SECA, MURO, COMIDA, VENENO, CADAVER,
  NIDO_N, REINA_N, OBRERA_N, SOLDADO_N, NIDO_R, REINA_R, OBRERA_R, SOLDADO_R,
  BASURERO, DEPREDADOR,
  CAPA_RASTRO_COMIDA, CAPA_ALARMA, CAPA_FEROMONA_REAL, CAPA_NECROFEROMONAS, CAPA_RECLUTAMIENTO,
  P, DESPLAZAMIENTOS,
} from './constantes.js';
import { capa } from './tensor.js';

// Tablas de pertenencia: conjunto[estado] === 1 si el estado está en el conjunto.
const conjunto = (...estados) => {
  const t = new Uint8Array(256);
  for (const e of estados) t[e] = 1;
  return t;
};
const HORMIGAS = conjunto(OBRERA_N, SOLDADO_N, OBRERA_R, SOLDADO_R);
const HORMIGAS_Y_REINAS = conjunto(OBRERA_N, SOLDADO_N, REINA_N, OBRERA_R, SOLDADO_R, REINA_R);
const VICTIMAS_VENENO = conjunto(OBRERA_N, SOLDADO_N, REINA_N, OBRERA_R, SOLDADO_R, REINA_R, DEPREDADOR);
const OBRERAS = conjunto(OBRERA_N, OBRERA_R);
const SOLDADOS = conjunto(SOLDADO_N, SOLDADO_R);
const COLONIA_N = conjunto(OBRERA_N, SOLDADO_N);
const COLONIA_R = conjunto(OBRERA_R, SOLDADO_R);
const MOVILES = conjunto(OBRERA_N, SOLDADO_N, OBRERA_R, SOLDADO_R, DEPREDADOR);
const LIBRE = conjunto(VACIO, ARENA_SECA);
const TRANSITABLE = conjunto(VACIO, ARENA_SECA, OBRERA_N, SOLDADO_N, OBRERA_R, SOLDADO_R, DEPREDADOR);
const ES_SOLDADO_N = conjunto(SOLDADO_N);
const ES_SOLDADO_R = conjunto(SOLDADO_R);
const ES_VENENO = conjunto(VENENO);

const COLORES = [
  { nombre: 'negra', nido: NIDO_N, reina: REINA_N, obrera: OBRERA_N, soldado: SOLDADO_N },
  { nombre: 'roja', nido: NIDO_R, reina: REINA_R, obrera: OBRERA_R, soldado: SOLDADO_R },
];
const COLOR_DE = new Int8Array(256).fill(-1);
COLOR_DE[OBRERA_N] = COLOR_DE[SOLDADO_N] = COLOR_DE[NIDO_N] = COLOR_DE[REINA_N] = 0;
COLOR_DE[OBRERA_R] = COLOR_DE[SOLDADO_R] = COLOR_DE[NIDO_R] = COLOR_DE[REINA_R] = 1;

const DY = Int32Array.from(DESPLAZAMIENTOS, ([dy]) => dy);
const DX = Int32Array.from(DESPLAZAMIENTOS, ([, dx]) => dx);
const INVERSA = [1, 0, 3, 2, 7, 6, 5, 4];
const INFINITO = CELDAS + 1;

// Índice del vecino en la dirección d, o -1 si cae fuera del mapa.
function vecino(i, d) {
  const y = (i / N) | 0;
  const yy = y + DY[d], xx = i - y * N + DX[d];
  return yy < 0 || yy >= M || xx < 0 || xx >= N ? -1 : yy * N + xx;
}

// escanear_presencia_3x3 en una celda.
function toca(fuente, i, tabla) {
  for (let d = 0; d < 8; d++) {
    const j = vecino(i, d);
    if (j >= 0 && tabla[fuente[j]]) return true;
  }
  return false;
}

function barajar8() {
  const orden = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let k = 7; k > 0; k--) {
    const j = (Math.random() * (k + 1)) | 0;
    [orden[k], orden[j]] = [orden[j], orden[k]];
  }
  return orden;
}

// escanear_gradiente_quimico: dirección del vecino más alto (empates al azar).
// `mejora` vale ese máximo solo si supera a la celda propia: una meseta no atrae.
let mejora = 0;
function gradiente(capaQ, i) {
  let mejor = 0, maximo = -1, empates = 0;
  for (let d = 0; d < 8; d++) {
    const j = vecino(i, d);
    const v = j < 0 ? 0 : capaQ[j];
    if (v > maximo) { maximo = v; mejor = d; empates = 1; }
    else if (v === maximo && Math.random() * ++empates < 1) mejor = d;
  }
  mejora = maximo > capaQ[i] ? maximo : 0;
  return mejor;
}

// _elegir_exploracion: inercia (75 %) y evita deshacer el último paso.
function exploracion(cf, rumbo, i) {
  const anterior = rumbo[i];
  const regreso = anterior >= 0 ? INVERSA[anterior] : -1;
  let hayOtra = false;
  for (let d = 0; d < 8; d++) {
    const j = vecino(i, d);
    if (j >= 0 && LIBRE[cf[j]] && d !== regreso) { hayOtra = true; break; }
  }
  const mantener = Math.random() < 0.75;
  let mejor = 0, puntaje = -1;
  for (let d = 0; d < 8; d++) {
    const j = vecino(i, d);
    if (j < 0 || !LIBRE[cf[j]] || (hayOtra && d === regreso)) continue;
    const p = Math.random() + (d === anterior && mantener ? 2 : 0);
    if (p > puntaje) { puntaje = p; mejor = d; }
  }
  return mejor;
}

// _distancias_hasta: distancia por caminos transitables (vecindad de Moore).
const cola = new Int32Array(CELDAS);
function distancias(cf, esFuente, salida, radio) {
  salida.fill(INFINITO);
  let fin = 0;
  for (let i = 0; i < CELDAS; i++) if (esFuente[cf[i]]) { salida[i] = 0; cola[fin++] = i; }
  for (let k = 0; k < fin; k++) {
    const i = cola[k];
    const dist = salida[i] + 1;
    if (dist > radio) continue;
    for (let d = 0; d < 8; d++) {
      const j = vecino(i, d);
      if (j < 0 || salida[j] !== INFINITO) continue;
      if (!TRANSITABLE[cf[j]] && !esFuente[cf[j]]) continue;
      salida[j] = dist;
      cola[fin++] = j;
    }
  }
}

// _rumbo_por_distancia: dirección que acerca a la fuente; `hayCamino` si mejora.
let hayCamino = false;
function rumboPorDistancia(dist, i) {
  let mejor = 0, minimo = INFINITO + 1, empates = 0;
  for (let d = 0; d < 8; d++) {
    const j = vecino(i, d);
    const v = j < 0 ? INFINITO : dist[j];
    if (v < minimo) { minimo = v; mejor = d; empates = 1; }
    else if (v === minimo && Math.random() * ++empates < 1) mejor = d;
  }
  hayCamino = minimo < dist[i];
  return mejor;
}

// Cuenta la población para el panel de estadísticas.
export function censo(tensor) {
  const fisica = capa(tensor, 0);
  let negras = 0, rojas = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (COLONIA_N[fisica[i]]) negras++;
    else if (COLONIA_R[fisica[i]]) rojas++;
  }
  return { negras, rojas };
}

// Estado de las entidades: la carga solo existe en obreras y el rumbo en móviles.
export function limpiarEstado(cf, est) {
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (!OBRERAS[e]) est.carga[i] = 0;
    if (!est.carga[i]) est.pasos[i] = 0;
    if (!MOVILES[e]) est.rumbo[i] = -1;
  }
}

// Las fuentes emiten cada turno: reinas, cadáveres, comida y basureros.
export function emisionInmutables(cf, tensor) {
  const cr = capa(tensor, CAPA_FEROMONA_REAL);
  const cn = capa(tensor, CAPA_NECROFEROMONAS);
  const cc = capa(tensor, CAPA_RASTRO_COMIDA);
  const crec = capa(tensor, CAPA_RECLUTAMIENTO);
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (e === REINA_N || e === REINA_R) cr[i] = 255;
    else if (e === CADAVER) cn[i] = 255;
    else if (e === COMIDA) cc[i] = 255;
    else if (e === BASURERO) crec[i] = 255;
  }
}

// ---------------------------------------------------------------------
// aplicar_reglas_biologicas
// ---------------------------------------------------------------------
const lista = new Int32Array(CELDAS);
const rumbos = new Int8Array(CELDAS);
const distComida = new Int32Array(CELDAS);
const distHogar = [new Int32Array(CELDAS), new Int32Array(CELDAS)];
const ES_COMIDA = conjunto(COMIDA);
const ES_HOGAR = [conjunto(NIDO_N, REINA_N), conjunto(NIDO_R, REINA_R)];

export function biologia(escritura, terreno, est) {
  const cf = capa(escritura, 0);
  const cc = capa(escritura, CAPA_RASTRO_COMIDA);
  const ca = capa(escritura, CAPA_ALARMA);
  const cr = capa(escritura, CAPA_FEROMONA_REAL);
  const cn = capa(escritura, CAPA_NECROFEROMONAS);
  const crec = capa(escritura, CAPA_RECLUTAMIENTO);

  reglaVeneno(cf, ca);
  reglaDepredador(cf, ca);
  reglaCombate(cf, ca);
  limpiarEstado(cf, est);
  recoleccionComida(cf, terreno, est);
  entregarComida(cf, est);
  dejarRastroDeRegreso(cc, est);
  moverDepredadores(cf, ca, terreno, est);

  // ¿Qué hay en el mapa? Así se evitan búsquedas que no hacen falta.
  let hayObreras = false, hayComida = false;
  const hayHogar = [false, false];
  const hayObrerasColor = [false, false];
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (OBRERAS[e]) { hayObreras = true; hayObrerasColor[COLOR_DE[e]] = true; }
    else if (e === COMIDA) hayComida = true;
    else if (e === NIDO_N || e === REINA_N) hayHogar[0] = true;
    else if (e === NIDO_R || e === REINA_R) hayHogar[1] = true;
  }
  const radio = P.RADIO_BUSQUEDA_COMIDA;
  if (hayObreras && hayComida) distancias(cf, ES_COMIDA, distComida, radio);
  else distComida.fill(INFINITO);
  for (let c = 0; c < 2; c++) {
    if (hayHogar[c] && hayObrerasColor[c]) distancias(cf, ES_HOGAR[c], distHogar[c], INFINITO);
  }

  // Rumbos. Obreras: comida cercana -> olor de comida -> necro -> reclutamiento
  // -> exploración; con carga vuelven a casa. Soldados: alarma -> reclutamiento -> exploración.
  let total = 0;
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (!HORMIGAS[e]) continue;
    const explorar = exploracion(cf, est.rumbo, i);
    const dRec = gradiente(crec, i);
    const mRec = mejora;
    let d;
    if (OBRERAS[e]) {
      const anterior = est.rumbo[i];
      const regreso = anterior >= 0 ? INVERSA[anterior] : -1;
      const dRadar = rumboPorDistancia(distComida, i);
      const cercaDeComida = hayCamino && distComida[i] <= radio;
      const dComida = gradiente(cc, i);
      const mComida = mejora;
      const dNecro = gradiente(cn, i);
      const mNecro = mejora;
      if (est.carga[i]) d = explorar;
      else if (cercaDeComida) d = dRadar;
      else if (mComida > 0 && dComida !== regreso) d = dComida;
      else if (mNecro > 0) d = dNecro;
      else if (mRec > 0) d = dRec;
      else d = explorar;

      const c = COLOR_DE[e];
      if (hayHogar[c]) {
        const dHogar = rumboPorDistancia(distHogar[c], i);
        if (hayCamino) {
          const retorno = !est.carga[i] && !cercaDeComida && mComida === 0 && mNecro === 0 &&
            mRec === 0 && cr[i] > 0 && Math.random() < P.PROB_RETORNO_REAL;
          if (est.carga[i] || retorno) d = dHogar;
        }
      }
    } else {
      const dAlarma = gradiente(ca, i);
      d = mejora > 0 ? dAlarma : mRec > 0 ? dRec : explorar;
    }
    lista[total] = i;
    rumbos[total] = d;
    total++;
  }
  moverEntidades(cf, total, terreno, est, null);

  entregarComida(cf, est);
  limpiezaCadaveres(cf, crec, terreno);
  mantenimientoNidos(cf, est);
  generacionNidos(cf, est);
  extincionHuerfanas(cf, ca);
  emisionInmutables(cf, escritura);
  limpiarEstado(cf, est);

  // Perímetro físico estable y señales anuladas en los muros.
  for (let x = 0; x < N; x++) { cf[x] = MURO; cf[(M - 1) * N + x] = MURO; }
  for (let y = 0; y < M; y++) { cf[y * N] = MURO; cf[y * N + N - 1] = MURO; }
  for (let i = 0; i < CELDAS; i++) {
    if (cf[i] !== MURO) continue;
    for (let c = 1; c < CAPAS; c++) escritura[c * CELDAS + i] = 0;
  }
}

// ---------------------------------------------------------------------
// _movimiento_vectorizado: un paso por entidad; la carga y la memoria viajan
// con ella. Si el rumbo preferido está ocupado, toma una salida libre.
// ---------------------------------------------------------------------
const original = new Uint8Array(CELDAS);
const cargaOriginal = new Uint8Array(CELDAS);
const pasosOriginal = new Uint16Array(CELDAS);
const reservado = new Uint8Array(CELDAS);
const movido = new Uint8Array(CELDAS);
const destinos = new Int32Array(CELDAS);

function moverEntidades(cf, total, terreno, est, alarma) {
  if (total === 0) return 0;
  original.set(cf);
  cargaOriginal.set(est.carga);
  pasosOriginal.set(est.pasos);
  reservado.fill(0);
  movido.fill(0, 0, total);

  for (let k = 0; k < total; k++) {
    const i = lista[k];
    const j = vecino(i, rumbos[k]);
    if (j < 0 || !LIBRE[original[j]]) rumbos[k] = exploracion(original, est.rumbo, i);
  }

  let n = 0;
  for (const d of barajar8()) {
    for (let k = 0; k < total; k++) {
      if (movido[k] || rumbos[k] !== d) continue;
      const i = lista[k];
      const j = vecino(i, d);
      if (j < 0 || !LIBRE[original[j]] || reservado[j]) continue;
      if (terreno[j] && P.PROB_MOVIMIENTO_ARENA < 1 && !(Math.random() < P.PROB_MOVIMIENTO_ARENA)) continue;

      cf[i] = terreno[i] ? ARENA_SECA : VACIO;
      cf[j] = original[i];
      est.carga[i] = 0; est.pasos[i] = 0; est.rumbo[i] = -1;
      est.carga[j] = cargaOriginal[i]; est.pasos[j] = pasosOriginal[i]; est.rumbo[j] = d;
      movido[k] = 1;
      reservado[j] = 1;
      destinos[n++] = j;
    }
  }
  if (alarma) for (let k = 0; k < n; k++) alarma[destinos[k]] = 255;
  return n;
}

// ---------------------------------------------------------------------
// Araña (DEPREDADOR): radar de 8 casillas, alcance de ataque 3×3.
// ---------------------------------------------------------------------
const calor = new Uint8Array(CELDAS);

function radarPresas(cf) {
  const R = P.RADIO_RADAR_DEPREDADOR;
  calor.fill(0);
  let fin = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (HORMIGAS[cf[i]]) { calor[i] = R + 1; cola[fin++] = i; }
  }
  if (fin === 0) return false;
  let inicio = 0;
  for (let distancia = 1; distancia <= R; distancia++) {
    const limite = fin;
    for (let k = inicio; k < limite; k++) {
      for (let d = 0; d < 8; d++) {
        const j = vecino(cola[k], d);
        if (j < 0 || calor[j] || cf[j] === MURO) continue;
        calor[j] = R + 1 - distancia;
        cola[fin++] = j;
      }
    }
    inicio = limite;
  }
  return true;
}

function moverDepredadores(cf, ca, terreno, est) {
  let total = 0;
  let hay = false;
  for (let i = 0; i < CELDAS; i++) if (cf[i] === DEPREDADOR) { hay = true; break; }
  if (!hay) return;
  const conRadar = radarPresas(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (cf[i] !== DEPREDADOR) continue;
    ca[i] = 255;
    const azar = exploracion(cf, est.rumbo, i);
    const rumbo = conRadar ? gradiente(calor, i) : 0;
    const d = conRadar && calor[i] > 0 ? rumbo : azar;
    if (!(Math.random() < P.PROB_MOVIMIENTO_DEPREDADOR)) continue;
    lista[total] = i;
    rumbos[total] = d;
    total++;
  }
  moverEntidades(cf, total, terreno, est, ca);
}

// Cuatro soldados alrededor la abaten (corrección: tres). Cada araña ataca a
// una presa adyacente con probabilidad 0.35 (corrección: también a las reinas).
const aranas = new Int32Array(CELDAS);
const pendiente = new Uint8Array(CELDAS);
function reglaDepredador(cf, ca) {
  let n = 0;
  for (let i = 0; i < CELDAS; i++) if (cf[i] === DEPREDADOR) aranas[n++] = i;
  if (n === 0) return;
  const presas = P.ARANA_ATACA_REINAS ? HORMIGAS_Y_REINAS : HORMIGAS;

  let vivas = 0;
  const abatidas = [];
  for (let k = 0; k < n; k++) {
    const i = aranas[k];
    let soldados = 0;
    for (let d = 0; d < 8; d++) {
      const j = vecino(i, d);
      if (j >= 0 && SOLDADOS[cf[j]]) soldados++;
    }
    if (soldados >= P.MIN_SOLDADOS_CONTRA_ARANA) abatidas.push(i);
    else aranas[vivas++] = i;
  }
  for (const i of abatidas) { cf[i] = CADAVER; ca[i] = 255; }

  for (let k = 0; k < vivas; k++) pendiente[k] = Math.random() < P.PROB_ATAQUE_DEPREDADOR ? 1 : 0;
  for (const d of barajar8()) {
    for (let k = 0; k < vivas; k++) {
      if (!pendiente[k]) continue;
      const j = vecino(aranas[k], d);
      if (j < 0 || !presas[cf[j]]) continue;
      cf[j] = CADAVER;
      ca[j] = 255;
      pendiente[k] = 0;
    }
  }
  for (let k = 0; k < vivas; k++) {
    const i = aranas[k];
    ca[i] = 255;
    for (let d = 0; d < 8; d++) {
      const j = vecino(i, d);
      if (j >= 0 && cf[j] !== MURO) ca[j] = 255;
    }
  }
}

const foto = new Uint8Array(CELDAS);

function reglaCombate(cf, ca) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    const e = foto[i];
    if ((COLONIA_N[e] && toca(foto, i, ES_SOLDADO_R)) || (COLONIA_R[e] && toca(foto, i, ES_SOLDADO_N))) {
      cf[i] = CADAVER;
      ca[i] = 255;
    }
  }
}

// Veneno: letalidad probabilística (también para la araña) y expansión con tope.
const candidatos = new Int32Array(CELDAS);
function reglaVeneno(cf, ca) {
  let celdasVeneno = 0;
  for (let i = 0; i < CELDAS; i++) if (cf[i] === VENENO) celdasVeneno++;
  if (celdasVeneno === 0) return;

  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (VICTIMAS_VENENO[foto[i]] && toca(foto, i, ES_VENENO) && Math.random() < P.PROB_MUERTE_VENENO) {
      cf[i] = CADAVER;
      ca[i] = 255;
    }
  }

  const limite = Math.floor(CELDAS * P.FRACCION_MAXIMA_VENENO);
  const disponibles = Math.max(0, limite - celdasVeneno);
  if (disponibles === 0 || P.PROB_EXPANSION_VENENO === 0) return;
  let n = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (LIBRE[cf[i]] && toca(foto, i, ES_VENENO) && Math.random() < P.PROB_EXPANSION_VENENO) candidatos[n++] = i;
  }
  const cantidad = Math.min(n, disponibles);
  for (let k = 0; k < cantidad; k++) {
    if (n > disponibles) {
      const j = k + ((Math.random() * (n - k)) | 0);
      [candidatos[k], candidatos[j]] = [candidatos[j], candidatos[k]];
    }
    cf[candidatos[k]] = VENENO;
  }
}

// Cada obrera libre toma como máximo una celda de comida por turno.
function recoleccionComida(cf, terreno, est) {
  let n = 0;
  for (let i = 0; i < CELDAS; i++) if (OBRERAS[cf[i]] && !est.carga[i]) lista[n++] = i;
  if (n === 0) return;
  movido.fill(0, 0, n);
  for (const d of barajar8()) {
    for (let k = 0; k < n; k++) {
      if (movido[k]) continue;
      const i = lista[k];
      const j = vecino(i, d);
      if (j < 0 || cf[j] !== COMIDA) continue;
      cf[j] = terreno[j] ? ARENA_SECA : VACIO;
      est.carga[i] = 1;
      est.pasos[i] = 0;
      movido[k] = 1;
    }
  }
}

// La obrera cargada que toca su nido o su reina entrega la comida.
function entregarComida(cf, est) {
  for (let i = 0; i < CELDAS; i++) {
    if (!est.carga[i]) continue;
    const e = cf[i];
    if (!OBRERAS[e]) continue;
    const c = COLOR_DE[e];
    if (!toca(cf, i, ES_HOGAR[c])) continue;
    const colonia = est.colonias[COLORES[c].nombre];
    colonia.reservas += P.VALOR_COMIDA;
    colonia.entregas++;
    est.carga[i] = 0;
    est.pasos[i] = 0;
  }
}

// Solo marca quien lleva alimento; el rastro es más fuerte cerca de la comida.
function dejarRastroDeRegreso(cc, est) {
  for (let i = 0; i < CELDAS; i++) {
    if (!est.carga[i]) continue;
    const intensidad = Math.max(30, 220 - est.pasos[i] * P.DESCENSO_RASTRO);
    if (cc[i] < intensidad) cc[i] = intensidad;
    if (est.pasos[i] < 65535) est.pasos[i]++;
  }
}

function limpiezaCadaveres(cf, crec, terreno) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (foto[i] === CADAVER && toca(foto, i, OBRERAS)) {
      cf[i] = terreno[i] ? ARENA_SECA : VACIO;
      crec[i] = 255;
    }
  }
}

// Las reservas sostienen la colonia; el hambre prolongada mata su nido y su reina.
function mantenimientoNidos(cf, est) {
  for (let c = 0; c < 2; c++) {
    const { nombre, nido, reina } = COLORES[c];
    const colonia = est.colonias[nombre];
    let base = false;
    for (let i = 0; i < CELDAS; i++) if (cf[i] === nido || cf[i] === reina) { base = true; break; }
    if (!base) { colonia.existia = false; continue; }
    // Corrección: una colonia nueva empieza con reservas y sin hambre acumulada.
    if (!colonia.existia) {
      colonia.reservas = P.RESERVA_INICIAL;
      colonia.hambre = 0;
      colonia.entregas = 0;
      colonia.existia = true;
    }
    colonia.reservas = Math.max(0, colonia.reservas - P.CONSUMO_NIDO);
    colonia.hambre = colonia.reservas === 0 ? colonia.hambre + 1 : 0;
    if (colonia.hambre >= P.LIMITE_HAMBRE) {
      for (let i = 0; i < CELDAS; i++) if (cf[i] === nido || cf[i] === reina) cf[i] = CADAVER;
      colonia.existia = false; // La próxima colonia de este color arranca de cero
    }
  }
}

// Un nacimiento posible por celda de nido y turno, pagado con las reservas.
const ES_REINA = [conjunto(REINA_N), conjunto(REINA_R)];
const nidos = new Int32Array(CELDAS);
function generacionNidos(cf, est) {
  for (let c = 0; c < 2; c++) {
    const { nombre, nido, obrera, soldado } = COLORES[c];
    const colonia = est.colonias[nombre];
    // Corrección: no se gasta en nacimientos la reserva mínima del nido.
    const cupoTotal = Math.floor((colonia.reservas - P.RESERVA_MINIMA) / P.COSTO_NACIMIENTO);
    if (cupoTotal < 1) continue;
    // Corrección: con más reservas nacen más hormigas, hasta un tope.
    const prob = Math.min(P.PROB_NACIMIENTO_MAXIMA,
      Math.max(P.PROB_NACIMIENTO, P.PROB_NACIMIENTO * colonia.reservas / P.RESERVA_INICIAL));

    // Corrección: solo pare el nido que tiene su reina al lado.
    let n = 0;
    for (let i = 0; i < CELDAS; i++) {
      if (cf[i] === nido && toca(cf, i, ES_REINA[c]) && Math.random() < prob) nidos[n++] = i;
    }
    if (n === 0) continue;
    if (n > cupoTotal) {
      for (let k = 0; k < cupoTotal; k++) {
        const j = k + ((Math.random() * (n - k)) | 0);
        [nidos[k], nidos[j]] = [nidos[j], nidos[k]];
      }
      n = cupoTotal;
    }
    movido.fill(0, 0, n);
    for (const d of barajar8()) {
      for (let k = 0; k < n; k++) {
        if (movido[k]) continue;
        const j = vecino(nidos[k], d);
        if (j < 0 || cf[j] !== VACIO) continue;
        cf[j] = Math.random() < P.FRACCION_SOLDADOS ? soldado : obrera;
        colonia.reservas -= P.COSTO_NACIMIENTO;
        movido[k] = 1;
      }
    }
  }
}

// Corrección: sin nido ni reina, las hormigas de ese color se van extinguiendo.
function extincionHuerfanas(cf, ca) {
  if (P.PROB_MUERTE_HUERFANA === 0) return;
  const conBase = [false, false];
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (e === NIDO_N || e === REINA_N) conBase[0] = true;
    else if (e === NIDO_R || e === REINA_R) conBase[1] = true;
  }
  if (conBase[0] && conBase[1]) return;
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (!HORMIGAS[e] || conBase[COLOR_DE[e]]) continue;
    if (Math.random() < P.PROB_MUERTE_HUERFANA) cf[i] = CADAVER;
  }
}
