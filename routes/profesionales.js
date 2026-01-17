const express = require('express');
const { body, validationResult } = require('express-validator');
const Profesional = require('../models/Profesional');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/profesionales
// @desc    Obtener profesionales con filtros
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      especialidad, 
      barrio, 
      disponible, 
      rating, 
      page = 1, 
      limit = 10 
    } = req.query;

    // Construir filtros
    const filters = { activo: true };
    
    if (especialidad) filters.especialidad = especialidad;
    if (barrio) filters.zonasTrabajo = { $in: [barrio] };
    if (disponible === 'true') filters['disponibilidad.inmediata'] = true;
    if (rating) filters.rating = { $gte: parseFloat(rating) };

    const profesionales = await Profesional.find(filters)
      .populate('usuario', 'nombre avatar telefono')
      .sort({ rating: -1, trabajosCompletados: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Profesional.countDocuments(filters);

    res.json({
      success: true,
      profesionales,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/profesionales/mi-perfil
// @desc    Obtener perfil del usuario autenticado
// @access  Private
router.get('/mi-perfil', auth, async (req, res) => {
  try {
    const profesional = await Profesional.findOne({ usuario: req.user.id })
      .populate('usuario', 'nombre avatar telefono email direccion');

    if (!profesional) {
      return res.status(404).json({ message: 'Perfil de profesional no encontrado' });
    }

    res.json({ success: true, profesional });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/profesionales/:id
// @desc    Obtener profesional por ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const profesional = await Profesional.findById(req.params.id)
      .populate('usuario', 'nombre avatar telefono email direccion');

    if (!profesional) {
      return res.status(404).json({ message: 'Profesional no encontrado' });
    }

    res.json({ success: true, profesional });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/profesionales
// @desc    Crear perfil de profesional
// @access  Private
router.post('/', [
  auth,
  body('especialidad').notEmpty().withMessage('Especialidad requerida'),
  body('descripcion').notEmpty().withMessage('Descripción requerida'),
  body('tarifas.porHora').isNumeric().withMessage('Tarifa por hora requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Datos inválidos', 
        errors: errors.array() 
      });
    }

    // Verificar si ya tiene un perfil de profesional
    const existingProfesional = await Profesional.findOne({ usuario: req.user.id });
    if (existingProfesional) {
      return res.status(400).json({ message: 'Ya tienes un perfil de profesional' });
    }

    // Separar datos del usuario y del profesional
    const { nombreCompleto, telefono, fotoPerfil, ...profesionalData } = req.body;
    
    // Actualizar usuario (incluyendo rol)
    const userUpdate = { rol: 'profesional' };
    if (nombreCompleto) userUpdate.nombre = nombreCompleto;
    if (telefono) userUpdate.telefono = telefono;
    if (fotoPerfil) userUpdate.avatar = fotoPerfil;
    
    await User.findByIdAndUpdate(req.user.id, userUpdate);

    // Obtener datos del usuario para usar su dirección
    const usuario = await User.findById(req.user.id);
    
    const profesional = new Profesional({
      usuario: req.user.id,
      ...profesionalData,
      // Usar dirección del usuario si no se especifica una ubicación
      ubicacion: profesionalData.ubicacion || (usuario.direccion ? {
        direccion: `${usuario.direccion.calle}, ${usuario.direccion.barrio}, ${usuario.direccion.ciudad}, ${usuario.direccion.provincia}`,
        coordenadas: null // Se geocodificará después
      } : undefined)
    });

    await profesional.save();
    
    // Geocodificar dirección si existe
    if (profesional.ubicacion && profesional.ubicacion.direccion && !profesional.ubicacion.coordenadas) {
      const locationService = require('../services/locationService');
      const coordenadas = await locationService.geocodeAddress(profesional.ubicacion.direccion);
      if (coordenadas) {
        profesional.ubicacion.coordenadas = {
          lat: coordenadas.lat,
          lng: coordenadas.lng
        };
        await profesional.save();
      }
    }
    
    await profesional.populate('usuario', 'nombre avatar telefono');

    res.status(201).json({ success: true, profesional });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   PUT /api/profesionales/:id
// @desc    Actualizar profesional
// @access  Private (solo el dueño del profesional)
router.put('/:id', auth, async (req, res) => {
  try {
    const profesional = await Profesional.findById(req.params.id);

    if (!profesional) {
      return res.status(404).json({ message: 'Profesional no encontrado' });
    }

    // Verificar que sea el dueño
    if (profesional.usuario.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Separar datos del usuario y del profesional
    const { nombreCompleto, telefono, fotoPerfil, ...profesionalData } = req.body;
    
    // Actualizar usuario si hay datos
    if (nombreCompleto || telefono || fotoPerfil) {
      const userUpdate = {};
      if (nombreCompleto) userUpdate.nombre = nombreCompleto;
      if (telefono) userUpdate.telefono = telefono;
      if (fotoPerfil) userUpdate.avatar = fotoPerfil;
      
      await User.findByIdAndUpdate(req.user.id, userUpdate);
    }

    // Actualizar profesional (solo campos enviados)
    const updateFields = {};
    Object.keys(profesionalData).forEach(key => {
      if (profesionalData[key] !== undefined && profesionalData[key] !== null && profesionalData[key] !== '') {
        updateFields[key] = profesionalData[key];
      }
    });

    const updatedProfesional = await Profesional.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('usuario', 'nombre avatar telefono');

    res.json({ success: true, profesional: updatedProfesional });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   PUT /api/profesionales/:id/disponibilidad
// @desc    Actualizar disponibilidad inmediata
// @access  Private (solo el dueño del profesional)
router.put('/:id/disponibilidad', auth, async (req, res) => {
  try {
    const { disponible } = req.body;
    
    const profesional = await Profesional.findById(req.params.id);
    if (!profesional) {
      return res.status(404).json({ message: 'Profesional no encontrado' });
    }

    if (profesional.usuario.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    profesional.disponibilidad.inmediata = disponible;
    profesional.enLinea = disponible;
    await profesional.save();

    // Emitir evento de Socket.io
    const { io } = require('../server');
    if (disponible) {
      io.emit('profesionalDisponible', profesional._id);
    } else {
      io.emit('profesionalNoDisponible', profesional._id);
    }

    res.json({ success: true, disponible });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;