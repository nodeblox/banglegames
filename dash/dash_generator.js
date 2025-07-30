const fs = require("fs");
const path = require("path");
const db = require("../db");

async function generateDashboard(groupId, groupName) {
  // Lade Gruppen-User-IDs
  const [group_rows] = await db.query("SELECT users FROM groups WHERE id = ?", [
    groupId,
  ]);
  let userTableHtml = `
    <table class="user-table">
      <thead>
        <tr>
          <th>Nutzername</th>
          <th>Schritte</th>
          <th>Kalorien</th>
          <th>Meter</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="4" style="text-align:center;">Keine Nutzer in dieser Gruppe.</td></tr>
      </tbody>
    </table>
  `;
  if (group_rows.length && group_rows[0].users) {
    const userIds = JSON.parse(group_rows[0].users || "[]");
    if (userIds.length > 0) {
      const [users] = await db.query(
        `SELECT nickname FROM users WHERE id IN (${userIds
          .map(() => "?")
          .join(",")})`,
        userIds
      );
      userTableHtml = `
        <table class="user-table">
          <thead>
            <tr>
              <th>Nutzername</th>
              <th>Schritte</th>
              <th>Kalorien</th>
              <th>Meter</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map(
                (u) => `
                <tr>
                  <td>${u.nickname}</td>
                  <td>12345</td>
                  <td>456</td>
                  <td>7890</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      `;
    }
  }

  const template = await fs.promises.readFile(
    path.join(__dirname, "dash_template.html"),
    "utf-8"
  );
  return template
    .replace("{{groupId}}", groupId)
    .replace("{{groupName}}", groupName)
    .replace("{{userTable}}", userTableHtml);
}

exports.generateDashboard = generateDashboard;
