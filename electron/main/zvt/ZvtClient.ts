import { EventEmitter } from "node:events";
import net from "node:net";
import tls from "node:tls";
import { logger } from "../logger";

export type ZvtTlsOptions = {
  enabled: boolean;
  ca?: Buffer;
  rejectUnauthorized?: boolean;
};

export type ZvtTimeoutOptions = {
  connectMs?: number;
  idleMs?: number;
};

export type ZvtConnectOptions = {
  host: string;
  port: number;
  tls?: ZvtTlsOptions;
  timeouts?: ZvtTimeoutOptions;
};

type SocketInstance = net.Socket | tls.TLSSocket;

type ZvtClientEvents = {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  rawData: (data: Buffer) => void;
  timeout: () => void;
};

export declare interface ZvtClient {
  on<U extends keyof ZvtClientEvents>(
    event: U,
    listener: ZvtClientEvents[U]
  ): this;
  once<U extends keyof ZvtClientEvents>(
    event: U,
    listener: ZvtClientEvents[U]
  ): this;
  off<U extends keyof ZvtClientEvents>(
    event: U,
    listener: ZvtClientEvents[U]
  ): this;
  emit<U extends keyof ZvtClientEvents>(
    event: U,
    ...args: Parameters<ZvtClientEvents[U]>
  ): boolean;
}

export class ZvtClient extends EventEmitter {
  #socket?: SocketInstance;

  connect(options: ZvtConnectOptions) {
    this.disconnect();
    const { host, port, tls: tlsOptions, timeouts } = options;
    logger.info(
      { host, port, tlsEnabled: tlsOptions?.enabled },
      "zvt connect requested"
    );

    try {
      const socket = tlsOptions?.enabled
        ? tls.connect({
            host,
            port,
            ca: tlsOptions.ca ? [tlsOptions.ca] : undefined,
            rejectUnauthorized: tlsOptions.rejectUnauthorized ?? true,
          })
        : net.createConnection({ host, port });

      if (timeouts?.idleMs) {
        socket.setTimeout(timeouts.idleMs);
      }

      let connectTimeout: NodeJS.Timeout | undefined;
      if (timeouts?.connectMs) {
        connectTimeout = setTimeout(() => {
          logger.warn({ timeout: timeouts.connectMs }, "zvt connect timeout");
          socket.destroy(new Error("Connect timeout"));
        }, timeouts.connectMs);
      }

      socket.once("connect", () => {
        if (connectTimeout) clearTimeout(connectTimeout);
        logger.info("zvt socket connected");
        this.emit("connected");
      });

      socket.on("data", (data: Buffer) => {
        logger.debug(
          { length: data.length, hex: data.toString("hex") },
          "zvt data received"
        );
        this.emit("rawData", data);
      });

      socket.on("timeout", () => {
        logger.warn("zvt socket timeout");
        this.emit("timeout");
        socket.destroy(new Error("Socket timeout"));
      });

      socket.on("error", (error) => {
        if (connectTimeout) clearTimeout(connectTimeout);
        logger.error({ err: error }, "zvt socket error");
        this.emit(
          "error",
          error instanceof Error ? error : new Error(String(error))
        );
      });

      socket.on("close", () => {
        if (connectTimeout) clearTimeout(connectTimeout);
        logger.info("zvt socket closed");
        this.emit("disconnected");
      });

      this.#socket = socket;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err }, "zvt connect failed");
      this.emit("error", err);
    }
  }

  disconnect() {
    if (this.#socket) {
      logger.info("zvt disconnect requested");
      this.#socket.destroy();
      this.#socket.removeAllListeners();
      this.#socket = undefined;
    }
  }

  send(frame: Buffer) {
    if (!this.#socket) {
      throw new Error("Socket not connected");
    }
    this.#socket.write(frame);
  }

