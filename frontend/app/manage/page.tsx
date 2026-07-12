"use client";

import { useState } from "react";
import { vocabAPI, llmAPI } from "@/lib/api";

interface VocabItem {
  id?: number;
  english_phrase: string;
  japanese_meaning: string;
  target_word: string;
}

export default function ManagePage() {
  const [generatedItems, setGeneratedItems] = useState<VocabItem[]>([]);
  const [savedItems, setSavedItems] = useState<VocabItem[]>([]);
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<VocabItem | null>(null);

  const generateVocab = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    try {
      const data = await llmAPI.generateVocab(theme, 10);
      setGeneratedItems(data.items || []);
    } catch (error) {
      console.error("Failed to generate vocabulary:", error);
      alert("Failed to generate vocabulary. Make sure Ollama is running.");
    } finally {
      setLoading(false);
    }
  };

  const addToSaved = (item: VocabItem) => {
    setSavedItems([...savedItems, { ...item, id: Date.now() }]);
    setGeneratedItems(generatedItems.filter((i) => i !== item));
  };

  const deleteItem = (id: number | undefined) => {
    if (!id) return;
    setSavedItems(savedItems.filter((i) => i.id !== id));
  };

  const startEdit = (item: VocabItem) => {
    setEditingId(item.id || 0);
    setEditFormData({ ...item });
  };

  const saveEdit = () => {
    if (!editFormData || editingId === null) return;
    setSavedItems(
      savedItems.map((i) =>
        i.id === editingId ? editFormData : i
      )
    );
    setEditingId(null);
    setEditFormData(null);
  };

  const TableRow = ({
    item,
    isEditing,
  }: {
    item: VocabItem;
    isEditing: boolean;
  }) => {
    if (isEditing && editFormData) {
      return (
        <tr className="bg-yellow-50 border-b hover:bg-yellow-100">
          <td className="px-4 py-3">
            <input
              type="text"
              value={editFormData.english_phrase}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  english_phrase: e.target.value,
                })
              }
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-4 py-3">
            <input
              type="text"
              value={editFormData.japanese_meaning}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  japanese_meaning: e.target.value,
                })
              }
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-4 py-3">
            <input
              type="text"
              value={editFormData.target_word}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  target_word: e.target.value,
                })
              }
              className="w-full px-2 py-1 border rounded font-mono"
            />
          </td>
          <td className="px-4 py-3 space-x-2">
            <button
              onClick={saveEdit}
              className="text-green-600 hover:underline font-medium"
            >
              Save
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-gray-600 hover:underline"
            >
              Cancel
            </button>
          </td>
        </tr>
      );
    }

    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="px-4 py-3">{item.english_phrase}</td>
        <td className="px-4 py-3">{item.japanese_meaning}</td>
        <td className="px-4 py-3 font-mono text-blue-600">
          {item.target_word}
        </td>
        <td className="px-4 py-3 space-x-2 text-sm">
          <button
            onClick={() => startEdit(item)}
            className="text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => deleteItem(item.id)}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🛠️ Manage Sentences</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Generator Section */}
          <div className="lg:col-span-2">
            <div className="card mb-8">
              <h2 className="text-2xl font-bold mb-4">✨ AI Vocabulary Generator</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Describe what you want to learn:
                  </label>
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g., 'auxiliary verbs', 'negative expressions', 'business English'"
                    onKeyDown={(e) => e.key === "Enter" && generateVocab()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={generateVocab}
                  disabled={loading || !theme.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate Vocabulary"}
                </button>
              </div>
            </div>
          </div>

          {/* Generated Items */}
          {generatedItems.length > 0 && (
            <div className="card lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4">
                🆕 Generated Items ({generatedItems.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold">English Phrase</th>
                      <th className="px-4 py-3 font-semibold">Japanese</th>
                      <th className="px-4 py-3 font-semibold">Target Word</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedItems.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-blue-50">
                        <td className="px-4 py-3">{item.english_phrase}</td>
                        <td className="px-4 py-3">{item.japanese_meaning}</td>
                        <td className="px-4 py-3 font-mono text-blue-600">
                          {item.target_word}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => addToSaved(item)}
                            className="text-green-600 hover:underline font-medium"
                          >
                            + Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Saved Items */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">
                📚 Your Vocabulary ({savedItems.length})
              </h2>
              {savedItems.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">
                  No items yet. Generate some vocabulary above!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold">English Phrase</th>
                        <th className="px-4 py-3 font-semibold">Japanese</th>
                        <th className="px-4 py-3 font-semibold">Target Word</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedItems.map((item) => (
                        <TableRow
                          key={item.id}
                          item={item}
                          isEditing={editingId === item.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
