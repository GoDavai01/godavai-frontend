// src/utils/googleMaps.js
import { Loader } from "@googlemaps/js-api-loader";

// IMPORTANT: CRA needs REACT_APP_ prefix
const KEY = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

// Memoize a single loader promise so we never double-load the script
let _loaderPromise;

export function loadGoogleMaps(libraries = ["places"]) {
  if (!KEY) {
    // Fail fast with a clear console message (no key leaks)
    console.error("❌ REACT_APP_GOOGLE_MAPS_API_KEY is missing in the front-end build.");
  }
  if (!_loaderPromise) {
    const loader = new Loader({
      apiKey: KEY,
      version: "weekly",
      libraries,
    });
    _loaderPromise = loader.load();
  }
  return _loaderPromise;
}