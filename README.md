# Espejo Mágico

Instalación interactiva para el stand de una Facultad de Ingeniería.

Un visitante se acerca a una pantalla enmarcada como espejo. El sistema le propone
al azar una de seis ingenierías, sin inferir aptitudes, género ni vocación a partir
de su rostro. La pantalla se cubre de niebla, se despeja, y el participante aparece
rodeado de objetos característicos de esa carrera que puede manotear. La posible
sorpresa ante esa imagen abre una reflexión sobre los estereotipos profesionales.
En simultáneo, unas tablets reproducen videos de mujeres vinculadas a la disciplina.

Todo corre en el navegador, en una sola PC, **sin conexión a internet**.

## Empezar

Hace falta Node.js y Chrome.

```bash
npm install
npm run vendorizar   # copia MediaPipe y baja los modelos — única vez que necesita red
npm test             # pruebas automatizadas
```

Para levantarlo:

```bash
npm run dev          # desarrollo: reinicia el servidor cuando cambia su código
npm start            # después, abrir http://localhost:8080/
```

o directamente `herramientas\arrancar.bat` en Windows, que levanta el servidor y
abre Chrome en modo kiosco con el permiso de cámara ya concedido.

> El espejo tiene que abrirse por **`localhost`**, nunca por la IP de la máquina:
> Chrome sólo entrega la cámara en contextos seguros. Las tablets sí van por IP,
> porque no usan cámara.

Al iniciar, el servidor muestra tanto la dirección local del espejo como las
direcciones IPv4 disponibles para abrir las tablets desde la red del stand.

## Comandos

| Comando | Para qué |
|---|---|
| `npm test` | ¿Funciona el código? Ejecuta las pruebas automatizadas. |
| `npm run listo` | ¿Se puede montar el stand? Verifica que el contenido real esté completo. Está en rojo hasta que lleguen los PNG y los videos, y eso es lo esperado. |
| `npm run vendorizar` | Copia MediaPipe y baja los modelos de rostro y manos. |
| `npm run dev` | Levanta el servidor en modo desarrollo con reinicio automático. |
| `npm start` | Levanta el servidor local. |

## Atajos, en la PC del espejo

La tuerca de la esquina superior derecha abre un panel para elegir la cámara y
alternar el modo demo, el avance manual y la malla de diagnóstico.

Después de la escena aparecen dos respuestas virtuales: `SÍ, ME SORPRENDIÓ` y
`NO, PODRÍA VERME AHÍ`. Se activan manteniendo una palma encima. Cuando el espejo
queda vacío, la imagen se cierra y vuelve a abrir en espiral, como un caracol,
para mantener la pantalla en movimiento.

En modo automático, un contador circular discreto en la parte superior muestra
los segundos y la proporción de tiempo que faltan para el siguiente estado. No
aparece durante la espera ni en modo manual, porque en esos casos no existe una
transición automática programada.

| Tecla | Qué hace |
|---|---|
| `ESPACIO` | Avanza al estado siguiente (modo manual) |
| `A` | Alterna avance manual / automático |
| `1`–`6` | Fuerza una carrera y salta a la revelación |
| `R` | Corta la sesión y vuelve a la invitación |
| `C` | Cambia a la siguiente cámara disponible |
| `D` | Demo automática: recorre toda la experiencia, las seis carreras y ambos botones |
| `M` | Muestra los puntos que el sistema detecta en cara y manos |
| `P` | Panel de estado y FPS |

`herramientas/figuras.html` muestra las treinta y seis figuras de los objetos en
una grilla, sobre fondo oscuro, claro o tono de piel.

La demo comienza con una pausa sin persona para probar la animación de reposo,
recorre todos los estados y carreras, simula rostro y manos, y alterna entre las
dos respuestas de la reflexión. Mientras está activa ignora el avance manual.

Además del espejo en `/`, existen tres pantallas específicas:

- `/tablet/tablet.html?slot=0` — vista para cada tablet, cambiando el número de `slot`.
- `/tablet/controles.html` — segunda pantalla táctil con botones dinámicos.
- `/herramientas/figuras.html` — visor técnico de las figuras disponibles.

La tablet de controles muestra únicamente las acciones válidas para el estado
actual. Mientras el espejo espera presenta `EMPEZAR`; durante el sorteo permite
cancelar; durante la escena presenta `OTRA CARRERA` y `TERMINAR`; durante el
momento de reflexión presenta las mismas dos respuestas del espejo; durante el
cierre permite volver al inicio. Si el avance manual está activo, agrega
`AVANZAR` en los pasos que necesitan intervención y el espejo no muestra avisos
de teclado sobre la imagen.

## Cómo está armado

```
servidor/    archivos estáticos + relé WebSocket. Sin lógica de negocio.
comun/       el protocolo, compartido por el espejo y las tablets
espejo/      la aplicación principal
tablet/      la página de cada tablet
contenido/   carreras.json, PNG y videos
docs/        especificación, plan y guía de operación del stand
```

Dentro de `espejo/`, la regla de corte es que cada archivo se pueda entender y
probar solo: `rostro.js` no sabe qué es una carrera, `maquina-estados.js` no
dibuja, `escena.js` no sabe que existe MediaPipe, y `fisica.js` sólo conoce
círculos y rectángulos. Por eso la máquina de estados se prueba entera sin cámara
ni pantalla.

**Todo lo que distingue una carrera de otra vive en `contenido/carreras.json`:**
nombre, color, frase, pregunta y mensaje reflexivo, objetos, efecto de partículas
y referentes. Agregar o cambiar una carrera no toca una línea de código.

Los objetos se dibujan con figuras vectoriales (`espejo/figuras.js`) mientras no
haya PNG. El orden de preferencia es **PNG → figura → círculo del color**, así
que cuando diseño entrega, los archivos reemplazan a las figuras solos.

Sin bundler: módulos ES nativos servidos tal cual. Dos dependencias en total,
`ws` en el servidor y `@mediapipe/tasks-vision` copiado a `vendor/`.

## Privacidad

La imagen de la cámara nunca sale de la PC. No se graba, no se guarda, no se
transmite y no se pide ningún dato al visitante. El procesamiento de rostro y
manos ocurre íntegramente en el navegador local.

## Documentación

- `docs/operacion.md` — guía para el equipo del stand, sin tecnicismos
- `docs/superpowers/specs/` — la especificación de diseño
- `docs/superpowers/plans/` — el plan de implementación, tarea por tarea
