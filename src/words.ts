import { inlineButton, inlineKeyboard, menuKeyboard, type InlineKeyboardMarkup } from "./toolkit/index.js";

export interface Word {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}

const VOCABULARY: readonly Word[] = [
  {
    word: "Ephemeral",
    partOfSpeech: "adjective",
    definition: "Lasting for a very short time.",
    example: "The ephemeral beauty of cherry blossoms makes them even more precious.",
  },
  {
    word: "Ubiquitous",
    partOfSpeech: "adjective",
    definition: "Present, appearing, or found everywhere.",
    example: "Smartphones have become ubiquitous in modern society.",
  },
  {
    word: "Pragmatic",
    partOfSpeech: "adjective",
    definition: "Dealing with things sensibly and realistically, based on practical considerations.",
    example: "She took a pragmatic approach to solving the budget crisis.",
  },
  {
    word: "Verbose",
    partOfSpeech: "adjective",
    definition: "Using or expressed in more words than are needed.",
    example: "His verbose explanation put half the audience to sleep.",
  },
  {
    word: "Resilient",
    partOfSpeech: "adjective",
    definition: "Able to withstand or recover quickly from difficult conditions.",
    example: "Children are often surprisingly resilient in the face of adversity.",
  },
  {
    word: "Candid",
    partOfSpeech: "adjective",
    definition: "Truthful and straightforward; frank.",
    example: "I appreciate your candid feedback about my presentation.",
  },
];

export function getWord(index: number): Word | undefined {
  return VOCABULARY[index];
}

export function getTotalWords(): number {
  return VOCABULARY.length;
}

export function formatWordCard(word: Word, index: number, total: number): string {
  return [
    `📝 Word ${index + 1} of ${total}`,
    `\n*${word.word}*`,
    `\n_Part of speech:_ ${word.partOfSpeech}`,
    `\n_Definition:_ ${word.definition}`,
    `\n_Example:_ "${word.example}"`,
  ].join("");
}

export function wordCardKeyboard(index: number): InlineKeyboardMarkup {
  const total = VOCABULARY.length;
  const word = VOCABULARY[index];
  const navRow: Array<{ text: string; data: string }> = [];
  if (index > 0) {
    navRow.push({ text: "← Prev", data: `word:prev:${index - 1}` });
  }
  navRow.push({ text: "🔊 Play audio", data: `word:audio:${word.word}` });
  if (index < total - 1) {
    navRow.push({ text: "Next →", data: `word:next:${index + 1}` });
  }
  return menuKeyboard(navRow, navRow.length);
}

export function wordPronunciationGuide(word: string): string {
  const pronunciationGuides: Record<string, string> = {
    Ephemeral: "ih-FEM-er-ul",
    Ubiquitous: "yoo-BIK-wih-tus",
    Pragmatic: "prag-MAT-ik",
    Verbose: "ver-BOHS",
    Resilient: "rih-ZIL-yuhnt",
    Candid: "KAN-did",
  };
  const guide = pronunciationGuides[word] ?? word;
  return `🔊 Pronunciation for *${word}*: /${guide}/`;
}