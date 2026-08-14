# Espejo Mágico — Guía de Contenido y Diseño

Esta guía explica cómo agregar, editar o reemplazar carreras, objetos, accesorios, referentes en tablets y efectos visuales en el **Espejo Mágico**.

Toda la definición de contenido se gestiona desde **`contenido/carreras.json`**. Agregar o cambiar una carrera no requiere modificar código en JavaScript.

---

## 1. Estructura de `contenido/carreras.json`

Cada carrera dentro de la lista `"carreras"` contiene los siguientes campos:

```json
{
  "id": "computacion",
  "nombre": "Ingeniería en Computación",
  "color": "#00E5A0",
  "frase": "Diseño de sistemas de cómputo, del hardware al software",
  "efecto": "codigo",
  "accesorio": {
    "img": "assets/computacion/gafas-vr.png",
    "anclaOjoIzq": [0.28, 0.52],
    "anclaOjoDer": [0.72, 0.52],
    "offsetY": 0
  },
  "objetos": [
    { "img": "assets/computacion/laptop.png", "figura": "laptop", "escala": 0.2, "peso": 1 },
    { "img": "assets/computacion/robot.png", "figura": "robot", "escala": 0.22, "peso": 1 }
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
| `id` | `string` | Identificador único sin acentos ni espacios (ej: `mecanica`, `quimica`). Usado en rutas de archivos y protocolos. |
| `nombre` | `string` | Nombre oficial completo visible en la pantalla del espejo durante la revelación y escena. |
| `color` | `string` | Color hexadecimal distintivo de la carrera. Usado para textos, efectos de partículas y figuras vectoriales. |
| `frase` | `string` | Frase descriptiva institucional que acompaña al nombre de la carrera en pantalla. |
| `efecto` | `string` | Nombre del efecto visual de fondo (`engranajes`, `burbujas`, `chispas`, `codigo`, `planos`, `formulas`). |
| `accesorio` | `object` | Definición del objeto 2D anclado al rostro del participante. |
| `objetos` | `array` | Lista de elementos flotantes/caóticos característicos de la carrera. |
| `referentes` | `array` | Lista de videos e información para proyectar en las tablets periféricas. |

---

## 3. Accesorios Anclados al Rostro

El accesorio (gafas, casco, antiparras, cofia, etc.) sigue los movimientos e inclinaciones de la cabeza de la persona.

### Requisitos del PNG
- Archivo PNG con fondo transparente.
- Orientación horizontal nivelada.
- Recomendado: lado mayor entre 512 px y 1024 px.

### Calibración de Anclajes de Ojos
En `contenido/carreras.json`, el accesorio declara dónde se ubican los ojos **dentro de la propia imagen**, en coordenadas normalizadas (rango $0.0$ a $1.0$, donde $[0, 0]$ es la esquina superior izquierda y $[1, 1]$ la inferior derecha):

- **`anclaOjoIzq`**: `[x, y]` del centro de la lente/ojo izquierdo del accesorio.
- **`anclaOjoDer`**: `[x, y]` del centro de la lente/ojo derecho del accesorio.
- **`offsetY`**: Ajuste vertical relativo.
  - `0`: Para gafas o antiparras que se apoyan exactamente en los ojos.
  - `-0.4` a `-0.5`: Para cascos o gorras que deben quedar apoyados sobre la frente/cabeza por encima de los ojos.

---

## 4. Objetos Caen y Flotan

Cada carrera declara de 6 a 10 objetos que caen, rebotan contra la cabeza y se atraen magnéticamente a las manos.

### Campos de cada objeto:
- **`img`**: Ruta al PNG real (ej: `assets/mecanica/engranaje.png`).
- **`figura`**: Nombre de la figura vectorial de reserva en `espejo/figuras.js` (ej: `engranaje`).
- **`escala`**: Factor de tamaño relativo respecto al ancho de la pantalla (típicamente entre `0.14` y `0.24`).
- **`peso`**: Peso físico relativo para el cálculo de gravedad y rebotes (por defecto `1`).

---

## 5. Videos de Referentes para Tablets

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

## 6. Sistema de Fallback Vectorial (`espejo/figuras.js`)

Mientras los diseñadores gráficos no entreguen los PNGs definitivos de los objetos, el espejo utiliza **figuras vectoriales dibujadas por código Canvas 2D**.

Actualmente existen 36 figuras vectoriales registradas en `espejo/figuras.js`:
- `engranaje`, `llave`, `piston`, `resorte`, `rodamiento`, `motor`
- `matraz`, `gota`, `molecula`, `tubo`, `lampara`, `bateria`
- `rayo`, `resistencia`, `panel-solar`, `onda`, `laptop`, `robot`
- `chip`, `llaves`, `servidor`, `dron`, `teodolito`, `plano`
- `prisma`, `sumatoria`, `pi`, `integral`, `atomo`, `curva`
- `grua`, `puente`, `ladrillo`, `viga`, `mechero`, `pipeta`

Para previsualizar y validar todas las figuras vectoriales disponibles, abra la herramienta local:
```
http://localhost:8080/herramientas/figuras.html
```

---

## 7. Efectos Visuales de Fondo (`espejo/efectos.js`)

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

## 8. Verificación de Contenido Reales (`npm run listo`)

Para comprobar si todos los archivos multimedia reales (PNGs de objetos, PNGs de accesorios y videos MP4 de referentes) están presentes en las carpetas de `contenido/`, ejecute:

```bash
npm run listo
```

- **En Rojo (Faltan archivos):** Es el comportamiento esperado durante la etapa de desarrollo antes de recibir las entregas del equipo de diseño. El espejo funcionará perfectamente usando las figuras vectoriales de reserva.
- **En Verde (Completo):** Confirma que todo el contenido multimedia final está listo para el stand del evento.
