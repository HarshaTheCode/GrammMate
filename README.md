# GrammMate 🚀

GrammMate is a lightning-fast, privacy-first browser extension for grammar and spelling correction, powered by a **BYOK (Bring Your Own Key)** architecture integrated with **OpenRouter**. 

It provides an elegant, floating, glassmorphic correction panel that appears directly when you select text in any text field or contenteditable element on the web.

---

## ✨ Features

- **Bring Your Own Key (BYOK):** Keep absolute control over your API credentials. Connects directly to OpenRouter's API endpoints.
- **Segmented Tone Pills:** Easily switch between different rewrite tones with a single click:
  - `Standard` (Default correction)
  - `Professional` (Executive, polite wording)
  - `Casual` (Conversational and friendly)
  - `Academic` (Formal, authoritative phrasing)
  - `Shorter` (Conciser summary)
- **Inline Word-Level Diffing:** Displays original text deletions in light red strikethroughs and new additions in mint-green highlight boxes, drawing your eye exactly to what changed.
- **Copy to Clipboard:** Features a fast-copy utility icon inside the suggestion container to copy suggestions without inserting.
- **Dynamic Multi-Model Auto-Fallback Router:** Never encounter service downtime when free models hit rate limits (429) or get retired. Automatically failsover across curated top free models:
  - `openrouter/free` (Recommended - Dynamic auto-routing free pool)
  - `nvidia/nemotron-3.5-lightning:free` (Ultra-low ~600ms latency, 1M context)
  - `google/gemma-4-26b-a4b-it:free` (Google Gemma 4 26B instruct model)
  - `nvidia/nemotron-3-super-120b-a12b:free` (120B parameter flagship reasoning)
  - `dots-studio/dots-3-note-preview:free` (512k context high-fidelity polish)
- **Zero-Chatter Clean Sanitization:** Automatically strips reasoning tags (`<think>...</think>`), code fences, and quotes to ensure clean inline text replacement.
- **Manifest V3 Compliant:** Fully sandboxed execution adhering to modern browser safety specifications.

---

## 🛠️ Installation (Developer Mode)

Since this is a custom extension, you can load it directly into any Chromium-based browser (Chrome, Brave, Edge, Opera):

1. **Download / Clone** this repository to your local machine.
2. Open your browser and navigate to the extensions control panel:
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`
3. Toggle the **Developer mode** switch (usually located in the top-right corner) to **ON**.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the root directory containing this project (the folder containing `manifest.json`).

---

## ⚙️ Configuration

1. Get an API key from [OpenRouter](https://openrouter.ai/).
2. Click the **GrammMate** icon in your browser toolbar.
3. Select **Setup Key** (or click the Settings cog inside the floating panel).
4. Enter your OpenRouter API Key and click **Save**.
5. Alternatively, for local development, you can create a `.env` file in the root folder containing:
   ```env
   OPENROUTER_API_KEY=your_key_here
   ```


## 📁 Project Structure

- `manifest.json`: Extension Manifest V3 configuration settings.
- `background.js`: Sandboxed service worker handling OpenRouter API bridges and local usage statistics.
- `content.js`: Captures text highlights, coordinates floating widget states, diff evaluations, and letters animation.
- `content.css`: Visual design guidelines, segmented pills, pulsing dot states, and keyframe animations.
- `popup.html` / `popup.js`: Dashboard showing toggle switch, correction history list, and usage metrics.
- `options.html` / `options.js`: Options configuration page to securely save your API key.

---

## 📄 License

This project is licensed under the MIT License.
