const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary with env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage – files are kept as Buffer objects in memory
// before being streamed to Cloudinary
const storage = multer.memoryStorage();

// File filter: only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Multer instance: allow up to 5 images, 5 MB each
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/**
 * uploadToCloudinary
 * Wraps the Cloudinary upload_stream in a Promise so it works with async/await.
 * @param {Buffer} buffer - File buffer from Multer
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} - Secure URL of the uploaded image
 */
const uploadToCloudinary = (buffer, folder = 'car-rental') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

/**
 * deleteFromCloudinary
 * Removes an image from Cloudinary by extracting its public_id from the URL.
 * @param {string} imageUrl - Full Cloudinary secure URL
 */
const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  // Extract public_id from URL: folder/filename (without extension)
  const parts = imageUrl.split('/');
  const filenameWithExt = parts[parts.length - 1];
  const filename = filenameWithExt.split('.')[0];
  const folder = parts[parts.length - 2];
  const publicId = `${folder}/${filename}`;
  await cloudinary.uploader.destroy(publicId);
};

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary };
