export interface VocabularyWord {
  word: string;
  definition: string;
}

export interface LessonCard {
  word: string;
  correct: string;
  options: string[];
}

const VOCABULARY: VocabularyWord[] = [
  { word: "Ephemeral", definition: "Lasting for a very short time" },
  { word: "Ubiquitous", definition: "Found everywhere; very common" },
  { word: "Pragmatic", definition: "Dealing with things in a practical way" },
  { word: "Eloquent", definition: "Fluent and persuasive in speech or writing" },
  { word: "Meticulous", definition: "Showing great attention to detail" },
  { word: "Resilient", definition: "Able to recover quickly from difficulties" },
  { word: "Benevolent", definition: "Well-meaning and kindly" },
  { word: "Candid", definition: "Truthful and straightforward; frank" },
];

const DISTRACTOR_POOL: string[] = [
  "Extremely heavy or weighty",
  "Having a harsh, unpleasant sound",
  "Unable to be corrected or improved",
  "Lacking enthusiasm or energy",
  "Excessively talkative",
  "Overly concerned with minor details",
  "Acting without careful consideration",
  "Tending to keep a firm hold of something",
  "Showing a lack of courage or confidence",
  "Inclined to lay down principles as incontrovertibly true",
];

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (i * 7 + 13) % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function buildLessonCards(): LessonCard[] {
  return VOCABULARY.map((entry) => {
    const incorrect = DISTRACTOR_POOL.filter((d) => d !== entry.definition);
    const picked = shuffleInPlace([...incorrect]).slice(0, 3);
    const options = shuffleInPlace([entry.definition, ...picked]);
    return { word: entry.word, correct: entry.definition, options };
  });
}