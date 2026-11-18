// Página: dibuja lo que calcula el backend en Python y le envía los pinceles.
// No simula nada; todo el cálculo ocurre en el servidor (MotorCuPy).

// Colores por nombre de estado (los nombres los define adaptador.py).
const COLORES = {
  vacio: ['Tierra húmeda', '#5a3e26'], arena: ['Arena seca', '#b89b62'],
  muro: ['Muro / roca', '#2f2f35'], comida: ['Comida', '#7cc142'],
  veneno: ['Veneno / ácido', '#c026ff'], cadaver: ['Cadáver', '#a8a29e'],
  nido_n: ['Nido negro', '#15151b'], reina_n: ['Reina negra', '#ffd23f'],
  obrera_n: ['Obrera negra', '#000000'], soldado_n: ['Soldado negro', '#3d3d6b'],
  nido_r: ['Nido rojo', '#6e1010'], reina_r: ['Reina roja', '#ff5fa2'],
  obrera_r: ['Obrera roja', '#ff2d2d'], soldado_r: ['Soldado rojo', '#ffa07a'],
  basurero: ['Basurero', '#4e342e'], depredador: ['Depredador (araña)', '#22d3ee'],
};
const COLORES_CAPA = {
  rastro: '#38bdf8', alarma: '#ffe14d', real: '#f472b6', necro: '#a3e635', reclutamiento: '#fb923c',
};
// Pincel de la página -> estado cuyo color muestra la muestra
const MUESTRA_PINCEL = {
  'colonia-n': 'nido_n', 'colonia-r': 'nido_r', muro: 'muro', comida: 'comida', veneno: 'veneno',
  'hormiga-n': 'obrera_n', 'hormiga-r': 'obrera_r', 'soldado-n': 'soldado_n', 'soldado-r': 'soldado_r',
  borrar: 'vacio', depredador: 'depredador', arena: 'arena', cadaver: 'cadaver', basurero: 'basurero',
};
const CAPA_DE_PINCEL = {
  'f-rastro': 'rastro', 'f-alarma': 'alarma', 'f-real': 'real', 'f-necro': 'necro', 'f-reclutamiento': 'reclutamiento',
};
const UN_CLIC = new Set(['colonia-n', 'colonia-r', 'depredador']);
const GROSORES = [1, 3, 5, 7, 9];

const $ = (id) => document.getElementById(id);
const aRGB = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const enviar = (ruta, datos) =>
  fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });

let config, alto, ancho, celdas;
let contexto, imagen, pixeles;
const paleta = new Uint32Array(256);
let idDepredador;
const colorCapa = [];          // índice de capa -> [r, g, b]
const pincel = { nombre: 'colonia-n', grosor: 3 };
let versionDibujada = -1;

// --- Arranque ---------------------------------------------------------------
async function iniciar() {
  try {
    config = await (await fetch('/api/config')).json();
  } catch {
    $('origen').textContent = 'Sin conexión: encienda el servidor (python servidor.py)';
    $('origen').classList.add('error');
    return;
  }
  ({ alto, ancho } = config);
  celdas = alto * ancho;
  $('origen').textContent = `Backend: ${config.backend} · GPU: ${config.gpu}`;

  for (const [nombre, id] of Object.entries(config.estados)) {
    const [r, g, b] = aRGB(COLORES[nombre][1]);
    paleta[id] = 0xff000000 | (b << 16) | (g << 8) | r;
  }
  idDepredador = config.estados.depredador;
  for (const [nombre, indice] of Object.entries(config.capas)) {
    if (COLORES_CAPA[nombre]) colorCapa[indice] = aRGB(COLORES_CAPA[nombre]);
  }

  const lienzo = $('lienzo');
  lienzo.width = ancho;
  lienzo.height = alto;
  contexto = lienzo.getContext('2d');
  imagen = contexto.createImageData(ancho, alto);
  pixeles = new Uint32Array(imagen.data.buffer);

  prepararPanel();
  conectarLienzo(lienzo);
  $('delay').value = config.delay;
  $('delay-valor').textContent = `${Number(config.delay).toFixed(2)} s`;
  pedirCuadro();
  pedirEstado();
}

// --- Dibujo ---------------------------------------------------------------------
function capasVisibles() {
  return [...document.querySelectorAll('input[data-capa]')]
    .filter((c) => c.checked).map((c) => config.capas[c.dataset.capa]);
}

async function pedirCuadro() {
  try {
    const visibles = capasVisibles();
    const capas = [config.capas.fisica, ...visibles];
    const r = await fetch(`/api/cuadro?capas=${capas.join(',')}&version=${versionDibujada}`);
    if (r.status === 200) {
      const datos = new Uint8Array(await r.arrayBuffer());
      dibujar(datos, visibles);
      versionDibujada = Number(r.headers.get('X-Version'));
    }
  } catch { /* el servidor se apagó; se reintenta */ }
  setTimeout(pedirCuadro, 30);
}

