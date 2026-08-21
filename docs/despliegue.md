# Espejo Mágico — Guía de Despliegue y Montaje de Stand

Esta guía describe los requisitos de hardware, los pasos de puesta en marcha, la operación en vivo y la resolución de problemas para el **Espejo Mágico** durante un evento o feria.

La instalación es una sola PC con una cámara y una pantalla. No hay red, no hay segundas pantallas y no hay Internet.

---

## 1. Equipamiento Necesario

### 1.1. PC Principal (Espejo)
- **Sistema Operativo:** Windows 10/11 o Linux.
- **Software:** Node.js (v18 o superior) y Google Chrome.
- **Cámara:** Webcam HD/FHD (1080p recomendada) con cable USB estable.
- **Pantalla:** Televisor o monitor grande montado en **posición vertical (1080 × 1920)** con marco decorativo de espejo.

### 1.2. Red
**Ninguna.** La instalación entera corre en esa sola PC: no hace falta router, ni Wi-Fi, ni cable de red. El servidor local sólo entrega archivos a la pestaña de Chrome de la propia máquina.

---

## 2. Preparación e Instalación en la PC (Primera vez)

1. Clonar o copiar la carpeta del repositorio en la PC del evento.
2. Abrir una terminal en la raíz del proyecto y ejecutar:
   ```bash
   npm install
   npm run vendorizar
   ```
   > **Nota importante:** `npm run vendorizar` copia la librería MediaPipe a `vendor/mediapipe/` y descarga los modelos visuales. **Este es el único paso en todo el proyecto que requiere conexión a Internet**.

3. Verificar las pruebas automáticas del sistema:
   ```bash
   npm test
   ```
   Toda la suite debe finalizar con resultado positivo (verde).

---

## 3. Pasos para la Puesta en Marcha el Día del Evento

### Paso único: Arrancar el Espejo Mágico
Encender la PC y hacer doble clic en el ejecutable:
```
herramientas\arrancar.bat
```
Esto realizará automáticamente dos acciones:
1. Iniciará el servidor local de Node.js en una ventana minimizada en el puerto `8080`.
2. Lanzará Google Chrome a pantalla completa (modo `--kiosk`) en `http://localhost:8080/espejo/espejo.html`.

> [!CRITICAL]
> **El espejo debe abrirse siempre mediante `localhost`** (`http://localhost:8080/espejo/espejo.html`), nunca utilizando la IP local de la máquina. Google Chrome restringe el acceso a la cámara web (`getUserMedia`) únicamente a orígenes seguros (`localhost` o HTTPS).

### Flags de Arranque de Chrome Utilizados en `arrancar.bat`
```cmd
chrome.exe ^
  --kiosk ^
  --user-data-dir="%~dp0..\.perfil-chrome" ^
  --autoplay-policy=no-user-gesture-required ^
  --use-fake-ui-for-media-stream ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --noerrdialogs ^
  --disable-features=Translate,TranslateUI ^
  "http://localhost:8080/espejo/espejo.html"
```
- `--use-fake-ui-for-media-stream`: Concede el permiso de cámara automáticamente sin mostrar diálogos emergentes al usuario.
- `--autoplay-policy=no-user-gesture-required`: Permite la reproducción de animaciones sin clic inicial.
- `--user-data-dir`: Utiliza un perfil aislado para no interferir con el Chrome personal.

---

## 4. Prueba Completa de Verificación

Antes de abrir el stand al público:
1. **Levantar MAITE primero** (`cd MAITE && npm start`) y comprobar que su panel responde en `http://localhost:3000/control`. El espejo funciona sin él, pero las tablets no se van a mover.
2. **Desconectar la PC de cualquier red externa / Internet.** En la pestaña *Red* de las herramientas de desarrollo (F12) sólo pueden aparecer `localhost:8080` y `localhost:3000`.
3. Sentarse en el sillón del visitante frente al espejo.
4. Verificar que **entre el humo** al sentarse y que al disiparse queden **cinco objetos** flotando en arco alrededor de los hombros.
5. **Probar el sostenido:** poner la mano sobre un objeto y mantenerla. El anillo tiene que llenarse en un segundo y medio largo y elegir. Si el anillo va y viene sin llenarse, subir `CONFIG.eleccion.msDeGracia`; si elige sin querer al pasar la mano, subir `msParaElegir`.
6. **Probar desde el fondo del stand, no sólo de cerca.** Los objetos se acomodan solos según el ancho de hombros, pero es acá donde se calibra a qué distancia poner el sillón: tienen que quedar cómodos de alcanzar sin estirar el brazo del todo.
7. Al elegir, verificar que **las cuatro tablets cambien** a la gente de esa carrera. Si no cambian, abrir el panel (`P`) y mirar la línea `maite`: dice si el espejo llegó a avisar o si el problema está del otro lado.
8. Confirmar que aparezca el **fondo de la ingeniería detrás de la persona**, no encima. Si se ve la persona lavada bajo el fondo, la máscara de silueta no está: mirar la línea `pose` del panel.
9. **Sentarse quieto un par de minutos.** La escena tiene que seguir siendo suya: si se corta sola, revisar `CONFIG.tiempos.sesionMaxima` y `CONFIG.presencia.msParaSalir`.
10. **Sentarse y no elegir nada.** A los 30 segundos el espejo tiene que resolver solo y revelar una carrera: nadie se va sin ingeniería y la fila no se traba.
11. Levantarse del sillón y verificar que la escena se cierre, que las nubes vuelvan a cubrir el espejo y que **las tablets vuelvan a su humo**. Son unos **nueve segundos** desde que uno se levanta: seis de ausencia (`ausenciaParaCortar` más `presencia.msParaSalir`) y tres de cierre.
12. **Probar el relevo:** levantarse y que se siente otra persona. Tiene que recibir sus propios cinco objetos, no seguir en la escena de la anterior. Si se sienta antes de esos nueve segundos, hereda la escena — es un límite conocido, no una falla de calibración.

