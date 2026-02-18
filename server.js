const express = require("express");
const axios = require("axios");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const git = simpleGit();

fs.ensureDirSync(path.join(__dirname, "temp"));

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/scan-repo", async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl)
      return res.status(400).json({ error: "Repository URL required" });

    const uniqueId = uuidv4();
    const repoPath = path.join(__dirname, "temp", uniqueId);

    await git.clone(repoUrl, repoPath);

    const allFiles = await scanAllFiles(repoPath);

    let detectedLanguage = "JavaScript";
    if (allFiles.some((f) => f.endsWith(".tsx")))
      detectedLanguage = "TypeScript (React)";
    else if (allFiles.some((f) => f.endsWith(".ts")))
      detectedLanguage = "TypeScript";

    let detectedFramework = "jest";
    const packageJsonPath = path.join(repoPath, "package.json");

    if (await fs.pathExists(packageJsonPath)) {
      const packageData = await fs.readJson(packageJsonPath);
      const deps = {
        ...packageData.dependencies,
        ...packageData.devDependencies,
      };

      if (deps) {
        if (deps.jest) detectedFramework = "jest";
        else if (deps.mocha) detectedFramework = "mocha";
        else if (deps.vitest) detectedFramework = "vitest";
      }
    }

    const sourceFiles = await getSourceFiles(repoPath);

    await fs.remove(repoPath);

    res.json({
      framework: detectedFramework,
      language: detectedLanguage,
      files: sourceFiles.map((f) => path.basename(f)),
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to scan repo" });
  }
});

app.post("/generate-tests", async (req, res) => {
  try {
    const { repoUrl, selectedFiles } = req.body;

    if (!repoUrl || !selectedFiles || selectedFiles.length === 0)
      return res.status(400).json({ error: "Missing data" });

    if (selectedFiles.length > 3)
      return res.status(400).json({
        error: "You can generate tests for maximum 3 files at once.",
      });

    const uniqueId = uuidv4();
    const repoPath = path.join(__dirname, "temp", uniqueId);

    await git.clone(repoUrl, repoPath);

    const files = await getSourceFiles(repoPath);
    let responseFiles = [];

    for (const file of files) {
      const baseName = path.basename(file);
      if (!selectedFiles.includes(baseName)) continue;

      const content = await fs.readFile(file, "utf-8");

      const ext = path.extname(file);
      const fileName = path.basename(file, ext);
      const testFileName = `${fileName}.test${ext}`;

      const aiResponse = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are a senior software test engineer. Generate clean, production-ready unit tests.",
            },
            {
              role: "user",
              content: `
Generate unit tests.
Follow AAA pattern.
Mock dependencies if needed.
Only output valid test code.

Source Code:
${content.slice(0, 3000)}
`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1200,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      const testContent = aiResponse.data.choices[0].message.content;

      const testCount =
        (testContent.match(/it\(/g) || []).length +
        (testContent.match(/test\(/g) || []).length;

      responseFiles.push({
        fileName: testFileName,
        testCount,
        content: testContent,
      });
    }

    await fs.remove(repoPath);

    res.json({ files: responseFiles });
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Test generation failed" });
  }
});

async function getSourceFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir);

  for (const file of list) {
    if (["node_modules", "dist", "build", ".git"].includes(file)) continue;

    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(await getSourceFiles(fullPath));
    } else if (
      (file.endsWith(".js") || file.endsWith(".ts") || file.endsWith(".tsx")) &&
      !file.includes(".test.")
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

async function scanAllFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir);

  for (const file of list) {
    if (["node_modules", "dist", "build", ".git"].includes(file)) continue;

    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(await scanAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

app.listen(process.env.PORT || 8000, () => {
  console.log("Server running...");
});
