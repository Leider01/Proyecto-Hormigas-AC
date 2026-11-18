# Versión local en Python (CuPy)

La simulación la calcula el backend del Subgrupo 3 en Python, con `MotorCuPy` en la tarjeta gráfica. La página solo dibuja el mundo y envía los pinceles.

```
localhost/
├── backend/        archivo .py del backend (se usa tal cual, sin modificarlo)
├── adaptador.py    todo lo que se usa del backend: clases, métodos y constantes
├── servidor.py     carga el backend, corre los ticks y atiende la página
├── web/            página: HTML, CSS y JS
└── requirements.txt
```

## Requisitos

- Tarjeta gráfica NVIDIA. Sin ella el motor CuPy no arranca.
- Python 3.10 o superior.
- Guardar el proyecto en una ruta corta, por ejemplo `C:\Users\<usuario>\Documents\web-colonia-hormigas`. En rutas muy largas Windows no puede cargar las librerías de CUDA (error 206).

## Instalación (solo la primera vez)

Cree el entorno virtual **fuera de OneDrive**, porque pesa más de 1 GB:

```bash
python -m venv C:\Users\<usuario>\.venvs\hormigas
C:\Users\<usuario>\.venvs\hormigas\Scripts\python -m pip install -r requirements.txt
```

`requirements.txt` instala `cupy-cuda13x`, que necesita un controlador NVIDIA con CUDA 13. Revise la versión con `nvidia-smi`. Si dice CUDA 12, cambie esa línea por `cupy-cuda12x[ctk]` antes de instalar.

## Encenderlo

Desde la carpeta `localhost`:

```bash
C:\Users\<usuario>\.venvs\hormigas\Scripts\python servidor.py
```

Abra `http://localhost:8000`. Para apagarlo, presione Ctrl + C en la terminal. Si el puerto está ocupado: `servidor.py --puerto 8010`.

## Cambiar el backend

1. Borre el `.py` que está en `backend/` y ponga el nuevo. El nombre del archivo no importa, pero debe haber uno solo.
2. Vuelva a encender el servidor. El encabezado de la página muestra qué archivo cargó.

El backend debe conservar estos nombres, porque `adaptador.py` los usa:

- `MotorCuPy(alto, ancho, api=...)` con `avanzar_tick()`, `snapshot_cpu()`, `cargar_mapa()`, `estado_colonias()`, `tick`, `actual`, `terreno_arena`, `carga_comida`, `pasos_con_carga` y `direccion_anterior`.
- `ModoDios` con `pintar_celda`, `borrar_celda` y `procesar_cola_acciones`.
- Las constantes de estados (`VACIO`, `NIDO_N`, `DEPREDADOR`…) y de capas (`CAPA_FISICA`, `CAPA_RASTRO_COMIDA`…).

Si cambian alguno, el servidor falla al arrancar con el nombre que no encontró, y se ajusta en `adaptador.py`.
