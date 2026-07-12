const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return res.json();
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return res.json();
  },

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return res.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return res.json();
  },
};

// Quiz API
export const quizAPI = {
  generate: (listId: number, difficulty?: string) =>
    api.post("/api/quiz/generate", { list_id: listId, difficulty }),

  evaluate: (userAnswer: string, target: string, sentenceId: number, context?: string) =>
    api.post("/api/quiz/evaluate", {
      user_answer: userAnswer,
      target,
      sentence_id: sentenceId,
      context,
    }),
};

// Vocabulary API
export const vocabAPI = {
  list: (theme?: string, page?: number) =>
    api.get(`/api/vocab/list?theme=${theme || ""}&page=${page || 1}`),

  create: (englishPhrase: string, japaneseMeaning: string, targetWord: string) =>
    api.post("/api/vocab/create", {
      english_phrase: englishPhrase,
      japanese_meaning: japaneseMeaning,
      target_word: targetWord,
    }),

  update: (id: number, englishPhrase: string, japaneseMeaning: string, targetWord: string) =>
    api.put(`/api/vocab/${id}`, {
      english_phrase: englishPhrase,
      japanese_meaning: japaneseMeaning,
      target_word: targetWord,
    }),

  delete: (id: number) => api.delete(`/api/vocab/${id}`),

  generate: (theme: string, count?: number) =>
    api.post("/api/vocab/generate", { theme, count }),

  analyze: (theme: string, count?: number) =>
    api.post("/api/vocab/analyze", { theme, count }),
};

// LLM API
export const llmAPI = {
  generateVocab: (theme: string, count?: number) =>
    api.post("/api/llm/generate-vocab", { theme, count }),

  filterByTheme: (vocabList: unknown[], theme: string) =>
    api.post("/api/llm/filter-by-theme", { vocab_list: vocabList, theme }),
};
