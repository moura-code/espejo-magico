# Observabilidad del Render Pipeline v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir las etapas del cuadro y mostrar sus medias recientes en el HUD sin cambiar el aspecto ni las frecuencias de detección.

**Architecture:** Un medidor puro acumula duraciones. `main.js` mide inferencias y grupos de dibujo; `silueta.js` distingue lectura y conversión de máscara. `operacion.js` muestra una instantánea.

**Tech Stack:** JavaScript ES modules, Canvas 2D, MediaPipe Tasks Vision, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-render-pipeline-v2-design.md`

## Global Constraints

- Cámara, máscaras y landmarks permanecen locales; el benchmark no guarda imágenes ni identificadores.
- No se agregan dependencias de producción, frameworks ni bundler.
- `eleccion.js`, máquina de estados, MAITE y frecuencias configuradas conservan su comportamiento.
- La instrumentación usa `performance.now()` inyectable y no acumula `performance.mark()`.
- Canvas 2D sigue siendo el renderer; esta fase sólo informa disponibilidad de WebGL2.

---

### Task 1: Medidor puro y medición de máscara

**Files:**

- Create: `espejo/metricas.js`
- Create: `tests/espejo/metricas.test.js`
- Modify: `espejo/silueta.js:33-70`
- Modify: `tests/espejo/silueta.test.js`

**Interfaces:** `crearMedidorDeEtapas({ ventana, ahora })` expone `registrar(nombre, ms)`, `medir(nombre, fn)`, `instantanea()` y `reiniciar()`. `crearSilueta({ crearLienzo, medir })` emite `maskRead` y `maskConvert`.

- [ ] **Step 1: Write failing tests**

```js
import { crearMedidorDeEtapas } from '../../espejo/metricas.js';

it('promedia una ventana acotada y conserva el máximo reciente', () => {
  const medidor = crearMedidorDeEtapas({ ventana: 2 });
  medidor.registrar('face', 4);
  medidor.registrar('face', 8);
  medidor.registrar('face', 12);
  expect(medidor.instantanea().face).toEqual({ ms: 10, muestras: 2, maximoMs: 12 });
});

