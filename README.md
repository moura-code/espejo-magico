# Espejo Mágico

Instalación interactiva para el stand de una Facultad de Ingeniería.

Un visitante se sienta frente a una pantalla enmarcada como espejo, que descansa
cubierta de humo y de nubes. Una cámara detecta su rostro y entra un humo que lo
cubre todo; cuando se disipa, queda girando despacio alrededor suyo **un carrusel
con las doce ingenierías, un objeto por cada una**. Sostiene la mano sobre el que
quiera —el carrusel se detiene y un anillo se va llenando mientras la mantiene
ahí— y aparece esa ingeniería detrás suyo: su fondo, el objeto volando a su
lugar dentro de ese fondo, y el nombre de la ingeniería al pie.

**Se elige una sola vez.** Al completarse el sostenido los demás objetos se
apagan y el carrusel desaparece —se van con el vuelo del elegido, así que el
anillo termina de vaciarse justo cuando el objeto aterriza en su lugar— y la
ingeniería que le tocó se queda puesta. El espejo le avisa a **MAITE**, el
proyecto de las tablets, para que los retratos del stand muestren a la gente de
esa carrera.

Y en ese fondo hay más: los otros **tres objetos** de la ingeniería están
escondidos a los costados, meciéndose apenas. Pasando la mano sobre cualquiera de
los cuatro se abre su **ficha**, con el nombre del objeto y una descripción
corta de qué tiene que ver con la carrera.

Dura mientras la persona siga sentada; en cuanto el espejo deja de reconocer su
cara, vuelve a cubrirse y queda libre para el que sigue en la fila.

Todo corre en una sola pestaña de Chrome, en una sola PC, **sin conexión a
internet**. La única comunicación que sale de esa pestaña es un aviso a MAITE en
`localhost:3000`, y el espejo funciona igual si del otro lado no hay nadie.

## Carreras

- Ingeniería Civil
- Ingeniería de Alimentos
- Ingeniería de Producción
- Ingeniería Eléctrica
- Ingeniería en Agrimensura
- Ingeniería en Computación
- Ingeniería en Sistemas de Comunicación
- Ingeniería Físico-Matemática
- Ingeniería Forestal
- Ingeniería Industrial Mecánica
- Ingeniería Naval
- Ingeniería Química

## Empezar

Hace falta Node.js y Chrome.

```bash
npm install
npm run vendorizar   # copia MediaPipe y baja los modelos — única vez que necesita red
npm test             # suite automática
```

Para levantarlo:

```bash
npm start            # después, abrir http://localhost:8080/espejo/espejo.html
```

o directamente `herramientas\arrancar.bat` en Windows, que levanta el servidor y
abre Chrome en modo kiosco con el permiso de cámara ya concedido.

> El espejo tiene que abrirse por **`localhost`**, nunca por la IP de la máquina
> ni por `file://`: Chrome sólo entrega la cámara en contextos seguros. Esa es la
> única razón por la que hay un servidor.

## Comandos

| Comando | Para qué |
|---|---|
| `npm test` | ¿Funciona el código? La suite tiene que estar en verde siempre. |
| `npm run listo` | ¿Se puede montar el stand? Verifica los PNG, los cuatro objetos de cada carrera con su nombre y su descripción, los tres fondos candidatos —con su `lugar`, los escondites de los otros tres objetos y el video de los que se mueven—, el video de humo, que cada carrera apunte a un id que MAITE conozca, y MediaPipe vendorizado. |
| `npm run vendorizar` | Copia MediaPipe y baja los modelos de rostro, manos y pose. |
| `npm run generar-pngs` | Genera el PNG de respaldo de los objetos que no tengan imagen (no pisa existentes). Necesita Chrome; no usa red. |
| `npm run generar-fondos` | Genera el fondo de respaldo de cada carrera que no tenga imagen, dibujando con el Chrome local (sin red) el lugar donde se trabaja esa ingeniería. No pisa existentes. `herramientas/fondos.html` las muestra las doce juntas. |
| `npm start` | Levanta el servidor local. |

## Atajos, en la PC del espejo

| Tecla | Qué hace |
|---|---|
| `ESPACIO` | Avanza al estado siguiente (modo manual) |
| `A` | Alterna avance manual / automático |
| `1`–`9`, `0`, `-`, `=` | Fuerza una carrera y salta a la revelación (la fila de números entera: doce teclas, doce carreras) |
| `R` | Corta la sesión y vuelve a la invitación |
| `D` | Modo demo: funciona sin cámara, y el mouse hace de mano (se elige sosteniéndolo sobre un objeto y se abren las fichas pasándolo por encima) |
| `M` | Muestra los puntos que el sistema detecta en cara y manos |
| `P` | Panel de estado y FPS |

`herramientas/figuras.html` muestra las treinta y seis figuras de los objetos en
una grilla, sobre fondo oscuro, claro o tono de piel. `herramientas/fondos.html`
muestra cada fondo candidato con sus cuatro objetos y sus fichas, tal como se
vería en el espejo, y `herramientas/colores.html` las opciones de color del
nombre y de la carga que se miraron. Las tres se abren desde `npm start`.

