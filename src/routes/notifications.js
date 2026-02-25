const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 获取通知列表
router.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20, unread } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = 'WHERE n.recipient_id=$1';
    if (unread === 'true') where += ' AND n.is_read=false';

    const total = await pool.query(`SELECT COUNT(*) FROM notifications n ${where}`, [req.user.id]);
    const unreadCount = await pool.query('SELECT COUNT(*) FROM notifications WHERE recipient_id=$1 AND is_read=false', [req.user.id]);
    
    const result = await pool.query(`
      SELECT n.*, 
             u.username as sender_username, u.avatar as sender_avatar,
             p.title as post_title
      FROM notifications n
      LEFT JOIN users u ON n.sender_id=u.id
      LEFT JOIN posts p ON n.post_id=p.id
      ${where}
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        total: parseInt(total.rows[0].count),
        unreadCount: parseInt(unreadCount.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取未读数量
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM notifications WHERE recipient_id=$1 AND is_read=false', [req.user.id]);
    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 标记已读
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE recipient_id=$1', [req.user.id]);
    res.json({ success: true, message: '已全部标记为已读' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE id=$1 AND recipient_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
