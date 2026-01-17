/**
 * Utilidad para manejar la revelación progresiva de información en solicitudes
 */

class InformacionSolicitud {
  /**
   * Obtiene la información visible según el estado de la solicitud
   * @param {Object} solicitud - La solicitud completa
   * @param {string} estado - Estado actual: 'pendiente', 'contactado', 'completada', 'cancelada'
   * @returns {Object} Información visible para el profesional
   */
  static getInformacionVisible(solicitud, estado = null) {
    const estadoActual = estado || solicitud.estado;
    
    switch (estadoActual) {
      case 'pendiente':
        // Solo ciudad y distancia aproximada
        return {
          ubicacion: `${solicitud.direccion.ciudad}`,
          distancia: solicitud.distanciaAproximada ? `a ${Math.round(solicitud.distanciaAproximada)} km` : null,
          precision: 'ciudad'
        };
        
      case 'contactado':
        // Ciudad, barrio opcional y distancia
        return {
          ubicacion: solicitud.direccion.barrio ? 
            `${solicitud.direccion.barrio}, ${solicitud.direccion.ciudad}` : 
            solicitud.direccion.ciudad,
          distancia: solicitud.distanciaAproximada ? `a ${Math.round(solicitud.distanciaAproximada)} km` : null,
          precision: 'barrio'
        };
        
      case 'completada':
      case 'cancelada':
        // Dirección completa
        return {
          ubicacion: `${solicitud.direccion.calle}, ${solicitud.direccion.barrio}, ${solicitud.direccion.ciudad}`,
          distancia: solicitud.distanciaAproximada ? `${solicitud.distanciaAproximada.toFixed(1)} km` : null,
          precision: 'completa'
        };
        
      default:
        return {
          ubicacion: solicitud.direccion.ciudad,
          distancia: null,
          precision: 'ciudad'
        };
    }
  }

  /**
   * Verifica si se puede revelar información adicional
   * @param {string} estadoActual - Estado actual de la solicitud
   * @param {string} nuevoEstado - Nuevo estado propuesto
   * @returns {boolean} Si se puede revelar más información
   */
  static puedeRevelarMasInformacion(estadoActual, nuevoEstado) {
    const jerarquia = {
      'pendiente': 1,
      'contactado': 2,
      'completada': 3,
      'cancelada': 3
    };
    
    return jerarquia[nuevoEstado] > jerarquia[estadoActual];
  }
}

module.exports = InformacionSolicitud;