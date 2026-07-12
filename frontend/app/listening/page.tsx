"use client";

import { useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";

export default function ListeningPage() {
  const [repeatCount, setRepeatCount] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);

  const audioRecorder = AudioRecorder({
    onTranscript: setUserAnswer,
    isListening,
    setIsListening,
  });

  // Placeholder sentence for demo
  const sentence = "I would like to order the salad instead.";
  const japaneseTranslation = "代わりにサラダを注文したいのですが。";

  const playAudio = async () => {
    setIsPlaying(true);
    try {
      // In real implementation, call API to get audio
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Simulate playing audio multiple times
      for (let i = 0; i < repeatCount; i++) {
        console.log(`Playing audio ${i + 1}/${repeatCount}`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      setIsPlaying(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) return;

    // Simple similarity check
    const userLower = userAnswer.toLowerCase();
    const sentenceLower = sentence.toLowerCase();
    const similarity =
      userLower === sentenceLower
        ? 100
        : userLower.includes("salad") && userLower.includes("order")
          ? 75
          : 40;

    setResult({
      is_correct: similarity >= 60,
      feedback: `Match: ${similarity}%`,
      similarity,
    });
  };

  const handleRemove = () => {
    setUserAnswer("");
    setResult(null);
    audioRecorder.resetTranscript();
  };

  const handleAddToList = () => {
    alert("Added to your learning list!");
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🎧 Listening Practice</h1>

        <div className="space-y-6">
          {/* Audio Player Section */}
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">📻 Listen to the sentence:</h2>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Repeat Count: {repeatCount}x
              </label>
              <select
                value={repeatCount}
                onChange={(e) => setRepeatCount(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1 time</option>
                <option value={2}>2 times</option>
                <option value={3}>3 times</option>
                <option value={5}>5 times</option>
                <option value={10}>10 times</option>
              </select>
            </div>

            <button
              onClick={playAudio}
              disabled={isPlaying}
              className={`w-full py-3 rounded-lg font-bold text-white ${
                isPlaying
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {isPlaying ? "🔊 Playing..." : "▶ Play Audio"}
            </button>

            {/* Transcription Display */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">After listening:</p>
              <p className="text-lg font-mono">{sentence}</p>
              <p className="text-sm text-gray-500 mt-2">{japaneseTranslation}</p>
            </div>
          </div>

          {/* Voice Input Section */}
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">🎤 Your Response:</h2>

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
                  Clear
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-12">
                <p className="text-sm text-gray-600 mb-1">You said:</p>
                <p className="text-lg font-mono">
                  {userAnswer || <span className="text-gray-400">Waiting for your voice...</span>}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={submitAnswer}
                  disabled={!userAnswer.trim()}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  Submit
                </button>

                <button
                  onClick={handleAddToList}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  ➕ Add to List
                </button>

                <button
                  onClick={handleRemove}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  🗑️ Skip
                </button>
              </div>
            </div>
          </div>

          {/* Result Section */}
          {result && (
            <div
              className={`card border-2 ${
                result.is_correct
                  ? "bg-green-50 border-green-300"
                  : "bg-orange-50 border-orange-300"
              }`}
            >
              <h3
                className={`text-2xl font-bold mb-2 ${
                  result.is_correct ? "text-green-600" : "text-orange-600"
                }`}
              >
                {result.is_correct ? "✅ Great!" : "⏳ Keep trying!"}
              </h3>
              <p className="text-gray-700 mb-3">{result.feedback}</p>

              <div className="text-sm mb-4">
                <p><strong>Expected:</strong> {sentence}</p>
                <p><strong>You said:</strong> {userAnswer}</p>
              </div>

              <button
                onClick={() => {
                  handleRemove();
                  setResult(null);
                }}
                className="w-full btn-primary"
              >
                Next Sentence →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
