# Espejo Mágico — Documentación de Arquitectura

## 1. Visión General

El **Espejo Mágico** es una instalación interactiva para eventos y stands institucionales. Un visitante se ubica frente a un televisor montado verticalmente (enmarcado como espejo) con una cámara web superior. El sistema detecta su presencia, llena la pantalla de humo y, al disiparse, le ofrece **cinco objetos, uno por ingeniería**. La persona **sostiene la mano** sobre el que quiere y esa es su elección: aparece el fondo de esa ingeniería detrás suyo —recortado contra su silueta— con el nombre y la historia de alguien que la estudió.

Toda la experiencia vive en una sola pestaña de Chrome, en una sola PC. No hay segundas pantallas ni estado compartido. La única comunicación que sale es un aviso de ida a **MAITE**, el proyecto de las tablets, para que muestren a la gente de la carrera elegida — y el espejo funciona igual si del otro lado no hay nadie.

### Principios Fundamentales
1. **100% Offline (Sin Internet):** No existe dependencia de CDNs, APIs externas o servicios en la nube en tiempo de ejecución. El único destino de red es `localhost:3000`, en la misma máquina.
2. **Cero paso de compilación (No Bundler):** Módulos ES nativos en el navegador (`<script type="module">`).
3. **Privacidad absoluta:** El flujo de video de la cámara se procesa exclusivamente en la memoria RAM del navegador local. Ninguna imagen se graba, almacena o transmite.
4. **Desacoplamiento estricto de módulos:** Cada módulo tiene responsabilidades únicas y se puede probar de forma independiente sin necesidad de DOM, cámara o pantalla real.
5. **Ninguna dependencia externa puede romper la experiencia:** el puente a MAITE, la detección de manos, la de pose y el video de humo son todos agregados opcionales. Si cualquiera falla, el espejo sigue funcionando y lo único que queda es un `console.warn`.

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
                    │  │   ├── Tablero + sostenido           │  │
                    │  │   └── Renderizador Canvas 2D        │  │
                    │  └────────┬──────────────────┬─────────┘  │
                    │           │                  │            │
                    │  HTTP     ▼   solo archivos  │  POST      │
                    │  ┌─────────────────────────┐ │  de ida    │
                    │  │ servidor/servidor.js    │ │            │
                    │  │  - Archivos estáticos   │ │            │
                    │  │  - Cero dependencias    │ │            │
                    │  └─────────────────────────┘ │            │
                    │                              ▼            │
                    │  ┌─────────────────────────────────────┐  │
                    │  │ MAITE :3000 (proyecto aparte)       │  │
                    │  │  POST /api/carrera { carreraId }    │  │
                    │  │  POST /api/humo                     │  │
                    │  └──────────────────┬──────────────────┘  │
                    └─────────────────────┼─────────────────────┘
                                          ▼ WiFi del stand
                                    tablets con retratos
