# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Instalación interactiva para el stand de una Facultad de Ingeniería: un espejo (pantalla + cámara) que descansa cubierto de humo detecta el rostro del visitante, se llena de humo, y al disiparse le ofrece **un carrusel con las doce ingenierías**, un objeto por cada una, que gira lento a su alrededor. La persona **sostiene la mano** sobre uno —el carrusel se detiene y un anillo se llena mientras la mantiene ahí— y aparece esa ingeniería detrás suyo: su fondo recortado contra su silueta, el objeto volando a su lugar dentro de ese fondo y el nombre de la ingeniería al pie.

**Se elige una sola vez.** Al completarse el sostenido, los otros once objetos se apagan y el carrusel desaparece: la ingeniería que le tocó se queda puesta el resto de la sesión. El espejo le avisa a **MAITE** —el proyecto de las tablets, en `localhost:3000`— para que los retratos del stand muestren a la gente de esa carrera. Cuando el espejo deja de reconocer su cara, vuelve a la pantalla inicial y queda libre para el que sigue en la fila.

Todo corre en una sola pestaña de Chrome, en una sola PC, **sin conexión a internet**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Toda la suite (vitest, entorno node). Tiene que estar en verde siempre. Incluye `tests/integracion/sintaxis.test.js`, la única red de `main.js` —que ninguna prueba importa porque es cableado del DOM—: parsea todos los módulos con `node --check` y además verifica que **cada import apunte a un export que exista**, que es el error más fácil de cometer al refactorizar y revienta recién en el navegador. |
| `npx vitest run tests/espejo/eleccion.test.js` | Una sola suite. `npm run test:mirar` para modo watch. |
| `npm run listo` | Semáforo de contenido: los 73 PNG, los **tres fondos candidatos** de cada carrera —que existan, que cada uno diga dónde se apoya el objeto y que esté su video si lo declaran—, el video de humo, las doce carreras, la tipografía Muffaroo con su nota de licencia, que cada `maite` exista del otro lado y MediaPipe vendorizado. **Hoy está en verde.** Corre `tests/listo/`, excluido de `npm test` a propósito: depende de archivos que pueden faltar en una máquina de desarrollo. |
| `npm start` | Servidor en :8080. El espejo se abre por `http://localhost:8080/espejo/espejo.html` — **nunca por IP ni por `file://`**: Chrome solo entrega la cámara en contextos seguros, y esa es la única razón por la que hay un servidor. |
| `npm run vendorizar` | Copia MediaPipe a `vendor/` y baja los modelos. Único paso que necesita red; se corre una sola vez. |
| `npm run generar-pngs` | Genera con el Chrome local (sin red) un PNG de respaldo desde la figura vectorial para cada objeto sin imagen; nunca pisa un PNG existente. Los objetos reales son fotos de Wikimedia Commons con el fondo recortado: autor y licencia por archivo en `contenido/assets/CREDITOS.md`. |
| `npm run generar-fondos` | Genera con el Chrome local (sin red) el fondo de respaldo de cada carrera —el candidato `.png` de `fondos`, no el activo— cuando falte, a partir de su escena vectorial en `espejo/escenarios.js`: el laboratorio de química, el puente de civil, la sala de servidores de computación. Nunca pisa un fondo existente. Para ver todos los candidatos de cada carrera tal como se verían —silueta, objeto apoyado y nombre al pie, y **andando** los que tienen video—, `herramientas/fondos.html` desde `npm start` (hermana de `figuras.html`): es la página con la que la cátedra elige. |

No hay build ni lint: módulos ES nativos servidos tal cual, sin bundler. Mantenerlo así. En la PC del evento (Windows) se arranca con `herramientas/arrancar.bat`.

## Idioma

Todo en castellano: identificadores, comentarios, pruebas, docs y mensajes de commit. Convención ortográfica: **identificadores y comentarios sin tildes** (`atraccion`, `// la señal llega limpia` — la ñ sí va); strings visibles al usuario y markdown con ortografía completa (`'MediaPipe no cargó'`).

## Arquitectura

Dos piezas, y una de las dos casi no hace nada:

- **`servidor/servidor.js`** — archivos estáticos, y nada más. Sin lógica de negocio y **sin dependencias**: sólo importa módulos `node:`. Existe únicamente porque Chrome no entrega la cámara fuera de un contexto seguro.
- **`espejo/`** — toda la inteligencia. `main.js` es solo cableado: decide qué módulo habla con cuál y en qué orden se dibuja; nada probable vive ahí. Expone `window.espejo` (avanzar, mirar, forzarCarrera, cambiarModo…) para operar desde la consola.

