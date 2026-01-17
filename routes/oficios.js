const express = require('express');
const { body, validationResult } = require('express-validator');
const Profesional = require('../models/Profesional');
const User = require('../models/User');
const Review = require('../models/Review');
const { auth, authorize } = require('../middleware/auth');
const { normalizarZona, filtrarPorZona } = require('../services/zonasService');

const router = express.Router();

// @route   GET /api/oficios
// @desc    Obtener oficios con filtros
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      tipoOficio, 
      barrio, 
      zona,
      disponible, 
      rating, 
      page = 1, 
      limit = 10 
    // amazonq-ignore-next-line
    } = req.query;

    // Construir filtros
    const filters = { activo: true };
    
    if (tipoOficio) filters.profesion = tipoOficio;
    if (disponible === 'true') filters['disponibilidad.inmediata'] = true;
    if (rating) filters.rating = { $gte: parseFloat(rating) };

    let profesionales = await Profesional.find(filters)
      .populate('usuario', 'nombre avatar telefono')
      .sort({ rating: -1, trabajosCompletados: -1 });

    // Filtrar por zona si se proporciona
    if (zona) {
      const zonaNormalizada = normalizarZona(zona);
      profesionales = filtrarPorZona(profesionales, zonaNormalizada);
    } else if (barrio) {
      // Legacy: mantener compatibilidad con barrio
      profesionales = profesionales.filter(p => 
        p.zonasTrabajo && p.zonasTrabajo.some(z => z.toLowerCase() === barrio.toLowerCase())
      );
    }

    // Paginar
    const total = profesionales.length;
    const paginatedProfesionales = profesionales.slice(
      (page - 1) * limit,
      page * limit
    );

    // Obtener últimas reseñas para cada profesional
    const oficios = await Promise.all(paginatedProfesionales.map(async (prof) => {
      const ultimasReviews = await Review.find({ profesional: prof._id })
        .populate('cliente', 'nombre')
        .select('_id cliente puntuacion comentario createdAt')
        .sort({ createdAt: -1 })
        .limit(3);
      
      return {
        ...prof.toObject(),
        tipoOficio: prof.profesion,
        ultimasReviews
      };
    }));

    res.json({
      success: true,
      oficios,
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

// @route   GET /api/oficios/mi-perfil
// @desc    Obtener perfil del usuario autenticado
// @access  Private
router.get('/mi-perfil', auth, async (req, res) => {
  try {
    const profesional = await Profesional.findOne({ usuario: req.user.id })
      .populate('usuario', 'nombre avatar telefono email direccion');

    if (!profesional) {
      return res.status(404).json({ message: 'Perfil de profesional no encontrado' });
    }

    // Obtener últimas reseñas
    const ultimasReviews = await Review.find({ profesional: profesional._id })
      .populate('cliente', 'nombre')
      .select('_id cliente puntuacion comentario createdAt')
      .sort({ createdAt: -1 })
      .limit(3);

    // Mapear profesion a tipoOficio para compatibilidad con frontend
    const oficioData = {
      ...profesional.toObject(),
      tipoOficio: profesional.profesion,
      ultimasReviews
    };

    res.json({ success: true, oficio: oficioData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/oficios/:id
// @desc    Obtener oficio por ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    // amazonq-ignore-next-line
    const profesional = await Profesional.findById(req.params.id)
      .populate('usuario', 'nombre avatar telefono email direccion');

    if (!profesional) {
      return res.status(404).json({ message: 'Profesional no encontrado' });
    }

    // Obtener últimas reseñas
    const ultimasReviews = await Review.find({ profesional: profesional._id })
      .populate('cliente', 'nombre')
      .select('_id cliente puntuacion comentario createdAt')
      .sort({ createdAt: -1 })
      .limit(3);

    // Mapear profesional a oficio para compatibilidad con frontend
    const oficioData = {
      ...profesional.toObject(),
      tipoOficio: profesional.profesion,
      ultimasReviews
    };

    res.json({ success: true, oficio: oficioData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   GET /api/oficios/:id/calendar/next
// @desc    Obtener el próximo evento del calendario del profesional
// @access  Private
router.get('/:id/calendar/next', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reservaId } = req.query;

    // Buscar el profesional
    const profesional = await Profesional.findById(id);
    if (!profesional) {
      return res.status(404).json({ message: 'Profesional no encontrado' });
    }

    // Por ahora: devolver null (no hay integración con Google Calendar aún)
    // En el futuro: aquí iría la lógica para consultar Google Calendar API
    // si el profesional tiene credenciales conectadas
    
    // Placeholder: si hay reservaId, podrías devolver un evento simulado
    if (reservaId) {
      // Buscar la reserva para obtener su fecha
      const Reserva = require('../models/Reserva');
      const reserva = await Reserva.findById(reservaId);
      
      if (reserva) {
        // Usar fechaHora si existe, si no usar createdAt (momento de creación de la reserva)
        const startDate = reserva.fechaHora || reserva.createdAt || new Date();
        return res.json({
          success: true,
          event: {
            start: new Date(startDate).toISOString(),
            summary: `Trabajo: ${reserva.descripcionTrabajo || 'Sin descripción'}`,
            location: reserva.direccion ? `${reserva.direccion.calle}, ${reserva.direccion.barrio}` : ''
          }
        });
      }
    }

    // Si no hay evento disponible
    res.json({
      success: true,
      event: null
    });
  } catch (error) {
    console.error('Error obteniendo evento del calendario:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   POST /api/oficios
// @desc    Crear perfil de oficio
// @access  Private
// amazonq-ignore-next-line
router.post('/', [
  auth,
  body('tipoOficio').notEmpty().withMessage('Tipo de oficio requerido'),
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

    // Guardar evento analytics: proSigned
    try {
      const AnalyticsEvent = require('../models/AnalyticsEvent');
      await AnalyticsEvent.create({ event: 'proSigned', user: req.user.id, properties: { tipoOficio: profesionalData.tipoOficio } });
    } catch (err) {
      console.error('Error logging analytics proSigned:', err);
    }

    // Separar datos del usuario y del profesional
    const { nombreCompleto, telefono, fotoPerfil, ...profesionalData } = req.body;
    
    // Actualizar usuario (incluyendo rol)
    const userUpdate = { rol: 'profesional' };
    if (nombreCompleto) userUpdate.nombre = nombreCompleto;
    if (telefono) userUpdate.telefono = telefono;
    if (fotoPerfil) userUpdate.avatar = fotoPerfil;
    
    await User.findByIdAndUpdate(req.user.id, userUpdate);

    // Mapear tipoOficio a profesion para el modelo
    const { tipoOficio, ...restData } = profesionalData;
    const profesional = new Profesional({
      usuario: req.user.id,
      profesion: tipoOficio,
      categoria: 'servicios-hogar', // Categoría por defecto
      ...restData
    });

    await profesional.save();
    await profesional.populate('usuario', 'nombre avatar telefono');

    res.status(201).json({ success: true, profesional });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   PUT /api/oficios/:id
// @desc    Actualizar oficio
// @access  Private (solo el dueño del oficio)
// amazonq-ignore-next-line
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
    // amazonq-ignore-next-line
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
        // Mapear tipoOficio a profesion
        if (key === 'tipoOficio') {
          updateFields.profesion = profesionalData[key];
        } else {
          updateFields[key] = profesionalData[key];
        }
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

// @route   GET /api/oficios/buscar
// @desc    Buscar profesionales por ubicación
// @access  Public
router.get('/buscar', async (req, res) => {
  try {
    const { tipoOficio, lat, lng, radio = 15, incluirTraslado = false } = req.query;
    
    if (!tipoOficio || !lat || !lng) {
      return res.status(400).json({ 
        message: 'Tipo de oficio, latitud y longitud son requeridos' 
      });
    }

    const radioKm = parseFloat(radio);
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Construir filtros base
    const filters = { 
      activo: true,
      profesion: tipoOficio
    };

    // Buscar profesionales
    const profesionales = await Profesional.find(filters)
      .populate('usuario', 'nombre avatar telefono')
      .sort({ rating: -1, trabajosCompletados: -1 });

    // Calcular distancias y filtrar por radio
    const profesionalesConDistancia = await Promise.all(
      profesionales
        .map(async prof => {
          // Simular coordenadas basadas en zonas de trabajo (en producción usar coordenadas reales)
          const profLat = latitude + (Math.random() - 0.5) * 0.1;
          const profLng = longitude + (Math.random() - 0.5) * 0.1;
          
          const distancia = calcularDistancia(latitude, longitude, profLat, profLng);
          
          // Obtener últimas reseñas
          const ultimasReviews = await Review.find({ profesional: prof._id })
            .populate('cliente', 'nombre')
            .select('_id cliente puntuacion comentario createdAt')
            .sort({ createdAt: -1 })
            .limit(3);
          
          return {
            ...prof.toObject(),
            tipoOficio: prof.profesion,
            distancia,
            cargoTraslado: incluirTraslado === 'true' ? calcularCargoTraslado(distancia) : 0,
            ultimasReviews
          };
        })
    );
    
    const profesionalesFiltrados = profesionalesConDistancia
      .filter(prof => prof.distancia <= radioKm)
      .sort((a, b) => a.distancia - b.distancia);

    res.json({
      success: true,
      oficios: profesionalesFiltrados,
      busquedaExtendida: incluirTraslado === 'true',
      radioUtilizado: radioKm
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Función auxiliar para calcular distancia entre dos puntos
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Función auxiliar para calcular cargo por traslado
function calcularCargoTraslado(distancia) {
  const kmGratuitos = 10;
  const costoPorKm = 50;
  
  if (distancia <= kmGratuitos) return 0;
  return Math.round((distancia - kmGratuitos) * costoPorKm);
}

// @route   PUT /api/oficios/:id/disponibilidad
// @desc    Actualizar disponibilidad inmediata
// @access  Private (solo el dueño del oficio)
// amazonq-ignore-next-line
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

// @route   GET /api/oficios/barrios/disponibles
// @desc    Obtener todos los barrios disponibles donde trabajan profesionales
// @access  Public
router.get('/barrios/disponibles', async (req, res) => {
  try {
    // Obtener todos los profesionales activos y extraer sus zonas de trabajo
    const profesionales = await Profesional.find({ activo: true }).select('zonasTrabajo');
    
    // Recolectar todos los barrios únicos
    const barrios = new Set();
    
    profesionales.forEach(prof => {
      if (prof.zonasTrabajo && Array.isArray(prof.zonasTrabajo)) {
        prof.zonasTrabajo.forEach(zona => {
          if (zona) barrios.add(zona);
        });
      }
    });

    // Convertir set a array y ordenar alfabéticamente
    const barriosArray = Array.from(barrios).sort();

    res.json({
      success: true,
      barrios: barriosArray,
      total: barriosArray.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;