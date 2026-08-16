# GrammMate: Handover & Reference Guide

This document serves as a complete reference for **GrammMate**, a Manifest V3 browser extension built with a Bring Your Own Key (BYOK) architecture for AI-powered grammar and spelling correction using OpenRouter. 

Any new AI assistant loading this codebase should review this document to instantly understand the files, workflows, design specifications, and implementation decisions.

---

## 1. Project Overview & Objective
* **Name:** GrammMate
* **Objective:** A browser extension that allows users to select text on any website (in inputs, textareas, or contenteditable areas), select a specific rewrite tone, review a diff comparison of changes, and replace the selection inline while maintaining the browser's undo/redo history stack (Ctrl+Z).
* **API Provider:** OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`).
* **Active LLM:** `openai/gpt-oss-20b:free` (Chosen due to rate limits on Google Gemma free tiers).

---

## 2. File Structure Map

```
Grammer Buddy/ (Workspace Root)
├── .env                  # Stores developer's default API key (OPENROUTER_API_KEY=...)
├── manifest.json         # Extension permissions, scripts registration, and popup definitions
├── background.js         # Service worker handling API routing, stats logging, and history queueing
├── content.js            # Text selection monitoring, font loader, and widget panel state machine
├── content.css           # Isolated styles for the floating badge and widget control panel
├── popup.html            # Extension dropdown popup UI showing stats, history list, and toggles
├── popup.js              # Controls statistics rendering, history copy logic, and toggle status
├── options.html          # Secure options settings page for inputting custom API keys
├── options.js            # Manages API key saving to storage and masks password inputs
├── test.html             # Testing playground loaded with incorrect sentences inside text areas
└── icons/                # High quality PNG icons generated in 16x16, 48x48, and 128x128 sizes
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 3. Core Architectural Data Flows

### A. API Key Loading Priority (`background.js`, `options.js`, `popup.js`)
The extension queries keys using a strict fallback chain:
1. First, checks `chrome.storage.local` for the key `apiKey` (configured by the user on the Options page).
2. If empty, attempts to fetch and parse the root `.env` file using `fetch(chrome.runtime.getURL('.env'))`. It matches the pattern `OPENROUTER_API_KEY=([^\s#]+)`.
3. If both are missing, it prompts the user to set up a key.

### B. Text Selection & Widget Positioning (`content.js`)
* **The WebKit Input Selection Bug:** In Chrome/Brave/Edge, `window.getSelection().toString()` returns an empty string `""` when selecting text inside standard `<input>` or `<textarea>` boxes. 
* **The Solution:** We query `document.activeElement` first. If it is an input/textarea, we read `selectionStart` and `selectionEnd` boundaries directly and slice `element.value`. For contenteditable divs, we fall back to standard `window.getSelection()`.
* **State 1 (Launcher):** A tiny circular `✨` button appears at the center-top of the selection.
* **State 2 (Control Panel):** Clicking the launcher morphs it into a `280px` wide Control Card containing a Tone Dropdown and a **Fix Grammar** button.
* **Positioning Fallback:** Calculated using `range.getBoundingClientRect()` for contenteditables. If it yields zero-dimensions (inputs/textareas), it falls back to the element bounds `element.getBoundingClientRect()` and centers above it.

### C. Background Correction API Request (`background.js`)
* The content script sends a `{ action: "correctText", text: "...", tone: "..." }` message.
* The background script queries OpenRouter with the prompt:
  - **Standard System Prompt:** Strict rules to preserve meaning, make minimum changes, avoid style improvements unless incorrect, output *only* raw text, and return text unchanged if correct.
  - **Tone Modulation:** If a tone is selected (Professional, Casual, Academic, Shorter), an additional instruction is dynamically appended to the system prompt to guide style adjustments.
* **Stats Logger:** On success, background parses `data.usage.total_tokens` and increments `correctionsCount` and `tokensCount` inside `chrome.storage.local`.
* **De-duplicated History Queue:** On success, background pushes `{ original, corrected, timestamp }` to the front of a history array, filters out older duplicates of the same original text, slices it to a **maximum of 5 entries**, and saves it to storage.

### D. Diff Comparison & Accept/Reject (`content.js`)
* Once correction succeeds, the Control Card changes to a comparison preview screen:
  - Displays original text (grayed out and struck through).
  - Displays corrected text (highlighted in white).
  - Displays **Apply (Accept)** and **Discard (Reject)** buttons.
* **Preserving Undo History:** When **Apply** is clicked, it selects the range and runs `document.execCommand('insertText', false, correctedText)` to maintain the browser's history undo stack (Ctrl+Z) and trigger virtual DOM change listeners (React/Vue/etc.). If unsupported in the input, it falls back to standard text substitution and dispatches `"input"` and `"change"` events.

### E. Enable/Disable Switch & Popup (`popup.js`)
* The content script monitors document selections only if `extensionEnabled` in storage is `true` or undefined.
* The Popup dropdown switch controls this flag directly. Toggling it OFF immediately dismisses any active widgets.

---

## 4. Visual Tokens & Styling Specifications (Minimal Monochrome Theme)
The entire extension aligns with a Vercel-style, monochrome dark design system. **No purple gradients or accents are allowed.**

```css
:root {
  --bg-color: #18181b;                     /* Deep Charcoal Background */
  --card-bg: rgba(255, 255, 255, 0.03);    /* Frosted translucent container fill */
  --card-border: rgba(255, 255, 255, 0.08);/* Clean border dividing elements */
  --text-main: #f4f4f5;                    /* High contrast zinc-white text */
  --text-muted: #a1a1aa;                   /* Zinc-gray muted label text */
  --accent: #ffffff;                       /* Solid white for primary buttons */
  --accent-glow: rgba(255, 255, 255, 0.08);/* Subtle border hover glow */
  --success: #10b981;                      /* Muted emerald green for success metrics */
  --error: #ef4444;                        /* Muted red for API error notices */
  --input-bg: rgba(0, 0, 0, 0.3);          /* Dark recessed input wells */
}
```
* **Typography:** `Plus Jakarta Sans`, system-ui, -apple-system, sans-serif. Injected via Google Fonts from `content.js` to ensure host documents render clean fonts.
* **Component Isolation:** In `content.css`, all style rules are namespace-prefixed with `.gmate-` and flagged with `!important` to isolate them and prevent styling leaks from host pages.

---

## 5. Instructions for Future Development
When implementing new features (e.g. Grammarly-style underlines, whitelist dictionary, popup logs list extension to 50 elements):
1. **Never use Tailwind CSS or large UI frameworks.** Write vanilla JS and pure CSS to maintain Vercel-style design tokens and minimal extension footprint.
2. **Never check selections inside Chrome extensions without the Blink input bug fallback.** Always query `document.activeElement.selectionStart` and `selectionEnd` when text selection is queried inside input wells.
3. **Respect storage states.** Always verify `extensionEnabled` and the existence of the API Key before making calls.
4. **Maintain the System Prompt Structure.** Ensure rules like "Do not rewrite... unless required for correctness" and "Output ONLY the corrected text" remain intact to prevent models from outputting conversational filler.
5. **Always preserve the history stack.** Use `document.execCommand('insertText')` for replacements.
