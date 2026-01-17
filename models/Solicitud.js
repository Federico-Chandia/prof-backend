const mongoose = require('mongoose');

const solicitudSchema = new mongoose.Schema({
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
  descripcionTrabajo: { type: String, required: true },
  direccion: {
    calle: { type: String, required: true },
    barrio: { type: String, required: true },
    ciudad: { type: String, default: 'Buenos Aires' },
    coordenadas: {
      lat: Number,
      lng: Number
    }
  },
  distanciaAproximada: { type: Number }, // en km
  numeroSolicitud: {
    type: String,
    unique: true,
    default: function() {
      return 'SOL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    }
  },
  estado: {
    type: String,
    enum: ['pendiente', 'contactado', 'en_progreso', 'pendiente_confirmacion', 'completada', 'cancelada'],
    default: 'pendiente'
  },
  // Información visible según el estado:
  // pendiente: solo ciudad/radio ("a 12 km")
  // contactado: barrio opcional durante chat
  // en_progreso: barrio completo
  // pendiente_confirmacion/completada: dirección exacta
  informacionVisible: {
    ciudad: { type: String },
    barrio: { type: String },
    direccionCompleta: { type: Boolean, default: false },
    nivelRevelacion: {
      type: String,
      enum: ['ciudad', 'barrio', 'direccion_completa'],
      default: 'ciudad'
    }
  },
  confirmacion: {
    profesionalCompleto: { type: Boolean, default: false },
    clienteAprobado: { type: Boolean, default: false },
    fechaCompletadoProfesional: Date,
    fechaAprobadoCliente: Date,
    timeoutAutoConfirmacion: Date
  },
  fechaContacto: Date,
  fechaInicio: Date,
  respuestaProfesional: String,
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

// Middleware para generar número de solicitud
solicitudSchema.pre('save', function(next) {
  if (this.isNew && !this.numeroSolicitud) {
    this.numeroSolicitud = 'SOL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

// Índices
solicitudSchema.index({ cliente: 1, createdAt: -1 });
solicitudSchema.index({ profesional: 1, createdAt: -1 });
solicitudSchema.index({ estado: 1 });
solicitudSchema.index({ numeroSolicitud: 1 }, { unique: true });

module.exports = mongoose.model('Solicitud', solicitudSchema);