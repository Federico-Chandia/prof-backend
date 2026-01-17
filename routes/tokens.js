const express = require('express');
const router = express.Router();
const TokensController = require('../controllers/tokensController');
const { auth } = require('../middleware/auth');

// Obtener tokens del usuario actual
router.get('/', auth, TokensController.obtenerTokens);

// Inicializar tokens manualmente
router.post('/inicializar', auth, TokensController.inicializarTokensManual);

// Obtener historial de tokens
router.get('/historial', auth, TokensController.obtenerHistorial);

// Obtener planes disponibles
router.get('/planes', TokensController.obtenerPlanes);

// Recargar tokens (admin o auto-recarga)
router.post('/recargar/:userId', auth, TokensController.recargarTokensUsuario);

module.exports = router;