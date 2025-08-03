const fileProcessor = require('../src/services/fileProcessor');
const fs = require('fs').promises;
const path = require('path');

describe('FileProcessor', () => {
  const testFilesDir = path.join(__dirname, 'fixtures');

  beforeAll(async () => {
    // Create test files directory
    await fs.mkdir(testFilesDir, { recursive: true });
    
    // Create a test text file
    await fs.writeFile(
      path.join(testFilesDir, 'test.txt'),
      'Assignment: Complete project proposal\nDue: 2024-01-15\nLocation: Room 101'
    );
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rmdir(testFilesDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('processText', () => {
    it('should process text files correctly', async () => {
      const filePath = path.join(testFilesDir, 'test.txt');
      const result = await fileProcessor.processText(filePath);
      
      expect(result).toContain('Assignment: Complete project proposal');
      expect(result).toContain('Due: 2024-01-15');
      expect(result).toContain('Location: Room 101');
    });
  });

  describe('cleanText', () => {
    it('should clean text properly', () => {
      const dirtyText = 'Line 1\r\n\r\nLine 2\t\tExtra spaces   \n\n\nLine 3';
      const cleaned = fileProcessor.cleanText(dirtyText);
      
      expect(cleaned).toBe('Line 1\n\nLine 2 Extra spaces\n\nLine 3');
    });

    it('should handle empty text', () => {
      expect(fileProcessor.cleanText('')).toBe('');
      expect(fileProcessor.cleanText(null)).toBe('');
      expect(fileProcessor.cleanText(undefined)).toBe('');
    });
  });

  describe('isSupported', () => {
    it('should identify supported file types', () => {
      expect(fileProcessor.isSupported('text/plain')).toBe(true);
      expect(fileProcessor.isSupported('application/pdf')).toBe(true);
      expect(fileProcessor.isSupported('image/jpeg')).toBe(true);
      expect(fileProcessor.isSupported('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    });

    it('should reject unsupported file types', () => {
      expect(fileProcessor.isSupported('video/mp4')).toBe(false);
      expect(fileProcessor.isSupported('audio/mp3')).toBe(false);
      expect(fileProcessor.isSupported('application/zip')).toBe(false);
    });
  });
});