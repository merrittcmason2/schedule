const { query } = require('../config/database');

class User {
  static async findById(id) {
    const result = await query(
      'SELECT id, email, first_name, last_name, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await query(
      'SELECT id, email, password_hash, first_name, last_name, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  static async create(userData) {
    const { email, passwordHash, firstName, lastName } = userData;
    const result = await query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at',
      [email, passwordHash, firstName, lastName]
    );
    return result.rows[0];
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramCount + 1} RETURNING id, email, first_name, last_name, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  static async getStats(id) {
    const result = await query(`
      SELECT 
        (SELECT COUNT(*) FROM uploaded_files WHERE user_id = $1) as total_files,
        (SELECT COUNT(*) FROM assignments WHERE user_id = $1) as total_assignments,
        (SELECT COUNT(*) FROM assignments WHERE user_id = $1 AND due_date >= CURRENT_DATE) as upcoming_assignments
    `, [id]);
    
    return result.rows[0];
  }
}

module.exports = User;