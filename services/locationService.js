const axios = require('axios');

class LocationService {
  constructor() {
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  }

  // Geocodificar dirección usando Nominatim
  async geocodeAddress(address) {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'ar' // Argentina
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
          displayName: result.display_name
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }

  // Calcular distancia usando MapBox
  async calculateDistance(origin, destination) {
    // Validar coordenadas
    if (!origin || !destination || 
        typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
        typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      console.error('Coordenadas inválidas:', { origin, destination });
      return 0;
    }

    if (!this.mapboxToken) {
      // Fallback a cálculo de distancia euclidiana
      return this.calculateHaversineDistance(origin, destination);
    }

    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
        {
          params: {
            access_token: this.mapboxToken,
            geometries: 'geojson'
          },
          timeout: 5000 // 5 segundos de timeout
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        const distance = response.data.routes[0].distance / 1000; // convertir a km
        return Math.round(distance * 100) / 100; // redondear a 2 decimales
      }
      
      // Fallback si no hay rutas
      return this.calculateHaversineDistance(origin, destination);
    } catch (error) {
      console.error('Error calculating distance with MapBox:', error);
      return this.calculateHaversineDistance(origin, destination);
    }
  }

  // Cálculo de distancia Haversine (línea recta)
  calculateHaversineDistance(origin, destination) {
    // Validar coordenadas
    if (!origin || !destination || 
        typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
        typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      console.error('Coordenadas inválidas para Haversine:', { origin, destination });
      return 0;
    }

    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(destination.lat - origin.lat);
    const dLng = this.toRad(destination.lng - origin.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(origin.lat)) * Math.cos(this.toRad(destination.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  // Calcular costo de desplazamiento
  calculateTravelCost(distance, kmGratuitos = 5, tarifaPorKm = 0) {
    if (distance <= kmGratuitos) {
      return 0;
    }
    const kmCobrados = distance - kmGratuitos;
    return Math.round(kmCobrados * tarifaPorKm * 100) / 100;
  }

  // Validar si está dentro del radio de cobertura
  isWithinCoverage(distance, radioCobertura = 20) {
    return distance <= radioCobertura;
  }
}

module.exports = new LocationService();