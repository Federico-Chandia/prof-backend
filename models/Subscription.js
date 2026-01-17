const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  plan: {
    type: String,
    enum: ['gratuito', 'profesional', 'premium'],
    default: 'gratuito'
  },
  estado: {
    type: String,
    enum: ['activa', 'cancelada', 'vencida', 'suspendida'],
    default: 'activa'
  },
  fechaInicio: { type: Date, default: Date.now },
  fechaVencimiento: Date,
  precio: { type: Number, default: 0 },
  creditos: {
    disponibles: { type: Number, default: 3 },
    usados: { type: Number, default: 0 },
    comprados: { type: Number, default: 0 }
  },
  beneficios: {
    verificado: { type: Boolean, default: false },
    prioridad: { type: Number, default: 0 },
    estadisticas: { type: Boolean, default: false },
    soportePrioritario: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);