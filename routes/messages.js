const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Reserva = require('../models/Reserva');
const User = require('../models/User');
const Profesional = require('../models/Profesional');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/messages/:reservaId
// @desc    Obtener mensajes de una reserva
// @access  Private
router.get('/:reservaId', auth, async (req, res) => {
  try {
    const { reservaId } = req.params;
    
    // Verificar que el usuario tenga acceso a esta reserva
    const reserva = await Reserva.findById(reservaId)
      .populate('cliente', '_id')
      .populate({
        path: 'profesional',
        populate: { path: 'usuario', select: '_id' }
      });

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    // Verificación simplificada
    const userId = req.user.id;
    const esCliente = reserva.cliente && reserva.cliente._id.toString() === userId;
    const esProfesional = reserva.profesional && 
                         reserva.profesional.usuario && 
                         reserva.profesional.usuario._id.toString() === userId;

    if (!esCliente && !esProfesional) {
      return res.status(403).json({ success: false, message: 'No autorizado para esta reserva' });
    }

    const messages = await Message.find({ reserva: reservaId })
      .populate('emisor', 'nombre')
      .populate('receptor', 'nombre')
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, messages: messages || [] });
  } catch (error) {
    console.error('Error en GET /messages/:reservaId:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// @route   POST /api/messages
// @desc    Enviar mensaje
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { reserva: reservaId, receptor, mensaje } = req.body;
    
    if (!reservaId || !receptor || !mensaje?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos requeridos: reserva, receptor y mensaje'
      });
    }

    // Verificar que el usuario tenga acceso a esta reserva
    const reserva = await Reserva.findById(reservaId)
      .populate('cliente', '_id')
      .populate({
        path: 'profesional',
        populate: { path: 'usuario', select: '_id' }
      });

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    // Verificación simplificada
    const userId = req.user.id;
    const esCliente = reserva.cliente && reserva.cliente._id.toString() === userId;
    const esProfesional = reserva.profesional && 
                         reserva.profesional.usuario && 
                         reserva.profesional.usuario._id.toString() === userId;

    if (!esCliente && !esProfesional) {
      return res.status(403).json({ success: false, message: 'No autorizado para esta reserva' });
    }

    // Crear y guardar mensaje
    const newMessage = new Message({
      reserva: reservaId,
      emisor: userId,
      receptor,
      mensaje: mensaje.trim()
    });

    const savedMessage = await newMessage.save();
    
    // Poblar datos para respuesta
    await savedMessage.populate('emisor', 'nombre');
    await savedMessage.populate('receptor', 'nombre');

    // Si el emisor es el profesional (responde), actualizar métricas de respuesta
    if (esProfesional) {
      try {
        // Buscar el último mensaje del cliente en esta reserva (antes de esta respuesta)
        const lastClientMessage = await Message.findOne({
          reserva: reservaId,
          emisor: { $ne: userId }
        }).sort({ createdAt: -1 });

        if (lastClientMessage && lastClientMessage.createdAt && savedMessage.createdAt) {
          const diffMs = savedMessage.createdAt - lastClientMessage.createdAt;
          const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

          const profesionalDoc = await Profesional.findById(reserva.profesional._id);
          if (profesionalDoc) {
            const prevAvg = profesionalDoc.respuestaPromedioMinutos || null;
            const prevCount = profesionalDoc.respuestasContadas || 0;
            const newCount = prevCount + 1;
            const newAvg = prevAvg ? Math.round(((prevAvg * prevCount) + diffMinutes) / newCount) : diffMinutes;
            profesionalDoc.respuestaPromedioMinutos = newAvg;
            profesionalDoc.respuestasContadas = newCount;
            profesionalDoc.fastResponder = newAvg <= 30; // umbral: <= 30 minutos
            await profesionalDoc.save();
          }
        }
      } catch (err) {
        console.error('Error actualizando métricas de respuesta:', err);
      }
    }

    res.status(201).json({ success: true, message: savedMessage });
  } catch (error) {
    console.error('Error in POST /messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor'
    });
  }
});

module.exports = router;