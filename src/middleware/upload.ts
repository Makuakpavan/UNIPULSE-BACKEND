import multer from 'multer';
import path from 'path';
import { AppError } from './errorHandler';
import { RequestHandler } from 'express';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: any, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM) are allowed',
        400
      ) as any
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5, // max 5 files per upload
  },
});

export const uploadSingle: RequestHandler = upload.single('image') as unknown as RequestHandler;
export const uploadMultiple: RequestHandler = upload.array('images', 5) as unknown as RequestHandler;