**El único hilo que sale de esta PC es el aviso a MAITE**, y es de ida: un `POST` a `localhost:3000` cada vez que cambia la ingeniería que se está mostrando, y otro cuando la sesión termina. No hay protocolo propio, no hay WebSocket, no hay estado compartido y el espejo no lee nada de vuelta. Si aparece la tentación de agregar un segundo cliente o de hacer que el espejo dependa de una respuesta, revisar primero si de verdad hace falta: la instalación se simplificó a propósito sacando las tablets del proyecto, el WebSocket y `comun/protocolo.js`, y ese aviso de una línea es todo lo que hizo falta para volver a coordinarlas.

### La máquina de estados (`espejo/maquina-estados.js`)

El ciclo: `ATRACCION → ENGANCHE → HUMO → EXPLORACION → CIERRE → ATRACCION`. Recibe `{puedeIniciar, hayPersona, ahora}` y devuelve `{estado, opciones, carrera, sesion, eventos}`; no dibuja, no conoce cámaras y por eso se prueba entera sin nada. Dos eventos: `{tipo: 'entra', estado}` y `{tipo: 'mira', carrera}`.

Todas las carreras jugables se ofrecen (`opciones`), en orden barajado por sesión, al entrar a HUMO, mientras el humo tapa la pantalla: ese margen le sirve al espejo para tener listos los PNG y los fondos, y como todavía no se ve nada tampoco se cuenta el final. `carrera` queda en null hasta que la persona agarra algo.

**SE ELIGE UNA SOLA VEZ, y la guarda vive en la máquina.** `mirar` no hace nada si ya hay `carrera`: no basta con que quien dibuja apague el carrusel, porque un `mirar` que llegara igual —un atajo de teclado, un cuadro de más— reiniciaría el reloj del fondo y le mandaría otro aviso a MAITE. No hace falta un estado "ya elegiste" para eso: lo dice `carrera`, que deja de ser null. REVELACION y ESCENA dejaron de ser estados — lo que hacían (el fondo entrando) es una transición **por ingeniería**, con su propio reloj (`miraDesdeCuando`), no un tramo del ciclo.

**Lo que se muestra se le informa a la máquina desde afuera**, con `mirar(id, ahora)`: la máquina no sabe qué es una mano. Solo vale durante EXPLORACION, y **volver a pedir la misma no emite nada** — con la mano quieta el sostenido se repite cuadro a cuadro, y sin esa guarda MAITE recibiría cien avisos por segundo. La sesión se cuenta una sola vez por persona, la primera vez que mira algo, no una por objeto.

**`tiempos.eleccionMaxima` (30 s) es la red de seguridad de la fila**: si nadie agarró nada, muestra `opciones[0]` y con eso cierra la elección, igual que si la hubiera agarrado con la mano. Sin ella, quien no entiende el gesto deja el espejo tomado hasta el tope de sesión, tres minutos después. Y como lo ofrecido viene barajado, tomar el primero ya es un sorteo: nadie se va sin ingeniería. **La red no se le cae encima a quien ya está eligiendo**: con un sostenido en curso (`eligiendo`, que main.js le pasa a `actualizar`) el plazo espera, porque desde que la elección es definitiva vencerlo con la mano puesta sería robarle el gesto y mandarlo a casa con una carrera sorteada.

**El rostro es lo que sostiene la sesión.** Dos histéresis sobre dos señales distintas: `puedeIniciar` (rostro) es lo que **arranca** y también lo que **sostiene**; `hayPersona` (rostro-o-pose) solo agrega el corte por ausencia total. Los hombros ya **no** mantienen viva una sesión con la cara girada: en cuanto la cara deja de reconocerse, y pasado el colchón, el espejo vuelve a su pantalla inicial. Es lo que hace avanzar la fila. `sesionMaxima` es la otra red de seguridad y vigila también el ENGANCHE, para que un rostro intermitente no lo deje trabado.

### Contratos entre módulos de `espejo/`

La regla de corte: cada archivo se tiene que poder entender y probar solo.

