const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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

    if (!["youtube.com", "www.youtube.com", "youtu.be"].includes(parsedUrl.hostname)) {
      return res.status(400).json({
        error: "Gebruik een geldige YouTube-link."
      });
    }

    res.json({
      success: true,
      message: "Link is ontvangen. MP3-conversie wordt later toegevoegd."
    });

  } catch {
    res.status(400).json({
      error: "Dit is geen geldige link."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MP3Fast draait op poort ${PORT}`);
});
