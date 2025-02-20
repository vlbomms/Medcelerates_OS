import express from 'express';
import { getQuestionCounts } from '../services/questionService';

const router = express.Router();

router.get('/question-counts', async (req, res) => {
  try {
    const subjectCounts = await getQuestionCounts();
    res.json(subjectCounts);
  } catch (error) {
    console.error('Route-level error fetching question counts:', error);
    
    // More detailed error response
    if (error instanceof Error) {
      res.status(500).json({ 
        error: 'Failed to fetch question counts',
        details: {
          message: error.message,
          name: error.name
        }
      });
    } else {
      res.status(500).json({ 
        error: 'Unknown error occurred while fetching question counts' 
      });
    }
  }
});

export default router;