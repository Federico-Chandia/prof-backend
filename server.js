const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const { generalLimiter, validateContentType, sanitizeInput } = require('./middleware/security');
const ReservasController = require('./controllers/reservasController');

// Cargar variables de entorno
dotenv.config();

const app = express();
app.set('trust proxy', 1);

// Construir URL de WebSocket si está disponible
const backendUrl = process.env.BACKEND_URL || 'localhost:5003';
const wsUrl = `wss://${backendUrl}`;

// Middleware de seguridad - Helmet sin CSP, lo configuramos nosotros
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Deshabilitamos CSP de helmet para manejarlo manualmente
}));

// Configurar CORS ANTES de las demás cosas
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173', 'https://arregalo-profesionales.vercel.app'];

console.log('CORS - Allowed Origins:', allowedOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Content-Type-Options'],
  optionsSuccessStatus: 200
}));

// Manejar preflight requests explícitamente ANTES de otros middlewares
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Configurar CSP manualmente para excluir rutas legales
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/legal/view/')) {
    // CSP restrictivo para el resto de rutas
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' " + wsUrl);
  } else {
    // CSP más permisivo para documentos legales
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");
  }
  next();
});

// Body parser - DESPUÉS de CORS pero ANTES de seguridad adicional
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Seguridad adicional
app.use(mongoSanitize());
app.use(generalLimiter);
app.use(validateContentType);
app.use(sanitizeInput);

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });



// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/profesionales', require('./routes/profesionales'));
app.use('/api/oficios', require('./routes/oficios'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reservas', require('./routes/reservas'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/tokens', require('./routes/tokens'));
app.use('/api/notifications', require('./routes/notifications'));
// Uploads (images)
app.use('/api/uploads', require('./routes/uploads'));
// Documentos legales - Política de privacidad, términos y cookies
app.use('/api/legal', require('./routes/legal'));

// Brevo webhook endpoint to receive transactional events
app.use('/webhooks/brevo', require('./routes/brevoWebhook'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: '🚀 API de Oficios Locales funcionando!' });
});

// Health check endpoint para mantener el servidor activo
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Error de validación', errors });
  }
  
  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token inválido' });
  }
  
  // Error de duplicado de MongoDB
  if (err.code === 11000) {
    return res.status(400).json({ message: 'Recurso ya existe' });
  }
  
  res.status(err.status || 500).json({ 
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message 
  });
});

// Cron job para auto-confirmación de trabajos (ejecuta cada hora)
cron.schedule('0 * * * *', async () => {
  try {
    const confirmados = await ReservasController.autoConfirmarTrabajos();
    if (confirmados > 0) {
      console.log(`✅ Auto-confirmados ${confirmados} trabajos`);
    }
  } catch (error) {
    console.error('❌ Error en auto-confirmación:', error);
  }
});

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5003;

// Crear servidor HTTP para integrar Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL.split(','),
    methods: ['GET', 'POST']
  }
});

// Inicializar manejadores de sockets (chat)
try {
  require('./sockets/chat')(io);
  console.log('🔌 Socket.IO inicializado');
} catch (err) {
  console.error('Error inicializando sockets:', err);
}
app.use(express.json());

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log('⏰ Cron job de auto-confirmación iniciado');
});

module.exports = { app, server, io };