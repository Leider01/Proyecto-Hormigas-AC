# Proyecto-Hormigas-AC

## Visión General del Proyecto

El proyecto consiste en construir un simulador interactivo de ecosistemas (modo "Dios" o *sandbox*). Los usuarios podrán alterar el entorno en tiempo real (colocando comida, veneno, muros o agua) mientras dos colonias de hormigas compiten por la supervivencia, rigiéndose estrictamente por reglas matemáticas de autómatas celulares y difusión de feromonas.

Todo debe ejecutarse de forma paralela en la nube mediante Google Colab.

## Integrantes

| Foto | Nombre completo                    | Código  | Foto | Nombre completo                    | Código  |
|:----:|:-----------------------------------|:-------:|:----:|:-----------------------------------|:-------:|
| <a href="https://github.com/xJulianGodoyx"><img src="https://github.com/xJulianGodoyx.png" width="60" height="60"></a> | **Pedro Julián Suarez Godoy** | 2232725 | <a href="https://github.com/carlosmerlano"><img src="https://github.com/carlosmerlano.png" width="60" height="60"></a> | **Carlos Iván Merlano Vergara** | 2250188 |
| <a href="https://github.com/Angel-Jimenez08"><img src="https://github.com/Angel-Jimenez08.png" width="60" height="60"></a> | **Ángel Santiago Jiménez Rincón** | 2251260 | <a href="https://github.com/ItsNico0104"><img src="https://github.com/ItsNico0104.png" width="60" height="60"></a> | **Nicolás Arturo Carrillo Hernández** | 2250165 |
| <a href="https://github.com/JoshepLizarazo"><img src="https://github.com/JoshepLizarazo.png" width="60" height="60"></a> | **Joshep Jared Lizarazo Montero** | 2250150 | <a href="https://github.com/Stivencaballero0710"><img src="https://github.com/Stivencaballero0710.png" width="60" height="60"></a> | **Jannyer Stiven Caballero Domínguez** | 2250191 |
| <a href="https://github.com/HAUNTERVII"><img src="https://github.com/HAUNTERVII.png" width="60" height="60"></a> | **Jose Ángel Soto Ramírez** | 2250201 | <a href="https://github.com/Bramdonjgv"><img src="https://github.com/Bramdonjgv.png" width="60" height="60"></a> | **Bramdon Julián González Velandia** | 2250196 |
| <a href="https://github.com/Derly0"><img src="https://github.com/Derly0.png" width="60" height="60"></a> | **Derly Yurany Sanabria Barragán** | 2245003 | <a href="https://github.com/Leider01"><img src="https://github.com/Leider01.png" width="60" height="60"></a> | **Leider Yesid Gómez Giraldo** | 2232503 |

# Formalización de Reglas Biológicas y Lógica del Entorno

El ecosistema del autómata celular se modela matemáticamente mediante la tupla $A = (Q, \Sigma, V, \delta)$:

- **Conjunto de Estados Físicos ($Q$):** Representado en la Capa 0 del tensor (`uint8`), conformado por 16 estados discretos:
  - **Terrenos:** `VACIO` (0), `ARENA_SECA` (1), `MURO` (2).
  - **Consumibles y Eventos:** `COMIDA` (3), `VENENO` (4), `CADAVER` (5).
  - **Colonia Negra:** `NIDO_N` (6), `REINA_N` (7), `OBRERA_N` (8), `SOLDADO_N` (9).
  - **Colonia Roja:** `NIDO_R` (10), `REINA_R` (11), `OBRERA_R` (12), `SOLDADO_R` (13).
  - **Entidades Neutrales:** `BASURERO` (14), `DEPREDADOR` (15).
- **Alfabeto Químico ($\Sigma$):** Representado en las Capas 1 a 5 del tensor, donde cada celda almacena una intensidad discreta en el rango $[0, 255]$:
  - **Capa 1:** Rastro de Comida.
  - **Capa 2:** Feromona de Alarma (Combate).
  - **Capa 3:** Feromona Real (GPS hacia Nidos/Reinas).
  - **Capa 4:** Necroferomonas (Presencia de Cadáveres).
  - **Capa 5:** Reclutamiento (Limpieza y Basurero).
- **Vecindad Espacial ($V$):** Vecindad de Moore de $3 \times 3$ alrededor de la coordenada central $(x,y)$, excluyendo la propia celda al escanear adyacencias:

```math
V(x,y) = \{c_{(i,j)} \mid \max(|x-i|, |y-j|) = 1\}
```

---

## 1. Reglas de Mortalidad, Combate y Peligros Ambientales

