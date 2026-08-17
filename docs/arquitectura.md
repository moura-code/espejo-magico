# Espejo Mágico — Documentación de Arquitectura

## 1. Visión General

El **Espejo Mágico** es una instalación interactiva para eventos y stands institucionales. Un visitante se ubica frente a un televisor montado verticalmente (enmarcado como espejo) con una cámara web superior. El sistema detecta la presencia del visitante, cubre la pantalla con niebla, sortea una de doce ingenierías, despeja la niebla y despliega objetos característicos de esa carrera que caen e interactúan con la cabeza y manos de la persona.

Toda la experiencia vive en una sola pestaña de Chrome, en una sola PC. No hay segundas pantallas, ni red, ni estado compartido con nadie.

### Principios Fundamentales
1. **100% Offline (Sin Internet):** No existe dependencia de CDNs, APIs externas o servicios en la nube en tiempo de ejecución.
2. **Cero paso de compilación (No Bundler):** Módulos ES nativos en el navegador (`<script type="module">`).
3. **Privacidad absoluta:** El flujo de video de la cámara se procesa exclusivamente en la memoria RAM del navegador local. Ninguna imagen se graba, almacena o transmite.
4. **Desacoplamiento estricto de módulos:** Cada módulo tiene responsabilidades únicas y se puede probar de forma independiente sin necesidad de DOM, cámara o pantalla real.

---

## 2. Diagrama de Arquitectura de Sistema

```
                    ┌───────────────────────────────────────────┐
                    │              PC DEL ESPEJO                │
                    │                                           │
  ┌──────────────┐  │  ┌─────────────────────────────────────┐  │
  │ WebCam (USB) ├──┼─►│ Chrome (--kiosk localhost:8080)     │  │
  └──────────────┘  │  │                                     │  │
                    │  │  espejo/main.js (bucle a 60 FPS)    │  │
                    │  │   ├── MediaPipe (WASM local)        │  │
                    │  │   ├── Motor de física 2D + imán     │  │
                    │  │   └── Renderizador Canvas 2D        │  │
                    │  └─────────────────┬───────────────────┘  │
                    │                    │                      │
                    │                    ▼ HTTP (solo archivos) │
                    │  ┌─────────────────────────────────────┐  │
                    │  │ servidor/servidor.js (Node.js)      │  │
                    │  │  - Archivos estáticos               │  │
                    │  │  - Cero dependencias externas       │  │
                    │  └─────────────────────────────────────┘  │
                    └───────────────────────────────────────────┘
```

El servidor existe por una sola razón: Chrome sólo entrega la cámara en contextos
seguros, y `file://` no lo es. Por eso el espejo se abre siempre por `localhost`.

---

## 3. Desglose de Módulos y Responsabilidades

### 3.1. Servidor Local (`servidor/servidor.js`)
Servidor de archivos estáticos escrito sobre Node.js nativo. **Sin dependencias de producción:** sólo importa módulos `node:`. Ni una línea de lógica de la experiencia vive acá.
- **MIMEs soportados:** HTML, JS, CSS, JSON, PNG, JPG, WebP, MP4, WASM (`application/wasm`) y `.task` (`application/octet-stream`).
- **Cache:** `immutable` de un año para `/vendor/` (los modelos de MediaPipe, versionados y pesados); `no-cache` con ETag para todo lo demás, para que un PNG nuevo de diseño se vea sin vaciar el cache.
- **Rangos:** soporta `Range` sobre `.mp4`, incluidos archivos de 0 bytes, que responden 200 vacío o 416 según corresponda. Es corrección HTTP genérica, no algo que la experiencia use hoy.

### 3.2. Aplicación del Espejo (`espejo/`)

