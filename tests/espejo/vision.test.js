import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crearConRespaldoEnCPU } from '../../espejo/vision.js';

const OPCIONES = {
  baseOptions: { modelAssetPath: '/vendor/mediapipe/face_landmarker.task' },
  runningMode: 'VIDEO',
  numFaces: 1,
};

describe('crearConRespaldoEnCPU', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('pide la GPU primero, que es la que da los cuadros que el espejo necesita', async () => {
    const pedidos = [];
    const crear = async (opciones) => {
      pedidos.push(opciones.baseOptions.delegate);
      return { detector: true };
    };

    await crearConRespaldoEnCPU(crear, OPCIONES);

    expect(pedidos).toEqual(['GPU']);
  });

  // La falla real: con la ventana tapada o sin aceleracion por hardware, Chrome
  // no entrega contexto WebGL y MediaPipe muere con
  // "emscripten_webgl_create_context() returned error 0". Antes eso volteaba el
  // espejo entero; el stand se queda con una pantalla negra y publico delante.
  it('cae en CPU cuando el navegador no da contexto WebGL', async () => {
    const pedidos = [];
    const crear = async (opciones) => {
      pedidos.push(opciones.baseOptions.delegate);
      if (opciones.baseOptions.delegate === 'GPU') {
        throw new Error('emscripten_webgl_create_context() returned error 0');
      }
      return { detector: true };
    };

    const detector = await crearConRespaldoEnCPU(crear, OPCIONES);

    expect(pedidos).toEqual(['GPU', 'CPU']);
    expect(detector).toEqual({ detector: true });
  });

  it('avisa por consola cuando se queda sin GPU, que es una falla para mirar', async () => {
    const crear = async (opciones) => {
      if (opciones.baseOptions.delegate === 'GPU') throw new Error('sin WebGL');
      return {};
    };

    await crearConRespaldoEnCPU(crear, OPCIONES);

    expect(console.warn).toHaveBeenCalled();
  });

  it('conserva el resto de las opciones en los dos intentos', async () => {
    const vistas = [];
    const crear = async (opciones) => {
      vistas.push(opciones);
      if (opciones.baseOptions.delegate === 'GPU') throw new Error('sin WebGL');
      return {};
    };

    await crearConRespaldoEnCPU(crear, OPCIONES);

    for (const vista of vistas) {
      expect(vista.runningMode).toBe('VIDEO');
      expect(vista.numFaces).toBe(1);
      expect(vista.baseOptions.modelAssetPath).toBe(OPCIONES.baseOptions.modelAssetPath);
    }
  });

  // Si tampoco hay CPU no queda nada que intentar: el error tiene que llegar a
  // main.js para que muestre el aviso, no quedar tapado por el respaldo.
  it('deja pasar el error cuando tampoco se puede en CPU', async () => {
    const crear = async () => {
      throw new Error('modelo ausente');
    };

    await expect(crearConRespaldoEnCPU(crear, OPCIONES)).rejects.toThrow(/modelo ausente/);
  });

  it('no toca el objeto de opciones que le pasaron', async () => {
    const opciones = { baseOptions: { modelAssetPath: '/x.task' }, numFaces: 1 };
    const crear = async (o) => {
      if (o.baseOptions.delegate === 'GPU') throw new Error('sin WebGL');
      return {};
    };

    await crearConRespaldoEnCPU(crear, opciones);

    expect(opciones.baseOptions.delegate).toBeUndefined();
  });
});
