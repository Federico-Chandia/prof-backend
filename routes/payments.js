const express = require('express');
const PaymentsController = require('../controllers/paymentsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Crear pago para suscripción
router.post('/suscripcion', auth, (req, res) => PaymentsController.crearPagoSuscripcion(req, res));

// Webhook de MercadoPago
router.post('/webhook', (req, res) => PaymentsController.confirmarPagoSuscripcion(req, res));

// Historial de pagos
router.get('/historial', auth, (req, res) => PaymentsController.obtenerHistorialPagos(req, res));

module.exports = router;