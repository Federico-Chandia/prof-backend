const express = require('express');
const { body } = require('express-validator');
const SolicitudesController = require('../controllers/solicitudesController');
const { auth } = require('../middleware/auth');
const { verificarCreditosProfesional } = require('../middleware/credits');
const { validateObjectId } = require('../middleware/security');

const router = express.Router();

// @route   POST /api/solicitudes
// @desc    Crear nueva solicitud (clientes - sin créditos)
// @access  Private
router.post('/', [
  auth,
  body('oficioId').notEmpty().withMessage('ID de oficio requerido'),
  body('descripcionTrabajo').notEmpty().withMessage('Descripción del trabajo requerida'),
  body('direccion.calle').notEmpty().withMessage('Dirección requerida'),
  body('direccion.barrio').notEmpty().withMessage('Barrio requerido')
], SolicitudesController.crearSolicitud);

// @route   POST /api/solicitudes/:id/responder
// @desc    Responder a solicitud (profesionales - usa créditos)
// @access  Private
router.post('/:id/responder', [
  auth,
  verificarCreditosProfesional,
  validateObjectId('id'),
  body('mensaje').notEmpty().withMessage('Mensaje de respuesta requerido')
], SolicitudesController.responderSolicitud);

// @route   GET /api/solicitudes
// @desc    Obtener solicitudes del usuario
// @access  Private
router.get('/', auth, SolicitudesController.obtenerSolicitudes);

// @route   PUT /api/solicitudes/:id/estado
// @desc    Cambiar estado de solicitud (sin créditos)
// @access  Private
router.put('/:id/estado', [
  auth,
  validateObjectId('id')
], SolicitudesController.cambiarEstado);

// @route   POST /api/solicitudes/:id/confirmar
// @desc    Confirmar trabajo completado (solo cliente)
// @access  Private
router.post('/:id/confirmar', [
  auth,
  validateObjectId('id'),
  body('aprobado').isBoolean().withMessage('Aprobación requerida')
], SolicitudesController.confirmarCompletado);

module.exports = router;