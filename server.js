require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db"); // Importiere die Datenbankverbindung

const app = express();
const PORT = process.env.PORT || 3200;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login", "index.html"));
});

// Login form handler
app.post("/login", (req, res) => {
  const { pass } = req.body;

  // Basic password check (replace with proper authentication)
  if (pass === "admin123") {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// 404 handler
app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
