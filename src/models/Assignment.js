const { query } = require('../config/database');

class Assignment {
  static async findById(id, userId = null) {
    let queryText = `
      SELECT 
        a.id,
        a.user_id,
        a.file_id,
        a.assignment,
        a.due_date,
        a.location,
        a.source,
        a.created_at,
        a.updated_at,
        uf.original_name as file_name
      FROM assignments a
      LEFT JOIN uploaded_files uf ON a.file_id = uf.id
      WHERE a.id = $1
    `;
    
    const params = [id];
    
    if (userId) {
      queryText += ' AND a.user_id = $2';
      params.push(userId);
    }

    const result = await query(queryText, params);
    return result.rows[0] || null;
  }

  static async findByUserId(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      search,
      sortBy = 'due_date',
      sortOrder = 'ASC'
    } = options;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE a.user_id = $1';
    let queryParams = [userId];
    let paramCount = 1;

    // Add filters
    if (startDate) {
      paramCount++;
      whereClause += ` AND a.due_date >= $${paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND a.due_date <= $${paramCount}`;
      queryParams.push(endDate);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (a.assignment ILIKE $${paramCount} OR a.location ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    const queryText = `
      SELECT 
        a.id,
        a.assignment,
        a.due_date,
        a.location,
        a.source,
        a.created_at,
        a.updated_at,
        uf.original_name as file_name
      FROM assignments a
      LEFT JOIN uploaded_files uf ON a.file_id = uf.id
      ${whereClause}
      ORDER BY 
        CASE WHEN a.due_date IS NULL THEN 1 ELSE 0 END,
        a.${sortBy} ${sortOrder},
        a.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);
    const result = await query(queryText, queryParams);
    return result.rows;
  }

  static async create(assignmentData) {
    const {
      userId,
      fileId,
      assignment,
      dueDate,
      location,
      source
    } = assignmentData;

    const result = await query(
      'INSERT INTO assignments (user_id, file_id, assignment, due_date, location, source) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, fileId, assignment, dueDate, location, source]
    );

    return result.rows[0];
  }

  static async update(id, userId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['assignment', 'due_date', 'location', 'source'];
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id, userId);
    const result = await query(
      `UPDATE assignments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramCount + 1} AND user_id = $${paramCount + 2} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async delete(id, userId) {
    const result = await query(
      'DELETE FROM assignments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rows.length > 0;
  }

  static async getUpcoming(userId, days = 7) {
    const result = await query(`
      SELECT 
        a.id,
        a.assignment,
        a.due_date,
        a.location,
        a.source,
        uf.original_name as file_name
      FROM assignments a
      LEFT JOIN uploaded_files uf ON a.file_id = uf.id
      WHERE a.user_id = $1 
        AND a.due_date >= CURRENT_DATE 
        AND a.due_date <= CURRENT_DATE + INTERVAL '${days} days'
      ORDER BY a.due_date ASC
    `, [userId]);

    return result.rows;
  }

  static async getOverdue(userId) {
    const result = await query(`
      SELECT 
        a.id,
        a.assignment,
        a.due_date,
        a.location,
        a.source,
        uf.original_name as file_name
      FROM assignments a
      LEFT JOIN uploaded_files uf ON a.file_id = uf.id
      WHERE a.user_id = $1 AND a.due_date < CURRENT_DATE
      ORDER BY a.due_date DESC
    `, [userId]);

    return result.rows;
  }

  static async getStats(userId) {
    const result = await query(`
      SELECT 
        COUNT(*) as total_assignments,
        COUNT(CASE WHEN due_date IS NOT NULL THEN 1 END) as assignments_with_due_date,
        COUNT(CASE WHEN due_date >= CURRENT_DATE THEN 1 END) as upcoming_assignments,
        COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue_assignments,
        COUNT(CASE WHEN due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as due_this_week
      FROM assignments 
      WHERE user_id = $1
    `, [userId]);

    return result.rows[0];
  }
}

module.exports = Assignment;