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

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllUserNotifications
};
