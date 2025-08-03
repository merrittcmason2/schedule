const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateUserUUID } = require('../middleware/validation');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get calendar data in JSON format
router.get('/:userId', authenticateToken, validateUserUUID, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, format = 'json' } = req.query;

    // Verify user can access this calendar
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

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

    // Get assignments with due dates for calendar
    const calendarQuery = `
      SELECT 
        a.id,
        a.assignment as title,
        a.due_date,
        a.location,
        a.source,
        uf.original_name as file_name
      FROM assignments a
      LEFT JOIN uploaded_files uf ON a.file_id = uf.id
      ${whereClause} AND a.due_date IS NOT NULL
      ORDER BY a.due_date ASC
    `;

    const result = await query(calendarQuery, queryParams);

    if (format === 'ical') {
      // Return iCal format
      const icalData = generateICalendar(result.rows, req.user);
      res.set({
        'Content-Type': 'text/calendar',
        'Content-Disposition': 'attachment; filename="schedule.ics"'
      });
      res.send(icalData);
    } else {
      // Return JSON format
      const events = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        date: row.due_date,
        location: row.location,
        source: row.source,
        fileName: row.file_name,
        type: 'assignment'
      }));

      res.json({ events });
    }

  } catch (error) {
    logger.error('Get calendar error:', error);
    res.status(500).json({ error: 'Failed to get calendar data' });
  }
});

// Get calendar events grouped by date
router.get('/:userId/grouped', authenticateToken, validateUserUUID, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify user can access this calendar
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let whereClause = 'WHERE a.user_id = $1 AND a.due_date IS NOT NULL';
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

    const calendarQuery = `
      SELECT 
        a.due_date,
        json_agg(
          json_build_object(
            'id', a.id,
            'title', a.assignment,
            'location', a.location,
            'source', a.source,
            'fileName', uf.original_name
          ) ORDER BY a.assignment
        ) as events
      FROM assignments a
      LEFT JOIN uploaded_files uf ON a.file_id = uf.id
      ${whereClause}
      GROUP BY a.due_date
      ORDER BY a.due_date ASC
    `;

    const result = await query(calendarQuery, queryParams);

    const groupedEvents = {};
    result.rows.forEach(row => {
      groupedEvents[row.due_date] = row.events;
    });

    res.json({ groupedEvents });

  } catch (error) {
    logger.error('Get grouped calendar error:', error);
    res.status(500).json({ error: 'Failed to get grouped calendar data' });
  }
});

// Generate iCalendar format
function generateICalendar(events, user) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Backend//Student Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${user.first_name}'s Schedule`,
    'X-WR-TIMEZONE:UTC'
  ];

  events.forEach(event => {
    const eventDate = new Date(event.due_date);
    const dateStr = eventDate.toISOString().split('T')[0].replace(/-/g, '');
    
    ical.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@schedule-backend`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
      `DTSTAMP:${timestamp}`,
      `SUMMARY:${event.title}`,
      event.location ? `LOCATION:${event.location}` : '',
      `DESCRIPTION:Source: ${event.source}${event.file_name ? ` (${event.file_name})` : ''}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  });

  ical.push('END:VCALENDAR');
  
  return ical.filter(line => line !== '').join('\r\n');
}

module.exports = router;