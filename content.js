function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sets a value on an input field in a way that triggers React/Angular change detection.
 * Plain `.value =` assignments are ignored by framework-driven forms.
 */
function setNativeValue(element, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeInputValueSetter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Waits for a DOM element matching `selector` to appear.
 * Rejects after `timeout` ms if not found.
 */
function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start >= timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout: element "${selector}" not found within ${timeout}ms`));
      }
    }, 500);
  });
}

/**
 * Reliably ticks a checkbox in Angular/React apps.
 * Plain .click() often fails because the framework watches for real pointer events.
 * Strategy:
 *   1. Scroll into view so the element is visible.
 *   2. If already checked, do nothing.
 *   3. Try a real MouseEvent sequence (mousedown → mouseup → click).
 *   4. If still unchecked, fall back to directly setting .checked and firing change.
 */
function triggerCheckbox(el) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });

  if (el.checked) {
    console.log("Checkbox already checked, skipping.");
    return;
  }

  // Attempt 1: dispatch a full mouse event sequence
  ["mousedown", "mouseup", "click"].forEach(eventType => {
    el.dispatchEvent(new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  });

  // Attempt 2: if still unchecked, force it via the native setter
  if (!el.checked) {
    console.warn("MouseEvent sequence did not check the box — using fallback.");
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "checked"
    ).set;
    nativeSetter.call(el, true);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input",  { bubbles: true }));
  }

  console.log("Checkbox checked:", el.checked);
}

/**
 * Waits for a button to become enabled, then clicks it.
 * Rejects after `timeout` ms.
 */
function waitForEnabledAndClick(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) {
        clearInterval(interval);
        btn.click();
        resolve(true);
      } else if (Date.now() - start >= timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout: button "${selector}" never became enabled`));
      }
    }, 500);
  });
}

/**
 * Checks for the Dual Login popup and clicks "Login Here" if present.
 * Resolves silently if the popup is absent after timeout.
 *
 * Detection: polls for a visible button whose trimmed text is exactly
 * "Login Here" — the same text shown in the modal from the screenshot.
 * Uses offsetParent !== null to confirm the button is actually visible.
 */
async function handleDualLoginPopup(timeout = 6000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const interval = setInterval(() => {
      const allButtons = Array.from(document.querySelectorAll("button"));
      const loginHereBtn = allButtons.find(
        btn => btn.textContent.trim() === "Login Here" && btn.offsetParent !== null
      );

      if (loginHereBtn) {
        clearInterval(interval);
        console.log("Dual Login popup detected — clicking 'Login Here'.");
        loginHereBtn.click();
        resolve(true);
        return;
      }

      if (Date.now() - start >= timeout) {
        clearInterval(interval);
        console.log("No Dual Login popup detected — continuing.");
        resolve(false);
      }
    }, 400);
  });
}

async function autoLogin(username, password) {
  try {
    console.log("Waiting for username field...");
    const userInput = await waitForElement("#panAdhaarUserId");

    setNativeValue(userInput, username);
    await sleep(2000);

    console.log("Waiting for Continue button to become enabled...");
    await waitForEnabledAndClick("button.large-button-primary");
    console.log("Clicked Continue after username.");
    await sleep(3000);

    if (password) {
      console.log("Waiting for password checkbox...");
      // The real checkbox input is #passwordCheckBox-input (inside the mat-checkbox wrapper).
      // Angular Material listens on the <label>, not the <input> — clicking the label
      // is the only reliable way to trigger its (change) handler.
      const checkboxLabel = await waitForElement("label[for='passwordCheckBox-input']");
      await sleep(500);
      checkboxLabel.click();
      await sleep(1000);
      console.log("Checked secure access checkbox.");

      console.log("Waiting for password field...");
      const passwordField = await waitForElement("#loginPasswordField");
      passwordField.focus();
      await sleep(300);
      setNativeValue(passwordField, password);
      passwordField.dispatchEvent(new Event("blur", { bubbles: true }));
      await sleep(2000);

      console.log("Waiting for Continue button on password page...");
      await waitForEnabledAndClick("button.large-button-primary");
      console.log("Clicked Continue after password.");
      await sleep(3000);

      // Handle potential Dual Login popup
      await handleDualLoginPopup();
      await sleep(3000);

      console.log("Login flow completed successfully.");
    } else {
      console.log("No password provided — manual interaction required.");
    }

    // Notify popup of success
    chrome.runtime.sendMessage({ type: "LOGIN_RESULT", success: true });

  } catch (e) {
    console.error("Login automation failed:", e.message);
    chrome.runtime.sendMessage({ type: "LOGIN_RESULT", success: false, error: e.message });
  }
}

// Listen for messages forwarded by background.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "LOGIN") {
    autoLogin(msg.username, msg.password);
  }
});