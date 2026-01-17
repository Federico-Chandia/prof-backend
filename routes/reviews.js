const express = require('express');
const { body, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Reserva = require('../models/Reserva');
const Profesional = require('../models/Profesional');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/reviews
// @desc    Crear review
// @access  Private
// amazonq-ignore-next-line
router.post('/', [
  auth,
  body('reserva').notEmpty().withMessage('ID de reserva requerido'),
  body('puntuacion').isInt({ min: 1, max: 5 }).withMessage('Puntuación debe ser entre 1 y 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reserva: reservaId, puntuacion, comentario, aspectos } = req.body;

    // Verificar que la reserva existe y está completada
    const reserva = await Reserva.findById(reservaId);
    if (!reserva) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (reserva.estado !== 'completada') {
      return res.status(400).json({ message: 'Solo se pueden reseñar trabajos completados' });
    }

    if (reserva.cliente.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Verificar que no existe ya una review
    const existingReview = await Review.findOne({ reserva: reservaId });
    if (existingReview) {
      return res.status(400).json({ message: 'Ya has reseñado este trabajo' });
    }

    const review = new Review({
      reserva: reservaId,
      cliente: req.user.id,
      profesional: reserva.profesional,
      puntuacion,
      comentario,
      aspectos
    });

    await review.save();

    // Actualizar rating del profesional
    await updateProfesionalRating(reserva.profesional);

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/reviews/oficio/:id
// @desc    Obtener reviews de un oficio
// @access  Public
router.get('/oficio/:id', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ profesional: req.params.id })
      .populate('cliente', 'nombre avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ profesional: req.params.id });

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Función auxiliar para actualizar rating
async function updateProfesionalRating(profesionalId) {
  const reviews = await Review.find({ profesional: profesionalId });
  
  if (reviews.length === 0) return;

  const totalPuntuacion = reviews.reduce((sum, review) => sum + review.puntuacion, 0);
  const rating = totalPuntuacion / reviews.length;

  await Profesional.findByIdAndUpdate(profesionalId, {
    rating: Math.round(rating * 10) / 10, // Redondear a 1 decimal
    totalReviews: reviews.length
  });
}

module.exports = router;