- `rostro.js` no sabe qué es una carrera. `maquina-estados.js` no dibuja. `escena.js` no sabe que existe MediaPipe. `eleccion.js` no sabe qué es una ingeniería. `tablero.js` solo conoce arcos y círculos. `maite.js` no sabe qué es un estado.
- Todo lo externo se inyecta: el reloj entra como parámetro `ahora` (nunca `Date.now()` dentro de la lógica), y `sortear`, `obtenerMedia`, `cargar`, `azar` se pasan como funciones. Por eso las pruebas corren en Node sin cámara, sin pantalla y sin fake timers.
- `vision.js` carga el WASM de MediaPipe una sola vez para los tres detectores (rostro, manos, pose). Manos y pose son agregados opcionales: si su modelo falta o no carga, el espejo sigue andando con la cabeza sola. Por eso `npm run listo` verifica que los tres `.task` estén: si no, la falla es un `console.warn` que nadie mira.
- **Los detectores no reciben el `<video>`: reciben un lienzo con el recorte de lo que se ve en pantalla.** Cámara apaisada en espejo vertical significa que dos tercios del ancho de la cámara no se ven nunca; analizarlos gastaba la resolución del modelo en píxeles invisibles y era el techo real de la distancia de reconocimiento. `calcularRectanguloVideo` (dónde se dibuja) y `calcularRecorteVisible` (qué se analiza) tienen que salir siempre del mismo rectángulo — si alguno se calcula por su cuenta, los marcadores se van de la cara.
- **La estabilidad de la sesión vive entre dos módulos, no en uno.** `CONFIG.presencia.msParaSalir` es el colchón que absorbe los huecos de la detección antes de que lleguen a la máquina; `CONFIG.tiempos.ausenciaParaCortar` es lo que la máquina aguanta después. Los dos están en tensión y ninguno se toca solo: **cortos de más** le cortan la escena a alguien que sigue sentado, **largos de más** dejan que quien se fue se lleve el espejo y el siguiente en la fila mire una escena ajena. `tests/integracion/presencia.test.js` fija las dos puntas con la CONFIG de verdad. Límite conocido y documentado: por debajo de esos ~6 s el sistema no distingue a dos personas y un relevo rápido hereda la sesión.

### El carrusel y el sostenido (`tablero.js` + `eleccion.js`)

Es la parte que más fácil se rompe al calibrar. `tests/integracion/eleccion.test.js` arma la cadena entera —pose → tablero → elección → máquina— con la CONFIG de verdad.

