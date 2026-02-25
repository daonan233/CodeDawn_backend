const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 获取用户公开信息
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, avatar, bio, role, created_at FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新个人信息
router.put('/profile/update', authenticate, async (req, res) => {
  const { username, bio, avatar } = req.body;
  try {
    if (username) {
      const exists = await pool.query('SELECT id FROM users WHERE username=$1 AND id!=$2', [username, req.user.id]);
      if (exists.rows.length > 0) return res.status(400).json({ success: false, message: '用户名已被占用' });
    }
    const result = await pool.query(
      `UPDATE users SET 
        username = COALESCE($1, username),
        bio = COALESCE($2, bio),
        avatar = COALESCE($3, avatar),
        updated_at = NOW()
      WHERE id=$4
      RETURNING id, username, email, role, avatar, bio`,
      [username || null, bio !== undefined ? bio : null, avatar || null, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 修改密码
router.put('/password/change', authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: '新密码至少6位' });
  }
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: '原密码错误' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true, message: '密码修改成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取用户的帖子列表
router.get('/:id/posts', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const total = await pool.query('SELECT COUNT(*) FROM posts WHERE author_id=$1 AND is_deleted=false', [req.params.id]);
    const posts = await pool.query(
      `SELECT p.*, u.username, u.avatar 
       FROM posts p JOIN users u ON p.author_id=u.id 
       WHERE p.author_id=$1 AND p.is_deleted=false 
       ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ success: true, data: { posts: posts.rows, total: parseInt(total.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 管理员：获取所有用户
router.get("/admin/list", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, email, avatar, bio, role, created_at FROM users ORDER BY created_at DESC");
    res.json({ success: true, data: { users: result.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// NOTE: admin list is added above module.exports
