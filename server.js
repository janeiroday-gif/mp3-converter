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
      error: "Vul eerst een YouTube-link in."
    });
  }

  res.json({
    message: "Link ontvangen! De converter wordt binnenkort toegevoegd.",
    url: url
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MP3Fast draait op poort ${PORT}`);
});
