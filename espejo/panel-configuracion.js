export function presentarCamaras(camaras, dispositivoActual) {
  const opciones = camaras.map((camara, indice) => ({
    id: camara.id,
    nombre: camara.nombre || `Camara ${indice + 1}`,
  }));
  const actualExiste = opciones.some((camara) => camara.id === dispositivoActual);

  return {
    opciones,
    seleccionada: actualExiste ? dispositivoActual : (opciones[0]?.id ?? ''),
    resumen:
      opciones.length === 0
        ? 'No se detectaron camaras.'
        : opciones.length === 1
          ? '1 camara disponible.'
          : `${opciones.length} camaras disponibles.`,
  };
}

export function instalarPanelConfiguracion({
  espejo,
  ventana = window,
  documento = document,
}) {
  const obtener = (id) => {
    const elemento = documento.getElementById(id);
    if (!elemento) throw new Error(`Falta el control de configuracion: ${id}`);
    return elemento;
  };

  const abrirPanel = obtener('abrir-configuracion');
  const cerrarPanel = obtener('cerrar-configuracion');
  const fondo = obtener('fondo-configuracion');
  const panel = obtener('panel-configuracion');
  const selectorCamara = obtener('selector-camara');
  const recargarCamaras = obtener('recargar-camaras');
  const estadoCamara = obtener('estado-camara-configuracion');
  const modoDemo = obtener('modo-demo');
  const avanceManual = obtener('avance-manual');
  const mostrarMalla = obtener('mostrar-malla');

  let abierto = false;
  let resumenCamaras = '';
  let actualizador = null;

  function sincronizarInterruptores() {
    modoDemo.checked = espejo.modo() === 'demo';
    avanceManual.checked = espejo.maquina.esManual();
    mostrarMalla.checked = espejo.mallaVisible();
  }

  function sincronizarEstadoCamara() {
    const estado = espejo.estadoDeCamara();
    if (estado.cambiando) {
      estadoCamara.textContent = 'Cambiando de camara...';
    } else if (estado.lista) {
      const resumen = resumenCamaras ? `${resumenCamaras} ` : '';
      estadoCamara.textContent = `${resumen}Activa: ${estado.nombre ?? 'camara predeterminada'}`;
    } else {
      estadoCamara.textContent = estado.error
        ? `Camara no disponible: ${estado.error}`
        : (resumenCamaras || 'Camara no disponible.');
    }
  }

  async function cargarCamaras() {
    selectorCamara.disabled = true;
    recargarCamaras.disabled = true;
    estadoCamara.textContent = 'Buscando camaras...';

    try {
      const camaras = await espejo.listarCamaras();
      const presentacion = presentarCamaras(
        camaras,
        espejo.estadoDeCamara().dispositivoId,
      );
      const opciones = presentacion.opciones.map((camara) => {
        const opcion = documento.createElement('option');
        opcion.value = camara.id;
        opcion.textContent = camara.nombre;
        return opcion;
      });

      selectorCamara.replaceChildren(...opciones);
      selectorCamara.value = presentacion.seleccionada;
      selectorCamara.disabled = opciones.length === 0;
      resumenCamaras = presentacion.resumen;
      sincronizarEstadoCamara();
    } catch (error) {
      resumenCamaras = '';
      selectorCamara.replaceChildren();
      selectorCamara.disabled = true;
      estadoCamara.textContent = 'No se pudo consultar las camaras.';
      console.error('listar camaras:', error);
    } finally {
      recargarCamaras.disabled = false;
    }
  }

  function abrir() {
    if (abierto) return;
    abierto = true;
    documento.body.classList.add('configuracion-abierta');
    abrirPanel.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
    sincronizarInterruptores();
    cargarCamaras();
    actualizador = ventana.setInterval(sincronizarEstadoCamara, 500);
    cerrarPanel.focus();
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;
    documento.body.classList.remove('configuracion-abierta');
    abrirPanel.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    if (actualizador !== null) ventana.clearInterval(actualizador);
    actualizador = null;
    abrirPanel.focus();
  }

  abrirPanel.addEventListener('click', abrir);
  cerrarPanel.addEventListener('click', cerrar);
  fondo.addEventListener('click', cerrar);
  recargarCamaras.addEventListener('click', cargarCamaras);

  selectorCamara.addEventListener('change', async () => {
    selectorCamara.disabled = true;
    estadoCamara.textContent = 'Cambiando de camara...';
    try {
      await espejo.seleccionarCamara(selectorCamara.value);
      sincronizarEstadoCamara();
    } catch (error) {
      estadoCamara.textContent = 'No se pudo cambiar de camara.';
      console.error('seleccionar camara:', error);
    } finally {
      selectorCamara.disabled = false;
    }
  });

  modoDemo.addEventListener('change', () => {
    espejo.cambiarModo(modoDemo.checked ? 'demo' : 'camara');
  });

  avanceManual.addEventListener('change', () => {
    if (avanceManual.checked !== espejo.maquina.esManual()) {
      espejo.maquina.alternarManual();
    }
  });

  mostrarMalla.addEventListener('change', () => {
    if (mostrarMalla.checked !== espejo.mallaVisible()) espejo.alternarMalla();
  });

  ventana.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && abierto) cerrar();
  });

  return {
    abrir,
    cerrar,
    abierto: () => abierto,
    actualizarCamaras: cargarCamaras,
  };
}
