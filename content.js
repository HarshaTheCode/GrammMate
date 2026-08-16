// content.js - GrammMate Feature Control Panel

// Inject Google Font for Plus Jakarta Sans
(function injectFonts() {
  if (document.getElementById('gmate-fonts')) return;
  const link = document.createElement('link');
  link.id = 'gmate-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
})();

// SVG Icons
// SVG Icons
const starIcon = `<svg viewBox="0 0 24 24"><path d="M12 2L14.8 8.6L22 9.2L16.5 13.9L18.2 21L12 17.2L5.8 21L7.5 13.9L2 9.2L9.2 8.6L12 2Z"/></svg>`;
const settingsIcon = `<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`;

// Simple HTML escaping helper
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Word-level diff using LCS algorithm
function generateWordDiff(original, corrected) {
  const origWords = original.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);

  // Fallback for long texts to avoid performance lag
  if (origWords.length > 250 || corrWords.length > 250) {
    return `<div class="gmate-diff-fallback">
      <div class="gmate-diff-del-block">${escapeHtml(original)}</div>
      <div class="gmate-diff-ins-block">${escapeHtml(corrected)}</div>
    </div>`;
  }

  const dp = Array(origWords.length + 1).fill(null).map(() => Array(corrWords.length + 1).fill(0));
  
  for (let i = 1; i <= origWords.length; i++) {
    for (let j = 1; j <= corrWords.length; j++) {
      if (origWords[i-1] === corrWords[j-1]) {
        dp[i][j] = dp[i-1][j-1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
  }

  let i = origWords.length;
  let j = corrWords.length;
  const diff = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i-1] === corrWords[j-1]) {
      diff.unshift({ type: 'equal', text: origWords[i-1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      diff.unshift({ type: 'insert', text: corrWords[j-1] });
      j--;
    } else {
      diff.unshift({ type: 'delete', text: origWords[i-1] });
      i--;
    }
  }

  let html = '';
  diff.forEach(item => {
    if (item.type === 'equal') {
      html += escapeHtml(item.text);
    } else if (item.type === 'delete') {
      if (item.text.trim() === '') {
        html += item.text;
      } else {
        html += `<span class="gmate-diff-del">${escapeHtml(item.text)}</span>`;
      }
    } else if (item.type === 'insert') {
      if (item.text.trim() === '') {
        html += item.text;
      } else {
        html += `<span class="gmate-diff-ins">${escapeHtml(item.text)}</span>`;
      }
    }
  });

  return html;
}

class GrammMateWidget {
  constructor(selectionInfo) {
    this.selectionInfo = selectionInfo;
    this.portal = null;
    this.isExpanded = false;
    this.correctedText = "";
    this.selectedTone = "standard";
    this.loadingInterval = null;
    this.fadeTimeout = null;
    this.createLauncher();
  }

  createLauncher() {
    this.portal = document.createElement('div');
    this.portal.className = 'gmate-portal';

    const launcher = document.createElement('div');
    launcher.className = 'gmate-launcher';
    launcher.innerHTML = starIcon;
    launcher.title = "GrammMate: Correct spelling and grammar";

    launcher.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.expandPanel();
    });

    this.portal.appendChild(launcher);
    document.body.appendChild(this.portal);

    this.updatePosition();

    requestAnimationFrame(() => {
      if (this.portal) this.portal.classList.add('gmate-visible');
    });
  }

  expandPanel() {
    this.isExpanded = true;
    this.portal.innerHTML = ''; // Clear launcher

    const panel = document.createElement('div');
    panel.className = 'gmate-panel';

    panel.innerHTML = `
      <div class="gmate-header">
        <div class="gmate-title">${starIcon} GrammMate</div>
        <button type="button" class="gmate-btn-settings" title="Settings">
          ${settingsIcon}
        </button>
      </div>

      <div class="gmate-form-group">
        <label class="gmate-label">Select Tone</label>
        <div class="gmate-pills-container">
          <button type="button" class="gmate-pill active" data-value="standard">Standard</button>
          <button type="button" class="gmate-pill" data-value="professional">Professional</button>
          <button type="button" class="gmate-pill" data-value="casual">Casual</button>
          <button type="button" class="gmate-pill" data-value="academic">Academic</button>
          <button type="button" class="gmate-pill" data-value="shorter">Shorter</button>
        </div>
      </div>

      <div class="gmate-actions">
        <button type="button" class="gmate-btn-primary" id="gmateBtnFix">✨ Fix Grammar</button>
        <button type="button" class="gmate-btn-secondary" id="gmateBtnCancel">Dismiss</button>
      </div>

      <div class="gmate-result" id="gmateResultArea" style="display: none;"></div>
    `;

    this.portal.appendChild(panel);

    // Event bindings for Tone Pills
    const pills = panel.querySelectorAll('.gmate-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedTone = pill.getAttribute('data-value');
      });
    });

    const btnFix = panel.querySelector('#gmateBtnFix');
    btnFix.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleFix();
    });

    const btnCancel = panel.querySelector('#gmateBtnCancel');
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.destroy();
    });

    const btnSettings = panel.querySelector('.gmate-btn-settings');
    btnSettings.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "openSettings" });
    });

    this.updatePosition();
  }

  updatePosition() {
    if (!this.portal) return;

    const { range, element, type } = this.selectionInfo;
    let rect = null;

    if (type === 'contenteditable' && range) {
      try {
        rect = range.getBoundingClientRect();
      } catch (e) {}
    }

    if (!rect || (rect.width === 0 && rect.height === 0)) {
      rect = element.getBoundingClientRect();
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    const widgetWidth = this.portal.offsetWidth || (this.isExpanded ? 280 : 32);
    const widgetHeight = this.portal.offsetHeight || (this.isExpanded ? 140 : 32);

    let top = rect.top + scrollTop - widgetHeight - 8;
    let left = rect.left + scrollLeft + (rect.width / 2) - (widgetWidth / 2);

    if (top < scrollTop) {
      top = rect.bottom + scrollTop + 8;
    }

    if (left < scrollLeft + 8) {
      left = scrollLeft + 8;
    }
    const maxLeft = document.documentElement.clientWidth + scrollLeft - widgetWidth - 8;
    if (left > maxLeft) {
      left = maxLeft;
    }

    this.portal.style.top = `${top}px`;
    this.portal.style.left = `${left}px`;
  }

  async handleFix() {
    const tone = this.selectedTone || 'standard';
    const startTime = Date.now();
    this.setLoading(true);

    chrome.runtime.sendMessage({
      action: "correctText",
      text: this.selectionInfo.text,
      tone: tone
    }, (response) => {
      // Impose a minimum delay of 2.0s so user can experience the organic progress loader phases
      const elapsedTime = Date.now() - startTime;
      const minDuration = 2000;
      const remainingTime = Math.max(0, minDuration - elapsedTime);

      setTimeout(() => {
        if (chrome.runtime.lastError) {
          console.error("[GrammMate Dev Log] Extension runtime error:", chrome.runtime.lastError.message);
          this.showError("Service Error: " + chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success) {
          this.correctedText = response.correctedText;
          this.showComparison();
        } else {
          const errorMsg = response?.error || "Error correcting text.";
          console.error("[GrammMate Dev Log] OpenRouter API Error:", errorMsg);
          this.showError(errorMsg);
        }
      }, remainingTime);
    });
  }

  setLoading(loading) {
    const btnFix = this.portal.querySelector('#gmateBtnFix');
    const pillsContainer = this.portal.querySelector('.gmate-pills-container');
    if (!btnFix) return;

    if (loading) {
      btnFix.disabled = true;
      if (pillsContainer) {
        pillsContainer.querySelectorAll('.gmate-pill').forEach(p => p.disabled = true);
        pillsContainer.classList.add('gmate-disabled');
      }

      const loadingPhrases = [
        "Analyzing selection",
        "Checking grammar rules",
        "Polishing tone details",
        "Finalizing suggestion"
      ];
      let phaseIndex = 0;

      const updateLoadingText = () => {
        const phrase = loadingPhrases[phaseIndex];
        const lettersHtml = phrase.split("").map((char, index) => {
          if (char === " ") {
            return `<span class="gmate-letter" style="animation-delay: ${index * 25}ms !important">&nbsp;</span>`;
          }
          return `<span class="gmate-letter" style="animation-delay: ${index * 25}ms !important">${escapeHtml(char)}</span>`;
        }).join("");

        btnFix.innerHTML = `
          <span class="gmate-pulse-dot"></span>
          <span class="gmate-loading-text-wrapper">
            <span class="gmate-loading-text">${lettersHtml}</span>
            <span class="gmate-loading-dots"><span>.</span><span>.</span><span>.</span></span>
          </span>
        `;
        this.updatePosition();
        phaseIndex = (phaseIndex + 1) % loadingPhrases.length;

        // Clear any previous fade timeout
        if (this.fadeTimeout) {
          clearTimeout(this.fadeTimeout);
        }

        // Schedule fade out 350ms before the 2500ms cycle ends (at 2150ms)
        this.fadeTimeout = setTimeout(() => {
          const wrapper = btnFix.querySelector('.gmate-loading-text-wrapper');
          if (wrapper) {
            wrapper.classList.add('gmate-fade-out');
          }
        }, 2150);
      };

      updateLoadingText();
      this.loadingInterval = setInterval(updateLoadingText, 2500);
    } else {
      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
      }
      if (this.fadeTimeout) {
        clearTimeout(this.fadeTimeout);
        this.fadeTimeout = null;
      }
      btnFix.disabled = false;
      btnFix.innerHTML = '✨ Fix Grammar';
      if (pillsContainer) {
        pillsContainer.querySelectorAll('.gmate-pill').forEach(p => p.disabled = false);
        pillsContainer.classList.remove('gmate-disabled');
      }
    }
    this.updatePosition();
  }

  showError(message) {
    this.setLoading(false);

    const oldErr = this.portal.querySelector('.gmate-error-msg');
    if (oldErr) oldErr.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'gmate-error-msg';
    errorEl.innerText = message;

    const panel = this.portal.querySelector('.gmate-panel');
    panel.appendChild(errorEl);
    this.updatePosition();

    setTimeout(() => {
      if (errorEl && errorEl.parentNode) {
        errorEl.remove();
        this.updatePosition();
      }
    }, 6000);
  }

  showComparison() {
    this.setLoading(false);

    // Hide tone selection and original Fix/Dismiss buttons
    const formGroup = this.portal.querySelector('.gmate-form-group');
    if (formGroup) formGroup.style.display = 'none';

    const actions = this.portal.querySelector('.gmate-actions');
    if (actions) actions.style.display = 'none';

    // Populate comparison screen
    const resultArea = this.portal.querySelector('#gmateResultArea');
    resultArea.style.display = 'flex';
    resultArea.innerHTML = `
      <div class="gmate-result-header">
        <span class="gmate-label">Suggested Changes</span>
        <button type="button" class="gmate-btn-copy-result" title="Copy corrected text">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
      </div>
      <div class="gmate-preview-container">
        <div class="gmate-diff-view">${generateWordDiff(this.selectionInfo.text, this.correctedText)}</div>
      </div>
      <div class="gmate-result-actions">
        <button type="button" class="gmate-btn-accept" id="gmateBtnAccept">✓ Apply</button>
        <button type="button" class="gmate-btn-reject" id="gmateBtnReject">Discard</button>
      </div>
    `;

    // Bind Copy Icon
    const copyBtn = resultArea.querySelector('.gmate-btn-copy-result');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(this.correctedText);
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="#10b981"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        }, 1500);
      } catch (err) {
        console.error("Failed to copy corrected text:", err);
      }
    });

    // Bind Accept/Reject
    resultArea.querySelector('#gmateBtnAccept').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.applyCorrection();
    });

    resultArea.querySelector('#gmateBtnReject').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.destroy();
    });

    this.updatePosition();
  }

  applyCorrection() {
    const { type, element, range, start, end } = this.selectionInfo;

    if (type === 'contenteditable') {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertText', false, this.correctedText);
    } else if (type === 'input') {
      element.focus();
      element.setSelectionRange(start, end);
      const success = document.execCommand('insertText', false, this.correctedText);
      if (!success) {
        const val = element.value;
        element.value = val.substring(0, start) + this.correctedText + val.substring(end);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        const newCursorPos = start + this.correctedText.length;
        element.setSelectionRange(newCursorPos, newCursorPos);
      }
    }
    this.destroy();
  }

  destroy() {
    if (activeWidget === this) {
      activeWidget = null;
    }
    if (this.portal) {
      this.portal.classList.remove('gmate-visible');
      setTimeout(() => {
        if (this.portal && this.portal.parentNode) {
          this.portal.parentNode.removeChild(this.portal);
        }
        this.portal = null;
      }, 200);
    }
  }
}

