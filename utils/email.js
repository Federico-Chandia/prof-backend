const nodemailer = require('nodemailer');

// Validar variables de entorno
if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  Configuración de email incompleta. Variables esperadas: EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT');
  console.warn('📧 Para Brevo usa:');
  console.warn('   EMAIL_HOST=smtp-relay.brevo.com');
  console.warn('   EMAIL_PORT=587');
  console.warn('   EMAIL_USER=tu-email@tudominio.com');
  console.warn('   EMAIL_PASS=tu-api-key-de-brevo');
}

// Configuración de Brevo SMTP
// Host: smtp-relay.brevo.com
// Puerto: 587 (TLS) o 465 (SSL)
// Usuario: tu email
// Contraseña: tu API Key de Brevo

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_PORT == 465, // true para 465 (SSL), false para 587 (TLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  connectionTimeout: 5000,
  socketTimeout: 5000
});

// Verificar conexión al iniciar
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Error verificando configuración de email:', error.message);
    console.error('💡 Verifica que EMAIL_HOST, EMAIL_USER y EMAIL_PASS sean correctos en .env');
  } else {
    console.log('✅ Servidor de email (Brevo) conectado correctamente');
  }
});

const sendEmail = async (options) => {
  try {
    // Validar opciones requeridas
    if (!options.to || !options.subject) {
      throw new Error('Destinatario y asunto son requeridos');
    }

    const message = {
      from: `Profesionales <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html || options.text,
      replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER
    };

    console.log(`📧 Enviando email a: ${options.to}, Asunto: ${options.subject}`);
    const result = await transporter.sendMail(message);
    console.log('✅ Email enviado exitosamente via Brevo:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    throw new Error(`Error al enviar email: ${error.message}`);
  }
};

module.exports = { sendEmail };