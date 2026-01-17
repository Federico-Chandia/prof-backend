const express = require('express');
const User = require('../models/User');
const Profesional = require('../models/Profesional');
const Reserva = require('../models/Reserva');
const Review = require('../models/Review');
const { auth, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// @route   GET /api/admin/stats
// @desc    Obtener estadísticas del dashboard
// @access  Private (Admin)
router.get('/stats', [auth, authorize('admin')], async (req, res) => {
  try {
    const totalUsuarios = await User.countDocuments();
    const totalProfesionales = await Profesional.countDocuments();
    const totalReservas = await Reserva.countDocuments();
    const reservasCompletadas = await Reserva.countDocuments({ estado: 'completada' });
    
    // Total de transacciones efectuadas (importes reales)
    const totalTransacciones = await Reserva.aggregate([
      { $match: { estado: 'completada', 'costos.importeReal': { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$costos.importeReal' } } }
    ]);

    // Valor promedio por transacción
    const promedioTransaccion = await Reserva.aggregate([
      { $match: { estado: 'completada', 'costos.importeReal': { $exists: true } } },
      { $group: { _id: null, promedio: { $avg: '$costos.importeReal' } } }
    ]);

    // Profesionales más demandados
    const profesionalesDemandados = await Reserva.aggregate([
      { $match: { estado: { $in: ['completada', 'confirmada'] } } },
      { $lookup: { from: 'profesionals', localField: 'profesional', foreignField: '_id', as: 'profesionalData' } },
      { $unwind: '$profesionalData' },
      { $group: { _id: '$profesionalData.profesion', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsuarios,
        totalProfesionales,
        totalReservas,
        reservasCompletadas,
        totalTransacciones: totalTransacciones[0]?.total || 0,
        promedioTransaccion: Math.round(promedioTransaccion[0]?.promedio || 0),
        profesionalesDemandados
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/admin/users
// @desc    Obtener lista de usuarios
// @access  Private (Admin)
router.get('/users', [auth, authorize('admin')], async (req, res) => {
  try {
    const { page = 1, limit = 20, rol } = req.query;
    
    const filters = {};
    if (rol) filters.rol = rol;

    const users = await User.find(filters)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filters);

    res.json({
      success: true,
      users,
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

// Rutas de gestión de usuarios
router.delete('/users/:userId', [auth, authorize('admin')], adminController.deleteUser);
router.patch('/users/:userId/toggle-status', [auth, authorize('admin')], adminController.toggleUserStatus);
router.patch('/users/:userId/role', [auth, authorize('admin')], adminController.changeUserRole);
router.get('/users/:userId/details', [auth, authorize('admin')], adminController.getUserDetails);
router.get('/users/search', [auth, authorize('admin')], adminController.searchUsers);

// Backfill fast-responder metrics (admin only)
router.post('/fast-responder/backfill', [auth, authorize('admin')], adminController.backfillFastResponder);

module.exports = router;