## Cómo está armado

```
servidor/    archivos estáticos, y nada más. Sin lógica de negocio.
espejo/      la aplicación entera
contenido/   carreras.json y los PNG de los objetos
docs/        arquitectura, contenido, despliegue y guía de operación del stand
```

Dentro de `espejo/`, la regla de corte es que cada archivo se pueda entender y
probar solo: `rostro.js` no sabe qué es una carrera, `maquina-estados.js` no
dibuja, `escena.js` no sabe que existe MediaPipe, `eleccion.js` no sabe qué es
una ingeniería y `tablero.js` sólo conoce anillos y círculos. Por eso la máquina de
estados y el sostenido se prueban enteros sin cámara ni pantalla. `main.js` es
sólo cableado: decide qué módulo habla con cuál y en qué orden se dibuja.

**Todo lo que distingue una carrera de otra vive en `contenido/carreras.json`:**
nombre, sus cuatro objetos con su nombre y su descripción (el primero es el del
carrusel), los fondos candidatos con el lugar de cada objeto, y el id que esa
carrera tiene en MAITE. Agregar o cambiar una carrera no toca una línea de
código. Las personas no están acá: las muestran las tablets. El color no
distingue a las ingenierías: nombres, carga y fichas van en los colores de
MAITE, en `espejo/config.js`.

Los objetos son fotografías reales con el fondo recortado; las que salieron de
Wikimedia Commons llevan autor, origen y licencia en
`contenido/assets/CREDITOS.md`. El orden de preferencia al dibujar es **PNG →
figura → círculo del color**: si un PNG falta, `npm run generar-pngs` rasteriza
la figura vectorial de respaldo (`espejo/figuras.js`) sin pisar los existentes,
y los definitivos de diseño reemplazan a cualquiera en la misma ruta, sin tocar
código. Lo mismo para los fondos, con `npm run generar-fondos`, que dibuja la escena de
cada ingeniería (`espejo/escenarios.js`). Cada carrera declara **tres fondos
candidatos** —espacios con profundidad, sin gente y con un rincón oscuro donde
apoyar el objeto: los criterios están en `docs/contenido.md`— y un candidato
puede ser **un video** en vez de una foto quieta (declara `video` además de su `img`, que pasa a ser un cuadro del propio
video: es lo que se ve mientras el video carga). `herramientas/fondos.html` los
muestra tal como se verían —con la persona delante, el objeto apoyado en su
lugar, el nombre al pie, y andando los que tienen video— para elegir mirando.

### El puente a MAITE

Cada vez que cambia la ingeniería que muestra, el espejo hace un `POST` a
`http://localhost:3000/api/carrera` con el
id que esa ingeniería tiene **del lado de MAITE** (los dos catálogos crecieron
por separado: "computacion" acá es "sistemas" allá, y eso se declara en el campo
`maite` de cada carrera). Al terminar la sesión hace `POST /api/humo` y las
tablets vuelven a su reposo.

Es de ida y nada más: el espejo no lee nada de MAITE, no espera su respuesta y no
comparte estado con él. Si MAITE no está levantado, tarda o contesta cualquier
cosa, la experiencia sigue exactamente igual y lo único que queda es un aviso en
la consola. Se apaga entero con `CONFIG.maite.activo`.

Sin bundler: módulos ES nativos servidos tal cual. **Cero dependencias de
producción** — el servidor sólo usa módulos de Node, y `@mediapipe/tasks-vision`
se copia a `vendor/` con `npm run vendorizar`. `npm install` hace falta para
correr las pruebas, no para que el stand funcione.

## Privacidad

La imagen de la cámara nunca sale de la PC. No se graba, no se guarda, no se
transmite y no se pide ningún dato al visitante. El procesamiento de rostro,
manos, silueta y puntos de pose ocurre íntegramente en el navegador local. Lo
único que viaja a MAITE es el nombre de una ingeniería.

## Documentación

- `docs/operacion.md` — guía para el equipo que opera el stand durante el evento.
- `docs/arquitectura.md` — arquitectura del sistema, módulos, máquina de estados, física y MediaPipe.
- `docs/contenido.md` — guía para agregar o modificar carreras, objetos PNG, figuras vectoriales y efectos.
- `docs/despliegue.md` — guía completa de puesta en marcha del stand y solución de problemas.
- `docs/superpowers/specs/` — las especificaciones de diseño de cada etapa y sus decisiones; la última, `2026-09-10-devolucion-de-la-catedra-design.md`, cuenta qué se hizo con cada punto de la segunda devolución de la cátedra.
- `docs/superpowers/plans/` — plan detallado de implementación tarea por tarea.
- `docs/planilla-de-tareas.md` y `.csv` — la planilla de tareas y horas de cada integrante: un borrador estimado desde el historial de git, para completar con las horas reales.
