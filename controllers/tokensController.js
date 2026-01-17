const User = require('../models/User');
const { recargarTokens, inicializarTokens } = require('../middleware/tokens');

class TokensController {
  // Obtener información de tokens del usuario
  static async obtenerTokens(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId).select('tokens rol');
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      if (user.rol !== 'profesional') {
        return res.status(403).json({ message: 'Solo profesionales tienen tokens' });
      }
      
      // Inicializar tokens si no existen o están en 0
      if (!user.tokens || user.tokens.disponibles === 0) {
        await inicializarTokens(userId);
        const updatedUser = await User.findById(userId).select('tokens');
        return res.json(updatedUser.tokens);
      }
      
      res.json(user.tokens);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // Recargar tokens (para administradores o sistema de pagos)
  static async recargarTokensUsuario(req, res) {
    try {
      const { userId } = req.params;
      const { cantidad, plan } = req.body;
      
      // Verificar que el usuario actual es admin o es el mismo usuario
      if (req.user.rol !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const resultado = await recargarTokens(userId, cantidad, plan);
      
      res.json({
        message: 'Tokens recargados exitosamente',
        ...resultado
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // Obtener historial de tokens
  static async obtenerHistorial(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId)
        .select('tokens.historial')
        .populate('tokens.historial.reservaId', 'numeroOrden descripcionTrabajo');
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      const historial = user.tokens?.historial || [];
      
      res.json(historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // Inicializar tokens manualmente (para casos donde no se inicializaron correctamente)
  static async inicializarTokensManual(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      if (user.rol !== 'profesional') {
        return res.status(403).json({ message: 'Solo profesionales pueden tener tokens' });
      }
      
      const tokens = await inicializarTokens(userId);
      
      res.json({
        message: 'Tokens inicializados correctamente',
        tokens
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // Obtener planes disponibles
  static async obtenerPlanes(req, res) {
    try {
      const planes = {
        basico: {
          nombre: 'Básico',
          tokens: 10,
          precio: 2000,
          descripcion: '10 trabajos por mes',
          caracteristicas: [
            '10 tokens mensuales',
            'Soporte básico',
            'Notificaciones por email'
          ]
        },
        premium: {
          nombre: 'Premium',
          tokens: 30,
          precio: 5000,
          descripcion: '30 trabajos por mes',
          caracteristicas: [
            '30 tokens mensuales',
            'Soporte prioritario',
            'Notificaciones push',
            'Estadísticas avanzadas'
          ]
        },
        profesional: {
          nombre: 'Profesional',
          tokens: 100,
          precio: 15000,
          descripcion: '100 trabajos por mes',
          caracteristicas: [
            '100 tokens mensuales',
            'Soporte 24/7',
            'Todas las notificaciones',
            'Estadísticas completas',
            'Prioridad en búsquedas'
          ]
        }
      };
      
      res.json(planes);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = TokensController;