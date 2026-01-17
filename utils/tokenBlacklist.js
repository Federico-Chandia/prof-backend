const jwt = require('jsonwebtoken');

// En producción, esto debería ser una base de datos Redis o similar
const tokenBlacklist = new Set();

// Agregar token a la blacklist
const addToBlacklist = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      // Solo almacenar hasta que expire naturalmente
      tokenBlacklist.add(token);
      
      // Limpiar token expirado después de su tiempo de vida
      const expirationTime = decoded.exp * 1000 - Date.now();
      if (expirationTime > 0) {
        setTimeout(() => {
          tokenBlacklist.delete(token);
        }, expirationTime);
      }
    }
  } catch (error) {
    console.error('Error agregando token a blacklist:', error);
  }
};

// Verificar si un token está en la blacklist
const isBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

// Limpiar tokens expirados (ejecutar periódicamente)
const cleanExpiredTokens = () => {
  const now = Math.floor(Date.now() / 1000);
  
  for (const token of tokenBlacklist) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp && decoded.exp < now) {
        tokenBlacklist.delete(token);
      }
    } catch (error) {
      // Token malformado, eliminarlo
      tokenBlacklist.delete(token);
    }
  }
};

// Limpiar cada hora
setInterval(cleanExpiredTokens, 60 * 60 * 1000);

module.exports = {
  addToBlacklist,
  isBlacklisted,
  cleanExpiredTokens
};