- **Los objetos NO van en posiciones fijas de la pantalla.** A dos metros de la cámara el brazo alcanza apenas el tercio central del espejo: doce objetos repartidos por el lienzo serían inalcanzables para quien está lejos y le taparían la cara a quien está cerca. Van en un **anillo** alrededor de los hombros, con el radio proporcional al ancho de hombros — el mejor indicador de a qué distancia está sentada. No hay ningún umbral por distancia: sale solo de la geometría.
- **El anillo es un carrusel: una ranura por carrera, y solo se ve la ventana de arriba** (`tablero.desde` → `tablero.hasta`, 190°→350°, unos cinco o seis objetos). El resto está "detrás del marco", como en el boceto de la cátedra: existe, gira y no se dibuja. La fase crece a `tablero.gradosPorSegundo` (8°/s: vuelta entera en 45 s, un objeto nuevo cada ~4 s), en el sentido de las flechas del boceto: sube por la izquierda, pasa por arriba, baja por la derecha. Cada ranura tiene un `alfa` de ventana con una rampa en los bordes (`gradosDeFundido`), y **solo son blancos las ranuras enteras (`alfa === 1`)**. El radio se mide contra la ventana fija, no contra las ranuras —si no respiraría con el giro— y el tamaño del objeto se acota a la cuerda entre vecinos (`aireEntreObjetos`), porque con doce a 30° y el radio achicado por el borde dos objetos se encimaban.
- **`congelar` detiene el ancla Y la rotación, y se pone en `progreso > 0` o con la carrera ya elegida.** Es la pausa que pidió la cátedra: mano sobre un objeto, el anillo empieza a llenarse y el carrusel se para ahí mismo; sacar la mano antes de completar vacía el anillo (gracia + olvido, ~0,85 s como máximo) y el carrusel sigue girando. Al completarse ya no vuelve a girar nunca: se elige una sola vez, y un anillo girando detrás del objeto apoyado diría lo contrario. Sin congelar el ancla, estirar el brazo mueve los hombros y el blanco se corre de abajo de la propia mano; sin congelar el giro, elegir sería perseguir un objeto que se escapa. `tests/integracion/eleccion.test.js` fija las tres cosas de punta a punta, con el mismo `congelar` que arma main.js.
- **`CONFIG.eleccion.msDeGracia` no es un detalle, es lo que hace usable el gesto.** La detección de manos se pierde varios cuadros por segundo con la mano de costado o mal iluminada. Como vaciar el anillo es más rápido que llenarlo (`msDeOlvido` < `msParaElegir`, y tiene que serlo para que un roce no valga por una elección), sin gracia un 25 % de cuadros perdidos convertía 1,5 s de sostenido en **doce**. Es la misma idea que `presencia.msParaSalir` para el rostro —entrar rápido, salir lento— aplicada a la mano.
- **`elegido` es "sobre cuál está la mano ahora, ya sostenida", no "cuál eligió la persona".** `eleccion.js` no sabe que hay una sola elección por persona y no le corresponde saberlo: sigue soltando el blanco cuando la mano se va o se mueve a otro, que es lo que hace que arrepentirse a mitad del sostenido funcione. Quedarse con una sola es tarea de la máquina, que además descarta el repetido cuadro a cuadro.
- **El carrusel SE APAGA al elegir**, y es lo que dice que la elección se terminó. Se desvanece con el mismo plazo que dura el vuelo (`tiempos.vuelo`), así que el anillo termina de vaciarse justo cuando el objeto elegido aterriza en su lugar: se lee como que los demás se apartaron para dejarlo pasar. Dejarlos puestos sería ofrecer algo que ya no se puede agarrar, y la primera persona que estirara la mano otra vez creería que el espejo se colgó. Con él se apagan la consigna y la señal de las manos, y **se apaga el detector de manos**, que es el más caro del cuadro: esos milisegundos se los queda la silueta, que es lo que se mira a partir de ahí.
- **El objeto elegido NO se va con el carrusel.** Por eso `calcularTransicionEscena` devuelve `elegido` aparte de `objetos`: el vuelo pasa exactamente mientras el carrusel se apaga, y con el alfa del carrusel el objeto se desvanecería en pleno vuelo, que es el cuadro en el que la persona lo está siguiendo con la vista.
- El orden del anillo lo da `sorteo.js`, barajado por sesión y sin repetir carrera: dos visitantes seguidos no ven el anillo igual, y `opciones[0]` —lo que muestra la red de la fila— nunca repite el de la sesión anterior.

### El objeto en su lugar (`vuelo.js`)

Al completarse el sostenido, el objeto **vuela de su ranura a su lugar en el fondo** (`tiempos.vuelo`, 1 s, con easing e interpolando el tamaño). Cada fondo declara `lugar: {x, y, escala}` **normalizado a la imagen**, no a la pantalla: el fondo se dibuja cubriendo y recortado, y un punto normalizado a la imagen cae siempre en el mismo sitio de la escena en cualquier resolución. Sin `lugar` vale `CONFIG.fondo.lugarPorDefecto`. El origen se captura en el evento `mira` (la ranura en ese cuadro), porque el carrusel sigue girando mientras el objeto vuela; sin ranura a la vista —la red de la fila, una carrera forzada por teclado— el objeto crece en su lugar desde cero. **Mientras vuela va por delante de todo; al aterrizar pasa detrás de la persona recortada**, con un halo del color de la carrera debajo (`fondo.haloDelLugar`) y una flotación suave (`fondo.flotar`): integrado a la escena, y si la persona se inclina sobre ese punto lo tapa, que es lo correcto. `calcularTransicionEscena` lleva la capa `vuelo` junto a `fondo` y `contenido`.

### La tipografía

Los títulos van en **Muffaroo**, la que muestran de verdad las tablets de MAITE:
su `style.css` base declara Germania One como `--font-display`, pero los cuatro
temas (`temas/tablet-*.css`) la pisan con Muffaroo, y el espejo copiaba la base
que ninguna tablet usa. No es decoración: las dos piezas están a dos metros una
de otra en el stand y tienen que leerse como una sola instalación. El archivo y
su nota de licencia viven en `contenido/assets/tipografias/`, y `npm run listo`
los exige. **Ojo con la licencia**: el TTF se declara "free for personal use
only" (Imagex, 2010); un stand de facultad no es uso personal, la nota lo dice y
la decisión es de la cátedra, no del código.