### 1.1. Aniquilación por Depredador (`aplicar_regla_depredador`)
- **Descripción:** El Depredador (15) es una amenaza masiva[cite: 1]. Si cualquier hormiga móvil ($\text{HORMIGA} \in \{8, 9, 12, 13\}$) se encuentra en la vecindad $3 \times 3$ de un depredador, muere instantáneamente y su celda pasa a estado `VACIO` (0)[cite: 1].
- **Función de transición:**

```math
\delta(c_{(x,y)}) = \text{VACIO} \iff c_{(x,y)} \in \{8, 9, 12, 13\} \land \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = \text{DEPREDADOR}
```

### 1.2. Combate Intercolonial Asimétrico
- **Descripción:** Los soldados cazan a las unidades enemigas en su vecindad $3 \times 3$[cite: 2]. El Soldado Rojo (13) aniquila tanto a Obreras Negras (8) como a Soldados Negros (9)[cite: 2]. De forma simétrica, el Soldado Negro (9) aniquila tanto a Obreras Rojas (12) como a Soldados Rojos (13)[cite: 2]. Las unidades abatidas se convierten en `VACIO` (0)[cite: 2].
- **Función de transición:**

```math
\delta(c_{(x,y)}) = \text{VACIO} \iff \Big(c_{(x,y)} \in \{8, 9\} \land \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = 13\Big) \lor \Big(c_{(x,y)} \in \{12, 13\} \land \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = 9\Big)
```

### 1.3. Emisión Química de Alarma por Combate
- **Descripción:** En el instante y coordenada exacta donde ocurre una baja por combate entre colonias, se libera una descarga máxima de feromona de alarma (255) en la Capa 2 para atraer a más soldados hacia el frente de batalla[cite: 2].
- **Función de transición:**

```math
\delta_{\text{quim}}(c_{(x,y)}) \rightarrow \text{Capa}_2(x,y) = 255 \iff \text{Baja por combate en } (x,y)
```

### 1.4. Mortalidad Retardada por Veneno
- **Descripción:** El Veneno (4) afecta a todas las castas biológicas ($\text{BIO} \in \{7, 8, 9, 11, 12, 13\}$, incluyendo Reinas)[cite: 2]. Cuando una hormiga está en contacto con veneno en su vecindad $3 \times 3$, experimenta una probabilidad de muerte $p_{\text{muerte}} = 0.125$ por tick (esperanza de supervivencia $\mathbb{E}[T] = 8$ ticks)[cite: 2]. Al morir por toxicidad, la hormiga se transforma en `CADAVER` (5)[cite: 2].
- **Función de transición:**

```math
\delta(c_{(x,y)}) = \text{CADAVER} \iff c_{(x,y)} \in \{7, 8, 9, 11, 12, 13\} \land \Big(\exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = \text{VENENO}\Big) \land \Big(U(0,1) < 0.125\Big)
```

### 1.5. Expansión Ambiental del Veneno
- **Descripción:** El Veneno (4) se propaga sobre el suelo transitable adyacente (`VACIO` 0 o `ARENA_SECA` 1) con una probabilidad $p_{\text{exp}} = 0.03$ por tick, respetando obstáculos inmutables como los muros (2)[cite: 2].
- **Función de transición:**

```math
\delta(c_{(x,y)}) = \text{VENENO} \iff c_{(x,y)} \in \{0, 1\} \land \Big(\exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = \text{VENENO}\Big) \land \Big(U(0,1) < 0.03\Big)
```

---

## 2. Reglas de Emisión Química Inmutable, Recolección y Limpieza

### 2.1. Emisión de Feromona Real
- **Descripción:** Las Reinas (7 y 11) emiten de manera perpetua el valor máximo (255) en la Capa 3 en su propia coordenada para estabilizar la colonia y actuar como baliza GPS[cite: 2].
- **Función de transición:**

```math
\delta_{\text{quim}}(c_{(x,y)}) \rightarrow \text{Capa}_3(x,y) = 255 \iff c_{(x,y)} \in \{\text{REINA\_N}, \text{REINA\_R}\}
```

### 2.2. Emisión de Necroferomonas
- **Descripción:** Todo `CADAVER` (5) es físicamente inerte pero inyecta continuamente 255 en la Capa 4 (Necroferomonas) para alertar a las obreras de su presencia[cite: 3].
- **Función de transición:**

```math
\delta_{\text{quim}}(c_{(x,y)}) \rightarrow \text{Capa}_4(x,y) = 255 \iff c_{(x,y)} = \text{CADAVER}
```

### 2.3. Señalización Química de Alimento 
- **Descripción:** Si una obrera ($\text{OBRERA} \in \{8, 12\}$) detecta una celda de `COMIDA` (3) en su vecindad $3 \times 3$, inyecta 255 en la Capa 1 (Rastro de Comida) en su posición actual para guiar a sus compañeras[cite: 3].
- **Función de transición:**