| Archivo | Responsabilidad |
|---|---|
| `config.js` | Única fuente de verdad para parámetros ajustables (tiempos, aceleración, constantes de física y umbrales de detección). |
| `main.js` | Orquestador principal y bucle de renderizado (`requestAnimationFrame`). Conecta captura de cámara, detección, física, máquina de estados y dibujo. |
| `maquina-estados.js` | Lógica de estados pura (`ATRACCION`, `ENGANCHE`, `SORTEO`, `REVELACION`, `ESCENA`, `CIERRE`). No dibuja ni accede al DOM. |
| `vision.js` | Inicializador de los modelos WASM de MediaPipe Tasks Vision (`FaceLandmarker`, `HandLandmarker`, `PoseLandmarker`). |
| `camara.js` | Manejo de `navigator.mediaDevices.getUserMedia`, volteo horizontal y bucle de reintentos continuos en caso de desconexión. |
| `rostro.js` | Transforma los puntos landmarks de MediaPipe a coordenadas de pantalla (`{ centro, ojoIzq, ojoDer, radio, angulo, confianza }`). Soporta fuentes sintéticas y video grabado para desarrollo sin cámara. |
| `manos.js` | Extrae palmas, grado de apertura de la mano y radio de atracción magnética a partir de los puntos de la mano. |
| `pose.js` | Extrae puntos clave del cuerpo (hombros) como respaldo de posición. |
| `suavizado.js` | Filtros exponenciales (`crearFiltroExponencial`, `crearFiltroRostro`, `crearFiltroDeManos`) para eliminar el temblor de los landmarks, más la histéresis de presencia (`crearHisteresis`) y el rastreador de velocidad de los colisionadores. |
| `fisica.js` | Motor de física 2D custom: gravedad, rebote elástico con la cabeza, colisión con suelo/paredes y atracción magnética hacia las manos. |
| `objetos.js` | Pool de objetos reciclables con límite máximo dinámico (`CONFIG.objetos.maximo`) y gestión de tiempo de vida con desvanecido (*fade-out*). |
| `sorteo.js` | Gestor de sorteo aleatorio con algoritmo de **bolsa barajada sin repetición contigua**. |
| `niebla.js` | Animación de las nubes que cubren el espejo durante el reposo. Se apartan **hacia los costados**, no en círculo: cada jirón queda fijado a su mitad de pantalla al crearse y viaja hasta el borde exterior. La transición tiene una sola magnitud (`apertura`). |
| `figuras.js` | Sistema de fallback vectorial en Canvas 2D (36 figuras dibujadas por código para cuando no existen archivos PNG). |
| `efectos.js` | Sistema de partículas por carrera (engranajes, chispas, código binario, fórmulas matemáticas, planos técnicos, burbujas). |
| `imagenes.js` | Gestor y precargador de imágenes PNG con fallback elegante. |
| `contenido.js` | Carga y valida el archivo `contenido/carreras.json` al inicio del sistema. |
| `escena.js` | Componedor gráfico final: renderiza en capas (Video espejo → Efecto partículas → Objetos → Señal de manos → Niebla → Textos responsivos). Dueño además de la geometría video↔pantalla: `calcularRectanguloVideo` (dónde se dibuja) y `calcularRecorteVisible` (qué parte se analiza). |
| `operacion.js` | Atajos de teclado (incluida `TECLAS_CARRERA`, la fila de números completa: una tecla por carrera), panel HUD de métricas/FPS y recarga periódica de mantenimiento. |

---

## 4. Ciclo de Vida de la Máquina de Estados

La máquina de estados (`espejo/maquina-estados.js`) gobierna el flujo de la experiencia:

```
      ┌───────────── sin rostro 4 s, o tope de sesión ─────────────┐
      │                                                            │
      ▼          rostro continuo                    4 s            │
┌───────────┐        2 s        ┌───────────┐                ┌───────────┐
│ ATRACCION ├──────────────────►│ ENGANCHE  ├───────────────►│  SORTEO   │
└─────▲─────┘                   └───────────┘  se elige la   └─────┬─────┘
      │                                          carrera           │
      │ 3 s                                                        ▼ 4 s
┌─────┴─────┐   ausencia 4 s    ┌───────────┐                ┌───────────┐
│  CIERRE   │◄──────────────────┤  ESCENA   │◄───────────────┤REVELACION │
└───────────┘  o tope 180 s     └───────────┘  se abre la    └───────────┘
                                                 niebla
```

