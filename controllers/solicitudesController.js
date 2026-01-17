const Solicitud = require('../models/Solicitud');
const User = require('../models/User');
const Profesional = require('../models/Profesional');
const SubscriptionsController = require('./subscriptionsController');

class SolicitudesController {
  // Crear solicitud (sin créditos para clientes)
  static async crearSolicitud(req, res) {
    try {
      const { oficioId, descripcionTrabajo, direccion } = req.body;
      const clienteId = req.user.id;

      // Validar profesional
      const profesional = await Profesional.findById(oficioId).populate('usuario');
      if (!profesional) {
        return res.status(404).json({ message: 'Profesional no encontrado' });
      }

      // Crear solicitud con información inicial limitada
      const solicitud = new Solicitud({
        cliente: clienteId,
        profesional: oficioId,
        descripcionTrabajo,
        direccion,
        informacionVisible: {
          ciudad: direccion.ciudad || 'Buenos Aires',
          nivelRevelacion: 'ciudad'
        }
      });

      await solicitud.save();
        // Emitir notificación en tiempo real al profesional (si está conectado)
        try {
          const { io } = require('../server');
          const profesionalUsuarioId = profesional.usuario?._id ? profesional.usuario._id.toString() : null;
          if (profesionalUsuarioId) {
            io.to(`user:${profesionalUsuarioId}`).emit('notify', {
              title: 'Nueva solicitud de trabajo',
              body: `Tienes una nueva solicitud de ${req.user.nombre || 'un cliente'}`,
              data: { tipo: 'solicitud', id: solicitud._id, url: `/mis-trabajos?solicitud=${solicitud._id}` },
              url: `/mis-trabajos?solicitud=${solicitud._id}`,
              icon: '/icons/solicitud.png'
            });
          }
        } catch (err) {
          console.warn('Error emitiendo notificación de solicitud:', err.message || err);
        }

      res.status(201).json({
        solicitud: {
          id: solicitud._id,
          numeroSolicitud: solicitud.numeroSolicitud,
          estado: solicitud.estado
        },
        message: 'Solicitud enviada exitosamente'
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Responder a solicitud (profesionales usan créditos)
  static async responderSolicitud(req, res) {
    try {
      const { id } = req.params;
      const { mensaje } = req.body;
      const profesionalId = req.user.id;

      const solicitud = await Solicitud.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      // Verificar que el usuario sea el profesional
      if (solicitud.profesional.usuario.toString() !== profesionalId) {
        return res.status(403).json({ message: 'No autorizado para responder esta solicitud' });
      }

      // Verificar que la solicitud esté pendiente
      if (solicitud.estado !== 'pendiente') {
        return res.status(400).json({ message: 'Esta solicitud ya fue respondida' });
      }

      // Usar crédito del profesional
      await SubscriptionsController.usarCredito({
        user: { id: profesionalId },
        body: { solicitudId: solicitud._id }
      }, {
        json: () => {},
        status: () => ({ json: () => {} })
      });

      // Actualizar solicitud
      solicitud.estado = 'contactado';
      solicitud.fechaContacto = new Date();
      solicitud.respuestaProfesional = mensaje;
      await solicitud.save();

      res.json({ 
        message: 'Respuesta enviada exitosamente', 
        solicitud 
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Cambiar estado de solicitud con flujo de revelación
  static async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, notas } = req.body;
      const userId = req.user.id;

      const solicitud = await Solicitud.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      // Verificar permisos
      const esCliente = solicitud.cliente._id.toString() === userId;
      const esProfesional = solicitud.profesional.usuario.toString() === userId;

      if (!esCliente && !esProfesional) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      // Actualizar nivel de revelación según el estado
      switch (estado) {
        case 'contactado':
          solicitud.informacionVisible.nivelRevelacion = 'barrio';
          break;
        case 'en_progreso':
          solicitud.informacionVisible.nivelRevelacion = 'barrio';
          solicitud.fechaInicio = new Date();
          break;
        case 'pendiente_confirmacion':
          solicitud.informacionVisible.nivelRevelacion = 'direccion_completa';
          solicitud.informacionVisible.direccionCompleta = true;
          if (esProfesional) {
            solicitud.confirmacion.profesionalCompleto = true;
            solicitud.confirmacion.fechaCompletadoProfesional = new Date();
            // Auto-confirmación en 24 horas
            solicitud.confirmacion.timeoutAutoConfirmacion = new Date(Date.now() + 24 * 60 * 60 * 1000);
          }
          break;
        case 'completada':
          if (esCliente && solicitud.confirmacion.profesionalCompleto) {
            solicitud.confirmacion.clienteAprobado = true;
            solicitud.confirmacion.fechaAprobadoCliente = new Date();
          }
          break;
      }

      solicitud.estado = estado;
      if (notas) {
        if (estado === 'completada' || estado === 'pendiente_confirmacion') {
          solicitud.notasFinalizacion = notas;
        } else {
          solicitud.notas = notas;
        }
      }
      
      await solicitud.save();

      res.json({ message: 'Estado actualizado', solicitud });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Confirmar trabajo completado (cliente)
  static async confirmarCompletado(req, res) {
    try {
      const { id } = req.params;
      const { aprobado, notas } = req.body;
      const userId = req.user.id;

      const solicitud = await Solicitud.findById(id)
        .populate('cliente')
        .populate('profesional');

      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      // Solo el cliente puede confirmar
      if (solicitud.cliente._id.toString() !== userId) {
        return res.status(403).json({ message: 'Solo el cliente puede confirmar' });
      }

      if (solicitud.estado !== 'pendiente_confirmacion') {
        return res.status(400).json({ message: 'La solicitud no está pendiente de confirmación' });
      }

      if (aprobado) {
        solicitud.estado = 'completada';
        solicitud.confirmacion.clienteAprobado = true;
        solicitud.confirmacion.fechaAprobadoCliente = new Date();
      } else {
        solicitud.solicitudCorreccion.activa = true;
        solicitud.solicitudCorreccion.descripcion = notas;
        solicitud.solicitudCorreccion.fechaSolicitud = new Date();
        solicitud.estado = 'en_progreso';
      }

      if (notas) {
        solicitud.notasFinalizacion = notas;
      }

      await solicitud.save();

      res.json({ 
        message: aprobado ? 'Trabajo confirmado como completado' : 'Solicitud de corrección enviada',
        solicitud 
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Obtener solicitudes del usuario
  static async obtenerSolicitudes(req, res) {
    try {
      const userId = req.user.id;
      const { tipo } = req.query;

      let query = {};
      let populateFields = [];

      if (tipo === 'profesional') {
        // Buscar solicitudes donde el usuario es el profesional
        const profesionales = await Profesional.find({ usuario: userId });
        if (profesionales.length === 0) {
          return res.json([]);
        }
        query.profesional = { $in: profesionales.map(p => p._id) };
        populateFields = [
          { path: 'cliente', select: 'nombre telefono' },
          { path: 'profesional', select: 'profesion' }
        ];
      } else {
        // Por defecto buscar como cliente
        query.cliente = userId;
        populateFields = [
          { path: 'cliente', select: 'nombre telefono' },
          { 
            path: 'profesional', 
            select: 'profesion',
            populate: { path: 'usuario', select: 'nombre telefono' }
          }
        ];
      }

      const solicitudes = await Solicitud.find(query)
        .populate(populateFields)
        .sort({ createdAt: -1 });

      res.json(solicitudes);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = SolicitudesController;