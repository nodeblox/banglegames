let count,
  state,
  pauseStart,
  steps = 0,
  lastStepTime = 0;
let currentHR = 0;
let kcal = 0;
let kcalStartTime = Date.now();
const weightKg = 70;

let api_key;

// Versuche api_key aus banglegames.json zu laden
try {
  const config = require("Storage").readJSON("banglegames.json", 1) || {};
  api_key = config.api_key;
} catch (e) {
  api_key = undefined;
}

if (!api_key) {
  g.clear();
  g.setFont("6x8", 2);
  g.setColor(1, 0, 0); // Rot
  g.drawString("Bitte", 60, g.getHeight() / 2 - 15);
  g.drawString("Anmelden", 40, g.getHeight() / 2 + 5);
  setTimeout(() => load(), 2000); // App beenden nach 2 Sek.
  throw new Error("Kein API Key gefunden, App beendet.");
}

function setStandardFont() {
  g.setFont("6x8", 2);
  g.setColor(0, 0, 0);
}

// ==========================
// Main menu
// ==========================
function showMainMenu() {
  E.showMenu({
    "Count Curls": () => startCurls(),
    "Count Steps": () => startSteps(),
    "Shoulder Press": () => startShoulderPress(),
    "Bench Press": () => startBenchPress(),
    Exit: () => load(),
  });
}

// ==========================
// Header with widgets (no calories here)
// ==========================
function drawHeader() {
  g.clear();
  Bangle.loadWidgets();
  Bangle.drawWidgets();
  setStandardFont();
  // KEIN drawKcal hier, damit keine Kalorienanzeige im Menü
}

// ==========================
// Draw calories (nur in Aktivität verwenden)
// ==========================
function drawKcal() {
  g.setFont("6x8", 2);
  g.setColor(0, 0, 0);
  g.clearRect(0, 100, g.getWidth(), 130);
  g.drawString("Calories: " + kcal, 10, 100);
}

// ==========================
// Estimate calories burned
// ==========================
function estimateKcal() {
  let elapsedMin = (Date.now() - kcalStartTime) / 60000;
  let met = currentHR > 120 ? 7 : currentHR > 100 ? 5 : 3;
  let hours = elapsedMin / 60;
  let hrKcal = met * weightKg * hours;
  let stepKcal = steps * 0.04;
  kcal = Math.floor(hrKcal + stepKcal);
}

// ==========================
// Send data via Bluetooth
// ==========================
function sendHealthData(exerciseData) {
  exerciseData = exerciseData || {};

  // Baue nur die Felder ein, die einen Wert > 0 oder definiert haben
  const payload = { api_key };

  if (typeof currentHR === "number" && currentHR > 0) payload.pulse = currentHR;
  if (typeof kcal === "number" && kcal > 0) payload.calories = kcal;
  kcalStartTime = Date.now(); // Zurücksetzen nach Senden

  if (exerciseData.curls > 0) payload.curls = exerciseData.curls;
  exerciseData.curls = 0; // Zurücksetzen nach Senden
  if (exerciseData.shoulder_press > 0)
    payload.shoulder_press = exerciseData.shoulder_press;
  exerciseData.shoulder_press = 0; // Zurücksetzen nach Senden
  if (exerciseData.bench_press > 0)
    payload.bench_press = exerciseData.bench_press;
  exerciseData.bench_press = 0; // Zurücksetzen nach Senden
  if (exerciseData.steps > 0) payload.steps = exerciseData.steps;
  exerciseData.steps = 0; // Zurücksetzen nach Senden

  Bangle.http("https://banglegames.nblx.de/api/health/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log("Health data gespeichert!");
      } else {
        console.error("Fehler:", data.message);
      }
    })
    .catch((err) => {
      console.error("HTTP Fehler:", err);
    });
}

