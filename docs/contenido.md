# Espejo Mágico — Guía de Contenido y Diseño

Esta guía explica cómo agregar, editar o reemplazar carreras, objetos, referentes en tablets y efectos visuales en el **Espejo Mágico**.

Toda la definición de contenido se gestiona desde **`contenido/carreras.json`**. Agregar o cambiar una carrera no requiere modificar código en JavaScript.

---

## 1. Estructura de `contenido/carreras.json`

El catálogo contiene doce carreras. Cada carrera dentro de la lista `"carreras"` incluye los siguientes campos:

```json
{
  "id": "computacion",
  "nombre": "Ingeniería en Computación",
  "color": "#00E5A0",
  "frase": "Diseño de sistemas de cómputo, del hardware al software",
  "efecto": "codigo",
  "objetos": [
    { "img": "assets/computacion/laptop.png", "figura": "laptop", "escala": 0.2, "peso": 1 },
    { "img": "assets/computacion/procesador.png", "figura": "chip", "escala": 0.18, "peso": 1 }
  ],
  "referentes": [
    { "video": "videos/computacion/ana.mp4", "nombre": "Ana Rodríguez", "detalle": "Egresada de Ingeniería en Computación" },
    { "video": "videos/computacion/lucia.mp4", "nombre": "Lucía Fernández", "detalle": "Docente e Investigadora" }
  ]
}
```

---

## 2. Definición de Campos por Carrera

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único sin acentos ni espacios (ej: `mecanica`, `forestal`, `quimica`). |
| `nombre` | `string` | Nombre oficial completo visible en la pantalla del espejo durante la revelación y escena. |
| `color` | `string` | Color hexadecimal distintivo de la carrera. Usado para textos, partículas y siluetas. |
| `frase` | `string` | Frase descriptiva institucional que acompaña al nombre de la carrera en pantalla. |
| `efecto` | `string` | Nombre del efecto visual de fondo (`engranajes`, `burbujas`, `chispas`, `codigo`, `planos`, `formulas`). |
| `objetos` | `array` | Lista de 6 o más elementos flotantes/caóticos característicos de la carrera. |
| `referentes` | `array` | Lista de videos e información para proyectar en las tablets periféricas. |

---

## 3. Objetos Caen y Flotan

Cada carrera declara 6 objetos que caen desde la parte superior, rebotan físicamente contra la cabeza y se atraen magnéticamente a las manos.

### Campos de cada objeto:
- **`img`**: Ruta al PNG transparente recortado (ej: `assets/mecanica/engranaje.png`).
- **`figura`**: Nombre de la figura vectorial de reserva en `espejo/figuras.js` (ej: `engranaje`).
- **`escala`**: Factor de tamaño relativo respecto al ancho de la pantalla (típicamente entre `0.14` y `0.24`).
- **`peso`**: Peso físico relativo para el cálculo de gravedad y rebotes (por defecto `1`).

---

## 4. Videos de Referentes para Tablets

Las tablets distribuidas alrededor del espejo muestran a mujeres referentes (estudiantes, docentes, investigadoras, egresadas) de la ingeniería sorteada.

### Formato de Video Requerido
- **Contenedor/Codec:** MP4 (H.264 / AAC).
- **Audio:** No requerido (el sistema fuerza la reproducción en modo `muted` para garantizar el inicio sin restricciones de navegador).
- **Formato:** Video vertical u horizontal optimizado para pantalla completa en la tablet.

### Asignación de Slots
Las tablets abren la URL con el parámetro de slot: `http://<IP-PC>:8080/tablet/tablet.html?slot=0`, `slot=1`, etc.
- La `slot 0` mostrará la primera referente del arreglo `referentes` de la carrera.
- La `slot 1` mostrará la segunda referente, y así sucesivamente.
- Si hay más tablets conectadas que referentes definidas, los slots vuelven a rotar cíclicamente.

> **Edición de Nombres sin Re-renderizado:**
> El nombre y detalle de la referente se dibujan dinámicamente como texto HTML/CSS sobre el video. Para corregir un error ortográfico o cambiar el nombre de una docente **no es necesario volver a editar el video MP4**: basta con actualizar `contenido/carreras.json`.

---

## 5. Sistema de Fallback Vectorial (`espejo/figuras.js`)

Si un archivo PNG de objeto no existe aún en el disco, el espejo utiliza **figuras vectoriales dibujadas por código Canvas 2D**.
Además, se dispone del comando:
```bash
npm run generar-pngs
```
que genera automáticamente los PNGs de reserva a partir de las figuras vectoriales sin sobreescribir los archivos de fotos reales.

Existen 36 figuras vectoriales registradas en `espejo/figuras.js`:
- `engranaje`, `llave`, `piston`, `resorte`, `rodamiento`, `motor`
- `matraz`, `gota`, `molecula`, `tubo`, `lampara`, `bateria`
- `rayo`, `resistencia`, `panel-solar`, `onda`, `laptop`, `robot`
- `chip`, `llaves`, `servidor`, `dron`, `teodolito`, `plano`
- `prisma`, `sumatoria`, `pi`, `integral`, `atomo`, `curva`
- `grua`, `puente`, `ladrillo`, `viga`, `mechero`, `pipeta`

Para previsualizar y validar todas las figuras vectoriales disponibles:
```
http://localhost:8080/herramientas/figuras.html
```

---

## 6. Efectos Visuales de Fondo (`espejo/efectos.js`)

Los efectos de partículas asignados a cada carrera se dibujan detrás del participante para sumergirlo en la ambientación sin oscurecer su rostro:

| Efecto | Descripción Visual |
|---|---|
| `engranajes` | Engranajes vectoriales girando suavemente en el fondo. |
| `burbujas` | Burbujas transparentes flotando hacia arriba con deformación. |
| `chispas` | Arcos eléctricos y destellos de energía que saltan entre puntos. |
| `codigo` | Columnas de matriz de código binario y caracteres cayendo. |
| `planos` | Trazo dinámico de grillas de diseño técnico y vectores. |
| `formulas` | Símbolos matemáticos y físicos ($\pi, \Sigma, \int, \infty$) orbitando. |

---

## 7. Verificación de Contenido Reales (`npm run listo`)

Para comprobar si todos los archivos multimedia reales (72 PNGs de objetos y los videos MP4 de referentes) están presentes en las carpetas de `contenido/`, ejecute:

```bash
npm run listo
```

- **En Rojo (Faltan archivos):** Es el comportamiento esperado durante la etapa de desarrollo antes de recibir las entregas de video. El espejo funcionará perfectamente usando los objetos recortados y figuras de reserva.
- **En Verde (Completo):** Confirma que todo el contenido multimedia final está listo para el stand del evento.
