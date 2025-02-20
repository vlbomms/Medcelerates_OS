// In /Users/vikasbommineni/test-prep-platform/backend/src/routes/testRoutes.ts
import express, { Request, Response, RequestHandler } from 'express';
import * as testService from '../services/testService';
import { authenticateToken } from '../middleware/authMiddleware';
import asyncHandler from '../middleware/asyncHandler';

const router = express.Router();

// Logging middleware to help diagnose routing issues
router.use((req, res, next) => {
  console.log(`Incoming request to test routes: ${req.method} ${req.path}`);
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  next();
});

// Create a new test
const createTestHandler: RequestHandler = asyncHandler(async (req, res) => {
  // Add a type guard to ensure user exists
  if (!req.user) {
    console.error('No user found in request');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { 
    subjects: subjectFilters = [], 
    units: unitFilters = [], 
    questionCount: numQuestions = 10 
  } = req.body;

  console.log('Create Test Request:', { 
    userId: req.user.id, 
    subjectFilters, 
    unitFilters, 
    numQuestions 
  });

  const test = await testService.createTest({
    userId: req.user.id,
    subjectFilters,
    unitFilters,
    numQuestions
  });

  res.status(201).json(test);
});

// Get test details
const getTestDetailsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const testId = req.params.testId;
  const test = await testService.getTestDetails(testId, req.user.id);
  res.json(test);
});

// Update a specific test question's answer
const updateTestQuestionHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const testQuestionId = req.params.testQuestionId;
  const { userAnswer } = req.body;

  if (!userAnswer) {
    return res.status(400).json({ message: 'User answer is required' });
  }

  const updatedTestQuestion = await testService.updateTestQuestionAnswer(
    testQuestionId, 
    req.user.id,
    userAnswer
  );

  res.json(updatedTestQuestion);
});

// Start or resume a test
const startTestHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const testId = req.params.testId;
  const test = await testService.startOrResumeTest(testId, req.user.id);
  res.json(test);
});

// Pause a test
const pauseTestHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const testId = req.params.testId;
  const { remainingSeconds } = req.body;

  if (remainingSeconds === undefined) {
    return res.status(400).json({ message: 'Remaining seconds is required' });
  }

  const test = await testService.pauseTest(testId, req.user.id, remainingSeconds);
  res.json(test);
});

// Complete a test
const completeTestHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const testId = req.params.testId;
  const test = await testService.completeTest(testId, req.user.id);
  res.json(test);
});

// Get user's tests
const getUserTestsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const tests = await testService.getUserTests(req.user.id);
  res.json(tests);
});

// Routes
router.post('/', authenticateToken, createTestHandler);
router.get('/:testId', authenticateToken, getTestDetailsHandler);
router.patch('/questions/:testQuestionId', authenticateToken, updateTestQuestionHandler);
router.post('/:testId/start', authenticateToken, startTestHandler);
router.post('/:testId/pause', authenticateToken, pauseTestHandler);
router.post('/:testId/complete', authenticateToken, completeTestHandler);
router.get('/', authenticateToken, getUserTestsHandler);

export default router;