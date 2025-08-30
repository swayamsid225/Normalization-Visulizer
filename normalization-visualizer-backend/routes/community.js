const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateUser = require('../middleware/auth');

// GET all community posts
router.get('/posts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM community_posts ORDER BY created_at DESC');

    const posts = result.rows.map(post => {
      let parsed = {};
      try {
        parsed = JSON.parse(post.content);
      } catch (e) {
        parsed = { schema: '', fds: '', optimizations: [] };
      }
      return {
        id: post.id,
        user_id: post.user_id,
        author: post.author,
        title: post.title,
        created_at: post.created_at,
        schema: parsed.schema || '',
        fds: parsed.fds || '',
        optimizations: parsed.optimizations || []
      };
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching community posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST a new community post
router.post('/post', authenticateUser, async (req, res) => {
  const { title, schema, fds, optimizations } = req.body;
  if (!title || !schema) {
    return res.status(400).json({ error: 'title and schema required' });
  }

  const contentJson = JSON.stringify({
    schema,
    fds,
    optimizations: optimizations || []
  });

  try {
    const result = await pool.query(
      `INSERT INTO community_posts (user_id, author, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, req.user.name || 'Anonymous', title, contentJson]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating community post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

module.exports = router;
