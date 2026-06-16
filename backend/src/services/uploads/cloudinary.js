import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => ({
    folder:        'flexhire-uploads',
    resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
    public_id:     `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
  }),
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    ALLOWED_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error('File type not allowed'), { status: 400 }));
  },
});

export { cloudinary };
