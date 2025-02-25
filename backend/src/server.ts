import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import stripeRoutes from './routes/stripeRoutes';
import questionRoutes from './routes/questionRoutes';
import testRoutes from './routes/testRoutes';
import errorHandler from './middleware/errorHandler';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], 
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api', questionRoutes);
app.use('/api/tests', testRoutes); 

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Update user answer for a specific question
app.patch('/api/tests/questions/:questionId', async (req: Request<{ questionId: string }>, res: Response) => {
  const { questionId } = req.params; // Get the question ID from the URL
  const { userAnswer, testId } = req.body; // Get the userAnswer and testId from the request body

  try {
    const updatedQuestion = await prisma.testQuestion.updateMany({
      where: {
        questionId: questionId, // Find the question by questionId
        testId: testId // Ensure it matches the testId as well
      },
      data: {
        userAnswer: userAnswer, // Update the userAnswer field
      },
    });

    // Check if any rows were updated
    if (updatedQuestion.count === 0) {
      return res.status(404).json({ error: 'Question not found for the given testId' });
    }

    res.json({ message: 'User answer updated successfully', updatedQuestion });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

export default app;