function dibujar(datos, visibles) {
  const fisica = datos.subarray(0, celdas);
  const quimicas = visibles.map((c, k) => [datos.subarray((k + 1) * celdas, (k + 2) * celdas), colorCapa[c]]);
  const suelo = new Set([config.estados.vacio, config.estados.arena]);

  for (let i = 0; i < celdas; i++) {
    const e = fisica[i];
    let color = paleta[e];
    if (quimicas.length && suelo.has(e)) {
      let r = color & 255, g = (color >> 8) & 255, b = (color >> 16) & 255;
      for (const [capa, [cr, cg, cb]] of quimicas) {
        const v = capa[i];
        if (!v) continue;
        const a = Math.min(1, v / 160) * 0.9;
        r += (cr - r) * a; g += (cg - g) * a; b += (cb - b) * a;
      }
      color = 0xff000000 | (b << 16) | (g << 8) | r;
    }
    pixeles[i] = color;
  }
  // La araña ocupa una celda; se dibuja como sprite de 3×3.
  for (let i = 0; i < celdas; i++) {
    if (fisica[i] !== idDepredador) continue;
    const y = (i / ancho) | 0, x = i - y * ancho;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < alto && xx >= 0 && xx < ancho) pixeles[yy * ancho + xx] = paleta[idDepredador];
      }
    }
  }
  contexto.putImageData(imagen, 0, 0);
}

// --- Estadísticas -----------------------------------------------------------------
const reservas = (c) => (c ? `${Math.round(c.reservas)} · ${c.comida_entregada} entregas` : '—');

async function pedirEstado() {
  try {
    const e = await (await fetch('/api/estado')).json();
    $('stat-tick').textContent = e.tick;
    $('stat-negras').textContent = e.negras;
    $('stat-rojas').textContent = e.rojas;
    $('stat-reservas-negras').textContent = reservas(e.colonias.negra);
    $('stat-reservas-rojas').textContent = reservas(e.colonias.roja);
    $('stat-ms').textContent = e.corriendo ? `${e.ms_tick} ms` : '—';
    $('btn-play').classList.toggle('activo', e.corriendo);
    $('btn-pausa').classList.toggle('activo', !e.corriendo);
  } catch { /* se reintenta */ }
  setTimeout(pedirEstado, 250);
}

// --- Panel ------------------------------------------------------------------------
function prepararPanel() {
  $('btn-play').addEventListener('click', () => enviar('/api/control', { accion: 'play' }));
  $('btn-pausa').addEventListener('click', () => enviar('/api/control', { accion: 'pausa' }));
  $('btn-reset').addEventListener('click', () => enviar('/api/control', { accion: 'reset' }));

  for (const radio of document.querySelectorAll('input[name="pincel"]')) {
    radio.addEventListener('change', () => { pincel.nombre = radio.value; });
    const color = CAPA_DE_PINCEL[radio.value]
      ? COLORES_CAPA[CAPA_DE_PINCEL[radio.value]]
      : COLORES[MUESTRA_PINCEL[radio.value]][1];
    radio.parentElement.querySelector('.muestra').style.background = color;
  }
  pincel.nombre = document.querySelector('input[name="pincel"]:checked').value;

  const cambiarGrosor = (delta) => {
    const k = GROSORES.indexOf(pincel.grosor) + delta;
    pincel.grosor = GROSORES[Math.max(0, Math.min(GROSORES.length - 1, k))];
    $('grosor-valor').textContent = `${pincel.grosor}×${pincel.grosor}`;
  };
  $('grosor-menos').addEventListener('click', () => cambiarGrosor(-1));
  $('grosor-mas').addEventListener('click', () => cambiarGrosor(1));

  $('delay').addEventListener('input', () => {
    const valor = Number($('delay').value);
    $('delay-valor').textContent = `${valor.toFixed(2)} s`;
    enviar('/api/control', { accion: 'delay', valor });
  });

  for (const casilla of document.querySelectorAll('input[data-capa]')) {
    casilla.parentElement.querySelector('.muestra').style.background = COLORES_CAPA[casilla.dataset.capa];
    casilla.addEventListener('change', () => { versionDibujada = -1; });
  }

  $('leyenda').innerHTML = Object.entries(config.estados)
    .sort((a, b) => a[1] - b[1])
    .map(([nombre, id]) => `<li><span class="muestra" style="background:${COLORES[nombre][1]}"></span>${id} · ${COLORES[nombre][0]}</li>`)
    .join('');
}

// --- Pinceles sobre el lienzo ---------------------------------------------------------
let pendientes = [];

function conectarLienzo(lienzo) {
  let ultima = null;
  const celda = (ev) => {
    const caja = lienzo.getBoundingClientRect();
    return [
      Math.floor(((ev.clientY - caja.top) / caja.height) * alto),
      Math.floor(((ev.clientX - caja.left) / caja.width) * ancho),
    ];
  };
  lienzo.addEventListener('pointerdown', (ev) => {
    lienzo.setPointerCapture(ev.pointerId);
    ultima = celda(ev);
    pendientes.push(ultima);
    enviarPendientes();
  });
  lienzo.addEventListener('pointermove', (ev) => {
    if (!ultima || UN_CLIC.has(pincel.nombre)) return;
    const actual = celda(ev);
    trazarLinea(ultima, actual);
    ultima = actual;
  });
  const soltar = () => { ultima = null; enviarPendientes(); };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  setInterval(enviarPendientes, 50);
}

// Bresenham: un arrastre rápido no deja huecos entre dos lecturas del puntero.
function trazarLinea([f0, c0], [f1, c1]) {
  const df = Math.abs(f1 - f0), dc = Math.abs(c1 - c0);
  const sf = f0 < f1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
  let error = dc - df, f = f0, c = c0;
  while (f !== f1 || c !== c1) {
    const e2 = 2 * error;
    if (e2 > -df) { error -= df; c += sc; }
    if (e2 < dc) { error += dc; f += sf; }
    pendientes.push([f, c]);
  }
}

function enviarPendientes() {
  if (!pendientes.length) return;
  const puntos = pendientes;
  pendientes = [];
  enviar('/api/pincel', { pincel: pincel.nombre, grosor: pincel.grosor, puntos });
}

iniciar();
