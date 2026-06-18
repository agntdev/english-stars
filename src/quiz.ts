export interface MultipleChoiceQuestion {
  type: "multiple_choice";
  text: string;
  options: string[];
  correct: number;
}

export interface TypeWordQuestion {
  type: "type_word";
  text: string;
  answers: string[];
}

export type QuizQuestion = MultipleChoiceQuestion | TypeWordQuestion;

export function generateTypeWordQuiz(lessons: readonly string[]): TypeWordQuestion[] {
  const phrases = [
    { matching: "Practice", answers: ["practice", "practise"], question: "What should you do daily to improve quickly?" },
    { matching: "Small steps", answers: ["small steps", "small step"], question: "What leads to mastery?" },
    { matching: "review", answers: ["every week", "weekly"], question: "How often should you review past lessons?" },
    { matching: "Consistency", answers: ["consistency"], question: "What beats intensity every time?" },
  ];

  const questions: TypeWordQuestion[] = [];
  for (const phrase of phrases) {
    const found = lessons.some((l) =>
      l.toLowerCase().includes(phrase.matching.toLowerCase())
    );
    if (found) {
      questions.push({
        type: "type_word",
        text: phrase.question,
        answers: phrase.answers,
      });
    }
  }

  return questions;
}

export function checkTypeWordAnswer(question: TypeWordQuestion, userAnswer: string): boolean {
  const normalized = userAnswer.trim().toLowerCase();
  return question.answers.some((a) => normalized === a.toLowerCase());
}