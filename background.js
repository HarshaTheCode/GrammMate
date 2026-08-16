// background.js for GrammMate

// Retrieve the OpenRouter API key
async function getApiKey() {
  // 1. Check local storage
  const storageData = await chrome.storage.local.get(['apiKey']);
  if (storageData.apiKey && storageData.apiKey.trim() !== '') {
    return storageData.apiKey.trim();
  }

  // 2. Fallback to packaged .env file
  try {
    const envUrl = chrome.runtime.getURL('.env');
    const response = await fetch(envUrl);
    if (response.ok) {
      const text = await response.text();
      const match = text.match(/OPENROUTER_API_KEY\s*=\s*([^\s#]+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (err) {
    console.warn("Could not read packaged .env file:", err);
  }

  return null;
}

// Record correction statistics locally
async function recordStats(tokensUsed) {
  try {
    const stats = await chrome.storage.local.get(['correctionsCount', 'tokensCount']);
    const newCorrectionsCount = (stats.correctionsCount || 0) + 1;
    const newTokensCount = (stats.tokensCount || 0) + (tokensUsed || 0);
    await chrome.storage.local.set({
      correctionsCount: newCorrectionsCount,
      tokensCount: newTokensCount
    });
  } catch (err) {
    console.warn("Failed to record usage stats:", err);
  }
}

// Record history locally (last 5 grammar checks)
async function addHistoryEntry(original, corrected) {
  try {
    const data = await chrome.storage.local.get(['history']);
    let history = data.history || [];
    
    // Add to front of array
    history.unshift({ 
      original: original.trim(), 
      corrected: corrected.trim(), 
      timestamp: Date.now() 
    });
    
    // De-duplicate if the same original text is corrected again
    history = history.filter((item, index, self) =>
      index === self.findIndex((t) => t.original === item.original)
    );
    
    // Keep only last 5 items
    if (history.length > 5) {
      history = history.slice(0, 5);
    }
    
    await chrome.storage.local.set({ history });
  } catch (err) {
    console.warn("Failed to record grammar history:", err);
  }
}

// Perform grammar correction using OpenRouter API
async function correctGrammar(textToCorrect, tone = 'standard') {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set your OpenRouter API Key in the extension Options page.");
  }

  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  
  let toneInstruction = "";
  if (tone === "professional") {
    toneInstruction = "\n- Additional Rule: Adjust the style to make it sound professional, polite, and executive.";
  } else if (tone === "casual") {
    toneInstruction = "\n- Additional Rule: Adjust the style to make it sound casual, friendly, and conversational.";
  } else if (tone === "academic") {
    toneInstruction = "\n- Additional Rule: Adjust the style to make it sound formal, academic, and authoritative.";
  } else if (tone === "shorter") {
    toneInstruction = "\n- Additional Rule: Make the text as concise and short as possible while preserving the original meaning.";
  }

  const systemContent = `You are a grammar correction engine.

Correct the user's text for spelling, grammar, and punctuation.

Rules:
- Preserve the original meaning.
- Make the minimum necessary changes.
- Do not rewrite, paraphrase, or improve the style unless required for correctness.
- Preserve the user's wording, tone, capitalization, and formatting whenever possible.
- If the text is already correct, return it unchanged.
- Output ONLY the corrected text.
- No explanations, comments, markdown, quotes, or extra text.${toneInstruction}`;

  const requestBody = {
    model: "openai/gpt-oss-20b:free",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: systemContent
      },
      {
        role: "user",
        content: textToCorrect
      }
    ]
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://aerotext.local", // Required for OpenRouter
      "X-Title": "GrammMate"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch (e) {}
    
    const errMsg = parsedErr?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`OpenRouter API Error: ${errMsg}`);
  }

  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const tokensUsed = data.usage?.total_tokens || 0;
    const correctedText = data.choices[0].message.content;
    await recordStats(tokensUsed);
    await addHistoryEntry(textToCorrect, correctedText);
    return correctedText;
  } else {
    throw new Error("Invalid response structure from OpenRouter API.");
  }
}

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "correctText") {
    correctGrammar(message.text, message.tone)
      .then(correctedText => {
        sendResponse({ success: true, correctedText: correctedText });
      })
      .catch(error => {
        console.error("Error in correction process:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (message.action === "openSettings") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
});
