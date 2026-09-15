# Plan de Implementación: Gestión de Contenido por Estructura de Carpetas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar la gestión de contenido del espejo mágico para que la estructura física de carpetas sea la única fuente de verdad, permitiendo que agregar o modificar objetos y fondos sea solo manipular archivos locales, con aleatoriedad por sesión y catálogo normalizado derivado sin frameworks ni bundlers.

**Architecture:** Módulos Node desacoplados (`descubrimiento.js`, `validador.js`, `catalogo.js`) para escanear `contenido/carreras/` de forma determinista y escribir `contenido/catalogo.json`; módulo funcional `espejo/sesion.js` para seleccionar aleatoriamente representantes en carrusel y distribuir objetos en slots de fondo de forma estable por sesión con RNG inyectable; actualización del servidor estático y migración de las 12 carreras.

**Tech Stack:** Node.js (módulos ES nativos, `node:fs/promises`, `node:path`), Vitest, JavaScript vanilla en el navegador.

**Spec:** [docs/superpowers/specs/2026-09-14-contenido-por-carpetas-design.md](file:///home/ivan/repositorios/FING/espejo-magico/docs/superpowers/specs/2026-09-14-contenido-por-carpetas-design.md)

## Global Constraints

- Módulos ES nativos servidos tal cual, sin bundler (ni Webpack, Vite, React, etc.).
- Servidor `servidor/servidor.js` 100% estático, sin dependencias de npm (solo módulos `node:`).
- `contenido/catalogo.json` derivado automáticamente, ignorado en `.gitignore`, nunca editado a mano.
- Sin llamadas a `Math.random()` dentro del loop de render (`actualizar` / `dibujar`).
- Idioma en castellano para identificadores, comentarios, tests y docs (sin tildes en identificadores/comentarios).

---

### Task 1: Módulo de Descubrimiento (`servidor/descubrimiento.js`)

**Files:**
- Create: `servidor/descubrimiento.js`
- Test: `tests/servidor/descubrimiento.test.js`

**Interfaces:**
- Produces: `descubrirEstructura({ raizCarreras: string }): Promise<Array<CarreraCruda>>`
  Donde `CarreraCruda` tiene:
  ```ts
  {
    id: string,
    rutaRelativa: string,
    carreraJson: object | null,
    errorCarreraJson?: string,
    objetos: Array<{
      id: string,
      rutaImagen: string | null,
      metadata: object | null,
      errorMetadata?: string
    }>,
    fondos: Array<{
      id: string,
      rutaImagen: string | null,
      rutaVideo: string | null,
      metadata: object | null,
      errorMetadata?: string
    }>
  }
  ```

- [ ] **Step 1: Escribir test que falla para descubrimiento básico**
Crear `tests/servidor/descubrimiento.test.js` testeando contra un fixture temporal en `node:os.tmpdir()`:
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { descubrirEstructura } from '../../servidor/descubrimiento.js';

describe('descubrirEstructura', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'descubrimiento-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('descubre carreras, objetos y fondos ordenados alfabéticamente', async () => {
    const computacion = join(dir, 'computacion');
    await mkdir(join(computacion, 'objetos', 'laptop'), { recursive: true });
    await mkdir(join(computacion, 'fondos', 'principal'), { recursive: true });

    await writeFile(join(computacion, 'carrera.json'), JSON.stringify({ nombre: 'Computación', color: '#00E5A0', maite: 'sistemas' }));
    await writeFile(join(computacion, 'objetos', 'laptop', 'imagen.png'), 'fake-png');
    await writeFile(join(computacion, 'objetos', 'laptop', 'metadata.json'), JSON.stringify({ nombre: 'Laptop', descripcion: 'Desc', figura: 'laptop' }));
    await writeFile(join(computacion, 'fondos', 'principal', 'imagen.jpg'), 'fake-jpg');
    await writeFile(join(computacion, 'fondos', 'principal', 'metadata.json'), JSON.stringify({ lugar: { x: 0.5, y: 0.5, escala: 0.2 }, escondites: [] }));

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('computacion');
    expect(resultado[0].carreraJson.nombre).toBe('Computación');
    expect(resultado[0].objetos).toHaveLength(1);
    expect(resultado[0].objetos[0].id).toBe('laptop');
    expect(resultado[0].objetos[0].rutaImagen).toBe('carreras/computacion/objetos/laptop/imagen.png');
    expect(resultado[0].fondos).toHaveLength(1);
    expect(resultado[0].fondos[0].id).toBe('principal');
    expect(resultado[0].fondos[0].rutaImagen).toBe('carreras/computacion/fondos/principal/imagen.jpg');
    expect(resultado[0].fondos[0].rutaVideo).toBeNull();
  });

  it('ignora archivos ocultos y entradas que no son carpetas', async () => {
    await mkdir(join(dir, '.git'), { recursive: true });
    await writeFile(join(dir, '.DS_Store'), 'test');
    await writeFile(join(dir, 'README.txt'), 'test');

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado).toEqual([]);
  });

  it('captura errores si un JSON tiene formato inválido', async () => {
    const civil = join(dir, 'civil');
    await mkdir(join(civil, 'objetos', 'casco'), { recursive: true });
    await writeFile(join(civil, 'carrera.json'), '{ invalido json ');
    await writeFile(join(civil, 'objetos', 'casco', 'metadata.json'), '{ otro roto ');

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado[0].errorCarreraJson).toBeDefined();
    expect(resultado[0].objetos[0].errorMetadata).toBeDefined();
  });
});
```

- [ ] **Step 2: Ejecutar test para verificar que falla**
Run: `npx vitest run tests/servidor/descubrimiento.test.js`
Expected: FAIL con "Cannot find module '../../servidor/descubrimiento.js'"

- [ ] **Step 3: Implementar `servidor/descubrimiento.js`**
Crear `servidor/descubrimiento.js`:
```javascript
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function esDirectorio(ruta) {
  try {
    const s = await stat(ruta);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function leerJsonSeguro(ruta) {
  try {
    const texto = await readFile(ruta, 'utf8');
    return { datos: JSON.parse(texto), error: null };
  } catch (error) {
    return { datos: null, error: error.message };
  }
}

async function listarCarpetasOrdenadas(directorio) {
  try {
    const entradas = await readdir(directorio, { withFileTypes: true });
    return entradas
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'es'));
  } catch {
    return [];
  }
}

