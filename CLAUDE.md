# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Instalación interactiva para el stand de una Facultad de Ingeniería: un espejo (pantalla + cámara) que descansa cubierto de nubes detecta el rostro del visitante, se despeja, le sortea una de once ingenierías y lo rodea de objetos que caen y se juntan como un imán alrededor de sus manos (o se manotean: tecla `I`), mientras unas tablets reproducen videos de referentes de esa carrera. Todo corre en el navegador de una sola PC, **sin conexión a internet**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Toda la suite (vitest, entorno node). Tiene que estar en verde siempre. |
| `npx vitest run tests/espejo/fisica.test.js` | Una sola suite. `npm run test:mirar` para modo watch. |
| `npm run listo` | Semáforo de contenido: verifica que los PNG y videos reales estén completos. **Está en rojo hasta que diseño entregue, y eso es lo esperado** — no es algo a arreglar. Corre `tests/listo/`, excluido de `npm test` a propósito (una suite permanentemente roja deja de mirarse). |
| `npm start` | Servidor en :8080. El espejo se abre por `http://localhost:8080/espejo/espejo.html` — **nunca por IP**: Chrome solo entrega la cámara en contextos seguros. Las tablets sí van por IP. |
| `npm run vendorizar` | Copia MediaPipe a `vendor/` y baja los modelos. Único paso que necesita red; se corre una sola vez. |

No hay build ni lint: módulos ES nativos servidos tal cual, sin bundler. Mantenerlo así. En la PC del evento (Windows) se arranca con `herramientas/arrancar.bat`.

## Idioma

Todo en castellano: identificadores, comentarios, pruebas, docs y mensajes de commit. Convención ortográfica: **identificadores y comentarios sin tildes** (`atraccion`, `// la señal llega limpia` — la ñ sí va); strings visibles al usuario y markdown con ortografía completa (`'MediaPipe no cargó'`).

## Arquitectura

Tres piezas conectadas por WebSocket:

- **`servidor/servidor.js`** — archivos estáticos + relé WebSocket. Sin lógica de negocio. Guarda el último mensaje y se lo entrega a cada cliente nuevo, así una tablet que se reinicia se pone al día.
- **`espejo/`** — toda la inteligencia. `main.js` es solo cableado: decide qué módulo habla con cuál y en qué orden se dibuja; nada probable vive ahí. Expone `window.espejo` (avanzar, forzarCarrera, cambiarModo…) para operar desde la consola.
- **`tablet/tablet.js`** — cliente tonto: recibe un mensaje y reacciona. El DOM está detrás de la interfaz `pantalla` para que la lógica se pruebe en Node.

`comun/protocolo.js` define los únicos mensajes del sistema (`hola` para declarar rol al conectar, más `carrera` y `reposo`) y lo importan los dos lados: es lo que impide que se desincronicen sin que nadie se entere.

### La máquina de estados (`espejo/maquina-estados.js`)

El ciclo: `ATRACCION → ENGANCHE → SORTEO → REVELACION → ESCENA → CIERRE → ATRACCION`. Recibe `{hayRostro, ahora}` y devuelve estado + eventos (`entra`, `carrera`, `reposo`); no dibuja, no conoce cámaras ni red, y por eso se prueba entera sin nada. La carrera se sortea al entrar a SORTEO pero se anuncia a las tablets recién en REVELACION. El espejo reenvía el último anuncio cada 2 s (latido); las tablets descartan repetidos por número de `sesion`.

### Contratos entre módulos de `espejo/`

La regla de corte: cada archivo se tiene que poder entender y probar solo.

- `rostro.js` no sabe qué es una carrera. `maquina-estados.js` no dibuja. `escena.js` no sabe que existe MediaPipe. `fisica.js` solo conoce círculos y rectángulos.
- Todo lo externo se inyecta: el reloj entra como parámetro `ahora` (nunca `Date.now()` dentro de la lógica), y `sortear`, `obtenerMedia`, `cargar`, `pantalla` se pasan como funciones. Por eso las pruebas corren en Node sin cámara, sin pantalla y sin fake timers.
- `vision.js` carga el WASM de MediaPipe una sola vez para los tres detectores (rostro, manos, pose). Manos y pose son agregados opcionales: si su modelo falta o no carga, el espejo sigue andando con la cabeza sola. Por eso `npm run listo` verifica que los tres `.task` estén: si no, la falla es un `console.warn` que nadie mira.

## Reglas del proyecto

- **Sin internet en el evento.** Nada puede referenciar un CDN ni una URL externa en tiempo de ejecución; `herramientas/vendorizar.mjs` es el único código que toca la red.
- **Todo número ajustable vive en `espejo/config.js`.** Ningún otro archivo debería tener constantes mágicas: lo que se calibra el día del evento, se calibra ahí.
- **Todo lo que distingue una carrera vive en `contenido/carreras.json`** (nombre, color, frase, objetos, efecto, referentes). Agregar o cambiar una carrera no toca una línea de código. Orden de dibujo de un objeto: PNG → figura vectorial (`espejo/figuras.js`) → círculo del color.
- `CONFIG.avance.manual` está en `false` (modo evento, automático). Para desarrollar sin pelear con el reloj: tecla `A` en vivo, o ponerlo en `true` — mientras esté puesto, el espejo lo avisa en pantalla.
- Privacidad: la imagen de la cámara nunca sale de la PC — no se graba, no se guarda, no se transmite.

## Documentación

- `docs/superpowers/specs/2026-07-28-espejo-magico-design.md` — la especificación: decisiones de diseño y sus porqués.
- `docs/superpowers/plans/2026-07-28-espejo-magico.md` — el plan de implementación, tarea por tarea.
- `docs/operacion.md` — guía del stand sin tecnicismos.
- Atajos de teclado del espejo (avance manual, forzar carrera, modo demo `D` sin cámara, malla `M`, panel `P`): listados en el README.
