import { Router } from 'express';
import { upload } from '../services/uploads/cloudinary.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// POST /api/uploads — single file, any authenticated user
// Allowed types: images, PDF, ZIP, DOCX, XLSX — max 10 MB (enforced by multer)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  res.json({
    url:          req.file.path,        // Cloudinary secure URL
    publicId:     req.file.filename,
    format:       req.file.format ?? req.file.mimetype,
    bytes:        req.file.size,
    originalName: req.file.originalname,
  });
});

export default router;
