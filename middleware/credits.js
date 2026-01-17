const Subscription = require('../models/Subscription');
const User = require('../models/User');

// Middleware para verificar créditos solo para profesionales
const verificarCreditosProfesional = async (req, res, next) => {
  try {
    // Verificar que el usuario sea un profesional
    const usuario = await User.findById(req.user.id);
    if (usuario.rol !== 'oficio') {
      return res.status(403).json({ 
        message: 'Solo los profesionales pueden usar esta funcionalidad.',
        codigo: 'NO_PROFESIONAL'
      });
    }

    const suscripcion = await Subscription.findOne({ 
      usuario: req.user.id, 
      estado: 'activa' 
    });
    
    // Plan profesional/premium = créditos ilimitados
    if (suscripcion?.plan !== 'gratuito') {
      return next();
    }
    
    // Plan gratuito = verificar créditos
    if (!suscripcion || suscripcion.creditos.disponibles <= 0) {
      return res.status(403).json({ 
        message: 'No tienes créditos disponibles. Actualiza tu plan o compra créditos.',
        codigo: 'SIN_CREDITOS'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Middleware legacy para compatibilidad (ya no verifica créditos)
const verificarCreditos = async (req, res, next) => {
  // Los clientes ya no necesitan créditos para crear solicitudes
  next();
};

module.exports = { verificarCreditos, verificarCreditosProfesional };