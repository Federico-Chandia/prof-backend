const Reserva = require('../models/Reserva');
const User = require('../models/User');
const Profesional = require('../models/Profesional');
const locationService = require('../services/locationService');
const { consumirToken } = require('../middleware/tokens');

class ReservasController {
  // Validar cobertura y calcular costos
  static async validarCobertura(req, res) {
    try {
      const { oficioId, direccion, tipoServicio, duracionEstimada } = req.body;

      const profesional = await Profesional.findById(oficioId);
      if (!profesional) {
        return res.status(404).json({ message: 'Profesional no encontrado' });
      }

      // Calcular costos básicos
      let subtotal = 0;
      switch (tipoServicio) {
        case 'visitaTecnica':
          subtotal = profesional.tarifas?.visitaTecnica || 1000;
          break;
        case 'emergencia':
          subtotal = profesional.tarifas?.emergencia || 2000;
          break;
        default:
          subtotal = (profesional.tarifas?.porHora || 500) * (duracionEstimada || 2);
      }

      const resultado = {
        cobertura: true,
        distancia: 0,
        cargoTraslado: 0,
        costos: {
          subtotal,
          cargoTraslado: 0,
          total: subtotal
        },
        mensaje: 'Área cubierta'
      };

      res.json(resultado);

    } catch (error) {
      console.error('Error en validarCobertura:', error);
      res.json({
        cobertura: true,
        distancia: 0,
        cargoTraslado: 0,
        costos: {
          subtotal: 1000,
          cargoTraslado: 0,
          total: 1000
        },
        mensaje: 'Cobertura disponible'
      });
    }
  }
  // Crear reserva con pago anticipado
  static async crearReserva(req, res) {
    try {
      const { oficioId, duracionEstimada, descripcionTrabajo, direccion, tipoServicio } = req.body;
      const clienteId = req.user.id;

      // Validar profesional
      const profesional = await Profesional.findById(oficioId);
      if (!profesional) {
        return res.status(404).json({ message: 'Profesional no encontrado' });
      }

      // Calcular costos
      let subtotal = 0;
      switch (tipoServicio) {
        case 'visitaTecnica':
          subtotal = profesional.tarifas?.visitaTecnica || 1000;
          break;
        case 'emergencia':
          subtotal = profesional.tarifas?.emergencia || 2000;
          break;
        default:
          subtotal = (profesional.tarifas?.porHora || 500) * (duracionEstimada || 2);
      }
      
      const total = subtotal;

      // Crear reserva
      const reserva = new Reserva({
        cliente: clienteId,
        profesional: oficioId,
        duracionEstimada: duracionEstimada || 2,
        descripcionTrabajo,
        direccion,
        costos: { 
          subtotal, 
          cargoTraslado: 0,
          distancia: 0,
          total 
        },
        pago: {
          estado: 'pendiente'
        },
        tipoServicio: tipoServicio || 'porHora',
        estado: 'orden_generada'
      });

      await reserva.save();

      // Emitir notificación en tiempo real al profesional
      try {
        const ProfesionalPop = await Profesional.findById(oficioId).populate('usuario');
        const profesionalUsuarioId = ProfesionalPop?.usuario?._id ? ProfesionalPop.usuario._id.toString() : null;
        if (profesionalUsuarioId) {
          const { io } = require('../server');
          io.to(`user:${profesionalUsuarioId}`).emit('notify', {
            title: 'Nueva reserva creada',
            body: `Nueva reserva de ${req.user.nombre || 'un cliente'} - ${descripcionTrabajo?.substring(0, 80) || ''}`,
            data: { tipo: 'reserva', id: reserva._id, url: `/mis-trabajos?reserva=${reserva._id}` },
            url: `/mis-trabajos?reserva=${reserva._id}`,
            icon: '/icons/reserva.png'
          });
        }
      } catch (err) {
        console.warn('Error emitiendo notificación de reserva:', err.message || err);
      }

      res.status(201).json({
        reserva: {
          id: reserva._id,
          numeroOrden: reserva.numeroOrden,
          estado: reserva.estado,
          total
        }
      });

    } catch (error) {
      console.error('Error en crearReserva:', error);
      res.status(500).json({ message: 'Error al crear reserva' });
    }
  }

