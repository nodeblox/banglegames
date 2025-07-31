const fs = require("fs");
const path = require("path");

async function generateDashboard(groupId, groupName) {
  // Lade das Dashboard-Template
  const template = await fs.promises.readFile(
    path.join(__dirname, "dash.html"),
    "utf-8"
  );

  // Ersetze die Platzhalter für Gruppe
  return template
    .replace("{{groupId}}", groupId)
    .replace("{{groupName}}", groupName);
}

exports.generateDashboard = generateDashboard;
