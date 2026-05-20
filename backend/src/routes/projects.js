import { Router } from 'express';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// POST /api/projects — create a new project (client only)
router.post('/', requireAuth, requireRole(ROLES.CLIENT), async (req, res) => {
  const { title, description, totalBudget, milestones } = req.body;

  if (!title || !description || totalBudget == null)
    return res.status(400).json({ error: 'title, description, and totalBudget are required' });

  const project = await Project.create({
    clientId: req.userId,
    title,
    description,
    totalBudget,
    milestones: milestones || [],
  });

  res.status(201).json({ project });
});

// GET /api/projects — role-filtered list
// client     → own projects
// freelancer → all POSTED projects (open marketplace)
// admin      → everything
router.get('/', requireAuth, async (req, res) => {
  let filter = {};

  if (req.userRole === ROLES.CLIENT) {
    filter = { clientId: req.userId };
  } else if (req.userRole === ROLES.FREELANCER) {
    // Week 6 update: change to $or: [{state:'POSTED'}, {freelancerId:req.userId}]
    // so freelancers can also navigate back to their accepted projects
    filter = { state: 'POSTED' };
  }
  // ROLES.ADMIN: filter stays {} — sees all projects

  const projects = await Project.find(filter).sort({ createdAt: -1 });
  res.json({ projects });
});

// GET /api/projects/:id — any authenticated user can fetch a project by ID
router.get('/:id', requireAuth, async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
});

// POST /api/projects/:id/accept — freelancer claims an open project
router.post('/:id/accept', requireAuth, requireRole(ROLES.FREELANCER), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (project.state !== 'POSTED')
    return res.status(409).json({ error: 'Project is no longer available for acceptance' });

  project.freelancerId = req.userId;
  project.state        = 'ACCEPTED';
  await project.save();

  res.json({ project });
});

export default router;
