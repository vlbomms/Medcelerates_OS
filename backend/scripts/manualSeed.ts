// scripts/manualSeed.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function seedQuestionsManually(questionsRootDir: string) {
  console.log(`Starting manual seeding from directory: ${questionsRootDir}`);

  // Iterate through subject folders
  const subjectFolders = fs.readdirSync(questionsRootDir)
    .filter(f => fs.statSync(path.join(questionsRootDir, f)).isDirectory());

  for (const subject of subjectFolders) {
    const subjectPath = path.join(questionsRootDir, subject);
    
    // Iterate through unit folders within each subject
    const unitFolders = fs.readdirSync(subjectPath)
      .filter(f => fs.statSync(path.join(subjectPath, f)).isDirectory());

    for (const unit of unitFolders) {
      const unitPath = path.join(subjectPath, unit);
      
      // Iterate through question folders within each unit
      const questionFolders = fs.readdirSync(unitPath)
        .filter(f => fs.statSync(path.join(unitPath, f)).isDirectory());

      for (const questionFolder of questionFolders) {
        const questionPath = path.join(unitPath, questionFolder);
        
        try {
          if (questionFolder.startsWith('P')) {
            // Passage-based question
            await seedPassageQuestion(questionPath, subject, unit);
          } else if (questionFolder.startsWith('S')) {
            // Standalone question
            await seedStandaloneQuestion(questionPath, subject, unit);
          }
        } catch (error) {
          console.error(`Error seeding question ${questionFolder}:`, error);
        }
      }
    }
  }
}

async function seedPassageQuestion(questionPath: string, subject: string, unit: string) {
  const passageHtmlPath = path.join(questionPath, 'passage.html');

  if (!fs.existsSync(passageHtmlPath)) {
    console.warn(`No passage.html found in ${questionPath}`);
    return;
  }

  const passageHtml = fs.readFileSync(passageHtmlPath, 'utf8');

  // Create passage question, even if passageHtml is empty
  const passageQuestion = await prisma.question.upsert({
    where: { id: path.basename(questionPath) },
    update: {
      subject,
      unit,
      isPassage: true,
      passageHtml,  // Store the HTML, even if it's empty
      answerChoicesHtml: null,
      explanationHtml: null,
      questionHtml: null
    },
    create: {
      id: path.basename(questionPath),
      subject,
      unit,
      isPassage: true,
      passageHtml,
      answerChoicesHtml: null,
      explanationHtml: null,
      questionHtml: null
    }
  });

  console.log(`Seeded passage question: ${passageQuestion.id}`);

  // Seed sub-questions for this passage
  const subQuestionFiles = fs.readdirSync(questionPath)
    .filter(f => 
      f.startsWith('Q') && 
      f.endsWith('.html') && 
      !f.includes('_ans') && 
      !f.includes('_exp')
    );

  for (const subQuestionFile of subQuestionFiles) {
    const questionId = path.basename(subQuestionFile, '.html');
    const questionHtml = fs.readFileSync(path.join(questionPath, subQuestionFile), 'utf8');
    
    const answerHtmlPath = path.join(questionPath, `${questionId}_ans.html`);
    const explanationHtmlPath = path.join(questionPath, `${questionId}_exp.html`);
    
    const answerChoicesHtml = fs.existsSync(answerHtmlPath) 
      ? fs.readFileSync(answerHtmlPath, 'utf8') 
      : '';
    const explanationHtml = fs.existsSync(explanationHtmlPath) 
      ? fs.readFileSync(explanationHtmlPath, 'utf8') 
      : '';

    await prisma.question.upsert({
      where: { id: questionId },
      update: {
        subject,
        unit,
        isPassage: false,
        passageId: passageQuestion.id,
        questionHtml,
        answerChoicesHtml,
        explanationHtml
      },
      create: {
        id: questionId,
        subject,
        unit,
        isPassage: false,
        passageId: passageQuestion.id,
        questionHtml,
        answerChoicesHtml,
        explanationHtml
      }
    });

    console.log(`Seeded sub-question: ${questionId}`);
  }
}

async function seedStandaloneQuestion(questionPath: string, subject: string, unit: string) {
  const questionFiles = fs.readdirSync(questionPath)
    .filter(f => 
      f.startsWith('Q') && 
      f.endsWith('.html') && 
      !f.includes('_ans') && 
      !f.includes('_exp')
    );

  for (const questionFile of questionFiles) {
    const questionId = path.basename(questionFile, '.html');
    const questionHtml = fs.readFileSync(path.join(questionPath, questionFile), 'utf8');
    
    const answerHtmlPath = path.join(questionPath, `${questionId}_ans.html`);
    const explanationHtmlPath = path.join(questionPath, `${questionId}_exp.html`);
    
    const answerChoicesHtml = fs.existsSync(answerHtmlPath) 
      ? fs.readFileSync(answerHtmlPath, 'utf8') 
      : '';
    const explanationHtml = fs.existsSync(explanationHtmlPath) 
      ? fs.readFileSync(explanationHtmlPath, 'utf8') 
      : '';

    await prisma.question.upsert({
      where: { id: questionId },
      update: {
        subject,
        unit,
        isPassage: false,
        questionHtml,
        answerChoicesHtml,
        explanationHtml
      },
      create: {
        id: questionId,
        subject,
        unit,
        isPassage: false,
        questionHtml,
        answerChoicesHtml,
        explanationHtml
      }
    });

    console.log(`Seeded standalone question: ${questionId}`);
  }
}

async function main() {
  const questionsRootDir = path.join(__dirname, '..', 'questions');
  
  try {
    // First, delete all test questions
    await prisma.testQuestion.deleteMany();
    
    // Then delete all tests
    await prisma.test.deleteMany();
    
    // Then delete all questions
    await prisma.question.deleteMany();
    
    // Seed questions
    await seedQuestionsManually(questionsRootDir);
    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();