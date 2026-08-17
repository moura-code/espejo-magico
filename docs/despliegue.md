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
1. **Desconectar la PC de cualquier red externa / Internet.** En la pestaña *Red* de las herramientas de desarrollo (F12) sólo puede aparecer `localhost`.
2. Sentarse en el sillón del visitante frente al espejo.
3. Verificar que la niebla se agite durante el sorteo y se aparte hacia los costados al revelar la carrera.
4. Confirmar que los objetos caigan y respondan al movimiento de la cabeza y las manos.
5. **Sentarse quieto un par de minutos.** La escena tiene que seguir siendo suya: si se corta sola, hay que revisar `CONFIG.tiempos.sesionMaxima` y `CONFIG.presencia.msParaSalir`.
6. Probar desde el fondo del stand, no sólo de cerca: así se calibra a qué distancia poner el sillón.
7. Levantarse del sillón y verificar que la escena se cierre y las nubes vuelvan a cubrir el espejo. Son unos **nueve segundos** desde que uno se levanta: seis de ausencia (`ausenciaParaCortar` más `presencia.msParaSalir`) y tres de cierre.
8. **Probar el relevo:** levantarse y que se siente otra persona. Tiene que recibir su propio sorteo, no seguir en la escena de la anterior. Si se sienta antes de esos nueve segundos, hereda la escena — es un límite conocido, no una falla de calibración.

---

## 5. Teclas de Operación Ocultas (Control de Stand)

Estas teclas permiten al equipo del stand operar o resolver imprevistos sin interrumpir la experiencia:

| Tecla | Acción | Descripción |
|---|---|---|
| `P` | **Panel HUD de Estado** | Muestra u oculta métricas en vivo: FPS, estado, carrera, cámara, manos detectadas, objetos y PNG faltantes. |
| `1`–`9`, `0`, `-`, `=` | **Forzar Carrera** | Salta directamente a la revelación de la ingeniería correspondiente. Es la fila de números entera: una tecla por carrera, en el orden de `carreras.json`. |
| `I` | **Modo Imán / Manotazo** | Alterna la interacción de las manos entre atracción magnética y golpe físico. |
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
3. Si continúa lento, reducir el límite de objetos en `espejo/config.js` modificando la constante `CONFIG.objetos.maximo`.

---

## 7. Apagado al Finalizar la Jornada

1. Presionar `Alt` + `F4` en la PC del espejo para cerrar Chrome.
2. Cerrar la ventana del servidor de Node.js.
