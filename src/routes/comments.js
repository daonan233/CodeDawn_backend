const express = require('express');
const pool = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 获取帖子评论（精选置顶，支持分页）
router.get('/post/:postId', optionalAuth, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    // 精选评论（不分页，全部显示在顶部）
    const featuredResult = await pool.query(`
      SELECT c.*, u.username, u.avatar,
             (SELECT COUNT(*) FROM comments r WHERE r.parent_id=c.id AND r.is_deleted=false) as reply_count
      FROM comments c JOIN users u ON c.author_id=u.id
      WHERE c.post_id=$1 AND c.parent_id IS NULL AND c.is_deleted=false AND c.is_featured=true
      ORDER BY c.featured_at ASC`,
      [req.params.postId]
    );

    // 普通评论总数（排除精选）
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM comments WHERE post_id=$1 AND parent_id IS NULL AND is_deleted=false AND is_featured=false',
      [req.params.postId]
    );

    // 普通评论分页
    const normalResult = await pool.query(`
      SELECT c.*, u.username, u.avatar,
             (SELECT COUNT(*) FROM comments r WHERE r.parent_id=c.id AND r.is_deleted=false) as reply_count
      FROM comments c JOIN users u ON c.author_id=u.id
      WHERE c.post_id=$1 AND c.parent_id IS NULL AND c.is_deleted=false AND c.is_featured=false
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3`,
      [req.params.postId, limit, offset]
    );

    const allTopComments = [...featuredResult.rows, ...normalResult.rows];
    const topIds = allTopComments.map(c => c.id);

    // 子评论
    let replies = [];
    if (topIds.length > 0) {
      const repliesResult = await pool.query(`
        SELECT c.*, u.username, u.avatar, ru.username as reply_to_username
        FROM comments c 
        JOIN users u ON c.author_id=u.id
        LEFT JOIN users ru ON c.reply_to_user_id=ru.id
        WHERE c.parent_id = ANY($1) AND c.is_deleted=false
        ORDER BY c.created_at ASC`,
        [topIds]
      );
      replies = repliesResult.rows;
    }

    // 用户点赞状态
    let likedCommentIds = new Set();
    if (req.user) {
      const allIds = [...topIds, ...replies.map(r => r.id)];
      if (allIds.length > 0) {
        const likes = await pool.query(
          'SELECT comment_id FROM comment_likes WHERE user_id=$1 AND comment_id=ANY($2)',
          [req.user.id, allIds]
        );
        likedCommentIds = new Set(likes.rows.map(r => r.comment_id));
      }
    }

    const buildComment = (comment) => ({
      ...comment,
      liked: likedCommentIds.has(comment.id),
      replies: replies
        .filter(r => r.parent_id === comment.id)
        .map(r => ({ ...r, liked: likedCommentIds.has(r.id) }))
    });

    res.json({
      success: true,
      data: {
        featured: featuredResult.rows.map(buildComment),
        comments: normalResult.rows.map(buildComment),
        total: parseInt(totalResult.rows[0].count),
        featuredTotal: featuredResult.rows.length,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 创建评论
router.post('/', authenticate, async (req, res) => {
  const { postId, content, parentId, replyToUserId } = req.body;
  if (!content || !content.replace(/<[^>]*>/g, '').trim()) {
    return res.status(400).json({ success: false, message: '评论内容不能为空' });
  }
  try {
    const post = await pool.query('SELECT id, author_id FROM posts WHERE id=$1 AND is_deleted=false', [postId]);
    if (!post.rows[0]) return res.status(404).json({ success: false, message: '帖子不存在' });

    const result = await pool.query(
      'INSERT INTO comments (post_id, author_id, content, parent_id, reply_to_user_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [postId, req.user.id, content, parentId || null, replyToUserId || null]
    );

    await pool.query('UPDATE posts SET comment_count=comment_count+1, updated_at=NOW() WHERE id=$1', [postId]);

    // 通知
    const notifyUserId = replyToUserId || post.rows[0].author_id;
    if (notifyUserId && notifyUserId !== req.user.id) {
      const notifType = replyToUserId ? 'comment_reply' : 'post_comment';
      await pool.query(
        'INSERT INTO notifications (recipient_id, sender_id, type, post_id, comment_id) VALUES ($1,$2,$3,$4,$5)',
        [notifyUserId, req.user.id, notifType, postId, result.rows[0].id]
      );
    }

    const comment = await pool.query(`
      SELECT c.*, u.username, u.avatar FROM comments c 
      JOIN users u ON c.author_id=u.id WHERE c.id=$1`, [result.rows[0].id]);

    res.status(201).json({ success: true, data: { ...comment.rows[0], replies: [], liked: false } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 设置/取消精选（仅帖子作者）
router.put('/:id/feature', authenticate, async (req, res) => {
  try {
    const comment = await pool.query(
      'SELECT c.*, p.author_id as post_author_id FROM comments c JOIN posts p ON c.post_id=p.id WHERE c.id=$1 AND c.is_deleted=false',
      [req.params.id]
    );
    if (!comment.rows[0]) return res.status(404).json({ success: false, message: '评论不存在' });
    
    // 只有帖子作者或管理员可以设精选
    if (comment.rows[0].post_author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只有帖子作者才能设置精选' });
    }

    // 只能对顶级评论设精选
    if (comment.rows[0].parent_id !== null) {
      return res.status(400).json({ success: false, message: '只能对顶级评论设置精选' });
    }

    const isFeatured = comment.rows[0].is_featured;
    await pool.query(
      'UPDATE comments SET is_featured=$1, featured_at=$2 WHERE id=$3',
      [!isFeatured, !isFeatured ? new Date() : null, req.params.id]
    );

    res.json({ success: true, is_featured: !isFeatured, message: !isFeatured ? '已设为精选' : '已取消精选' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除评论
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const comment = await pool.query('SELECT * FROM comments WHERE id=$1 AND is_deleted=false', [req.params.id]);
    if (!comment.rows[0]) return res.status(404).json({ success: false, message: '评论不存在' });
    if (comment.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权操作此评论' });
    }
    await pool.query('UPDATE comments SET is_deleted=true WHERE id=$1', [req.params.id]);
    await pool.query('UPDATE posts SET comment_count=GREATEST(comment_count-1,0) WHERE id=$1', [comment.rows[0].post_id]);
    res.json({ success: true, message: '评论已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 点赞评论
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      await pool.query('UPDATE comments SET like_count=like_count-1 WHERE id=$1', [req.params.id]);
      res.json({ success: true, liked: false });
    } else {
      await pool.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1,$2)', [req.params.id, req.user.id]);
      await pool.query('UPDATE comments SET like_count=like_count+1 WHERE id=$1', [req.params.id]);
      const comment = await pool.query('SELECT author_id FROM comments WHERE id=$1', [req.params.id]);
      if (comment.rows[0] && comment.rows[0].author_id !== req.user.id) {
        await pool.query(
          'INSERT INTO notifications (recipient_id, sender_id, type, comment_id) VALUES ($1,$2,$3,$4)',
          [comment.rows[0].author_id, req.user.id, 'like_comment', req.params.id]
        );
      }
      res.json({ success: true, liked: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
