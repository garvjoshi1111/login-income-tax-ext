const statusEl = () => document.getElementById("status");

async function loadSettings() {
  const data = await chrome.storage.local.get(["userId", "password", "rememberPassword"]);
  document.getElementById("username").value = data.userId || "";
  document.getElementById("rememberPassword").checked = !!data.rememberPassword;
  document.getElementById("password").value =
    data.rememberPassword && data.password ? data.password : "";
}

async function persistCredentials(username, password, rememberPassword) {
  const payload = { userId: username, rememberPassword };
  if (rememberPassword) {
    payload.password = password;
  } else {
    await chrome.storage.local.remove("password");
  }
  await chrome.storage.local.set(payload);
}

chrome.runtime.onMessage.addListener((msg) => {
  const el = statusEl();
  if (msg.type === "LOGIN_RESULT") {
    if (msg.success) {
      el.textContent = "Login flow completed.";
      el.className = "status status-success";
    } else {
      el.textContent = "Failed: " + (msg.error || "Unknown error");
      el.className = "status status-error";
    }
    return;
  }
  if (msg.type === "LOGIN_BACKGROUND_ERROR") {
    el.textContent = "Failed: " + (msg.error || "Could not run login on the page");
    el.className = "status status-error";
  }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const rememberPassword = document.getElementById("rememberPassword").checked;
  const el = statusEl();

  if (!username) {
    el.textContent = "Enter your User ID.";
    el.className = "status status-error";
    return;
  }

  await persistCredentials(username, password, rememberPassword);
  el.textContent = "Starting login…";
  el.className = "status";

  chrome.runtime.sendMessage({ type: "LOGIN", username, password }, (response) => {
    if (chrome.runtime.lastError) {
      el.textContent = chrome.runtime.lastError.message;
      el.className = "status status-error";
      return;
    }
    if (response && !response.ok) {
      el.textContent = "Failed: " + (response.error || "Could not reach the portal tab");
      el.className = "status status-error";
    }
  });
});

document.getElementById("clearBtn").addEventListener("click", async () => {
  if (!confirm("Clear saved User ID and password from this device?")) return;
  await chrome.storage.local.remove(["userId", "password", "rememberPassword"]);
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("rememberPassword").checked = false;
  const el = statusEl();
  el.textContent = "Saved data cleared.";
  el.className = "status";
});

document.addEventListener("DOMContentLoaded", loadSettings);
