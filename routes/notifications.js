const express = require('express');
const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllUserNotifications
} = require('../services/notificationsService');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Obtener notificaciones del usuario actual
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;
    
    const result = await getUserNotifications(req.user.id, {
      limit: Math.min(parseInt(limit), 100),
      skip: parseInt(skip),
      unreadOnly: unreadOnly === 'true'
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/notifications
// @desc    Crear una notificación
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { notification } = req.body;
    
    if (!notification || !notification.titulo || !notification.mensaje) {
      return res.status(400).json({ message: 'Datos de notificación incompletos' });
    }

    const newNotification = new Notification({
      usuario: req.user.id,
      tipo: notification.tipo || 'otro',
      titulo: notification.titulo,
      mensaje: notification.mensaje,
      url: notification.url || null,
      icono: notification.icon || notification.icono || null,
      referencia: notification.referencia || {},
      etiqueta: notification.etiqueta || null
    });

    await newNotification.save();

    res.status(201).json({
      success: true,
      notification: newNotification
    });
  } catch (error) {
    console.error('Error creando notificación:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   PATCH /api/notifications/read-all
// @desc    Marcar todas las notificaciones como leídas
// @access  Private
router.patch('/read-all', auth, async (req, res) => {
  try {
    const result = await markAllAsRead(req.user.id);
    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas',
      result
    });
  } catch (error) {
    console.error('Error marcando notificaciones como leídas:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Marcar notificación como leída
// @access  Private
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notification = await markAsRead(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Eliminar una notificación
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await deleteNotification(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   DELETE /api/notifications
// @desc    Eliminar todas las notificaciones del usuario
// @access  Private
router.delete('/', auth, async (req, res) => {
  try {
    const result = await deleteAllUserNotifications(req.user.id);
    res.json({
      success: true,
      message: 'Todas las notificaciones eliminadas',
      result
    });
  } catch (error) {
    console.error('Error eliminando notificaciones:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
