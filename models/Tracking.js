const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  reserva: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reserva', 
    required: true,
    unique: true
  },
  tecnico: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  ubicacionActual: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  estado: {
    type: String,
    enum: ['en_camino', 'en_ubicacion', 'trabajando', 'finalizado'],
    default: 'en_camino'
  },
  tiempoEstimadoLlegada: Number, // minutos
  ultimaActualizacion: { type: Date, default: Date.now }
}, {
  timestamps: true
});

trackingSchema.index({ reserva: 1 });
trackingSchema.index({ tecnico: 1 });

module.exports = mongoose.model('Tracking', trackingSchema);