async function encontrarArchivo(directorio, nombres) {
  try {
    const entradas = await readdir(directorio, { withFileTypes: true });
    for (const nombre of nombres) {
      const encontrada = entradas.find((e) => e.isFile() && e.name.toLowerCase() === nombre.toLowerCase());
      if (encontrada) return encontrada.name;
    }
    return null;
  } catch {
    return null;
  }
}

export async function descubrirEstructura({ raizCarreras }) {
  const carrerasIds = await listarCarpetasOrdenadas(raizCarreras);
  const resultado = [];

  for (const carreraId of carrerasIds) {
    const dirCarrera = join(raizCarreras, carreraId);
    const rutaRelativaCarrera = `carreras/${carreraId}`;

    // carrera.json
    const rutaCarreraJson = join(dirCarrera, 'carrera.json');
    let carreraJson = null;
    let errorCarreraJson = undefined;
    try {
      const leido = await leerJsonSeguro(rutaCarreraJson);
      if (leido.error) errorCarreraJson = leido.error;
      else carreraJson = leido.datos;
    } catch (e) {
      errorCarreraJson = e.message;
    }

    // objetos
    const dirObjetos = join(dirCarrera, 'objetos');
    const objetosIds = await listarCarpetasOrdenadas(dirObjetos);
    const objetos = [];

    for (const objetoId of objetosIds) {
      const dirObjeto = join(dirObjetos, objetoId);
      const nombreImg = await encontrarArchivo(dirObjeto, ['imagen.png']);
      const rutaImg = nombreImg ? `${rutaRelativaCarrera}/objetos/${objetoId}/${nombreImg}` : null;

      const rutaMeta = join(dirObjeto, 'metadata.json');
      const leidoMeta = await leerJsonSeguro(rutaMeta);

      objetos.push({
        id: objetoId,
        rutaImagen: rutaImg,
        metadata: leidoMeta.datos,
        errorMetadata: leidoMeta.error ?? undefined,
      });
    }

    // fondos
    const dirFondos = join(dirCarrera, 'fondos');
    const fondosIds = await listarCarpetasOrdenadas(dirFondos);
    const fondos = [];

    for (const fondoId of fondosIds) {
      const dirFondo = join(dirFondos, fondoId);
      const nombreImg = await encontrarArchivo(dirFondo, ['imagen.jpg', 'imagen.jpeg', 'imagen.png']);
      const rutaImg = nombreImg ? `${rutaRelativaCarrera}/fondos/${fondoId}/${nombreImg}` : null;

      const nombreVideo = await encontrarArchivo(dirFondo, ['video.mp4']);
      const rutaVideo = nombreVideo ? `${rutaRelativaCarrera}/fondos/${fondoId}/${nombreVideo}` : null;

      const rutaMeta = join(dirFondo, 'metadata.json');
      const leidoMeta = await leerJsonSeguro(rutaMeta);

      fondos.push({
        id: fondoId,
        rutaImagen: rutaImg,
        rutaVideo: rutaVideo,
        metadata: leidoMeta.datos,
        errorMetadata: leidoMeta.error ?? undefined,
      });
    }

    resultado.push({
      id: carreraId,
      rutaRelativa: rutaRelativaCarrera,
      carreraJson,
      errorCarreraJson,
      objetos,
      fondos,
    });
  }

  return resultado;
}
```

- [ ] **Step 4: Ejecutar tests y verificar que pasan**
Run: `npx vitest run tests/servidor/descubrimiento.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add servidor/descubrimiento.js tests/servidor/descubrimiento.test.js
git commit -m "feat(servidor): agregar modulo de descubrimiento de carreras y recursos"
```

---

### Task 2: Validador de Estructura y Metadata (`servidor/validador.js`)

**Files:**
- Create: `servidor/validador.js`
- Test: `tests/servidor/validador.test.js`

**Interfaces:**
- Consumes: Salida de `descubrirEstructura`
- Produces: `validarEstructura(carrerasCrudas: Array<CarreraCruda>, opciones?: { figurasValidas?: string[] }): Array<string>`
  Retorna lista de mensajes de error detallando la ruta física del problema.

- [ ] **Step 1: Escribir test que falla para validaciones exhaustivas**
Crear `tests/servidor/validador.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { validarEstructura } from '../../servidor/validador.js';

