const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = function (io) {
  // Socket.IO para notificaciones en tiempo real
  io.on('connection', async (socket) => {
    try {
      // Autenticar usuario
      const token = socket.handshake?.auth?.token || socket.handshake?.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        socket.disconnect(true);
        return;
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        socket.disconnect(true);
        return;
      }

      // Unirse a sala de usuario para notificaciones personalizadas
      socket.join(`user:${user._id.toString()}`);

      // Escuchar eventos de actualización de datos
      socket.on('subscribeToUpdates', ({ entityType, entityId }) => {
        try {
          // Diferentes tipos de entidades que pueden cambiar
          const roomName = `${entityType}:${entityId}`;
          socket.join(roomName);
          console.log(`[socket-notifications] Usuario ${user._id} suscrito a ${roomName}`);
        } catch (err) {
          console.error('[socket-notifications] Error en subscribeToUpdates:', err);
        }
      });

      // Escuchar desuscripción
      socket.on('unsubscribeFromUpdates', ({ entityType, entityId }) => {
        try {
          const roomName = `${entityType}:${entityId}`;
          socket.leave(roomName);
          console.log(`[socket-notifications] Usuario ${user._id} desuscrito de ${roomName}`);
        } catch (err) {
          console.error('[socket-notifications] Error en unsubscribeFromUpdates:', err);
        }
      });

      socket.on('disconnect', () => {
        console.log('[socket-notifications] Usuario desconectado:', user._id);
      });

    } catch (err) {
      console.error('[socket-notifications] Error en conexión:', err);
      socket.disconnect(true);
    }
  });
};
