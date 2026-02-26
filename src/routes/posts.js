const express = require('express');
const pool = require('../db');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 标签白名单
const VALID_TAGS = ['开发', '经分', '受理', '稽核', '其他'];

// 获取帖子列表（主页）
router.get('/', optionalAuth, async (req, res) => {
  const { page = 1, limit = 15, search = '', sort = 'latest', tag = '' } = req.query;
  const offset = (page - 1) * limit;
  try {
    let whereClause = 'WHERE p.is_deleted=false';
    let params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p.title ILIKE $${params.length} OR p.content ILIKE $${params.length})`;
    }

    if (tag && VALID_TAGS.includes(tag)) {
      params.push(tag);
      whereClause += ` AND $${params.length} = ANY(p.tags)`;
    }

    const orderClause = sort === 'hot'
      ? 'ORDER BY p.like_count DESC, p.comment_count DESC'
      : 'ORDER BY p.updated_at DESC';

    const countQuery = `SELECT COUNT(*) FROM posts p ${whereClause}`;
    const dataQuery = `
      SELECT p.id, p.title, LEFT(p.content, 200) as excerpt,
             p.view_count, p.like_count, p.comment_count,
             p.tags, p.created_at, p.updated_at,
             u.id as author_id, u.username, u.avatar
      FROM posts p
      JOIN users u ON p.author_id=u.id
      ${whereClause}
      ${orderClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [totalResult, postsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, limit, offset])
    ]);

    res.json({
      success: true,
      data: {
        posts: postsResult.rows,
        total: parseInt(totalResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取帖子详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    await pool.query('UPDATE posts SET view_count=view_count+1 WHERE id=$1', [req.params.id]);

    const result = await pool.query(`
      SELECT p.*, u.id as author_id, u.username, u.avatar, u.bio as author_bio
      FROM posts p JOIN users u ON p.author_id=u.id
      WHERE p.id=$1 AND p.is_deleted=false`, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ success: false, message: '帖子不存在' });

    let liked = false;
    if (req.user) {
      const likeCheck = await pool.query(
        'SELECT id FROM post_likes WHERE post_id=$1 AND user_id=$2',
        [req.params.id, req.user.id]
      );
      liked = likeCheck.rows.length > 0;
    }

    res.json({ success: true, data: { ...result.rows[0], liked } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 创建帖子
router.post('/', authenticate, async (req, res) => {
  const { title, content, tags = [] } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: '标题和内容不能为空' });
  if (title.length > 200) return res.status(400).json({ success: false, message: '标题不能超过200字符' });

  const validatedTags = (Array.isArray(tags) ? tags : [])
    .filter(t => VALID_TAGS.includes(t));

  try {
    const result = await pool.query(
      'INSERT INTO posts (title, content, author_id, tags) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, content, req.user.id, validatedTags]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新帖子
router.put('/:id', authenticate, async (req, res) => {
  const { title, content, tags } = req.body;
  try {
    const post = await pool.query('SELECT * FROM posts WHERE id=$1 AND is_deleted=false', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ success: false, message: '帖子不存在' });
    if (post.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权操作此帖子' });
    }

    const validatedTags = tags !== undefined
      ? (Array.isArray(tags) ? tags : []).filter(t => VALID_TAGS.includes(t))
      : post.rows[0].tags;

    const result = await pool.query(
      `UPDATE posts SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        tags = $3,
        updated_at = NOW()
       WHERE id=$4 RETURNING *`,
      [title || null, content || null, validatedTags, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除帖子
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await pool.query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ success: false, message: '帖子不存在' });
    if (post.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权操作此帖子' });
    }
    await pool.query('UPDATE posts SET is_deleted=true WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: '帖子已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 点赞/取消点赞
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM post_likes WHERE post_id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      await pool.query('UPDATE posts SET like_count=like_count-1 WHERE id=$1', [req.params.id]);
      res.json({ success: true, liked: false });
    } else {
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)', [req.params.id, req.user.id]);
      await pool.query('UPDATE posts SET like_count=like_count+1 WHERE id=$1', [req.params.id]);
      const post = await pool.query('SELECT author_id FROM posts WHERE id=$1', [req.params.id]);
      if (post.rows[0] && post.rows[0].author_id !== req.user.id) {
        await pool.query(
          'INSERT INTO notifications (recipient_id, sender_id, type, post_id) VALUES ($1,$2,$3,$4)',
          [post.rows[0].author_id, req.user.id, 'like_post', req.params.id]
        );
      }
      res.json({ success: true, liked: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
