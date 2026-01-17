const express = require('express');
const SubscriptionsController = require('../controllers/subscriptionsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/mi-suscripcion', auth, SubscriptionsController.obtenerSuscripcion);
router.get('/creditos', auth, SubscriptionsController.verificarCreditos);
router.post('/usar-credito', auth, SubscriptionsController.usarCredito);

module.exports = router;