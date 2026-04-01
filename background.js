const LOGIN_URL = "https://eportal.incometax.gov.in/iec/foservices/#/login";

function notifyLoginError(error) {
  chrome.runtime.sendMessage({ type: "LOGIN_BACKGROUND_ERROR", error }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "LOGIN") return;
  const { username, password } = msg;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      sendResponse({ ok: false, error: "No active tab" });
      return;
    }

    const alreadyOnPortal = tab.url && tab.url.includes("eportal.incometax.gov.in");

    if (alreadyOnPortal) {
      sendResponse({ ok: true });
      chrome.tabs.sendMessage(tab.id, { type: "LOGIN", username, password }, () => {
        if (chrome.runtime.lastError) {
          injectAndLogin(tab.id, username, password, notifyLoginError);
        }
      });
      return;
    }

    chrome.tabs.update(tab.id, { url: LOGIN_URL }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });

      const listener = (tabId, changeInfo, updatedTab) => {
        if (
          tabId !== tab.id ||
          changeInfo.status !== "complete" ||
          !updatedTab.url ||
          !updatedTab.url.includes("eportal.incometax.gov.in")
        ) {
          return;
        }
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => injectAndLogin(tab.id, username, password, notifyLoginError), 2000);
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });

  return true;
});

function injectAndLogin(tabId, username, password, onError) {
  chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
    if (chrome.runtime.lastError) {
      onError(chrome.runtime.lastError.message);
      return;
    }
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: "LOGIN", username, password }, () => {
        if (chrome.runtime.lastError) {
          onError(chrome.runtime.lastError.message);
        }
      });
    }, 500);
  });
}