it('mide una función y devuelve su resultado', () => {
  const tiempos = [100, 100];
  const medidor = crearMedidorDeEtapas({ ahora: () => tiempos.shift() });
  expect(medidor.medir('ui', () => 'dibujado')).toBe('dibujado');
  expect(medidor.instantanea().ui).toEqual({ ms: 0, muestras: 1, maximoMs: 0 });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/espejo/metricas.test.js`

Expected: FAIL because `espejo/metricas.js` does not exist.

- [ ] **Step 3: Implement the medidor**

```js
export function crearMedidorDeEtapas({ ventana = 60, ahora = () => performance.now() } = {}) {
  const muestras = new Map();
  const registrar = (nombre, ms) => {
    const lista = muestras.get(nombre) ?? [];
    lista.push(Number.isFinite(ms) && ms >= 0 ? ms : 0);
    while (lista.length > ventana) lista.shift();
    muestras.set(nombre, lista);
  };
  return {
    registrar,
    medir(nombre, fn) { const inicio = ahora(); try { return fn(); } finally { registrar(nombre, ahora() - inicio); } },
    instantanea: () => Object.fromEntries([...muestras].map(([nombre, lista]) => [nombre, {
      ms: lista.reduce((total, valor) => total + valor, 0) / lista.length,
      muestras: lista.length, maximoMs: Math.max(...lista),
    }])),
    reiniciar: () => muestras.clear(),
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/espejo/metricas.test.js`

Expected: PASS with 2 tests.

- [ ] **Step 5: Add a failing silhouette timing test**

```js
it('separa la lectura de confianza de la conversión a alfa', () => {
  const etapas = [];
  const silueta = crearSilueta({
    crearLienzo: crearLienzoFalso,
    medir: (nombre, fn) => { etapas.push(nombre); return fn(); },
  });
  silueta.actualizar(mascaraDe(2, 1, [0, 255]));
  expect(etapas).toEqual(['maskRead', 'maskConvert']);
});
```

Run: `npx vitest run tests/espejo/silueta.test.js`

Expected: FAIL because `crearSilueta` ignores `medir`.

- [ ] **Step 6: Instrument the existing silhouette path**

```js
export function crearSilueta({ crearLienzo, medir = (_nombre, fn) => fn() }) {
  // preserve the current try/catch
  const confianza = medir('maskRead', () => mascara.getAsUint8Array());
  // retain existing canvas and ImageData reuse
  medir('maskConvert', () => {
    alfaDesdeConfianza(confianza, imagen.data);
    ctx.putImageData(imagen, 0, 0);
  });
}
```

Return `null` before conversion if reading fails or dimensions are invalid.

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run tests/espejo/metricas.test.js tests/espejo/silueta.test.js && npm test`

Expected: PASS.

```bash
git add espejo/metricas.js espejo/silueta.js tests/espejo/metricas.test.js tests/espejo/silueta.test.js && git commit -m "feat: medir etapas de render y mascara"
```

### Task 2: HUD de métricas

**Files:**

- Modify: `espejo/operacion.js:52-136`
- Modify: `tests/espejo/operacion.test.js:104-204`

**Interfaces:** Exporta `formatearPanel({ espejo, fps })`. Lee `espejo.metricas?.()` y `espejo.webgl2Disponible?.()`; una etapa sin muestras muestra `-`.

- [ ] **Step 1: Write the failing HUD test**

```js
it('muestra etapas medidas y disponibilidad WebGL2', () => {
  const texto = formatearPanel({
    fps: 57.8,
    espejo: { ...espejoDePrueba, metricas: () => ({
      frame: { ms: 16.4 }, face: { ms: 5.8 }, maskRead: { ms: 2.8 }, ui: { ms: 0.4 },
    }), webgl2Disponible: () => true },
  });
  expect(texto).toContain('FRAME       16.4 ms');
  expect(texto).toContain('Mask read   2.8 ms');
  expect(texto).toContain('WebGL2      si');
});
```

Extract the repeated fixture in the current tests into `espejoDePrueba`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/espejo/operacion.test.js`

Expected: FAIL because `formatearPanel` is not exported.

- [ ] **Step 3: Extract the formatter**

```js
const ms = (valor) => Number.isFinite(valor) ? `${valor.toFixed(1)} ms` : '-';
const etapa = (metricas, nombre) => ms(metricas?.[nombre]?.ms);

export function formatearPanel({ espejo, fps }) {
  const metricas = espejo.metricas?.() ?? {};
  const maite = espejo.puente.ultimo();
  return [
    `fps         ${fps.toFixed(0)}`,
    `FRAME       ${etapa(metricas, 'frame')}`,
    `Face        ${etapa(metricas, 'face')}`,
    `Hands       ${etapa(metricas, 'hands')}`,
    `Pose        ${etapa(metricas, 'pose')}`,
    `Mask read   ${etapa(metricas, 'maskRead')}`,
    `Mask convert ${etapa(metricas, 'maskConvert')}`,
    `Video compose ${etapa(metricas, 'compose')}`,
    `Objects     ${etapa(metricas, 'objects')}`,
    `UI          ${etapa(metricas, 'ui')}`,
    `WebGL2      ${espejo.webgl2Disponible?.() ? 'si' : 'no'}`,
    `perfil      ${espejo.perfilDeRendimiento?.() ?? 'completo'}`,
    `estado      ${espejo.maquina.estado()}`,
    `ofrecidas   ${espejo.maquina.opciones().join(' ') || '-'}`,
    `carrera     ${espejo.maquina.carrera() ?? '-'}`,
    `sesion      ${espejo.maquina.sesion()}`,
    `modo        ${espejo.modo()}`,
    `camara      ${espejo.estadoDeCamara().lista ? 'ok' : (espejo.estadoDeCamara().error ?? 'sin camara')}`,
    `puntos      ${espejo.detector.cantidadDePuntos()}`,
    `manos       ${espejo.manosCrudas()} vistas / ${espejo.manos().length} usadas`,
    `radio mano  ${espejo.manos().map((m) => m.radio.toFixed(0)).join('  ') || '-'}`,
    `eleccion    ${(espejo.progresoDeEleccion() * 100).toFixed(0)}%`,
    `ficha       ${espejo.fichaActiva?.() ?? '-'}`,
    `pose        ${espejo.poseCrudas()} / silueta ${espejo.pose()?.mascara ? 'si' : 'no'}`,
    `humo        ${espejo.hayFondo() ? 'ok' : 'sin video'}`,
    `maite       ${espejo.puente.activo() ? `${maite.estado} ${maite.enviado ?? ''} ${maite.ok === null ? '' : maite.ok ? 'ok' : 'FALLO'}` : 'apagado'}`,
    `png faltan  ${espejo.banco.faltantes().length}`,
    `avance      ${espejo.maquina.esManual() ? 'MANUAL' : 'automatico'}`,
    'ESPACIO avanzar    A auto/manual',
    '1-9,0,-,= carrera  R reiniciar',
    'D demo             M malla',
    'P cerrar',
  ].join('\n');
}
```

Set `panel.textContent = formatearPanel({ espejo, fps: fps.valor() })`.

- [ ] **Step 4: Verify missing-stage behavior and commit**

```js
expect(formatearPanel({ fps: 0, espejo: { ...espejoDePrueba, metricas: () => ({}) } }))
  .toContain('Mask read   -');
```

Run: `npx vitest run tests/espejo/operacion.test.js && npm test`

Expected: PASS.

```bash
git add espejo/operacion.js tests/espejo/operacion.test.js && git commit -m "feat: mostrar metricas de render en el panel"
```

### Task 3: Instrumentación de `main.js`

**Files:**

- Modify: `espejo/main.js:1-73, 464-735, 725-1147`
- Modify: `tests/integracion/sintaxis.test.js`

**Interfaces:** El objeto enviado a `instalarOperacion` expone `metricas: () => metricas.instantanea()` y `webgl2Disponible: () => webgl2Disponible`.

- [ ] **Step 1: Write failing adapter assertions**

```js
expect(fuente).toContain('metricas: () => metricas.instantanea()');
expect(fuente).toContain('webgl2Disponible: () => webgl2Disponible');
```

Run: `npx vitest run tests/integracion/sintaxis.test.js`

Expected: FAIL because `main.js` has neither key.

- [ ] **Step 2: Add the adapter and detector measurements**

```js
const metricas = crearMedidorDeEtapas({ ventana: 60 });
const webgl2Disponible = Boolean(document.createElement('canvas').getContext('webgl2'));

crudoRostro = metricas.medir('face', () => detector.detectar(analisis, ahora, rectDeteccion));
pose = metricas.medir('pose', () => detectorDePose.detectar(analisis, ahora, rectDeteccion));
manos = metricas.medir('hands', () => detectorDeManos.detectar(analisis, ahora, rectDeteccion));
```

Import the factory, pass `medir: metricas.medir` to `crearSilueta`, and add both adapter functions. Keep smoothing, demo mode, pointer fallback, scheduling and frequencies outside the measured inference.

- [ ] **Step 3: Measure drawing and the complete frame**

Save `const inicioCuadro = performance.now()` at the first rendered line. Wrap the existing calls, without moving order:

```text
compose  video espejo, fondo y persona recortada
objects  escondidos, apoyado, copias delante y carrusel
ui       manos, fichas, nombre, humo, niebla e instrucciones
```

Before return, call `metricas.registrar('frame', performance.now() - inicioCuadro)`.

- [ ] **Step 4: Verify, demo-check and commit**

Run: `npx vitest run tests/integracion/sintaxis.test.js tests/espejo/operacion.test.js tests/espejo/silueta.test.js tests/espejo/metricas.test.js && npm test && npm run listo`

Expected: PASS.

Run: `npm start`; open `http://localhost:8080/espejo/espejo.html`; press `D`, `P`, complete one pointer selection, and confirm `FRAME`, `Objects` and `UI` show values. Camera-dependent entries may remain `-` in demo mode.

```bash
git add espejo/main.js tests/integracion/sintaxis.test.js && git commit -m "perf: instrumentar el cuadro del espejo"
```

### Task 4: Protocolo de línea base

**Files:**

- Create: `docs/benchmarks/render-pipeline-v2.md`

**Interfaces:** El documento usa los nombres del HUD: `Mask read`, `Mask convert` y `Video compose`.

- [ ] **Step 1: Create the aggregate-only template**

```markdown
# Línea base del Render Pipeline v2

| Campo | Valor |
| --- | --- |
| Fecha | |
| Commit | |
| Equipo | |
| Chrome | |
| Resolución | |
| Cámara | |
| Perfil inicial | |

| Escenario | Duración | FPS medio | FPS mínimo | Frame | Face | Hands | Pose | Mask read | Mask convert | Video compose | Objects | UI | CPU | GPU | Errores JS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ATRACCION sin persona | 60 s | | | | | | | | | | | | | | |
| EXPLORACION con carrusel | 60 s | | | | | | | | | | | | | | |
| EXPLORACION con fondo | 60 s | | | | | | | | | | | | | | |
```

Add instructions: open through `localhost:8080`, press `P`, wait 10 seconds before each 60-second record, write aggregate panel and system-monitor values only, and do not save images, video, landmarks, identifiers or visitor data.

- [ ] **Step 2: Verify and commit**

Run: `rg -n "render-pipeline-v2|Mask read|Mask convert|Video compose" docs espejo tests && npm test && npm run listo && git diff main...HEAD --check && git status --short`

Expected: names match; suites and whitespace check pass; only planned files remain before committing.

```bash
git add docs/benchmarks/render-pipeline-v2.md && git commit -m "docs: registrar la linea base de render"
```

## Plan self-review

Tasks 1 through 3 cover frame, FPS, detector, mask, composition, objects, UI and WebGL2 availability. Task 4 covers the three aggregate benchmark scenarios. The compositor boundary, WebGL2 renderer, mask refinement and image decoding belong to later plans in the approved specification.
