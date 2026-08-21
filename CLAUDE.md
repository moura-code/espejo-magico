# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Instalación interactiva para el stand de una Facultad de Ingeniería: un espejo (pantalla + cámara) que descansa cubierto de nubes detecta el rostro del visitante, se llena de humo, y al disiparse le ofrece **cinco objetos, uno por ingeniería**. La persona **sostiene la mano** sobre el que quiere —un anillo se llena mientras la mantiene ahí— y esa es su elección: aparece el fondo de esa ingeniería detrás suyo (recortado contra su silueta), con el nombre y la historia de alguien que la estudió. En ese momento el espejo le avisa a **MAITE** —el proyecto de las tablets, en `localhost:3000`— para que los retratos del stand muestren a la gente de esa carrera.

Todo corre en una sola pestaña de Chrome, en una sola PC, **sin conexión a internet**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Toda la suite (vitest, entorno node). Tiene que estar en verde siempre. Incluye `tests/integracion/sintaxis.test.js`, la única red de `main.js` —que ninguna prueba importa porque es cableado del DOM—: parsea todos los módulos con `node --check` y además verifica que **cada import apunte a un export que exista**, que es el error más fácil de cometer al refactorizar y revienta recién en el navegador. |
| `npx vitest run tests/espejo/eleccion.test.js` | Una sola suite. `npm run test:mirar` para modo watch. |
| `npm run listo` | Semáforo de contenido: los 73 PNG, los doce fondos, el video de humo, las doce carreras, que cada `maite` exista del otro lado y MediaPipe vendorizado. **Hoy está en rojo a propósito**: falta escribir los nombres y textos reales de las personas en `carreras.json` (están los de fábrica, "Nombre y Apellido"). Corre `tests/listo/`, excluido de `npm test` a propósito: depende de archivos que pueden faltar en una máquina de desarrollo. |
| `npm start` | Servidor en :8080. El espejo se abre por `http://localhost:8080/espejo/espejo.html` — **nunca por IP ni por `file://`**: Chrome solo entrega la cámara en contextos seguros, y esa es la única razón por la que hay un servidor. |
| `npm run vendorizar` | Copia MediaPipe a `vendor/` y baja los modelos. Único paso que necesita red; se corre una sola vez. |
| `npm run generar-pngs` | Genera con el Chrome local (sin red) un PNG de respaldo desde la figura vectorial para cada objeto sin imagen; nunca pisa un PNG existente. Los objetos reales son fotos de Wikimedia Commons con el fondo recortado: autor y licencia por archivo en `contenido/assets/CREDITOS.md`. |
| `npm run generar-fondos` | Genera un fondo de respaldo por carrera: un degradado de su color, escrito a mano con `zlib` (ni Chrome ni red — un degradado no justifica levantar un navegador). Nunca pisa un fondo existente. |

No hay build ni lint: módulos ES nativos servidos tal cual, sin bundler. Mantenerlo así. En la PC del evento (Windows) se arranca con `herramientas/arrancar.bat`.

## Idioma

Todo en castellano: identificadores, comentarios, pruebas, docs y mensajes de commit. Convención ortográfica: **identificadores y comentarios sin tildes** (`atraccion`, `// la señal llega limpia` — la ñ sí va); strings visibles al usuario y markdown con ortografía completa (`'MediaPipe no cargó'`).

## Arquitectura

Dos piezas, y una de las dos casi no hace nada:

- **`servidor/servidor.js`** — archivos estáticos, y nada más. Sin lógica de negocio y **sin dependencias**: sólo importa módulos `node:`. Existe únicamente porque Chrome no entrega la cámara fuera de un contexto seguro.
- **`espejo/`** — toda la inteligencia. `main.js` es solo cableado: decide qué módulo habla con cuál y en qué orden se dibuja; nada probable vive ahí. Expone `window.espejo` (avanzar, forzarCarrera, cambiarModo…) para operar desde la consola.

**El único hilo que sale de esta PC es el aviso a MAITE**, y es de ida: un `POST` a `localhost:3000` cuando alguien elige, y otro cuando la sesión termina. No hay protocolo propio, no hay WebSocket, no hay estado compartido y el espejo no lee nada de vuelta. Si aparece la tentación de agregar un segundo cliente o de hacer que el espejo dependa de una respuesta, revisar primero si de verdad hace falta: la instalación se simplificó a propósito sacando las tablets del proyecto, el WebSocket y `comun/protocolo.js`, y ese aviso de una línea es todo lo que hizo falta para volver a coordinarlas.

### La máquina de estados (`espejo/maquina-estados.js`)

El ciclo: `ATRACCION → ENGANCHE → HUMO → ELECCION → REVELACION → ESCENA → CIERRE → ATRACCION`. Recibe `{puedeIniciar, hayPersona, ahora}` y devuelve `{estado, opciones, carrera, sesion, eventos}`; no dibuja, no conoce cámaras y por eso se prueba entera sin nada. El único evento es `{tipo: 'entra', estado}`.

