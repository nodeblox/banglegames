document
  .getElementById("logoutBtn")
  .addEventListener("click", async function () {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/login";
  });

document.getElementById("createUserBtn").addEventListener("click", function () {
  document.getElementById("createUserModal").classList.add("active");
});
