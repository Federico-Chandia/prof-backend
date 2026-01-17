// Usage: node backfillFastResponder.js [--apply]
const mongoose = require('mongoose');
const Professional = require('../models/Profesional');
const Message = require('../models/Message');
const argv = require('yargs').argv;

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/arregalo';

(async function() {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to DB');

    const apply = !!argv.apply;
    console.log('Apply changes:', apply);

    const professionals = await Professional.find({});
    console.log('Professionals to process:', professionals.length);

    for (const prof of professionals) {
      // Find messages sent by this professional
      const sentMessages = await Message.find({ emisor: prof.usuario }).sort({ createdAt: 1 }).lean();
      let diffs = [];

      for (const msg of sentMessages) {
        // find previous message in same reserva
        const prev = await Message.findOne({ reserva: msg.reserva, createdAt: { $lt: msg.createdAt } }).sort({ createdAt: -1 }).lean();
        if (prev && String(prev.emisor) !== String(msg.emisor)) {
          const diffMinutes = (new Date(msg.createdAt) - new Date(prev.createdAt)) / (1000 * 60);
          if (diffMinutes >= 0 && diffMinutes < 60*24) { // ignore weird large diffs (> 1 day)
            diffs.push(diffMinutes);
          }
        }
      }

      if (diffs.length === 0) {
        console.log(`Prof ${prof._id} (${prof.profesion}) - no valid responses found`);
        continue;
      }

      const avg = diffs.reduce((a,b) => a+b, 0) / diffs.length;
      const count = diffs.length;
      const fast = avg <= 30;

      console.log(`Prof ${prof._id} (${prof.profesion}) -> avg ${avg.toFixed(2)}m over ${count} responses - fast=${fast}`);

      if (apply) {
        prof.respuestaPromedioMinutos = avg;
        prof.respuestasContadas = count;
        prof.fastResponder = fast;
        await prof.save();
        console.log(' -> updated');
      }
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();