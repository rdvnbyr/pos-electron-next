# POS App – Electron + Next.js ZVT Demo

This project showcases a desktop POS application that wraps a Next.js UI inside an Electron shell and opens a TCP/IP socket to a ZVT payment terminal. The goal is to provide an end-to-end example covering secure main/renderer IPC, configurable terminal settings, and a simple payment trigger flow written in TypeScript.

## Features
- Electron main process with a typed IPC bridge exposed through a preload script.
- Next.js (App Router) renderer that renders a terminal settings form with TLS, timeout, and currency options.
- `ZvtClient` service that handles TCP/TLS sockets, APDU framing helpers, and a `startPayment` helper method for quick test authorisations.
- Shared TypeScript definitions via an internal workspace package.
- Dev workflow powered by npm workspaces and `concurrently`, compiling Electron sources with `tsup`.

## Repository Layout
```
pos-app/
├─ client/               # Next.js 15 renderer (React 19, TypeScript)
├─ electron/             # Electron main & preload source (tsup build)
│  └─ main/zvt/          # ZVT socket client + helpers
├─ packages/
│  └─ shared-types/      # IPC/shared typings
├─ package.json          # Workspace root scripts & tooling
└─ tsconfig.*.json       # Shared TypeScript configs
```

## Prerequisites
- Node.js 20+
- npm 10+
- macOS or Windows 10/11 for development
- Access to a ZVT terminal (IP/port, optional TLS certificates)

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Start Next.js (client), tsup watcher (Electron), and the Electron shell
npm run dev
```

The renderer will be served at `http://localhost:3000`, and Electron bootstraps once that port is ready.

### Local Mock Terminal
For development without a physical terminal, there is a simple TCP mock under `_mocks/mock-pos.js`. It accepts incoming APDUs and responds with basic status/completion frames.

```bash
# Terminal A (mock ZVT)
node _mocks/mock-pos.js --host 0.0.0.0 --port 20007

# Terminal B (POS app)
npm run dev
```

In the POS UI set `Host` to `127.0.0.1` (or your LAN IP) and `Port` to `20007`. The mock prints activity to stdout so you can trace requests and responses.

### Building Production Bundles
```bash
npm run build
```

This compiles the Next.js app and the Electron main/preload bundles under `electron/dist`.

## Configuring the Terminal
In the UI, open **Kartenterminal Einstellungen (ZVT)** and fill in:
- **IP-Adresse / Port**: Network location of the payment terminal.
- **Terminal-ID, Verbindungstyp, Passwort**: Optional identifiers and credentials.
- **Timeouts**: Connection (handshake) and idle timeouts in milliseconds.
- **TLS**: Toggle TLS, provide PEM CA certificates, and decide whether to enforce certificate validation.

Config values are sent to the main process via IPC and hydrate the `ZvtClient` before opening the socket.

## Triggering a Test Payment
Once connected, use **Start Test Payment**. The renderer calls `window.ecr.startPayment`, which proxies to the main process to send a simple authorisation frame (06 01) with an example amount (€12.99). Status, receipt lines, and completion messages are forwarded back as `ZvtEvent`s and appear in the event log panel.

_Note_: Only TCP/IP is implemented today. Selecting “Seriell” raises a friendly error until serial transport support is added.

## Logging & Observability
- Main process uses `pino` for structured logs (JSON by default).
- Renderer displays real-time events with timestamps for quick troubleshooting.

## Roadmap Ideas
- Implement serial (RS-232) transport.
- Add reconnection and heartbeat flows for terminals with strict idle policies.
- Extend the TLV/bitmap helpers into a reusable `@pos-app/zvt-codec`.
- Integrate receipt printing and wider Shopware integration hooks.

## License
This project is provided as-is for demonstration and internal integration guidance. Adjust licensing text before publishing.
