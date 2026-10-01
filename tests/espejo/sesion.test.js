import { describe, it, expect } from 'vitest';
import {
  seleccionarObjetoDeCarrera,
  distribuirEscondidosEnSlots,
  crearSesionContenido,
} from '../../espejo/sesion.js';

describe('seleccionarObjetoDeCarrera', () => {
  const objetos = [
    { id: 'laptop', nombre: 'Laptop' },
    { id: 'procesador', nombre: 'Procesador' },
    { id: 'placa', nombre: 'Placa' },
    { id: 'mouse', nombre: 'Mouse' },
  ];

  it('permite elegir cualquier objeto mediante RNG inyectado', () => {
    expect(seleccionarObjetoDeCarrera(objetos, () => 0.0)?.id).toBe('laptop');
    expect(seleccionarObjetoDeCarrera(objetos, () => 0.26)?.id).toBe('procesador');
    expect(seleccionarObjetoDeCarrera(objetos, () => 0.51)?.id).toBe('placa');
    expect(seleccionarObjetoDeCarrera(objetos, () => 0.99)?.id).toBe('mouse');
  });

  it('no rompe con listas vacías o nulas', () => {
    expect(seleccionarObjetoDeCarrera([])).toBeNull();
    expect(seleccionarObjetoDeCarrera(null)).toBeNull();
  });
});

describe('distribuirEscondidosEnSlots', () => {
  const objetos = [
    { id: 'laptop', nombre: 'Laptop' },
    { id: 'procesador', nombre: 'Procesador' },
    { id: 'placa', nombre: 'Placa' },
    { id: 'mouse', nombre: 'Mouse' },
  ];
  const slots = [
    { x: 0.1, y: 0.2, escala: 0.24 },
    { x: 0.8, y: 0.2, escala: 0.24 },
    { x: 0.1, y: 0.4, escala: 0.24 },
  ];

  it('excluye al objeto elegido del carrusel', () => {
    const elegido = objetos[1]; // procesador
    const distribucion = distribuirEscondidosEnSlots({
      objetos,
      objetoElegido: elegido,
      slots,
      azar: () => 0.5,
    });

    const idsAsignados = distribucion.map((d) => d.definicion.id);
    expect(idsAsignados).not.toContain('procesador');
    expect(idsAsignados).toHaveLength(3);
    expect(new Set(idsAsignados).size).toBe(3);
  });

  it('asigna cada objeto escondido a un slot disponible', () => {
    const elegido = objetos[0]; // laptop
    const distribucion = distribuirEscondidosEnSlots({
      objetos,
      objetoElegido: elegido,
      slots,
      azar: () => 0.1,
    });

    expect(distribucion).toHaveLength(3);
    distribucion.forEach((item, i) => {
      expect(item.lugar).toBe(slots[i]);
      expect(item.indice).toBe(i);
    });
  });
});

describe('crearSesionContenido', () => {
  const carreraComputacion = {
    id: 'computacion',
    nombre: 'Computación',
    fondoActivo: 'principal',
    fondos: [
      {
        id: 'principal',
        lugar: { x: 0.8, y: 0.2, escala: 0.24 },
        escondites: [
          { x: 0.1, y: 0.2, escala: 0.24 },
          { x: 0.8, y: 0.4, escala: 0.24 },
          { x: 0.1, y: 0.4, escala: 0.24 },
        ],
      },
    ],
    objetos: [
      { id: 'laptop', nombre: 'Laptop' },
      { id: 'procesador', nombre: 'Procesador' },
      { id: 'placa', nombre: 'Placa' },
      { id: 'mouse', nombre: 'Mouse' },
    ],
  };

  const contenidoMock = {
    obtener: (id) => (id === 'computacion' ? carreraComputacion : null),
  };

  it('mantiene estable el representante durante toda la sesión', () => {
    let llamadas = 0;
    // RNG que da primero 0.3 (procesador) y luego 0.9 (mouse)
    const rng = () => (llamadas++ === 0 ? 0.3 : 0.9);

    const sesion = crearSesionContenido({ contenido: contenidoMock, azar: rng });
    sesion.iniciar(['computacion']);

    const primerLlamado = sesion.representanteDe('computacion');
    expect(primerLlamado.id).toBe('procesador');

    // Consultas posteriores dentro de la misma sesión no deben re-sortear
    const segundoLlamado = sesion.representanteDe('computacion');
    expect(segundoLlamado.id).toBe('procesador');
    expect(llamadas).toBe(1);
  });

  it('la disposición del fondo usa el representante del carrusel y mantiene escondidos estables', () => {
    const sesion = crearSesionContenido({
      contenido: contenidoMock,
      azar: () => 0.0, // laptop en el carrusel
    });
    sesion.iniciar(['computacion']);

    const disp1 = sesion.disposicionDe('computacion');
    expect(disp1.elegido.id).toBe('laptop');
    expect(disp1.escondidos.map((e) => e.definicion.id)).not.toContain('laptop');
    expect(disp1.escondidos).toHaveLength(3);

    // Múltiples consultas retornan la misma disposición sin recalcular
    const disp2 = sesion.disposicionDe('computacion');
    expect(disp2).toBe(disp1);
  });

  it('al reiniciar, una nueva sesión permite sortear un objeto diferente', () => {
    let rngVal = 0.0;
    const sesion = crearSesionContenido({ contenido: contenidoMock, azar: () => rngVal });

    sesion.iniciar(['computacion']);
    expect(sesion.representanteDe('computacion').id).toBe('laptop');

    sesion.reiniciar();
    rngVal = 0.99; // ahora saldrá mouse
    sesion.iniciar(['computacion']);
    expect(sesion.representanteDe('computacion').id).toBe('mouse');
  });
});

