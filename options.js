// options.js for GrammMate

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const btnSave = document.getElementById('btnSave');
  const statusMsg = document.getElementById('statusMsg');
  const toggleKeyBtn = document.getElementById('toggleKey');
  const eyeIcon = document.getElementById('eyeIcon');

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

  // Load API Key from local storage or fallback to .env
  const storageData = await chrome.storage.local.get(['apiKey']);
  const envKey = await checkForEnvKey();

  if (storageData.apiKey) {
    apiKeyInput.value = storageData.apiKey;
    showStatus("API Key loaded from local storage.", "success");
  } else if (envKey) {
    apiKeyInput.value = envKey;
    showStatus("API Key pre-loaded from .env configuration.", "success");
  } else {
    showStatus("No API Key configured. Please enter and save one to start.", "error");
  }

  // Toggle API Key visibility
  toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.querySelector('path').setAttribute('d', isPassword ? eyeClosedPath : eyeOpenPath);
  });

  // Save API Key to local storage
  btnSave.addEventListener('click', async () => {
    const val = apiKeyInput.value.trim();
    if (!val) {
      showStatus("Please enter a valid API Key.", "error");
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey: val });
      showStatus("API Key saved successfully! GrammMate is ready.", "success");
      
      // Add visual pop to the button
      btnSave.style.transform = "scale(0.95)";
      setTimeout(() => btnSave.style.transform = "none", 150);
    } catch (err) {
      showStatus("Failed to save settings: " + err.message, "error");
    }
  });

  // Display status messages
  function showStatus(text, type) {
    statusMsg.innerText = text;
    statusMsg.className = `status-msg ${type}`;
    statusMsg.style.display = 'flex';
  }
});