```

El puente a MAITE es **de ida y nada más**: el espejo no lee nada de vuelta, no
espera su respuesta y no comparte estado con él. Corta a los 1,5 s, no reintenta
y nunca lanza. Se apaga entero con `CONFIG.maite.activo`.

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
| `config.js` | Única fuente de verdad para parámetros ajustables (tiempos, geometría del tablero, plazos del sostenido y umbrales de detección). |
| `main.js` | Orquestador principal y bucle de renderizado (`requestAnimationFrame`). Conecta captura de cámara, detección, elección, máquina de estados y dibujo. |
| `maquina-estados.js` | Lógica de estados pura (`ATRACCION`, `ENGANCHE`, `HUMO`, `ELECCION`, `REVELACION`, `ESCENA`, `CIERRE`). No dibuja ni accede al DOM. |
| `vision.js` | Inicializador de los modelos WASM de MediaPipe Tasks Vision (`FaceLandmarker`, `HandLandmarker`, `PoseLandmarker`). |
| `camara.js` | Manejo de `navigator.mediaDevices.getUserMedia`, volteo horizontal y bucle de reintentos continuos en caso de desconexión. |
| `rostro.js` | Transforma los puntos landmarks de MediaPipe a coordenadas de pantalla (`{ centro, ojoIzq, ojoDer, radio, angulo, confianza }`). Soporta fuentes sintéticas y video grabado para desarrollo sin cámara. |
| `manos.js` | Extrae palmas, grado de apertura y radio a partir de los 21 puntos de la mano. El radio sale de la geometría (alcance promedio de las puntas desde el centro de la palma), no de constantes. |
| `pose.js` | Extrae hombros como respaldo de posición y la máscara de segmentación de la silueta. |
| `suavizado.js` | Filtros exponenciales (`crearFiltroExponencial`, `crearFiltroRostro`, `crearFiltroDeManos`) para eliminar el temblor de los landmarks, más la histéresis de presencia (`crearHisteresis`). |
| `eleccion.js` | El **sostenido**: entra dónde están las manos y dónde están los blancos, sale sobre cuál está la mano, cuánto lleva y si ya alcanzó. No sabe qué es una carrera ni dibuja el anillo. |
| `tablero.js` | Dónde se para cada objeto: un arco anclado a los hombros, con el radio proporcional al ancho de hombros. Sólo geometría. |
| `silueta.js` | Traduce la máscara de MediaPipe —un byte de confianza por píxel, **sin canal alfa**— a una imagen blanca cuyo alfa es esa confianza, que es lo único que el lienzo puede usar para recortar. |
| `maite.js` | El único puente saliente. Va y no vuelve, nunca lanza, no reintenta y corta a los 1,5 s. |
| `humo.js` | Cuánto humo hay en cada momento (curva pura) y la carga del video. Dibujarlo es tarea de `escena.js`. |
| `sorteo.js` | Gestor de sorteo aleatorio con **bolsa barajada sin repetición contigua**. `siguientes(n)` entrega las cinco que se ofrecen, sin repetir entre sí. |
| `niebla.js` | Animación de las nubes que cubren el espejo durante el reposo. Se apartan **hacia los costados**, no en círculo: cada jirón queda fijado a su mitad de pantalla al crearse y viaja hasta el borde exterior. La transición tiene una sola magnitud (`apertura`). |
| `figuras.js` | Sistema de fallback vectorial en Canvas 2D (36 figuras dibujadas por código para cuando no existen archivos PNG). |
| `imagenes.js` | Gestor y precargador de imágenes con fallback elegante (objetos y fondos). |
| `contenido.js` | Carga y valida `contenido/carreras.json` al inicio, y decide qué objeto representa a cada carrera. |
| `escena.js` | Componedor gráfico final: renderiza en capas (Video espejo → Fondo de la carrera → Persona recortada → Objetos y anillo → Señal de manos → Ficha de la persona → Humo → Niebla). Dueño además de la geometría video↔pantalla: `calcularRectanguloVideo` (dónde se dibuja) y `calcularRecorteVisible` (qué parte se analiza). |
| `operacion.js` | Atajos de teclado (incluida `TECLAS_CARRERA`, la fila de números completa: una tecla por carrera), panel HUD de métricas/FPS y recarga periódica de mantenimiento. |

---

## 4. Ciclo de Vida de la Máquina de Estados

La máquina de estados (`espejo/maquina-estados.js`) gobierna el flujo de la experiencia:

```
      ┌────────── sin rostro 4 s, o tope de sesión (180 s) ─────────┐
      │                                                            │
      ▼          rostro continuo                    3 s            │
┌───────────┐        2 s        ┌───────────┐                ┌───────────┐
│ ATRACCION ├──────────────────►│ ENGANCHE  ├───────────────►│   HUMO    │
└─────▲─────┘                   └───────────┘  se sortean    └─────┬─────┘
      │                                        las cinco           │
      │ 3 s                                                        ▼
┌─────┴─────┐   ausencia 4 s    ┌───────────┐   2,5 s       ┌───────────┐
│  CIERRE   │◄──────────────────┤  ESCENA   │◄──────────────┤ ELECCION  │
└───────────┘  o tope 180 s     └─────▲─────┘               └─────┬─────┘
      │                               │                           │
      │                         ┌───────────┐   elegir(id)        │
      └── POST /api/humo        │REVELACION │◄────────────────────┘
                                └───────────┘   o tope 30 s
                                      │
                                      └── POST /api/carrera
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
  cerrando las nubes sin llegar nunca a ofrecerle nada.
- **Largo de más:** la persona que se fue se lleva el espejo con ella, y quien
  espera su turno mira una escena ajena.

`tests/integracion/presencia.test.js` fija las dos puntas con la CONFIG de
verdad, para que mover una no rompa la otra en silencio.

> **Límite conocido:** por debajo de esos seis segundos el sistema no distingue a
> dos personas. Si una se levanta y otra se sienta muy rápido, la segunda hereda
> la carrera y el reloj de la primera. Separarlas de verdad pide comparar la
> posición y el tamaño del rostro entre la desaparición y la reaparición, no
> acortar plazos: acortarlos vuelve a cortarle la escena a quien no se movió.

