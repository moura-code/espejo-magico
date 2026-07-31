import { mensajeAccion, TIPOS } from '../comun/protocolo.js';

const ESTADOS_CON_CARRERA = new Set(['REVELACION', 'ESCENA', 'REFLEXION']);

const SIMBOLOS_POR_CARRERA = {
  civil: '▦',
  alimentos: '◌',
  produccion: '⚙',
  electrica: 'ϟ',
  agrimensura: '⌖',
  computacion: '</>',
  'sistemas-comunicacion': '⌁',
  'fisico-matematico': '∑',
  mecanica: '⚙',
  naval: '≈',
  quimica: '⚗',
  'ciencias-atmosfera': '☁',
  'licenciatura-computacion': '</>',
  'ingenieria-biologica': '⌬',
  'tecnologo-carnico': '◇',
  'tecnologo-cartografia': '⌖',
  'tecnologo-industrial-mecanico': '⚙',
  'tecnologo-informatico': '</>',
};

const TEXTOS_POR_ESTADO = {
  ATRACCION: 'Todo listo',
  ENGANCHE: 'Preparando la experiencia',
  SORTEO: 'Entre muchos futuros posibles…',
  REVELACION: 'Esta carrera fue sorteada',
  ESCENA: 'Esta carrera fue sorteada',
  REFLEXION: 'Una posibilidad para transformar el futuro',
  CIERRE: 'Hasta la próxima',
};

export function crearTabletDeControles({ pantalla, enviar, obtenerCarrera = () => null }) {
  let firmaAnterior = null;
  let firmaCarreraAnterior = null;
  let estadoActual = null;
  let carreraActual = null;
  let ultimoMensaje = null;

  function mostrar(mensaje) {
    pantalla.mostrar({
      estado: mensaje.estado,
      botones: mensaje.botones,
      carrera: ESTADOS_CON_CARRERA.has(mensaje.estado) ? carreraActual : null,
    }, (id) => enviar(mensajeAccion(id)));
  }

  return {
    recibir(mensaje) {
      if (mensaje.tipo === TIPOS.CARRERA) {
        const firmaCarrera = `${mensaje.id}:${mensaje.sesion}`;
        if (firmaCarrera === firmaCarreraAnterior) return;
        firmaCarreraAnterior = firmaCarrera;
        carreraActual = obtenerCarrera(mensaje.id);
        if (ultimoMensaje && ESTADOS_CON_CARRERA.has(estadoActual)) mostrar(ultimoMensaje);
        return;
      }
      if (mensaje.tipo === TIPOS.REPOSO) {
        firmaCarreraAnterior = null;
        carreraActual = null;
        return;
      }
      if (mensaje.tipo !== TIPOS.CONTROLES) return;

      const firma = JSON.stringify(mensaje);
      if (firma === firmaAnterior) return;
      firmaAnterior = firma;
      estadoActual = mensaje.estado;
      ultimoMensaje = mensaje;

      mostrar(mensaje);
    },
  };
}

export function crearPantallaDeControles({
  contenedor,
  documento = document,
  duracionSorteoMs = 8000,
}) {
  let estadoAnterior = null;

  function crearEstado(estado, carrera) {
    const panel = documento.createElement('section');
    panel.className = `estado estado-${estado.toLowerCase()}`;

    if (estado === 'SORTEO') {
      panel.style.setProperty('--duracion-sorteo', `${duracionSorteoMs}ms`);
      const indicador = documento.createElement('div');
      indicador.className = 'indicador-sorteo';
      indicador.setAttribute('aria-hidden', 'true');
      indicador.style.setProperty('--duracion-sorteo', `${duracionSorteoMs}ms`);
      indicador.append(documento.createElement('span'));
      panel.append(indicador);
    } else if (carrera) {
      const simbolo = documento.createElement('div');
      simbolo.className = 'simbolo-carrera';
      simbolo.setAttribute('aria-hidden', 'true');
      simbolo.textContent = SIMBOLOS_POR_CARRERA[carrera.id] ?? '◆';

      const textos = documento.createElement('div');
      textos.className = 'resultado-carrera';
      const rotulo = documento.createElement('span');
      rotulo.textContent = TEXTOS_POR_ESTADO[estado];
      const nombre = documento.createElement('strong');
      nombre.textContent = carrera.nombre;
      textos.append(rotulo, nombre);
      panel.style.setProperty('--color-carrera', carrera.color);
      panel.append(simbolo, textos);
      return panel;
    }

    const texto = documento.createElement('p');
    texto.textContent = TEXTOS_POR_ESTADO[estado] ?? estado;
    panel.append(texto);
    return panel;
  }

  function crearAcciones(botones, alPulsar) {
    const acciones = documento.createElement('section');
    acciones.className = 'acciones';
    acciones.style.setProperty('--cantidad', Math.max(1, botones.length));
    acciones.dataset.cantidad = String(botones.length);

    const elementos = botones.map((boton, indice) => {
      const elemento = documento.createElement('button');
      elemento.type = 'button';
      elemento.className = 'control';
      elemento.dataset.accion = boton.id;
      elemento.style.setProperty('--color', boton.color);
      elemento.style.setProperty('--indice', indice);

      const etiqueta = documento.createElement('span');
      etiqueta.textContent = boton.etiqueta;
      elemento.append(etiqueta);
      elemento.addEventListener('click', () => {
        elemento.classList.remove('pulsado');
        void elemento.offsetWidth;
        elemento.classList.add('pulsado');
        alPulsar(boton.id);
      });
      return elemento;
    });

    acciones.append(...elementos);
    acciones.classList.toggle('sin-controles', botones.length === 0);
    return acciones;
  }

  return {
    mostrar({ estado, botones, carrera }, alPulsar) {
      const actualizar = () => {
        contenedor.dataset.estado = estado;
        contenedor.classList.toggle('sin-acciones', botones.length === 0);
        contenedor.replaceChildren(
          crearEstado(estado, carrera),
          crearAcciones(botones, alPulsar),
        );
      };

      if (
        estadoAnterior &&
        estadoAnterior !== estado &&
        typeof documento.startViewTransition === 'function'
      ) {
        documento.startViewTransition(actualizar);
      } else {
        actualizar();
      }
      estadoAnterior = estado;
    },
  };
}
