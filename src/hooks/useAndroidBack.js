// src/hooks/useAndroidBack.js
import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";

export function useAndroidBack({ onExit, onBack }) {
  const lastBack = useRef(0);

  useEffect(() => {
    const sub = App.addListener("backButton", ({ canGoBack }) => {
      // If the webview can go back (history length > 1), prefer app back:
      if (onBack && (canGoBack || window.history.length > 1)) {
        onBack();
        return;
      }
      // Otherwise, at a root route: require double-back within 1.2s to exit
      const now = Date.now();
      if (now - lastBack.current < 1200) {
        if (onExit) onExit();
        else App.exitApp();
      } else {
        lastBack.current = now;
        // Optional: toast/snackbar – replace with your UI if you have one
        // e.g., showToast("Press back again to exit");
      }
    });

    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [onBack, onExit]);
}
