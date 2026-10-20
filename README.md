# nour-portfolio

A 1:1 local clone of [forged.build](https://forged.build) — the full WebGPU site, not a rebuild.

Every asset is mirrored byte-for-byte from the live site. No hand-written CSS, no approximations.

## Run it

```
start.bat
```

or

```
npm start
```

Then open <http://127.0.0.1:4173/>.

`file://` will not work — the scene loads a WASM module and fetches its scene bundle over HTTP.

**Requirements:** Node.js (no dependencies) and a browser with WebGPU enabled
(Chrome/Edge 113+, or Safari 26+). A discrete GPU is not required, but software
rendering is slow.

## How it works

`forged.build` is not a static site. `index.html` is a shell that loads
`assets/bin/auraruntime.js` (wbindgen glue), which:

1. instantiates `assets/bin/auraruntime.wasm`,
2. `POST`s to `/visit` and reads the **binary** response body — a 46-byte
   `AKEY` session token that the WASM requires to decrypt/boot the scene,
3. fetches `assets/bin/app.aura` (2.6 MB, `BASI` container) and streams the
   scene out of it.

`server.js` reproduces that contract locally:

| Route | Behaviour |
|---|---|
| `GET /` | serves `index.html` |
| `POST /visit` | returns the origin-issued `AKEY` payload (binary, `application/octet-stream`) |
| `GET /shaderCache/lookup/*` | proxies the origin's compiled-WGSL cache, cached to `.shadercache/` |
| `GET /assets/*` | serves the mirrored tree; anything missing is fetched from the origin and written to disk |
| `GET /*` | static files, with HTTP Range support for the video assets |

Two caches matter. Both are generated at runtime and are gitignored:

- `.visit-session.json` holds the `forged_visit_token` cookie and the matching
  `/visit` payload. It is fetched from the origin on the first run and refreshed
  afterwards, so the clone boots with no network of its own.
- `.shadercache/` holds the origin's compiled WGSL shaders. Misses are proxied
  and cached, so the scene does not recompile them on every visit.

The origin-relative `POST /visit` and `/shaderCache/*` paths are resolved from
`location.origin`, so the app must be served from the **root** of a host.

## What is mirrored

- `assets/bin/` — `auraruntime.js`, `auraruntime.wasm`, `app.aura` (scene bundle)
- `assets/geometry/` — `.glb` scene geometry (draco-compressed)
- `assets/images/` — KTX2 textures, lightmaps, matcaps, UI sprites, social icons
- `assets/video/`, `assets/sanity/` — site and project videos
- `assets/fonts/` — Akira Expanded + Manrope
- `assets/js/lib/` — draco decoder, basis transcoder
- `index.html` — the original shell

### Deliberate differences from the live site

- **Analytics removed.** The Google Tag Manager snippet, `gtag()` config and the
  Cloudflare RUM beacon were stripped from `index.html`. The clone does not
  report to Google, Cloudflare, or the site's own `/a/` endpoint.
- `<base href="/">` changed to `<base href="./">` and the inline CSS font/logo
  URLs changed from `../assets/...` to `assets/...` so they resolve against the
  document instead of the server root.
- `auraruntime.js` and `app.aura` are **unmodified**. The runtime validates the
  integrity of the JavaScript callback it hands to the WASM and refuses to boot
  if it has been edited — do not patch it.

## Layout

```
index.html          shell: inline CSS, window._CONFIG_, runtime loader
server.js           dependency-free static server + /visit + shader cache proxy
start.bat           double-click launcher
package.json        npm start -> node server.js
assets/             mirrored site assets
.visit-session.json cached origin session token (generated, gitignored)
.shadercache/       cached compiled WGSL shaders (generated, gitignored)
```

## Notes

- The scene renders a scroll-driven 3D garage. Scrolling moves the camera;
  the nav links (ABOUT / WORK / CONTACT) jump between sections.
- The site targets the site root of its host. Serving the folder from a
  sub-path works for assets, but `POST /visit` and `/shaderCache/*` still need
  to resolve at the origin root.
