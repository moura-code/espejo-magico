# Espejo Mágico — Documentación de Arquitectura

## 1. Visión General

El **Espejo Mágico** es una instalación interactiva para eventos y stands institucionales. Un visitante se ubica frente a un televisor montado verticalmente (enmarcado como espejo) con una cámara web superior. El sistema detecta su presencia, llena la pantalla de humo y, al disiparse, le ofrece un **carrusel con las doce ingenierías**, un objeto por cada una, que gira lento a su alrededor. La persona **sostiene la mano** sobre el que quiere y esa es su elección, una sola: los demás objetos se apagan y aparece el fondo de esa ingeniería detrás suyo —recortado contra su silueta— con el objeto volando a su lugar dentro del fondo y el nombre de la ingeniería al pie. Al aterrizar, aparecen escondidos en los costados del fondo los **otros tres objetos** de esa ingeniería, meciéndose apenas; pasando la mano sobre cualquiera de los cuatro se abre su **ficha**, con el nombre del objeto y una descripción corta.

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
| `maquina-estados.js` | Lógica de estados pura (`ATRACCION`, `ENGANCHE`, `HUMO`, `EXPLORACION`, `CIERRE`). No dibuja ni accede al DOM. |
| `vision.js` | Inicializador de los modelos WASM de MediaPipe Tasks Vision (`FaceLandmarker`, `HandLandmarker`, `PoseLandmarker`). |
| `camara.js` | Manejo de `navigator.mediaDevices.getUserMedia`, volteo horizontal y bucle de reintentos continuos en caso de desconexión. |
| `rostro.js` | Transforma los puntos landmarks de MediaPipe a coordenadas de pantalla (`{ centro, ojoIzq, ojoDer, radio, angulo, confianza }`). Soporta fuentes sintéticas y video grabado para desarrollo sin cámara. |
| `manos.js` | Extrae palmas, grado de apertura y radio a partir de los 21 puntos de la mano. El radio sale de la geometría (alcance promedio de las puntas desde el centro de la palma), no de constantes. |
| `pose.js` | Extrae hombros como respaldo de posición y la máscara de segmentación de la silueta. |
| `suavizado.js` | Filtros exponenciales (`crearFiltroExponencial`, `crearFiltroRostro`, `crearFiltroDeManos`) para eliminar el temblor de los landmarks, la histéresis de presencia (`crearHisteresis`) y el desvanecedor de la señal de las manos (`crearDesvanecedorDeManos`), que la prende y la apaga de a poco en vez de a los saltos de la detección. |
| `eleccion.js` | El **sostenido**: entra dónde están las manos y dónde están los blancos, sale sobre cuál está la mano, cuánto lleva y si ya alcanzó. No sabe qué es una carrera ni dibuja el anillo. |
| `tablero.js` | Dónde se para cada objeto: un anillo con todas las carreras, anclado a los hombros y con el radio proporcional al ancho de hombros, que gira despacio y del que sólo se ve la ventana de arriba. Sólo geometría. |
| `vuelo.js` | El viaje del objeto agarrado desde su ranura hasta su lugar en el fondo y su flotación una vez apoyado, y `lugarEnPantalla`, que pasa un lugar normalizado a la foto a la pantalla midiéndolo contra lo que se ve de ella. Sólo números. |
| `escondites.js` | Los objetos del fondo: qué lugar le toca a cada uno (`lugaresDelFondo`, `esconder`) y cómo se mecen los escondidos, cada uno a su ritmo (`balanceo`). Sólo números. |
| `fichas.js` | El hover de los objetos del fondo: qué ficha está abierta y cuánto se ve cada una. Abrir pide un momento, cerrar otro más largo, y pasar de una a otra es un fundido. No sabe qué es una ingeniería ni dibuja. |
| `silueta.js` | Traduce la máscara de MediaPipe —un byte de confianza por píxel, **sin canal alfa**— a una imagen blanca cuyo alfa es esa confianza, que es lo único que el lienzo puede usar para recortar. |
| `maite.js` | El único puente saliente. Va y no vuelve, nunca lanza, no reintenta y corta a los 1,5 s. |
| `humo.js` | Cuánto humo hay en cada momento (curva pura). Cargar el video es tarea de `videos.js`; dibujarlo, de `escena.js`. |
| `sorteo.js` | Gestor de sorteo aleatorio con **bolsa barajada sin repetición contigua**. `siguientes(n)` entrega el orden del carrusel: todas las jugables, barajadas por sesión. |
| `niebla.js` | Animación de las nubes que cubren el espejo durante el reposo. Se apartan **hacia los costados**, no en círculo: cada jirón queda fijado a su mitad de pantalla al crearse y viaja hasta el borde exterior. La transición tiene una sola magnitud (`apertura`). |
| `figuras.js` | Sistema de fallback vectorial en Canvas 2D (36 figuras dibujadas por código para cuando no existen archivos PNG). |
| `imagenes.js` | Gestor y precargador de imágenes con fallback elegante (objetos y fondos). |
| `videos.js` | Carga de videos en el navegador (con tope, para que uno que no contesta no frene el arranque) y el banco de **fondos con movimiento**: los carga de a uno después de arrancar y garantiza que **suene uno solo**, el de la ingeniería que se está mostrando. |
| `contenido.js` | Carga y valida `contenido/carreras.json` al inicio. El primero de `objetos` es el que va al carrusel (`objetoDeCarrera`) y los demás se esconden en el fondo (`escondidosDeCarrera`). |
| `escena.js` | Componedor gráfico final: renderiza en capas (Video espejo → Fondo de la carrera → Objetos escondidos y apoyado → Persona recortada → Carrusel con su carga → Objeto en vuelo → Señal de manos → Fichas → Nombre al pie → Humo → Niebla → Invitación y consignas). Dueño además de la geometría video↔pantalla: `calcularRectanguloVideo` (dónde se dibuja) y `calcularRecorteVisible` (qué parte se analiza), y de dónde va cada ficha (`disponerFicha`). |
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
└─────▲─────┘                   └───────────┘  se barajan    └─────┬─────┘
      │                                        las doce            │
      │ 3 s                                                        ▼
