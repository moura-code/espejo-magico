# Espejo Mágico — Documentación de Arquitectura

## 1. Visión General

El **Espejo Mágico** es una instalación interactiva para eventos y stands institucionales. Un visitante se ubica frente a un televisor montado verticalmente (enmarcado como espejo) con una cámara web superior. El sistema detecta la presencia del visitante, cubre la pantalla con niebla, sortea una ingeniería, despeja la niebla y despliega objetos característicos de esa carrera que caen y interactúan con la cabeza y manos de la persona. En simultáneo, un conjunto de tablets conectadas en red reproducen videos de mujeres referentes de la disciplina sorteada.

### Principios Fundamentales
1. **100% Offline (Sin Internet):** No existe dependencia de CDNs, APIs externas o servicios en la nube en tiempo de ejecución.
2. **Cero paso de compilación (No Bundler):** Módulos ES nativos en el navegador (`<script type="module">`).
3. **Privacidad absoluta:** El flujo de video de la cámara se procesa exclusivamente en la memoria RAM del navegador local. Ninguna imagen se graba, almacena o transmite.
4. **Desacoplamiento estricto de módulos:** Cada módulo tiene responsabilidades únicas y se puede probar de forma independiente sin necesidad de DOM, cámara o pantalla real.

---

## 2. Diagrama de Arquitectura de Sistema

```
                      ┌─────────────────────────────────────────┐
                      │            PC DEL ESPEJO                │
                      │                                         │
  ┌──────────────┐    │  ┌───────────────────────────────────┐  │
  │ WebCam (USB) ├───┼──►│ Chrome (--kiosk localhost:8080)   │  │
  └──────────────┘    │  │                                   │  │
                      │  │  espejo/main.js (Loop 60 FPS)     │  │
                      │  │   ├── MediaPipe (WASM Local)      │  │
                      │  │   ├── Motor de Física 2D + Imán   │  │
                      │  │   └── Renderizador Canvas 2D      │  │
                      │  └─────────────────┬─────────────────┘  │
                      │                    │                    │
                      │                    ▼ (WebSocket)        │
                      │  ┌───────────────────────────────────┐  │
                      │  │ servidor/servidor.js (Node.js)    │  │
                      │  │  - Archivos Estáticos               │  │
                      │  │  - WebSocket Relay              │  │
                      │  └─────────────────┬─────────────────┘  │
                      └────────────────────┼────────────────────┘
                                           │
                                           │ Red Wi-Fi Local (Router)
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │              TABLETS                    │
                      │ ┌─────────────────────────────────────┐ │
                      │ │ tablet.html?slot=0, 1, 2...         │ │
                      │ │  - Cliente WebSocket reactivo       │ │
                      │ │  - Reproductor MP4 (Muted loop)     │ │
                      │ └─────────────────────────────────────┘ │
                      └─────────────────────────────────────────┘
```

---

## 3. Desglose de Módulos y Responsabilidades

### 3.1. Servidor Local (`servidor/servidor.js`)
Servidor HTTP y relé WebSocket mínimo escrito sobre Node.js nativo (única dependencia externa: `ws`).
- **MIMEs soportados:** HTML, JS, CSS, JSON, PNG, JPG, WebP, MP4, WASM (`application/wasm`) y `.task` (`application/octet-stream`).
- **Comportamiento WebSocket:** Reenvía mensajes entrantes a todos los clientes conectados. Almacena el último mensaje transmitido (`ultimoMensaje`) para entregárselo inmediatamente a cualquier tablet que se conecte o reconecte.

### 3.2. Dominio y Protocolo Común (`comun/protocolo.js`)
Define la estructura estandarizada de mensajes que viajan a través del WebSocket entre el espejo y las tablets:
- `hola`: Declaración del rol del cliente (`espejo` o `tablet`).
- `carrera`: Anuncio de sorteo (`{ tipo: 'carrera', id, sesion }`).
- `reposo`: Orden de apagado/desvanecido de tablets (`{ tipo: 'reposo' }`).

### 3.3. Aplicación del Espejo (`espejo/`)

