const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateUUID, validateAssignmentQuery } = require('../middleware/validation');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get user's assignments with pagination and filtering
router.get('/:userId', authenticateToken, validateAssignmentQuery, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, startDate, endDate, search } = req.query;

    // Verify user can access these assignments
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE a.user_id = $1';
    let queryParams = [userId];
    let paramCount = 1;

    // Add date filtering
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

    // Add search filtering
    if (search) {
      paramCount++;
      whereClause += ` AND (a.assignment ILIKE $${paramCount} OR a.location ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM assignments a
      ${whereClause}
    `;
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get assignments with pagination
    const assignmentsQuery = `
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
        a.due_date ASC,
        a.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);
    const result = await query(assignmentsQuery, queryParams);

    const assignments = result.rows.map(row => ({
      id: row.id,
      assignment: row.assignment,
      dueDate: row.due_date,
      location: row.location,
      source: row.source,
      fileName: row.file_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      assignments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to get assignments' });
  }
});

// Get single assignment
router.get('/assignment/:id', authenticateToken, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
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
      WHERE a.id = $1 AND a.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = result.rows[0];
    res.json({
      id: assignment.id,
      assignment: assignment.assignment,
      dueDate: assignment.due_date,
      location: assignment.location,
      source: assignment.source,
      fileName: assignment.file_name,
      createdAt: assignment.created_at,
      updatedAt: assignment.updated_at
    });

  } catch (error) {
    logger.error('Get assignment error:', error);
    res.status(500).json({ error: 'Failed to get assignment' });
  }
});

// Delete assignment
router.delete('/:id', authenticateToken, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM assignments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    logger.info(`Assignment ${id} deleted by user ${req.user.id}`);
    res.json({ message: 'Assignment deleted successfully' });

  } catch (error) {
    logger.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// Get assignments summary/stats
router.get('/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user can access these stats
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_assignments,
        COUNT(CASE WHEN due_date IS NOT NULL THEN 1 END) as assignments_with_due_date,
        COUNT(CASE WHEN due_date >= CURRENT_DATE THEN 1 END) as upcoming_assignments,
        COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue_assignments,
        COUNT(CASE WHEN due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as due_this_week
      FROM assignments 
      WHERE user_id = $1
    `;

    const result = await query(statsQuery, [userId]);
    const stats = result.rows[0];

    res.json({
      totalAssignments: parseInt(stats.total_assignments),
      assignmentsWithDueDate: parseInt(stats.assignments_with_due_date),
      upcomingAssignments: parseInt(stats.upcoming_assignments),
      overdueAssignments: parseInt(stats.overdue_assignments),
      dueThisWeek: parseInt(stats.due_this_week)
    });

  } catch (error) {
    logger.error('Get assignment stats error:', error);
    res.status(500).json({ error: 'Failed to get assignment statistics' });
  }
});

module.exports = router;