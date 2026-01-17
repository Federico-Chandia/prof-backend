/**
 * Normaliza nombres de zonas (barrios, ciudades) a un formato estándar.
 * Facilita matching exacto o por radio.
 */

const ZONAS_MAP = {
  // CABA
  'caballito': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Caballito', provincia: 'CABA' },
  'la-boca': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'La Boca', provincia: 'CABA' },
  'monserrat': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Monserrat', provincia: 'CABA' },
  'san-telmo': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'San Telmo', provincia: 'CABA' },
  'palermo': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Palermo', provincia: 'CABA' },
  'colegiales': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Colegiales', provincia: 'CABA' },
  'flores': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Flores', provincia: 'CABA' },
  'floresta': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Floresta', provincia: 'CABA' },
  'villa-crespo': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Villa Crespo', provincia: 'CABA' },
  'saavedra': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Saavedra', provincia: 'CABA' },
  'belgrano': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Belgrano', provincia: 'CABA' },
  'barracas': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Barracas', provincia: 'CABA' },
  'caballito': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Caballito', provincia: 'CABA' },
  'chacarita': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Chacarita', provincia: 'CABA' },
  'villa-urquiza': { city: 'Ciudad Autónoma de Buenos Aires', partido: 'Villa Urquiza', provincia: 'CABA' },
  
  // Gran Buenos Aires (Provincias)
  'la-plata': { city: 'La Plata', partido: 'La Plata', provincia: 'Buenos Aires' },
  'quilmes': { city: 'Quilmes', partido: 'Quilmes', provincia: 'Buenos Aires' },
  'bernal': { city: 'Bernal', partido: 'Quilmes', provincia: 'Buenos Aires' },
  'avellaneda': { city: 'Avellaneda', partido: 'Avellaneda', provincia: 'Buenos Aires' },
  'lanús': { city: 'Lanús', partido: 'Lanús', provincia: 'Buenos Aires' },
  'lanus': { city: 'Lanús', partido: 'Lanús', provincia: 'Buenos Aires' },
  'valentín-alsina': { city: 'Valentín Alsina', partido: 'Avellaneda', provincia: 'Buenos Aires' },
  'valentin-alsina': { city: 'Valentín Alsina', partido: 'Avellaneda', provincia: 'Buenos Aires' },
  'ciudadela': { city: 'Ciudadela', partido: 'Tres de Febrero', provincia: 'Buenos Aires' },
  'morón': { city: 'Morón', partido: 'Morón', provincia: 'Buenos Aires' },
  'moron': { city: 'Morón', partido: 'Morón', provincia: 'Buenos Aires' },
  'moreno': { city: 'Moreno', partido: 'Moreno', provincia: 'Buenos Aires' },
  'ituzaingó': { city: 'Ituzaingó', partido: 'Ituzaingó', provincia: 'Buenos Aires' },
  'ituzaingo': { city: 'Ituzaingó', partido: 'Ituzaingó', provincia: 'Buenos Aires' },
  'castelar': { city: 'Castelar', partido: 'Morón', provincia: 'Buenos Aires' },
  'hurlingham': { city: 'Hurlingham', partido: 'Hurlingham', provincia: 'Buenos Aires' },
  'san-justo': { city: 'San Justo', partido: 'La Matanza', provincia: 'Buenos Aires' },
  'san-justo': { city: 'San Justo', partido: 'La Matanza', provincia: 'Buenos Aires' },
  'ramos-mejía': { city: 'Ramos Mejía', partido: 'La Matanza', provincia: 'Buenos Aires' },
  'ramos-mejia': { city: 'Ramos Mejía', partido: 'La Matanza', provincia: 'Buenos Aires' },
};

/**
 * Normaliza una zona (input string) a objeto con city, partido, provincia
 * Retorna null si no encuentra coincidencia
 */
exports.normalizarZona = (zonaInput) => {
  if (!zonaInput) return null;
  
  const zonaLower = zonaInput.toLowerCase().trim().replace(/\s+/g, '-');
  
  // Búsqueda exacta
  if (ZONAS_MAP[zonaLower]) {
    return ZONAS_MAP[zonaLower];
  }
  
  // Búsqueda parcial (contiene)
  for (const [key, value] of Object.entries(ZONAS_MAP)) {
    if (zonaLower.includes(key) || key.includes(zonaLower)) {
      return value;
    }
  }
  
  // Si no encuentra, devuelve un objeto genérico con la zona como está
  return {
    city: zonaInput,
    partido: zonaInput,
    provincia: 'Desconocida'
  };
};

/**
 * Filtra profesionales por zona con matching exacto o por partido/provincia
 */
exports.filtrarPorZona = (profesionales, zonaNormalizada) => {
  if (!zonaNormalizada) return profesionales;
  
  return profesionales.filter(prof => {
    if (!prof.zonasTrabajo || prof.zonasTrabajo.length === 0) return false;
    
    // Matching exacto por city o partido
    return prof.zonasTrabajo.some(zona => {
      const zonaNorm = exports.normalizarZona(zona);
      if (!zonaNorm) return false;
      
      return (
        zonaNorm.city?.toLowerCase() === zonaNormalizada.city?.toLowerCase() ||
        zonaNorm.partido?.toLowerCase() === zonaNormalizada.partido?.toLowerCase()
      );
    });
  });
};

/**
 * Calcula distancia aproximada entre dos puntos (Haversine formula)
 * Retorna distancia en km
 */
exports.calcularDistancia = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio terrestre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
