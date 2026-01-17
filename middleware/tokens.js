const User = require('../models/User');

// Middleware para verificar tokens disponibles
const verificarTokens = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Solo verificar tokens para profesionales
    if (user.rol !== 'profesional') {
      return next();
    }
    
    // Verificar si tiene tokens disponibles
    if (!user.tokens || user.tokens.disponibles <= 0) {
      return res.status(403).json({ 
        message: 'No tienes tokens suficientes para aceptar este trabajo. Actualiza tu plan.',
        tokensDisponibles: user.tokens?.disponibles || 0
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para consumir un token
const consumirToken = async (userId, reservaId, descripcion = 'Trabajo aceptado') => {
  try {
    const user = await User.findById(userId);
    
    if (!user || user.rol !== 'profesional') {
      throw new Error('Usuario no válido para consumir tokens');
    }
    
    if (!user.tokens || user.tokens.disponibles <= 0) {
      throw new Error('No hay tokens disponibles');
    }
    
    // Consumir token
    user.tokens.disponibles -= 1;
    
    // Agregar al historial
    user.tokens.historial.push({
      tipo: 'consumo',
      cantidad: -1,
      descripcion,
      reservaId
    });
    
    await user.save();
    
    return {
      tokensRestantes: user.tokens.disponibles,
      mensaje: `Token consumido. Tokens restantes: ${user.tokens.disponibles}`
    };
  } catch (error) {
    throw error;
  }
};

// Función para recargar tokens
const recargarTokens = async (userId, cantidad, plan = null) => {
  try {
    const user = await User.findById(userId);
    
    if (!user || user.rol !== 'profesional') {
      throw new Error('Usuario no válido para recargar tokens');
    }
    
    // Inicializar tokens si no existen
    if (!user.tokens) {
      user.tokens = {
        disponibles: 0,
        plan: 'basico',
        historial: []
      };
    }
    
    // Recargar tokens
    user.tokens.disponibles += cantidad;
    
    // Actualizar plan si se proporciona
    if (plan) {
      user.tokens.plan = plan;
      user.tokens.renovacion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
    }
    
    // Agregar al historial
    user.tokens.historial.push({
      tipo: 'recarga',
      cantidad,
      descripcion: `Recarga de ${cantidad} tokens - Plan ${plan || user.tokens.plan}`
    });
    
    await user.save();
    
    return {
      tokensDisponibles: user.tokens.disponibles,
      plan: user.tokens.plan,
      mensaje: `${cantidad} tokens agregados. Total: ${user.tokens.disponibles}`
    };
  } catch (error) {
    throw error;
  }
};

// Función para inicializar tokens para nuevos profesionales
const inicializarTokens = async (userId, plan = 'basico') => {
  try {
    const user = await User.findById(userId);
    
    if (!user || user.rol !== 'profesional') {
      return null;
    }
    
    // Solo inicializar si no tiene tokens o tiene 0 tokens
    if (!user.tokens || user.tokens.disponibles === 0) {
      const tokensIniciales = {
        basico: 2,
        premium: 20,
        profesional: 50
      };
      
      const cantidadTokens = tokensIniciales[plan] || 2;
      
      user.tokens = {
        disponibles: cantidadTokens,
        plan,
        renovacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        historial: [{
          fecha: new Date(),
          tipo: 'regalo',
          cantidad: cantidadTokens,
          descripcion: `Tokens de bienvenida - Plan ${plan}`
        }]
      };
      
      await user.save();
      
      return user.tokens;
    }
    
    return user.tokens;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  verificarTokens,
  consumirToken,
  recargarTokens,
  inicializarTokens
};