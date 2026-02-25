const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 注册（仅用户名 + 密码）
router.post('/register', [
  body('username').trim().isLength({ min: 2, max: 50 }).withMessage('用户名长度为2-50字符'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

  const { username, password } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
    if (exists.rows.length > 0) return res.status(400).json({ success: false, message: '用户名已存在' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1,$2) RETURNING id, username, role, avatar, bio',
      [username, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 登录（用户名 + 密码）
router.post('/login', [
  body('username').trim().notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ success: false, message: '用户名或密码错误' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ success: false, message: '用户名或密码错误' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const { password_hash, ...userInfo } = user;
    res.json({ success: true, data: { user: userInfo, token } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