// Active widget tracking state
let activeWidget = null;

// Determine selection metrics
function getSelectionInfo() {
  const activeEl = document.activeElement;
  if (activeEl) {
    const tagName = activeEl.tagName.toLowerCase();
    const isInput = tagName === 'input' && ['text', 'search', 'email', 'url'].includes(activeEl.type);
    const isTextarea = tagName === 'textarea';

    if (isInput || isTextarea) {
      try {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        console.log("GrammMate Debug: Active element is input/textarea. Tag:", tagName, "Selection indices:", start, "to", end);
        if (start !== undefined && end !== undefined && end - start > 1) {
          const slicedText = activeEl.value.slice(start, end).trim();
          console.log("GrammMate Debug: Sliced input/textarea text:", slicedText);
          if (slicedText.length >= 2) {
            return {
              type: 'input',
              element: activeEl,
              text: slicedText,
              start: start,
              end: end,
              range: null
            };
          }
        }
      } catch (e) {
        console.warn("GrammMate Debug: Safe check failed for input selection:", e);
      }
    }
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  console.log("GrammMate Debug: general window selection text:", text);
  if (text.length < 2) {
    return null;
  }

  const range = selection.getRangeAt(0);
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }

  const editableContainer = node.closest('[contenteditable="true"]') || (node.isContentEditable ? node : null);
  console.log("GrammMate Debug: Editable container parent check:", editableContainer);
  if (editableContainer) {
    return {
      type: 'contenteditable',
      element: editableContainer,
      text: selection.toString(),
      range: range
    };
  }

  return null;
}

