const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  dest: "uploads/",
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

  try {
    const parsedUrl = new URL(url);

    if (
      !["youtube.com", "www.youtube.com", "youtu.be"].includes(
        parsedUrl.hostname
      )
    ) {
      return res.status(400).json({
        error: "Gebruik een geldige YouTube-link."
      });
    }

    res.json({
      success: true,
      message: "Link ontvangen. Conversie wordt later toegevoegd."
    });
  } catch {
    res.status(400).json({
      error: "Dit is geen geldige link."
    });
  }
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Geen bestand ontvangen."
    });
  }

  res.json({
    success: true,
    message: "Bestand succesvol ontvangen.",
    filename: req.file.originalname
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MP3Fast draait op poort ${PORT}`);
});
