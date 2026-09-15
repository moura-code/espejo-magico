# Diseño: Gestión de Contenido por Estructura de Carpetas

- **Fecha:** 2026-09-14
- **Estado:** Aprobado para planificación
- **Rama:** `refactor/contenido-por-carpetas`

## 1. Contexto y Objetivos

Actualmente, el contenido del Espejo Mágico (carreras, objetos y fondos) se gestiona de manera centralizada en un archivo manual `contenido/carreras.json`, con rutas de imágenes explícitas (`assets/computacion/procesador.png`, etc.). Esto genera una doble fuente de verdad: los archivos físicos en disco y las declaraciones dentro del JSON.

Además, el diseño previo asumía que el primer objeto de la lista `objetos` era de forma estática el "objeto principal" que representaba a la carrera en el carrusel y que los tres restantes se escondían en el fondo en un orden rígido.

### Objetivos Principales:
1. **La estructura de carpetas es la fuente de verdad**:
   - Cada carrera tiene su carpeta.
   - Cada objeto tiene su propia carpeta con `imagen.png` y `metadata.json`.
   - Cada fondo tiene su propia carpeta con `imagen.jpg` (o `.png`), `metadata.json` y opcionalmente `video.mp4`.
   - La metadata local sólo contiene atributos que no pueden deducirse de la ubicación física.
   - Se elimina el archivo manual `contenido/carreras.json`.
2. **Equivalencia de objetos y aleatoriedad por sesión**:
   - Los objetos no tienen orden semántico ni prefijos numéricos.
   - No existe un "objeto principal" persistente; todos los objetos son equivalentes a nivel de contenido.
   - Al iniciar cada sesión (estado `HUMO`), se selecciona aleatoriamente un objeto representante para cada carrera ofrecida en el carrusel.
   - Al elegirse una carrera, los restantes $N - 1$ objetos se mezclan aleatoriamente y se asignan a los slots de `escondites` del fondo activo.
   - La selección y la asignación a slots permanecen absolutamente estables durante toda la sesión (no cambian en los cuadros de renderizado).
   - La aleatoriedad se desacopla mediante inyección de RNG (`azar = Math.random`) para garantizar testeo determinista.
3. **Descubrimiento y catálogo normalizado en Node**:
   - La lectura y validación del sistema de archivos ocurre del lado de Node de forma determinista y sin depender del orden del filesystem.
   - Se produce un catálogo normalizado derivado en `contenido/catalogo.json` (ignorado en git).
   - El servidor HTTP (`servidor/servidor.js`) genera/actualiza el catálogo al arrancar y sigue operando como servidor estático simple y offline.
4. **Validaciones estrictas y de diagnóstico preciso**:
   - Detección temprana de faltantes o incoherencias con mensajes que identifican la ruta física exacta del problema.
   - `npm run listo` valida directamente la estructura real de `contenido/carreras/`.
5. **Simplificación del repositorio**:
   - Eliminación de scripts obsoletos de generación de respaldos vectoriales (`generar-pngs` y `generar-fondos`), manteniendo el fallback dinámico en canvas que ya ejecuta el frontend.

---

## 2. Nueva Estructura Física de Archivos

```text
contenido/
├── catalogo.json                  (generado automáticamente, en .gitignore)
├── comun/
│   ├── humo.mp4                   (movido desde assets/humo.mp4)
│   ├── tipografias/               (movido desde assets/tipografias/)
│   │   ├── Muffaroo.ttf
│   │   └── LICENCIA.txt
│   └── CREDITOS.md                (movido desde assets/CREDITOS.md)
└── carreras/
    ├── computacion/
    │   ├── carrera.json
    │   ├── objetos/
    │   │   ├── laptop/
    │   │   │   ├── imagen.png
    │   │   │   └── metadata.json
    │   │   ├── procesador/
    │   │   │   ├── imagen.png
    │   │   │   └── metadata.json
    │   │   ├── placa-madre/
    │   │   │   ├── imagen.png
    │   │   │   └── metadata.json
    │   │   └── mouse/
    │   │       ├── imagen.png
    │   │       └── metadata.json
    │   └── fondos/
    │       ├── principal/
    │       │   ├── imagen.jpg     (o .png)
    │       │   ├── metadata.json
    │       │   └── video.mp4      (opcional)
    │       └── alternativo/
    │           ├── imagen.jpg
    │           └── metadata.json
    ├── mecanica/
    └── ... (12 carreras en total)
```

### 2.1 Especificación de Metadata Local

