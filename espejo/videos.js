// Los videos del espejo: el humo y los fondos que se mueven.
//
// Un fondo puede ser una foto o un video. El video NO reemplaza a la foto: la
// acompaña. Cada fondo declara siempre su `img` —que para un fondo con video es
// un cuadro del propio video— y el video es una mejora que llega cuando llega.
// Mientras no esta cargado, o si el archivo falta, se muestra la foto y no se
// nota nada. Es la misma regla que el humo, las manos y la pose: un agregado
// opcional no puede decidir si el espejo arranca ni dejar una pantalla en negro
// con publico delante.
//
// La otra mitad del trabajo es que SOLO SUENE UNO. Doce videos decodificando a
// la vez no los aguanta ninguna placa, y once de ellos no se ven: el banco
// arranca el de la ingenieria que se esta mostrando y pausa el resto.

/**
 * Carga un video y lo deja listo para dibujarse en cualquier momento, en loop y
 * mudo. Un video que arranca recien cuando hace falta llega tarde: el primer
 * medio segundo seria un cuadro negro.
 *
 * El tope no es una comodidad. Con la ventana tapada por otra —o minimizada—
 * Chrome posterga la descarga del video y no dispara ni `canplaythrough` ni
 * `error`. El elemento se queda en readyState 0 y la promesa no termina nunca,
 * asi que un `await` sobre ella frena el arranque ANTES de la camara y de
 * MediaPipe: la pantalla se queda en "cargando..." con publico delante. Si no
 * contesta a tiempo, se sigue sin ese video.
 */
export function cargarVideoDelNavegador(
  ruta,
  {
    msMaximos = 8000,
    crearVideo = () => document.createElement('video'),
    programar = (fn, ms) => setTimeout(fn, ms),
    cancelar = (id) => clearTimeout(id),
  } = {},
) {
  return new Promise((ok, falla) => {
    const video = crearVideo();
    let reloj;
    let terminado = false;

    // Una sola respuesta: despues del tope, un `canplaythrough` tardio llega a
    // un espejo que ya arranco sin ese video y no tiene que revivir nada.
    const cerrar = (responder) => (valor) => {
      if (terminado) return;
      terminado = true;
      cancelar(reloj);
      video.oncanplaythrough = null;
      video.onerror = null;
      responder(valor);
    };

    const listo = cerrar((v) => ok(v));

    // Al fallar no alcanza con soltar la promesa: hay que CORTARLE LA DESCARGA.
    // Un elemento abandonado con `src` puesto y `preload='auto'` sigue bajando
    // en segundo plano, y el navegador no lo recolecta mientras tenga una carga
    // de medios activa. Con varios videos, las descargas que se dieron por
    // perdidas seguirian corriendo todas juntas contra la camara y MediaPipe,
    // que es justo lo que la carga de a uno viene a evitar.
    const fallar = cerrar((error) => {
      video.removeAttribute?.('src');
      video.load?.();
      falla(error);
    });

    reloj = programar(
      () => fallar(new Error(`El video ${ruta} tardo demasiado en cargar`)),
      msMaximos,
    );

    video.src = ruta;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.oncanplaythrough = () => {
      video.play().catch(() => {});
      listo(video);
    };
    video.onerror = () => fallar(new Error(`No se pudo cargar ${ruta}`));
    video.load();
  });
}

// HAVE_CURRENT_DATA: hay al menos un cuadro decodificado. Por debajo de esto un
// drawImage no dibuja nada —en silencio, sin error— y el fondo quedaria vacio
// en vez de caer a la foto. Por eso el banco lo verifica antes de entregarlo.
const HAY_CUADRO = 2;

const tieneCuadro = (video) => Boolean(video) && (video.readyState ?? 0) >= HAY_CUADRO;

/**
 * El banco de videos de fondo. Hermano de `crearBanco` de imagenes.js, con dos
 * diferencias que salen de que un video pesa y decodifica:
 *
 * - `precargar` los carga DE A UNO. Doce descargas simultaneas compiten con la
 *   camara y con MediaPipe justo mientras el espejo esta arrancando.
 * - `mostrar` es la politica de reproduccion: suena el que se esta mostrando y
 *   nadie mas. Se llama en cada cuadro con la misma ruta, asi que repetir la
 *   que ya esta sonando no hace nada.
 */
export function crearBancoDeVideos({ cargar, raiz = '' }) {
  const cache = new Map();
  let sonando = null;

  const pausar = () => {
    const video = cache.get(sonando);
    if (video) video.pause();
    sonando = null;
  };

  return {
    async precargar(rutas) {
      const todas = [...new Set(rutas)].filter(Boolean);

      for (const ruta of todas.filter((r) => !cache.has(r))) {
        try {
          const video = await cargar(raiz + ruta);
          // Cargado no es lo mismo que sonando: quien decide cual suena es
          // `mostrar`. El cargador lo deja andando para tener cuadro listo.
          video.pause();
          cache.set(ruta, video);
        } catch {
          cache.set(ruta, null);
        }
      }

      return { total: todas.length, faltantes: todas.filter((ruta) => !cache.get(ruta)) };
    },

    // Null mientras no tenga un cuadro decodificado: el que llama cae a la foto,
    // que es exactamente lo que tiene que pasar.
    obtener(ruta) {
      const video = cache.get(ruta) ?? null;
      return tieneCuadro(video) ? video : null;
    },

    /**
     * Que video suena. Sin ruta —o con una que no cargo— no suena ninguno.
     * Volver a una ingenieria ya vista la muestra desde el principio: el fondo
     * entra de nuevo, y el video con el.
     */
    mostrar(ruta) {
      // Vale tambien para null contra null, que es el caso de casi toda la
      // sesion: sin fondo a la vista esto se llama en cada cuadro.
      if ((ruta ?? null) === sonando) return;

      const video = ruta ? cache.get(ruta) : null;
      pausar();
      if (!video) return;

      sonando = ruta;
      // Solo si hace falta: asignar currentTime dispara un salto, y durante el
      // salto el video se queda sin cuadro decodificado (readyState baja) y
      // `obtener` devuelve null. Rebobinar uno que ya esta en el principio
      // seria pagar ese parpadeo por nada.
      if (video.currentTime > 0) video.currentTime = 0;
      video.play()?.catch?.(() => {});
    },

    detener: pausar,
    sonando: () => sonando,
    faltantes: () => [...cache.entries()].filter(([, video]) => !video).map(([ruta]) => ruta),
  };
}