```math
\delta_{\text{quim}}(c_{(x,y)}) \rightarrow \text{Capa}_1(x,y) = 255 \iff c_{(x,y)} \in \{8, 12\} \land \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = \text{COMIDA}
```

### 2.4. Consumo Físico de Comida 
- **Descripción:** Toda celda de `COMIDA` (3) que tenga al menos una obrera ($\{8, 12\}$) en su vecindad $3 \times 3$ es recolectada y pasa a estado `VACIO` (0)[cite: 3].
- **Función de transición:**

```math
\delta(c_{(x,y)}) = \text{VACIO} \iff c_{(x,y)} = \text{COMIDA} \land \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} \in \{8, 12\}
```

### 2.5. Limpieza de Cadáveres 
- **Descripción:** Cuando una obrera ($\{8, 12\}$) entra en contacto adyacente ($3 \times 3$) con un `CADAVER` (5), remueve el cuerpo convirtiendo la celda del cadáver en `VACIO` (0)[cite: 3].
- **Función de transición:**

```math
\delta(c_{(x,y)}) = \text{VACIO} \iff c_{(x,y)} = \text{CADAVER} \land \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} \in \{8, 12\}
```

### 2.6. Emisión de Reclutamiento y Basurero 
- **Descripción:** Las celdas de `BASURERO` (14) y las coordenadas donde se acaba de limpiar un cadáver inyectan 255 en la Capa 5 (Reclutamiento) para coordinar tareas de higiene[cite: 3].
- **Función de transición:**

```math
\delta_{\text{quim}}(c_{(x,y)}) \rightarrow \text{Capa}_5(x,y) = 255 \iff c_{(x,y)} = \text{BASURERO} \lor \text{Limpieza en } (x,y)
```

---

## 3. Generación de Unidades en Nidos 

### 3.1. Natalidad Estocástica por Casta y Colonia
- **Descripción:** Los nidos (`NIDO_N` = 6 y `NIDO_R` = 10) generan nuevas hormigas en celdas `VACIO` (0) de su vecindad $3 \times 3$ con $P_{\text{nac}} = 0.05$ por tick[cite: 3]. Del total de nacimientos, el $80\%$ son Obreras ($U_2 \ge 0.20$) y el $20\%$ son Soldados ($U_2 < 0.20$)[cite: 3].
- **Función de transición:**  
  Para una celda $c_{(x,y)} = \text{VACIO}$ con $U_1(0,1) < 0.05$[cite: 4]:

```math
\delta(c_{(x,y)}) = \begin{cases}
\text{OBRERA\_N } (8) & \text{si } \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = 6 \land U_2 \ge 0.20 \\
\text{SOLDADO\_N } (9) & \text{si } \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = 6 \land U_2 < 0.20 \\
\text{OBRERA\_R } (12) & \text{si } \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = 10 \land U_2 \ge 0.20 \\
\text{SOLDADO\_R } (13) & \text{si } \exists c_{(i,j)} \in V(x,y) : c_{(i,j)} = 10 \land U_2 < 0.20
\end{cases}
```

---

## 4. Inteligencia Colectiva y Movimiento Espacial

### 4.1. Escáner de Gradientes Químicos y Exploración 
- **Descripción:** Para una capa química $K$, la entidad evalúa las 8 celdas vecinas $d \in \{0..7\}$[cite: 4]. Elige la dirección $d^*$ que maximiza la concentración de feromona[cite: 4]. Si el gradiente es 0 en toda la vecindad, la hormiga selecciona una dirección aleatoria uniforme $\mathcal{U}\{0..7\}$ para explorar[cite: 4].
  - **Obreras (8 y 12):** Evalúan $K = \text{Capa}_1$ (Rastro de Comida)[cite: 4].
  - **Soldados (9 y 13):** Evalúan $K = \text{Capa}_2$ (Alarma de Combate)[cite: 4].
- **Formulación matemática:**

```math
d^*(x,y) = \begin{cases}
\arg\max_{d \in \{0..7\}} K(x + \Delta y_d, y + \Delta x_d) & \text{si } \max_{d \in \{0..7\}} K(x + \Delta y_d, y + \Delta x_d) > 0 \\
\mathcal{U}\{0, 1, 2, 3, 4, 5, 6, 7\} & \text{en caso contrario}
\end{cases}
```

### 4.2. Intercambio de Celdas y Filtro de Terreno
- **Descripción:** Las hormigas no se desplazan como objetos continuos, sino que transfieren su estado a la celda destino $(x', y') = (x + \Delta y_{d^*}, y + \Delta x_{d^*})$[cite: 4]. La transición ocurre solo si la unidad no se ha movido en el tick actual y el terreno destino es transitable (`VACIO` 0 o `ARENA_SECA` 1)[cite: 4]. Muros (2) y otras entidades bloquean el paso[cite: 4].
