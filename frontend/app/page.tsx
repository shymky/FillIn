export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">📝 FillIn</h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered English learning platform with adaptive spaced repetition
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-2xl font-bold mb-2">🎯 Quiz</h2>
            <p className="text-gray-600">
              Practice with masked vocabulary exercises and real-time voice recognition
            </p>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-2xl font-bold mb-2">🎧 Listening</h2>
            <p className="text-gray-600">
              Improve your listening skills with AI-selected sentences
            </p>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-2xl font-bold mb-2">📖 Review</h2>
            <p className="text-gray-600">
              Revisit challenging sentences with spaced repetition
            </p>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-2xl font-bold mb-2">🛠️ Manage</h2>
            <p className="text-gray-600">
              Create and customize vocabulary lists with AI assistance
            </p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-xl font-bold mb-2">✨ Features</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Real-time voice recognition with Whisper</li>
            <li>AI-powered vocabulary generation with Ollama</li>
            <li>Adaptive learning with spaced repetition</li>
            <li>Mobile-friendly responsive design</li>
            <li>Customizable learning lists</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