// Click outside handler
document.addEventListener('mousedown', (e) => {
  if (activeWidget && activeWidget.portal && !activeWidget.portal.contains(e.target)) {
    console.log("GrammMate Debug: Clicked outside widget portal, destroying widget.");
    activeWidget.destroy();
    activeWidget = null;
  }
});

// Event listener for user mouse selection or keyboard highlights
function handleSelectionEvent(e) {
  if (activeWidget && activeWidget.portal && activeWidget.portal.contains(e.target)) {
    return;
  }

  // Retrieve toggle status from storage before executing widget logic
  chrome.storage.local.get({ extensionEnabled: true }, (storage) => {
    if (!storage.extensionEnabled) {
      if (activeWidget) {
        activeWidget.destroy();
        activeWidget = null;
      }
      return;
    }

    // Small delay to ensure browser selection metrics are updated
    setTimeout(() => {
      const info = getSelectionInfo();
      console.log("GrammMate Debug: Selection event parsed. Info found:", info);
      if (info) {
        if (activeWidget) {
          // Skip recreation if selecting the exact same text region
          if (activeWidget.selectionInfo.text === info.text && activeWidget.selectionInfo.element === info.element) {
            return;
          }
          activeWidget.destroy();
        }
        activeWidget = new GrammMateWidget(info);
      } else {
        if (activeWidget && activeWidget.portal && (!e.target || !activeWidget.portal.contains(e.target))) {
          console.log("GrammMate Debug: Selection collapsed, destroying active widget.");
          activeWidget.destroy();
          activeWidget = null;
        }
      }
    }, 50);
  });
}

document.addEventListener('mouseup', handleSelectionEvent);
document.addEventListener('keyup', handleSelectionEvent);

console.log("GrammMate Debug: Content script injected and listening.");
