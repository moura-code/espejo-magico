# Espejo Mágico — Operación del stand

Guía para el equipo que atiende el stand. No hace falta saber programar.

---

## Prender todo

1. **Encender la PC del espejo.**
2. **Doble clic en `herramientas\arrancar.bat`.** Aparecen una ventana negra chica
   (el servidor) y Chrome a pantalla completa. **No cerrar la ventana negra.**
3. **Hacer una prueba completa** antes de que entre el público: sentarse, esperar el
   sorteo, jugar un poco con las manos, levantarse y ver que las nubes vuelvan.

No hace falta router ni wifi: todo pasa dentro de esa PC.

## Apagar

Cerrar Chrome con `Alt` + `F4` y después la ventana negra del servidor.

---

## Atajos, en la PC del espejo

| Tecla | Qué hace |
|---|---|
| `1` a `9`, `0`, `-` y `=` | Fuerza una carrera y salta directo a la revelación |
| `ESPACIO` / `Enter` / `➔` | Avanza manualmente al siguiente estado |
| `A` | Alterna entre avance automático (reloj) y avance manual |
| `I` | Cambia qué hacen las manos: imán (junta los objetos) o manotazo |
| `D` | Modo demo: funciona sin cámara, con un rostro simulado |
| `M` | Muestra los puntos que el sistema detecta en la cara |
| `P` | Muestra u oculta el panel de estado |
| `R` | Corta la sesión y vuelve a la invitación |
| `Ctrl` + `R` | Recarga todo |

Es la fila de números entera, de izquierda a derecha: doce teclas para las doce
carreras, en el mismo orden en que están escritas en `contenido/carreras.json`.


---

## Si algo anda mal

**La pantalla dice "Sentate frente al espejo" y no reacciona a nadie.**
Apretar `P` y mirar la línea `camara`. Si dice algo distinto de `ok`, revisar el
cable de la cámara. El sistema reintenta solo cada cinco segundos: al reconectarla
se recupera sin tocar nada.

**Detecta mal, o detecta sólo a algunas personas.**
Casi siempre es luz. Si hay una ventana o un foco detrás del visitante, la cara
queda a contraluz y el sistema no la encuentra. Tapar esa fuente o girar el sillón.
La luz frontal difusa del stand tiene que estar encendida. Para confirmar que es
eso: apretar `M` y ver si aparecen los puntos sobre la cara.

**Al siguiente le tocó la misma carrera que al anterior, o entró en el medio de
una escena que ya estaba.**
Se sentó demasiado rápido. El espejo espera unos nueve segundos sin ver a nadie
antes de cerrar la sesión. La regla para la fila es simple: **que el siguiente se
siente recién cuando las nubes hayan vuelto a tapar la pantalla.** Si hay apuro,
apretar `R` en la PC corta la sesión al instante.

**La pantalla quedó en negro o dice "cargando…".**
Se cerró la ventana negra del servidor. Cerrar Chrome y volver a correr
`arrancar.bat`.

**Todo va lento.**
Apretar `P` y mirar `fps`. Por debajo de 25 se nota. Cerrar cualquier otro programa
de la PC. Si sigue lento, avisar al equipo técnico: hay que bajar `objetos.maximo`
en `espejo/config.js`.

**Siempre sale la misma carrera.**
No puede pasar: el sistema recorre las doce antes de repetir ninguna. Si pasa,
alguien está apretando la fila de números (`1` a `9`, `0`, `-`, `=`) sin querer.

**Aparecen círculos de colores en vez de dibujos.**
Falta ese PNG. Apretar `P` y mirar `png faltan`. No rompe nada: es el
comportamiento previsto para que el sistema nunca quede en negro.

---

## Privacidad

El sistema **no saca fotos, no graba video, no guarda ninguna imagen y no manda
nada a internet.** La cámara se procesa dentro de la PC y nada sale de ahí.

El cartel del stand lo dice y es literal. Si alguien pregunta, se puede afirmar sin
matices.

---

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Dibujos de cada carrera | `contenido/assets/<carrera>/` |
| Nombres, colores y frases | `contenido/carreras.json` |
| Duraciones y ajustes finos | `espejo/config.js` |

Para corregir el nombre de una carrera, su color o su frase se edita
`contenido/carreras.json` y listo: no hay que tocar una línea de código.

---

## Para el equipo técnico

**Preparar una máquina nueva.** Necesita Node.js y Chrome. Después:

```
npm install
npm run vendorizar    # baja MediaPipe y el modelo de rostro. Unica vez que necesita internet.
npm test              # suite automática
```

`npm run vendorizar` deja los archivos en `vendor/mediapipe/`, que no está en el
repositorio por su tamaño.

**Verificar que no depende de internet.** Desenchufar el cable, apagar el wifi de
la PC y correr `arrancar.bat`. Tiene que funcionar el ciclo entero. En la pestaña
*Red* de las herramientas de desarrollo (F12) sólo puede aparecer `localhost`.

El servidor no tiene dependencias: sólo usa módulos de Node. `npm install` hace
falta para correr las pruebas, no para que el stand funcione.

---

## Documentación complementaria

- `docs/arquitectura.md` — especificación técnica de la arquitectura, módulos, máquina de estados y física.
- `docs/contenido.md` — guía para creadores de contenido: PNG de objetos y figuras vectoriales.
- `docs/despliegue.md` — guía completa de puesta en marcha del stand y contingencias.

