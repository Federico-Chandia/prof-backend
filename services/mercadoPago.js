const mercadopago = require('mercadopago');

class MercadoPagoService {
  static ensureConfigured() {
    if (!process.env.MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN no está configurado en las variables de entorno');
    }
    
    mercadopago.configure({
      access_token: process.env.MP_ACCESS_TOKEN
    });
  }

  static async crearPreferenciaSuscripcion(data) {
    this.ensureConfigured();
    
    try {
      const preference = {
        items: [{
          title: `Plan ${data.plan.charAt(0).toUpperCase() + data.plan.slice(1)} - 30 días`,
          unit_price: data.precio,
          quantity: 1,
          currency_id: 'ARS'
        }],
        payer: {
          name: data.usuarioNombre,
          email: data.usuarioEmail
        },
        external_reference: data.pagoId,
        notification_url: `${process.env.API_URL || 'http://localhost:5001'}/api/payments/webhook`,
        back_urls: {
          success: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/suscripcion/exito`,
          failure: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/suscripcion/error`,
          pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/suscripcion/pendiente`
        },
        auto_return: 'approved'
      };

      const response = await mercadopago.preferences.create(preference);
      return response.body;
    } catch (error) {
      throw new Error(`Error creando preferencia de suscripción: ${error.message}`);
    }
  }
}

module.exports = MercadoPagoService;