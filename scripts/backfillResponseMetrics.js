const mongoose = require('mongoose');
const Message = require('../models/Message');
const Profesional = require('../models/Profesional');
require('dotenv').config();

async function backfill({ dryRun = true, limitProfessionals = null } = {}) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arreglalo');
    console.log('[backfill] Conectado a MongoDB');

    const query = {};
    const profesionales = await Profesional.find(query).limit(limitProfessionals || 0);
    console.log(`[backfill] Procesando ${profesionales.length} profesionales (dryRun=${dryRun})`);

    for (const prof of profesionales) {
      const userId = prof.usuario;
      // Buscar todos los mensajes enviados por este profesional (orden ascendente)
      const replies = await Message.find({ emisor: userId }).sort({ createdAt: 1 }).lean();

      let totalMinutes = 0;
      let count = 0;

      for (const reply of replies) {
        try {
          // Buscar último mensaje previo en la misma reserva que no sea del profesional
          const lastClientMsg = await Message.findOne({ reserva: reply.reserva, createdAt: { $lt: reply.createdAt }, emisor: { $ne: userId } }).sort({ createdAt: -1 }).lean();
          if (!lastClientMsg) continue;

          const diffMs = new Date(reply.createdAt) - new Date(lastClientMsg.createdAt);
          const diffMin = Math.max(0, Math.round(diffMs / 60000));

          totalMinutes += diffMin;
          count += 1;
        } catch (err) {
          console.error('[backfill] error processing reply', err);
        }
      }

      const newAvg = count > 0 ? Math.round(totalMinutes / count) : null;
      const newCount = count;
      const newFast = newAvg !== null ? newAvg <= 30 : false;

      console.log(`[backfill] Profesional ${prof._id} -> avg=${newAvg} min, count=${newCount}, fast=${newFast}`);

      if (!dryRun) {
        await Profesional.updateOne({ _id: prof._id }, {
          $set: {
            respuestaPromedioMinutos: newAvg,
            respuestasContadas: newCount,
            fastResponder: newFast
          }
        });
      }
    }

    await mongoose.disconnect();
    console.log('[backfill] Desconectado de MongoDB');
    console.log('[backfill] Completado');
  } catch (error) {
    console.error('[backfill] Error:', error);
    process.exit(1);
  }
}

// Ejecutar desde la línea de comandos
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  backfill({ dryRun, limitProfessionals: limit });
}

module.exports = backfill;