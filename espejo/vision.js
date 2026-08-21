// Carga de MediaPipe, una sola vez para todos los detectores.
//
// El paquete de WASM pesa mas de 11 MB. Si los detectores de rostro, manos y
// pose lo cargaran cada uno por su cuenta, se pagaria tres veces al arrancar.
// La memorizacion no es reentrante: los detectores se crean uno despues del
// otro en main.js, nunca en paralelo.

let modulo = null;
let recursos = null;

export async function cargarVision(base) {
  modulo ??= await import(`${base}/vision_bundle.mjs`);
  recursos ??= await modulo.FilesetResolver.forVisionTasks(`${base}/wasm`);
  return { modulo, recursos };
}

// Solo para las pruebas: olvida lo cargado.
export function olvidarVision() {
  modulo = null;
  recursos = null;
}

/**
 * Crea un detector pidiendo la GPU y, si el navegador no la da, lo reintenta en
 * CPU.
 *
 * Los tres modelos corren sobre WebGL. Cuando Chrome no entrega contexto
 * —ventana tapada al arrancar, aceleracion por hardware apagada, GPU sin
 * driver— MediaPipe falla con `emscripten_webgl_create_context() returned error
 * 0` y arrastra al espejo entero: el rostro es obligatorio, asi que main.js
 * muestra "MediaPipe no cargó" y no dibuja nada mas. Un stand con publico
 * delante no puede quedarse en negro por eso.
 *
 * En CPU el reconocimiento anda mas lento —se nota sobre todo en la pose, que
 * ademas segmenta— pero la experiencia entera sigue en pie. Es el mismo criterio
 * que el fondo sin mascara: peor, nunca ausente.
 */
export async function crearConRespaldoEnCPU(crear, opciones) {
  const con = (delegate) => ({
    ...opciones,
    baseOptions: { ...opciones.baseOptions, delegate },
  });

  try {
    return await crear(con('GPU'));
  } catch (error) {
    console.warn(
      'MediaPipe no consiguió GPU, se reintenta en CPU (va a ir más lento):',
      error?.message ?? error,
    );
    return crear(con('CPU'));
  }
}
