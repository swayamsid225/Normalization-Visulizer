// routes/schema.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateUser = require('../middleware/auth');

// Upload a new schema
router.post('/upload', authenticateUser, async (req, res) => {
  const { schemaName, sqlText } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO schemas (user_id, schema_name, sql_text) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, schemaName, sqlText]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading schema:', error);
    res.status(500).json({ error: 'Failed to upload schema' });
  }
});

// Get all schemas for logged-in user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM schemas WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schemas:', error);
    res.status(500).json({ error: 'Failed to fetch schemas' });
  }
});

// Delete a schema by ID (only if owned by user)
router.delete('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM schemas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ message: 'Schema deleted successfully' });
  } catch (error) {
    console.error('Error deleting schema:', error);
    res.status(500).json({ error: 'Failed to delete schema' });
  }
});

module.exports = router;
