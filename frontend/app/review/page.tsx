"use client";

import { useState } from "react";

interface ReviewItem {
  id: number;
  sentence: string;
  japanese: string;
  correct: number;
  incorrect: number;
  lastReviewed: string;
  nextReview: string;
}

export default function ReviewPage() {
  const [reviewItems] = useState<ReviewItem[]>([
    {
      id: 1,
      sentence: "I would like to order the salad instead.",
      japanese: "代わりにサラダを注文したいのですが。",
      correct: 5,
      incorrect: 2,
      lastReviewed: "2026-07-11",
      nextReview: "2026-07-14",
    },
    {
      id: 2,
      sentence: "Could you clarify that point?",
      japanese: "その点について明確にしていただけますか？",
      correct: 3,
      incorrect: 1,
      lastReviewed: "2026-07-10",
      nextReview: "2026-07-13",
    },
  ]);

  const [filterDifficulty, setFilterDifficulty] = useState("all");

  const calculateAccuracy = (item: ReviewItem) => {
    const total = item.correct + item.incorrect;
    return total === 0 ? 0 : Math.round((item.correct / total) * 100);
  };

  const filteredItems = reviewItems.filter((item) => {
    if (filterDifficulty === "easy") return calculateAccuracy(item) >= 80;
    if (filterDifficulty === "hard") return calculateAccuracy(item) < 60;
    return true;
  });

  const stats = {
    total: reviewItems.length,
    accuracy: Math.round(
      reviewItems.reduce((acc, item) => acc + calculateAccuracy(item), 0) /
        reviewItems.length
    ),
    dueToday: reviewItems.filter((i) => i.nextReview <= "2026-07-12").length,
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">📖 Review & Statistics</h1>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card bg-blue-50">
            <p className="text-gray-600 text-sm">Total Sentences</p>
            <p className="text-4xl font-bold text-blue-600">{stats.total}</p>
          </div>

          <div className="card bg-green-50">
            <p className="text-gray-600 text-sm">Overall Accuracy</p>
            <p className="text-4xl font-bold text-green-600">{stats.accuracy}%</p>
          </div>

          <div className="card bg-orange-50">
            <p className="text-gray-600 text-sm">Due Today</p>
            <p className="text-4xl font-bold text-orange-600">
              {stats.dueToday}
            </p>
          </div>
        </div>

        {/* Filter Section */}
        <div className="card mb-8">
          <h2 className="text-lg font-bold mb-4">Filter by Difficulty</h2>
          <div className="flex gap-2">
            {["all", "easy", "hard"].map((level) => (
              <button
                key={level}
                onClick={() => setFilterDifficulty(level)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterDifficulty === level
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {level === "all" ? "All" : level === "easy" ? "Mastered" : "Challenging"}
              </button>
            ))}
          </div>
        </div>

        {/* Review Items Table */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">
            Review Items ({filteredItems.length})
          </h2>

          {filteredItems.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">
              No items in this category.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">English</th>
                    <th className="px-4 py-3 font-semibold">Japanese</th>
                    <th className="px-4 py-3 font-semibold">Accuracy</th>
                    <th className="px-4 py-3 font-semibold">Last Review</th>
                    <th className="px-4 py-3 font-semibold">Next Review</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const accuracy = calculateAccuracy(item);
                    const isOverdue =
                      item.nextReview <= "2026-07-12";

                    return (
                      <tr
                        key={item.id}
                        className={`border-b hover:bg-gray-50 ${
                          isOverdue ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">{item.sentence}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.japanese}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  accuracy >= 80
                                    ? "bg-green-500"
                                    : accuracy >= 60
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${accuracy}%` }}
                              />
                            </div>
                            <span className="font-bold text-sm">
                              {accuracy}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.lastReviewed}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isOverdue
                                ? "bg-red-200 text-red-800"
                                : "bg-green-200 text-green-800"
                            }`}
                          >
                            {item.nextReview}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-blue-600 hover:underline font-medium">
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Learning Insights */}
        <div className="card mt-8 bg-blue-50">
          <h2 className="text-xl font-bold mb-4">💡 Learning Insights</h2>
          <div className="space-y-2 text-gray-700">
            <p>
              • You have <strong>{stats.dueToday}</strong> sentences scheduled for review today.
            </p>
            <p>
              • Your average accuracy is <strong>{stats.accuracy}%</strong>. Keep
              practicing!
            </p>
            <p>
              • Review sessions help reinforce learning through spaced repetition.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
