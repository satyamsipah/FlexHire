import { Router } from 'express';
import Review from '../models/Review.js';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// POST /api/reviews/:projectId — submit a review for a completed project
router.post('/:projectId', requireAuth, async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'rating must be between 1 and 5' });

  const project = await Project
    .findById(req.params.projectId)
    .select('clientId freelancerId state');
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.state !== 'COMPLETED')
    return res.status(409).json({ error: 'Reviews can only be left on completed projects' });

  const isClient     = project.clientId.toString() === req.userId;
  const isFreelancer = project.freelancerId?.toString() === req.userId;
  if (!isClient && !isFreelancer)
    return res.status(403).json({ error: 'You are not a party to this project' });

  const toUserId = isClient ? project.freelancerId : project.clientId;

  try {
    const review = await Review.create({
      projectId:  req.params.projectId,
      fromUserId: req.userId,
      toUserId,
      rating,
      comment: comment ?? '',
    });
    res.status(201).json({ review });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'You have already reviewed this project' });
    throw err;
  }
});

// GET /api/reviews/:projectId/mine — check if current user has already reviewed this project
router.get('/:projectId/mine', requireAuth, async (req, res) => {
  const review = await Review.findOne({
    projectId:  req.params.projectId,
    fromUserId: req.userId,
  });
  res.json({ review });
});

// GET /api/reviews/user/:userId — average rating + recent reviews for a user
router.get('/user/:userId', async (req, res) => {
  const reviews = await Review
    .find({ toUserId: req.params.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('fromUserId', 'name role');

  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  res.json({ avg, count: reviews.length, reviews });
});

export default router;