describe('validarEstructura', () => {
  const carreraValida = () => ({
    id: 'computacion',
    rutaRelativa: 'carreras/computacion',
    carreraJson: {
      nombre: 'Ingeniería en Computación',
      color: '#00E5A0',
      maite: 'sistemas',
      fondo: 'principal',
    },
    objetos: [
      { id: 'laptop', rutaImagen: 'carreras/computacion/objetos/laptop/imagen.png', metadata: { nombre: 'Laptop', descripcion: 'Desc', figura: 'laptop' } },
      { id: 'mouse', rutaImagen: 'carreras/computacion/objetos/mouse/imagen.png', metadata: { nombre: 'Mouse', descripcion: 'Desc', figura: 'chip' } },
    ],
    fondos: [
      {
        id: 'principal',
        rutaImagen: 'carreras/computacion/fondos/principal/imagen.jpg',
        rutaVideo: null,
        metadata: {
          lugar: { x: 0.8, y: 0.2, escala: 0.24 },
          escondites: [{ x: 0.2, y: 0.2, escala: 0.24 }],
        },
      },
    ],
  });

  it('acepta una estructura válida', () => {
    expect(validarEstructura([carreraValida()], { figurasValidas: ['laptop', 'chip'] })).toEqual([]);
  });

  it('detecta falta de carrera.json o error de sintaxis', () => {
    const c1 = carreraValida();
    c1.carreraJson = null;
    expect(validarEstructura([c1])).toContain('carreras/computacion: falta carrera.json');

    const c2 = carreraValida();
    c2.errorCarreraJson = 'Unexpected token';
    expect(validarEstructura([c2])).toContain('carreras/computacion/carrera.json: JSON inválido (Unexpected token)');
  });

  it('detecta campos inválidos en carrera.json', () => {
    const c = carreraValida();
    c.carreraJson.nombre = '';
    c.carreraJson.color = 'invalido';
    c.carreraJson.fondo = 'inexistente';
    const errores = validarEstructura([c]);
    expect(errores.some((e) => e.includes('falta "nombre"'))).toBe(true);
    expect(errores.some((e) => e.includes('"color" tiene que ser #rrggbb'))).toBe(true);
    expect(errores.some((e) => e.includes('fondo activo "inexistente" no existe'))).toBe(true);
  });

  it('detecta objetos sin imagen o sin metadata', () => {
    const c = carreraValida();
    c.objetos[0].rutaImagen = null;
    c.objetos[1].metadata = null;
    const errores = validarEstructura([c]);
    expect(errores).toContain('carreras/computacion/objetos/laptop: falta imagen.png');
    expect(errores).toContain('carreras/computacion/objetos/mouse: falta metadata.json');
  });

  it('detecta descripciones mayores a 130 caracteres y figuras inválidas', () => {
    const c = carreraValida();
    c.objetos[0].metadata.descripcion = 'A'.repeat(131);
    c.objetos[0].metadata.figura = 'figura_inexistente';
    const errores = validarEstructura([c], { figurasValidas: ['laptop', 'chip'] });
    expect(errores.some((e) => e.includes('131 caracteres'))).toBe(true);
    expect(errores.some((e) => e.includes('figura "figura_inexistente" no existe'))).toBe(true);
  });

  it('detecta fondos sin imagen o con coordenadas inválidas', () => {
    const c = carreraValida();
    c.fondos[0].rutaImagen = null;
    c.fondos[0].metadata.lugar.x = 1.5;
    const errores = validarEstructura([c]);
    expect(errores.some((e) => e.includes('falta imagen'))).toBe(true);
    expect(errores.some((e) => e.includes('"lugar.x"'))).toBe(true);
  });

  it('detecta fondos con cantidad insuficiente de escondites (menos de N - 1)', () => {
    const c = carreraValida();
    // 2 objetos necesitan al menos 1 escondite. Si vaciamos escondites:
    c.fondos[0].metadata.escondites = [];
    const errores = validarEstructura([c]);
    expect(errores.some((e) => e.includes('insuficientes escondites'))).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar test para verificar que falla**
Run: `npx vitest run tests/servidor/validador.test.js`
Expected: FAIL con "Cannot find module '../../servidor/validador.js'"

- [ ] **Step 3: Implementar `servidor/validador.js`**
Crear `servidor/validador.js` implementando todas las validaciones especificadas.

- [ ] **Step 4: Ejecutar tests y verificar que pasan**
Run: `npx vitest run tests/servidor/validador.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add servidor/validador.js tests/servidor/validador.test.js
git commit -m "feat(servidor): agregar modulo validador de estructura de contenido"
```

---

### Task 3: Generador de Catálogo (`servidor/catalogo.js`)

**Files:**
- Create: `servidor/catalogo.js`
- Test: `tests/servidor/catalogo.test.js`

**Interfaces:**
- Consumes: `servidor/descubrimiento.js`, `servidor/validador.js`, `espejo/figuras.js`
- Produces:
  - `construirCatalogo({ raizCarreras, figurasValidas }): Promise<{ catalogo, errores }>`
  - `generarArchivoCatalogo({ raiz, figurasValidas }): Promise<{ ruta, carrerasCount }>`

- [ ] **Step 1: Escribir test que falla para construcción y guardado de catálogo**
Crear `tests/servidor/catalogo.test.js` probando que `construirCatalogo` retorna la estructura normalizada esperada y que `generarArchivoCatalogo` escribe el JSON correctamente.

- [ ] **Step 2: Ejecutar test para verificar que falla**
Run: `npx vitest run tests/servidor/catalogo.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `servidor/catalogo.js`**
Escribir la lógica de normalización (resolución de `fondoActivo`, mapeo de objetos sin orden intrínseco, rutas completas, escritura a `contenido/catalogo.json`).

- [ ] **Step 4: Ejecutar tests y verificar que pasan**
Run: `npx vitest run tests/servidor/catalogo.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add servidor/catalogo.js tests/servidor/catalogo.test.js
git commit -m "feat(servidor): agregar generador de catalogo normalizado"
```

---

### Task 4: Aleatoriedad por Sesión y Asignación de Slots (`espejo/sesion.js`)

**Files:**
- Create: `espejo/sesion.js`
- Test: `tests/espejo/sesion.test.js`

**Interfaces:**
- Produces:
  - `seleccionarObjetoDeCarrera(carrera, azar?: Function): Objeto`
  - `distribuirEscondidosEnSlots({ objetos, objetoElegido, slots, azar?: Function }): Array<{ objeto, slot, indice }>`
  - `crearSesionContenido({ contenido, azar?: Function }): SesionContenido`

- [ ] **Step 1: Escribir tests unitarios con RNG inyectado**
Crear `tests/espejo/sesion.test.js`:
- Verificar que `seleccionarObjetoDeCarrera` puede devolver cualquier objeto según el RNG provisto.
- Verificar que `distribuirEscondidosEnSlots` nunca incluye al `objetoElegido`.
- Verificar que los $N - 1$ objetos restantes se asignan 1 a 1 a los slots provistos.
- Verificar que `crearSesionContenido` mantiene los mismos representantes y distribuciones a lo largo de múltiples consultas durante una sesión.
- Verificar que al invocar `reiniciar()`, una nueva sesión permite sortear nuevos representantes.

- [ ] **Step 2: Ejecutar test para verificar que falla**
Run: `npx vitest run tests/espejo/sesion.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `espejo/sesion.js`**
Implementar funciones puras y el contenedor de sesión sin tocar el renderizado ni usar `Math.random` inline.

- [ ] **Step 4: Ejecutar tests y verificar que pasan**
Run: `npx vitest run tests/espejo/sesion.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add espejo/sesion.js tests/espejo/sesion.test.js
git commit -m "feat(espejo): implementar seleccion aleatoria por sesion y distribucion de slots"
```

---

### Task 5: Adaptación de Frontend (`espejo/contenido.js`, `espejo/escondites.js`, `espejo/main.js`)

**Files:**
- Modify: `espejo/contenido.js`
- Modify: `espejo/escondites.js`
- Modify: `espejo/main.js`
- Test: `tests/espejo/contenido.test.js`, `tests/espejo/escondites.test.js`

- [ ] **Step 1: Adaptar tests en `tests/espejo/contenido.test.js`**
Actualizar pruebas para la carga de `catalogo.json` (en vez del antiguo `carreras.json`), y para `fondoActivo` respetando `carrera.fondoActivo`.

- [ ] **Step 2: Modificar `espejo/contenido.js`**
Actualizar ruta por defecto a `/contenido/catalogo.json`. Simplificar helpers y asegurar compatibilidad.

- [ ] **Step 3: Modificar `espejo/escondites.js`**
Modificar `objetosDelFondo` para recibir `{ elegido, escondidos, fondo, rectangulo, pantalla, config }` o mantener soporte para la lista de objetos de la sesión.

- [ ] **Step 4: Integrar `crearSesionContenido` en `espejo/main.js`**
Cablear la sesión en `main.js`:
- Instanciar `crearSesionContenido({ contenido })`.
- En `HUMO`: `sesion.iniciar(salida.opciones)`.
- En `mira`: consultar representante y distribución asignada a slots.
- En `ATRACCION`: `sesion.reiniciar()`.
- Cero llamadas a `Math.random()` en el render loop.

- [ ] **Step 5: Ejecutar suite de pruebas de espejo**
Run: `npx vitest run tests/espejo/`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add espejo/contenido.js espejo/escondites.js espejo/main.js tests/espejo/contenido.test.js
git commit -m "refactor(espejo): integrar sesion aleatoria y catalogo generado en el frontend"
```

---

### Task 6: Migración de las 12 Carreras y Recursos Globales

**Files:**
- Create: `contenido/comun/humo.mp4`, `contenido/comun/tipografias/`, `contenido/comun/CREDITOS.md`
- Create: `contenido/carreras/<12 carreras>/...`
- Delete: `contenido/carreras.json`, `contenido/assets/`
- Modify: `.gitignore`

- [ ] **Step 1: Agregar `contenido/catalogo.json` a `.gitignore`**
Editar `.gitignore` para ignorar `contenido/catalogo.json`.

- [ ] **Step 2: Crear script de migración temporal y ejecutarlo**
Migrar con un script auxiliar seguro las 12 carreras desde `contenido/carreras.json` y `contenido/assets/` a la nueva estructura:
- Mover `humo.mp4`, `tipografias/`, `CREDITOS.md` a `contenido/comun/`.
- Mover imágenes de objetos a `contenido/carreras/<id>/objetos/<id>/imagen.png`.
- Crear `metadata.json` para cada objeto.
- Mover imágenes y videos de fondos a `contenido/carreras/<id>/fondos/<id>/...`.
- Crear `carrera.json` y `metadata.json` de fondos.
- Eliminar `contenido/carreras.json` y `contenido/assets/`.

- [ ] **Step 3: Generar `contenido/catalogo.json` con `servidor/catalogo.js`**
Ejecutar generación y verificar que el archivo generado contiene las 12 carreras con todos sus datos intactos.

- [ ] **Step 4: Commit**
```bash
git add .gitignore contenido/
git commit -m "refactor(contenido): migrar 12 carreras a estructura por carpetas y recursos a comun"
```

---

### Task 7: Integración en Servidor, Herramientas y Depuración de Scripts

**Files:**
- Modify: `servidor/servidor.js`
- Modify: `package.json`
- Modify: `herramientas/fondos.html`
- Delete: `herramientas/generar-pngs.mjs`, `herramientas/generar-pngs.html`, `herramientas/generar-fondos.mjs`, `herramientas/generar-fondos.html`
- Delete: `tests/herramientas/recorte.test.js` (si dependía de los generadores) o mantener si aplica.

- [ ] **Step 1: Eliminar scripts obsoletos de generación de PNGs y fondos**
Eliminar archivos de `herramientas/generar-pngs.*` y `herramientas/generar-fondos.*`.
Eliminar de `package.json` los scripts `"generar-pngs"` y `"generar-fondos"`.
Agregar script `"catalogo": "node -e \"import('./servidor/catalogo.js').then(m => m.generarArchivoCatalogo())\""`.

- [ ] **Step 2: Integrar generación de catálogo al arrancar `servidor/servidor.js`**
En `crearServidor()` o arranque de `servidor.js`, invocar `generarArchivoCatalogo()` para asegurar que `contenido/catalogo.json` esté al día.

- [ ] **Step 3: Actualizar `herramientas/fondos.html`**
Actualizar imports, rutas de precarga y lectura de `carrera.fondoActivo`.

- [ ] **Step 4: Ejecutar tests del servidor**
Run: `npx vitest run tests/servidor/`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add servidor/ package.json herramientas/
git commit -m "refactor: generar catalogo al arrancar servidor y depurar scripts obsoletos"
```

---

### Task 8: Actualización de `npm run listo` y Tests de Integración

**Files:**
- Modify: `tests/listo/contenido-real.test.js`
- Modify: `tests/integracion/atajos.test.js`
- Modify: `tests/integracion/fondos.test.js`
- Modify: `tests/integracion/fichas.test.js`
- Modify: `tests/integracion/sintaxis.test.js`

- [ ] **Step 1: Actualizar `tests/listo/contenido-real.test.js`**
Actualizar las aserciones para validar directamente sobre `contenido/carreras/` usando `descubrirEstructura` y `validarEstructura`, y comprobar las 12 carreras, los fondos y objetos, y `contenido/comun/humo.mp4` y tipografías.

- [ ] **Step 2: Actualizar tests de integración (`atajos`, `fondos`, `fichas`, `sintaxis`)**
Asegurar que lean el nuevo catálogo o estructura y que las pruebas de geometría (alcance de manos, periferia, fichas) continúen pasando.

- [ ] **Step 3: Ejecutar `npm run listo` y `npm test`**
Run: `npm run listo`
Expected: PASS
Run: `npm test`
Expected: ALL PASS

- [ ] **Step 4: Commit**
```bash
git add tests/
git commit -m "test: actualizar npm run listo y suites de integracion para la nueva estructura"
```

---

### Task 9: Documentación y Verificación de Criterios de Aceptación

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/contenido.md`
- Modify: `docs/arquitectura.md`
- Modify: `docs/despliegue.md`

- [ ] **Step 1: Actualizar la documentación**
Actualizar `README.md`, `CLAUDE.md`, `docs/contenido.md`, etc., explicando cómo agregar un nuevo objeto (`contenido/carreras/<carrera>/objetos/<nuevo>/imagen.png` y `metadata.json`), cómo agregar un fondo, la selección aleatoria por sesión y la eliminación de `carreras.json`.

- [ ] **Step 2: Verificar el criterio de aceptación del usuario**
Simular la adición de un nuevo objeto de prueba:
`contenido/carreras/computacion/objetos/teclado/` con `imagen.png` y `metadata.json`.
Ejecutar `npm run listo` y constatar que se reconoce automáticamente sin tocar ningún archivo global.
Limpiar el objeto de prueba.

- [ ] **Step 3: Ejecutar toda la suite completa (`npm test` y `npm run listo`)**
Confirmar verde absoluto en ambas.

- [ ] **Step 4: Commit**
```bash
git add README.md CLAUDE.md docs/
git commit -m "docs: actualizar documentacion para la gestion de contenido por carpetas"
```
