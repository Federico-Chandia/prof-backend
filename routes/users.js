const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Obtener perfil del usuario
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// @route   PUT /api/users/profile
// @desc    Actualizar perfil del usuario
router.put('/profile', [
  auth,
  body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('telefono').optional().isLength({ min: 1 }).withMessage('Teléfono no puede estar vacío')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

        const { nombre, telefono, avatar, direccion } = req.body;
    
    // Validar que req.user.id sea un ObjectId válido
    if (!req.user.id || !req.user.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }
    
    const updateFields = {};
    if (nombre && typeof nombre === 'string') updateFields.nombre = nombre.trim();
    if (telefono && typeof telefono === 'string') updateFields.telefono = telefono.trim();
    if (avatar && typeof avatar === 'string') updateFields.avatar = avatar.trim();
    if (direccion && typeof direccion === 'object') updateFields.direccion = direccion;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;