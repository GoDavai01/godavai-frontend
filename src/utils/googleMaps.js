// src/utils/googleMaps.js
import { Loader } from "@googlemaps/js-api-loader";

const KEY = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

let _loaderPromise;
let _loaded = false;

/** Load Maps JS once. Always include 'marker' + 'places' by default. */
export function loadGoogleMaps(libraries = ["places", "marker"]) {
  if (!KEY) {
    console.error("❌ REACT_APP_GOOGLE_MAPS_API_KEY is missing in the front-end build.");
  }
  if (!_loaderPromise) {
    const uniq = Array.from(new Set(libraries.concat(["places", "marker"])));
    const loader = new Loader({
      apiKey: KEY,
      version: "weekly",
      libraries: uniq,
    });
    _loaderPromise = loader.load().then((g) => {
      _loaded = true;
      return g;
    });
  }
  return _loaderPromise;
}
