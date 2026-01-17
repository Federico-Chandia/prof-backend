const mongoose = require('mongoose');
const Reserva = require('../models/Reserva');
require('dotenv').config();

async function limpiarFacturacionPrevia() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arreglalo');
    console.log('Conectado a MongoDB');

    // Limpiar campos de facturación previa en reservas completadas
    const result = await Reserva.updateMany(
      { estado: 'completada' },
      { 
        $unset: { 
          'costos.importeReal': ''
        }
      }
    );

    console.log(`Limpieza completada: ${result.modifiedCount} reservas actualizadas`);
    
    // Mostrar estadísticas después de la limpieza
    const reservasCompletadas = await Reserva.countDocuments({ estado: 'completada' });
    const reservasConImporteReal = await Reserva.countDocuments({ 
      estado: 'completada', 
      'costos.importeReal': { $exists: true } 
    });

    console.log(`Total reservas completadas: ${reservasCompletadas}`);
    console.log(`Reservas con importe real: ${reservasConImporteReal}`);
    
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  limpiarFacturacionPrevia();
}

module.exports = limpiarFacturacionPrevia;