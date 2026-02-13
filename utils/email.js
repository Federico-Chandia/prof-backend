const axios = require('axios');

// Validar variables de entorno
if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
  console.warn('⚠️  Configuración de email incompleta. Variables esperadas: BREVO_API_KEY, EMAIL_FROM');
  console.warn('📧 Variables de entorno necesarias:');
  console.warn('   BREVO_API_KEY=tu-clave-api-de-brevo');
  console.warn('   EMAIL_FROM=tu-email@example.com');
}

// Cliente de API REST de Brevo
const brevoClient = axios.create({
  baseURL: 'https://api.brevo.com/v3',
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Verificar conexión al iniciar
(async () => {
  try {
    await brevoClient.get('/account');
    console.log('✅ Conexión a API de Brevo establecida correctamente');
  } catch (error) {
    console.error('❌ Error conectando a API de Brevo:', error.response?.data?.message || error.message);
    console.error('💡 Verifica que BREVO_API_KEY sea correcta en .env');
  }
})();

const sendEmail = async (options) => {
  try {
    // Validar opciones requeridas
    if (!options.to || !options.subject) {
      throw new Error('Destinatario y asunto son requeridos');
    }

    const emailPayload = {
      to: [{ email: options.to }],
      sender: { 
        name: 'Profesionales',
        email: process.env.EMAIL_FROM 
      },
      subject: options.subject,
      htmlContent: options.html || options.text,
      textContent: options.text || options.html,
      replyTo: { 
        email: process.env.EMAIL_FROM
      }
    };

    console.log(`📧 Enviando email via API Brevo a: ${options.to}, Asunto: ${options.subject}`);
    
    const response = await brevoClient.post('/smtp/email', emailPayload);
    
    console.log('✅ Email enviado exitosamente via Brevo:', response.data.messageId);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error('❌ Error enviando email:', errorMsg);
    throw new Error(`Error al enviar email: ${errorMsg}`);
  }
};

module.exports = { sendEmail };