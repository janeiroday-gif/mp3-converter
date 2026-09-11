const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "converted");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function analyzeAudio(filePath) {
  try {
    const audioModule = await import("audio");
    const audio = audioModule.default;

    const track = await audio(filePath);

    const [bpmResult, keyResult] = await Promise.all([
      track.stat("bpm"),
      track.stat("key")
    ]);

    let bpm = null;
    let key = null;

    if (typeof bpmResult === "number") {
      bpm = Math.round(bpmResult);
    } else if (bpmResult && typeof bpmResult.value === "number") {
      bpm = Math.round(bpmResult.value);
    }

    if (typeof keyResult === "string") {
      key = keyResult;
    } else if (keyResult && keyResult.label) {
      key = keyResult.label;
    }

    return { bpm, key };
  } catch (error) {
    console.error("Audio analyse:", error.message);
    return { bpm: null, key: null };
  }
}

function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions([
        "-threads",
        "0",
        "-map_metadata",
        "-1"
      ])
      .format("mp3")
      .on("error", reject)
      .on("end", resolve)
      .save(outputPath);
  });
}

async function processFile(inputPath, originalName, res) {
  const safeName = path
    .parse(originalName)
    .name
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .substring(0, 80) || "audio";

  const outputName = `${safeName}-${Date.now()}.mp3`;
  const outputPath = path.join(outputDir, outputName);

  try {
    await convertToMp3(inputPath, outputPath);

    fs.unlink(inputPath, () => {});

    const analysis = await analyzeAudio(outputPath);

    res.json({
      success: true,
      message: "Je MP3 is klaar!",
      bpm: analysis.bpm,
      key: analysis.key,
      downloadUrl: `/download/${encodeURIComponent(outputName)}`
    });
  } catch (error) {
    console.error("Conversie:", error.message);

    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});

    if (!res.headersSent) {
      res.status(500).json({
        error: "Het bestand kon niet naar MP3 worden geconverteerd."
      });
    }
  }
}

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Geen bestand ontvangen."
    });
  }

  await processFile(
    req.file.path,
    req.file.originalname,
    res
  );
});

function downloadUrl(url, destination) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;

    const request = client.get(url, (response) => {

      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadUrl(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(
          new Error(`Download mislukt: HTTP ${response.statusCode}`)
        );
        return;
      }

      const file = fs.createWriteStream(destination);

      response.pipe(file);

      file.on("finish", () => {
        file.close(resolve);
      });

      file.on("error", reject);
    });

    request.on("error", reject);

    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error("Download duurde te lang."));
    });
  });
}

app.post("/convert", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: "Vul eerst een link in."
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({
      error: "Dit is geen geldige URL."
    });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({
      error: "Alleen HTTP- en HTTPS-links zijn toegestaan."
    });
  }

  const extension =
    path.extname(parsedUrl.pathname).toLowerCase();

  const allowedExtensions = [
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".ogg",
    ".flac",
    ".mp4",
    ".webm",
    ".mov",
    ".mkv"
  ];

  if (!allowedExtensions.includes(extension)) {
    return res.status(400).json({
      error:
        "Deze link lijkt geen directe audio- of videolink te zijn. Gebruik een directe mediabestandslink waarvoor je downloadrechten hebt."
    });
  }

  const inputName =
    `url-${Date.now()}${extension}`;

  const inputPath =
    path.join(uploadDir, inputName);

  try {
    await downloadUrl(url, inputPath);

    await processFile(
      inputPath,
      inputName,
      res
    );
  } catch (error) {
    console.error("URL download:", error.message);

    fs.unlink(inputPath, () => {});

    if (!res.headersSent) {
      res.status(500).json({
        error:
          "De mediabron kon niet worden gedownload of verwerkt."
      });
    }
  }
});

app.get("/download/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(outputDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Bestand niet gevonden.");
  }

  res.download(filePath, filename, (err) => {
    if (!err) {
      fs.unlink(filePath, () => {});
    }
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MP3Fast draait op poort ${PORT}`);
});
