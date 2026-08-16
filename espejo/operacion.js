// Todo lo que necesita el equipo del stand cuando algo se traba y hay quince
// personas en la fila. Nada de esto es visible para el publico.

const ACCIONES_SUELTAS = {
  r: 'reiniciar',
  d: 'demo',
  p: 'panel',
  m: 'malla',
  a: 'alternarManual',
  i: 'interaccion',
  ' ': 'avanzar',
};

const POR_NOMBRE = { Enter: 'avanzar', ArrowRight: 'avanzar' };

// La fila de numeros entera, en orden y sin saltos: una tecla por carrera de
// carreras.json. Se exporta para que tests/integracion/atajos.test.js pueda
// cotejarla contra el catalogo real — cuando el catalogo paso a doce carreras la
// tecla de la ultima no llego con ella, y ninguna prueba de este archivo podia
// notarlo porque todas usan su propio fixture.
export const TECLAS_CARRERA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export function interpretarTecla(tecla, ids) {
  const indice = TECLAS_CARRERA.indexOf(tecla);
  if (indice >= 0) {
    return indice < ids.length ? { accion: 'forzar', id: ids[indice] } : null;
  }

  const porNombre = POR_NOMBRE[tecla];
  if (porNombre) return { accion: porNombre };

  if (tecla.length !== 1) return null;
  const accion = ACCIONES_SUELTAS[tecla.toLowerCase()];
  return accion ? { accion } : null;
}

export function crearContadorFps({ ventana }) {
  const marcas = [];

  return {
    registrar(ahora) {
      marcas.push(ahora);
      while (marcas.length > ventana + 1) marcas.shift();
    },
    valor() {
      if (marcas.length < 2) return 0;
      const lapso = marcas.at(-1) - marcas[0];
      return lapso <= 0 ? 0 : ((marcas.length - 1) * 1000) / lapso;
    },
  };
}

export function instalarOperacion({
  espejo,
  tiempos,
  ventana = window,
  documento = document,
  recargar = () => location.reload(),
}) {
  const panel = documento.createElement('pre');
  panel.style.cssText = `
    position: fixed; top: 12px; left: 12px; margin: 0; padding: 10px 14px;
    font: 15px/1.5 monospace; color: #0f0; background: rgba(0,0,0,0.78);
    border-radius: 6px; white-space: pre; pointer-events: none;
    display: none; z-index: 9;
  `;
  documento.body.appendChild(panel);

  const fps = crearContadorFps({ ventana: 60 });
  let visible = false;

  ventana.addEventListener('keydown', (evento) => {
    const orden = interpretarTecla(evento.key, espejo.contenido.ids);
    if (!orden) return;
    evento.preventDefault();

    const ahora = performance.now();

    if (orden.accion === 'forzar') espejo.forzarCarrera(orden.id, ahora);
    if (orden.accion === 'reiniciar') espejo.reiniciar(ahora);
    if (orden.accion === 'avanzar') espejo.avanzar(ahora);
    if (orden.accion === 'alternarManual') espejo.maquina.alternarManual();
    if (orden.accion === 'demo') {
      espejo.cambiarModo(espejo.modo() === 'demo' ? 'camara' : 'demo');
    }
    if (orden.accion === 'malla') espejo.alternarMalla();
    if (orden.accion === 'interaccion') espejo.alternarInteraccion();
    if (orden.accion === 'panel') {
      visible = !visible;
      panel.style.display = visible ? 'block' : 'none';
    }
  });

  // Recarga programada, solo estando en reposo: evita la degradacion acumulada
  // de ocho horas de feria sin cortar nunca una sesion en curso.
  ventana.setInterval(() => {
    if (espejo.maquina.estado() === 'ATRACCION') recargar();
  }, tiempos.recargaCadaMs);

  return {
    panelVisible: () => visible,

    registrarCuadro(ahora) {
      fps.registrar(ahora);
      if (!visible) return;

      const camara = espejo.estadoDeCamara();
      panel.textContent = [
        `fps         ${fps.valor().toFixed(0)}`,
        `estado      ${espejo.maquina.estado()}`,
        `carrera     ${espejo.maquina.carrera() ?? '-'}`,
        `sesion      ${espejo.maquina.sesion()}`,
        `modo        ${espejo.modo()}`,
        `camara      ${camara.lista ? 'ok' : (camara.error ?? 'sin camara')}`,
        `puntos      ${espejo.detector.cantidadDePuntos()}`,
        `manos       ${espejo.manosCrudas()} vistas / ${espejo.manos().length} usadas`,
        `apertura    ${espejo.manos().map((m) => m.apertura.toFixed(1)).join('  ') || '-'}`,
        `radio mano  ${espejo.manos().map((m) => m.radio.toFixed(0)).join('  ') || '-'}`,
        `interaccion ${espejo.interaccionDeManos()}`,
        `bus         ${espejo.bus.conectado() ? 'conectado' : 'CORTADO'}`,
        `objetos     ${espejo.pool.vivos().length}`,
        `png faltan  ${espejo.banco.faltantes().length}`,
        ``,
        `avance      ${espejo.maquina.esManual() ? 'MANUAL' : 'automatico'}`,
        ``,
        `ESPACIO avanzar    A auto/manual`,
        `1-9,0,-,= carrera  R reiniciar`,
        `I iman/golpe       D demo`,
        `M malla            P cerrar`,
      ].join('\n');
    },
  };
}
