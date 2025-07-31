require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");

const { generateDashboard } = require("./dash/dash_generator");

const app = express();
const PORT = process.env.PORT || 3200;
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  // Prüfe JWT im Cookie
  const token = req.cookies.jwt;
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        return res.status(200).redirect("/dash");
      }
    });
  }
  res.sendFile(path.join(__dirname, "public", "login", "index.html"));
});

// Login form handler
app.post("/login", async (req, res) => {
  const { pass } = req.body;
  if (!pass) {
    return res
      .status(400)
      .json({ success: false, message: "Password required" });
  }
  try {
    const [rows] = await db.query(
      "SELECT id, name FROM groups WHERE password = ? LIMIT 1",
      [pass]
    );
    if (rows.length === 1) {
      const group = rows[0];
      const token = jwt.sign(
        { groupId: group.id, groupName: group.name },
        JWT_SECRET,
        { expiresIn: "2h" }
      );
      // Setze JWT als httpOnly Cookie mit SameSite=Lax
      res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2 * 60 * 60 * 1000, // 2 Stunden
      });
      return res.json({ success: true });
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });
    }
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/dash", (req, res) => {
  // JWT aus Cookie lesen
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).redirect("/login");
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).redirect("/login");
    }
    generateDashboard(decoded.groupId, decoded.groupName)
      .then((dashboardHtml) => {
        res.send(dashboardHtml);
      })
      .catch((error) => {
        console.error("Error generating dashboard:", error);
        res.status(500).send("Internal Server Error");
      });
  });
});