// CON UN FONDO GENERADO EL REPARTO NO SE BARAJA. Los cinco objetos estan
// pintados adentro de la foto, cada uno en su sitio y con su mascara: lo que el
// espejo dibuja al pasar la mano es un recorte de la foto, y la foto no se
// baraja. Barajado, la ficha del matraz salia sobre la columna de destilacion.
describe('sesion con un fondo generado', () => {
  const objetos = [
    { id: 'a', nombre: 'A' },
    { id: 'b', nombre: 'B' },
    { id: 'c', nombre: 'C' },
    { id: 'd', nombre: 'D' },
    { id: 'e', nombre: 'E' },
  ];
  const escondites = [
    { x: 0.1, y: 0.3, escala: 0.17 },
    { x: 0.9, y: 0.3, escala: 0.17 },
    { x: 0.1, y: 0.5, escala: 0.17 },
    { x: 0.9, y: 0.5, escala: 0.17 },
  ];
  const conRecortes = {
    id: 'escena',
    img: 'f.jpg',
    escondites,
    recortes: objetos.map((_, i) => ({ img: `r${i}.png`, caja: [0, 0, 0.1, 0.1] })),
  };
  const sinRecortes = { id: 'principal', img: 'f.jpg', escondites };

  const carrera = (fondo) => ({
    id: 'quimica',
    objetos,
    fondoActivo: fondo.id,
    fondos: [fondo],
  });
  const sesionCon = (fondo) =>
    crearSesionContenido({
      contenido: { obtener: () => carrera(fondo) },
      // Un azar que siempre daria vuelta el orden, para que barajar se note.
      azar: () => 0.99,
    });

  it('el del carrusel es el primero, el que esta pintado en su sitio', () => {
    expect(sesionCon(conRecortes).representanteDe('quimica')).toBe(objetos[0]);
  });

  it('los escondidos van en el orden del contenido, uno por escondite', () => {
    const { escondidos } = sesionCon(conRecortes).disposicionDe('quimica', conRecortes);
    expect(escondidos.map((e) => e.definicion.id)).toEqual(['b', 'c', 'd', 'e']);
    expect(escondidos.map((e) => e.lugar)).toEqual(escondites);
  });

  // Con objetos sueltos el azar sigue valiendo: dos visitantes seguidos no ven
  // el mismo objeto en el mismo rincon.
  it('sin recortes el del carrusel lo sigue eligiendo el azar', () => {
    expect(sesionCon(sinRecortes).representanteDe('quimica')).toBe(objetos[4]);
  });

  it('y el reparto respeta barajarlos', () => {
    const enOrden = distribuirEscondidosEnSlots({
      objetos,
      objetoElegido: objetos[0],
      slots: escondites,
      azar: () => 0.99,
      barajarlos: false,
    });
    expect(enOrden.map((e) => e.definicion.id)).toEqual(['b', 'c', 'd', 'e']);
  });
});
