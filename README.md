# Espejo Mágico

Instalación interactiva para el stand de una Facultad de Ingeniería.

Un visitante se sienta frente a una pantalla enmarcada como espejo, que descansa
cubierta de nubes. Una cámara detecta su rostro, las nubes se apartan hacia los
lados, y le sortea una de doce ingenierías: el participante aparece rodeado de objetos
característicos de esa carrera que caen, rebotan contra su cabeza y se juntan
como un imán alrededor de sus manos (o se manotean, con la tecla `I`). La escena
dura mientras la persona siga sentada; tras cinco segundos sin detectarla, las
nubes vuelven a cubrir el espejo. En simultáneo, unas tablets alrededor
reproducen videos de mujeres vinculadas a esa disciplina.

Todo corre en el navegador, en una sola PC, **sin conexión a internet**.

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

> El espejo tiene que abrirse por **`localhost`**, nunca por la IP de la máquina:
> Chrome sólo entrega la cámara en contextos seguros. Las tablets sí van por IP,
> porque no usan cámara.

## Comandos

| Comando | Para qué |
|---|---|
| `npm test` | ¿Funciona el código? La suite tiene que estar en verde siempre. |
| `npm run listo` | ¿Se puede montar el stand? Verifica que el contenido real esté completo. Está en rojo hasta que lleguen los PNG y los videos, y eso es lo esperado. |
| `npm run vendorizar` | Copia MediaPipe y baja los modelos de rostro y manos. |
| `npm run generar-pngs` | Genera el PNG de respaldo de los objetos que no tengan imagen (no pisa existentes). Necesita Chrome; no usa red. |
| `npm start` | Levanta el servidor local. |

## Atajos, en la PC del espejo

| Tecla | Qué hace |
|---|---|
| `ESPACIO` | Avanza al estado siguiente (modo manual) |
| `A` | Alterna avance manual / automático |
| `1`–`9` | Fuerza una de las primeras nueve carreras y salta a la revelación |
| `R` | Corta la sesión y vuelve a la invitación |
| `I` | Cambia qué hacen las manos: imán (junta los objetos) o manotazo |
| `D` | Modo demo: funciona sin cámara |
| `M` | Muestra los puntos que el sistema detecta en cara y manos |
| `P` | Panel de estado y FPS |

`herramientas/figuras.html` muestra las treinta y seis figuras de los objetos en
una grilla, sobre fondo oscuro, claro o tono de piel.

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
nombre, color, frase, objetos, efecto de partículas y referentes. Agregar o
cambiar una carrera no toca una línea de código.

Los objetos que caen son fotografías reales con el fondo recortado, tomadas de
Wikimedia Commons con licencias libres (dominio público, CC0, CC BY o CC BY-SA;
autor y origen de cada archivo en `contenido/assets/CREDITOS.md`). El orden de
preferencia al dibujar es **PNG → figura → círculo del color**: si un PNG
falta, `npm run generar-pngs` rasteriza la figura vectorial de respaldo
(`espejo/figuras.js`) sin pisar los existentes, y los definitivos de diseño
reemplazan a cualquiera en la misma ruta, sin tocar código.

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
