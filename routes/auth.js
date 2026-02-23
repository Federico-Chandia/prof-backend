const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { sendEmail } = require('../utils/email');
const { inicializarTokens } = require('../middleware/tokens');
const crypto = require('crypto');
const csrf = require('csrf');

const tokens = csrf();

// Middleware CSRF personalizado
const csrfProtection = (req, res, next) => {
  if (req.method === 'GET') {
    return next();
  }
  
  const secret = req.cookies?._csrf || req.session?.csrfSecret;
  const token = req.body._csrf || req.headers['x-csrf-token'];
  
  if (!secret || !token || !tokens.verify(secret, token)) {
    return res.status(403).json({ message: 'Token CSRF inválido' });
  }
  
  next();
};

const router = express.Router();

// @route   GET /api/auth/csrf-token
// @desc    Obtener token CSRF
// @access  Public
router.get('/csrf-token', (req, res) => {
  const secret = tokens.secretSync();
  const token = tokens.create(secret);
  
  res.cookie('_csrf', secret, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  res.json({ csrfToken: token });
});

// Generar JWT
const generateToken = (id) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  } catch (error) {
    console.error('Error generando token:', error);
    throw new Error('Error al generar token de autenticación');
  }
};

// @route   POST /api/auth/register
// @desc    Registrar usuario
// @access  Public
// amazonq-ignore-next-line
router.post('/register', [
  authLimiter,
  // csrfProtection, // Temporalmente deshabilitado
  (req, res, next) => {
    const origin = req.get('Origin') || req.get('Referer');
    if (origin) {
      const allowedRaw = process.env.FRONTEND_URL || 'http://localhost:3000';
      const allowed = allowedRaw.split(',').map(s => s.trim()).filter(Boolean);
      // During development, also allow Vite dev server default
      if (process.env.NODE_ENV === 'development') allowed.push('http://localhost:5173');
      const isAllowed = allowed.some(a => origin.includes(a));
      if (!isAllowed) {
        return res.status(403).json({ message: 'Origen no autorizado' });
      }
    }
    next();
  },
  body('nombre').trim().isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'),
  body('rol').isIn(['cliente', 'profesional']).withMessage('Rol inválido'),
  body('direccion.calle').notEmpty().withMessage('La dirección es requerida'),
  body('direccion.barrio').notEmpty().withMessage('El barrio es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, email, password, telefono, rol, direccion, aceptacionLegal, genero, preferenciaCliente } = req.body;

    // Verificar aceptación legal
    if (!aceptacionLegal?.terminosCondiciones?.aceptado || !aceptacionLegal?.politicaPrivacidad?.aceptado || !aceptacionLegal?.politicaCookies?.aceptado) {
      return res.status(400).json({ 
        message: 'Debes aceptar todos los documentos legales',
        errors: [{ msg: 'Aceptación legal incompleta' }]
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Crear usuario con información de aceptación legal y preferencias
    const user = new User({
      nombre,
      email,
      password,
      telefono,
      rol,
      direccion,
      aceptacionLegal,
      genero: genero || 'prefiero_no_decir',
      preferenciaCliente: preferenciaCliente || 'sin_preferencia',
      verificado: true // ⏸️ PAUSADO: Confirmación de email deshabilitada. Se reactivará para lanzamiento público
    });

    await user.save();

    /* ⏸️ PAUSADO: Confirmación de email deshabilitada hasta lanzamiento público
    // Generar token de confirmación por email
    const confirmToken = crypto.randomBytes(32).toString('hex');
    user.emailConfirmToken = confirmToken;
    user.emailConfirmExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
    await user.save();
    
    console.log(`[REGISTER] Token de confirmación guardado para ${user.email}: ${confirmToken}`);
    console.log(`[REGISTER] Expira en: ${new Date(user.emailConfirmExpires).toISOString()}`);

    // Construir URL de confirmación
    const confirmUrl = `${req.protocol}://${req.get('host')}/api/auth/confirm-email/${confirmToken}`;

    // Enviar email de confirmación
    const subject = 'Confirma tu correo en Profesionales';
    const html = `
      <p>Hola ${user.nombre},</p>
      <p>Bienvenido/a a Profesionales.</p>
      <p>Para confirmar tu casilla de correo electrónico, por favor haga click en el siguiente enlace:</p>
      <p><a href="${confirmUrl}" target="_blank">Confirmar mi correo electrónico</a></p>
      <p>Si el enlace no funciona, copia y pega esta URL en tu navegador:</p>
      <p>${confirmUrl}</p>
      <p>Saludos,<br/>Equipo Profesionales</p>
    `;

    try {
      console.log(`📧 Intentando enviar email de confirmación a: ${user.email}`);
      await sendEmail({ to: user.email, subject, html, text: `Visita ${confirmUrl} para confirmar tu correo.` });
      console.log(`✅ Email de confirmación enviado a: ${user.email}`);
    } catch (mailErr) {
      console.error('❌ Error enviando email de confirmación:', mailErr.message);
      // No abortamos el registro por fallo en email
    }
    */// ⏸️ FIN PAUSADO

    // Inicializar tokens si es profesional
    if (rol === 'profesional') {
      await inicializarTokens(user._id);
    }

    // Generar token
    const token = generateToken(user._id);

    // Obtener usuario actualizado con tokens
    const userWithTokens = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      token,
      user: userWithTokens
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/auth/login
// @desc    Login usuario
// @access  Public
// amazonq-ignore-next-line
router.post('/login', [
  authLimiter,
  // csrfProtection, // Temporalmente deshabilitado
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Password requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    // Verificar usuario
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'El email o la contraseña son inválidos.' });
    }

    // Verificar password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'El email o la contraseña son inválidos.' });
    }

    // Generar token
    const token = generateToken(user._id);

    // Obtener usuario completo con tokens
    const userWithTokens = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      token,
      user: userWithTokens
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/auth/me
// @desc    Obtener usuario actual
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Si el usuario es profesional, buscar su oficio
    let oficio = null;
    if (user.rol === 'profesional') {
      const Profesional = require('../models/Profesional');
      oficio = await Profesional.findOne({ usuario: user._id });
    }
    
    res.json({ success: true, user, oficio: oficio?._id || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout usuario (invalidar token)
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    const { addToBlacklist } = require('../utils/tokenBlacklist');
    
    // Agregar token actual a la blacklist
    if (req.token) {
      addToBlacklist(req.token);
    }
    
    res.json({ 
      success: true, 
      message: 'Sesión cerrada exitosamente' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refrescar token de acceso
// @access  Private
router.post('/refresh', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user || !user.activo) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    const newToken = generateToken(user._id);
    
    res.json({
      success: true,
      token: newToken,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/auth/test-email
// @desc    Enviar email de prueba (solo desarrollo)
// @access  Public
router.get('/test-email/:email', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Esta ruta no está disponible en producción' });
    }

    const { email } = req.params;
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    const testUrl = `${req.protocol}://${req.get('host')}/api/auth/confirm-email/TEST123TOKEN`;
    const html = `
      <p>Hola Usuario de Prueba,</p>
      <p>Bienvenido/a a Profesionales.</p>
      <p>Para confirmar tu casilla de correo electrónico, por favor haga click en el siguiente enlace:</p>
      <p><a href="${testUrl}" target="_blank">Confirmar mi correo electrónico</a></p>
      <p>Este es un email de prueba enviado desde: ${new Date().toLocaleString()}</p>
    `;

    await sendEmail({ 
      to: email, 
      subject: '🧪 Email de Prueba - Profesionales', 
      html,
      text: `Visita ${testUrl} para confirmar tu correo.` 
    });

    res.json({ success: true, message: `Email de prueba enviado a ${email}` });
  } catch (error) {
    console.error('Error en test-email:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/confirm-email/:token
// @desc    Confirmar dirección de email
// @access  Public
// ⏸️ PAUSADO: Funcionalidad deshabilitada hasta lanzamiento público
/*
router.get('/confirm-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`[CONFIRM-EMAIL] Recibido token: ${token}`);
    if (!token) return res.status(400).send('Token inválido');

    // Buscar usuario con token válido y no expirado
    const now = Date.now();
    console.log(`[CONFIRM-EMAIL] Buscando usuario con token=${token}, expiration > ${now}`);
    
    const user = await User.findOne({ 
      emailConfirmToken: token, 
      emailConfirmExpires: { $gt: now } 
    });
    
    console.log(`[CONFIRM-EMAIL] Resultado de búsqueda: ${user ? `Usuario encontrado (${user.email})` : 'NO ENCONTRADO'}`);
    
    if (!user) {
      // Debug: Buscar si existe con token pero expirado
      const expiredUser = await User.findOne({ emailConfirmToken: token });
      if (expiredUser) {
        console.log(`[CONFIRM-EMAIL] Token encontrado pero expirado. Email: ${expiredUser.email}, Expira: ${expiredUser.emailConfirmExpires}`);
      } else {
        console.log(`[CONFIRM-EMAIL] Token no encontrado en base de datos`);
      }
      
      // Redirigir al frontend con error
      const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0];
      return res.redirect(`${frontendBase}/email-confirmed?success=0`);
    }

    user.verificado = true;
    user.emailConfirmToken = undefined;
    user.emailConfirmExpires = undefined;
    await user.save();
    
    console.log(`[CONFIRM-EMAIL] Usuario confirmado exitosamente: ${user.email}`);

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0];
    // Redirigir al frontend indicando éxito
    return res.redirect(`${frontendBase}/email-confirmed?success=1`);
  } catch (error) {
    console.error('Error confirmando email:', error);
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0];
    return res.redirect(`${frontendBase}/email-confirmed?success=0`);
  }
});
*/ // ⏸️ FIN PAUSADO

// @route   POST /api/auth/change-password
// @desc    Cambiar contraseña
// @access  Private
router.post('/change-password', [
  auth,
  // csrfProtection, // Temporalmente deshabilitado
  body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Contraseña actual incorrecta' });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Contraseña actualizada exitosamente' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Solicitar recuperación de contraseña
// @access  Public
router.post('/forgot-password', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Email inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ 
        success: true, 
        message: 'Si el email existe, recibirás un enlace de recuperación' 
      });
    }

    // Generar token de recuperación
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hora

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Enviar email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    await sendEmail({
      to: user.email,
      subject: 'Recuperación de Contraseña - Oficios Locales',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recuperación de Contraseña</h2>
          <p>Hola ${user.nombre},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
          <a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Restablecer Contraseña</a>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste este cambio, ignora este email.</p>
        </div>
      `
    });

    res.json({ 
      success: true, 
      message: 'Si el email existe, recibirás un enlace de recuperación' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/auth/verify-reset-token/:token
// @desc    Verificar validez del token de recuperación
// @access  Public
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Token inválido o expirado' 
      });
    }

    res.json({ 
      valid: true, 
      message: 'Token válido' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Restablecer contraseña con token
// @access  Public
router.post('/reset-password', [
  authLimiter,
  body('token').notEmpty().withMessage('Token requerido'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Actualizar contraseña
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Contraseña restablecida exitosamente' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;