  // Confirmar pago y activar escrow
  static async confirmarPago(req, res) {
    try {
      const { paymentId, status, external_reference } = req.body;

      const reserva = await Reserva.findById(external_reference);
      if (!reserva) {
        return res.status(404).json({ message: 'Reserva no encontrada' });
      }

      if (status === 'approved') {
        // Actualizar reserva
        reserva.estado = 'pago_confirmado';
        reserva.pago.estado = 'aprobado';
        reserva.pago.mercadoPagoId = paymentId;
        reserva.pago.fechaPago = new Date();

        await reserva.save();

        // Generar orden de servicio
        await this.generarOrdenServicio(reserva._id);

        res.json({ message: 'Pago confirmado y orden generada', numeroOrden: reserva.numeroOrden });
      } else {
        reserva.pago.estado = 'rechazado';
        await reserva.save();
        res.status(400).json({ message: 'Pago rechazado' });
      }

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Generar orden de servicio (aquí se comparten los datos exactos)
  static async generarOrdenServicio(reservaId) {
    try {
      const reserva = await Reserva.findById(reservaId)
        .populate('cliente', 'nombre telefono email')
        .populate('profesional', 'profesion usuario')
        .populate({
          path: 'profesional',
          populate: { path: 'usuario', select: 'nombre telefono email' }
        });

      // Cambiar estado a orden_generada
      reserva.estado = 'orden_generada';
      await reserva.save();

      // Aquí se enviarían notificaciones con los datos completos
      // Email al profesional con datos del cliente y dirección exacta
      // Email al cliente con confirmación y datos del profesional

      // Emitir notificación en tiempo real al profesional sobre la nueva orden
      try {
        const profesionalUsuarioId = reserva.profesional && reserva.profesional.usuario ? reserva.profesional.usuario._id.toString() : null;
        if (profesionalUsuarioId) {
          const { io } = require('../server');
          io.to(`user:${profesionalUsuarioId}`).emit('notify', {
            title: 'Orden de servicio generada',
            body: `Orden ${reserva.numeroOrden} - ${reserva.descripcionTrabajo?.substring(0, 80) || ''}`,
            data: { tipo: 'orden', id: reserva._id, url: `/mis-trabajos?orden=${reserva._id}` },
            url: `/mis-trabajos?orden=${reserva._id}`,
            icon: '/icons/orden.png'
          });
        }
      } catch (err) {
        console.warn('Error emitiendo notificación de orden:', err.message || err);
      }

      return reserva;
    } catch (error) {
      throw error;
    }
  }

  // Marcar trabajo como completado por el profesional
  static async marcarCompletadoProfesional(req, res) {
    try {
      const { id } = req.params;
      const { notasFinalizacion } = req.body;
      const userId = req.user.id;

      const reserva = await Reserva.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!reserva) {
        return res.status(404).json({ message: 'Reserva no encontrada' });
      }

      // Verificar que es el profesional
      const esProfesional = reserva.profesional.usuario.toString() === userId;
      if (!esProfesional) {
        return res.status(403).json({ message: 'Solo el profesional puede marcar como completado' });
      }

      if (reserva.estado !== 'en_progreso') {
        return res.status(400).json({ message: 'La reserva debe estar en progreso' });
      }

      // Marcar como completado por profesional
      reserva.estado = 'pendiente_confirmacion';
      reserva.confirmacion = {
        profesionalCompleto: true,
        clienteAprobado: false,
        fechaCompletadoProfesional: new Date(),
        timeoutAutoConfirmacion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      };
      reserva.notasFinalizacion = notasFinalizacion;

      await reserva.save();

      res.json({ 
        message: 'Trabajo marcado como completado. Esperando confirmación del cliente.',
        reserva 
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Confirmar trabajo por el cliente
  static async confirmarTrabajo(req, res) {
    try {
      const { id } = req.params;
      const { importeReal } = req.body;
      const userId = req.user.id;

      const reserva = await Reserva.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!reserva) {
        return res.status(404).json({ message: 'Reserva no encontrada' });
      }

      // Verificar que es el cliente
      const esCliente = reserva.cliente._id.toString() === userId;
      if (!esCliente) {
        return res.status(403).json({ message: 'Solo el cliente puede confirmar el trabajo' });
      }

      if (reserva.estado !== 'pendiente_confirmacion') {
        return res.status(400).json({ message: 'El trabajo debe estar pendiente de confirmación' });
      }

      // Validar importe real
      if (!importeReal || importeReal <= 0) {
        return res.status(400).json({ message: 'Debe ingresar el importe real cobrado' });
      }

      // Confirmar trabajo
      reserva.estado = 'completada';
      reserva.confirmacion.clienteAprobado = true;
      reserva.confirmacion.fechaAprobadoCliente = new Date();
      reserva.costos.importeReal = importeReal;

      await reserva.save();

      res.json({ 
        message: 'Trabajo confirmado.',
        reserva 
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Solicitar correcciones
  static async solicitarCorrecciones(req, res) {
    try {
      const { id } = req.params;
      const { descripcion } = req.body;
      const userId = req.user.id;

      const reserva = await Reserva.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!reserva) {
        return res.status(404).json({ message: 'Reserva no encontrada' });
      }

      // Verificar que es el cliente
      const esCliente = reserva.cliente._id.toString() === userId;
      if (!esCliente) {
        return res.status(403).json({ message: 'Solo el cliente puede solicitar correcciones' });
      }

      if (reserva.estado !== 'pendiente_confirmacion') {
        return res.status(400).json({ message: 'El trabajo debe estar pendiente de confirmación' });
      }

      // Volver a en_progreso y marcar solicitud de corrección
      reserva.estado = 'en_progreso';
      reserva.solicitudCorreccion = {
        activa: true,
        descripcion,
        fechaSolicitud: new Date()
      };
      reserva.confirmacion.profesionalCompleto = false;
      reserva.confirmacion.fechaCompletadoProfesional = null;

      await reserva.save();

      res.json({ 
        message: 'Solicitud de correcciones enviada al profesional.',
        reserva 
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Cambiar estado de reserva (método simplificado)
  static async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const userId = req.user.id;

      const reserva = await Reserva.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!reserva) {
        return res.status(404).json({ message: 'Reserva no encontrada' });
      }

      // Verificar permisos
      const esCliente = reserva.cliente._id.toString() === userId;
      const esProfesional = reserva.profesional.usuario.toString() === userId;

      if (!esCliente && !esProfesional) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      // Solo permitir ciertos cambios de estado
      const estadosPermitidos = ['en_progreso', 'cancelada'];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({ 
          message: 'Use los endpoints específicos para completar o confirmar trabajos' 
        });
      }

      // Si el profesional acepta el trabajo (cambia a en_progreso), consumir token
      if (estado === 'en_progreso' && esProfesional && 
          (reserva.estado === 'orden_generada' || reserva.estado === 'pago_pendiente')) {
        try {
          const resultadoToken = await consumirToken(
            userId, 
            reserva._id, 
            `Trabajo aceptado: ${reserva.descripcionTrabajo.substring(0, 50)}...`
          );
          
          // Agregar información de tokens a la respuesta
          reserva.estado = estado;
          await reserva.save();
          
          return res.json({ 
            message: 'Trabajo aceptado. Token consumido.', 
            reserva,
            tokens: resultadoToken
          });
        } catch (tokenError) {
          return res.status(403).json({ 
            message: tokenError.message,
            tokensDisponibles: 0
          });
        }
      }

      reserva.estado = estado;
      await reserva.save();

      res.json({ message: 'Estado actualizado', reserva });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Auto-confirmar trabajos después del timeout
  static async autoConfirmarTrabajos() {
    try {
      const ahora = new Date();
      const reservasPendientes = await Reserva.find({
        estado: 'pendiente_confirmacion',
        'confirmacion.timeoutAutoConfirmacion': { $lte: ahora }
      }).populate('profesional');

      for (const reserva of reservasPendientes) {
        // Auto-confirmar
        reserva.estado = 'completada';
        reserva.confirmacion.clienteAprobado = true;
        reserva.confirmacion.fechaAprobadoCliente = new Date();

        await reserva.save();
      }

      return reservasPendientes.length;
    } catch (error) {
      console.error('Error en auto-confirmación:', error);
      throw error;
    }
  }

  // Obtener reservas del usuario
  static async obtenerReservas(req, res) {
    try {
      const userId = req.user.id;
      const { tipo } = req.query;

      let query = {};
      let populateFields = [];

      if (tipo === 'profesional') {
        // Buscar reservas donde el usuario es el profesional
        const profesionales = await Profesional.find({ usuario: userId });
        if (profesionales.length === 0) {
          return res.json([]);
        }
        query.profesional = { $in: profesionales.map(p => p._id) };
        populateFields = [
          { path: 'cliente', select: 'nombre telefono' },
          { 
            path: 'profesional', 
            select: 'profesion tarifas usuario',
            populate: { path: 'usuario', select: 'nombre telefono' }
          }
        ];
      } else {
        // Por defecto buscar como cliente
        query.cliente = userId;
        populateFields = [
          { path: 'cliente', select: 'nombre telefono' },
          { 
            path: 'profesional', 
            select: 'profesion tarifas usuario',
            populate: { path: 'usuario', select: 'nombre telefono' }
          }
        ];
      }

      const reservas = await Reserva.find(query)
        .populate(populateFields)
        .sort({ createdAt: -1 });

      // Transformar datos para compatibilidad con frontend
      const reservasTransformadas = reservas.map(reserva => {
        const reservaObj = reserva.toObject();
        // Agregar alias para compatibilidad
        if (reservaObj.profesional) {
          reservaObj.oficio = reservaObj.profesional;
        }
        return reservaObj;
      });

      res.json(reservasTransformadas);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = ReservasController;