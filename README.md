# 🚀 AI GitHub Test Generator

An AI-powered web app that scans public GitHub repositories and automatically generates production-ready unit tests.

---

## ✨ Features

- 🔍 Scan any public GitHub repo
- 🧠 Detects JS / TS / TSX
- 🧪 Detects testing framework (Jest / Mocha / Vitest)
- 📂 Select up to 3 files
- 🤖 AI-generated unit tests
- 👁 Preview before download
- ⬇ Download tests separately

---

## 🛠 Tech Stack

- Node.js
- Express.js
- simple-git
- Groq API (LLM)
- Render (Deployment)

---

## ⚙️ Local Setup

```bash
1. git clone https://github.com/your-username/ai-test-generator.git
2. cd ai-test-generator
3. npm install
4. Create .env:
   GROQ_API_KEY=your_api_key
5. npm start