Las cinco carreras que se ofrecen (`opciones`) se sortean al entrar a HUMO, mientras el humo tapa la pantalla: ese margen le sirve al espejo para tener listos los PNG y los fondos, y como todavía no se ve nada tampoco se cuenta el final. `carrera` queda en null hasta que la persona elige.

**La elección se le informa a la máquina desde afuera**, con `elegir(id, ahora)`: la máquina no sabe qué es una mano. Solo vale durante ELECCION — al elegir la mano sigue puesta, y sin esa guarda el cuadro siguiente reiniciaría la revelación y contaría una sesión de más.

**ELECCION tiene tope propio** (`tiempos.eleccionMaxima`, 30 s) y al vencerse revela `opciones[0]`. No es un temporizador de la experiencia: es la red de seguridad de la fila. Sin él, quien no entiende el gesto deja el espejo tomado hasta el tope de sesión, tres minutos después. Y como lo ofrecido viene barajado, tomar el primero ya es un sorteo: nadie se va sin ingeniería.

Dos histéresis sobre dos señales distintas: el rostro es lo que **arranca** una sesión (`puedeIniciar`), rostro-o-pose es lo que la **sostiene** (`hayPersona`), así los hombros la mantienen viva cuando la cara gira. `sesionMaxima` es la red de seguridad y vigila también el ENGANCHE, para que un rostro intermitente no lo deje trabado.

### Contratos entre módulos de `espejo/`

La regla de corte: cada archivo se tiene que poder entender y probar solo.

- `rostro.js` no sabe qué es una carrera. `maquina-estados.js` no dibuja. `escena.js` no sabe que existe MediaPipe. `eleccion.js` no sabe qué es una ingeniería. `tablero.js` solo conoce arcos y círculos. `maite.js` no sabe qué es un estado.
- Todo lo externo se inyecta: el reloj entra como parámetro `ahora` (nunca `Date.now()` dentro de la lógica), y `sortear`, `obtenerMedia`, `cargar`, `azar` se pasan como funciones. Por eso las pruebas corren en Node sin cámara, sin pantalla y sin fake timers.
- `vision.js` carga el WASM de MediaPipe una sola vez para los tres detectores (rostro, manos, pose). Manos y pose son agregados opcionales: si su modelo falta o no carga, el espejo sigue andando con la cabeza sola. Por eso `npm run listo` verifica que los tres `.task` estén: si no, la falla es un `console.warn` que nadie mira.
- **Los detectores no reciben el `<video>`: reciben un lienzo con el recorte de lo que se ve en pantalla.** Cámara apaisada en espejo vertical significa que dos tercios del ancho de la cámara no se ven nunca; analizarlos gastaba la resolución del modelo en píxeles invisibles y era el techo real de la distancia de reconocimiento. `calcularRectanguloVideo` (dónde se dibuja) y `calcularRecorteVisible` (qué se analiza) tienen que salir siempre del mismo rectángulo — si alguno se calcula por su cuenta, los marcadores se van de la cara.
- **La estabilidad de la sesión vive entre dos módulos, no en uno.** `CONFIG.presencia.msParaSalir` es el colchón que absorbe los huecos de la detección antes de que lleguen a la máquina; `CONFIG.tiempos.ausenciaParaCortar` es lo que la máquina aguanta después. Los dos están en tensión y ninguno se toca solo: **cortos de más** le cortan la escena a alguien que sigue sentado, **largos de más** dejan que quien se fue se lleve el espejo y el siguiente en la fila mire una escena ajena. `tests/integracion/presencia.test.js` fija las dos puntas con la CONFIG de verdad. Límite conocido y documentado: por debajo de esos ~6 s el sistema no distingue a dos personas y un relevo rápido hereda la sesión.

### La elección (`eleccion.js` + `tablero.js`)

Es la parte nueva y la que más fácil se rompe al calibrar. `tests/integracion/eleccion.test.js` arma la cadena entera —pose → tablero → elección → máquina— con la CONFIG de verdad.

- **Los objetos NO van en posiciones fijas de la pantalla.** A dos metros de la cámara el brazo alcanza apenas el tercio central del espejo: cinco objetos repartidos por el lienzo serían inalcanzables para quien está lejos y le taparían la cara a quien está cerca. Van en arco alrededor de los hombros, con el radio proporcional al ancho de hombros — el mejor indicador de a qué distancia está sentada. No hay ningún umbral por distancia: sale solo de la geometría.
- **El arco se congela apenas empieza un sostenido.** Estirar el brazo mueve los hombros, y si el arco los siguiera el blanco se correría de abajo de la propia mano: elegir sería perseguir un objeto que se escapa.
- **`CONFIG.eleccion.msDeGracia` no es un detalle, es lo que hace usable el gesto.** La detección de manos se pierde varios cuadros por segundo con la mano de costado o mal iluminada. Como vaciar el anillo es más rápido que llenarlo (`msDeOlvido` < `msParaElegir`, y tiene que serlo para que un roce no valga por una elección), sin gracia un 25 % de cuadros perdidos convertía 1,5 s de sostenido en **doce**. Es la misma idea que `presencia.msParaSalir` para el rostro —entrar rápido, salir lento— aplicada a la mano.
- El sorteo entrega cinco **sin repetir entre sí**: dos objetos de la misma ingeniería en la misma pantalla se leen como un error del sistema, no como una opción.

