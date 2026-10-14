// background.js for GrammMate

// Curated list of high-performance free models available on OpenRouter
const CURATED_FREE_MODELS = [
  "openrouter/free",                            // OpenRouter Dynamic Free Pool (Recommended auto-routing)
  "nvidia/nemotron-3.5-lightning:free",         // Ultra-fast (~600ms latency, 1M context)
  "google/gemma-4-26b-a4b-it:free",             // Google Gemma 4 26B Instruct (Google's latest instruct model)
  "nvidia/nemotron-3-super-120b-a12b:free",     // NVIDIA Flagship 120B model (deep linguistic accuracy)
  "dots-studio/dots-3-note-preview:free",       // Dots3 Note Preview (512k context, great writing style)
  "cohere/north-mini-code:free",                // Cohere North Mini (fast inference)
  "liquid/lfm-2.5-2.6b:free"                    // LiquidAI LFM 2.5 (lightweight edge model)
];

const DEFAULT_PRIMARY_MODEL = "openrouter/free";
const OBSOLETE_MODEL = "openai/gpt-oss-20b:free";

// Clean and sanitize model outputs (stripping thinking tags, markdown fences, extra quotes)
function sanitizeCorrection(rawText) {
  if (!rawText) return "";
  let text = rawText.trim();

  // Strip <think>...</think> or <thought>...</thought> reasoning blocks
  text = text.replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, '').trim();

  // Strip markdown code fences if wrapped: ```...```
  if (text.startsWith("```") && text.endsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Strip accidental outer quotes if model wrapped entire text in quotes
  if ((text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
      (text.startsWith("'") && text.endsWith("'") && text.length >= 2)) {
    const inner = text.slice(1, -1);
    if (!inner.includes('"') && !inner.includes("'")) {
      text = inner.trim();
    }
  }

  return text;
}

// Build fallback batches (max 3 models per OpenRouter API requirements)
function buildModelBatches(preferredModel) {
  const cleanPreferred = (preferredModel && preferredModel !== OBSOLETE_MODEL)
    ? preferredModel.trim()
    : null;

  const candidateList = [];
  if (cleanPreferred) {
    candidateList.push(cleanPreferred);
  }
  for (const model of CURATED_FREE_MODELS) {
    if (!candidateList.includes(model)) {
      candidateList.push(model);
    }
  }

  const batches = [];
  for (let i = 0; i < candidateList.length; i += 3) {
    batches.push(candidateList.slice(i, i + 3));
  }
  return batches;
}

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

// Perform grammar correction with resilient multi-tier fallback routing
async function correctGrammar(textToCorrect, tone = 'standard') {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set your OpenRouter API Key in the extension Options page.");
  }

  const storageData = await chrome.storage.local.get(['apiModel']);
  let preferredModel = storageData.apiModel;

  // Auto-migrate legacy/obsolete model to default dynamic free router
  if (!preferredModel || preferredModel === OBSOLETE_MODEL) {
    preferredModel = DEFAULT_PRIMARY_MODEL;
    await chrome.storage.local.set({ apiModel: DEFAULT_PRIMARY_MODEL });
  }

  const batches = buildModelBatches(preferredModel);
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

  let lastError = null;

  // Execute multi-tier fallback routing across model batches
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const currentBatch = batches[batchIndex];
    
    try {
      const requestBody = {
        models: currentBatch,
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
          "HTTP-Referer": "https://aerotext.local",
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
        console.warn(`[GrammMate Router] Batch ${batchIndex + 1} (${currentBatch.join(', ')}) failed:`, errMsg);
        lastError = new Error(`OpenRouter API Error: ${errMsg}`);
        continue; // Fall back to next batch
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const rawCorrection = data.choices[0].message.content;
        const cleanedCorrection = sanitizeCorrection(rawCorrection);

        if (!cleanedCorrection && rawCorrection !== "") {
          console.warn(`[GrammMate Router] Batch ${batchIndex + 1} returned empty content after sanitization.`);
          lastError = new Error("Model returned empty response content.");
          continue;
        }

        const modelUsed = data.model || currentBatch[0];
        const tokensUsed = data.usage?.total_tokens || 0;

        console.info(`[GrammMate Router] Succeeded via model: ${modelUsed} (Batch ${batchIndex + 1})`);

        // Record last routed model in storage for visibility in popup/options
        await chrome.storage.local.set({ 
          lastUsedModel: modelUsed,
          lastRouteTimestamp: Date.now()
        });

        await recordStats(tokensUsed);
        await addHistoryEntry(textToCorrect, cleanedCorrection);
        return cleanedCorrection;
      } else {
        console.warn(`[GrammMate Router] Batch ${batchIndex + 1} returned invalid choices structure.`);
        lastError = new Error("Invalid response structure from OpenRouter API.");
      }
    } catch (err) {
      console.warn(`[GrammMate Router] Exception in Batch ${batchIndex + 1}:`, err.message);
      lastError = err;
    }
  }

  // If all fallback batches fail
  throw lastError || new Error("All free AI model fallbacks were temporarily unavailable. Please try again shortly.");
}

// Listen for messages from content.js and dashboard popup
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
  } else if (message.action === "getCuratedModels") {
    sendResponse({ 
      success: true, 
      models: CURATED_FREE_MODELS,
      defaultModel: DEFAULT_PRIMARY_MODEL
    });
  }
});
