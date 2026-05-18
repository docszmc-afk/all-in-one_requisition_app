import { GoogleGenAI } from '@google/genai';

export const handler = async (event) => {
  // 1. Ensure CORS headers are set so your React app can communicate with the function
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Make sure you are sending a POST request' };
  }

  try {
    // 2. Safely read the API key from the Netlify environment (NOT exposed to the browser!)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'GEMINI_API_KEY is missing in Netlify environment variables' }) 
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const payload = JSON.parse(event.body || '{}');
    
    // 3. Forward the request to Gemini
    const { action, ...options } = payload;
    let responseData;

    if (action === 'generateContent') {
      const result = await ai.models.generateContent({
        model: options.model || 'gemini-3-flash-preview',
        contents: options.contents,
        config: options.config
      });
      responseData = { text: result.text };
    } 
    else if (action === 'generateImages') {
      const result = await ai.models.generateImages({
        model: options.model || 'gemini-2.5-flash-image',
        prompt: options.prompt,
        config: options.config
      });
      // Return the base64 encoded image
      responseData = { base64: result.generatedImages?.[0]?.image?.imageBytes };
    }
    else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid AI Action' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    console.error('Gemini Netlify Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