Dos cosas que se rompen solas si no se saben:

- **El lienzo NO dispara la carga de una fuente.** `ctx.font` con una familia que
  todavía no cargó no la pide: cae en silencio a la del sistema y sigue como si
  nada. Por eso `main.js` espera con `document.fonts.load()` antes del primer
  cuadro.
- **Muffaroo trae una sola variante (Regular, 400).** Pedirle `700` da un
  falso-bold que le arruina las formas. Todo lo que la use va en `PESO_TITULO`, y
  `tests/espejo/escena.test.js` lo vigila. Es condensada, en versales y sin
  serifas: el respaldo es una sans condensada, no Georgia.

La división es la de MAITE: display para el nombre de la ingeniería (al pie, en
una o dos líneas), sans del sistema para la consigna del sostenido, que es la
única instrucción de la experiencia y tiene que entenderse de un vistazo.

### El fondo detrás de la persona

`pose.segmentacion` está en `true` y `silueta.js` traduce la máscara de MediaPipe —un byte de confianza por píxel, **sin canal alfa**— a una imagen blanca cuyo alfa es esa confianza. Sin esa traducción el lienzo la ve opaca en todos lados y `destination-in` no recorta nada.

La máscara ES la imagen mientras hay fondo, así que la pose sube a `fpsConFondo` **mientras se está mostrando una ingeniería** (no mientras dura un estado): a 12 cuadros por segundo el borde de la silueta va atrás del cuerpo y se ve el fondo pegado al hombro.

**Y si la máscara no está** —pose perdida, GPU lenta, modelo sin cargar— el fondo se dibuja igual, más tenue y con el espejo apagado debajo (`CONFIG.fondo.opacidadSinMascara`). Se pierde la profundidad, nunca queda una pantalla en negro con público delante.

**Y el fondo puede moverse.** Un candidato de `fondos` puede declarar `video` además de su `img` (`espejo/videos.js`), y el fondo pasa a ser ese video en loop. **El video no reemplaza a la foto: la acompaña** — la `img` de un fondo con movimiento es un cuadro del propio video, y es lo que se ve mientras el video no cargó o si el archivo falta; como es el mismo encuadre, el cambio no se nota. Tres reglas que sostienen eso: los videos **no se esperan al arrancar** (la precarga sale después del primer cuadro y nadie la aguarda), se cargan **de a uno** (doce descargas simultáneas compiten con la cámara y con MediaPipe) y **suena uno solo**, el de la ingeniería que se está mostrando. Ojo con una trampa: un `<video>` no tiene `width` ni `height` útiles, así que el fondo y el lugar del objeto se miden con `medidasDe` de `escena.js` — con `.width` el fondo sale estirado y el objeto se apoya en otro lado.

**El fondo es un escenario, no una ilustración**: tiene que aguantar encima una persona recortada y un objeto apoyado. Cada carrera declara **tres candidatos reales** (el `.png` del respaldo vectorial no cuenta) y `npm run listo` lo exige, junto con que cada uno declare su `lugar`. Los criterios están en `docs/contenido.md` y salieron de mirar los que no funcionaban: un lugar con profundidad y no un primer plano, centro y mitad inferior tranquilos, sin gente adentro, un rincón oscuro arriba para el objeto —no alcanza con que la foto entera sea oscura— y, si es video, poco movimiento. `naval-canal.mp4` quedó como el ejemplo de lo contrario y por eso no es el activo.

**Y si el fondo no está**, `espejo/escenarios.js` dibuja el lugar donde se trabaja esa ingeniería —el laboratorio de química, el puente de civil, la sala de servidores de computación—. Un degradado del color no le dice a nadie qué carrera es; un laboratorio sí. Es el mismo papel que cumple `figuras.js` con los objetos: sacar del camino crítico un contenido que todavía no está. Cada escena se dibuja **una sola vez** sobre un lienzo aparte (`crearBancoDeEscenarios`) y de ahí en más es un `drawImage`, igual de barato que el PNG al que reemplaza.

## Reglas del proyecto

