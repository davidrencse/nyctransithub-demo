# NYC Transit Hub

A monochrome, WebGL-first front end for New York City subway service, inspired by Linear, Framer, and ui.watermelon.sh.

- **Interactive map**: a raw WebGL2 renderer draws the subway trunk lines as glowing ribbons on a tilted dot-grid plane. It shows stations, animated trains, and line focus with real MTA colors. Drag to pan, Ctrl+scroll to zoom, and click a station to open it.
- **Service status**: live alerts from the MTA's public GTFS-realtime JSON feed, refreshed every minute.
- **Accessibility**: live elevator and escalator outages, filterable by station, line, or equipment type.
- **Favorites and alerts**: save stations and lines, and get browser notifications when a saved line's service gets worse.
- **Multilingual**: English, Español, 中文, Русский, 한국어, and Kreyòl ayisyen.
- **Accounts**: Firebase Authentication (email/password and Google). Until `firebase-config.js` is filled in, accounts work in demo mode, stored in the browser only.

Train positions are simulated. Alerts and outages are live.

## Run

No build step. Serve the folder over HTTP:

```bash
python -m http.server 4317
```

Then open http://localhost:4317.

## Rider reviews (Google)

The station card can show recent Google reviews for that station. It flags reviews that mention delays, long waits, or skipped stops, and it re-checks every 10 minutes while the page is open. Reviews are riders' opinions, not live service status. Google returns at most 5 reviews per place, and they can be days or months old. The live delay status comes from the MTA feed.

1. In Google Cloud, enable **Maps JavaScript API** and **Places API (New)**.
2. Create an API key restricted to your site's HTTP referrers.
3. Paste it into `google-config.js`.

Each station opened costs one Text Search and one Place Details call with reviews, both billed by Google. Leave the key empty to hide the section.

## Firebase

1. Create a Firebase project and add a web app.
2. Paste its config into `firebase-config.js`.
3. Under Authentication → Sign-in method, enable Email/Password and Google.
