import fs from 'fs-extra';
import path from 'path';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';

// Subjects and Units Structure
const subjectsData = {
  "Behavioral Sciences": {
    totalQuestions: 289,
    units: {
      "Sensation, Perception, and Consciousness": 50,
      "Learning, Memory, and Cognition": 79,
      "Motivation, Emotion, Attitudes, Personality, and Stress": 33,
      "Identity and Social Interaction": 72,
      "Demographics and Social Structure": 55
    }
  },
  "Biochemistry": {
    totalQuestions: 532,
    units: {
      "Amino Acids and Proteins": 187,
      "Enzymes": 114,
      "Carbohydrates, Nucleotides, and Lipids": 84,
      "Metabolic Reactions": 141,
      "Biochemistry Lab Techniques": 6
    }
  },
  "Biology": {
    totalQuestions: 526,
    units: {
      "Molecular Biology": 71,
      "Cellular Biology": 63,
      "Genetics and Evolution": 62,
      "Reproduction": 50,
      "Endocrine and Nervous Systems": 89,
      "Circulation and Respiration": 49,
      "Digestion and Excretion": 57,
      "Musculoskeletal System": 44,
      "Skin and Immune Systems": 41
    }
  },
  "Critical Analysis & Reasoning Skills": {
    totalQuestions: 470,
    units: {
      "Humanities": 274,
      "Social Sciences": 196
    }
  },
  "General Chemistry": {
    totalQuestions: 474,
    units: {
      "Atomic Theory and Chemical Composition": 118,
      "Interactions of Chemical Substances": 104,
      "Thermodynamics, Kinetics & Gas Laws": 121,
      "Solutions and Electrochemistry": 131
    }
  },
  "Organic Chemistry": {
    totalQuestions: 315,
    units: {
      "Introduction to Organic Chemistry": 79,
      "Functional Groups and Their Reactions": 158,
      "Separation Techniques, Spectroscopy, and Analytical Methods": 78
    }
  },
  "Physics": {
    totalQuestions: 394,
    units: {
      "Mechanics and Energy": 99,
      "Fluids": 90,
      "Electrostatics and Circuits": 82,
      "Light and Sound": 106,
      "Thermodynamics": 17
    }
  }
};

// Define the type for the scientific branches object
type ScientificBranchesMap = {
  [key in keyof typeof subjectsData]: string[];
};

// Update the scientific branches mapping
const scientificBranchesBySubject: ScientificBranchesMap = {
  "Behavioral Sciences": [
    "Cognitive Psychology",
    "Social Psychology",
    "Neuropsychology",
    "Developmental Psychology",
    "Behavioral Neuroscience"
  ],
  "Biochemistry": [
    "Molecular Biochemistry",
    "Protein Chemistry",
    "Metabolic Biochemistry",
    "Enzymology",
    "Cellular Biochemistry"
  ],
  "Biology": [
    "Molecular Biology",
    "Cell Biology",
    "Genetics",
    "Evolutionary Biology",
    "Physiology"
  ],
  "Critical Analysis & Reasoning Skills": [
    "Philosophical Analysis",
    "Literary Criticism",
    "Historical Interpretation",
    "Sociological Analysis",
    "Comparative Studies"
  ],
  "General Chemistry": [
    "Inorganic Chemistry",
    "Physical Chemistry",
    "Analytical Chemistry",
    "Chemical Thermodynamics",
    "Electrochemistry"
  ],
  "Organic Chemistry": [
    "Synthetic Organic Chemistry",
    "Medicinal Chemistry",
    "Polymer Chemistry",
    "Organic Spectroscopy",
    "Organic Reaction Mechanisms"
  ],
  "Physics": [
    "Classical Mechanics",
    "Quantum Physics",
    "Thermodynamics",
    "Electromagnetism",
    "Optics"
  ]
};

