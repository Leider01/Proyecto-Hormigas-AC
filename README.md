# 🐜 Simulador de Colonia de Hormigas — Autómata Celular (ACO)

> Proyecto final de la asignatura **Autómatas y Lenguajes Formales** (Universidad Industrial de Santander — UIS, Grupo 2, 2026-2).

Simulador interactivo en **"Modo Dios"** donde dos colonias de hormigas (**Negra** y **Roja**) compiten por sobrevivir, recolectar alimento, defenderse de depredadores y gestionar sus reservas energéticas sobre un mundo de **500 × 500 celdas**.

Toda la simulación es calculada en paralelo sobre tarjeta gráfica NVIDIA mediante **`MotorCuPy`** (con respaldo equivalente en CPU vía **`MotorNumPy`**), mientras que el navegador renderiza el estado y envía las herramientas de edición en tiempo real.

## 👥 Integrantes del Equipo

| Subgrupo | Rol Principal | Integrantes |
| :--- | :--- | :--- |
| **Subgrupo 1** | Documentación y Formalización Matemática | <a href="https://github.com/Leider01"><img src="https://github.com/Leider01.png" width="30" height="30" align="absmiddle"></a> [**Leider Yesid Gómez Giraldo**](https://github.com/Leider01) (`2232503`)<br><a href="https://github.com/HAUNTERVII"><img src="https://github.com/HAUNTERVII.png" width="30" height="30" align="absmiddle"></a> [**Jose Ángel Soto Ramírez**](https://github.com/HAUNTERVII) (`2250201`) |
| **Subgrupo 2** | Interfaz Web y Visualización (Frontend) | <a href="https://github.com/JoshepLizarazo"><img src="https://github.com/JoshepLizarazo.png" width="30" height="30" align="absmiddle"></a> [**Joshep Jared Lizarazo Montero**](https://github.com/JoshepLizarazo) (`2250150`)<br><a href="https://github.com/Bramdonjgv"><img src="https://github.com/Bramdonjgv.png" width="30" height="30" align="absmiddle"></a> [**Bramdon Julián González Velandia**](https://github.com/Bramdonjgv) (`2250196`) |
| **Subgrupo 3** | Motor Físico-Químico, GPU (CuPy) y API Modo Dios | <a href="https://github.com/Stivencaballero0710"><img src="https://github.com/Stivencaballero0710.png" width="30" height="30" align="absmiddle"></a> [**Jannyer Stiven Caballero Domínguez**](https://github.com/Stivencaballero0710) (`2250191`)<br><a href="https://github.com/carlosmerlano"><img src="https://github.com/carlosmerlano.png" width="30" height="30" align="absmiddle"></a> [**Carlos Iván Merlano Vergara**](https://github.com/carlosmerlano) (`2250188`)<br><a href="https://github.com/ItsNico0104"><img src="https://github.com/ItsNico0104.png" width="30" height="30" align="absmiddle"></a> [**Nicolás Arturo Carrillo Hernández**](https://github.com/ItsNico0104) (`2250165`) |
| **Subgrupo 4** | Reglas Biológicas, Calibración y Validación (QA) | <a href="https://github.com/Angel-Jimenez08"><img src="https://github.com/Angel-Jimenez08.png" width="30" height="30" align="absmiddle"></a> [**Ángel Santiago Jiménez Rincón**](https://github.com/Angel-Jimenez08) (`2251260`)<br><a href="https://github.com/xJulianGodoyx"><img src="https://github.com/xJulianGodoyx.png" width="30" height="30" align="absmiddle"></a> [**Pedro Julián Suarez Godoy**](https://github.com/xJulianGodoyx) (`2232725`)<br><a href="https://github.com/Derly0"><img src="https://github.com/Derly0.png" width="30" height="30" align="absmiddle"></a> [**Derly Yurany Sanabria Barragán**](https://github.com/Derly0) (`2245003`) |


## 📐 Formalización Matemática del Modelo

El ecosistema se modela formalmente como un **Autómata Celular Estocástico Multicapa con Memoria Auxiliar Acoplada**, definido mediante la $6$-tupla:

$$\mathcal{A} = \left( \mathcal{L}, \, \Sigma, \, \mathcal{Q}, \, \mathcal{E}, \, \mathcal{N}, \, \delta \right)$$

- **Retículo Espacial ($\mathcal{L}$):** Cuadrícula bidimensional finita de dimensiones $M \times N = 500 \times 500$ ($\vert{}\mathcal{L}\vert{} = 250\,000$ celdas) con fronteras cerradas perimetrales fijas en `MURO = 2` (sin efecto toroidal, implementada mediante desplazamientos por *slicing* en `trasladar`).
- **Alfabeto Físico ($\Sigma$ — Capa 0):** Conjunto de 16 estados discretos en `uint8`:
  - **Terreno ($0\text{–}2$):** `0`: `VACIO`, `1`: `ARENA_SECA` (sustrato persistente que reduce la movilidad al $50\,\%$), `2`: `MURO`.
  - **Objetos y Eventos ($3\text{–}5$):** `3`: `COMIDA`, `4`: `VENENO`, `5`: `CADAVER`.
  - **Colonia Negra ($6\text{–}9$):** `6`: `NIDO_N`, `7`: `REINA_N`, `8`: `OBRERA_N`, `9`: `SOLDADO_N`.
  - **Colonia Roja ($10\text{–}13$):** `10`: `NIDO_R`, `11`: `REINA_R`, `12`: `OBRERA_R`, `13`: `SOLDADO_R`.
  - **Entidades Neutrales ($14\text{–}15$):** `14`: `BASURERO`, `15`: `DEPREDADOR` (Araña).
- **Espacio del Tensor ($\mathcal{Q}$):** Tensor tridimensional de forma `(500, 500, 6)` en precisión `uint8` (`0..255`) administrado con doble búfer (`actual` para lectura y `siguiente` para escritura):
  - **Capa 0:** Física ($\Sigma$).
  - **Capa 1:** `CAPA_RASTRO_COMIDA` (pérdida espacial $\Delta = 7$).
  - **Capa 2:** `CAPA_ALARMA` (pérdida espacial $\Delta = 4$).
  - **Capa 3:** `CAPA_FEROMONA_REAL` (pérdida espacial $\Delta = 10$).
  - **Capa 4:** `CAPA_NECROFEROMONAS` (pérdida espacial $\Delta = 7$).
  - **Capa 5:** `CAPA_RECLUTAMIENTO` (pérdida espacial $\Delta = 7$).
- **Memoria Auxiliar Acoplada ($\mathcal{E}$):** Arreglos paralelos fuera de las 6 capas que viajan sincronizados con cada entidad (`carga_comida`, `pasos_con_carga`, `direccion_anterior`, `terreno_arena`) y métricas globales por colonia (`reservas_nido`, `turnos_hambre`, `comida_entregada`).
- **Vecindades ($\mathcal{N}$):**
  - **Von Neumann (4 vecinos en cruz):** utilizada para la difusión química (`difundir`).
  - **Moore (8 vecinos):** utilizada para el sensado de presencia ($3 \times 3$), lectura de gradientes, rutas BFS, combate y movimiento.
- **Función de Transición ($\delta$):** Composición secuencial por turno ($t \to t+1$) de los operadores de física química ($\delta_{\text{fis}}$) y reglas biológicas ($\delta_{\text{bio}}$).

---

## ⚙️ Dinámica del Motor (`motores_colab_corregidos.py`)

### Ciclo de cada Turno (`avanzar_tick`)

- **Drenado de ModoDios:** Se aplican bajo `threading.Lock()` los pinceles físicos (`1..15`) y químicos (`-1..-5`, intensidad `220`) encolados desde la interfaz, limpiando la memoria auxiliar de las celdas modificadas y actualizando `terreno_arena`.
- **Emisión de Fuentes Inmutables:** Reinas (Capa 3), cadáveres (Capa 4), comida (Capa 1) y basureros (Capa 5) inyectan intensidad máxima (`255`).
- **Física Química ($\delta_{\text{fis}}$):**
  - **Evaporación uniforme (LUT):** Cada capa química pierde `PERDIDA_EVAPORACION = 2` unidades por turno mediante indexación directa en una tabla precalculada.
  - **Difusión en cruz (`PASOS_DIFUSION = 2`):** Se propaga en precisión temporal `int16` tomando en cada celda libre el máximo entre su valor y el de sus 4 vecinos ortogonales menos la pérdida del *kernel*, bloqueada completamente por los muros.
- **Reglas Biológicas ($\delta_{\text{bio}}$):**
  - **Veneno:** Mortalidad estocástica de `0.125` en vecindad $3 \times 3$ (afecta hormigas, reinas y arañas), generando `CADAVER` y `ALARMA = 255`. Se expande con probabilidad `0.01` respetando un tope real del $8\,\%$ del tablero.
  - **Depredador (Araña):** Ocupa 1 celda física (renderizada como *sprite* $3 \times 3$). Persigue presas con un radar de calor de 8 casillas bloqueado por muros, se mueve con probabilidad `0.35` y ataca a 1 hormiga adyacente (obrera o soldado) con probabilidad `0.35` dejando `CADAVER` y alarma. Emite un halo constante de alarma $3 \times 3$ y muere rodeada por 4 soldados o por veneno.
  - **Combate intercolonial:** Simétrico en vecindad $3 \times 3$; toda hormiga que toque a un soldado rival pasa a `CADAVER` e inyecta `ALARMA = 255`.
  - **Recolección, rastro y entrega:** Cada obrera libre toma máximo 1 celda de comida por turno. Al regresar cargada deposita rastro decreciente $\max(30, \, 220 - 3 \cdot \text{pasos})$. Al tocar su nido o reina suma `+20` reservas.
  - **Navegación y movimiento vectorizado:** Combina campos de distancia BFS con caché (`RADIO_BUSQUEDA_COMIDA = 16` para comida; ilimitado hacia el hogar), gradiente químico estricto con exclusión de mesetas ($\text{máximo} > \text{celda actual}$), retorno ocasional por feromona real (`0.20`) y exploración con $75\,\%$ de inercia evitando retroceder si hay otra salida libre. El desplazamiento se resuelve en paralelo en orden aleatorio de direcciones sin colisiones y con $50\,\%$ de fricción sobre arena seca.
  - **Higiene, metabolismo y natalidad:** Las obreras limpian cadáveres adyacentes emitiendo `RECLUTAMIENTO = 255`. Cada colonia inicia con `100` de reserva, consume `0.2` por turno y muere tras `300` turnos con reservas en cero. Cada nacimiento cuesta `5.0` (probabilidad `0.05`: $80\,\%$ obreras, $20\,\%$ soldados) mientras exista al menos una reina viva de su color.
- **Publicación:** Se copia `siguiente` sobre `actual` (`xp.copyto`) y se incrementa el contador `tick`. La transferencia `VRAM → RAM` (`snapshot_cpu()`) ocurre únicamente cuando la interfaz solicita un fotograma.

---

## 🚀 Requisitos y Ejecución Local (GPU NVIDIA)

### Requisitos previos
- Tarjeta gráfica NVIDIA con soporte CUDA (requerida para `MotorCuPy`).
- Python `3.10` o superior.
- Ubicar el proyecto en una ruta corta (por ejemplo, `C:\Users\<usuario>\Documents\Proyecto-Hormigas-AC`) para evitar el error `206` de Windows al cargar librerías de CUDA.

### 1. Instalación (solo la primera vez)
Cree el entorno virtual fuera de OneDrive (el paquete supera 1 GB):

```bash
python -m venv C:\Users\<usuario>\.venvs\hormigas
C:\Users\<usuario>\.venvs\hormigas\Scripts\python -m pip install -r web-colonia-hormigas/localhost/requirements.txt
```

> **Nota sobre CUDA:** `requirements.txt` instala `cupy-cuda13x[ctk]` (para controladores con CUDA 13). Revise su versión con `nvidia-smi`; si dispone de CUDA 12, reemplace esa línea por `cupy-cuda12x[ctk]` antes de instalar.

### 2. Iniciar el simulador
Desde la carpeta `web-colonia-hormigas/localhost`:

```bash
C:\Users\<usuario>\.venvs\hormigas\Scripts\python servidor.py
```

Abra su navegador en `http://localhost:8000` (si el puerto está ocupado, use `servidor.py --puerto 8010`). Para detener el servidor, presione `Ctrl + C`.

---

## 🧪 Validación y Escenarios de Prueba

El módulo `motores_colab_corregidos.py` incluye escenarios semilla y rutinas de medición independientes para ambos *backends* (`NumPy` y `CuPy`):

- **Mapas semilla:** `mapa_asedio`, `mapa_laberinto` (generación DFS con depredador móvil y veneno) y `mapa_cementerio` (limpieza de cadáveres y basureros).
- **Benchmarking:** `benchmark_numpy(1000, 1000)` y `benchmark_cupy(1000, 1000)` con sincronización explícita de *streams* CUDA (`cp.cuda.Stream.null.synchronize()`) para medir el tiempo real en milisegundos por *tick*.