- **Sin internet en el evento.** Nada puede referenciar un CDN ni una URL externa en tiempo de ejecución; `herramientas/vendorizar.mjs` es el único código que toca la red.
- **Un solo puente saliente, y opcional.** El espejo le avisa a MAITE qué ingeniería le tocó a la persona (`POST localhost:3000/api/carrera`) y cuándo terminó la sesión (`POST /api/humo`). **Un aviso por persona**: como se elige una sola vez, la mano temblando sobre el blanco o un atajo tardío no disparan ninguno de más. Va y no vuelve: el espejo no lee nada de MAITE, no espera su respuesta y no comparte estado con él. **La regla que no se negocia: esto nunca puede romper el espejo.** Si MAITE no está levantado, tarda o contesta cualquier cosa, la experiencia sigue igual y lo único que queda es un `console.warn`. Por eso `maite.js` no tiene reintentos, no tiene cola, corta a los 1,5 s y nunca lanza. Se apaga entero con `CONFIG.maite.activo`.
- **Los ids de las carreras no coinciden entre los dos proyectos** y se resuelve con dato, no con código: cada carrera declara su `maite` en `carreras.json` (`computacion` → `sistemas`, `electrica` → `electronica`, `fisico-matematico` → `fisico_matematica`). `maite: null` significa "todavía no hay gente filmada": la carrera queda escrita y **no se ofrece**. **Hoy están las doce mapeadas**, contra el catálogo de 14 que MAITE tiene desde el 26 de agosto de 2026. Ojo con esto: que MAITE conozca un id no quiere decir que tenga el video — hoy sólo `sistemas` tiene archivos de verdad en `public/videos/`, y las otras trece apuntan a `<carrera>/persona-1..4.mp4` que todavía no existen. El espejo no se entera ni le importa: muestra la ingeniería igual y lo único que no pasa es que las tablets acompañen.
- **Todo número ajustable vive en `espejo/config.js`.** Ningún otro archivo debería tener constantes mágicas: lo que se calibra el día del evento, se calibra ahí.
- **Todo lo que distingue una carrera vive en `contenido/carreras.json`** (nombre, color, objetos, `fondos` —los candidatos, el primero es el activo y cada uno puede declarar el `lugar` del objeto y un `video` para que el fondo se mueva—, `maite`, y `objeto` opcional). **Ya no lleva `persona`**: las personas las muestran las tablets de MAITE, el espejo muestra la ingeniería. Agregar o cambiar una carrera no toca una línea de código, pero sí necesita su tecla: la fila de números en `operacion.js` tiene que crecer con el catálogo, y `tests/integracion/atajos.test.js` lo verifica. Orden de dibujo de un objeto: PNG → figura vectorial (`espejo/figuras.js`) → círculo del color. El del fondo es el mismo con un escalón mas arriba: video (`espejo/videos.js`, si el candidato lo declara) → PNG → escena vectorial (`espejo/escenarios.js`) → color plano de la carrera.
- **Cada carrera aporta UN objeto al carrusel**: `objeto` si está declarado (el representante fijo, para las carreras donde un solo PNG se entiende de lejos), si no uno sorteado de `objetos` — así dos visitantes seguidos no ven exactamente la misma pantalla.
- `CONFIG.avance.manual` está en `false` (modo evento, automático). Para desarrollar sin pelear con el reloj: tecla `A` en vivo, o ponerlo en `true` — mientras esté puesto, el espejo lo avisa en pantalla. En manual la red de la fila tampoco se dispara sola, pero **agarrar con la mano sigue funcionando**: es justamente el gesto que se prueba.
- Privacidad: la imagen de la cámara nunca sale de la PC — no se graba, no se guarda, no se transmite.

## Documentación

- `docs/arquitectura.md` — especificación técnica detallada: arquitectura, módulos, máquina de estados, física y MediaPipe.
- `docs/contenido.md` — guía de creación/edición de contenido: `carreras.json`, objetos, fondos, personas, figuras y fallback.
- `docs/despliegue.md` — guía de despliegue, banderas de arranque de Chrome y resolución de problemas.
- `docs/operacion.md` — guía del equipo del stand sin tecnicismos.
- `docs/superpowers/` — spec y plan **originales**, de julio de 2026. Son registro histórico, no descripción del sistema actual: describen accesorios anclados a la cara, objetos que caen con física, tablets propias y protocolo WebSocket, y nada de eso existe hoy. No actualizarlos.
- Atajos de teclado del espejo (avance manual `A`, forzar carrera `1-9,0,-,=`, demo `D`, malla `M`, panel `P`): listados en el README.

