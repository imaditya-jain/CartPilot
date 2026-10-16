/**
 * CartPilot AI chatbot loader.
 *
 * Usage (paste once, before </body>, in theme.liquid):
 *   <script src="https://YOUR_APP_DOMAIN/chatbot/loader.js" data-store-id="YOUR_STORE_ID" async></script>
 *
 * This script never contains Shopify Admin credentials, NVIDIA API keys, or any server secret —
 * it only creates an iframe pointing at the app's own public widget page, which itself fetches
 * public, non-sensitive display config at runtime.
 */
(function () {
  "use strict";

  if (window.__cartpilotWidgetLoaded) return;
  window.__cartpilotWidgetLoaded = true;

  var currentScript =
    document.currentScript || document.querySelector('script[src*="chatbot/loader.js"]');
  if (!currentScript) return;

  var storeId = currentScript.getAttribute("data-store-id");
  if (!storeId) {
    console.error("[CartPilot AI] Missing required data-store-id attribute on the loader script.");
    return;
  }

  var appOrigin;
  try {
    appOrigin = new URL(currentScript.src).origin;
  } catch (e) {
    console.error("[CartPilot AI] Could not determine app origin from script src.");
    return;
  }

  // Fire-and-forget heartbeat so the dashboard can show "chatbot is live" — never reads the
  // response, so no CORS handling is needed on the receiving endpoint.
  try {
    var pingUrl = appOrigin + "/api/chatbot/ping";
    var pingBody = JSON.stringify({ storeId: storeId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(pingUrl, pingBody);
    } else {
      fetch(pingUrl, { method: "POST", body: pingBody, keepalive: true, mode: "no-cors" });
    }
  } catch (e) {
    // Never let a ping failure block the widget itself from loading.
  }

  var LAUNCHER_SIZE = 64;
  var position = currentScript.getAttribute("data-position") || "bottom-right";
  var isRight = position !== "bottom-left";

  var style = document.createElement("style");
  style.textContent =
    "#cartpilot-widget-container{" +
    "position:fixed;bottom:16px;" +
    (isRight ? "right:16px;" : "left:16px;") +
    "width:" +
    LAUNCHER_SIZE +
    "px;height:" +
    LAUNCHER_SIZE +
    "px;" +
    "z-index:2147483000;transition:width .2s ease,height .2s ease;" +
    "max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);" +
    "}" +
    "#cartpilot-widget-iframe{border:0;width:100%;height:100%;display:block;background:transparent;}";
  document.head.appendChild(style);

  var container = document.createElement("div");
  container.id = "cartpilot-widget-container";
  container.style.display = "none"; // hidden until the widget confirms it's published

  var iframe = document.createElement("iframe");
  iframe.id = "cartpilot-widget-iframe";
  iframe.src = appOrigin + "/widget/" + encodeURIComponent(storeId);
  iframe.title = "Chat with us";
  iframe.setAttribute("allowtransparency", "true");

  container.appendChild(iframe);
  document.body.appendChild(container);

  window.addEventListener("message", function (event) {
    if (event.origin !== appOrigin) return;
    var data = event.data;
    if (!data || data.source !== "cartpilot-widget") return;

    if (data.type === "ready") {
      container.style.display = data.published ? "block" : "none";
      return;
    }

    if (data.type === "resize") {
      container.style.width = data.width + "px";
      container.style.height = data.height + "px";
    }
  });
})();
