# Espejo Mágico — Operación del stand

Guía para el equipo que atiende el stand. No hace falta saber programar.

---

## Prender todo

1. **Encender el router.** Esperar a que la luz de wifi quede fija.
2. **Encender la PC del espejo.**
3. **Doble clic en `herramientas\arrancar.bat`.** Aparecen una ventana negra chica
   (el servidor) y Chrome a pantalla completa. **No cerrar la ventana negra.**
4. **Encender las tablets.** Cada una abre sola su página si quedó guardada en la
   pantalla de inicio. Si no, abrir en cada una:
   `http://IP-DE-LA-PC:8080/tablet/tablet.html?slot=N`
   con un número distinto en cada tablet, empezando por `0`.
5. **Encender la tablet de controles** ubicada frente al espejo y abrir:
   `http://IP-DE-LA-PC:8080/tablet/controles.html`.
6. **Hacer una prueba completa** antes de que entre el público: acercarse, esperar el
   sorteo, completar el recorrido y ver que las tablets arranquen y se apaguen.

La ventana negra del servidor muestra la dirección de **Red local** que deben usar
las tablets. Como alternativa, abrir el menú de inicio, escribir `cmd` y ejecutar
`ipconfig`; usar el número que dice *Dirección IPv4*, como `192.168.1.20`.

## Apagar

Cerrar Chrome con `Alt` + `F4` y después la ventana negra del servidor.

---

## Atajos, en la PC del espejo

La tuerca de la esquina superior derecha abre la configuración. Desde ahí se
puede elegir la cámara y activar el modo demo, el avance manual o la malla de
diagnóstico sin usar el teclado.

La espera pregunta `¿Cómo es la cara de la ingeniería?`. Al detectar una cara,
el espejo aclara que no intenta adivinar a la persona y muestra una posibilidad.
Después de la escena explica que la carrera fue sorteada; no se muestran botones
de respuesta. En modo automático la experiencia continúa al terminar el tiempo;
en modo manual se usa `AVANZAR`. El cierre termina con `La ingeniería tiene
muchas caras. Una puede ser la tuya.`

Cuando no hay nadie, el espejo hace una animación periódica de cierre y apertura
en forma de caracol; es el comportamiento esperado.

La tablet frontal ofrece las mismas acciones con botones táctiles grandes. Su
contenido cambia automáticamente junto con el espejo: no hay que recargarla
entre participantes. Cuando el espejo está esperando muestra `EMPEZAR`. En modo
manual aparece `AVANZAR` cuando el flujo necesita pasar al estado siguiente; ya
no se muestra una instrucción amarilla sobre el espejo.

En avance automático, el aro de la esquina inferior izquierda del espejo indica
cuántos segundos faltan para el siguiente paso. Durante la espera y el avance
manual no aparece, porque el cambio depende de detectar a una persona o tocar un
botón.

| Tecla | Qué hace |
|---|---|
| `1` a `9` | Fuerza una de las primeras nueve propuestas y salta directo a la revelación |
| `R` | Corta la sesión y vuelve a la invitación |
| `C` | Cambia a la siguiente cámara disponible |
| `D` | Demo automática: prueba el ciclo completo y todas las carreras |
| `M` | Muestra los puntos que el sistema detecta en la cara |
| `P` | Muestra u oculta el panel de estado |
| `Ctrl` + `R` | Recarga todo |

El orden de las teclas `1` a `9` es el mismo que el de las propuestas en
`assets/carreras.json`.

La cámara elegida con `C` queda guardada aunque Chrome se recargue. Para confirmar
cuál está activa, apretar `P` y mirar la línea `camara`.

La demo controla el avance automáticamente aunque el interruptor manual estuviera
activo. Primero deja la pantalla vacía para probar el caracol y luego recorre
todos los estados y las 18 propuestas. Al salir de la demo restaura el ajuste de
avance anterior.

---

## Si algo anda mal

**La pantalla dice "¿Cómo es la cara de la ingeniería?" y no reacciona a nadie.**
Apretar `P` y mirar la línea `camara`. Si dice algo distinto de `ok`, revisar el
cable de la cámara. El sistema reintenta solo cada cinco segundos: al reconectarla
se recupera sin tocar nada.

**Detecta mal, o detecta sólo a algunas personas.**
Casi siempre es luz. Si hay una ventana o un foco detrás del visitante, la cara
queda a contraluz y el sistema no la encuentra. Tapar esa fuente o girar el sillón.
La luz frontal difusa del stand tiene que estar encendida. Para confirmar que es
eso: apretar `M` y ver si aparecen los puntos sobre la cara.

**Las tablets no arrancan.**
Apretar `P` y mirar la línea `bus`:
- Dice `CORTADO` → el servidor se cayó. Cerrar todo y volver a correr `arrancar.bat`.
- Dice `conectado` → el problema es de la tablet. Revisar que esté en el wifi del
  router del stand y recargar su página.

**Una sola tablet quedó negra.**
Recargar esa página. Se pone al día sola en la sesión siguiente, o antes.

**Todo va lento.**
Apretar `P` y mirar `fps`. Por debajo de 25 se nota. Cerrar cualquier otro programa
de la PC. Si sigue lento, avisar al equipo técnico: hay que bajar `objetos.maximo`
en `espejo/config.js`.

**Siempre sale la misma carrera.**
No puede pasar: el sistema recorre las 18 antes de repetir ninguna. Si pasa,
alguien está usando los atajos numéricos sin querer.

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
| Dibujos de cada carrera | `assets/<carrera>/` |
| Videos de las referentes | `assets/videos/<carrera>/` |
| Logo institucional FING–Udelar | `assets/logos/fing-udelar-horizontal-diapo.png` |
| Iconos de la interfaz | `assets/iconos/` |
| Nombres, categorías, enlaces, colores, finalidades y testimonios | `assets/carreras.json` |
| Duraciones y ajustes finos | `espejo/config.js` |

La sensibilidad del texto lateral se calibra en
`CONFIG.render.textoAdaptativo`, dentro de `espejo/config.js`. El valor
`relacionMinimaLateral` decide desde qué proporción de pantalla se usa el espacio
lateral y `histeresisHorizontal` controla cuánto debe cruzar la persona antes de
que el texto cambie de lado.

Para corregir el nombre de una referente **no hay que volver a renderizar el
video**: se edita `assets/carreras.json` y listo. Lo mismo con los colores, las
frases y los nombres de las carreras.

---

## Para el equipo técnico

**Preparar una máquina nueva.** Necesita Node.js y Chrome. Después:

```
npm install
npm run vendorizar    # baja MediaPipe y los modelos de rostro, manos y pose. Unica vez con internet.
npm test              # pruebas automatizadas
```

`npm run vendorizar` deja los archivos en `vendor/mediapipe/`, que no está en el
repositorio por su tamaño.

**Verificar que no depende de internet.** Desenchufar el cable, apagar el wifi de
la PC y correr `arrancar.bat`. Tiene que funcionar el ciclo entero. En la pestaña
*Red* de las herramientas de desarrollo (F12) sólo puede aparecer `localhost`.
