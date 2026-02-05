const express = require('express');
const router = express.Router();

// Cargar documentos legales con manejo de errores
let TERMINOS_Y_CONDICIONES_PROFESIONALES = '';
let POLITICA_PRIVACIDAD_PROFESIONALES = '';
let POLITICA_COOKIES_PROFESIONALES = '';

try {
  const legalDocs = require('../utils/legalDocuments');
  TERMINOS_Y_CONDICIONES_PROFESIONALES = legalDocs.TERMINOS_Y_CONDICIONES_PROFESIONALES || '';
  POLITICA_PRIVACIDAD_PROFESIONALES = legalDocs.POLITICA_PRIVACIDAD_PROFESIONALES || '';
  POLITICA_COOKIES_PROFESIONALES = legalDocs.POLITICA_COOKIES_PROFESIONALES || '';
  console.log('✅ Documentos legales cargados exitosamente');
} catch (error) {
  console.error('❌ Error cargando documentos legales:', error);
}

/**
 * @route GET /api/legal/terminos-condiciones
 * @desc Obtener términos y condiciones para profesionales
 * @access Public
 */
router.get('/terminos-condiciones', (req, res) => {
  try {
    if (!TERMINOS_Y_CONDICIONES_PROFESIONALES) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'Los términos y condiciones no están disponibles en este momento'
      });
    }
    
    res.json({
      titulo: 'Términos y Condiciones para Profesionales',
      contenido: TERMINOS_Y_CONDICIONES_PROFESIONALES,
      version: '1.0',
      fechaActualizacion: '2026-01-31',
      tipo: 'terminos'
    });
  } catch (error) {
    console.error('Error en /terminos-condiciones:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudo obtener el documento'
    });
  }
});

/**
 * @route GET /api/legal/privacidad
 * @desc Obtener política de privacidad
 * @access Public
 */
router.get('/privacidad', (req, res) => {
  try {
    if (!POLITICA_PRIVACIDAD_PROFESIONALES) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'La política de privacidad no está disponible en este momento'
      });
    }
    
    res.json({
      titulo: 'Política de Privacidad',
      contenido: POLITICA_PRIVACIDAD_PROFESIONALES,
      version: '1.0',
      fechaActualizacion: '2026-01-31',
      tipo: 'privacidad'
    });
  } catch (error) {
    console.error('Error en /privacidad:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudo obtener el documento'
    });
  }
});

/**
 * @route GET /api/legal/cookies
 * @desc Obtener política de cookies
 * @access Public
 */
router.get('/cookies', (req, res) => {
  try {
    if (!POLITICA_COOKIES_PROFESIONALES) {
      return res.status(503).json({
        error: 'Documento no disponible',
        message: 'La política de cookies no está disponible en este momento'
      });
    }
    
    res.json({
      titulo: 'Política de Cookies',
      contenido: POLITICA_COOKIES_PROFESIONALES,
      version: '1.0',
      fechaActualizacion: '2026-01-31',
      tipo: 'cookies'
    });
  } catch (error) {
    console.error('Error en /cookies:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudo obtener el documento'
    });
  }
});

/**
 * @route GET /api/legal/all
 * @desc Obtener todos los documentos legales
 * @access Public
 */
router.get('/all', (req, res) => {
  try {
    res.json({
      terminos: {
        titulo: 'Términos y Condiciones para Profesionales',
        contenido: TERMINOS_Y_CONDICIONES_PROFESIONALES,
        version: '1.0',
        fechaActualizacion: '2026-01-31',
        tipo: 'terminos'
      },
      privacidad: {
        titulo: 'Política de Privacidad',
        contenido: POLITICA_PRIVACIDAD_PROFESIONALES,
        version: '1.0',
        fechaActualizacion: '2026-01-31',
        tipo: 'privacidad'
      },
      cookies: {
        titulo: 'Política de Cookies',
        contenido: POLITICA_COOKIES_PROFESIONALES,
        version: '1.0',
        fechaActualizacion: '2026-01-31',
        tipo: 'cookies'
      }
    });
  } catch (error) {
    console.error('Error en /all:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: 'No se pudieron obtener los documentos'
    });
  }
});

module.exports = router;
