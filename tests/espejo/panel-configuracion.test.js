import { describe, it, expect } from 'vitest';
import { presentarCamaras } from '../../espejo/panel-configuracion.js';

describe('presentarCamaras', () => {
  const CAMARAS = [
    { id: 'frontal', nombre: 'Camara frontal' },
    { id: 'lateral', nombre: 'Camara lateral' },
  ];

  it('mantiene seleccionada la camara activa', () => {
    const presentacion = presentarCamaras(CAMARAS, 'lateral');

    expect(presentacion.seleccionada).toBe('lateral');
    expect(presentacion.resumen).toBe('2 camaras disponibles.');
  });

  it('usa la primera si la activa desaparecio', () => {
    expect(presentarCamaras(CAMARAS, 'desconectada').seleccionada).toBe('frontal');
  });

  it('presenta una lista vacia sin seleccion', () => {
    expect(presentarCamaras([], null)).toEqual({
      opciones: [],
      seleccionada: '',
      resumen: 'No se detectaron camaras.',
    });
  });

  it('completa etiquetas vacias para que el selector sea entendible', () => {
    const presentacion = presentarCamaras([{ id: 'anonima', nombre: '' }], 'anonima');

    expect(presentacion.opciones[0].nombre).toBe('Camara 1');
    expect(presentacion.resumen).toBe('1 camara disponible.');
  });
});
