const Subscription = require('../models/Subscription');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');

class SubscriptionsController {
  // Obtener suscripción actual
  static async obtenerSuscripcion(req, res) {
    try {
      const suscripcion = await Subscription.findOne({ 
        usuario: req.user.id, 
        estado: 'activa' 
      });
      
      res.json({ suscripcion: suscripcion || null });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Verificar créditos disponibles
  static async verificarCreditos(req, res) {
    try {
      const usuario = await User.findById(req.user.id);
      const suscripcion = await Subscription.findOne({ 
        usuario: req.user.id, 
        estado: 'activa' 
      });
      
      const creditosDisponibles = suscripcion?.creditos.disponibles || 0;
      const esProfesional = usuario.rol === 'oficio';
      
      res.json({ 
        creditosDisponibles,
        esProfesional,
        puedeResponderSolicitudes: esProfesional && (creditosDisponibles > 0 || suscripcion?.plan !== 'gratuito'),
        puedeCrearSolicitudes: !esProfesional // Los clientes siempre pueden crear solicitudes
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Usar crédito para responder solicitud (solo profesionales)
  static async usarCredito(req, res) {
    try {
      const { solicitudId } = req.body;
      
      // Verificar que el usuario sea profesional
      const usuario = await User.findById(req.user.id);
      if (usuario.rol !== 'oficio') {
        return res.status(403).json({ 
          message: 'Solo los profesionales pueden usar créditos para responder solicitudes' 
        });
      }
      
      const suscripcion = await Subscription.findOne({ 
        usuario: req.user.id, 
        estado: 'activa' 
      });
      
      // Plan profesional/premium = créditos ilimitados
      if (suscripcion?.plan !== 'gratuito') {
        // Registrar transacción para seguimiento
        await CreditTransaction.create({
          usuario: req.user.id,
          tipo: 'uso',
          cantidad: 0,
          descripcion: 'Respuesta a solicitud (plan premium)',
          solicitud: solicitudId
        });
        
        return res.json({ 
          message: 'Respuesta enviada (plan premium)',
          creditosRestantes: 'ilimitados' 
        });
      }
      
      if (!suscripcion || suscripcion.creditos.disponibles <= 0) {
        return res.status(400).json({ 
          message: 'No tienes créditos disponibles para responder solicitudes' 
        });
      }

      // Descontar crédito
      suscripcion.creditos.disponibles -= 1;
      suscripcion.creditos.usados += 1;
      await suscripcion.save();

      // Registrar transacción
      await CreditTransaction.create({
        usuario: req.user.id,
        tipo: 'uso',
        cantidad: -1,
        descripcion: 'Respuesta a solicitud',
        solicitud: solicitudId
      });

      res.json({ 
        message: 'Crédito usado exitosamente',
        creditosRestantes: suscripcion.creditos.disponibles 
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = SubscriptionsController;