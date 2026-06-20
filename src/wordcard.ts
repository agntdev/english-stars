import { inlineButton, inlineKeyboard, type InlineKeyboardMarkup } from "./toolkit/index.js";

export interface WordCard {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}

export const WORD_CARDS: readonly WordCard[] = [
  {
    word: "ubiquitous",
    partOfSpeech: "adjective",
    definition: "Present, appearing, or found everywhere.",
    example: "Smartphones have become ubiquitous in modern society.",
  },
  {
    word: "persevere",
    partOfSpeech: "verb",
    definition: "To continue in a course of action despite difficulty or opposition.",
    example: "She persevered with her studies and eventually passed the exam.",
  },
  {
    word: "articulate",
    partOfSpeech: "adjective",
    definition: "Having or showing the ability to speak fluently and coherently.",
    example: "He gave an articulate presentation that impressed the entire team.",
  },
  {
    word: "resilience",
    partOfSpeech: "noun",
    definition: "The capacity to recover quickly from difficulties; toughness.",
    example: "Her resilience helped her overcome many personal challenges.",
  },
  {
    word: "meticulous",
    partOfSpeech: "adjective",
    definition: "Showing great attention to detail; very careful and precise.",
    example: "The meticulous craftsman spent hours perfecting every joint.",
  },
];

export function wordCardMessage(page: number): string {
  const card = WORD_CARDS[page];
  return (
    `📖 Word Card ${page + 1} of ${WORD_CARDS.length}\n\n` +
    `Word: ${card.word}\n` +
    `Part of speech: ${card.partOfSpeech}\n` +
    `Definition: ${card.definition}\n` +
    `Example: ${card.example}`
  );
}

export function wordCardKeyboard(page: number): InlineKeyboardMarkup {
  const total = WORD_CARDS.length;
  const row: ReturnType<typeof inlineButton>[] = [];
  if (page > 0) {
    row.push(inlineButton("← Prev", `wordcard:prev:${page - 1}`));
  }
  row.push(inlineButton("🔊 Play Audio", `wordcard:play:${page}`));
  if (page < total - 1) {
    row.push(inlineButton("Next →", `wordcard:next:${page + 1}`));
  }
  return inlineKeyboard([row]);
}