| Archivo | Responsabilidad |
|---|---|
| `config.js` | Única fuente de verdad para parámetros ajustables (tiempos, aceleración, constantes de física, umbrales de detección y redes). |
| `main.js` | Orquestador principal y bucle de renderizado (`requestAnimationFrame`). Conecta captura de cámara, detección, física, máquina de estados y dibujo. |
| `maquina-estados.js` | Lógica de estados pura (`ATRACCION`, `ENGANCHE`, `SORTEO`, `REVELACION`, `ESCENA`, `CIERRE`). No dibuja ni accede al DOM. |
| `vision.js` | Inicializador de los modelos WASM de MediaPipe Tasks Vision (`FaceLandmarker`, `HandLandmarker`, `PoseLandmarker`). |
| `camara.js` | Manejo de `navigator.mediaDevices.getUserMedia`, volteo horizontal y bucle de reintentos continuos en caso de desconexión. |
| `rostro.js` | Transforma los puntos landmarks de MediaPipe a coordenadas de pantalla (`{ centro, ojoIzq, ojoDer, radio, angulo, confianza }`). Soporta fuentes sintéticas y video grabado para desarrollo sin cámara. |
| `manos.js` | Extrae palmas, grado de apertura de la mano y radio de atracción magnética a partir de los puntos de la mano. |
| `pose.js` | Extrae puntos clave del cuerpo (hombros) como respaldo de posición. |
| `suavizado.js` | Filtros exponenciales (`AlphaFilter`) para eliminar el parpadeo/temblor de los landmarks y control de histéresis de presencia (`PresenciaHisteresis`). |
| `anclaje.js` | Calcula la posición, escala y rotación 2D del accesorio (casco/gafas/antiparras) acoplándolo a la línea de los ojos. |
| `fisica.js` | Motor de física 2D custom: gravedad, rebote elástico con la cabeza, colisión con suelo/paredes y atracción magnética hacia las manos. |
| `objetos.js` | Pool de objetos reciclables con límite máximo dinámico (`CONFIG.objetos.maximo`) y gestión de tiempo de vida con desvanecido (*fade-out*). |
| `sorteo.js` | Gestor de sorteo aleatorio con algoritmo de **bolsa barajada sin repetición contigua**. |
| `niebla.js` | Animación responsiva de las nubes que cubren el espejo durante el reposo y se abren circularmente en la revelación. |
| `figuras.js` | Sistema de fallback vectorial en Canvas 2D (36 figuras dibujadas por código para cuando no existen archivos PNG). |
| `efectos.js` | Sistema de partículas por carrera (engranajes, chispas, código binario, fórmulas matemáticas, planos técnicos, burbujas). |
| `imagenes.js` | Gestor y precargador de imágenes PNG con fallback elegante. |
| `contenido.js` | Carga y valida el archivo `contenido/carreras.json` al inicio del sistema. |
| `escena.js` | Componedor gráfico final: renderiza en capas (Video espejo → Efecto partículas → Niebla → Accesorio → Objetos → Textos responsivos). |
| `bus.js` | Cliente WebSocket con reconexión automática y emisión de latidos (*heartbeat*). |
| `operacion.js` | Atajos de teclado, panel HUD de métricas/FPS y recarga periódica de mantenimiento. |

---

## 4. Ciclo de Vida de la Máquina de Estados

La máquina de estados (`espejo/maquina-estados.js`) gobierna el flujo de la experiencia:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  ▼                                                             │ (Sin rostro > 3s)
┌───────────┐  Rostro Estable  ┌───────────┐  Transcurridos  ┌───────────┐
│ ATRACCION ├─────────────────►│ ENGANCHE  ├────────────────►│  SORTEO   │
└─────▲─────┘   (~2 segundos)  └───────────┘   (~3 segundos) └─────┬─────┘
      │                                                            │
      │                                                            ▼ (Se elige carrera)
┌───────────┐   Ausencia /     ┌───────────┐  Transcurridos  ┌───────────┐
│  CIERRE   │◄─────────────────┤  ESCENA   │◄────────────────┤REVELACION │
└─────┬─────┘   Sesión Máxima  └─────▲─────┘   (~2 segundos) └───────────┘
      │                              │
      └──────────────────────────────┘ (Transmisión a Tablets)
