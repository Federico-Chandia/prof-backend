const express = require('express');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure cloudinary via env vars (CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use multer memory storage to handle small image uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// POST /api/uploads/image
// body: multipart/form-data file=image
router.post('/image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });

    // Stream upload to Cloudinary
    const bufferStream = streamifier.createReadStream(req.file.buffer);

    const streamUpload = (stream) => new Promise((resolve, reject) => {
      const streamHandler = cloudinary.uploader.upload_stream(
        { folder: process.env.CLOUDINARY_FOLDER || 'chat_images', resource_type: 'image' },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      stream.pipe(streamHandler);
    });

    const result = await streamUpload(bufferStream);

    return res.json({ success: true, url: result.secure_url, public_id: result.public_id, raw: result });
  } catch (err) {
    console.error('Error uploading image:', err);
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;
