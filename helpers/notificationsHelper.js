// Helper para enviar notificaciones desde controladores
const notificationsService = require('../services/notificationsService');

async function emitirNotificacion(io, userId, notificationData) {
  try {
    if (!io) {
      console.warn('[notificationsHelper] io no está disponible');
      return null;
    }
    return await notificationsService.sendNotification(io, userId, notificationData);
  } catch (error) {
    console.error('[notificationsHelper] Error emitiendo notificación:', error.message);
    return null;
  }
}

async function emitirActualizacion(io, entityType, entityId, data) {
  try {
    if (!io) {
      console.warn('[notificationsHelper] io no está disponible');
      return;
    }
    // Emitir evento de actualización a la sala de la entidad
    io.to(`${entityType}:${entityId}`).emit('entityUpdated', {
      entityType,
      entityId: entityId.toString(),
      ...data,
      timestamp: new Date()
    });
    console.log(`[notificationsHelper] Actualización emitida para ${entityType}:${entityId}`);
  } catch (error) {
    console.error('[notificationsHelper] Error emitiendo actualización:', error.message);
  }
}

module.exports = {
  emitirNotificacion,
  emitirActualizacion
};
