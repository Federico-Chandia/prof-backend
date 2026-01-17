const rateLimit = require('express-rate-limit');

// Rate limiting para prevenir ataques de fuerza bruta
const createRateLimit = (windowMs = 150 * 60 * 1000, max = 1000) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Rate limiting específico para autenticación
const authLimiter = process.env.NODE_ENV === 'production'
  ? createRateLimit(40 * 60 * 1000, 5) // 5 intentos por 40 minutos en producción
  : createRateLimit(15 * 60 * 1000, 50); // 50 intentos por 15 minutos en desarrollo

// Rate limiting general - deshabilitado en desarrollo
const generalLimiter = process.env.NODE_ENV === 'production' 
  ? createRateLimit(15 * 60 * 1000, 100) // 100 requests por 15 minutos en producción
  : (req, res, next) => next(); // Sin límite en desarrollo

// Middleware para validar Content-Type en requests POST/PUT
const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Solo validar Content-Type si hay un body
    if (req.body && Object.keys(req.body).length > 0 && !req.is('application/json')) {
      return res.status(400).json({
        message: 'Content-Type debe ser application/json'
      });
    }
  }
  next();
};

// Middleware para sanitizar entrada
const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => typeof str === 'string' ? str.trim() : str;
  
  // Sanitizar solo strings en el primer nivel para mejor rendimiento
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  
  if (req.query) {
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }
  
  next();
};

// Middleware para validar ObjectId de MongoDB
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (id && !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: `${paramName} inválido`
      });
    }
    next();
  };
};

module.exports = {
  authLimiter,
  generalLimiter,
  validateContentType,
  sanitizeInput,
  validateObjectId
};