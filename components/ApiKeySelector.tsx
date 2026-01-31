import React, { useState, useEffect } from 'react';

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const [loading, setLoading] = useState(true);

  const checkKey = () => {
    // Check if the API key is configured via environment variable
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      onKeySelected();
    }
    setLoading(false);
  };

  useEffect(() => {
    checkKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-95 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">API Key Missing</h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          The <strong>VITE_GEMINI_API_KEY</strong> environment variable is not configured. Please add it to your <code className="bg-slate-900 px-2 py-1 rounded text-indigo-400">.env.local</code> file.
        </p>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-left mb-6">
          <p className="text-xs text-slate-500 mb-2">Add to .env.local:</p>
          <code className="text-sm text-green-400">VITE_GEMINI_API_KEY=your_api_key_here</code>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-indigo-500/25 shadow-lg flex items-center justify-center gap-2"
        >
          <span>Reload Page</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
          </svg>
        </button>

        <p className="mt-6 text-xs text-slate-500">
          Get your API key from <a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Google AI Studio</a>.
        </p>
      </div>
    </div>
  );
};