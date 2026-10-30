# Stream gateway API

The contract between the site (Play → 🎮 Stream, `src/lib/stream/`) and the gateway at `https://play.levitica.duckdns.org`. Keep it stable: the site and the gateway are deployed separately. Design notes are in [DECISIONS.md](../../DECISIONS.md#stream-play--stream).

## General rules

- **Origin.** A request or WebSocket upgrade with an `Origin` other than `ALLOWED_ORIGIN` gets `403`. Requests without `Origin` (curl, the Docker healthcheck) are allowed; everything except `/health`, `/auth/login`, `/auth/refresh` and `/auth/totp/enroll` still needs a token.
- **Auth.** `Authorization: Bearer <accessToken>`. Tokens never go in a URL, and the gateway never logs headers or bodies.
- **Bodies** are JSON (`Content-Type: application/json`), at most 16 kB.
- **Errors** are `{ "error": "...", "code"?: "..." }` with a matching status. `401` means sign in again (or refresh), `503 {code: "unlinked"}` means the gateway isn't linked to MoonlightWeb yet, `503 {error: "not_configured"}` means a setting is missing on the server.

## Endpoints

### `GET /health` (no auth)

`200 {"ok": true, "mw": "up" | "down" | "unlinked", "host": "online" | "offline"}`. `ok` is false while a required setting is missing. Cached for 5 seconds.

### `POST /auth/totp/enroll` `{password}`

First run only. Returns `{otpauthUri, qrSvg, backupCodes: string[10]}` and turns two-factor sign-in on at once; `qrSvg` is an SVG of the URI to show in an `<img>`. Once a secret exists it answers `410 {code: "already_enrolled"}` forever (the owner can reset it on the server with `node dist/cli.js reset-totp`). A wrong password counts toward the lockout.

### `POST /auth/login` `{password, totp}`

`totp` is a 6-digit code or a backup code (`abcd-2345`, case and dashes don't matter; each works once). Returns `{accessToken, refreshToken, expiresIn: 900}`.

- `409 {code: "enroll_required"}`: the password is right but no TOTP is set up yet (call `enroll`).
- `401 {error: "invalid_credentials"}` for a wrong password or code; a code can't be used twice.
- `429 {error: "locked", retryAfter}` (+ `Retry-After`): 5 failures from one address lock it for 15 minutes; 20 failures from anywhere within 15 minutes lock everyone for 15 minutes. The address is the last `X-Forwarded-For` hop (Nginx Proxy Manager's).

### `POST /auth/refresh` `{refreshToken}`

Returns a new `{accessToken, refreshToken, expiresIn}`; the old refresh token stops working. Presenting a refresh token that was already used ends that whole sign-in (it was copied). Refresh tokens live 12 hours, and a sign-in ends 12 hours after the password was typed whatever happens.

### `POST /auth/logout` (auth)

Ends this sign-in (its access and refresh tokens) at once. `204`.

### `POST /auth/revoke-all` (auth)

"Sign out everywhere": ends every sign-in and stops any stream (MoonlightWeb `quit`, then `stop-session`, which closes the app). `200 {ok: true, streamEnded}`.

### `GET /turn-credentials` (auth)

`{username: "<unix expiry>:<random id>", credential: base64(HMAC-SHA1(TURN_SECRET, username)), ttl: 600, urls: ["turn:HOST:3478?transport=udp", "turn:HOST:3478?transport=tcp", "turns:HOST:5349?transport=tcp"]}`.

### `GET /apps` (auth)

`[{id: number, name: string, art: string | null}]` for the configured host (`MW_HOST_ID`, else the first paired one). `art` is a gateway path.

### `GET /apps/:id/art` (auth)

The app's box art (`image/png`, `image/jpeg` or `image/webp`). Fetch it with the bearer header and show it as a blob URL.

### `POST /sessions` (auth)

Body: `{appId, width, height, fps, bitrate?, transport?: "webrtc" | "ws" | "http", quitRunning?: boolean}`.

- `width` 320–4096 and `height` 240–2304 (rounded down to even), `fps` 24–240, `bitrate` in kbps 1000–150000 (default about 20 Mbps for 1080p60, scaled by pixels per second, 5–80 Mbps).
- `transport` `"webrtc"` (default) launches MoonlightWeb's `webrtc-dc-udp` (H.264 in a `video` DataChannel, Opus as an RTP track, an `input` DataChannel); `"ws"` launches its `wss` transport for networks where only 443 works; `"http"` also rides `wss` to MoonlightWeb but reshapes it to plain HTTP for the browser (`GET /down` + `POST /up`), for networks that block WebSockets too.
- `quitRunning: true` stops whatever runs on the host first (the "quit it and start this" answer to `app_running`). To resume a running app instead, start it by its id.

`201`:

```json
{
  "id": "16 chars",
  "transport": "webrtc",
  "signalingPath": "/sessions/<id>/signal",
  "mediaPath": "/sessions/<id>/media",
  "ticket": "one-time, 60 s",
  "iceServers": [{ "urls": ["turn:…"], "username": "…", "credential": "…" }],
  "videoCodec": "h264",
  "width": 2880,
  "height": 1800,
  "fps": 120,
  "bitrate": 50000
}
```

(`signalingPath` for `webrtc`; `mediaPath` for `ws`; `mediaPath` (the `/down` path) plus `upPath` for `http`.) Errors: `409 {code: "stream_active", id}` (one stream at a time; `DELETE` it first), `409 {code: "app_running", runningAppId}`, `503 {code: "host_busy"}`, `502 {code: "start_failed"}`.

### `GET /sessions/:id/down` (transport `http`)

The one-time ticket goes in the `Authorization: Bearer` header (never in the URL). The response is a long `application/octet-stream` chunked body: each MoonlightWeb frame is length-prefixed `[kind:1][len:4 big-endian][payload]`, `kind` 0 for a binary media frame (the same `[0x01]…`/`[0x02]…` bytes as the `ws` transport) and 1 for a JSON text notice. A browser that falls behind by 32 MB is dropped.

### `POST /sessions/:id/up` (auth) `{msgs: string[]}`

Input for the `http` transport: each entry is one JSON input message (as a string, ≤ 4096 chars), forwarded to MoonlightWeb in order. Authenticated by the access token, not a ticket, so a batch can be sent as often as needed. `204`; input is dropped silently if the stream's upstream isn't open yet.

### `POST /sessions/:id/ticket` (auth)

A fresh `{ticket, iceServers}` for reconnecting a socket.

### `DELETE /sessions/:id` (auth) `{quitApp?: boolean}`

Ends the stream. Without `quitApp` the game keeps running on the PC (Apollo disconnects); with `quitApp: true` it is closed. `204`, or `404` when that stream isn't the active one.

## WebSockets

All three check `Origin`. The first message on a session socket must be `{"type": "auth", "ticket": "<ticket>"}` within 5 seconds; a missing, wrong, expired or reused ticket closes with `4001`.

### `wss://…/sessions/:id/signal` (transport `webrtc`)

The browser is the answerer. Messages (JSON text):

| From | Message |
| --- | --- |
| gateway | `{type: "ice-config", iceServers, iceTimeoutMs}`: use these (TURN) servers with `iceTransportPolicy: "relay"` |
| gateway | `{type: "sdp", sdp}`: MoonlightWeb's offer, already verified (MW-BIND-v1) |
| gateway | `{type: "ice", candidate, mid}` |
| browser | `{type: "sdp", sdp}`: the answer (the gateway signs its fingerprint) |
| browser | `{type: "ice", candidate, mid}` |

Anything else is dropped. A failed binding check closes the socket with `1008`. The socket may be closed once the input DataChannel is open; the stream keeps running.

The offer carries an Opus audio track (`recvonly` on our side) and expects pre-negotiated DataChannels: `createDataChannel("video", {negotiated: true, id: 0, ordered: true, maxPacketLifeTime: 500})` and `createDataChannel("input", {negotiated: true, id: 2})`. Video messages are `[frame_id:4][chunk_index:2][total_chunks:2][is_keyframe:1][payload_size:4][backend_ts:4]` (big endian) followed by part of an H.264 Annex-B access unit. Input and MoonlightWeb's notices (`stats`, `session-ended`, `host-ended`, `takeover`, `revoked`, `pong`) travel on the input channel as JSON; the formats are listed in DECISIONS.md.

### `wss://…/sessions/:id/media` (transport `ws`)

After the auth message the socket carries MoonlightWeb's `wss` stream unchanged: binary `[0x01][flags][H.264 Annex-B access unit]` (flags bit 0 = keyframe) and `[0x02][0x00][Opus packet]`, plus JSON text notices. The browser sends input as JSON text (same messages as the DataChannel); binary from the browser is ignored.

### `wss://…/ws-probe`

For the connection test: echoes the first message (text or binary, up to 64 kB) and closes. No auth.

## Operations

```bash
docker exec -i stream-gateway node dist/cli.js hash-password   # password on stdin → GATEWAY_PASSWORD_HASH
docker exec -i stream-gateway node dist/cli.js link-mw         # MoonlightWeb PIN on stdin (moonlightweb --new-pin)
docker exec stream-gateway node dist/cli.js reset-totp         # forget the TOTP secret; next sign-in shows the QR
```

`link-mw` and `reset-totp` talk to the running server on `127.0.0.1:8081` inside the container, so the server stays the only writer of `/data/state.json` (mode 0600). The data volume holds the MoonlightWeb session cookie, the gateway's pairing key, the TOTP secret and hashed refresh tokens: back it up like a password.
