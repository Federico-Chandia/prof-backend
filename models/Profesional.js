const mongoose = require('mongoose');

const profesionalSchema = new mongoose.Schema({
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  categoria: {
    type: String,
    required: true,
    enum: ['servicios-hogar', 'construccion', 'tecnologia', 'profesionales', 'salud-bienestar', 'educacion', 'eventos', 'transporte', 'otro']
  },
  profesion: {
    type: String,
    required: true,
    enum: ['plomero', 'electricista', 'gasista', 'pintor', 'carpintero', 'albañil', 'jardinero', 'cerrajero', 'aire-acondicionado', 'otro']
  },
  profesionPersonalizada: {
    type: String
  },
  estadoRevision: {
    type: String,
    enum: ['aprobada', 'pendiente', 'rechazada'],
    default: 'aprobada'
  },
  descripcion: { type: String, required: true },
  experiencia: { type: Number, default: 0 }, // años
  matricula: String, // Matrícula profesional
  seguroResponsabilidad: { type: Boolean, default: false },
  whatsappLaboral: String, // WhatsApp de trabajo
  tarifas: {
    porHora: { type: Number, required: true },
    visitaTecnica: { type: Number, default: 0 },
    emergencia: { type: Number, default: 0 },
    desplazamiento: { type: Number, default: 0 }, // por km
    kmGratuitos: { type: Number, default: 5 } // km sin cargo
  },
  radioCobertura: { type: Number, default: 20 }, // km máximos de cobertura
  ubicacion: {
    direccion: String,
    coordenadas: {
      lat: Number,
      lng: Number
    }
  },
  disponibilidad: {
    inmediata: { type: Boolean, default: false },
    horarios: [{
      dia: { type: String, enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] },
      inicio: String, // "09:00"
      fin: String     // "18:00"
    }]
  },
  disponibilidadHoraria: {
    lunes: { activo: { type: Boolean, default: true }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '18:00' } },
    martes: { activo: { type: Boolean, default: true }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '18:00' } },
    miercoles: { activo: { type: Boolean, default: true }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '18:00' } },
    jueves: { activo: { type: Boolean, default: true }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '18:00' } },
    viernes: { activo: { type: Boolean, default: true }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '18:00' } },
    sabado: { activo: { type: Boolean, default: true }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '15:00' } },
    domingo: { activo: { type: Boolean, default: false }, inicio: { type: String, default: '09:00' }, fin: { type: String, default: '18:00' } }
  },
  zonasTrabajo: [String], // barrios donde trabaja
  fotos: [String], // URLs de trabajos realizados
  certificaciones: [String],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  trabajosCompletados: { type: Number, default: 0 },
  verificado: { type: Boolean, default: false },
  activo: { type: Boolean, default: true },
  enLinea: { type: Boolean, default: false }, // para disponibilidad en tiempo real
  // Métricas de respuesta automática para badge "Responde rápido"
  respuestaPromedioMinutos: { type: Number, default: null },
  respuestasContadas: { type: Number, default: 0 },
  fastResponder: { type: Boolean, default: false },
  // Preferencia de género de clientes (opcional)
  preferenciaProfesional: {
    type: String,
    enum: ['sin_preferencia', 'solo_mujeres', 'solo_hombres'],
    default: 'sin_preferencia'
  }
}, {
  timestamps: true
});

// Índice para búsqueda por velocidad de respuesta
profesionalSchema.index({ fastResponder: -1 });

// Índices para búsquedas eficientes
profesionalSchema.index({ categoria: 1, profesion: 1, zonasTrabajo: 1 });
profesionalSchema.index({ rating: -1 });
profesionalSchema.index({ 'disponibilidad.inmediata': 1 });
profesionalSchema.index({ estadoRevision: 1 });

module.exports = mongoose.model('Profesional', profesionalSchema);