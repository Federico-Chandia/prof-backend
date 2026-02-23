const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telefono: { type: String },
  direccion: {
    calle: String,
    barrio: String,
    ciudad: { type: String, default: 'Buenos Aires' },
    provincia: { type: String, default: 'Buenos Aires' },
    coordenadas: {
      lat: Number,
      lng: Number
    }
  },
  rol: { 
    type: String, 
    enum: ['cliente', 'profesional', 'admin'], 
    default: 'cliente' 
  },
  avatar: String,
  verificado: { type: Boolean, default: false },
  activo: { type: Boolean, default: true },
  suscripcion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  verificacion: {
    nivel: {
      type: String,
      enum: ['ninguno', 'basico', 'profesional', 'premium'],
      default: 'ninguno'
    },
    matricula: String,
    documentos: [String],
    fechaVerificacion: Date
  },
  tokens: {
    disponibles: { type: Number, default: 0 },
    plan: {
      type: String,
      enum: ['basico', 'premium', 'profesional'],
      default: 'basico'
    },
    renovacion: Date,
    historial: [{
      fecha: { type: Date, default: Date.now },
      tipo: { type: String, enum: ['consumo', 'recarga', 'regalo'] },
      cantidad: Number,
      descripcion: String,
      reservaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reserva' }
    }]
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Email confirmation
  emailConfirmToken: String,
  emailConfirmExpires: Date,
  aceptacionLegal: {
    terminosCondiciones: {
      aceptado: { type: Boolean, default: false },
      fechaAceptacion: Date,
      version: String
    },
    politicaPrivacidad: {
      aceptado: { type: Boolean, default: false },
      fechaAceptacion: Date,
      version: String
    },
    politicaCookies: {
      aceptado: { type: Boolean, default: false },
      fechaAceptacion: Date,
      version: String
    }
  },
  // Preferencias de género (opcional)
  genero: {
    type: String,
    enum: ['masculino', 'femenino', 'otro', 'prefiero_no_decir'],
    default: 'prefiero_no_decir'
  },
  preferenciaCliente: {
    type: String,
    enum: ['sin_preferencia', 'solo_mujeres', 'solo_hombres'],
    default: 'sin_preferencia'
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);