#### `contenido/carreras/<carrera-id>/carrera.json`
```json
{
  "nombre": "Ingeniería en Computación",
  "color": "#00E5A0",
  "maite": "sistemas",
  "fondo": "principal"
}
```
- `nombre` (*string*, requerido): Nombre oficial de la carrera.
- `color` (*string* `#rrggbb`, requerido): Color para la escena vectorial de respaldo (cuando no hay foto/video).
- `maite` (*string* | *null*, requerido): ID correspondiente en el sistema MAITE (o `null` si no tiene video de persona aún).
- `fondo` (*string*, opcional): ID de la carpeta en `fondos/` activa. Si se omite y hay un único fondo, se asume ese.

#### `contenido/carreras/<carrera-id>/objetos/<objeto-id>/metadata.json`
```json
{
  "nombre": "Procesador",
  "descripcion": "Ejecuta miles de millones de instrucciones por segundo con transistores más chicos que un virus.",
  "figura": "chip"
}
```
- El ID del objeto es el nombre de la carpeta (`<objeto-id>`), no se repite en el JSON.
- `imagen.png` es la imagen transparente del objeto.
- `nombre` (*string*, requerido): Título de la ficha del objeto.
- `descripcion` (*string*, requerido): Texto descriptivo ($\le 130$ caracteres).
- `figura` (*string*, requerido): Nombre de la figura vectorial de respaldo en `espejo/figuras.js`.
- Se omite `escala` (no era consumida por el motor de renderizado).

#### `contenido/carreras/<carrera-id>/fondos/<fondo-id>/metadata.json`
```json
{
  "lugar": {
    "x": 0.834,
    "y": 0.22,
    "escala": 0.24
  },
  "escondites": [
    {
      "x": 0.166,
      "y": 0.22,
      "escala": 0.24
    },
    {
      "x": 0.834,
      "y": 0.43,
      "escala": 0.24
    },
    {
      "x": 0.166,
      "y": 0.43,
      "escala": 0.24
    }
  ]
}
```
- El ID del fondo es el nombre de la carpeta (`<fondo-id>`).
- La imagen estática obligatoria es descubierta como `imagen.jpg` (o `imagen.png`).
- El video opcional es descubierto como `video.mp4`.
- `lugar`: Coordenadas $\{x, y, escala\}$ normalizadas $(0 \le x, y \le 1, escala > 0)$ para el objeto que vuela al fondo.
- `escondites`: Lista de al menos $N - 1$ slots $\{x, y, escala\}$ donde se distribuirán aleatoriamente los restantes objetos.

---

## 3. Arquitectura del Descubrimiento y Catálogo (Node)

### 3.1 Módulos

```text
servidor/
├── descubrimiento.js      (recorre el árbol de directorios)
├── validador.js           (valida coherencia e integridad)
├── catalogo.js            (construye el catálogo y escribe catalogo.json)
└── servidor.js            (ejecuta catalogo.js al arrancar y sirve estáticos)
```

1. **`servidor/descubrimiento.js`**:
   - Lee `contenido/carreras/` ordenando alfabéticamente las entradas para garantizar determinismo estricto.
   - Extrae carreras, objetos y fondos.
   - Ignora archivos irrelevantes (`.DS_Store`, `.gitkeep`, etc.).
2. **`servidor/validador.js`**:
   - Acumula todos los errores antes de abortar.
   - Mensajes con ruta completa:
     - `carreras/computacion: falta carrera.json`
     - `carreras/computacion/objetos/procesador: falta imagen.png`
     - `carreras/computacion/objetos/mouse/metadata.json: falta "descripcion"`
     - `carreras/computacion/fondos/principal: "lugar.x" debe estar entre 0 y 1`
     - `carreras/computacion: el fondo activo "laboratorio" no existe en fondos/`
     - `carreras/computacion/fondos/principal: requiere al menos 3 escondites, pero declara 2`
3. **`servidor/catalogo.js`**:
   - `construirCatalogo({ raizContenido, figurasValidas })`: retorna el objeto del catálogo normalizado.
   - `generarArchivoCatalogo({ raiz, figurasValidas })`: genera `contenido/catalogo.json`.
4. **`contenido/catalogo.json` (formato normalizado)**:
   ```json
   {
     "carreras": [
       {
         "id": "computacion",
         "nombre": "Ingeniería en Computación",
         "color": "#00E5A0",
         "maite": "sistemas",
         "fondoActivo": "principal",
         "fondos": [
           {
             "id": "principal",
             "img": "carreras/computacion/fondos/principal/imagen.jpg",
             "video": null,
             "lugar": { "x": 0.834, "y": 0.22, "escala": 0.24 },
             "escondites": [ ... ]
           }
         ],
         "objetos": [
           {
             "id": "laptop",
             "img": "carreras/computacion/objetos/laptop/imagen.png",
             "nombre": "Computadora",
             "descripcion": "...",
             "figura": "laptop"
           }
         ]
       }
     ]
   }
   ```

---

