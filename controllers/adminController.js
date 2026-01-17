const User = require('../models/User');
const Profesional = require('../models/Profesional');
const Reserva = require('../models/Reserva');
const Message = require('../models/Message');
const Review = require('../models/Review');

// Eliminar usuario
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // No permitir eliminar otros admins
    if (user.rol === 'admin') {
      return res.status(403).json({ message: 'No se puede eliminar un administrador' });
    }

    // Eliminar usuario
    await User.findByIdAndDelete(userId);
    
    // Si es profesional, eliminar también su perfil profesional
    if (user.rol === 'profesional') {
      await Profesional.findOneAndDelete({ usuario: userId });
    }

    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Suspender/Activar usuario
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.rol === 'admin') {
      return res.status(403).json({ message: 'No se puede modificar un administrador' });
    }

    user.activo = !user.activo;
    await user.save();

    res.json({ 
      success: true, 
      message: `Usuario ${user.activo ? 'activado' : 'suspendido'} correctamente`,
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Cambiar rol de usuario
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { rol } = req.body;

    if (!['cliente', 'profesional'].includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.rol === 'admin') {
      return res.status(403).json({ message: 'No se puede modificar un administrador' });
    }

    user.rol = rol;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Rol actualizado correctamente',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Obtener detalles de usuario
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('suscripcion');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si es profesional, obtener datos adicionales
    let profesionalData = null;
    if (user.rol === 'profesional') {
      profesionalData = await Profesional.findOne({ usuario: userId });
    }

    // Obtener estadísticas del usuario
    const reservasCount = await Reserva.countDocuments({
      $or: [{ cliente: userId }, { profesional: userId }]
    });

    res.json({
      success: true,
      user,
      profesionalData,
      stats: { reservasCount }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Buscar usuarios
exports.searchUsers = async (req, res) => {
  try {
    const { query, rol, activo } = req.query;
    
    const filters = {};
    
    if (query) {
      filters.$or = [
        { nombre: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (rol) filters.rol = rol;
    if (activo !== undefined) filters.activo = activo === 'true';

    const users = await User.find(filters)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Backfill fastResponder metrics across professionals (safe, admin only)
exports.backfillFastResponder = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0; // 0 = all
    const dryRun = req.query.apply !== 'true'; // default dry-run unless apply=true

    const professionals = await Profesional.find({}).limit(limit || 0);
    const summary = [];

    for (const prof of professionals) {
      const sentMessages = await Message.find({ emisor: prof.usuario }).sort({ createdAt: 1 }).lean();
      let diffs = [];

      for (const msg of sentMessages) {
        const prev = await Message.findOne({ reserva: msg.reserva, createdAt: { $lt: msg.createdAt } }).sort({ createdAt: -1 }).lean();
        if (prev && String(prev.emisor) !== String(msg.emisor)) {
          const diffMinutes = (new Date(msg.createdAt) - new Date(prev.createdAt)) / (1000 * 60);
          if (diffMinutes >= 0 && diffMinutes < 60*24) diffs.push(diffMinutes);
        }
      }

      if (diffs.length === 0) {
        summary.push({ profesional: prof._id, updated: false, reason: 'no-responses' });
        continue;
      }

      const avg = diffs.reduce((a,b) => a+b, 0) / diffs.length;
      const count = diffs.length;
      const fast = avg <= 30;

      if (!dryRun) {
        prof.respuestaPromedioMinutos = avg;
        prof.respuestasContadas = count;
        prof.fastResponder = fast;
        await prof.save();
      }

      summary.push({ profesional: prof._id, avg: Math.round(avg), count, fast, updated: !dryRun });
    }

    res.json({ success: true, dryRun, count: professionals.length, summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};