const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isBlacklisted } = require('../utils/tokenBlacklist');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token no proporcionado o formato inválido' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }
    
    // Almacenar el token en req para uso posterior (logout)
    req.token = token;
    
    // Verificar si el token está en la blacklist
    if (isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token invalidado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validar que el ID sea un ObjectId válido
    if (!decoded.id || !decoded.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(401).json({ message: 'Token contiene ID inválido' });
    }

    let user;
    try {
      user = await User.findById(decoded.id).select('-password');
    } catch (dbError) {
      console.error('Error de base de datos:', dbError);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    if (!user.activo) {
      return res.status(401).json({ message: 'Usuario inactivo' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    console.error('Error en autenticación:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }
    
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ 
        message: 'No tienes permisos para acceder a este recurso' 
      });
    }
    next();
  };
};

module.exports = { auth, authorize };