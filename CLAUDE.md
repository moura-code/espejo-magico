# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Instalación interactiva para el stand de una Facultad de Ingeniería: un espejo (pantalla + cámara) que descansa cubierto de nubes detecta el rostro del visitante, se despeja, le sortea una de doce ingenierías y lo rodea de objetos que caen y se juntan como un imán alrededor de sus manos (o se manotean: tecla `I`). Todo corre en una sola pestaña de Chrome, en una sola PC, **sin conexión a internet y sin red de ningún tipo**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Toda la suite (vitest, entorno node). Tiene que estar en verde siempre. Incluye `tests/integracion/sintaxis.test.js`, que parsea todos los módulos con `node --check`: es la única red de `main.js`, que ninguna prueba importa porque es cableado del DOM. |
| `npx vitest run tests/espejo/fisica.test.js` | Una sola suite. `npm run test:mirar` para modo watch. |
| `npm run listo` | Semáforo de contenido: verifica que estén los 73 PNG de objetos, las doce carreras acordadas y MediaPipe vendorizado. Hoy está en verde. Corre `tests/listo/`, excluido de `npm test` a propósito: depende de archivos que pueden faltar en una máquina de desarrollo. |
| `npm start` | Servidor en :8080. El espejo se abre por `http://localhost:8080/espejo/espejo.html` — **nunca por IP ni por `file://`**: Chrome solo entrega la cámara en contextos seguros, y esa es la única razón por la que hay un servidor. |
| `npm run vendorizar` | Copia MediaPipe a `vendor/` y baja los modelos. Único paso que necesita red; se corre una sola vez. |
| `npm run generar-pngs` | Genera con el Chrome local (sin red) un PNG de respaldo desde la figura vectorial para cada objeto sin imagen; nunca pisa un PNG existente. Los objetos reales son fotos de Wikimedia Commons con el fondo recortado: autor y licencia por archivo en `contenido/assets/CREDITOS.md`. |

No hay build ni lint: módulos ES nativos servidos tal cual, sin bundler. Mantenerlo así. En la PC del evento (Windows) se arranca con `herramientas/arrancar.bat`.

## Idioma

Todo en castellano: identificadores, comentarios, pruebas, docs y mensajes de commit. Convención ortográfica: **identificadores y comentarios sin tildes** (`atraccion`, `// la señal llega limpia` — la ñ sí va); strings visibles al usuario y markdown con ortografía completa (`'MediaPipe no cargó'`).

## Arquitectura

Dos piezas, y una de las dos casi no hace nada:

- **`servidor/servidor.js`** — archivos estáticos, y nada más. Sin lógica de negocio y **sin dependencias**: sólo importa módulos `node:`. Existe únicamente porque Chrome no entrega la cámara fuera de un contexto seguro.
- **`espejo/`** — toda la inteligencia. `main.js` es solo cableado: decide qué módulo habla con cuál y en qué orden se dibuja; nada probable vive ahí. Expone `window.espejo` (avanzar, forzarCarrera, cambiarModo…) para operar desde la consola.

No hay red, ni protocolo, ni estado compartido con nadie. Si aparece la tentación de agregar un segundo cliente, revisar primero si de verdad hace falta: la instalación se simplificó a propósito sacando las tablets, el WebSocket y `comun/protocolo.js`.

### La máquina de estados (`espejo/maquina-estados.js`)

El ciclo: `ATRACCION → ENGANCHE → SORTEO → REVELACION → ESCENA → CIERRE → ATRACCION`. Recibe `{puedeIniciar, hayPersona, ahora}` y devuelve `{estado, carrera, sesion, eventos}`; no dibuja, no conoce cámaras y por eso se prueba entera sin nada. El único evento es `{tipo: 'entra', estado}`. La carrera se sortea al entrar a SORTEO, tres segundos antes de que se vea: durante el sorteo la niebla sigue cerrada.

Dos histéresis sobre dos señales distintas: el rostro es lo que **arranca** una sesión (`puedeIniciar`), rostro-o-pose es lo que la **sostiene** (`hayPersona`), así los hombros la mantienen viva cuando la cara gira. `sesionMaxima` es la red de seguridad y vigila también el ENGANCHE, para que un rostro intermitente no lo deje trabado.

