# Experiencia robusta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la selección aleatoria, orientar el gesto y mantener el espejo fluido cuando los recursos opcionales o detectores fallen.

**Architecture:** La máquina de estados emite ayuda y cierra una sesión sin elección. El humo se carga fuera de la ruta crítica. Un módulo puro decide el perfil de rendimiento y `main.js` usa sus FPS y desfases.

**Tech Stack:** JavaScript ES modules, Canvas 2D, MediaPipe Tasks Vision, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-experiencia-robusta-design.md`

## Global Constraints

- Cámara y detección siguen siendo locales; no se guardan imágenes.
- `main.js` sólo orquesta; reglas nuevas en módulos puros y testeables.
- Ningún asset opcional retrasa el primer cuadro interactivo.
- El sostenido conserva tres segundos y no baja su precisión.

---

### Task 1: Selección asistida sin asignación aleatoria

**Files:**
- Modify: `espejo/maquina-estados.js`, `tests/espejo/maquina-estados.test.js`
- Modify: `espejo/main.js`, `espejo/escena.js`, `tests/espejo/escena.test.js`

**Interfaces:** `actualizar()` emitirá `{ tipo: 'ayuda-eleccion' }` una vez y cerrará sin evento `mira`; `dibujarConsigna(ctx, texto, alfa, disposicion)` renderiza la guía.

- [ ] Escribir una prueba que espere una sola `ayuda-eleccion` a los 10 s sin carrera y `CIERRE`, con `carrera === null`, al vencer `eleccionMaxima`.
- [ ] Ejecutar `npx vitest run tests/espejo/maquina-estados.test.js`; confirmar que falla porque hoy se emite `mira` con `opciones[0]`.
- [ ] Añadir en `maquina-estados.js` el flag de sesión `ayudaDeEleccionEnviada`, reiniciarlo al volver a atracción, emitir la ayuda una vez y reemplazar la selección forzosa por `ir(ESTADOS.CIERRE, ahora, eventos)`.
- [ ] Volver a ejecutar la suite enfocada hasta verla verde.
- [ ] Escribir una prueba de escena que compruebe que la consigna de sostenido genera `fillText` en un canvas falso; ejecutar y confirmar RED.
- [ ] Mostrar la consigna inicial durante exploración sin carrera y reemplazarla por el recordatorio tras el evento. Limpiarla al cerrar o iniciar otra sesión.
- [ ] Ejecutar `npx vitest run tests/espejo/maquina-estados.test.js tests/espejo/escena.test.js tests/integracion/eleccion.test.js`.
- [ ] Commit: `git commit -am "feat: orientar la eleccion sin asignar carreras al azar"`.

### Task 2: Humo fuera de la ruta crítica

**Files:**
- Modify: `espejo/videos.js`, `tests/espejo/videos.test.js`, `espejo/main.js`

**Interfaces:** `iniciarCargaOpcional({ cargar, alResolver, alFallar })` retorna de inmediato; notifica resolución o fallo una sola vez.

- [ ] Escribir una prueba con una promesa pendiente que confirme que `iniciarCargaOpcional` retorna antes de resolver y llama a `alResolver` después; ejecutar `npx vitest run tests/espejo/videos.test.js` y confirmar RED.
- [ ] Exportar el adaptador de promesas mínimo en `videos.js`, absorbiendo el rechazo mediante `alFallar`.
- [ ] En `main.js`, inicializar `videoDeHumo` como `null` e iniciar la carga sin `await`; asignarlo sólo al resolver, conservando el warning al fallar.
- [ ] Ejecutar `npx vitest run tests/espejo/videos.test.js && npm test`.
- [ ] Commit: `git commit -am "fix: iniciar el espejo sin esperar el video de humo"`.

### Task 3: Calidad adaptativa y detectores escalonados

**Files:**
- Create: `espejo/rendimiento.js`, `tests/espejo/rendimiento.test.js`
- Modify: `espejo/config.js`, `espejo/main.js`, `espejo/operacion.js`, `tests/espejo/operacion.test.js`

**Interfaces:** `crearGobernadorRendimiento({ perfiles, fpsBajar, fpsSubir, msParaBajar, msParaSubir })` expone `registrar({ ahora, dt, protegiendoEleccion })` y `perfil()`.

- [ ] Escribir tests que bajen de `completo` a `equilibrado` después de 5 s a 20 FPS, nunca degraden durante sostenido y recuperen tras 10 s a más de 35 FPS. Ejecutar `npx vitest run tests/espejo/rendimiento.test.js` y confirmar RED.
- [ ] Implementar el gobernador puro con relojes en milisegundos: perfiles completo (20/12), equilibrado (16/10) y seguro (12/8); limpiar el reloj opuesto al volver a la zona neutral.
- [ ] Ejecutar la suite del módulo y confirmar GREEN.
- [ ] Declarar perfiles y umbrales en `CONFIG.rendimiento`; `main.js` entrega los FPS activos al cálculo de intervalos y desfasa rostro, manos y pose un tercio de su intervalo.
- [ ] Añadir al modelo del panel técnico el nombre de perfil activo y una prueba que lo muestre; ejecutar `npx vitest run tests/espejo/operacion.test.js`.
- [ ] Ejecutar `npm test`; iniciar `npm start`, activar demo con `D`, completar una selección con el puntero y comprobar con `P` el perfil activo.
- [ ] Commit: `git commit -am "feat: adaptar la calidad al rendimiento del stand"`.

### Task 4: Documentación y prueba física

**Files:**
- Modify: `docs/operacion.md`, `docs/despliegue.md`, `docs/arquitectura.md`

- [ ] Documentar el texto de orientación, que el plazo sin elección no asigna carrera, y el perfil adaptativo.
- [ ] Unificar el umbral operativo en 30 FPS y pedir observar el perfil antes de cambiar configuración manualmente.
- [ ] Añadir un protocolo de ocho personas, a 1,5 m y 2 m, que mida tiempo de elección, abandonos, alcance y FPS mínimo sin almacenar imágenes.
- [ ] Ejecutar `rg -n "25 FPS|sortea una carrera|eleccionMaxima" docs espejo` y corregir documentación inconsistente.
- [ ] Commit: `git commit -am "docs: preparar la operacion robusta del stand"`.

### Task 5: Verificación final

**Files:** todos los anteriores.

- [ ] Ejecutar `npm test && npm run listo`.
- [ ] Ejecutar `git diff main...HEAD --check && git status --short`.
- [ ] Añadir este plan y el spec: `git add docs/superpowers && git commit -m "docs: definir la experiencia robusta del espejo"`.
