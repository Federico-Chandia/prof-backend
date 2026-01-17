const nodemailer = require('nodemailer');

// amazonq-ignore-next-line
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_PORT == 465, // true para 465, false para otros puertos
  // amazonq-ignore-next-line
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    // amazonq-ignore-next-line
    rejectUnauthorized: false
  }
});

const sendEmail = async (options) => {
  try {
    // Validar opciones requeridas
    if (!options.to || !options.subject) {
      throw new Error('Destinatario y asunto son requeridos');
    }

    const message = {
      from: `Oficios Locales <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const result = await transporter.sendMail(message);
    console.log('Email enviado exitosamente:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error enviando email:', error.message);
    throw new Error(`Error al enviar email: ${error.message}`);
  }
};

module.exports = { sendEmail };