import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.post('/posts', async (req, res) => {
  try {
    const { content, type, recipeId } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const post = await prisma.communityPost.create({
      data: {
        content: content.trim(),
        type: type || 'share',
        userId: req.user.id,
        recipeId: recipeId ? parseInt(recipeId) : null
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        recipe: true,
        _count: { select: { likes: true, comments: true } }
      }
    });

    res.json({
      ...post,
      isLiked: false,
      likesCount: 0,
      commentsCount: 0
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const { page = 1, limit = 30, type, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (type && type !== 'all') {
      where.type = type;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { content: { contains: q } },
        { user: { name: { contains: q } } },
        { recipe: { name: { contains: q } } }
      ];
    }

    const posts = await prisma.communityPost.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        recipe: true,
        likes: { where: { userId: req.user.id } },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedPosts = posts.map(p => ({
      ...p,
      isLiked: Array.isArray(p.likes) && p.likes.length > 0,
      likesCount: p._count?.likes || 0,
      commentsCount: p._count?.comments || 0
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/posts/requests/list', async (req, res) => {
  try {
    const posts = await prisma.communityPost.findMany({
      where: { type: 'request' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch request posts' });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        recipe: true,
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' }
        },
        likes: { where: { userId: req.user.id } },
        _count: { select: { likes: true, comments: true } }
      }
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });

    res.json({
      ...post,
      isLiked: Array.isArray(post.likes) && post.likes.length > 0,
      likesCount: post._count?.likes || 0,
      commentsCount: post._count?.comments || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/posts/:id/like', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: req.user.id, postId } }
    });

    let liked = false;
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.like.create({ data: { userId: req.user.id, postId } });
      liked = true;
    }

    const likesCount = await prisma.like.count({ where: { postId } });
    res.json({ message: liked ? 'Liked' : 'Unliked', liked, likes: likesCount });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

router.post('/posts/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: req.user.id,
        postId: parseInt(req.params.id)
      },
      include: { user: { select: { id: true, name: true, avatar: true } } }
    });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.get('/posts/:id/comments', async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { postId: parseInt(req.params.id) },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.delete('/comments/:id', async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const existing = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
