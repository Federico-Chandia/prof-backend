const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const MercadoPagoService = require('../services/mercadoPago');

class PaymentsController {
  // Crear pago para suscripción premium
  static async crearPagoSuscripcion(req, res) {
    try {
      const { plan } = req.body;
      const usuario = await User.findById(req.user.id);
      
      if (usuario.rol !== 'profesional') {
        return res.status(403).json({ message: 'Solo profesionales pueden suscribirse a planes premium' });
      }

      const precios = {
        profesional: 2999,
        premium: 4999
      };

      if (!precios[plan]) {
        return res.status(400).json({ message: 'Plan no válido' });
      }

      // Crear suscripción
      const suscripcion = new Subscription({
        usuario: req.user.id,
        plan,
        precio: precios[plan],
        fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        beneficios: {
          verificado: true,
          prioridad: plan === 'premium' ? 2 : 1,
          estadisticas: true,
          soportePrioritario: plan === 'premium'
        }
      });

      // Crear pago
      const pago = new Payment({
        usuario: req.user.id,
        suscripcion: suscripcion._id,
        monto: precios[plan],
        metodoPago: 'mercadopago',
        descripcion: `Suscripción ${plan} - 30 días`
      });
      // Si existe una URL de preapproval configurada para el plan, usarla
      const preapprovalUrls = {
        profesional: process.env.MP_PROFESIONAL_PLAN_URL,
        premium: process.env.MP_PREMIUM_PLAN_URL
      };

      const preapprovalUrl = preapprovalUrls[plan];

      if (preapprovalUrl) {
        // Guardar documentos y devolver el link de suscripción preaprobada
        pago.mercadoPago.preferenceId = null;
        await suscripcion.save();
        await pago.save();

        return res.json({
          pagoId: pago._id,
          preferenceId: null,
          initPoint: preapprovalUrl
        });
      }

      // Crear preferencia de MercadoPago (flujo por defecto si no hay preapproval URL)
      const preferencia = await MercadoPagoService.crearPreferenciaSuscripcion({
        plan,
        precio: precios[plan],
        usuarioNombre: usuario.nombre,
        usuarioEmail: usuario.email,
        pagoId: pago._id
      });

      pago.mercadoPago.preferenceId = preferencia.id;
      
      await suscripcion.save();
      await pago.save();

      res.json({
        pagoId: pago._id,
        preferenceId: preferencia.id,
        initPoint: preferencia.init_point
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Confirmar pago de suscripción (Webhook de MercadoPago)
  static async confirmarPagoSuscripcion(req, res) {
    try {
      // Mercado Pago puede enviar datos en query params o en body
      const data = req.body || req.query;
      const { payment_id, status, external_reference } = data;

      // Log para debugging
      console.log('[Webhook MP] Datos recibidos:', { payment_id, status, external_reference });

      if (!external_reference) {
        console.warn('[Webhook MP] external_reference no encontrado');
        return res.status(400).json({ message: 'external_reference requerido' });
      }
      
      const pago = await Payment.findById(external_reference).populate('suscripcion');
      if (!pago) {
        console.warn('[Webhook MP] Pago no encontrado:', external_reference);
        return res.status(404).json({ message: 'Pago no encontrado' });
      }

      pago.mercadoPago.paymentId = payment_id;
      pago.mercadoPago.status = status;
      
      if (status === 'approved') {
        pago.estado = 'aprobado';
        pago.fechaPago = new Date();
        
        // Activar suscripción
        pago.suscripcion.estado = 'activa';
        await pago.suscripcion.save();
        
        // Actualizar usuario
        await User.findByIdAndUpdate(pago.usuario, {
          planActual: pago.suscripcion.plan,
          verificado: true
        });

        console.log('[Webhook MP] Pago aprobado:', pago._id);

        // Analytics: proPaid
        try {
          const AnalyticsEvent = require('../models/AnalyticsEvent');
          await AnalyticsEvent.create({ event: 'proPaid', user: pago.usuario, properties: { plan: pago.suscripcion.plan, monto: pago.monto } });
        } catch (err) {
          console.error('Error logging analytics proPaid:', err);
        }
      } else if (status === 'pending') {
        pago.estado = 'pendiente';
        console.log('[Webhook MP] Pago pendiente:', pago._id);
      } else {
        pago.estado = 'rechazado';
        console.log('[Webhook MP] Pago rechazado:', pago._id);
      }

      await pago.save();
      res.json({ message: 'Pago procesado', estado: pago.estado });
    } catch (error) {
      console.error('[Webhook MP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Obtener historial de pagos
  static async obtenerHistorialPagos(req, res) {
    try {
      const pagos = await Payment.find({ usuario: req.user.id })
        .populate('suscripcion')
        .sort({ createdAt: -1 });
      
      res.json({ pagos });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = PaymentsController;