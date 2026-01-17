const mongoose = require('mongoose');

const favoritoSchema = new mongoose.Schema({
  cliente: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  oficio: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Oficio', 
    required: true 
  }
}, {
  timestamps: true
});

// Índice único para evitar duplicados
favoritoSchema.index({ cliente: 1, oficio: 1 }, { unique: true }, (err) => {
  if (err) console.error('Error creando índice:', err.message);
});

// Manejo de errores para duplicados
favoritoSchema.post('save', function(error, doc, next) {
  if (error && error.code === 11000) {
    next(new Error('Este favorito ya existe'));
  } else if (error) {
    next(error);
  } else {
    next();
  }
});

module.exports = mongoose.model('Favorito', favoritoSchema);