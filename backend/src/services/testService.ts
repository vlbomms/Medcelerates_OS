import { PrismaClient, TestStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface CreateTestOptions {
  userId: string;
  subjectFilters?: string[];
  unitFilters?: string[];
  numQuestions?: number;
}

// In /Users/vikasbommineni/test-prep-platform/backend/src/services/testService.ts
export async function createTest({
  userId, 
  subjectFilters = [], 
  unitFilters = [], 
  numQuestions = 10
}: CreateTestOptions) {
  // Construct dynamic filter based on provided subject and unit filters
  const whereCondition: any = {
    isPassage: false,
  };

  if (subjectFilters.length > 0) {
    whereCondition.subject = { in: subjectFilters };
  }

  if (unitFilters.length > 0) {
    whereCondition.unit = { in: unitFilters };
  }

  // Fetch available questions matching the filters
  const availableQuestions = await prisma.question.findMany({
    where: whereCondition,
  });

  // Check if enough questions are available
  if (availableQuestions.length < numQuestions) {
    throw new Error(`Not enough questions available. Required: ${numQuestions}, Available: ${availableQuestions.length}`);
  }

  // Randomly select questions
  const selectedQuestions = availableQuestions
    .sort(() => 0.5 - Math.random())
    .slice(0, numQuestions);

  // Create test with selected questions
  const test = await prisma.test.create({
    data: {
      userId,
      testId: uuidv4().slice(0, 8),
      status: TestStatus.IN_PROGRESS,
      totalTestDuration: 3600, // Default 1 hour
      startTime: new Date(),
      remainingSeconds: 3600,
      testQuestions: {
        create: selectedQuestions.map(question => ({
          questionId: question.id,
          userAnswer: null
        }))
      }
    }
  });

  return test;
}

export async function getTestDetails(testId: string, userId: string) {
  const test = await prisma.test.findUnique({
    where: { 
      id: testId,
      userId 
    },
    include: {
      testQuestions: {
        include: {
          question: {
            include: {
              passage: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });

  if (!test) {
    throw new Error('Test not found');
  }

  // Calculate remaining time
  let remainingSeconds = test.totalTestDuration;
  if (test.startTime && test.remainingSeconds) {
    const elapsedTime = test.pausedTime 
      ? 0 
      : Math.floor((new Date().getTime() - test.startTime.getTime()) / 1000);
    remainingSeconds = Math.max(test.remainingSeconds - elapsedTime, 0);
  }

  return {
    ...test,
    remainingSeconds
  };
}

export async function updateTestQuestionAnswer(
  testQuestionId: string, 
  userId: string, 
  userAnswer: string
) {
  // First, verify the test question belongs to the user
  const testQuestion = await prisma.testQuestion.findUnique({
    where: { id: testQuestionId },
    include: { test: true }
  });

  if (!testQuestion || testQuestion.test.userId !== userId) {
    throw new Error('Test question not found or unauthorized');
  }

  // Update the user's answer
  return prisma.testQuestion.update({
    where: { id: testQuestionId },
    data: { userAnswer }
  });
}

export async function startOrResumeTest(testId: string, userId: string) {
  const test = await prisma.test.findUnique({
    where: { 
      id: testId,
      userId 
    }
  });

  if (!test) {
    throw new Error('Test not found');
  }

  // If test hasn't started, set start time
  if (!test.startTime) {
    return prisma.test.update({
      where: { id: testId },
      data: {
        startTime: new Date(),
        remainingSeconds: test.totalTestDuration
      }
    });
  }

  // If test was paused, update pause time
  return prisma.test.update({
    where: { id: testId },
    data: {
      pausedTime: null  // Resume the test
    }
  });
}

export async function pauseTest(testId: string, userId: string, remainingSeconds: number) {
  return prisma.test.update({
    where: { 
      id: testId,
      userId 
    },
    data: {
      pausedTime: new Date(),
      remainingSeconds: remainingSeconds
    }
  });
}

export async function completeTest(testId: string, userId: string) {
  // Calculate score
  const test = await prisma.test.findUnique({
    where: { 
      id: testId,
      userId 
    },
    include: {
      testQuestions: {
        include: {
          question: true
        }
      }
    }
  });

  if (!test) {
    throw new Error('Test not found');
  }

  // Calculate score 
  const totalQuestions = test.testQuestions.length;
  const correctAnswers = test.testQuestions.filter(tq => {
    // Check if the user's answer matches the correct answer
    // Assuming the question's answerChoicesHtml contains data attributes for correct answers
    return tq.userAnswer && 
      tq.question.answerChoicesHtml?.includes(`data-correct="true" data-choice="${tq.userAnswer}"`)
  }).length;

  // Update test status and score
  const updatedTest = await prisma.test.update({
    where: { id: testId },
    data: {
      status: TestStatus.COMPLETED,
      score: Math.round((correctAnswers / totalQuestions) * 100),
      completedAt: new Date()
    },
    include: {
      testQuestions: {
        include: {
          question: true
        }
      }
    }
  });

  return updatedTest;
}

// Update getUserTests to include score
export async function getUserTests(userId: string) {
  return prisma.test.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { testQuestions: true }
      }
    }
  });
}