---

## 5. Teclas de Operación Ocultas (Control de Stand)

Estas teclas permiten al equipo del stand operar o resolver imprevistos sin interrumpir la experiencia:

| Tecla | Acción | Descripción |
|---|---|---|
| `P` | **Panel HUD de Estado** | Muestra u oculta métricas en vivo: FPS, estado, carreras ofrecidas, carrera elegida, cámara, manos, progreso del sostenido, silueta, humo, **último envío a MAITE** y PNG faltantes. |
| `1`–`9`, `0`, `-`, `=` | **Forzar Carrera** | Salta directamente a la revelación de la ingeniería correspondiente, y le avisa a MAITE. Es la fila de números entera: una tecla por carrera, en el orden de `carreras.json`. |
| `A` | **Modo Auto / Manual** | Alterna entre avance automático por reloj y avance manual por teclado. |
| `ESPACIO` / `Enter` | **Avanzar Estado** | Avanza manualmente al siguiente estado (útil en pruebas o demostraciones). |
| `D` | **Modo Demo** | Simula un rostro en movimiento sin requerir cámara real. |
| `M` | **Malla Facial** | Muestra los puntos (landmarks) de detección de cara y manos sobre el video. |
| `R` | **Reiniciar Sesión** | Corta la escena actual y retorna al estado de atracción en reposo. |
| `Ctrl` + `R` | **Recargar Página** | Recarga la aplicación del espejo por completo. |

---

## 6. Solución de Problemas Frecuentes (*Troubleshooting*)

### La pantalla indica "Sentate frente al espejo" y no detecta a nadie
1. Presionar `P` para abrir el panel de control.
2. Observar la línea `camara`:
   - Si dice algo distinto de `ok` (ej. `sin camara`), revisar la conexión del cable USB de la webcam. El sistema reintenta automáticamente la conexión cada 5 segundos.
   - Si dice `ok` pero no detecta, presionar `M` para ver la malla. Si los puntos no aparecen, el problema suele ser la iluminación (contraluz). Asegurarse de encender la luz frontal difusa del stand o evitar ventanas detrás del sillón.

### La pantalla queda en negro o dice "cargando…" y no arranca
- El servidor de Node.js se cerró o nunca levantó. Cerrar Chrome y volver a correr `arrancar.bat`. **No cerrar la ventana negra del servidor mientras el stand esté abierto.**
- Si dice "MediaPipe no cargó", falta `npm run vendorizar` (el único paso que necesita Internet). Abrir la consola con F12 para ver el detalle.

### Aparecen círculos de colores en lugar de imágenes de objetos
- Presionar `P` y observar la línea `png faltan`. Significa que los archivos PNG aún no se han subido a `contenido/assets/`. Es un comportamiento previsto de reserva (*fallback*); el espejo funcionará normalmente utilizando figuras vectoriales de código.

### La experiencia se siente lenta o con tirones
1. Presionar `P` y revisar los `fps`.
2. Si el valor es inferior a 30 FPS, cerrar otras aplicaciones abiertas en la PC.
3. Si continúa lento, bajar `CONFIG.pose.fpsConFondo` en `espejo/config.js`: es lo más caro del cuadro, porque cada lectura de la silueta cuesta un viaje de la GPU a la CPU. El borde del recorte se va a ver un poco más atrasado, nada más.
4. Como último recurso, `CONFIG.pose.segmentacion: false` apaga el recorte entero: el fondo se dibuja semitransparente encima del espejo y el espejo vuelve a ir sobrado.

### Nadie consigue elegir un objeto
1. Presionar `P` y mirar la línea `manos`. Si dice `0 vistas`, la mano no se está detectando: revisar luz y encuadre (`M` muestra los puntos sobre los dedos).
2. Si el `progreso` de la línea `eleccion` sube y baja sin llegar a 100 %, la detección está entrecortada: subir `CONFIG.eleccion.msDeGracia`.
3. Si los objetos quedan fuera del alcance del brazo, ajustar `CONFIG.tablero.radioFactor` (más chico = más cerca del cuerpo).

### Las tablets no acompañan al espejo
1. Presionar `P` y mirar la línea `maite`.
   - `carrera <id> ok` — el espejo avisó bien; el problema está del lado de las tablets.
   - `carrera <id> FALLO` — MAITE no está levantado, se cayó, o le falta el middleware de CORS en `MAITE/server.js`.
   - `sin-par-en-maite` — esa carrera tiene `maite: null` en `carreras.json`. No es una falla.
   - `apagado` — `CONFIG.maite.activo` está en `false`.
2. Comprobar a mano que MAITE responde: abrir `http://localhost:3000/control` en otra pestaña.
3. El espejo **nunca** se rompe por esto: si las tablets no están, la experiencia sigue igual.

---

## 7. Apagado al Finalizar la Jornada

1. Presionar `Alt` + `F4` en la PC del espejo para cerrar Chrome.
2. Cerrar la ventana del servidor de Node.js.