### El equilibrio de la presencia

Los tiempos de ausencia se suman a `presencia.msParaSalir` (2 s), que es el
colchón que absorbe los huecos de la detección **antes** de que lleguen a la
máquina. La tolerancia real es de unos **seis segundos**, y con el cierre el
espejo queda libre a los **nueve** de que alguien se levanta.

Ese número está en tensión entre dos quejas opuestas del stand, y las dos son
reales:

- **Corto de más:** le corta la escena a alguien que sigue sentado y sólo se
  perdió un momento. Con márgenes cortos, además, un rostro intermitente
  reiniciaba una y otra vez los dos segundos continuos del enganche, abriendo y
  cerrando las nubes sin llegar nunca al sorteo.
- **Largo de más:** la persona que se fue se lleva el espejo con ella, y quien
  espera su turno mira una escena ajena.

`tests/integracion/presencia.test.js` fija las dos puntas con la CONFIG de
verdad, para que mover una no rompa la otra en silencio.

> **Límite conocido:** por debajo de esos seis segundos el sistema no distingue a
> dos personas. Si una se levanta y otra se sienta muy rápido, la segunda hereda
> la carrera y el reloj de la primera. Separarlas de verdad pide comparar la
> posición y el tamaño del rostro entre la desaparición y la reaparición, no
> acortar plazos: acortarlos vuelve a cortarle la escena a quien no se movió.

El único evento que sale de la máquina es `{ tipo: 'entra', estado }`. La carrera
sorteada y el número de sesión viajan en la salida (`salida.carrera`,
`salida.sesion`) y se leen cuando hagan falta.

1. **`ATRACCION`**: Niebla completa sobre el espejo, video atenuado y desenfocado, texto de invitación pulsando. Nadie sentado. El pool de objetos se vacía al entrar.
2. **`ENGANCHE`**: Hay rostro estable. Exige **rostro continuo** durante `tiempos.enganche`: si parpadea, el contador vuelve a cero. El tope de sesión también vigila este estado, para que un rostro intermitente no lo deje trabado.
3. **`SORTEO`**: La niebla se agita (`niebla.agitacionSorteo`). Se extrae una carrera de la bolsa barajada, todavía con la niebla cerrada.
4. **`REVELACION`**: Las nubes se apartan hacia los costados y aparecen el nombre y la frase de la carrera. Se incrementa el número de sesión y empiezan a caer los objetos.
5. **`ESCENA`**: Siguen cayendo los objetos de la carrera. Las palmas atraen los objetos (modo imán). Dura mientras la persona permanezca sentada, con `sesionMaxima` como red de seguridad y rotación de la fila.
6. **`CIERRE`**: Desvanecido general de efecto y textos. Las nubes vuelven a cubrir el espejo, más lento de lo que se abrieron.

Una **pose** (los hombros) sostiene una sesión ya iniciada cuando la cara gira, pero no alcanza para iniciar una: para eso hace falta rostro. Son dos histéresis distintas sobre dos señales distintas.

---

## 5. Algoritmos Clave

### 5.1. Física e Interacción con Manos (`espejo/fisica.js` y `espejo/manos.js`)
El motor de física implementa dos comportamientos de interacción con las manos:

- **Modo Imán (Predeterminado):**
  - Las palmas generan un campo de fuerza hacia un **anillo de reposo** alrededor de la mano.
  - Fuera del anillo, la fuerza es de atracción; dentro del anillo, es de repulsión suave.
  - Los objetos capturados en el racimo aplican **fuerzas inelásticas de separación entre sí**, lo que permite que varios objetos descansen ordenadamente alrededor de las palmas sin amontonarse ni colapsar.
  - Las coordenadas de la palma se filtran mediante un suavizado lento (`manos.suavizadoDelIman`) para evitar que el racimo tiemble.

