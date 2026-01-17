const axios = require('axios');

class GeocodingService {
  constructor() {
    // Usar OpenStreetMap Nominatim (gratuito) como alternativa a Google Maps
    this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  }

  // Geocodificar dirección a coordenadas
  async geocodeAddress(address) {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'ar', // Solo Argentina
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'ArreglaLo-App/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name,
          components: {
            street: result.address?.road || '',
            neighborhood: result.address?.neighbourhood || result.address?.suburb || '',
            city: result.address?.city || result.address?.town || 'Buenos Aires',
            state: result.address?.state || 'Buenos Aires',
            country: result.address?.country || 'Argentina'
          }
        };
      }
      
      throw new Error('No se encontraron resultados para la dirección');
    } catch (error) {
      throw new Error(`Error en geocodificación: ${error.message}`);
    }
  }

  // Geocodificación inversa: coordenadas a dirección
  async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/reverse`, {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'ArreglaLo-App/1.0'
        }
      });

      if (response.data) {
        const result = response.data;
        return {
          formattedAddress: result.display_name,
          components: {
            street: result.address?.road || '',
            streetNumber: result.address?.house_number || '',
            neighborhood: result.address?.neighbourhood || result.address?.suburb || '',
            city: result.address?.city || result.address?.town || 'Buenos Aires',
            state: result.address?.state || 'Buenos Aires',
            country: result.address?.country || 'Argentina'
          }
        };
      }
      
      throw new Error('No se pudo obtener la dirección');
    } catch (error) {
      throw new Error(`Error en geocodificación inversa: ${error.message}`);
    }
  }

  // Calcular distancia entre dos puntos (fórmula de Haversine)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distancia en km
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  // Buscar lugares cercanos
  async searchNearby(query, lat, lng, radius = 10) {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: query,
          format: 'json',
          limit: 10,
          countrycodes: 'ar',
          addressdetails: 1,
          bounded: 1,
          viewbox: `${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}` // Área aproximada
        },
        headers: {
          'User-Agent': 'ArreglaLo-App/1.0'
        }
      });

      return response.data.map(result => ({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        name: result.display_name,
        distance: this.calculateDistance(lat, lng, parseFloat(result.lat), parseFloat(result.lon))
      })).filter(place => place.distance <= radius);
      
    } catch (error) {
      throw new Error(`Error buscando lugares cercanos: ${error.message}`);
    }
  }
}

module.exports = new GeocodingService();