const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tipo: {
    type: String,
    enum: ['consumo', 'recarga', 'regalo', 'reembolso', 'ajuste'],
    required: true
  },
  cantidad: {
    type: Number,
    required: true
  },
  saldoAnterior: {
    type: Number,
    required: true
  },
  saldoNuevo: {
    type: Number,
    required: true
  },
  descripcion: String,
  razon: {
    type: String,
    enum: [
      'acepto_reserva',
      'compra_plan',
      'bonus_bienvenida',
      'reembolso_cancelacion',
      'ajuste_administrativo',
      'error_correccion',
      'referido'
    ]
  },
  // Referencia a transacción relacionada
  reservaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reserva'
  },
  pagoPago: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  suscripcionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  estado: {
    type: String,
    enum: ['pendiente', 'completado', 'revertido', 'cancelado'],
    default: 'completado'
  },
  // Información de quien realizó la transacción
  realizadoPor: {
    tipo: String, // 'sistema', 'usuario', 'admin'
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Metadata adicional
  metadata: {
    ip: String,
    userAgent: String,
    referencia: String
  },
  // Auditoría
  revertidoEn: Date,
  motivoReversion: String,
  revertidoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  index: { createdAt: -1 }
});

// Índices para queries frecuentes
creditTransactionSchema.index({ usuario: 1, createdAt: -1 });
creditTransactionSchema.index({ tipo: 1 });
creditTransactionSchema.index({ estado: 1 });
creditTransactionSchema.index({ reservaId: 1 });

// Virtual: calcular cambio neto
creditTransactionSchema.virtual('cambioNeto').get(function() {
  return this.saldoNuevo - this.saldoAnterior;
});

// Método para revertir una transacción
creditTransactionSchema.methods.revertir = async function(adminId, motivo) {
  this.estado = 'revertido';
  this.revertidoEn = new Date();
  this.motivoReversion = motivo;
  this.revertidoPor = adminId;
  return this.save();
};

// Método estático para crear transacción
creditTransactionSchema.statics.registrar = async function(usuarioId, tipo, cantidad, descripcion, referencia = {}) {
  const usuario = await mongoose.model('User').findById(usuarioId);
  
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }

  const saldoAnterior = usuario.tokens?.disponibles || 0;
  const saldoNuevo = Math.max(0, saldoAnterior + cantidad);

  const transaccion = new this({
    usuario: usuarioId,
    tipo,
    cantidad,
    saldoAnterior,
    saldoNuevo,
    descripcion,
    ...referencia
  });

  await transaccion.save();
  
  // Actualizar saldo del usuario
  usuario.tokens = usuario.tokens || {};
  usuario.tokens.disponibles = saldoNuevo;
  
  if (!usuario.tokens.historial) {
    usuario.tokens.historial = [];
  }
  
  usuario.tokens.historial.push({
    fecha: new Date(),
    tipo,
    cantidad,
    descripcion,
    reservaId: referencia.reservaId
  });

  await usuario.save();
  
  return transaccion;
};

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
