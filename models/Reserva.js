const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema({
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
  fechaHora: { type: Date, required: false },
  duracionEstimada: { type: Number, default: 1 }, // horas
  tipoServicio: {
    type: String,
    enum: ['porHora', 'visitaTecnica', 'emergencia'],
    default: 'porHora'
  },
  descripcionTrabajo: { type: String, required: true },
  direccion: {
    calle: { type: String, required: true },
    barrio: { type: String, required: true },
    coordenadas: {
      lat: Number,
      lng: Number
    }
  },
  numeroOrden: {
    type: String,
    unique: true,
    default: function() {
      return 'OS-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    }
  },
  estado: {
    type: String,
    enum: ['pago_pendiente', 'pago_confirmado', 'orden_generada', 'en_progreso', 'pendiente_confirmacion', 'completada', 'cancelada'],
    default: 'pago_pendiente'
  },
  confirmacion: {
    profesionalCompleto: { type: Boolean, default: false },
    clienteAprobado: { type: Boolean, default: false },
    fechaCompletadoProfesional: Date,
    fechaAprobadoCliente: Date,
    timeoutAutoConfirmacion: Date
  },
  costos: {
    subtotal: { type: Number, required: true },
    cargoTraslado: { type: Number, default: 0 },
    distancia: { type: Number, default: 0 },
    total: { type: Number, required: true },
    importeReal: { type: Number } // Importe real cobrado al cliente
  },
  pago: {
    estado: { 
      type: String, 
      enum: ['pendiente', 'procesando', 'confirmado', 'retenido', 'liberado', 'reembolsado'], 
      default: 'pendiente' 
    },
    metodoPago: String,
    mercadoPagoId: String,
    transactionId: String,
    fechaPago: Date,
    fechaLiberacion: Date,
    escrow: {
      retenido: { type: Boolean, default: false },
      montoRetenido: Number,
      fechaRetencion: Date
    }
  },
  notas: String,
  notasFinalizacion: String,
  canceladoPor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  motivoCancelacion: String,
  solicitudCorreccion: {
    activa: { type: Boolean, default: false },
    descripcion: String,
    fechaSolicitud: Date
  }
}, {
  timestamps: true
});

// Middleware para generar número de orden
reservaSchema.pre('save', function(next) {
  if (this.isNew && !this.numeroOrden) {
    this.numeroOrden = 'OS-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

// Índices
reservaSchema.index({ cliente: 1, fechaHora: -1 });
reservaSchema.index({ profesional: 1, fechaHora: -1 });
reservaSchema.index({ estado: 1 });
reservaSchema.index({ numeroOrden: 1 }, { unique: true });

module.exports = mongoose.model('Reserva', reservaSchema);