const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Reserva = require('../models/Reserva');

module.exports = function (io) {
  // Map para manejar sockets por usuario (soporta múltiples sockets por usuario)
  const onlineUsers = new Map(); // userId => Set(socketId)

  const addSocket = (userId, socketId) => {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
  };

  const removeSocket = (userId, socketId) => {
    if (!onlineUsers.has(userId)) return;
    const set = onlineUsers.get(userId);
    set.delete(socketId);
    if (set.size === 0) onlineUsers.delete(userId);
  };

  const emitToUser = (userId, event, payload) => {
    // Emitir a la sala del usuario para abarcar todos sus sockets
    try {
      io.to(`user:${userId}`).emit(event, payload);
    } catch (err) {
      console.warn('[socket] emitToUser error:', err);
    }
  };

  io.on('connection', async (socket) => {
    try {
      console.log('[socket] Nueva conexión:', socket.id);
      // Token puede venir en handshake.auth.token (recomendado)
      const token = socket.handshake?.auth?.token || socket.handshake?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        console.log('[socket] Sin token, permitiendo conexión temporal (requiere token para joinRoom)');
        // Permitir conexión sin token pero marcar como no autenticado
        socket.user = null;
        socket.emit('error', { message: 'Token requerido. Por favor inicia sesión.' });
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[socket] Token verificado para usuario:', decoded.id);
      } catch (err) {
        console.log('[socket] Token inválido:', err.message);
        socket.disconnect(true);
        return;
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        console.log('[socket] Usuario no encontrado:', decoded.id);
        socket.disconnect(true);
        return;
      }

      socket.user = { id: user._id.toString(), nombre: user.nombre };
      addSocket(socket.user.id, socket.id);
      // Unir socket a una sala por usuario para permitir emisiones dirigidas
      socket.join(`user:${socket.user.id}`);
      console.log('[socket] Usuario conectado:', socket.user.nombre, 'ID:', socket.user.id);

      // Enviar info inicial (por ejemplo, conteo de mensajes no leídos)
      const unread = await Message.countDocuments({ receptor: socket.user.id, leido: false });
      socket.emit('unreadCount', { count: unread });
      console.log('[socket] Enviado unreadCount:', unread);

      // Join a rooms por reservas que el cliente pida
      socket.on('joinRoom', async ({ reservaId }) => {
        try {
          console.log('[socket] joinRoom evento:', reservaId, 'de usuario:', socket.user?.id);
          
          if (!socket.user) {
            console.log('[socket] joinRoom rechazado: usuario no autenticado');
            socket.emit('error', { message: 'Token requerido para unirse a una sala' });
            return;
          }
          
          if (!reservaId) {
            console.log('[socket] joinRoom sin reservaId');
            return;
          }

          // Verificar que la reserva exista y que el usuario participe
          const reserva = await Reserva.findById(reservaId)
            .populate('cliente', '_id')
            .populate({ path: 'profesional', populate: { path: 'usuario', select: '_id' } });

          if (!reserva) {
            console.log('[socket] Reserva no encontrada:', reservaId);
            socket.emit('error', { message: 'Reserva no encontrada' });
            return;
          }

          const userId = socket.user.id;
          const esCliente = reserva.cliente && reserva.cliente._id.toString() === userId;
          const esProfesional = reserva.profesional && reserva.profesional.usuario && reserva.profesional.usuario._id.toString() === userId;

          console.log('[socket] Verificación de acceso - esCliente:', esCliente, 'esProfesional:', esProfesional);

          if (!esCliente && !esProfesional) {
            console.log('[socket] No autorizado para esta reserva');
            socket.emit('error', { message: 'No autorizado para esta reserva' });
            return;
          }

          const room = `reserva:${reservaId}`;
          socket.join(room);
          console.log('[socket] Usuario unido a room:', room);

          // Enviar mensajes recientes al unirse (INCLUYENDO los leídos para historial completo)
          const recent = await Message.find({ reserva: reservaId })
            .populate('emisor', '_id nombre')
            .populate('receptor', '_id nombre')
            .sort({ createdAt: 1 })
            .lean();

          // Normalizar para asegurar JSON serializable (ObjectId -> string, fechas -> ISO)
          const normalize = (m) => {
            if (!m) return m;
            return {
              ...m,
              _id: m._id ? m._id.toString() : m.id,
              reserva: m.reserva ? m.reserva.toString() : m.reserva,
              emisor: m.emisor ? { ...m.emisor, _id: m.emisor._id ? m.emisor._id.toString() : m.emisor.id } : undefined,
              receptor: m.receptor ? { ...m.receptor, _id: m.receptor._id ? m.receptor._id.toString() : m.receptor.id } : undefined,
              createdAt: m.createdAt ? (m.createdAt.toISOString ? m.createdAt.toISOString() : m.createdAt) : m.createdAt,
              updatedAt: m.updatedAt ? (m.updatedAt.toISOString ? m.updatedAt.toISOString() : m.updatedAt) : m.updatedAt,
            };
          };

          const normalizedRecent = (recent || []).map(normalize);
          console.log('[socket] Enviando initialMessages con', normalizedRecent.length || 0, 'mensajes');
          socket.emit('initialMessages', { messages: normalizedRecent });

          // Marcar como leídos automáticamente al unirse
          console.log('[socket] Marcando mensajes como leídos al unirse a la sala');
          const result = await Message.updateMany(
            { reserva: reservaId, receptor: userId, leido: false },
            { leido: true, fechaLectura: new Date() }
          );
          console.log('[socket] Mensajes marcados como leídos:', result.modifiedCount || 0);

          // Actualizar conteo de no leídos
          const unread = await Message.countDocuments({ receptor: userId, leido: false });
          socket.emit('unreadCount', { count: unread });
        } catch (err) {
          console.error('Error en joinRoom:', err);
          socket.emit('error', { message: 'Error al unirse a la sala' });
        }
      });

      // Enviar mensaje: guarda en DB y emite al room
      socket.on('sendMessage', async (payload, callback) => {
        try {
          console.log('[socket] sendMessage payload:', payload, 'from', socket.user?.id);
          const { reservaId, receptorId, mensaje, tipo = 'texto' } = payload || {};
          if (!reservaId || !receptorId || !mensaje) {
            if (callback) callback({ success: false, message: 'Datos incompletos' });
            return;
          }

          // Verificar acceso a reserva (opcional, redundante si se unió antes)
          const reserva = await Reserva.findById(reservaId)
            .populate('cliente', '_id')
            .populate({ path: 'profesional', populate: { path: 'usuario', select: '_id' } });

          if (!reserva) {
            if (callback) callback({ success: false, message: 'Reserva no encontrada' });
            return;
          }

          const userId = socket.user.id;
          const esCliente = reserva.cliente && reserva.cliente._id.toString() === userId;
          const esProfesional = reserva.profesional && reserva.profesional.usuario && reserva.profesional.usuario._id.toString() === userId;

          if (!esCliente && !esProfesional) {
            if (callback) callback({ success: false, message: 'No autorizado' });
            return;
          }

          const newMessage = new Message({
            reserva: reservaId,
            emisor: userId,
            receptor: receptorId,
            mensaje,
            tipo,
            leido: false
          });

          const saved = await newMessage.save();
          console.log('[socket] message saved id:', saved._id.toString());

          // Recargar el mensaje con referencias pobladas
          const fullMessage = await Message.findById(saved._id)
            .populate('emisor', '_id nombre')
            .populate('receptor', '_id nombre')
            .lean();

          // Normalizar fullMessage antes de emitir y devolver en el ack
          const normalized = fullMessage ? {
            ...fullMessage,
            _id: fullMessage._id ? fullMessage._id.toString() : fullMessage.id,
            reserva: fullMessage.reserva ? fullMessage.reserva.toString() : fullMessage.reserva,
            emisor: fullMessage.emisor ? { ...fullMessage.emisor, _id: fullMessage.emisor._id ? fullMessage.emisor._id.toString() : fullMessage.emisor.id } : undefined,
            receptor: fullMessage.receptor ? { ...fullMessage.receptor, _id: fullMessage.receptor._id ? fullMessage.receptor._id.toString() : fullMessage.receptor.id } : undefined,
            createdAt: fullMessage.createdAt ? (fullMessage.createdAt.toISOString ? fullMessage.createdAt.toISOString() : fullMessage.createdAt) : fullMessage.createdAt,
            updatedAt: fullMessage.updatedAt ? (fullMessage.updatedAt.toISOString ? fullMessage.updatedAt.toISOString() : fullMessage.updatedAt) : fullMessage.updatedAt,
          } : fullMessage;

          console.log('[socket] fullMessage (normalized):', normalized?._id);

          const room = `reserva:${reservaId}`;
          io.to(room).emit('newMessage', { message: normalized });
          console.log('[socket] emitted newMessage to room', room, 'with message:', normalized?._id);

          // Enviar directamente al receptor (si está conectado) para asegurar entrega
          try {
            emitToUser(receptorId, 'newMessage', { message: normalized });
            console.log('[socket] emitted newMessage directly to user', receptorId, 'message:', normalized?._id);
          } catch (err) {
            console.warn('[socket] Error emitiendo directamente al usuario:', err);
          }

          // Actualizar conteo de no leídos para el receptor
          const unread = await Message.countDocuments({ receptor: receptorId, leido: false });
          emitToUser(receptorId, 'unreadCount', { count: unread });

          // Emitir notificación liviana (integración con push se implementa aparte)
          emitToUser(receptorId, 'notify', {
            title: `Nuevo mensaje de ${socket.user.nombre}`,
            body: tipo === 'texto' ? (mensaje.length > 120 ? mensaje.slice(0, 120) + '...' : mensaje) : 'Envío multimedia'
          });

          if (callback) callback({ success: true, message: normalized });
        } catch (err) {
          console.error('Error en sendMessage:', err);
          if (callback) callback({ success: false, message: 'Error interno' });
        }
      });

      // Marcar mensajes como leídos para una reserva
      socket.on('markRead', async ({ reservaId }, callback) => {
        try {
          if (!reservaId) return;
          const userId = socket.user.id;
          const res = await Message.updateMany({ reserva: reservaId, receptor: userId, leido: false }, { leido: true, fechaLectura: new Date() });

          const unread = await Message.countDocuments({ receptor: userId, leido: false });
          socket.emit('unreadCount', { count: unread });

          if (callback) callback({ success: true, modified: res.nModified || res.modifiedCount || 0 });
        } catch (err) {
          console.error('Error en markRead:', err);
          if (callback) callback({ success: false });
        }
      });

      socket.on('disconnect', () => {
        try {
          if (socket.user?.id) {
            removeSocket(socket.user.id, socket.id);
            console.log('[socket] Usuario desconectado:', socket.user.id);
          }
        } catch (err) {
          console.error('Error al desconectar socket:', err);
        }
      });

    } catch (err) {
      console.error('Error en conexión socket:', err);
      socket.disconnect(true);
    }
  });
};
