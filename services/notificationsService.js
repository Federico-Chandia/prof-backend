const Notification = require('../models/Notification');

async function getUserNotifications(userId, options = {}) {
  const { limit = 50, skip = 0, unreadOnly = false } = options;
  
  const query = { usuario: userId };
  if (unreadOnly) {
    query.leida = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ usuario: userId, leida: false });

  return {
    notifications,
    total,
    unreadCount
  };
}

async function markAsRead(notificationId) {
  return await Notification.findByIdAndUpdate(
    notificationId,
    { leida: true },
    { new: true }
  );
}

async function markAllAsRead(userId) {
  return await Notification.updateMany(
    { usuario: userId, leida: false },
    { leida: true }
  );
}

async function deleteNotification(notificationId) {
  return await Notification.findByIdAndDelete(notificationId);
}

async function deleteAllUserNotifications(userId) {
  return await Notification.deleteMany({ usuario: userId });
}

// Función para crear notificación en BD y emitir por Socket.IO
async function sendNotification(io, userId, notificationData) {
  try {
    const {
      tipo = 'otro',
      titulo = 'Notificación',
      mensaje = '',
      url = null,
      icono = null,
      referencia = {},
      etiqueta = null
    } = notificationData;

    // Crear notificación en BD
    const newNotification = new Notification({
      usuario: userId,
      tipo,
      titulo,
      mensaje,
      url,
      icono,
      referencia,
      etiqueta
    });

    await newNotification.save();

    // Emitir notificación en tiempo real por Socket.IO
    if (io) {
      try {
        io.to(`user:${userId}`).emit('notify', {
          id: newNotification._id.toString(),
          tipo,
          title: titulo,
          body: mensaje,
          icon: icono,
          url,
          data: {
            tipo,
            reference: referencia
          }
        });
        console.log('[notificationsService] Notificación emitida a usuario:', userId);
      } catch (err) {
        console.warn('[notificationsService] Error emitiendo notificación por Socket.IO:', err);
      }
    }

    return newNotification;
  } catch (error) {
    console.error('[notificationsService] Error enviando notificación:', error);
    throw error;
  }
}

// Función para enviar notificaciones a múltiples usuarios
async function sendNotificationToMultiple(io, userIds, notificationData) {
  try {
    const notifications = [];
    
    for (const userId of userIds) {
      const notification = await sendNotification(io, userId, notificationData);
      notifications.push(notification);
    }
    
    return notifications;
  } catch (error) {
    console.error('[notificationsService] Error enviando notificaciones múltiples:', error);
    throw error;
  }
}

// Función para obtener eventos reales para actualización automática
function getEventoActualizacion(tipo) {
  const eventos = {
    reserva: 'reservaActualizada',
    solicitud: 'solicitudActualizada',
    mensaje: 'nuevoMensaje',
    pago: 'pagoActualizado',
    suscripcion: 'suscripcionActualizada',
    solicitudNueva: 'nuevaSolicitud',
    reservaNueva: 'nuevaReserva'
  };
  return eventos[tipo] || 'actualizacion';
}

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllUserNotifications,
  sendNotification,
  sendNotificationToMultiple,
  getEventoActualizacion
};
