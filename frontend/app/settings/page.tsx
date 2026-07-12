"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    toleranceThreshold: 60,
    audioSpeed: 1,
    autoPlay: false,
  });

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem("fillinSettings", JSON.stringify(settings));
    alert("Settings saved!");
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">⚙️ Settings</h1>

        <div className="card space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Pronunciation Tolerance (%) - Default: 60%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.toleranceThreshold}
              onChange={(e) =>
                handleChange("toleranceThreshold", parseInt(e.target.value))
              }
              className="w-full"
            />
            <p className="text-sm text-gray-600 mt-2">
              Current: {settings.toleranceThreshold}% match required
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Audio Speed
            </label>
            <select
              value={settings.audioSpeed}
              onChange={(e) =>
                handleChange("audioSpeed", parseFloat(e.target.value))
              }
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value={0.75}>Slow (0.75x)</option>
              <option value={1}>Normal (1x)</option>
              <option value={1.25}>Fast (1.25x)</option>
              <option value={1.5}>Faster (1.5x)</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={settings.autoPlay}
              onChange={(e) =>
                handleChange("autoPlay", e.target.checked)
              }
              id="autoplay"
              className="w-4 h-4"
            />
            <label htmlFor="autoplay" className="ml-2">
              Auto-play audio when loading questions
            </label>
          </div>

          <button onClick={saveSettings} className="btn-primary">
            Save Settings
          </button>
        </div>

        <div className="card mt-8 bg-blue-50">
          <h2 className="font-bold mb-2">💡 About</h2>
          <p className="text-gray-700 text-sm">
            FillIn uses AI-powered language learning with real-time speech recognition
            and adaptive difficulty levels.
          </p>
          <p className="text-gray-500 text-xs mt-2">Version 0.1.0</p>
        </div>
      </div>
    </div>
  );
}
