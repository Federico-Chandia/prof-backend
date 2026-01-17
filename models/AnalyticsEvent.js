const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  event: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  properties: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

analyticsSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsSchema);