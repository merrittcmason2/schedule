// Test setup file
const { query } = require('../src/config/database');

// Clean up database before each test
beforeEach(async () => {
  try {
    await query('TRUNCATE TABLE assignments, uploaded_files, users RESTART IDENTITY CASCADE');
  } catch (error) {
    console.warn('Database cleanup failed:', error.message);
  }
});

// Global test timeout
jest.setTimeout(30000);