// ==========================
// Start Bicep Curls mode
// ==========================
function startCurls() {
  Bangle.removeAllListeners("accel");
  count = 0;
  state = "idle";
  pauseStart = 0;
  const UP = 0.85,
    DOWN = 0.25,
    PAUSE = 300;

  function draw(z) {
    drawHeader();
    g.drawString("Bicep Curls:", 10, 30);
    g.drawString("Count: " + count, 10, 60);
    drawKcal();
  }
  draw(0);

  Bangle.on("accel", (acc) => {
    const z = acc.z,
      now = Date.now();
    draw(z);
    switch (state) {
      case "idle":
        if (z > UP) {
          state = "topPause";
          pauseStart = now;
        }
        break;
      case "topPause":
        if (now - pauseStart > PAUSE) state = "down";
        break;
      case "down":
        if (z < DOWN) {
          state = "bottomPause";
          pauseStart = now;
        }
        break;
      case "bottomPause":
        if (now - pauseStart > PAUSE) {
          count++;
          Bangle.buzz(100);
          state = "idle";
          draw(z);
        }
        break;
    }
  });

  setWatch(
    () => {
      Bangle.removeAllListeners("accel");
      sendHealthData({ curls: count });
      showMainMenu();
    },
    BTN1,
    { repeat: false, edge: "rising" }
  );
}

// ==========================
// Start Steps mode
// ==========================
function startSteps() {
  Bangle.removeAllListeners("accel");
  steps = 0;
  lastStepTime = 0;

  function draw() {
    drawHeader();
    g.drawString("Steps: " + steps, 10, 40);
    drawKcal();
  }
  draw();

  Bangle.on("accel", (acc) => {
    const now = Date.now();
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    if (mag > 1.2 && now - lastStepTime > 400) {
      steps++;
      lastStepTime = now;
      draw();
    }
  });

  setWatch(
    () => {
      Bangle.removeAllListeners("accel");
      sendHealthData({ steps: steps });
      showMainMenu();
    },
    BTN1,
    { repeat: false, edge: "rising" }
  );
}

// ==========================
// Start Shoulder Press mode
// ==========================
function startShoulderPress() {
  Bangle.removeAllListeners("accel");
  let shoulderCount = 0,
    lastPeak = false;

  function draw() {
    drawHeader();
    g.drawString("Shoulder Press", 10, 30);
    g.drawString("Count: " + shoulderCount, 10, 60);
    drawKcal();
  }
  draw();

  const TH = 1.3;
  Bangle.on("accel", (acc) => {
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    if (!lastPeak && mag > TH) {
      shoulderCount++;
      Bangle.buzz(50);
      draw();
      lastPeak = true;
    } else if (lastPeak && mag < TH * 0.8) {
      lastPeak = false;
    }
  });

  setWatch(
    () => {
      Bangle.removeAllListeners("accel");
      sendHealthData({ shoulder_press: shoulderCount });
      showMainMenu();
    },
    BTN1,
    { repeat: false, edge: "rising" }
  );
}

// ==========================
// Start Bench Press mode
// ==========================
function startBenchPress() {
  Bangle.removeAllListeners("accel");
  let benchCount = 0,
    lastPeak = false;

  function draw() {
    drawHeader();
    g.drawString("Bench Press", 10, 30);
    g.drawString("Count: " + benchCount, 10, 60);
    drawKcal();
  }
  draw();

  const TH = 1.2;
  Bangle.on("accel", (acc) => {
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    if (!lastPeak && mag > TH) {
      benchCount++;
      Bangle.buzz(50);
      draw();
      lastPeak = true;
    } else if (lastPeak && mag < TH * 0.8) {
      lastPeak = false;
    }
  });

  setWatch(
    () => {
      Bangle.removeAllListeners("accel");
      sendHealthData({ bench_press: benchCount });
      showMainMenu();
    },
    BTN1,
    { repeat: false, edge: "rising" }
  );
}

// ==========================
// Always measure heart rate in background
// ==========================
Bangle.setHRMPower(1, "app");
Bangle.on("HRM", (d) => {
  currentHR = d.bpm;
});

// ==========================
// Auto update calories every 30 seconds
// ==========================
setInterval(() => {
  estimateKcal();
  // Nur aktualisieren, wenn nicht im Menü (optional)
  // drawKcal(); nicht hier sonst wird kcal evtl im Menü gezeichnet
}, 30000);

// ==========================
// Init
// ==========================
g.clear();
setStandardFont();
showMainMenu();
