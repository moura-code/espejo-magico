# Espejo Mágico — Guía de Despliegue y Montaje de Stand

Esta guía describe los requisitos de hardware, la configuración de red local, los pasos de puesta en marcha, la operación en vivo y la resolución de problemas para el **Espejo Mágico** durante un evento o feria.

---

## 1. Equipamiento Necesario

### 1.1. PC Principal (Espejo)
- **Sistema Operativo:** Windows 10/11 o Linux.
- **Software:** Node.js (v18 o superior) y Google Chrome.
- **Cámara:** Webcam HD/FHD (1080p recomendada) con cable USB estable.
- **Pantalla:** Televisor o monitor grande montado en **posición vertical (1080 × 1920)** con marco decorativo de espejo.

### 1.2. Red y Tablets
- **Router Wi-Fi Dedicado:** Router propio para el stand. **No requiere conexión a Internet**.
- **Tablets:** 3 a 5 tablets (Android o iPad) montadas alrededor del marco del espejo con navegadores web modernos.

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

### Paso 1: Encender el Router Wi-Fi
Enchufar el router del stand. Esperar a que la red Wi-Fi del stand esté activa y visible.

### Paso 2: Conectar la PC y obtener su Dirección IP
Conectar la PC del espejo al router (por cable Ethernet o Wi-Fi).
Para obtener la dirección IP de la PC:
- **En Windows:** Abrir `cmd` y ejecutar `ipconfig`. Buscar la *Dirección IPv4* (ejemplo: `192.168.1.50`).
- **En Linux:** Abrir terminal y ejecutar `ip a` o `hostname -I`.

### Paso 3: Arrancar el Espejo Mágico
En Windows, hacer doble clic en el ejecutable:
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

### Paso 4: Conectar y Configurar las Tablets

1. Conectar cada tablet a la red Wi-Fi del router del stand.
2. En la primera tablet, abrir en el navegador web:
   ```
   http://<IP-DE-LA-PC>:8080/tablet/tablet.html?slot=0
   ```
3. En la segunda tablet, abrir:
   ```
   http://<IP-DE-LA-PC>:8080/tablet/tablet.html?slot=1
   ```
4. Repetir incrementando el número de `slot` para cada tablet adicional.
5. Poner los navegadores de las tablets en modo pantalla completa y añadir el enlace a la pantalla de inicio para acceso rápido.

---

## 4. Prueba Completa de Verificación

Antes de abrir el stand al público:
1. **Desconectar la PC de cualquier red externa / Internet.**
2. Sentarse en el sillón del visitante frente al espejo.
3. Verificar que la niebla se agite y se abra al detectar el rostro.
4. Confirmar que los objetos caigan y respondan al movimiento de la cabeza y las manos.
5. Comprobar que las tablets inicien la reproducción del video de su slot asignado.
6. Levantarse del sillón y verificar que a los 3 segundos la escena se cierre y las nubes vuelvan a cubrir el espejo.

---

## 5. Teclas de Operación Ocultas (Control de Stand)

Estas teclas permiten al equipo del stand operar o resolver imprevistos sin interrumpir la experiencia:

| Tecla | Acción | Descripción |
|---|---|---|
| `P` | **Panel HUD de Estado** | Muestra u oculta métricas en vivo: FPS, estado, cámara, objetos, bus WebSocket. |
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

### Las tablets no reaccionan al sorteo
1. En la PC del espejo, presionar `P` y verificar la línea `bus`:
   - **`CORTADO`**: El servidor de Node.js se cerró. Cerrar Chrome, abrir `cmd` y reiniciar con `arrancar.bat`.
   - **`conectado`**: El servidor funciona. El problema está en la red de la tablet. Verificar que la tablet continúe conectada al Wi-Fi del router y recargar la página en la tablet.

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
3. Apagar las tablets y el router.
