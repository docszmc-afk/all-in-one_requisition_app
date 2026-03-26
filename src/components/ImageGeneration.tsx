import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Loader2, Download, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export default function ImageGeneration() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in the environment.');
      }
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: prompt }
          ]
        }
      });

      let foundImage = false;
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
            setGeneratedImage(imageUrl);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error('No image was returned by the model.');
      }

    } catch (err: any) {
      console.error('Image generation error:', err);
      setError(err.message || 'Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-stone-100 bg-stone-50">
        <h2 className="font-semibold text-stone-900 flex items-center">
          <ImageIcon className="w-5 h-5 mr-2 text-orange-600" />
          Nano Banana Image Generation
        </h2>
        <p className="text-xs text-stone-500 mt-1">Generate images using the free gemini-2.5-flash-image model.</p>
      </div>

      <div className="p-6 flex-1 overflow-y-auto flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3 flex flex-col space-y-6">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="w-full rounded-xl border-stone-200 shadow-sm focus:ring-orange-500 focus:border-orange-500 resize-none h-32 p-3 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Image'
              )}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="w-full lg:w-2/3 flex flex-col items-center justify-center min-h-[400px] bg-stone-50 rounded-2xl border border-stone-200 overflow-hidden relative">
          {isGenerating ? (
            <div className="flex flex-col items-center text-stone-400">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-orange-500" />
              <p>Creating your image...</p>
            </div>
          ) : generatedImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-4 group">
              <img 
                src={generatedImage} 
                alt="Generated" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
              <a
                href={generatedImage}
                download={`generated-image-${Date.now()}.png`}
                className="absolute bottom-6 right-6 p-3 bg-white/90 backdrop-blur text-stone-900 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                title="Download Image"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center text-stone-400">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>Your generated image will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
