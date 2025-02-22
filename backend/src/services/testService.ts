import { PrismaClient, TestStatus, Question } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface CreateTestOptions {
  userId: string;
  subjectFilters?: string[];
  unitFilters?: string[];
  numQuestions?: number;
}

// Custom error class to provide more context
class InsufficientQuestionsError extends Error {
  availableQuestions: number;
  passageGroups: any[];

  constructor(message: string, availableQuestions: number, passageGroups: any[]) {
    super(message);
    this.name = 'InsufficientQuestionsError';
    this.availableQuestions = availableQuestions;
    this.passageGroups = passageGroups;
  }
}

export async function createTest({
  userId, 
  subjectFilters = [], 
  unitFilters = [], 
  numQuestions = 10
}: CreateTestOptions) {
  // Construct dynamic filter based on provided subject and unit filters
  const whereCondition: any = {};

  if (subjectFilters.length > 0) {
    whereCondition.subject = { in: subjectFilters };
  }

  if (unitFilters.length > 0) {
    whereCondition.unit = { in: unitFilters };
  }

  // Fetch passage-based questions
  const passageQuestions = await prisma.question.findMany({
    where: {
      ...whereCondition,
      isPassage: false, // Questions associated with passages
      passageId: { not: null } // Ensure the question is part of a passage
    },
    include: {
      passage: true
    },
    orderBy: {
      // Ensure questions from the same passage are retrieved together
      passageId: 'asc'
    }
  });

  // Fetch standalone questions
  const standaloneQuestions = await prisma.question.findMany({
    where: {
      ...whereCondition,
      isPassage: false,
      passageId: null
    }
  });

  // Group passage questions by passage
  const passageGroups: { [key: string]: Question[] } = {};
  passageQuestions.forEach(question => {
    const groupKey = question.passageId || 'ungrouped';
    if (!passageGroups[groupKey]) {
      passageGroups[groupKey] = [];
    }
    passageGroups[groupKey].push(question);
  });

  // Convert passage groups to an array and sort by group size (descending)
  const sortedPassageGroups = Object.values(passageGroups)
    .sort((a, b) => b.length - a.length);

  // Calculate how many questions should be passage-based vs standalone
  const passageQuestionCount = Math.floor(numQuestions * 0.75);
  const standaloneQuestionCount = numQuestions - passageQuestionCount;
  const selectedQuestions: Question[] = [];

  // Select passage groups, prioritizing larger groups
  while (
    selectedQuestions.length < passageQuestionCount && 
    sortedPassageGroups.length > 0
  ) {
    // Select the first (largest) group
    const selectedGroup = sortedPassageGroups.shift();
    
    // If the group can fit entirely, add it
    if (selectedGroup && selectedQuestions.length + selectedGroup.length <= passageQuestionCount) {
      selectedQuestions.push(...selectedGroup);
    }
  }

  // Fill remaining slots with standalone questions
  const remainingSlots = numQuestions - selectedQuestions.length;
  
  if (standaloneQuestions.length > 0) {
    // Prefer standalone questions first
    selectedQuestions.push(
      ...standaloneQuestions
        .filter(q => !selectedQuestions.includes(q))
        .sort(() => 0.5 - Math.random())
        .slice(0, remainingSlots)
    );
  }

  // If not enough total questions, throw a custom error
  const totalAvailableQuestions = selectedQuestions.length;
  if (totalAvailableQuestions < numQuestions) {
    throw new InsufficientQuestionsError(
      `Not enough questions available to create a full test.`, 
      totalAvailableQuestions, 
      sortedPassageGroups
    );
  }

  // Randomize the order of passage blocks and standalone questions
  const finalSelectedQuestions: Question[] = [];
  const passageBlocks = selectedQuestions
    .filter(q => q.passageId !== null)
    .reduce((acc, q) => {
      // Use a safe string conversion for the group key
      const groupKey = q.passageId || 'ungrouped';
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(q);
      return acc;
    }, {} as Record<string, Question[]>);
  
  const standaloneQs = selectedQuestions
    .filter(q => q.passageId === null)
    .sort(() => 0.5 - Math.random());
  
  // Combine passage blocks and standalone questions
  const combinedItems = [
    ...Object.values(passageBlocks),
    ...standaloneQs
  ].sort(() => 0.5 - Math.random());
  
  // Flatten and slice to ensure exact number of questions
  combinedItems.forEach(item => {
    if (Array.isArray(item)) {
      finalSelectedQuestions.push(...item);
    } else {
      finalSelectedQuestions.push(item);
    }
  });

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
        create: finalSelectedQuestions.slice(0, numQuestions).map(question => ({
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