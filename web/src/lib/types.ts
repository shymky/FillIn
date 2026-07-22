export type RawSeed = {
  id: string;
  english: string;
  japanese: string;
  targetWord?: string;
  proficiency: number;
};

export type Card = {
  id: string;
  english: string;
  japanese: string;
  targetWord?: string;
  tags: string[];
  mastery: number;
  dueAt: string;
  ease: number;
  reps: number;
  lapses: number;
  createdAt: string;
  updatedAt: string;
};

export type Difficulty = "easy" | "normal" | "hard";

export type Settings = {
  clozeRate: number;
  pronunciationTolerance: number;
  ttsVoice: string;
  sttLang: string;
  ollamaModel: string;
  difficulty: Difficulty;
  listeningRepeat: 1 | 2 | 3 | 5 | 10;
  accentColor: string;
  accentColorDark: string;
  ttsRate: number;
};
