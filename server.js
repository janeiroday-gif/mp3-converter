const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

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

app.post("/convert", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: "Vul eerst een link in."
    });
  }

  res.json({
    success: true,
    message: "Gebruik upload your own file om je eigen bestand naar MP3 te converteren."
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Geen bestand ontvangen."
    });
  }

  const inputPath = req.file.path;
  const outputName =
    path.parse(req.file.originalname).name + "-" + Date.now() + ".mp3";
  const outputPath = path.join(outputDir, outputName);

  ffmpeg(inputPath)
    .toFormat("mp3")
    .audioCodec("libmp3lame")
    .audioBitrate("192k")
    .on("end", () => {
      fs.unlink(inputPath, () => {});

      res.json({
        success: true,
        message: "Je MP3 is klaar!",
        downloadUrl: `/download/${encodeURIComponent(outputName)}`
      });
    })
    .on("error", (error) => {
      console.error(error);

      fs.unlink(inputPath, () => {});

      res.status(500).json({
        error: "Het bestand kon niet naar MP3 worden geconverteerd."
      });
    })
    .save(outputPath);
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
