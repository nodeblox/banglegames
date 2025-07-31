let storage_file = "banglegames.json";
let code = "";
let touchLocked = false; // verhindert Mehrfachauslösung

let keys = [
  [1, 2, 3, ""],
  [4, 5, 6, "<"],
  [7, 8, 9, 0],
];

function drawInput() {
  g.clear();
  g.setFont("6x8", 3);
  let display = code.padEnd(4, "_");
  let w = g.stringWidth(display);
  g.drawString(display, (g.getWidth() - w) / 2, 10);
}

function drawKeypad() {
  drawInput();
  g.setFont("6x8", 2);
  let startX = 10,
    startY = 45,
    size = 35,
    gap = 5;
  for (let row = 0; row < keys.length; row++) {
    for (let col = 0; col < keys[row].length; col++) {
      let key = keys[row][col].toString();
      if (key === "") continue;
      let x = startX + col * (size + gap);
      let y = startY + row * (size + gap);
      g.drawRect(x, y, x + size, y + size);
      g.drawString(key, x + 10, y + 8);
    }
  }
}

function drawStatus(ok) {
  g.clear();
  g.setFont("6x8", 6);
  g.drawString(ok ? "yeah!" : "X", 80, 10);
}

function getKeyFromXY(x, y) {
  let startX = 10,
    startY = 45,
    size = 35,
    gap = 5;
  for (let row = 0; row < keys.length; row++) {
    for (let col = 0; col < keys[row].length; col++) {
      if (keys[row][col] === "") continue;
      let bx = startX + col * (size + gap);
      let by = startY + row * (size + gap);
      if (x >= bx && x <= bx + size && y >= by && y <= by + size) {
        return keys[row][col];
      }
    }
  }
  return null;
}

function reset() {
  code = "";
  drawKeypad();
  touchLocked = false;
}

function sendCode() {
  Bangle.http("https://banglegames.nblx.de/api/auth/one-time-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
    .then((res) => {
      let data = res.resp ? JSON.parse(res.resp) : {};
      if (data.success && data.api_key) {
        let file_data = require("Storage").readJSON(storage_file, 1) || {};
        file_data.api_key = data.api_key;
        require("Storage").writeJSON(storage_file, file_data);
        drawStatus(true);
        setTimeout(() => load(), 1000);
      } else {
        drawStatus(false);
        setTimeout(() => reset(), 1000);
      }
    })
    .catch(() => {
      drawStatus(false);
      setTimeout(() => reset(), 1000);
    });
}

function onTouch(_, xy) {
  if (touchLocked) return;
  touchLocked = true;
  setTimeout(() => {
    touchLocked = false;
  }, 200); // debounce 200ms

  let key = getKeyFromXY(xy.x, xy.y);
  if (key === null || key === "") return;

  if (key === "<") {
    code = code.slice(0, -1);
  } else if (code.length < 4 && typeof key === "number") {
    code += key;
    if (code.length === 4) {
      drawKeypad();
      sendCode();
      return;
    }
  }
  drawKeypad();
}

g.clear();
drawKeypad();
Bangle.on("touch", onTouch);
Bangle.on("kill", () => {
  Bangle.removeListener("touch", onTouch);
  Bangle.removeAllListeners();
});
