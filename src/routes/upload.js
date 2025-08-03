const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const fileProcessor = require('../services/fileProcessor');
const openaiService = require('../services/openaiService');
const logger = require('../utils/logger');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const supportedTypes = fileProcessor.getSupportedTypes();
  
  if (supportedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files per request
  }
});

// Upload and process files
router.post('/', authenticateToken, upload.array('files', 5), async (req, res) => {
  const uploadedFiles = [];
  const errors = [];

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    logger.info(`Processing ${req.files.length} files for user ${req.user.id}`);

    for (const file of req.files) {
      try {
        // Save file record to database
        const fileRecord = await query(
          `INSERT INTO uploaded_files (user_id, original_name, file_path, file_size, mime_type, processing_status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [req.user.id, file.originalname, file.path, file.size, file.mimetype, 'processing']
        );

        const fileId = fileRecord.rows[0].id;

        // Process file in background
        processFileAsync(fileId, file.path, file.mimetype, file.originalname, req.user.id);

        uploadedFiles.push({
          id: fileId,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          status: 'processing'
        });

      } catch (error) {
        logger.error(`Error processing file ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: error.message
        });

        // Clean up file if database insert failed
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          logger.error('Failed to clean up file:', unlinkError);
        }
      }
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    logger.error('Upload error:', error);
    
    // Clean up any uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          logger.error('Failed to clean up file:', unlinkError);
        }
      }
    }

    res.status(500).json({ error: 'File upload failed' });
  }
});

// Get upload status
router.get('/status/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const result = await query(
      'SELECT id, original_name, processing_status, processing_error, created_at FROM uploaded_files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    res.json({
      id: file.id,
      originalName: file.original_name,
      status: file.processing_status,
      error: file.processing_error,
      createdAt: file.created_at
    });

  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get file status' });
  }
});

// Get user's uploaded files
router.get('/files', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, original_name, file_size, mime_type, processing_status, processing_error, created_at
       FROM uploaded_files 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const files = result.rows.map(file => ({
      id: file.id,
      originalName: file.original_name,
      size: file.file_size,
      mimeType: file.mime_type,
      status: file.processing_status,
      error: file.processing_error,
      createdAt: file.created_at
    }));

    res.json({ files });

  } catch (error) {
    logger.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Background file processing function
async function processFileAsync(fileId, filePath, mimeType, originalName, userId) {
  try {
    logger.info(`Starting background processing for file ${fileId}`);

    // Extract text from file
    const extractedText = await fileProcessor.processFile(filePath, mimeType);

    // Update file record with extracted text
    await query(
      'UPDATE uploaded_files SET extracted_text = $1, processing_status = $2, updated_at = NOW() WHERE id = $3',
      [extractedText, 'text_extracted', fileId]
    );

    // Process with OpenAI to extract schedule data
    const scheduleData = await openaiService.extractScheduleData(extractedText, originalName);

    // Save assignments to database
    for (const item of scheduleData) {
      await query(
        `INSERT INTO assignments (user_id, file_id, assignment, due_date, location, source)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, fileId, item.assignment, item.due_date, item.location, item.source]
      );
    }

    // Mark file as completed
    await query(
      'UPDATE uploaded_files SET processing_status = $1, updated_at = NOW() WHERE id = $2',
      ['completed', fileId]
    );

    logger.info(`Successfully processed file ${fileId}, extracted ${scheduleData.length} assignments`);

  } catch (error) {
    logger.error(`Background processing failed for file ${fileId}:`, error);

    // Mark file as failed
    await query(
      'UPDATE uploaded_files SET processing_status = $1, processing_error = $2, updated_at = NOW() WHERE id = $3',
      ['failed', error.message, fileId]
    );
  }
}

module.exports = router;