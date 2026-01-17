const CATEGORIAS_PROFESIONALES = {
  'servicios-hogar': {
    nombre: 'Servicios del Hogar',
    // profesiones: valores de 'profesion' que se almacenan en el modelo Profesional
    profesiones: [
      'plomero',
      'electricista',
      'gasista',
      'cerrajero',
      'albanil',
      'aire-acondicionado',
      'pintor'
    ],
    // subcategorías de ayuda para interfaces y migraciones
    subcategorias: {
      plomero: ['Pérdidas de agua', 'Destapaciones', 'Reparación de cañerías', 'Termotanques', 'Grifería', 'Sanitarios'],
      electricista: ['Cortes de luz', 'Instalaciones eléctricas', 'Cortocircuitos', 'Tableros eléctricos', 'Iluminación'],
      gasista: ['Instalaciones', 'Reparaciones', 'Pérdidas de gas', 'Revisión de seguridad', 'Calderas'],
      cerrajero: ['Apertura de puertas', 'Cambio de cerraduras', 'Llaves perdidas', 'Cerraduras de seguridad'],
      albanil: ['Reparaciones generales', 'Revoques', 'Humedad', 'Pequeñas obras'],
      'aire-acondicionado': ['Instalación', 'Reparación', 'Carga de gas', 'Mantenimiento'],
      pintor: ['Pintura interiores', 'Pintura exteriores', 'Barnizado']
    }
  }
};

const getAllProfesiones = () => {
  const categoria = CATEGORIAS_PROFESIONALES['servicios-hogar'];
  return categoria ? categoria.profesiones.slice() : [];
};

const getCategoriaByProfesion = (profesion) => {
  const categoria = CATEGORIAS_PROFESIONALES['servicios-hogar'];
  if (categoria && categoria.profesiones.includes(profesion)) return 'servicios-hogar';
  return null;
};

module.exports = {
  CATEGORIAS_PROFESIONALES,
  getAllProfesiones,
  getCategoriaByProfesion
};