// Carga de MediaPipe, una sola vez para todos los detectores.
//
// El paquete de WASM pesa mas de 11 MB. Si el detector de rostro y el de manos
// lo cargaran cada uno por su cuenta, se pagaria dos veces al arrancar.

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