┌─────┴─────┐  sin rostro 4 s   ┌─────────────────────────────────────────┐
│  CIERRE   │◄──────────────────┤             EXPLORACION                 │
└───────────┘  o tope 180 s     │                                         │
      │                         │   mirar(id) ──► POST /api/carrera       │
      │                         │                                         │
      └── POST /api/humo        │   y de ahí en más mirar() no mueve nada  │
                                └─────────────────────────────────────────┘
                                  sin duración propia; a los 10 s sin que
                                  nadie agarre nada, refuerza la consigna;
                                  a los 30 s libera el espejo sin asignar
                                  una carrera
```

**Se elige una sola vez.** `mirar` no hace nada si ya hay `carrera`: la
ingeniería elegida por la persona se queda puesta hasta que se va. No hace
falta un estado "ya elegiste" para eso —lo dice `carrera`, que deja de ser
null— y la guarda vive en la máquina y no en quien dibuja: aunque en pantalla ya
no queden objetos, un `mirar` que llegara igual reiniciaría el reloj del fondo y
le mandaría otro aviso a MAITE. Lo que antes hacían `REVELACION` y `ESCENA` —el
fondo y el nombre entrando— es una transición **por ingeniería**, con su propio
reloj (`miraDesdeCuando`), no un tramo del ciclo.

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

De la máquina salen dos eventos: `{ tipo: 'entra', estado }` cuando cambia el
estado y `{ tipo: 'mira', carrera }` cuando cambia la ingeniería que se muestra.
Lo ofrecido, la carrera y el número de sesión viajan en la salida
(`salida.opciones`, `salida.carrera`, `salida.sesion`) y se leen cuando hagan
falta.

1. **`ATRACCION`**: El espejo descansa cubierto de humo (`CONFIG.humo.enReposo`) y de nubes, con el video atenuado y desenfocado y el texto de invitación respirando. Nadie sentado. Al entrar se le pide a MAITE que vuelva a su humo.
2. **`ENGANCHE`**: Hay rostro estable. Exige **rostro continuo** durante `tiempos.enganche`: si parpadea, el contador vuelve a cero. El tope de sesión también vigila este estado, para que un rostro intermitente no lo deje trabado.
3. **`HUMO`**: El video de humo entra y se espesa hasta tapar la pantalla. Detrás, las nubes se apartan y **se baraja el orden de las doce carreras** que se van a ofrecer en el carrusel. Ese margen le sirve al espejo para tener listos los PNG y los fondos, y como todavía no se ve nada, no se cuenta el final.
4. **`EXPLORACION`**: El humo se disipa y queda el carrusel girando despacio alrededor de los hombros: una ranura por carrera, cinco o seis a la vista. La persona sostiene la mano sobre uno, el carrusel se detiene, un anillo se llena y aparece esa ingeniería: el fondo, el objeto volando a su lugar dentro del fondo, y el nombre al pie. **Ahí se cierra la elección**: los demás objetos se apagan con el vuelo del elegido y el carrusel desaparece junto con su consigna. Al aterrizar, los otros tres objetos de la carrera aparecen escondidos en el fondo y la mano pasa a servir para otra cosa: pasándola sobre cualquiera de los cuatro se abre su ficha. El detector de manos sigue andando, a menos cuadros. La información se queda puesta el resto de la sesión. **No tiene duración propia:** dura mientras siga sentada. `tiempos.ayudaEleccion` (10 s) repite el gesto y `tiempos.eleccionMaxima` (30 s) libera el espejo sin revelar una carrera si nadie eligió.
5. **`CIERRE`**: Desvanecido general de objetos, fondo y textos. Las nubes vuelven a cubrir el espejo, más lento de lo que se abrieron.

**Lo que se muestra se le informa a la máquina desde afuera**, con
`mirar(id, ahora)`: la máquina no sabe qué es una mano. Sólo vale durante
`EXPLORACION` y **sólo la primera vez**; además, volver a pedir la misma tampoco
emite nada — con la mano quieta el sostenido se repite cuadro a cuadro, y sin
esa guarda MAITE recibiría cien avisos por segundo. La sesión se cuenta una sola
vez por persona, la primera vez que mira algo.

**El rostro es lo que sostiene la sesión.** Una pose (los hombros) ya no alcanza
para mantenerla viva con la cara girada: en cuanto la cara deja de reconocerse,
y pasado el colchón de la presencia, el espejo vuelve a su pantalla inicial y
queda libre para el que sigue en la fila. Siguen siendo dos histéresis sobre dos
señales distintas, pero la que manda es la del rostro.

---

## 5. Algoritmos Clave

### 5.1. El sostenido (`espejo/eleccion.js`)

Elegir sin tocar nada: la persona apoya la mano sobre un objeto y la mantiene ahí
`CONFIG.eleccion.msParaElegir` (3 s) mientras la carga se llena. Eran 1,5 s y la
cátedra pidió más "tiempo de carga": como se elige una sola vez, un gesto
apurado es una ingeniería que no se eligió del todo, y el brazo aguanta los tres
segundos porque el carrusel se detiene apenas empieza. Tres decisiones hacen que
se sienta bien, y las tres se descubrieron rompiéndose:

1. **Una pérdida corta no cuesta nada** (`msDeGracia`, 250 ms). La detección de
   manos se pierde varios cuadros por segundo con la mano de costado o mal
   iluminada — lo normal en un stand. Como vaciar el anillo es más rápido que
   llenarlo (y tiene que serlo, para que un roce no valga por una elección), sin
   gracia **un 25 % de cuadros perdidos convertía 1,5 s de sostenido en doce**. Es
   la misma idea que `presencia.msParaSalir` para el rostro: entrar rápido, salir
   lento.
2. **Pasada la gracia se vacía de a poco** (`msDeOlvido`, 1 s), no de golpe.
   Con un reset instantáneo, el temblor de la detección dejaba el anillo en cero
   una y otra vez y no se llenaba nunca.
3. **Cambiar de blanco empieza de cero.** Mover el brazo a otro objeto es
   deliberado: heredar lo acumulado haría que el segundo se eligiera al instante,
   y pasar por encima de uno camino a otro valdría por una elección. Como se
   elige una sola vez, ese roce sería la ingeniería con la que la persona se va.
   `eleccion.js` sigue soltando el blanco cuando la mano se mueve —es lo que hace
   que arrepentirse a mitad del sostenido funcione—; quedarse con una sola es
   tarea de la máquina de estados, no suya.

El blanco es generoso (`radioFactor`, 1,4 radios del objeto): es más fácil
disfrutar un blanco que perdona que uno exacto que te hace errar. Con blancos
superpuestos gana el más cercano al centro, no el primero de la lista.

**La carga es la misma para las doce** (`CONFIG.carga`): un anillo que avanza
como un reloj y un disco translúcido que se llena detrás del objeto, en el
dorado de los nombres de MAITE y con transparencia en cada parte. El color no
distingue a las ingenierías, que es lo que pidió la cátedra; las opciones que se
miraron están andando en `herramientas/colores.html`. La opacidad de quien
dibuja el anillo **multiplica** la suya: el carrusel se apaga desvaneciéndose y
el anillo del elegido se va con él. Cuando la pisaba, ese anillo quedaba entero
hasta el último cuadro del apagado y desaparecía de golpe.

### 5.2. El tablero (`espejo/tablero.js`)

**Los objetos NO van en posiciones fijas de la pantalla.** A dos metros de la
cámara el brazo alcanza apenas el tercio central del espejo: doce objetos
repartidos por el lienzo serían inalcanzables para quien está lejos y le taparían
la cara a quien está cerca.

Van en un **anillo** alrededor de los hombros, con el radio proporcional al
**ancho de hombros** — el mejor indicador de a qué distancia está sentada. Más
lejos: todo más chico y más junto. Más cerca: todo más grande y más abierto. **No
hay ningún umbral por distancia**: sale solo de la geometría. Sin pose, los
hombros se deducen del rostro.

**El anillo es un carrusel.** Tiene una ranura por carrera, separadas `360°/n`,
y gira despacio (`gradosPorSegundo`, 8°/s: vuelta entera en 45 s) en el sentido
de las flechas del boceto de la cátedra: sube por la izquierda, pasa por arriba,
baja por la derecha. De él sólo se ve la **ventana** (`desde` 190°, `hasta`
350°, por encima de la cabeza): cinco o seis objetos. El resto está "detrás del
marco": existe, gira y no se dibuja. Cada ranura sale con un `alfa` de ventana
—0 afuera, 1 adentro, una rampa de `gradosDeFundido` en cada borde— y **sólo son
blancos las ranuras enteras** (`alfa === 1`).

Cuatro detalles que no son decorativos:

- **El anillo se achica para entrar en el lienzo, no se recortan los puntos de
  a uno.** Recortar cada punto contra su borde deforma el anillo y amontona dos
  objetos en la misma esquina, que es justo lo que hace imposible elegir.
- **El radio se mide contra la ventana fija, no contra las ranuras.** Si
  dependiera de dónde está cada objeto, respiraría cuadro a cuadro con el giro.
- **El tamaño del objeto se acota a la cuerda entre vecinos**
  (`aireEntreObjetos`). Con doce a 30° y el radio achicado por el borde, dos
  objetos se encimaban y el de atrás quedaba inelegible.
- **`congelar` detiene el ancla y la rotación, y se pone apenas empieza un
  sostenido.** Estirar el brazo mueve los hombros, y si el anillo los siguiera,
  el blanco se correría de abajo de la propia mano; y si siguiera girando,
  elegir sería perseguir un objeto que se escapa. Es la pausa del carrusel que
  pidió la cátedra: sacar la mano antes de completar vacía el anillo y el
  carrusel sigue.

### 5.3. El fondo detrás de la persona (`espejo/silueta.js`)

La máscara de segmentación de MediaPipe viene como **un byte de confianza por
píxel, sin canal alfa**. Dibujada tal cual, el lienzo la ve opaca en todos lados
y `destination-in` no recorta nada. `silueta.js` la traduce a una imagen blanca
cuyo canal alfa **es** esa confianza, y con eso recortar la persona del espejo
para meter el fondo atrás es una sola operación del lienzo.

El borde queda suave porque la confianza también lo es, y eso es deseado: un
recorte de borde duro delata el truco, uno difuso se lee como profundidad.

La máscara *es* la imagen mientras hay fondo, así que la pose sube de 12 a
`CONFIG.pose.fpsConFondo` (20) mientras se muestra una ingeniería: a 12 cuadros por
segundo el borde va atrás del cuerpo y se ve el fondo pegado al hombro.

**Y si la máscara no está** —pose perdida, GPU lenta, modelo sin cargar— el fondo
se dibuja igual, más tenue y con el espejo apagado debajo
(`CONFIG.fondo.opacidadSinMascara`). Se pierde la profundidad; nunca queda una
pantalla en negro con público delante.

### 5.4. El fondo que se mueve (`espejo/videos.js`)

Un fondo puede ser una foto o un video. **El video no reemplaza a la foto: la
acompaña.** Cada fondo declara siempre su `img` —que en un fondo con movimiento
es un cuadro del propio video— y opcionalmente su `video`. El orden de
preferencia al dibujar es el mismo de siempre, con un escalón más arriba: video
cargado → foto → escena vectorial → color plano.

Tres cosas que sostienen esa promesa:

- **No se esperan al arrancar.** `main.js` lanza la precarga *después* del primer
  `requestAnimationFrame`, y no la aguarda. Un video pesa mil veces más que un
  PNG y nada de la experiencia depende de él; hasta que llega, se ve la foto del
  mismo fondo y no se nota el cambio.
- **Se cargan de a uno.** Doce descargas simultáneas compiten con la cámara y con
  MediaPipe justo mientras el espejo está arrancando.
- **Suena uno solo.** `mostrar(ruta)` arranca el de la ingeniería que se está
  mostrando y pausa el resto: doce videos decodificando a la vez no los aguanta
  ninguna placa, y once de ellos no se ven. Se llama en cada cuadro con la misma
  ruta, así que repetir la que ya suena no hace nada; volver a una ingeniería ya
  vista la arranca desde el principio.

Y una trampa que se descubre rompiéndose: **un `<video>` no tiene `width` ni
`height` útiles** —los suyos son `videoWidth`/`videoHeight`, y valen 0 hasta el
primer cuadro—. Por eso el fondo y el lugar del objeto se miden con `medidasDe`
(`escena.js`) y no con `.width`: con `width` el rectángulo sale del tamaño de la
pantalla, el fondo se dibuja estirado y el objeto se apoya en otro lado. Cuando
`medidasDe` devuelve null —el video todavía no decodificó un cuadro— el espejo
cae a la foto, que es exactamente lo que tiene que pasar.

### 5.5. El puente a MAITE (`espejo/maite.js`)

Un `POST` a `localhost:3000/api/carrera` con cada evento `mira` y otro a
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

### 5.6. Cadena de Fallback de Objetos
Para garantizar la solidez de la instalación, el dibujo de un objeto sigue una estrategia defensiva de tres niveles:
1. **Archivo PNG:** Se dibuja la ilustración PNG recortada si el recurso existe en `contenido/assets/` y cargó correctamente.
2. **Figura Vectorial (`espejo/figuras.js`):** Si el PNG no existe o falla, se dibuja un ícono vectorial generado por código Canvas 2D, en el color de la paleta (`CONFIG.paleta.nombre`). `npm run generar-pngs` puede generar rasterizaciones de respaldo sin sobrescribir las fotos reales.
3. **Círculo Genérico:** Si no existe ni el PNG ni la figura vectorial, se dibuja un círculo en el dorado de la paleta.
*Resultado:* El sistema nunca muestra errores en pantalla ni rompe la escena por falta de assets de diseño.

---

### 5.7. El objeto en su lugar (`espejo/vuelo.js`)

Al completarse el sostenido, el objeto **vuela de su ranura a su lugar en el
fondo** (`tiempos.vuelo`, 1 s, con easing e interpolando el tamaño) y se queda
ahí, flotando apenas (`fondo.flotar`), sobre un halo en el color de la paleta
(`fondo.haloDelLugar`). La flotación y el halo entran de a poco al aterrizar
(`fondo.msDeAterrizaje`): aparecer enteros en un cuadro era un salto justo en
el momento más mirado. Cada fondo declara `lugar: {x, y, escala}` **normalizado
a la imagen**: las fotos se preparan en 1080×1920, la medida del espejo, y ahí
un punto normalizado a la imagen cae exactamente en el sitio de la escena que
se eligió mirando. Sin `lugar` vale `CONFIG.fondo.lugarPorDefecto`.

**Los lugares se miden contra lo que se ve de la foto.** En el espejo es la foto
entera. En un lienzo de otra proporción —un monitor apaisado mientras se
desarrolla— la foto entra al ancho y sólo se ve su franja del medio: medido
contra la foto entera, el rincón de arriba elegido para el objeto caía por
encima del borde (el objeto "desaparecía" en las doce ingenierías), y
recortarlo contra el borde de a uno amontonaba ahí a todos los objetos de ese
costado, que con cuatro por fondo se pisaban. `lugarEnPantalla` ubica el lugar
sobre la parte visible de la foto y le da el tamaño de la composición vertical
puesta a la altura de la pantalla: la composición entera se conserva —arriba
sigue arriba, la periferia sigue siendo la periferia—, el objeto guarda la misma
proporción con la persona (que en apaisado también se ve más chica) y nada se
pisa que no se pisara en el espejo. `fondo.margenDelLugar` queda como seguro
contra el borde. `tests/integracion/fondos.test.js` lo fija con el catálogo
real en las dos orientaciones.

El origen se captura en el evento `mira` —la ranura en ese cuadro— porque el
carrusel sigue girando mientras el objeto vuela. Sin ranura a la vista (la red
de la fila, una carrera forzada por teclado) el objeto crece en su lugar desde
cero. **Mientras vuela va por delante de todo; al aterrizar pasa detrás de la
persona recortada**: integrado a la escena, y si la persona se inclina sobre ese
punto lo tapa, que es lo correcto. `calcularTransicionEscena` lleva la capa
`vuelo` junto a `fondo` y `contenido`.

### 5.8. Los objetos escondidos y sus fichas (`escondites.js`, `fichas.js`)

Cada ingeniería trae **cuatro objetos**, cada uno con su `nombre` y una
`descripcion` corta. El primero es el del carrusel y el que vuela a `lugar`; los
otros tres ya están en el fondo, cada uno en su **escondite** (`escondites` del
fondo, en el mismo orden que `objetos`). Aparecen cuando el elegido aterriza
—primero se sigue el vuelo— con la capa `escondidos` de
`calcularTransicionEscena`, y van **detrás de la persona**, como el apoyado.

- **En la periferia.** En el medio está la persona: un objeto ahí le taparía la
  cara o quedaría tapado por ella. `CONFIG.fondo.zonaDeLaPersona` (la cabeza y
  los hombros, normalizados al espejo) y el pie del nombre son zonas prohibidas,
  y `tests/integracion/fondos.test.js` lo vigila para cada fondo del catálogo, el
  respaldo vectorial y los lugares por defecto incluidos. También vigila que
  ninguno suba a la franja del cartel de las fichas y que los blancos de la
  mano de dos objetos (`fichas.radioFactor`) no se toquen: tocándose, yendo a
  buscar el de abajo se abría el de arriba. Todos los fondos usan la misma
  grilla, dos columnas pegadas a la cabeza y dos filas, con `escala` 0.24.
- **Se mecen apenas, cada uno a su ritmo** (`balanceo`,
  `CONFIG.escondidos.balanceo`): es el "pequeño movimiento para que la persona
  los pueda identificar" que pidió la cátedra. Cada objeto tiene otro período
  —`variacion` más lento que el anterior— y otra fase: tres meciéndose al
  unísono se leen como una animación pegada encima del fondo. Y el movimiento es
  continuo: uno a los saltos se lee como un parpadeo.
- **Cómo se ve cada uno, en una sola cuenta** (`aspectoDelObjeto`): cuánto se
  mece el escondido o flota el que llegó volando, y cuánto crece
  (`escondidos.resalte`), se calma (`escondidos.calmaAlLeer`) y se ilumina
  (`escondidos.haloAlLeer`) el que se está leyendo. La usan el espejo y
  `herramientas/fondos.html`, que tiene que mostrarle a la cátedra exactamente
  lo que hace el espejo: con la cuenta copiada en los dos, ajustar uno solo los
  separaba en silencio.
- **El que tiene la mano encima pasa delante de la persona.** Los objetos del
  fondo van detrás de la persona recortada, y la mano que va a buscar uno lo
  tapa. Apenas la mano lo toca —sin esperar a que se abra su ficha— se dibuja
  otra vez en una capa que se recorta contra la silueta antes de pegarse
  (`dibujarObjetosDelante`), y crece y se ilumina. Entra en `fichas.msDelante`
  (150 ms) y se sostiene la misma gracia que la ficha (`delante`, en
  `fichas.js`). Antes pasaba adelante recién con la ficha abierta, casi un
  segundo después, y mientras tanto la mano parecía atravesarlo. Aparece sólo
  donde la persona lo tapa: dibujado entero encima de sí mismo duplicaba la
  sombra y engrosaba los bordes del PNG.
- **La ficha.** Pasar la mano sobre cualquiera de los cuatro abre su ficha: el
  nombre en Muffaroo y la descripción en la sans, sobre un panel del negro de
  MAITE. `fichas.js` decide cuál está abierta y cuánto se ve cada una. Cada
  objeto se identifica por su lugar en `objetos` —con la ruta del PNG, dos
  objetos con la misma imagen compartirían la ficha— y los escondidos se pueden
  leer recién cuando se ven a medias (`fichas.alfaParaLeer`). Abrir pide
  `fichas.msParaMostrar` (300 ms) con la mano encima —si no, cada mano que pasa
  camino a otro lado abriría fichas en cadena— y cerrar pide `fichas.msDeGracia`
  (900 ms) sin ella, que absorbe los huecos de la detección y deja terminar de
  leer después de bajar la mano. Cada ficha tiene su alfa y va hacia 1 o hacia
  0 a su ritmo: pasar de un objeto a otro es un fundido cruzado, nunca un corte.
  Se lee sobre los objetos **quietos**, no sobre su vaivén: si el blanco se
  meciera con el objeto, la ficha se abriría y cerraría sola con la mano quieta
  en el borde.
- **Dónde va la ficha** (`disponerFicha`, en `escena.js`): en un cartel ancho
  arriba de la cabeza, de `zonaDeLaPersona[0].y0` para arriba y a lo ancho de la
  composición. Es la única franja que no le tapa la cara a nadie, y ahí la
  descripción entra en dos o tres renglones con letra grande. Antes iba al
  costado de su objeto, en la franja angosta de la periferia: con objetos
  grandes y una letra que se lea a dos metros, dos objetos y sus dos fichas por
  costado no entraban y la ficha de uno tapaba al otro. De cuál habla lo dice el
  objeto, que crece y se ilumina mientras se lee. El nombre se mide: si no entra
  en un renglón va en dos, y si una palabra sola no entra se achica. La letra
  (`fichas.tipografia`) es legibilidad a dos metros y se calibra en el stand; si
  una descripción no entrara en la franja, se achica sola antes que bajar hasta
  la cara. En un monitor apaisado el cartel y la letra se achican con la
  composición (`disposicion.unidad`), como los objetos.
  `tests/integracion/fichas.test.js` dispone todas las fichas del catálogo real,
  con una medida proporcional a la letra, y exige que entren enteras en la
  franja con la letra de la config —sin achicarse— y sin tapar a ningún objeto
  del fondo, en el espejo y en apaisado. Hasta dónde baja y con qué letra lo
  dice `fichaDelObjeto` (escondites.js), la misma en el espejo, en
  `herramientas/fondos.html` y en las pruebas.
- **Al alcance de la mano.** La periferia tira hacia arriba y hacia los costados,
  y el brazo de alguien sentado lejos no llega a todos lados: el carrusel se
  calibró para eso (`tablero.radioFactor`, en anchos de hombros).
  `tests/integracion/fondos.test.js` usa ese mismo brazo —desde el centro de los
  hombros— y la misma persona que la zona de la periferia: hombros donde empieza
  el cuerpo, 380 px de ancho como la de la prueba del sostenido (alguien sentado
  a unos 2 m o más). Exige que la mano llegue a los cuatro objetos de cada
  fondo, con la tolerancia de la ficha y un 10 % de brazo de sobra. Es un
  modelo, no una medición: la prueba del sostenido pone los hombros más abajo, y
  con esa persona a la mitad de los objetos de arriba no se llega; si en el
  stand la gente queda así en el cuadro, se recalibran juntas la zona y los
  lugares. En el stand se prueba con gente de verdad a 1,5 y 2 m.
- **Las manos siguen sirviendo.** Antes, elegida la ingeniería, se apagaba el
  detector de manos. Ahora sigue, a `manos.fpsExplorando` (12 FPS): con 300 ms
  para abrir y 900 de gracia, una ficha se conforma con pocos cuadros, y el resto
  se lo queda la silueta. Rostro, pose y manos corren en el mismo hilo y pueden
  coincidir en un cuadro: el costo real se mide con el panel (`P`) en la PC del
  evento. Una consigna enseña el gesto nuevo (*"Pasá la mano sobre
  los objetos del fondo"*): entra con la escena entera (capa `explorar`) y se va
  para siempre la primera vez que alguien abre una ficha.

### 5.9. Sin parpadeos

La cátedra pidió evitar cosas que parpadean. Todo lo que aparece o desaparece
lo hace con un fundido, y cada uno se descubrió mirando la experiencia cuadro a
cuadro:

- La consigna de la elección salía encendida de golpe encima del humo espeso: se
  multiplica por lo que ya se disipó.
- La invitación del reposo aparecía de golpe encima de las nubes que se cerraban
  y se iba de golpe cuando alguien se sentaba: entra en `tiempos.invitacion` y
  sale en la mitad. No es una capa de `calcularTransicionEscena` sino un
  desvanecedor que sigue al estado desde donde esté (`crearDesvanecedor`), como
  las nubes: calculada por estado, arrancaba entera en el enganche aunque el
  reposo hubiera durado menos que su entrada —alguien ya sentado al prender el
  espejo, o que se sienta apenas vuelven las nubes— y se prendía de golpe justo
  para irse.
- La señal de cada mano seguía al filtro, que suelta una mano perdida de golpe:
  `crearDesvanecedorDeManos` la prende y la apaga de a poco, y la señal entera se
  apaga con el carrusel y vuelve con los objetos escondidos.
- El anillo y el disco del objeto elegido se cortaban en el cuadro en que se
  completaba el sostenido: ahora se apagan con el carrusel.
- El objeto elegido aterrizaba y en el mismo cuadro aparecían el halo entero y
  la flotación en una fase cualquiera: los dos entran en `fondo.msDeAterrizaje`.
- Si el cierre llegaba en pleno vuelo —el tope de sesión, un `ESPACIO` en
  manual—, el objeto saltaba a su lugar con el fondo entero antes de apagarse: el
  cierre arranca desde donde quedó la exploración, cada capa con su reloj
  multiplicada por la salida, y el objeto termina de volar mientras se apaga.
- El borde de la ficha le dibujaba una raya a la base del pico, como si
  estuviera pegado con cinta: el panel se traza de una sola vez (y hoy ya no
  tiene pico: el cartel va arriba de la cabeza, no al lado de su objeto).

## 6. Garantías de Rendimiento y Presupuesto

### Los detectores miran el recorte, no la cámara

La cámara es apaisada (16:9) y el espejo es vertical (9:16), así que el video se dibuja *cubriendo*: entra entero de alto y le sobra muchísimo de ancho. Con 1280×720 en 1080×1920, **sólo se ve un tercio del ancho de la cámara**; los otros dos tercios no los mira nadie, nunca.

MediaPipe achica lo que le entra a un cuadro chico y fijo antes de correr el modelo. Darle el cuadro completo gastaba dos tercios de esa resolución en píxeles invisibles, y eso —no la resolución de la cámara— es lo que ponía el techo a la distancia de reconocimiento. Subir la cámara a 1080p no habría cambiado nada: el modelo achica igual.

Por eso `main.js` mantiene un lienzo de análisis con exactamente el recorte visible (`CONFIG.deteccion.altoAnalisis`) y se lo pasa a los tres detectores. Una cara lejana pasa a ocupar el triple del ancho analizado. Dos consecuencias más:

- El mapeo se simplifica: los puntos vienen normalizados sobre el recorte, que es la pantalla, así que el rectángulo de mapeo es la pantalla entera.
- Una mano fuera de cuadro deja de generar un atractor invisible: si no se ve, no interactúa.

El recorte se prepara **una vez por cuadro** y sólo si algún detector va a correr.

### Presupuestos
- Cada detector corre en su propio reloj, independiente del dibujo: rostro a **22 FPS**, manos a **34 FPS** (se mueven diez veces más rápido que una cabeza) y pose a **12 FPS**, que sube a **20** mientras hay fondo. Las manos además sólo se buscan durante `EXPLORACION`, que es cuando hacen algo, porque es el detector más caro del cuadro; y con la ingeniería ya elegida bajan a **12 FPS** (`manos.fpsExplorando`): abrir una ficha no pide la precisión de un sostenido. Los tres corren en el mismo hilo y empiezan escalonados para no concentrar el pico inicial. Si el panel detecta menos de 27 FPS durante 5 s, `rendimiento` pasa de `completo` a `equilibrado` y luego a `seguro`; sólo recupera calidad después de 10 s por encima de 35 FPS. Mientras el anillo de elección está activo no cambia de perfil. El perfil activo queda visible con `P`.
- La lectura de la máscara de segmentación cuesta un viaje de la GPU a la CPU, así que **sólo se arma cuando hay fondo** que meterle atrás a la persona.
- Renderizado con tope de **60 FPS** (`CONFIG.render.fpsMaximo`). En una pantalla de 144 o 240 Hz, dibujar todos los cuadros es calor y consumo sin beneficio visible.
- Los objetos en pantalla son a lo sumo **seis** en el carrusel, girando a 8°/s, y **cuatro** en el fondo: el rendimiento no depende de cuánto tiempo lleve alguien sentado. Las fichas miden su texto sólo mientras se ven.
- El salto de reloj del sostenido se acota a 250 ms: si el navegador se traba un instante, un salto grande completaría un sostenido que nadie hizo.
- Los fundidos —las fichas, la invitación, la señal de las manos— cuentan un cuadro como mucho 50 ms (`DT_MAXIMO`, el mismo tope que el paso de reloj de `main.js`): si el navegador se traba, se frenan en vez de saltar. Con 250 ms, un solo tirón se comía media salida de la invitación.
- Recarga de mantenimiento automática: si el espejo está en `ATRACCION` tras el intervalo configurado (`CONFIG.operacion.recargaCadaMs`), la página se recarga para liberar memoria acumulada. Nunca corta una sesión en curso.
