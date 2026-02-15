const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Webhook endpoint for Brevo events
router.post('/', express.json(), (req, res) => {
  try {
    const body = req.body;
    const logLine = `[${new Date().toISOString()}] ${JSON.stringify(body)}\n`;
    const logPath = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
    fs.appendFileSync(path.join(logPath, 'brevo-events.log'), logLine);
    console.log('📬 Brevo webhook event received:', JSON.stringify(body));
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling Brevo webhook:', err);
    res.status(500).send('Error');
  }
});

module.exports = router;
