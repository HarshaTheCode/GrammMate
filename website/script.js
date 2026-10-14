// script.js - GrammMate Landing Page Interaction Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- Tab Selection Logic ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // --- Interactive Mock Sandbox Logic ---
  const textarea = document.getElementById('demoTextarea');
  const launcher = document.getElementById('mockLauncher');
  const panel = document.getElementById('mockPanel');
  const btnFix = document.getElementById('demoBtnFix');
  const btnCancel = document.getElementById('demoBtnCancel');
  const btnAccept = document.getElementById('demoBtnAccept');
  const btnReject = document.getElementById('demoBtnReject');
  const tonePills = document.querySelectorAll('.gmate-pill');

  const gmateBodyTones = document.getElementById('gmateBodyTones');
  const gmateBodyResult = document.getElementById('gmateBodyResult');
  const demoDiffView = document.getElementById('demoDiffView');

  let selectedTone = 'standard';
  let isSpacePressed = false;
  let isPanelOpen = false;

  const originalText = "He go to school yesterday and write a code who work good.";
  
  // Custom mock corrections database mapping tone -> corrected text and diff HTML
  const corrections = {
    standard: {
      text: "He went to school yesterday and wrote code that worked well.",
      diff: `He <span class="gmate-diff-del">go</span><span class="gmate-diff-ins">went</span> to school yesterday and <span class="gmate-diff-del">write a code who work</span><span class="gmate-diff-ins">wrote code that worked</span> <span class="gmate-diff-del">good</span><span class="gmate-diff-ins">well</span>.`
    },
    professional: {
      text: "He went to school yesterday and wrote code that worked exceptionally well.",
      diff: `He <span class="gmate-diff-del">go</span><span class="gmate-diff-ins">went</span> to school yesterday and <span class="gmate-diff-del">write a code who work good</span><span class="gmate-diff-ins">wrote code that worked exceptionally well</span>.`
    },
    casual: {
      text: "He went to school yesterday and wrote some code that worked great.",
      diff: `He <span class="gmate-diff-del">go</span><span class="gmate-diff-ins">went</span> to school yesterday and <span class="gmate-diff-del">write a code who work good</span><span class="gmate-diff-ins">wrote some code that worked great</span>.`
    },
    academic: {
      text: "He attended school yesterday and wrote code that functioned correctly.",
      diff: `He <span class="gmate-diff-del">go to school</span><span class="gmate-diff-ins">attended school</span> yesterday and <span class="gmate-diff-del">write a code who work good</span><span class="gmate-diff-ins">wrote code that functioned correctly</span>.`
    },
    shorter: {
      text: "He went to school yesterday and wrote working code.",
      diff: `He <span class="gmate-diff-del">go to school yesterday and write a code who work good</span><span class="gmate-diff-ins">went to school yesterday and wrote working code</span>.`
    }
  };

  // Tone pill selector handler
  tonePills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      tonePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTone = pill.getAttribute('data-value');
    });
  });

  // Track text highlight selection inside textarea to position launcher
  function updateSelectionState() {
    if (isPanelOpen) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Show launcher if user has selected a reasonable sentence
    if (start !== undefined && end !== undefined && end - start > 5) {
      launcher.classList.add('visible');
    } else {
      launcher.classList.remove('visible');
    }
  }

  textarea.addEventListener('select', updateSelectionState);
  textarea.addEventListener('mouseup', updateSelectionState);
  textarea.addEventListener('keyup', updateSelectionState);

  // Open panel from launcher click
  launcher.addEventListener('click', (e) => {
    e.stopPropagation();
    openGrammMatePanel();
  });

  function openGrammMatePanel() {
    launcher.classList.remove('visible');
    panel.classList.add('visible');
    isPanelOpen = true;
  }

  // Dismiss panel
  function closeGrammMatePanel() {
    panel.classList.remove('visible');
    isPanelOpen = false;
    gmateBodyTones.style.display = 'flex';
    gmateBodyResult.style.display = 'none';
    btnFix.innerHTML = "✨ Fix Grammar";
    btnFix.disabled = false;
    updateSelectionState();
  }

  btnCancel.addEventListener('click', closeGrammMatePanel);
  btnReject.addEventListener('click', closeGrammMatePanel);

  // Trigger simulated Fix execution
  btnFix.addEventListener('click', () => {
    triggerSimulatedFix();
  });

  function triggerSimulatedFix() {
    btnFix.disabled = true;
    
    // Simulate staggered loader phases
    const loadingPhrases = ["Analyzing selection...", "Checking rules...", "Generating diff..."];
    let phase = 0;
    
    btnFix.innerHTML = `<span class="gmate-pulse-dot"></span> <span id="demoLoaderText">${loadingPhrases[phase]}</span>`;
    
    const interval = setInterval(() => {
      phase++;
      if (phase < loadingPhrases.length) {
        const textEl = document.getElementById('demoLoaderText');
        if (textEl) textEl.innerText = loadingPhrases[phase];
      } else {
        clearInterval(interval);
        renderCorrectionResult();
      }
    }, 850);
  }

  function renderCorrectionResult() {
    const correction = corrections[selectedTone] || corrections.standard;
    demoDiffView.innerHTML = correction.diff;
    gmateBodyTones.style.display = 'none';
    gmateBodyResult.style.display = 'flex';
  }

  // Apply simulated correction
  btnAccept.addEventListener('click', () => {
    const correction = corrections[selectedTone] || corrections.standard;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    // Overwrite selected region with correction
    textarea.value = val.substring(0, start) + correction.text + val.substring(end);
    closeGrammMatePanel();
  });

  // Space + F global key listeners inside textarea
  textarea.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      isSpacePressed = true;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== undefined && end !== undefined && end - start > 5) {
        // Prevent default space character replacement
        e.preventDefault();
      }
      return;
    }

    if (e.key.toLowerCase() === 'f' && isSpacePressed) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== undefined && end !== undefined && end - start > 5) {
        e.preventDefault();
        openGrammMatePanel();
      }
    }
    
    // Keybinds inside active panel state
    if (isPanelOpen) {
      const isResultView = gmateBodyResult.style.display !== 'none';
      
      if (e.key === 'Escape') {
        e.preventDefault();
        closeGrammMatePanel();
      } else if (!isResultView) {
        const tones = ['standard', 'professional', 'casual', 'academic', 'shorter'];
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          let idx = (tones.indexOf(selectedTone) + 1) % tones.length;
          document.querySelector(`.gmate-pill[data-value="${tones[idx]}"]`).click();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          let idx = (tones.indexOf(selectedTone) - 1 + tones.length) % tones.length;
          document.querySelector(`.gmate-pill[data-value="${tones[idx]}"]`).click();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          triggerSimulatedFix();
        }
      } else {
        if (e.key === 'Enter' || e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'a') {
          e.preventDefault();
          btnAccept.click();
        } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'd') {
          e.preventDefault();
          btnReject.click();
        }
      }
    }
  });

  textarea.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      isSpacePressed = false;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // If user typed space over selection and didn't trigger hotkey, simulate typing space
      if (end - start > 5 && !isPanelOpen) {
        const val = textarea.value;
        textarea.value = val.substring(0, start) + ' ' + val.substring(end);
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1;
        updateSelectionState();
      }
    }
  });

  // Automatically select text inside textarea on page load to prompt the user
  setTimeout(() => {
    textarea.focus();
    // Highlight the sentence starting from "He go..."
    textarea.setSelectionRange(0, textarea.value.length);
    updateSelectionState();
  }, 1000);
});
