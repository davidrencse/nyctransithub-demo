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

## Firebase

1. Create a Firebase project and add a web app.
2. Paste its config into `firebase-config.js`.
3. Under Authentication → Sign-in method, enable Email/Password and Google.