```

1. **`ATRACCION`**: Niebla completa sobre el espejo. Video atenuado. Nadie sentado. Se emite `reposo` a las tablets.
2. **`ENGANCHE`**: Detección de rostro estable. La niebla empieza a agitarse.
3. **`SORTEO`**: Niebla densa con animación de aceleración. Se extrae una carrera de la bolsa barajada.
4. **`REVELACION`**: La niebla se abre desde la cara del usuario. Se envía el mensaje `{ tipo: 'carrera', id, sesion }` a las tablets.
5. **`ESCENA`**: Caen los objetos de la carrera. Se acopla el accesorio. Las palmas de las manos atraen los objetos (modo imán). Dura mientras la persona permanezca sentada (con un tiempo máximo de seguridad `sesionMaxima`).
6. **`CIERRE`**: Desvanecido general, mensaje de agradecimiento. Las nubes vuelven a cubrir el espejo.

---

## 5. Algoritmos Clave

### 5.1. Anclaje de Accesorios (`espejo/anclaje.js`)
Dado un accesorio PNG con dos puntos de referencia de ojos normalizados (`anclaOjoIzq` y `anclaOjoDer` en rango 0..1 dentro del propio PNG):
1. Se calcula la distancia y el ángulo del vector entre los ojos detectados en pantalla:
   $$\Delta x = x_{der} - x_{izq}, \quad \Delta y = y_{der} - y_{izq}$$
   $$\text{distancia} = \sqrt{\Delta x^2 + \Delta y^2}, \quad \text{ángulo} = \operatorname{atan2}(\Delta y, \Delta x)$$
2. La escala del accesorio se obtiene relacionando la distancia entre los ojos detectados y la distancia entre los anclajes del gráfico.
3. El centro de masa del accesorio se posiciona de modo que coincida con el punto medio de los ojos en pantalla, aplicando el desplazamiento `offsetY`.

### 5.2. Física e Interacción con Manos (`espejo/fisica.js` y `espejo/manos.js`)
El motor de física implementa dos comportamientos de interacción con las manos:

- **Modo Imán (Predeterminado):**
  - Las palmas generan un campo de fuerza hacia un **anillo de reposo** alrededor de la mano.
  - Fuera del anillo, la fuerza es de atracción; dentro del anillo, es de repulsión suave.
  - Los objetos capturados en el racimo aplican **fuerzas inelásticas de separación entre sí**, lo que permite que varios objetos descansen ordenadamente alrededor de las palmas sin amontonarse ni colapsar.
  - Las coordenadas de la palma se filtran mediante un suavizado lento (`manos.suavizadoDelIman`) para evitar que el racimo tiemble.

- **Modo Manotazo (Tecla `I`):**
  - La palma actúa como una esfera sólida de colisión elástica utilizando las coordenadas de detección crudas (sin filtro) para mantener la máxima capacidad de respuesta ante impulsos veloces del usuario.

### 5.3. Cadena de Fallback de Objetos
Para garantizar la solidez de la instalación, el dibujo de un objeto sigue una estrategia defensiva de tres niveles:
1. **Archivo PNG:** Se dibuja la ilustración PNG si el recurso existe y cargó correctamente.
2. **Figura Vectorial (`espejo/figuras.js`):** Si el PNG no existe o falla, se dibuja un ícono vectorial generado por código Canvas 2D utilizando el color de la carrera.
3. **Círculo Genérico:** Si no existe ni el PNG ni la figura vectorial, se dibuja un círculo coloreado.
*Resultado:* El sistema nunca muestra errores en pantalla ni rompe la escena por falta de assets de diseño.

---

## 6. Integración con Tablets (`tablet/`)

- Las tablets son dispositivos clientes independientes que abren la URL: `http://<IP-PC>:8080/tablet/tablet.html?slot=N`
- Cada slot ($0, 1, 2, 3...$) asigna una referente distinta de la carrera activa según el arreglo de `referentes` en `contenido/carreras.json`.
- **Reproducción sin intervención humana:** Los videos se reproducen con las propiedades `muted`, `playsinline` y `loop`. Esto permite la reproducción automática en todos los navegadores móviles sin requerir interacción táctil.
- **Precarga en memoria:** Al conectar, la tablet precarga los videos MP4 de todos los slots para evitar parpadeos durante los cambios de carrera.
- **Desambiguación de Latidos:** El mensaje WebSocket incluye un número único de `sesion`. Si la tablet recibe un latido de confirmación con la misma sesión actual, no reinicia ni interrumpe la reproducción del video en curso.

---

## 7. Garantías de Rendimiento y Presupuesto
- Detección visual limitada a **20-25 FPS**; renderizado a **60 FPS** con interpolación de posición.
- Presupuesto máximo de objetos en pantalla: `CONFIG.objetos.maximo` (40 por defecto). Los objetos más antiguos se desvanecen automáticamente.
- Presupuesto máximo de partículas de fondo por efecto para evitar sobrecargar la GPU/CPU en sesiones prolongadas.
- Recarga de mantenimiento automática: si el espejo se encuentra en estado `ATRACCION` tras el intervalo configurado (`CONFIG.operacion.recargaCadaMs`), la página se recarga para liberar memoria acumulada.