  /**
   * Start a card payment (Authorization – 06 01)
   * @param amountCents Amount in minor units (e.g., 1299 => €12.99)
   * @param opts Optional configuration
   */
  public startPayment(
    amountCents: number,
    opts?: {
      currency?: "EUR" | "USD";
      operationTimeoutMs?: number;
      onStatus?: (text: string) => void;
      onReceiptLine?: (text: string) => void;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    rrn?: string;
    authCode?: string;
  }> {
    if (!this.#socket) throw new Error("Socket not connected");

    const operationTimeoutMs = opts?.operationTimeoutMs ?? 90_000;

    // --- helpers ---
    const ACK = Buffer.from([0x80, 0x00, 0x00]);
    const buildApdu = (cla: number, ins: number, data?: Buffer) =>
      Buffer.concat([
        Buffer.from([cla, ins, data?.length ?? 0]),
        data ?? Buffer.alloc(0),
      ]);

    const amountToBcd = (minor: number) => {
      const s = String(minor).padStart(8, "0"); // 8 digits -> 4 bytes
      const out = Buffer.alloc(4);
      for (let i = 0; i < 4; i++) {
        const hi = parseInt(s[i * 2], 10);
        const lo = parseInt(s[i * 2 + 1], 10);
        out[i] = (hi << 4) | lo;
      }
      // Bitmap 0x04 (Amount) + len + data
      return Buffer.concat([Buffer.from([0x04, out.length]), out]);
    };

    const encodeTlv = (items: Array<{ tag: number; value: Buffer }>) => {
      const parts: Buffer[] = [];
      for (const it of items)
        parts.push(
          Buffer.from([it.tag]),
          Buffer.from([it.value.length]),
          it.value
        );
      const body = Buffer.concat(parts);
      return Buffer.concat([Buffer.from([0x06, body.length]), body]); // 0x06 container
    };

    const parseApdu = (
      buf: Buffer
    ): { cla: number; ins: number; len: number; data: Buffer } | null => {
      if (buf.length < 3) return null;
      const cla = buf[0],
        ins = buf[1],
        len = buf[2];
      if (buf.length < 3 + len) return null;
      return {
        cla,
        ins,
        len,
        data: len ? buf.slice(3, 3 + len) : Buffer.alloc(0),
      };
    };

    // --- build payload ---
    const amountField = amountToBcd(amountCents);
    const tlv = encodeTlv([]); // add TLVs here if needed later
    const payload = Buffer.concat([amountField, tlv]);

    // --- promise orchestration ---
    return new Promise((resolve) => {
      let finished = false;
      let buffer = Buffer.alloc(0);
      const finish = (res: {
        success: boolean;
        message?: string;
        rrn?: string;
        authCode?: string;
      }) => {
        if (finished) return;
        finished = true;
        this.#socket?.off("data", onData);
        clearTimeout(t);
        resolve(res);
      };

      const t = setTimeout(
        () =>
          finish({ success: false, message: "Timeout waiting for completion" }),
        operationTimeoutMs
      );

      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        // process possibly multiple APDUs in buffer
        while (buffer.length >= 3) {
          const apdu = parseApdu(buffer);
          if (!apdu) break;
          const total = 3 + apdu.len;
          // slice buffer
          buffer = buffer.slice(total);

          // 04 0F Status Information
          if (apdu.cla === 0x04 && apdu.ins === 0x0f) {
            const text = apdu.data.toString("utf8");
            opts?.onStatus?.(text || "STATUS");
            this.send(ACK);
            continue;
          }

          // 06 D1 / 06 D3 Receipt lines / text block
          if (apdu.cla === 0x06 && (apdu.ins === 0xd1 || apdu.ins === 0xd3)) {
            const text = apdu.data.toString("utf8");
            opts?.onReceiptLine?.(text);
            this.send(ACK);
            continue;
          }

          // 06 0F Completion
          if (apdu.cla === 0x06 && apdu.ins === 0x0f) {
            const txt = apdu.data.toString("utf8");
            const approved = /APPROV|OK|SUCCESS/i.test(txt);
            const rrn = /RRN[:=]([0-9A-Za-z-]+)/i.exec(txt)?.[1];
            const auth = /AUTH[:=]([0-9A-Za-z-]+)/i.exec(txt)?.[1];
            this.send(ACK);
            return finish({
              success: approved,
              message: txt,
              rrn,
              authCode: auth,
            });
          }

          // default: be polite and ACK to reduce retries
          this.send(ACK);
        }
      };

      this.#socket!.on("data", onData);

      // finally send Authorization (06 01)
      const frame = buildApdu(0x06, 0x01, payload);
      logger.info({ amountCents }, "zvt authorization (06 01) send");
      this.send(frame);
    });
  }

  abortPayment() {
    if (!this.#socket) {
      throw new Error("Socket not connected");
    }
    const buildApdu = (cla: number, ins: number, data?: Buffer) =>
      Buffer.concat([
        Buffer.from([cla, ins, data?.length ?? 0]),
        data ?? Buffer.alloc(0),
      ]);
    const frame = buildApdu(0x06, 0x02); // Abort Transaction (06 02)
    logger.info("zvt abort payment (06 02) send");
    this.send(frame);
  }
}