- **Modo Manotazo (Tecla `I`):**
  - La palma actúa como una esfera sólida de colisión elástica utilizando las coordenadas de detección crudas (sin filtro) para mantener la máxima capacidad de respuesta ante impulsos veloces del usuario.

### 5.2. Cadena de Fallback de Objetos
Para garantizar la solidez de la instalación, el dibujo de un objeto sigue una estrategia defensiva de tres niveles:
1. **Archivo PNG:** Se dibuja la ilustración PNG recortada si el recurso existe en `contenido/assets/` y cargó correctamente.
2. **Figura Vectorial (`espejo/figuras.js`):** Si el PNG no existe o falla, se dibuja un ícono vectorial generado por código Canvas 2D utilizando el color de la carrera. `npm run generar-pngs` puede generar rasterizaciones de respaldo sin sobrescribir las fotos reales.
3. **Círculo Genérico:** Si no existe ni el PNG ni la figura vectorial, se dibuja un círculo coloreado.
*Resultado:* El sistema nunca muestra errores en pantalla ni rompe la escena por falta de assets de diseño.

---

## 6. Garantías de Rendimiento y Presupuesto

### Los detectores miran el recorte, no la cámara

La cámara es apaisada (16:9) y el espejo es vertical (9:16), así que el video se dibuja *cubriendo*: entra entero de alto y le sobra muchísimo de ancho. Con 1280×720 en 1080×1920, **sólo se ve un tercio del ancho de la cámara**; los otros dos tercios no los mira nadie, nunca.

MediaPipe achica lo que le entra a un cuadro chico y fijo antes de correr el modelo. Darle el cuadro completo gastaba dos tercios de esa resolución en píxeles invisibles, y eso —no la resolución de la cámara— es lo que ponía el techo a la distancia de reconocimiento. Subir la cámara a 1080p no habría cambiado nada: el modelo achica igual.

Por eso `main.js` mantiene un lienzo de análisis con exactamente el recorte visible (`CONFIG.deteccion.altoAnalisis`) y se lo pasa a los tres detectores. Una cara lejana pasa a ocupar el triple del ancho analizado. Dos consecuencias más:

- El mapeo se simplifica: los puntos vienen normalizados sobre el recorte, que es la pantalla, así que el rectángulo de mapeo es la pantalla entera.
- Una mano fuera de cuadro deja de generar un atractor invisible: si no se ve, no interactúa.

El recorte se prepara **una vez por cuadro** y sólo si algún detector va a correr.

### Presupuestos
- Cada detector corre en su propio reloj, independiente del dibujo: rostro a **22 FPS**, manos a **34 FPS** (se mueven diez veces más rápido que una cabeza) y pose a **12 FPS**. Las manos además sólo se buscan durante `REVELACION` y `ESCENA`, que es cuando hay algo con qué interactuar: es el detector más caro del cuadro.
- Renderizado con tope de **60 FPS** (`CONFIG.render.fpsMaximo`). En una pantalla de 144 o 240 Hz, dibujar todos los cuadros es calor y consumo sin beneficio visible.
- Presupuesto máximo de objetos en pantalla: `CONFIG.objetos.maximo` (**24** por defecto). Los más antiguos se descartan y todos se desvanecen al cumplir `vidaMs`. El rendimiento no depende de cuánto tiempo lleve alguien sentado.
- Presupuesto fijo de partículas por efecto (`CONFIG.efectos.presupuesto`), por la misma razón.
- El `dt` de la física se acota a 50 ms: si el navegador se traba un instante, un salto grande mandaría los objetos atravesando el piso de un cuadro al otro.
- Recarga de mantenimiento automática: si el espejo está en `ATRACCION` tras el intervalo configurado (`CONFIG.operacion.recargaCadaMs`), la página se recarga para liberar memoria acumulada. Nunca corta una sesión en curso.
