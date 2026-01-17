const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  suscripcion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  monto: { type: Number, required: true },
  moneda: { type: String, default: 'ARS' },
  metodoPago: {
    type: String,
    enum: ['mercadopago', 'tarjeta', 'transferencia'],
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado', 'cancelado', 'reembolsado'],
    default: 'pendiente'
  },
  mercadoPago: {
    paymentId: String,
    preferenceId: String,
    status: String,
    statusDetail: String
  },
  fechaPago: Date,
  fechaVencimiento: Date,
  descripcion: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);