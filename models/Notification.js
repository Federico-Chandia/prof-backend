const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tipo: {
    type: String,
    enum: ['mensaje', 'reserva', 'solicitud', 'orden', 'pago', 'reserva_aceptada', 'reserva_rechazada', 'otro'],
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  mensaje: {
    type: String,
    required: true
  },
  leida: {
    type: Boolean,
    default: false
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  // Datos relacionados para contextualizar la notificación
  referencia: {
    reservaId: mongoose.Schema.Types.ObjectId,
    solicitudId: mongoose.Schema.Types.ObjectId,
    mensajeId: mongoose.Schema.Types.ObjectId,
    pagoId: mongoose.Schema.Types.ObjectId
  },
  // URL a la que navegar al hacer click
  url: String,
  // Icono/imagen
  icono: String,
  // Para agrupar notificaciones similares
  etiqueta: String
}, {
  timestamps: true,
  indexes: [
    { usuario: 1, leida: 1 },
    { usuario: 1, createdAt: -1 },
    { usuario: 1, fecha: -1 }
  ]
});

// Limpiar notificaciones antiguas (más de 30 días)
notificationSchema.index({ fecha: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);