## 4. Aleatoriedad por Sesión y Asignación de Slots

### 4.1 Módulo `espejo/sesion.js`
Desacoplado de la lógica de render y de la máquina de estados:

1. **`seleccionarObjetoDeCarrera(carrera, azar = Math.random)`**:
   - Selecciona un objeto al azar de `carrera.objetos`.
   - Todos los objetos de la carrera tienen idéntica probabilidad de ser elegidos.
2. **`distribuirEscondidosEnSlots({ objetos, objetoElegido, slots, azar = Math.random })`**:
   - Filtra los objetos restantes: `restantes = objetos.filter(o => o.id !== objetoElegido.id)`.
   - Los baraja con Fisher-Yates usando `azar`.
   - Los empareja secuencialmente con los slots disponibles en `slots`.
   - Retorna una lista con la asignación `{ objeto, slot, indice }`.
3. **`crearSesionContenido({ contenido, azar = Math.random })`**:
   - Maneja el ciclo de vida de la sesión:
     - `iniciar(opciones)`: para cada carrera ofrecida en el carrusel, sortea y fija su representante temporal.
     - `representanteDe(carreraId)`: devuelve el objeto representante sorteado para el carrusel.
     - `disposicionDe(carreraId)`: fija (si no estaba ya fijada) y devuelve la distribución `{ elegido, escondidos }` para el fondo activo.
     - `reiniciar()`: resetea el estado para el siguiente visitante.

### 4.2 Integración en `espejo/main.js` y `espejo/escondites.js`
- En `ESTADOS.HUMO`: se invoca `sesionContenido.iniciar(salida.opciones)`.
- En evento `mira`: se obtiene `sesionContenido.disposicionDe(carreraId)`.
- En `ESTADOS.ATRACCION`: se invoca `sesionContenido.reiniciar()`.
- En el loop de renderizado: nunca se invoca `Math.random()`; se lee la disposición ya computada.

---

## 5. Migración y Limpieza

### 5.1 Migración de las 12 Carreras
- Migración de las 12 carreras desde `contenido/carreras.json` y `contenido/assets/` a la nueva jerarquía `contenido/carreras/<id>/...`.
- Recursos compartidos a `contenido/comun/`:
  - `contenido/assets/humo.mp4` $\to$ `contenido/comun/humo.mp4`
  - `contenido/assets/tipografias/` $\to$ `contenido/comun/tipografias/`
  - `contenido/assets/CREDITOS.md` $\to$ `contenido/comun/CREDITOS.md`
- Eliminación definitiva de `contenido/carreras.json` y `contenido/assets/`.

### 5.2 Depuración de Scripts
- Se eliminan `herramientas/generar-pngs.mjs`, `herramientas/generar-pngs.html`, `herramientas/generar-fondos.mjs`, `herramientas/generar-fondos.html`.
- Se remueven de `package.json` los scripts `generar-pngs` y `generar-fondos`.
- Se actualiza `herramientas/fondos.html` para consumir `/contenido/catalogo.json`.
- Se agrega el script `catalogo` a `package.json`: `"catalogo": "node -e \"import('./servidor/catalogo.js').then(m => m.generarArchivoCatalogo())\""`.

---

## 6. Pruebas y Validación (`npm test` y `npm run listo`)

### 6.1 Tests Unitarios y TDD
- **`tests/servidor/descubrimiento.test.js`**: Pruebas de recorrido de carpetas, descarte de archivos espurios y orden determinista.
- **`tests/servidor/validador.test.js`**: Casos de fallo con mensajes precisos (carreras sin `carrera.json`, objetos sin imagen, descripciones $> 130$ caracteres, fondos con coordenadas erróneas o slots insuficientes).
- **`tests/espejo/sesion.test.js`**: Pruebas de aleatoriedad controlada con RNG inyectado:
  - Cualquier objeto puede ser elegido como representante.
  - Estabilidad durante la sesión.
  - El representante no se duplica en los escondidos.
  - Los $N - 1$ objetos restantes ocupan exactamente un slot de `escondites`.
- **`tests/espejo/contenido.test.js`**: Actualizado para validar el consumo de `catalogo.json`.

### 6.2 Integración y `npm run listo`
- `tests/listo/contenido-real.test.js`:
  - Lee directamente el árbol de `contenido/carreras/` con el nuevo validador.
  - Valida las 12 carreras completas en disco.
  - Valida tipografías, licencia y humo en `contenido/comun/`.
  - Valida que cualquier objeto nuevo agregado (ej. `teclado`) sea reconocido inmediatamente.
- Pruebas existentes (`tests/integracion/atajos.test.js`, `fondos.test.js`, `fichas.test.js`, `sintaxis.test.js`): actualizadas para usar el nuevo catálogo y mantenerse en verde.

