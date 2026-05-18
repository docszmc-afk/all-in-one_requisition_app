# How to Fix the Github API Key Leak & Setup Netlify

GitHub warned you about your `GEMINI_API_KEY` leaking because when you prefix an environment variable in React with `VITE_` (e.g. `VITE_GEMINI_API_KEY`), the Vite builder automatically hardcodes it permanently into your public Javascript files. Anyone can open dev-tools and copy the key.

**CRITICAL RULE:** **You must never fetch an API key from a backend and send it to your frontend app.** If you do this, the key still passes through the internet and ends up visible in the browser's "Network" tab. It is still a leak!

Instead, your frontend should send the user's files/prompts to a **Netlify Serverless Function**. That Serverless Function securely runs on Netlify's backend servers, uses the key to talk to Google Gemini securely, and then just sends the final AI response (the extracted text or image) back to your React app.

Here is your exact step-by-step to implement this securely:

## STEP 1: Revoke the leaked Key
Go to Google AI Studio right now and delete the key that leaked. Generate a new one.

## STEP 2: Add the new key to Netlify Securely
1. In the Netlify Dashboard, navigate to your Site settings > **Environment variables**.
2. Add a new variable.
3. Key: `GEMINI_API_KEY` (Do **NOT** use `VITE_GEMINI_API_KEY`)
4. Value: `Your-New-API-Key`
5. Save.

## STEP 3: Ensure the Netlify Serverless Function is Deployed
I have already written code for the Netlify Backend function for you and placed it inside a new folder: `netlify/functions/gemini.ts`.
When you export this code to GitHub and branch to Netlify, Netlify will automatically detect this file and spin it up as a secure backend API endpoint at `https://your-domain.netlify.app/.netlify/functions/gemini`.

## STEP 4: Update your frontend to point to the new Netlify Function
Right now, your React app is making requests directly via the `@google/genai` library on the frontend. You need to replace those with `fetch` requests pointing to your secure Netlify Function.

**Replace this style of logic (Client-Side - INSECURE on Netlify):**
```javascript
const { GoogleGenAI } = await import('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({ ... });
```

**With this Network Call (Server-Side - SECURE on Netlify):**
```javascript
// Make an API request to your secure Netlify backend function
const response = await fetch('/.netlify/functions/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'generateContent', // Tells the backend what to do
    model: 'gemini-3-flash-preview',
    contents: [prompt, textContent],
    config: {
      responseMimeType: "application/json",
      // ... your schema here
    }
  })
});

// Wait for the backend response
const result = await response.json();
const aiTextResponse = result.text;
```

**How to adjust your `ImageGeneration.tsx` file:**

```javascript
const response = await fetch('/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generateImages',
      model: 'gemini-2.5-flash-image',
      prompt: "Your image prompt",
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "1:1"
      }
    })
});

const result = await response.json();
if (result.base64) {
    setGeneratedImage(`data:image/jpeg;base64,${result.base64}`);
}
```

Once you push these changes, your React App will never directly talk to Google, eliminating any chance of the key leaking to GitHub again.
