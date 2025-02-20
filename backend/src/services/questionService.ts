import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SubjectCount {
  subject: string | null;
  units: { 
    name: string | null; 
    questionCount: number; 
  }[];
  totalQuestionCount: number;
}

export async function getQuestionCounts(): Promise<SubjectCount[]> {
  try {
    // Fetch all questions
    const questions = await prisma.question.findMany({
      where: {
        isPassage: false  // Only count non-passage questions
      }
    });

    console.log('Raw Questions:', JSON.stringify(questions, null, 2));

    // Group questions by subject and unit
    const subjectCounts: SubjectCount[] = Object.values(
      questions.reduce((acc, question) => {
        // Safely access subject and unit names
        const subjectName = question.subject ?? 'Unknown Subject';
        const unitName = question.unit ?? 'Unknown Unit';

        if (!acc[subjectName]) {
          acc[subjectName] = {
            subject: subjectName,
            units: [],
            totalQuestionCount: 0
          };
        }

        const existingUnit = acc[subjectName].units.find(u => u.name === unitName);
        if (!existingUnit) {
          acc[subjectName].units.push({
            name: unitName,
            questionCount: 1
          });
        } else {
          existingUnit.questionCount++;
        }

        acc[subjectName].totalQuestionCount++;

        return acc;
      }, {} as Record<string, SubjectCount>)
    );

    console.log('Processed Subject Counts:', JSON.stringify(subjectCounts, null, 2));

    return subjectCounts;
  } catch (error) {
    console.error('Detailed Error in getQuestionCounts:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
    }

    // Rethrow the error to be handled by the route
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}