### El fondo detrás de la persona

`pose.segmentacion` está en `true` y `silueta.js` traduce la máscara de MediaPipe —un byte de confianza por píxel, **sin canal alfa**— a una imagen blanca cuyo alfa es esa confianza. Sin esa traducción el lienzo la ve opaca en todos lados y `destination-in` no recorta nada.

La máscara ES la imagen mientras hay fondo, así que la pose sube a `fpsConFondo` en REVELACION y ESCENA: a 12 cuadros por segundo el borde de la silueta va atrás del cuerpo y se ve el fondo pegado al hombro.

**Y si la máscara no está** —pose perdida, GPU lenta, modelo sin cargar— el fondo se dibuja igual, más tenue y con el espejo apagado debajo (`CONFIG.fondo.opacidadSinMascara`). Se pierde la profundidad, nunca queda una pantalla en negro con público delante.

## Reglas del proyecto

- **Sin internet en el evento.** Nada puede referenciar un CDN ni una URL externa en tiempo de ejecución; `herramientas/vendorizar.mjs` es el único código que toca la red.
- **Un solo puente saliente, y opcional.** El espejo le avisa a MAITE qué carrera se eligió (`POST localhost:3000/api/carrera`) y cuándo terminó la sesión (`POST /api/humo`). Va y no vuelve: el espejo no lee nada de MAITE, no espera su respuesta y no comparte estado con él. **La regla que no se negocia: esto nunca puede romper el espejo.** Si MAITE no está levantado, tarda o contesta cualquier cosa, la experiencia sigue igual y lo único que queda es un `console.warn`. Por eso `maite.js` no tiene reintentos, no tiene cola, corta a los 1,5 s y nunca lanza. Se apaga entero con `CONFIG.maite.activo`.
- **Los ids de las carreras no coinciden entre los dos proyectos** y se resuelve con dato, no con código: cada carrera declara su `maite` en `carreras.json` (`computacion` → `sistemas`, `electrica` → `electronica`, `produccion` → `industrial`). `maite: null` significa "todavía no hay gente filmada": la carrera queda escrita y **no se ofrece**. Hoy hay 5 jugables de 12.
- **Todo número ajustable vive en `espejo/config.js`.** Ningún otro archivo debería tener constantes mágicas: lo que se calibra el día del evento, se calibra ahí.
- **Todo lo que distingue una carrera vive en `contenido/carreras.json`** (nombre, color, objetos, `fondo`, `persona`, `maite`, y `objeto` opcional). Agregar o cambiar una carrera no toca una línea de código, pero sí necesita su tecla: la fila de números en `operacion.js` tiene que crecer con el catálogo, y `tests/integracion/atajos.test.js` lo verifica. Orden de dibujo de un objeto: PNG → figura vectorial (`espejo/figuras.js`) → círculo del color; el fondo cae al color plano de la carrera.
- **Cada carrera aporta UN objeto a la elección**: `objeto` si está declarado (el representante fijo, para las carreras donde un solo PNG se entiende de lejos), si no uno sorteado de `objetos` — así dos visitantes seguidos no ven exactamente la misma pantalla.
- `CONFIG.avance.manual` está en `false` (modo evento, automático). Para desarrollar sin pelear con el reloj: tecla `A` en vivo, o ponerlo en `true` — mientras esté puesto, el espejo lo avisa en pantalla. En manual la elección tampoco se vence sola, pero **elegir con la mano sigue funcionando**: es justamente el gesto que se prueba.
- Privacidad: la imagen de la cámara nunca sale de la PC — no se graba, no se guarda, no se transmite.

## Documentación

- `docs/arquitectura.md` — especificación técnica detallada: arquitectura, módulos, máquina de estados, física y MediaPipe.
- `docs/contenido.md` — guía de creación/edición de contenido: `carreras.json`, objetos, fondos, personas, figuras y fallback.
- `docs/despliegue.md` — guía de despliegue, banderas de arranque de Chrome y resolución de problemas.
- `docs/operacion.md` — guía del equipo del stand sin tecnicismos.
- `docs/superpowers/` — spec y plan **originales**, de julio de 2026. Son registro histórico, no descripción del sistema actual: describen accesorios anclados a la cara, objetos que caen con física, tablets propias y protocolo WebSocket, y nada de eso existe hoy. No actualizarlos.
- Atajos de teclado del espejo (avance manual `A`, forzar carrera `1-9,0,-,=`, demo `D`, malla `M`, panel `P`): listados en el README.

