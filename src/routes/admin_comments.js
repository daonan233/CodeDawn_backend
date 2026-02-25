const express = require('express');
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 管理员：获取所有评论
router.get('/admin/list', authenticate, requireAdmin, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const total = await pool.query('SELECT COUNT(*) FROM comments WHERE is_deleted=false');
    const comments = await pool.query(`
      SELECT c.*, u.username, u.avatar
      FROM comments c JOIN users u ON c.author_id=u.id
      WHERE c.is_deleted=false
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ success: true, data: { comments: comments.rows, total: parseInt(total.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
