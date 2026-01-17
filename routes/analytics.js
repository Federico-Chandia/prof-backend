const express = require('express');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route POST /api/analytics
// Public: will accept anonymous events (user inferred from token if present)
router.post('/', async (req, res) => {
  try {
    const { event, properties } = req.body;
    const userId = req.user ? req.user.id : null;
    const doc = await AnalyticsEvent.create({ event, user: userId, properties: properties || {} });
    res.json({ success: true, event: doc });
  } catch (error) {
    console.error('Error saving analytics event:', error);
    res.status(500).json({ success: false, message: 'Error saving analytics event' });
  }
});

module.exports = router;