El único evento que sale de la máquina es `{ tipo: 'entra', estado }`. Lo ofrecido,
la carrera elegida y el número de sesión viajan en la salida (`salida.opciones`,
`salida.carrera`, `salida.sesion`) y se leen cuando hagan falta.

1. **`ATRACCION`**: Niebla completa sobre el espejo, video atenuado y desenfocado, texto de invitación pulsando. Nadie sentado. Al entrar se le pide a MAITE que vuelva a su humo.
2. **`ENGANCHE`**: Hay rostro estable. Exige **rostro continuo** durante `tiempos.enganche`: si parpadea, el contador vuelve a cero. El tope de sesión también vigila este estado, para que un rostro intermitente no lo deje trabado.
3. **`HUMO`**: El video de humo entra y se espesa hasta tapar la pantalla. Detrás, las nubes se apartan y **se sortean las cinco carreras** que se van a ofrecer. Ese margen le sirve al espejo para tener listos los PNG y los fondos, y como todavía no se ve nada, no se cuenta el final.
4. **`ELECCION`**: El humo se disipa y quedan los cinco objetos en arco alrededor de los hombros. La persona sostiene la mano sobre uno y un anillo se llena. **No tiene duración propia:** termina cuando elige. `tiempos.eleccionMaxima` (30 s) es la red de seguridad de la fila — al vencerse se revela la primera de la lista, que como viene barajada ya es un sorteo.
5. **`REVELACION`**: El objeto elegido viaja al borde superior mientras los otros cuatro se apagan; entran el fondo de la carrera, el nombre y la ficha de la persona. Se incrementa el número de sesión y **se le avisa a MAITE**.
6. **`ESCENA`**: La composición completa: fondo de la carrera, la persona recortada encima, su nombre y su historia. Dura mientras permanezca sentada, con `sesionMaxima` como red de seguridad y rotación de la fila.
7. **`CIERRE`**: Desvanecido general de fondo y textos. Las nubes vuelven a cubrir el espejo, más lento de lo que se abrieron.

**La elección se le informa a la máquina desde afuera**, con `elegir(id, ahora)`:
la máquina no sabe qué es una mano. Sólo vale durante `ELECCION` — al elegir la
mano sigue puesta un rato, y sin esa guarda el cuadro siguiente reiniciaría la
revelación y contaría una sesión de más.

Una **pose** (los hombros) sostiene una sesión ya iniciada cuando la cara gira, pero no alcanza para iniciar una: para eso hace falta rostro. Son dos histéresis distintas sobre dos señales distintas.

---

## 5. Algoritmos Clave

### 5.1. El sostenido (`espejo/eleccion.js`)

Elegir sin tocar nada: la persona apoya la mano sobre un objeto y la mantiene ahí
`CONFIG.eleccion.msParaElegir` (1,5 s) mientras un anillo se llena. Tres
decisiones hacen que se sienta bien, y las tres se descubrieron rompiéndose:

1. **Una pérdida corta no cuesta nada** (`msDeGracia`, 250 ms). La detección de
   manos se pierde varios cuadros por segundo con la mano de costado o mal
   iluminada — lo normal en un stand. Como vaciar el anillo es más rápido que
   llenarlo (y tiene que serlo, para que un roce no valga por una elección), sin
   gracia **un 25 % de cuadros perdidos convertía 1,5 s de sostenido en doce**. Es
   la misma idea que `presencia.msParaSalir` para el rostro: entrar rápido, salir
   lento.
2. **Pasada la gracia se vacía de a poco** (`msDeOlvido`, 600 ms), no de golpe.
   Con un reset instantáneo, el temblor de la detección dejaba el anillo en cero
   una y otra vez y no se llenaba nunca.
3. **Cambiar de blanco empieza de cero.** Mover el brazo a otro objeto es
   deliberado: heredar lo acumulado haría que el segundo se eligiera al instante.

El blanco es generoso (`radioFactor`, 1,4 radios del objeto): es más fácil
disfrutar un blanco que perdona que uno exacto que te hace errar. Con blancos
superpuestos gana el más cercano al centro, no el primero de la lista.

### 5.2. El tablero (`espejo/tablero.js`)

**Los objetos NO van en posiciones fijas de la pantalla.** A dos metros de la
cámara el brazo alcanza apenas el tercio central del espejo: cinco objetos
repartidos por el lienzo serían inalcanzables para quien está lejos y le taparían
la cara a quien está cerca.

Van en un arco alrededor de los hombros (`desde` 200°, `hasta` 340°, por encima
de la cabeza), con el radio proporcional al **ancho de hombros** — el mejor
indicador de a qué distancia está sentada. Más lejos: todo más chico y más junto.
Más cerca: todo más grande y más abierto. **No hay ningún umbral por distancia**:
sale solo de la geometría. Sin pose, los hombros se deducen del rostro.

Dos detalles que no son decorativos:

- **El arco se achica para entrar en el lienzo, no se recortan los puntos de a
  uno.** Recortar cada punto contra su borde deforma el arco y amontona dos
  objetos en la misma esquina, que es justo lo que hace imposible elegir.
- **El arco se congela apenas empieza un sostenido.** Estirar el brazo mueve los
  hombros, y si el arco los siguiera, el blanco se correría de abajo de la propia
  mano: elegir sería perseguir un objeto que se escapa.

### 5.3. El fondo detrás de la persona (`espejo/silueta.js`)

La máscara de segmentación de MediaPipe viene como **un byte de confianza por
píxel, sin canal alfa**. Dibujada tal cual, el lienzo la ve opaca en todos lados
y `destination-in` no recorta nada. `silueta.js` la traduce a una imagen blanca
cuyo canal alfa **es** esa confianza, y con eso recortar la persona del espejo
para meter el fondo atrás es una sola operación del lienzo.

El borde queda suave porque la confianza también lo es, y eso es deseado: un
recorte de borde duro delata el truco, uno difuso se lee como profundidad.

La máscara *es* la imagen mientras hay fondo, así que la pose sube de 12 a
`CONFIG.pose.fpsConFondo` (20) en `REVELACION` y `ESCENA`: a 12 cuadros por
segundo el borde va atrás del cuerpo y se ve el fondo pegado al hombro.

**Y si la máscara no está** —pose perdida, GPU lenta, modelo sin cargar— el fondo
se dibuja igual, más tenue y con el espejo apagado debajo
(`CONFIG.fondo.opacidadSinMascara`). Se pierde la profundidad; nunca queda una
pantalla en negro con público delante.

### 5.4. El puente a MAITE (`espejo/maite.js`)

Un `POST` a `localhost:3000/api/carrera` al entrar en `REVELACION` y otro a
`/api/humo` al volver a `ATRACCION`. El id que viaja es **el de MAITE**, no el
del espejo: los dos catálogos crecieron por separado y `computacion` acá es
`sistemas` allá. Eso se declara en el campo `maite` de cada carrera; en `null`,
la carrera no se ofrece.

**La regla que no se negocia: esto nunca puede romper el espejo.** Un intento,
`AbortController` a 1,5 s, y seguir. Sin reintentos, sin cola, sin estado
compartido, y nunca lanza — si lanzara se llevaría puesto el bucle de dibujo y el
espejo quedaría congelado porque una tablet no contestó.

Del lado de MAITE hace falta un middleware de CORS: el espejo corre en otro
puerto de la misma máquina, así que sin él el navegador ni siquiera manda la
petición — muere en el preflight `OPTIONS`.

### 5.5. Cadena de Fallback de Objetos
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
- Cada detector corre en su propio reloj, independiente del dibujo: rostro a **22 FPS**, manos a **34 FPS** (se mueven diez veces más rápido que una cabeza) y pose a **12 FPS**, que sube a **20** mientras hay fondo. Las manos además sólo se buscan durante `ELECCION`, que es el único momento en que hacen algo: es el detector más caro del cuadro.
- La lectura de la máscara de segmentación cuesta un viaje de la GPU a la CPU, así que **sólo se arma cuando hay fondo** que meterle atrás a la persona.
- Renderizado con tope de **60 FPS** (`CONFIG.render.fpsMaximo`). En una pantalla de 144 o 240 Hz, dibujar todos los cuadros es calor y consumo sin beneficio visible.
- Los objetos en pantalla son siempre **cinco**, quietos: el rendimiento no depende de cuánto tiempo lleve alguien sentado.
- El salto de reloj del sostenido se acota a 250 ms: si el navegador se traba un instante, un salto grande completaría un sostenido que nadie hizo.
- Recarga de mantenimiento automática: si el espejo está en `ATRACCION` tras el intervalo configurado (`CONFIG.operacion.recargaCadaMs`), la página se recarga para liberar memoria acumulada. Nunca corta una sesión en curso.