### Contratos entre módulos de `espejo/`

La regla de corte: cada archivo se tiene que poder entender y probar solo.

- `rostro.js` no sabe qué es una carrera. `maquina-estados.js` no dibuja. `escena.js` no sabe que existe MediaPipe. `fisica.js` solo conoce círculos y rectángulos.
- Todo lo externo se inyecta: el reloj entra como parámetro `ahora` (nunca `Date.now()` dentro de la lógica), y `sortear`, `obtenerMedia`, `cargar`, `azar` se pasan como funciones. Por eso las pruebas corren en Node sin cámara, sin pantalla y sin fake timers.
- `vision.js` carga el WASM de MediaPipe una sola vez para los tres detectores (rostro, manos, pose). Manos y pose son agregados opcionales: si su modelo falta o no carga, el espejo sigue andando con la cabeza sola. Por eso `npm run listo` verifica que los tres `.task` estén: si no, la falla es un `console.warn` que nadie mira.
- **Los detectores no reciben el `<video>`: reciben un lienzo con el recorte de lo que se ve en pantalla.** Cámara apaisada en espejo vertical significa que dos tercios del ancho de la cámara no se ven nunca; analizarlos gastaba la resolución del modelo en píxeles invisibles y era el techo real de la distancia de reconocimiento. `calcularRectanguloVideo` (dónde se dibuja) y `calcularRecorteVisible` (qué se analiza) tienen que salir siempre del mismo rectángulo — si alguno se calcula por su cuenta, los marcadores se van de la cara.
- **La estabilidad de la sesión vive entre dos módulos, no en uno.** `CONFIG.presencia.msParaSalir` es el colchón que absorbe los huecos de la detección antes de que lleguen a la máquina; `CONFIG.tiempos.ausenciaParaCortar` es lo que la máquina aguanta después. Bajar cualquiera de los dos hace que el espejo se reinicie con la persona sentada delante. `tests/integracion/presencia.test.js` los prueba juntos con la CONFIG de verdad.

## Reglas del proyecto

- **Sin internet en el evento.** Nada puede referenciar un CDN ni una URL externa en tiempo de ejecución; `herramientas/vendorizar.mjs` es el único código que toca la red.
- **Todo número ajustable vive en `espejo/config.js`.** Ningún otro archivo debería tener constantes mágicas: lo que se calibra el día del evento, se calibra ahí.
- **Todo lo que distingue una carrera vive en `contenido/carreras.json`** (nombre, color, frase, objetos, efecto). Agregar o cambiar una carrera no toca una línea de código, pero sí necesita su tecla: la fila de números en `operacion.js` tiene que crecer con el catálogo, y `tests/integracion/atajos.test.js` lo verifica. Orden de dibujo de un objeto: PNG → figura vectorial (`espejo/figuras.js`) → círculo del color.
- `CONFIG.avance.manual` está en `false` (modo evento, automático). Para desarrollar sin pelear con el reloj: tecla `A` en vivo, o ponerlo en `true` — mientras esté puesto, el espejo lo avisa en pantalla.
- Privacidad: la imagen de la cámara nunca sale de la PC — no se graba, no se guarda, no se transmite.

## Documentación

- `docs/arquitectura.md` — especificación técnica detallada: arquitectura, módulos, máquina de estados, física y MediaPipe.
- `docs/contenido.md` — guía de creación/edición de contenido: `carreras.json`, objetos, figuras, efectos y fallback.
- `docs/despliegue.md` — guía de despliegue, banderas de arranque de Chrome y resolución de problemas.
- `docs/operacion.md` — guía del equipo del stand sin tecnicismos.
- `docs/superpowers/` — spec y plan **originales**, de julio de 2026. Son registro histórico, no descripción del sistema actual: describen accesorios anclados a la cara, tablets y protocolo WebSocket, todo eso ya no existe. No actualizarlos.
- Atajos de teclado del espejo (avance manual `A`, forzar carrera `1-9,0,-,=`, imán/golpe `I`, demo `D`, malla `M`, panel `P`): listados en el README.

