const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reserva: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reserva', 
    required: true,
    unique: true // Una review por reserva
  },
  cliente: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  profesional: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Profesional', 
    required: true 
  },
  puntuacion: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  comentario: { type: String, maxlength: 500 },
  aspectos: {
    puntualidad: { type: Number, min: 1, max: 5 },
    calidad: { type: Number, min: 1, max: 5 },
    precio: { type: Number, min: 1, max: 5 },
    comunicacion: { type: Number, min: 1, max: 5 }
  },
  fotos: [String], // URLs de fotos del trabajo terminado
  respuestaProfesional: String, // El profesional puede responder
  moderado: { type: Boolean, default: false },
  reportado: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Índices
reviewSchema.index({ profesional: 1, createdAt: -1 });
reviewSchema.index({ puntuacion: -1 });

module.exports = mongoose.model('Review', reviewSchema);