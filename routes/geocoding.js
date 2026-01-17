const express = require('express');
const geocodingService = require('../services/geocodingService');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/geocoding/search
// @desc    Buscar direcciones por texto
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Query de búsqueda requerido' });
    }

    const result = await geocodingService.geocodeAddress(query);
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/geocoding/reverse
// @desc    Obtener dirección desde coordenadas
// @access  Private
router.get('/reverse', auth, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Coordenadas lat y lng requeridas' });
    }

    const result = await geocodingService.reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/geocoding/nearby
// @desc    Buscar lugares cercanos
// @access  Private
router.get('/nearby', auth, async (req, res) => {
  try {
    const { q: query, lat, lng, radius = 10 } = req.query;
    
    if (!query || !lat || !lng) {
      return res.status(400).json({ message: 'Query, lat y lng requeridos' });
    }

    const results = await geocodingService.searchNearby(
      query, 
      parseFloat(lat), 
      parseFloat(lng), 
      parseFloat(radius)
    );
    
    res.json(results);
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/geocoding/distance
// @desc    Calcular distancia entre dos puntos
// @access  Private
router.post('/distance', auth, async (req, res) => {
  try {
    const { origin, destination } = req.body;
    
    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({ message: 'Coordenadas de origen y destino requeridas' });
    }

    const distance = geocodingService.calculateDistance(
      origin.lat, origin.lng,
      destination.lat, destination.lng
    );
    
    res.json({ 
      distance: Math.round(distance * 100) / 100, // Redondear a 2 decimales
      unit: 'km'
    });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;