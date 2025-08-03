const fs = require('fs');
const path = require('path');
const { query } = require('./database');
const logger = require('../utils/logger');

const migrations = [
  {
    name: 'create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `
  },
  {
    name: 'create_uploaded_files_table',
    sql: `
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        processing_status VARCHAR(50) DEFAULT 'pending',
        processing_error TEXT,
        extracted_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
      CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files(processing_status);
    `
  },
  {
    name: 'create_assignments_table',
    sql: `
      CREATE TABLE IF NOT EXISTS assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
        assignment VARCHAR(500) NOT NULL,
        due_date DATE,
        location VARCHAR(255),
        source VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
      CREATE INDEX IF NOT EXISTS idx_assignments_file_id ON assignments(file_id);
    `
  },
  {
    name: 'create_schedules_table',
    sql: `
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        location VARCHAR(255),
        recurrence_rule VARCHAR(255),
        source VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
      CREATE INDEX IF NOT EXISTS idx_schedules_file_id ON schedules(file_id);
    `
  }
];

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    for (const migration of migrations) {
      logger.info(`Running migration: ${migration.name}`);
      await query(migration.sql);
      logger.info(`Completed migration: ${migration.name}`);
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().then(() => {
    process.exit(0);
  });
}

module.exports = { runMigrations };