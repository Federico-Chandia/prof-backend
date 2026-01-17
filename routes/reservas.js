const express = require('express');
const { body, validationResult } = require('express-validator');
const ReservasController = require('../controllers/reservasController');
const { auth } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/security');

const router = express.Router();

// @route   POST /api/reservas/validar-cobertura
// @desc    Validar cobertura y calcular costos
// @access  Private
router.post('/validar-cobertura', [
  auth,
  body('oficioId').notEmpty().withMessage('ID de oficio requerido'),
  body('direccion.calle').notEmpty().withMessage('Dirección requerida'),
  body('direccion.barrio').notEmpty().withMessage('Barrio requerido'),
  body('tipoServicio').notEmpty().withMessage('Tipo de servicio requerido')
], ReservasController.validarCobertura);

// @route   POST /api/reservas
// @desc    Crear nueva reserva con pago anticipado
// @access  Private
router.post('/', [
  auth,
  body('oficioId').notEmpty().withMessage('ID de oficio requerido'),
  body('fechaHora').isISO8601().withMessage('Fecha y hora válida requerida'),
  body('descripcionTrabajo').notEmpty().withMessage('Descripción del trabajo requerida'),
  body('direccion.calle').notEmpty().withMessage('Dirección requerida'),
  body('direccion.barrio').notEmpty().withMessage('Barrio requerido')
], ReservasController.crearReserva);

// @route   GET /api/reservas
// @desc    Obtener reservas del usuario
// @access  Private
router.get('/', auth, ReservasController.obtenerReservas);

// @route   POST /api/reservas/confirmar-pago
// @desc    Confirmar pago y activar escrow
// @access  Public (webhook de MercadoPago)
router.post('/confirmar-pago', ReservasController.confirmarPago);

// @route   PUT /api/reservas/:id/estado
// @desc    Cambiar estado de reserva
// @access  Private
router.put('/:id/estado', [
  auth,
  validateObjectId('id')
], ReservasController.cambiarEstado);

// @route   PUT /api/reservas/:id/marcar-completado
// @desc    Marcar trabajo como completado por el profesional
// @access  Private
router.put('/:id/marcar-completado', [
  auth,
  validateObjectId('id')
], ReservasController.marcarCompletadoProfesional);

// @route   PUT /api/reservas/:id/confirmar
// @desc    Confirmar trabajo completado por el cliente
// @access  Private
router.put('/:id/confirmar', [
  auth,
  validateObjectId('id')
], ReservasController.confirmarTrabajo);

// @route   PUT /api/reservas/:id/solicitar-correcciones
// @desc    Solicitar correcciones al profesional
// @access  Private
router.put('/:id/solicitar-correcciones', [
  auth,
  validateObjectId('id'),
  body('descripcion').notEmpty().withMessage('Descripción de correcciones requerida')
], ReservasController.solicitarCorrecciones);

module.exports = router;