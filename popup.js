// popup.js - GrammMate Dashboard Logic

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const btnToggle = document.getElementById('btnToggle');
  const statsCount = document.getElementById('statsCount');
  const statsTokens = document.getElementById('statsTokens');
  const btnSettings = document.getElementById('btnSettings');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const historyList = document.getElementById('historyList');
  const modelBadge = document.getElementById('modelBadge');

  // Copy icon SVG
  const copySvg = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
  // Checkmark icon SVG
  const checkSvg = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

  // Verify if a packaged .env API key fallback exists
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
      // .env not available, which is normal in production
    }
    return null;
  }

  // Load configuration state, statistics, and history from storage
  const storageData = await chrome.storage.local.get([
    'apiKey', 
    'extensionEnabled', 
    'correctionsCount', 
    'tokensCount',
    'history',
    'apiModel',
    'lastUsedModel'
  ]);
  const envKey = await checkForEnvKey();

  const isEnabled = storageData.extensionEnabled !== false; // defaults to true
  const hasKey = (storageData.apiKey && storageData.apiKey.trim() !== '') || envKey;
  
  // Set UI elements
  btnToggle.checked = isEnabled;
  statsCount.innerText = storageData.correctionsCount || 0;
  statsTokens.innerText = formatTokens(storageData.tokensCount || 0);

  // Auto-migrate legacy obsolete model and display active model
  let currentModel = storageData.apiModel;
  if (!currentModel || currentModel === "openai/gpt-oss-20b:free") {
    currentModel = "openrouter/free";
    await chrome.storage.local.set({ apiModel: "openrouter/free" });
  }

  if (modelBadge) {
    const displayModel = storageData.lastUsedModel || currentModel;
    modelBadge.innerText = displayModel.replace(':free', '');
    modelBadge.title = `Active Model: ${displayModel}\nAuto-fallback routing active`;
  }

  updateStatus(isEnabled, hasKey);
  renderHistory(storageData.history || []);

  // Toggle Extension Switch Listener
  btnToggle.addEventListener('change', async () => {
    const active = btnToggle.checked;
    await chrome.storage.local.set({ extensionEnabled: active });
    updateStatus(active, hasKey);
  });

  // Settings click handler
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Clear History click handler
  btnClearHistory.addEventListener('click', async () => {
    await chrome.storage.local.set({ history: [] });
    renderHistory([]);
  });

  // Update badge UI states
  function updateStatus(active, configured) {
    if (!configured) {
      statusText.innerText = "Setup Key";
      statusBadge.className = "status-badge";
      statusBadge.style.color = "#ff7675";
      statusBadge.querySelector('.status-dot').style.backgroundColor = "#ff7675";
      statusBadge.querySelector('.status-dot').style.boxShadow = "none";
    } else if (active) {
      statusText.innerText = "Active";
      statusBadge.className = "status-badge active";
      statusBadge.style.color = "";
      statusBadge.querySelector('.status-dot').style.backgroundColor = "";
      statusBadge.querySelector('.status-dot').style.boxShadow = "";
    } else {
      statusText.innerText = "Disabled";
      statusBadge.className = "status-badge";
      statusBadge.style.color = "";
      statusBadge.querySelector('.status-dot').style.backgroundColor = "";
      statusBadge.querySelector('.status-dot').style.boxShadow = "none";
    }
  }

  // Render recent history list
  function renderHistory(history) {
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'history-empty';
      emptyItem.innerText = 'No recent corrections.';
      historyList.appendChild(emptyItem);
      return;
    }

    history.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      
      // Escape HTML to prevent injection
      const escapedOriginal = escapeHtml(item.original);
      const escapedCorrected = escapeHtml(item.corrected);

      itemEl.innerHTML = `
        <span class="history-original">${escapedOriginal}</span>
        <span class="history-corrected">${escapedCorrected}</span>
        <button type="button" class="btn-copy" title="Copy corrected text">
          ${copySvg}
        </button>
      `;

      // Copy functionality
      const copyBtn = itemEl.querySelector('.btn-copy');
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(item.corrected);
          // Success visual feedback
          copyBtn.innerHTML = checkSvg;
          copyBtn.style.color = '#10b981';
          setTimeout(() => {
            copyBtn.innerHTML = copySvg;
            copyBtn.style.color = '';
          }, 1500);
        } catch (err) {
          console.error("Clipboard copy failed:", err);
        }
      });

      historyList.appendChild(itemEl);
    });
  }

  // Simple HTML escaping helper
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Abbreviate token counts for cleaner display (e.g. 1.2k)
  function formatTokens(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num;
  }
});