// Generate a unique ID with a specified prefix
function generateUID(prefix: string): string {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`;
}

// Function to get a scientific branch for a specific subject
function getScientificBranch(subject: keyof typeof subjectsData): string {
  const branches = scientificBranchesBySubject[subject] || 
    ["General Science", "Research Study", "Scientific Exploration"];
  
  return faker.helpers.arrayElement(branches);
}

// Function to generate a passage
function generatePassage(subject: keyof typeof subjectsData): string {
  const branch = getScientificBranch(subject);
  
  return `
    <div class="passage">
      <h3>${branch} Research Passage</h3>
      <p>${faker.lorem.paragraphs(3)}</p>
      <p>${faker.lorem.paragraphs(2)}</p>
      <footer>
        <cite>Source: Hypothetical ${branch} Study</cite>
      </footer>
    </div>
  `;
}

// Function to generate a multiple-choice question
function generateMultipleChoiceQuestion(subject: keyof typeof subjectsData, unit: string): { 
  questionUID: string, 
  questionHTML: string, 
  answerHTML: string, 
  explanationHTML: string 
} {
  const questionUID = generateUID('S');
  const correctAnswerIndex = faker.number.int({ min: 0, max: 3 });
  const options = [
    faker.lorem.word(),
    faker.lorem.word(),
    faker.lorem.word(),
    faker.lorem.word()
  ];
  
  const questionHTML = `
    <div class="question multiple-choice" data-subject="${subject}" data-unit="${unit}">
      <p class="question-text">${faker.lorem.sentence()}?</p>
      <div class="options">
        ${options.map((option, index) => `
          <label>
            <input type="radio" name="q${questionUID}" value="${index}" ${index === correctAnswerIndex ? 'data-correct="true"' : ''} />
            ${option}
          </label>
        `).join('\n')}
      </div>
    </div>
  `;

  const answerHTML = `
    <div class="answer">
      <p>Correct Answer: ${options[correctAnswerIndex]}</p>
    </div>
  `;

  const explanationHTML = `
    <div class="explanation">
      <p>${faker.lorem.paragraph()}</p>
      <p>Detailed explanation of why ${options[correctAnswerIndex]} is the correct answer.</p>
    </div>
  `;

  return { questionUID, questionHTML, answerHTML, explanationHTML };
}

// Function to generate a passage-based question
function generatePassageBasedQuestion(subject: keyof typeof subjectsData, unit: string, passageUID: string): { 
  questionUID: string, 
  questionHTML: string, 
  answerHTML: string, 
  explanationHTML: string 
} {
  const questionUID = generateUID('P');
  const correctAnswerIndex = faker.number.int({ min: 0, max: 3 });
  const options = [
    faker.lorem.word(),
    faker.lorem.word(),
    faker.lorem.word(),
    faker.lorem.word()
  ];
  
  const questionHTML = `
    <div class="passage-based-question" data-passage-uid="${passageUID}" data-subject="${subject}" data-unit="${unit}">
      <p class="question-text">${faker.lorem.sentence()}?</p>
      <div class="options">
        ${options.map((option, index) => `
          <label>
            <input type="radio" name="q${questionUID}" value="${index}" ${index === correctAnswerIndex ? 'data-correct="true"' : ''} />
            ${option}
          </label>
        `).join('\n')}
      </div>
    </div>
  `;

  const answerHTML = `
    <div class="answer">
      <p>Correct Answer: ${options[correctAnswerIndex]}</p>
    </div>
  `;

  const explanationHTML = `
    <div class="explanation">
      <p>${faker.lorem.paragraph()}</p>
      <p>Detailed explanation of why ${options[correctAnswerIndex]} is the correct answer based on the passage.</p>
    </div>
  `;

  return { questionUID, questionHTML, answerHTML, explanationHTML };
}

// Main function to generate questions
function generateQuestions() {
  const baseDir = path.join(__dirname, 'questions');
  fs.ensureDirSync(baseDir);

  console.log(`Starting question generation in: ${baseDir}`);

  let totalQuestionsGenerated = 0;

  Object.entries(subjectsData).forEach(([subject, subjectData]) => {
    // Type assertion to ensure correct type
    const typedSubject = subject as keyof typeof subjectsData;
    
    console.log(`Generating questions for subject: ${subject}`);
    const subjectDir = path.join(baseDir, subject.replace(/\s+/g, '_'));
    fs.ensureDirSync(subjectDir);

    Object.entries(subjectData.units).forEach(([unit, questionCount]) => {
      console.log(`  Generating questions for unit: ${unit} (${questionCount} questions)`);
      const unitDir = path.join(subjectDir, unit.replace(/\s+/g, '_'));
      fs.ensureDirSync(unitDir);

      // Track generated passages for passage-based questions
      const generatedPassages: { [key: string]: string } = {};

      for (let i = 1; i <= questionCount; i++) {
        const questionType = Math.random() > 0.5 ? 'multiple-choice' : 'passage-based';

        if (questionType === 'multiple-choice') {
          // Generate standalone multiple-choice question
          const { questionUID, questionHTML, answerHTML, explanationHTML } = 
            generateMultipleChoiceQuestion(typedSubject, unit);
          
          const questionDir = path.join(unitDir, questionUID);
          fs.ensureDirSync(questionDir);

          // Updated file names
          fs.writeFileSync(path.join(questionDir, `Q_${questionUID}_question.html`), questionHTML);
          fs.writeFileSync(path.join(questionDir, `Q_${questionUID}_answer.html`), answerHTML);
          fs.writeFileSync(path.join(questionDir, `Q_${questionUID}_explanation.html`), explanationHTML);
        } else {
          // Generate or reuse a passage
          let passageUID: string;
          let passageHTML: string;

          // Randomly decide to create a new passage or reuse an existing one
          if (Object.keys(generatedPassages).length === 0 || Math.random() > 0.5) {
            passageUID = generateUID('P');
            passageHTML = generatePassage(typedSubject);
            generatedPassages[passageUID] = passageHTML;
          } else {
            // Reuse an existing passage
            passageUID = Object.keys(generatedPassages)[
              faker.number.int({ min: 0, max: Object.keys(generatedPassages).length - 1 })
            ];
            passageHTML = generatedPassages[passageUID];
          }

          // Create passage directory if it doesn't exist
          const passageDir = path.join(unitDir, passageUID);
          fs.ensureDirSync(passageDir);

          // Write passage HTML
          fs.writeFileSync(path.join(passageDir, `passage.html`), passageHTML);

          // Generate passage-based question
          const { questionUID, questionHTML, answerHTML, explanationHTML } = 
            generatePassageBasedQuestion(typedSubject, unit, passageUID);

          // Write question-specific files with Q_ prefix
          fs.writeFileSync(path.join(passageDir, `Q_${questionUID}_question.html`), questionHTML);
          fs.writeFileSync(path.join(passageDir, `Q_${questionUID}_answer.html`), answerHTML);
          fs.writeFileSync(path.join(passageDir, `Q_${questionUID}_explanation.html`), explanationHTML);
        }
      }

      totalQuestionsGenerated += questionCount;
    });
  });

  console.log(`Question generation complete. Total questions generated: ${totalQuestionsGenerated}`);
}

// Run the generation
generateQuestions();

// Optionally, add more detailed logging
console.log('Question generation script completed.');
console.log('Generated questions will be saved in: ./questions directory');