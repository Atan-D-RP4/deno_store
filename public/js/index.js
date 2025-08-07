import { showAlert, handleLogout } from './lib.js';

let sessionStartTime = Date.now();
let userDataCache = null;

function updateSessionTime() {
  const elapsed = Date.now() - sessionStartTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  document.getElementById("session-time").textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function loadUserData() {
  try {
    const response = await fetch("/api/me");
    const result = await response.json();

    if (result.success) {
      userDataCache = result.data;
      updateUI(result.data);
      document.getElementById("loading").classList.remove("show");
      document.getElementById("dashboard").style.display = "block";
    } else {
      throw new Error(result.error || "Failed to load user data");
    }
  } catch (error) {
    showAlert("Failed to load user data. Redirecting to login...");
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 2000);
  }
}

function updateUI(userData) {
  document.getElementById("username").textContent = userData.username;
  document.getElementById("user-id").textContent = `ID: ${userData.id}`;
  document.getElementById("user-email").textContent = userData.email;
}

async function refreshUserData() {
  document.getElementById("loading").classList.add("show");
  document.getElementById("dashboard").style.display = "none";
  await loadUserData();
}

function showUserInfo() {
  if (userDataCache) {
    const info = `
User Information:
• Username: ${userDataCache.username}
• Email: ${userDataCache.email}
• User ID: ${userDataCache.id}
• Account Created: ${new Date(userDataCache.created_at).toLocaleString()}
• Session Duration: ${document.getElementById("session-time").textContent}
		`;
    alert(info);
  }
}

async function testAPI() {
  try {
    const response = await fetch("/api/me");
    const result = await response.json();

    if (result.success) {
      showAlert("API test successful! Your session is valid.", "success");
    } else {
      showAlert("API test failed. Session may be invalid.");
    }
  } catch (error) {
    showAlert("API test failed. Network error.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadUserData();
  setInterval(updateSessionTime, 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshUserData();
    }
  });

  document.getElementById('handle-logout').addEventListener('click', handleLogout);
  document.getElementById('refresh-user-data').addEventListener('click', refreshUserData);
  document.getElementById('show-user-info').addEventListener('click', showUserInfo);
  document.getElementById('test-api').addEventListener('click', testAPI);
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    refreshUserData();
  }
});