app.post("/create-user", async (req, res) => {
  const { user_input } = req.body;
  if (!user_input) {
    return res
      .status(400)
      .json({ success: false, message: "User input required" });
  }
  // JWT aus Cookie lesen
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
      const groupId = decoded.groupId;
      const [user_rows] = await db.query(
        "SELECT * FROM users WHERE api_key = ? OR nickname = ?",
        [user_input, user_input]
      );
      const [group_rows] = await db.query("SELECT * FROM groups WHERE id = ?", [
        groupId,
      ]);

      if (group_rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Group not found" });
      }

      const group = group_rows[0];
      let users = JSON.parse(group.users || "[]");

      // Prüfe ob User existiert
      if (user_rows.length > 0) {
        const userId = user_rows[0].id;
        if (!users.includes(userId)) {
          users.push(userId);
          await db.query("UPDATE groups SET users = ? WHERE id = ?", [
            JSON.stringify(users),
            groupId,
          ]);
          return res.status(200).redirect("/dash");
        } else {
          return res.json({ success: false, message: "User already in group" });
        }
      } else {
        // User existiert nicht, erstelle neuen User
        const apiKey = generateHexKey32();
        const [insertResult] = await db.query(
          "INSERT INTO users (nickname, api_key) VALUES (?, ?)",
          [user_input, apiKey]
        );

        if (!insertResult.insertId) {
          throw new Error("Failed to create user - no insertId returned");
        }

        const newUserId = insertResult.insertId;
        users.push(newUserId);
        await db.query("UPDATE groups SET users = ? WHERE id = ?", [
          JSON.stringify(users),
          groupId,
        ]);

        const template = await fs.promises.readFile(
          path.join(__dirname, "dash", "post_user_create.html"),
          "utf-8"
        );
        return res.status(200).send(template.replace("{{API_KEY}}", apiKey));
      }
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

app.post("/api/health/push", async (req, res) => {
  const {
    api_key,
    pulse,
    steps,
    distance,
    calories,
    curls,
    shoulder_press,
    bench_press,
  } = req.body;
  if (!api_key) {
    return res
      .status(400)
      .json({ success: false, message: "api_key required" });
  }
  try {
    const [userRows] = await db.query(
      "SELECT id FROM users WHERE api_key = ?",
      [api_key]
    );
    if (userRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const user_id = userRows[0].id;
    await db.query(
      `INSERT INTO health_data (user_id, pulse, steps, distance, calories, curls, shoulder_press, bench_press)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        pulse ?? null,
        steps ?? null,
        distance ?? null,
        calories ?? null,
        curls ?? null,
        shoulder_press ?? null,
        bench_press ?? null,
      ]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Error in /api/health/push:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Logout-Route
app.post("/logout", (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ success: true });
});

// In-Memory Store für One-Time-Codes
const oneTimeCodes = new Map();

// GET: /api/auth/one-time-code?api_key=...
app.get("/api/auth/one-time-code", (req, res) => {
  const apiKey = req.query.api_key;
  if (!apiKey) {
    return res
      .status(400)
      .json({ success: false, message: "api_key required" });
  }
  // 4-stelliger Code generieren
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  oneTimeCodes.set(code, {
    apiKey,
    timeout: setTimeout(() => oneTimeCodes.delete(code), 5 * 60 * 1000),
  });
  res.json({ success: true, code });
});

// POST: /api/auth/one-time-code { code }
app.post("/api/auth/one-time-code", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: "code required" });
  }
  const entry = oneTimeCodes.get(code.toString());
  if (entry) {
    clearTimeout(entry.timeout);
    oneTimeCodes.delete(code);
    return res.json({ success: true, api_key: entry.apiKey });
  } else {
    return res.json({ success: false });
  }
});

app.get("/api/group/users-stats", async (req, res) => {
  const token = req.cookies.jwt;
  if (!token) return res.json({ success: false, message: "Unauthorized" });
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.json({ success: false, message: "Unauthorized" });
    try {
      const [groupRows] = await db.query(
        "SELECT users FROM groups WHERE id = ?",
        [decoded.groupId]
      );
      if (!groupRows.length || !groupRows[0].users) {
        return res.json({ success: true, users: [] });
      }
      const userIds = JSON.parse(groupRows[0].users || "[]");
      if (!userIds.length) return res.json({ success: true, users: [] });

      // Hole alle Usernamen
      const [users] = await db.query(
        `SELECT id, nickname FROM users WHERE id IN (${userIds
          .map(() => "?")
          .join(",")})`,
        userIds
      );

      // Aggregiere Healthdaten: latest_pulse (neuester Wert), avg_pulse (Durchschnitt), Rest summiert
      // 1. Neuesten Puls pro User holen
      const [latestPulseRows] = await db.query(
        `SELECT t1.user_id, t1.pulse
         FROM health_data t1
         INNER JOIN (
           SELECT user_id, MAX(ts) as max_ts
           FROM health_data
           WHERE user_id IN (${userIds.map(() => "?").join(",")})
           GROUP BY user_id
         ) t2 ON t1.user_id = t2.user_id AND t1.ts = t2.max_ts`,
        userIds
      );
      const latestPulseMap = {};
      for (const row of latestPulseRows) {
        latestPulseMap[row.user_id] = row.pulse;
      }

      // 2. Durchschnitt und Summen pro User holen
      const [aggRows] = await db.query(
        `SELECT user_id,
            AVG(pulse) as avg_pulse,
            SUM(steps) as steps,
            SUM(distance) as distance,
            SUM(calories) as calories,
            SUM(curls) as curls,
            SUM(shoulder_press) as shoulder_press,
            SUM(bench_press) as bench_press
         FROM health_data
         WHERE user_id IN (${userIds.map(() => "?").join(",")})
         GROUP BY user_id`,
        userIds
      );
      const aggMap = {};
      for (const row of aggRows) {
        aggMap[row.user_id] = row;
      }

      // Mappe Userdaten und Healthdaten zusammen
      const result = users.map((u) => ({
        nickname: u.nickname,
        latest_pulse: latestPulseMap[u.id] ?? null, // null = kein Wert vorhanden
        avg_pulse: aggMap[u.id]?.avg_pulse ?? null, // null = kein Wert vorhanden
        steps: aggMap[u.id]?.steps ?? 0, // 0 = Summe, sinnvoll als Default
        distance: aggMap[u.id]?.distance ?? 0,
        calories: aggMap[u.id]?.calories ?? 0,
        curls: aggMap[u.id]?.curls ?? 0,
        shoulder_press: aggMap[u.id]?.shoulder_press ?? 0,
        bench_press: aggMap[u.id]?.bench_press ?? 0,
      }));

      res.json({ success: true, users: result });
    } catch (e) {
      console.error("Error in /api/group/users-stats:", e);
      res.json({ success: false, message: "Server error" });
    }
  });
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

function generateHexKey32() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
