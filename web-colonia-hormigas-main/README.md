# 🐜 Simulador de Colonia de Hormigas — Modo Dios

![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-responsive-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Dependencias](https://img.shields.io/badge/dependencias-0-success)

Autómata celular interactivo basado en **Optimización por Colonia de Hormigas (ACO)**. Dos colonias, negra y roja, conviven en un mundo de **500 × 500 celdas**, y usted puede alterar el entorno en tiempo real con los pinceles.

El motor es un **port a JavaScript del `MotorNumPy` del Subgrupo 3 (Sprint 3)** en su versión con recolección: las obreras cargan comida y la entregan a su nido, cada colonia vive de sus reservas y la araña tiene alcance 3×3. Sobre ese port se corrigieron los fallos que se encontraron al probar el cuaderno (ver **Correcciones**).

> 📸 _Espacio para el GIF de la simulación (`assets/`)._

## Cómo correrlo

No requiere instalación ni compilación. Como usa módulos ES, se abre desde un servidor estático y no con doble clic:

```bash
python -m http.server 8000
```

Luego abra `http://localhost:8000`. También está publicado en GitHub Pages.

## Manual rápido

| Control | Qué hace |
|---|---|
| **▶ Play / ⏸ Pausa / 🔄 Reset** | Arranca, detiene o regenera el mundo inicial. |
| **Pinceles** | El mapa arranca vacío. Colonia N. y Colonia R. ponen un nido con su reina en cada clic, y Araña pone una araña por clic. Muro, Comida, Veneno, Hormiga N. y R., Soldado N. y R., Borrar, Arena seca, Cadáver y Basurero pintan con clic o arrastre. |
| **Feromonas** | Pintan una de las cinco capas químicas con intensidad 220 (los pinceles -1 a -5 de la API). |
| **Grosor** | Tamaño del pincel: 1×1, 3×3, 5×5, 7×7 o 9×9. |
| **Visor químico** | Superpone cualquiera de las cinco capas: rastro de comida, alarma, feromona real, necroferomonas y reclutamiento. |
| **Delay** | Pausa entre turnos, de 0 a 0,5 s (variable global `DELAY`). |
| **Estadísticas** | Turno actual, población viva de cada colonia, reservas y comida entregada. |

## Arquitectura

El mundo es un **tensor `uint8` de 500 × 500 × 6** con doble búfer.

| Capa | Contenido | Pérdida por paso de propagación |
|---|---|---|
| 0 | Física: alfabeto Σ de 16 estados | — |
| 1 | Rastro de comida | 7 |
| 2 | Alarma / peligro | 4 |
| 3 | Feromona real | 10 |
| 4 | Necroferomonas | 7 |
| 5 | Reclutamiento | 7 |

Fuera de las capas, cada hormiga lleva su carga de comida, los pasos que lleva cargada y su dirección anterior. Cada colonia guarda sus reservas, sus turnos de hambre y la comida entregada.

### Ciclo de cada turno (`avanzar_tick`)

1. Se drena la **cola de acciones del Modo Dios** sobre la matriz actual y se registra la arena pintada como terreno.
2. Se copia la matriz actual a la siguiente y las fuentes emiten: reinas, cadáveres, comida y basureros.
3. **Física:** cada capa pierde 1 o 2 unidades y la señal se propaga 2 pasos en cruz, perdiendo intensidad con la distancia. Los muros no la dejan pasar.
4. **Biología**, en este orden: veneno → ataque de la araña → combate → recolección → entrega → rastro de regreso → movimiento de la araña → rumbos de las hormigas → movimiento → entrega → limpieza de cadáveres → mantenimiento de nidos (consumo y hambre) → nacimientos → extinción de huérfanas → emisión → muro perimetral.
5. Se intercambian los búferes, se dibuja la capa 0 en el `<canvas>` y se espera `DELAY` segundos.

### Reglas principales

- **Recolección:** una obrera libre toma una celda de comida vecina, vuelve a su nido por el camino más corto y suma 20 a las reservas. Mientras vuelve deja un rastro que es más fuerte cerca de la comida.
- **Búsqueda:** las obreras van hacia la comida que tengan a 60 celdas o menos de camino; si no, siguen el rastro, las necroferomonas o el reclutamiento, y si no, exploran con inercia.
- **Colonia:** empieza con 150 de reservas, gasta 0,2 por turno y 5 por nacimiento. Tras 300 turnos sin reservas mueren su nido y su reina.
- **Araña:** persigue presas a 8 casillas, ataca a una vecina con probabilidad 0,35 y muere si la rodean 3 soldados o por veneno.

### Estructura

```
index.html
src/
├── constantes.js   Σ, capas, pérdidas, parámetros biológicos, colormap
├── tensor.js       Tensor, doble búfer, estado de hormigas y colonias
├── mundo.js        Mundo inicial (Reset)
├── fisica.js       Evaporación y propagación
├── biologia.js     Reglas biológicas del motor
├── render.js       Tensor → píxeles
├── pinceles.js     Cola de acciones del Modo Dios
├── main.js         Ciclo de vida y panel
└── css/styles.css
```

## Equivalencias con el motor en Python

| Python (NumPy) | JavaScript |
|---|---|
| Máscaras booleanas calculadas al inicio de cada regla | Copia (`foto`) de la capa física al inicio de cada regla |
| `trasladar` (fuera del mapa no hay nada) | Vecinos con comprobación de bordes |
| `escanear_gradiente_quimico`, `_elegir_exploracion` y `_rumbo_por_distancia` sobre todo el tablero | Se evalúan solo en las celdas con hormiga o araña; el resultado es el mismo |
| `_distancias_hasta` con `maximum_filter` repetido | Búsqueda en anchura con cola |
| `carga_comida`, `pasos_con_carga`, `direccion_anterior` | `motor.carga`, `motor.pasos`, `motor.rumbo` |

Con los valores del cuaderno, el port da los mismos alcances de señal (comida 31 celdas, feromona real 23) y la misma evolución que el motor en Python: con la comida a 30 celdas, a los 700 turnos la colonia negra entregó las 100 celdas de comida y la roja murió de hambre en ambos.

## Correcciones

| Fallo del cuaderno | Corrección en la web |
|---|---|
| Una colonia pintada después de que otra del mismo color murió de hambre muere en el siguiente turno, porque el contador de hambre no se reinicia. | Una colonia nueva arranca con reservas iniciales y sin hambre acumulada. |
| Las obreras y los soldados son inmortales: si la reina muere, la colonia sigue para siempre. | Sin nido ni reina de su color, cada hormiga muere con probabilidad 0,01 por turno. |
| Un nido sin reina pare si hay cualquier otra reina del mismo color en el mapa. | Solo pare el nido que tiene su reina al lado. |
| La comida a más de ~45 celdas nunca se encuentra: el rastro de regreso se borra antes de llegar al nido y el retorno a la reina (20 %) mantiene a las obreras cerca de casa. | Radio de búsqueda de 60 celdas, rastro que pierde 2 por paso y 1 por turno, retorno del 3 % y reserva inicial de 150. Con comida a ~100 celdas la colonia sobrevive. |
| Las reservas se acumulan sin uso y la colonia gasta en nacimientos lo que necesita para no pasar hambre. | La probabilidad de nacer sube con las reservas (hasta 0,25) y no se gastan las últimas 40 en nacimientos. |
| La araña arrasa una colonia pequeña, porque hacen falta 4 soldados a la vez para matarla, y no ataca a las reinas aunque el veneno sí las mata. | La matan 3 soldados y también ataca a las reinas. |
| La arena seca no acelera la evaporación. | Sobre arena seca la química pierde 4 unidades más por turno. |
| El motor tarda 4,3 s por tick a 1000 × 1000 y 0,4–0,6 s a 500 × 500. | Las reglas se calculan solo donde hay entidades y los caminos con búsqueda en anchura: unos 30 ms por tick a 500 × 500. |

Lo que se conserva a propósito: las reglas de un turno se aplican en cadena sobre la matriz de escritura, como en el motor (una hormiga que muere en combate ya no se mueve en ese turno). El doble búfer separa un turno del siguiente.

## Adaptaciones para la web

- **Araña de un clic:** como en la API, el pincel pone una sola araña aunque el grosor sea mayor, y se dibuja como un sprite de 3 × 3.
- **Mundo inicial:** el motor no define uno de 500 × 500. La web arranca vacía, solo con el muro perimetral, y el usuario construye todo con los pinceles.
- **Pinceles Colonia N. y Colonia R.:** cada clic pone un nido con su reina debajo, como en los mapas del motor. Funcionan con clic, no al arrastrar, para no sembrar decenas de colonias en un trazo.
- **`DELAY` inicial:** 0,05 s, como en el boceto. El motor usa 0,5 s.
