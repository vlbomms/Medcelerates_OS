// src/types/questionTypes.ts
export interface SubjectCount {
  subject: string | null;
  units: { 
    name: string | null; 
    questionCount: number; 
  }[];
  totalQuestionCount: number;
}

