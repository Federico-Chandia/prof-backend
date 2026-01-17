const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  reserva: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reserva', 
    required: true 
  },
  emisor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receptor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  mensaje: { type: String, required: true },
  tipo: { 
    type: String, 
    enum: ['texto', 'imagen', 'ubicacion', 'sistema'], 
    default: 'texto' 
  },
  leido: { type: Boolean, default: false },
  fechaLectura: Date
}, {
  timestamps: true
});

messageSchema.index({ reserva: 1, createdAt: 1 });
messageSchema.index({ receptor: 1, leido: 1 });

module.exports = mongoose.model('Message', messageSchema);