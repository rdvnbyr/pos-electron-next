#!/usr/bin/env node
/**
 * Mock ZVT POS Server
 * A lightweight TCP/TLS server that emulates a subset of ZVT terminal behavior
 * for ECR-side socket integration tests. NO REAL PAYMENTS.
 *
 * Supported APDUs (minimal):
 *  - 06 70 00 : Diagnosis -> sends 04 0F (Status) then 06 0F (Completion)
 *  - 06 01 .. : Authorization -> sends 04 0F (Status), optional receipt lines (06 D1), then 06 0F
 *  - 06 1E 00 : Abort -> sends 06 0F with decline-ish completion
 *
 * Frames are simplified: [CLA, INS, LEN, ...DATA]. No extra framing/LRC.
 * Adjust according to your terminal vendor's requirements.
 */

const net = require("node:net");
const tls = require("node:tls");
const fs = require("node:fs");
const path = require("node:path");

// ---- CLI args ----
const args = require("node:process").argv.slice(2);
const arg = (name, def) => {
  const i = args.findIndex(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`)
  );
  if (i === -1) return def;
  const v = args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
  return v ?? def;
};

const PORT = Number(arg("port", 20007));
const HOST = arg("host", "0.0.0.0");
const USE_TLS = ["1", "true", "yes"].includes(
  String(arg("tls", "false")).toLowerCase()
);
const CERT = arg("cert", path.join(__dirname, "cert.pem"));
const KEY = arg("key", path.join(__dirname, "key.pem"));
const VERBOSE = ["1", "true", "yes"].includes(
  String(arg("verbose", "true")).toLowerCase()
);

// ---- Helpers ----
const hex = (buf) => buf.toString("hex");
const log = (...m) => VERBOSE && console.log("[MOCK]", ...m);

const ACK = Buffer.from([0x80, 0x00, 0x00]);

const apdu = {
  build: (cla, ins, data) =>
    Buffer.concat([
      Buffer.from([cla, ins, data?.length ?? 0]),
      data ?? Buffer.alloc(0),
    ]),
  parse: (buf) => {
    if (!buf || buf.length < 3) return null;
    const cla = buf[0],
      ins = buf[1],
      len = buf[2];
    const total = 3 + len;
    if (buf.length < total) return null;
    return {
      cla,
      ins,
      len,
      data: len ? buf.slice(3, total) : Buffer.alloc(0),
      rest: buf.slice(total),
    };
  },
};

function receiptLine(text) {
  // 06 D1 <len> <ascii>
  const payload = Buffer.from(text, "utf8");
  return apdu.build(0x06, 0xd1, payload);
}

function statusInfo(text) {
  // 04 0F <len> <ascii or vendor data> (simplified)
  const payload = Buffer.from(text ?? "STATUS:OK", "utf8");
  return apdu.build(0x04, 0x0f, payload);
}

function completion(ok = true) {
  // 06 0F <len> <ascii>
  const payload = Buffer.from(
    ok ? "COMPLETION:APPROVED" : "COMPLETION:DECLINED",
    "utf8"
  );
  return apdu.build(0x06, 0x0f, payload);
}

function respondAuthorization(socket, amountInfo) {
  // 1) status
  const s = statusInfo(`AUTH: processing ${amountInfo ?? ""}`);
  socket.write(s);
  log(">>", hex(s));
  // (ECR may send ACK here; we keep it simple and do not wait)

  // 2) optional receipt lines
  const lines = [
    "*** DEMO RECEIPT ***",
    "CARD: **** **** **** 1234",
    "AMOUNT: " + (amountInfo || "N/A"),
    "RESULT: APPROVED",
  ];
  for (const l of lines) {
    const rl = receiptLine(l);
    socket.write(rl);
    log(">>", hex(rl));
  }

  // 3) completion
  const c = completion(true);
  socket.write(c);
  log(">>", hex(c));
}

function respondDiagnosis(socket) {
  const s = statusInfo("DIAG:OK");
  socket.write(s);
  log(">>", hex(s));
  const c = completion(true);
  socket.write(c);
  log(">>", hex(c));
}

function respondAbort(socket) {
  const c = completion(false);
  socket.write(c);
  log(">>", hex(c));
}

function handleClient(socket) {
  log("client connected from", socket.remoteAddress + ":" + socket.remotePort);
  let buf = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    log("<<", hex(chunk));

    // Process multiple APDUs in the buffer
    while (true) {
      const p = apdu.parse(buf);
      if (!p) break;
      const { cla, ins, data, rest } = p;
      buf = rest;

      // ACK from ECR?
      if (cla === 0x80 && ins === 0x00) {
        log("ECR ACK received");
        continue;
      }

      // Minimal routing
      if (cla === 0x06 && ins === 0x70) {
        // Diagnosis
        respondDiagnosis(socket);
        continue;
      }
      if (cla === 0x06 && ins === 0x01) {
        // Authorization
        let amountInfo = "";
        try {
          // naive decode: search for Amount bitmap 04 .. (len=4 BCD) inside data
          const idx = data.indexOf(0x04);
          if (idx !== -1 && data.length >= idx + 2 + 4) {
            const len = data[idx + 1];
            const b = data.slice(idx + 2, idx + 2 + len);
            amountInfo = "€ " + bcdToAmount(b);
          }
        } catch {}
        respondAuthorization(socket, amountInfo);
        continue;
      }
      if (cla === 0x06 && ins === 0x1e) {
        // Abort
        respondAbort(socket);
        continue;
      }

      // Default: echo status + completion to keep client happy
      const s = statusInfo("UNSUPPORTED: " + toOpcode(cla, ins));
      socket.write(s);
      log(">>", hex(s));
      const c = completion(true);
      socket.write(c);
      log(">>", hex(c));
    }
  });

  socket.on("error", (e) => log("socket error", e.message));
  socket.on("close", () => log("client closed"));
}

function toOpcode(cla, ins) {
  return `${hexByte(cla)}-${hexByte(ins)}`;
}
function hexByte(n) {
  return n.toString(16).padStart(2, "0");
}

function bcdToAmount(b) {
  // Interpret 4-byte BCD as cents: 00 00 12 34 -> 12.34
  let digits = "";
  for (const byte of b) {
    digits += ((byte >> 4) & 0x0f).toString();
    digits += (byte & 0x0f).toString();
  }
  const v = parseInt(digits, 10);
  const euros = (v / 100).toFixed(2);
  return euros;
}

function start() {
  if (USE_TLS) {
    const options = {
      key: fs.readFileSync(KEY),
      cert: fs.readFileSync(CERT),
      requestCert: false,
    };
    const server = tls.createServer(options, handleClient);
    server.listen(PORT, HOST, () =>
      console.log(`[MOCK] TLS listening on ${HOST}:${PORT}`)
    );
  } else {
    const server = net.createServer(handleClient);
    server.listen(PORT, HOST, () =>
      console.log(`[MOCK] TCP listening on ${HOST}:${PORT}`)
    );
  }
}

start();
