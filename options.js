// options.js for GrammMate

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('apiModel');
  const btnSave = document.getElementById('btnSave');
  const statusMsg = document.getElementById('statusMsg');
  const toggleKeyBtn = document.getElementById('toggleKey');
  const eyeIcon = document.getElementById('eyeIcon');
  const presetCards = document.querySelectorAll('.preset-card');

  const DEFAULT_MODEL = "openrouter/free";
  const OBSOLETE_MODEL = "openai/gpt-oss-20b:free";

  // Eye icon paths
  const eyeOpenPath = "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z";
  const eyeClosedPath = "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.74-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.43-1.47.68-2.33.68-2.76 0-5-2.24-5-5 0-.86.25-1.66.68-2.33zM12.44 9.02L14.98 11.56c.01-.18.02-.36.02-.56 0-1.66-1.34-3-3-3-.2 0-.38.01-.56.02z";

  // Check if a packaged .env key is available as default
  async function checkForEnvKey() {
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
    } catch (e) {
      // .env file not packaged or accessible, which is fine
    }
    return null;
  }

  // Update preset cards UI selection state based on current model value
  function syncPresetCards(selectedModel) {
    let matchFound = false;
    presetCards.forEach(card => {
      const cardModel = card.getAttribute('data-model');
      if (cardModel === selectedModel) {
        card.classList.add('active');
        matchFound = true;
      } else {
        card.classList.remove('active');
      }
    });
  }

  // Preset Card click handler
  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      const modelVal = card.getAttribute('data-model');
      modelInput.value = modelVal;
      syncPresetCards(modelVal);
    });
  });

  // Custom text input change handler
  modelInput.addEventListener('input', () => {
    syncPresetCards(modelInput.value.trim());
  });

  // Load configuration from storage
  const storageData = await chrome.storage.local.get(['apiKey', 'apiModel']);
  const envKey = await checkForEnvKey();

  if (storageData.apiKey) {
    apiKeyInput.value = storageData.apiKey;
  } else if (envKey) {
    apiKeyInput.value = envKey;
  }

  let activeModel = storageData.apiModel;
  // Automatically migrate away from obsolete model
  if (!activeModel || activeModel === OBSOLETE_MODEL) {
    activeModel = DEFAULT_MODEL;
    await chrome.storage.local.set({ apiModel: DEFAULT_MODEL });
  }

  modelInput.value = activeModel;
  syncPresetCards(activeModel);

  if (storageData.apiKey || envKey) {
    showStatus("Configurations loaded. Auto-fallback routing active.", "success");
  } else {
    showStatus("No API Key configured. Please enter settings to start.", "error");
  }

  // Toggle API Key visibility
  toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.querySelector('path').setAttribute('d', isPassword ? eyeClosedPath : eyeOpenPath);
  });

  // Verify and Save configurations
  btnSave.addEventListener('click', async () => {
    const keyVal = apiKeyInput.value.trim();
    const modelVal = modelInput.value.trim() || DEFAULT_MODEL;

    if (!keyVal) {
      showStatus("Please enter an OpenRouter API Key.", "error");
      return;
    }

    showStatus("Testing model connection and latency on OpenRouter...", "success");
    btnSave.disabled = true;

    try {
      // Execute a quick verification call with fallback batch
      const testModels = [modelVal];
      if (modelVal !== "openrouter/free") {
        testModels.push("openrouter/free");
      }
      if (modelVal !== "nvidia/nemotron-3.5-lightning:free") {
        testModels.push("nvidia/nemotron-3.5-lightning:free");
      }

      const startMs = Date.now();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyVal}`,
          "HTTP-Referer": "https://aerotext.local",
          "X-Title": "GrammMate Verification"
        },
        body: JSON.stringify({
          models: testModels.slice(0, 3),
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5
        })
      });

      const elapsed = Date.now() - startMs;

      if (response.ok) {
        const respJson = await response.json();
        const activeRouted = respJson.model || modelVal;
        await chrome.storage.local.set({ 
          apiKey: keyVal, 
          apiModel: modelVal,
          lastUsedModel: activeRouted
        });

        showStatus(`Verified in ${elapsed}ms! Routed via: ${activeRouted}. Settings saved.`, "success");
        
        btnSave.style.transform = "scale(0.96)";
        setTimeout(() => btnSave.style.transform = "none", 150);
      } else {
        const errText = await response.text();
        let errMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch (e) {}
        showStatus("Verification failed: " + errMsg, "error");
      }
    } catch (err) {
      showStatus("Connection error: " + err.message, "error");
    } finally {
      btnSave.disabled = false;
    }
  });

  // Display status messages
  function showStatus(text, type) {
    statusMsg.innerText = text;
    statusMsg.className = `status-msg ${type}`;
    statusMsg.style.display = 'flex';
  }
});
