document
  .getElementById("logoutBtn")
  .addEventListener("click", async function () {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/login";
  });

document.getElementById("createUserBtn").addEventListener("click", function () {
  document.getElementById("createUserModal").classList.add("active");
});

let sortDirection = false;
let currentSortColumnTh = null;

function sortTable(tableTh) {
  currentSortColumnTh = tableTh;
  if (!tableTh) return;

  const table = tableTh.closest("table");
  const columnIndex = Array.from(tableTh.parentNode.children).indexOf(tableTh);

  const rows = Array.from(table.rows).slice(1); // ohne Header

  const isNumeric = !isNaN(rows[0].cells[columnIndex].innerText.trim());

  rows.sort((a, b) => {
    const cellA = a.cells[columnIndex].innerText.trim();
    const cellB = b.cells[columnIndex].innerText.trim();

    if (isNumeric) {
      return sortDirection ? cellA - cellB : cellB - cellA;
    } else {
      return sortDirection
        ? cellA.localeCompare(cellB)
        : cellB.localeCompare(cellA);
    }
  });

  sortDirection = !sortDirection;

  const tbody = table.tBodies[0];
  rows.forEach((row) => tbody.appendChild(row));
}

async function fetchUserStats() {
  try {
    const res = await fetch("/api/group/users-stats");
    const data = await res.json();
    const tbody = document.getElementById("user-table-body");
    if (
      !data.success ||
      !Array.isArray(data.users) ||
      data.users.length === 0
    ) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;">Keine Nutzer oder Daten vorhanden.</td></tr>';
      return;
    }
    tbody.innerHTML = data.users
      .map(
        (u) => `
            <tr>
              <td>${u.nickname}</td>
              <td>${u.latest_pulse ?? "-"}</td>
              <td>${u.avg_pulse ? parseFloat(u.avg_pulse).toFixed(1) : "-"}</td>
              <td>${u.steps ?? 0}</td>
              <td>${u.distance ?? 0}</td>
              <td>${u.calories ?? 0}</td>
              <td>${u.curls ?? 0}</td>
              <td>${u.shoulder_press ?? 0}</td>
              <td>${u.bench_press ?? 0}</td>
            </tr>
          `
      )
      .join("");
    sortTable(currentSortColumnTh);
    sortTable(currentSortColumnTh);
  } catch (e) {
    document.getElementById("user-table-body").innerHTML =
      '<tr><td colspan="9" style="text-align:center;">Fehler beim Laden der Daten.</td></tr>';
    throw new Error("Fehler beim Abrufen der Nutzerdaten: " + e.message);
  }
}
fetchUserStats();
setInterval(fetchUserStats, 15000);
