"use client";

import { useState, useEffect } from "react";
import { quizAPI } from "@/lib/api";
import { AudioRecorder } from "@/components/AudioRecorder";

export default function QuizPage() {
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const audioRecorder = AudioRecorder({ onTranscript: setUserAnswer, isListening, setIsListening });

  const generateQuiz = async () => {
    setLoading(true);
    try {
      const data = await quizAPI.generate(1, difficulty);
      setQuiz(data);
      setUserAnswer("");
      setResult(null);
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      alert("Failed to load quiz. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!quiz || !userAnswer.trim()) return;

    setLoading(true);
    try {
      const data = await quizAPI.evaluate(
        userAnswer,
        quiz.sentence,
        quiz.sentence_id,
        quiz.sentence
      );
      setResult(data);
    } catch (error) {
      console.error("Failed to evaluate answer:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderMaskedSentence = () => {
    if (!quiz) return "";

    const original = quiz.sentence;
    const masked = quiz.masked_sentence;

    return (
      <div className="text-2xl font-mono leading-relaxed">
        {masked.split("").map((char: string, idx: number) => {
          const originalChar = original[idx];

          if (char === "_") {
            const isMatched = userAnswer
              .toLowerCase()
              .includes(originalChar.toLowerCase());

            return (
              <span
                key={idx}
                className={`${
                  isMatched ? "text-green-600 font-bold" : "text-gray-400"
                }`}
              >
                {char}
              </span>
            );
          }

          return <span key={idx}>{char}</span>;
        })}
      </div>
    );
  };

  const handleGiveUp = () => {
    setUserAnswer(quiz.sentence);
    submitAnswer();
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">📝 Quiz Mode</h1>

        {!quiz ? (
          <div className="card">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Difficulty Level:
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <p className="text-gray-600 mb-4">
              Practice with masked sentences using real-time voice recognition.
            </p>
            <button
              onClick={generateQuiz}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Loading..." : "Start Quiz"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card bg-blue-50">
              <h2 className="text-sm text-gray-600 mb-4 font-semibold">
                📖 Sentence (fill in the blanks):
              </h2>
              {renderMaskedSentence()}
              <p className="text-xs text-gray-400 mt-4">
                Full sentence: {quiz.sentence}
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold mb-4">🎤 Voice Recognition</h3>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={audioRecorder.startListening}
                    disabled={isListening}
                    className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                      isListening
                        ? "bg-red-500 cursor-not-allowed"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    {isListening ? "🔴 Recording..." : "🎤 Start Recording"}
                  </button>

                  <button
                    onClick={audioRecorder.stopListening}
                    disabled={!isListening}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                  >
                    Stop
                  </button>

                  <button
                    onClick={audioRecorder.resetTranscript}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                  >
                    Reset
                  </button>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">You said:</p>
                  <p className="text-lg font-mono min-h-8">
                    {userAnswer || <span className="text-gray-400">Waiting for your voice...</span>}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <label className="block text-sm font-medium mb-2">
                Or type manually:
              </label>
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                placeholder="Type the answer..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />

              <div className="flex gap-2 mt-4">
                <button
                  onClick={submitAnswer}
                  disabled={loading || !userAnswer.trim()}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {loading ? "Checking..." : "Submit Answer"}
                </button>

                <button
                  onClick={handleGiveUp}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Give Up
                </button>
              </div>
            </div>

            {result && (
              <div
                className={`card border-2 ${
                  result.is_correct
                    ? "bg-green-50 border-green-300"
                    : "bg-red-50 border-red-300"
                }`}
              >
                <h3
                  className={`text-2xl font-bold mb-2 ${
                    result.is_correct ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {result.is_correct ? "✅ Correct!" : "❌ Incorrect"}
                </h3>
                <p className="text-gray-700 mb-4">{result.feedback}</p>

                <div className="text-sm text-gray-600 mb-4">
                  <p><strong>Your answer:</strong> {userAnswer}</p>
                  <p><strong>Expected:</strong> {quiz.sentence}</p>
                </div>

                <div className="mb-4 p-3 bg-blue-100 rounded">
                  <p className="text-sm">
                    🔍 <strong>Tap word for pronunciation:</strong>{" "}
                    <a
                      href={`https://youglish.com/pronounce/${quiz.sentence.split(" ")[0]}/english/us`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Listen on YouGlish
                    </a>
                  </p>
                </div>

                <button
                  onClick={generateQuiz}
                  className="w-full btn-primary"
                >
                  Next Question →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
