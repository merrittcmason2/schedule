const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const logger = require('../utils/logger');

class FileProcessor {
  constructor() {
    this.supportedTypes = {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
      'application/vnd.ms-excel': 'excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
      'application/msword': 'word',
      'application/pdf': 'pdf',
      'text/plain': 'text',
      'text/markdown': 'text',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/gif': 'image'
    };
  }

  async processFile(filePath, mimeType) {
    try {
      const processorType = this.supportedTypes[mimeType];
      
      if (!processorType) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      logger.info(`Processing file with type: ${processorType}`);

      switch (processorType) {
        case 'excel':
          return await this.processExcel(filePath);
        case 'word':
          return await this.processWord(filePath);
        case 'pdf':
          return await this.processPDF(filePath);
        case 'text':
          return await this.processText(filePath);
        case 'image':
          return await this.processImage(filePath);
        default:
          throw new Error(`No processor found for type: ${processorType}`);
      }
    } catch (error) {
      logger.error(`File processing error: ${error.message}`);
      throw error;
    }
  }

  async processExcel(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      let extractedText = '';

      // Process all sheets
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        extractedText += `Sheet: ${sheetName}\n`;
        jsonData.forEach(row => {
          if (row.length > 0) {
            extractedText += row.join('\t') + '\n';
          }
        });
        extractedText += '\n';
      });

      return this.cleanText(extractedText);
    } catch (error) {
      throw new Error(`Excel processing failed: ${error.message}`);
    }
  }

  async processWord(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.messages.length > 0) {
        logger.warn('Word processing warnings:', result.messages);
      }

      return this.cleanText(result.value);
    } catch (error) {
      throw new Error(`Word processing failed: ${error.message}`);
    }
  }

  async processPDF(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      return this.cleanText(data.text);
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  async processText(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.cleanText(content);
    } catch (error) {
      throw new Error(`Text processing failed: ${error.message}`);
    }
  }

  async processImage(filePath) {
    try {
      logger.info('Starting OCR processing for image');
      
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      return this.cleanText(text);
    } catch (error) {
      throw new Error(`Image OCR processing failed: ${error.message}`);
    }
  }

  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  isSupported(mimeType) {
    return this.supportedTypes.hasOwnProperty(mimeType);
  }

  getSupportedTypes() {
    return Object.keys(this.supportedTypes);
  }
}

module.exports = new FileProcessor();