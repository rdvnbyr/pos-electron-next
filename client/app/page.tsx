"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ZvtEvent } from "@pos-app/shared-types/ipc";
import { Button } from "@/components/ui/button";

type ConnectionType = "tcp" | "serial";
type Currency = "EUR" | "USD";

type ConnectionForm = {
  host: string;
  port: string;
  terminalId: string;
  connectionType: ConnectionType;
  tlsEnabled: boolean;
  rejectUnauthorized: boolean;
  caCertPem: string;
  connectMs: string;
  idleMs: string;
  password: string;
  currency: Currency;
};

const defaultForm: ConnectionForm = {
  host: "192.168.1.100",
  port: "22000",
  terminalId: "12345678",
  connectionType: "tcp",
  tlsEnabled: false,
  rejectUnauthorized: true,
  caCertPem: "",
  connectMs: "5000",
  idleMs: "30000",
  password: "",
  currency: "EUR",
};

export default function TerminalSetupPage() {
  const [form, setForm] = useState<ConnectionForm>(defaultForm);
  const [status, setStatus] = useState("Disconnected");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);

  useEffect(() => {
    if (!window?.ecr) return;

    const unsubscribe = window.ecr.onZvtEvent((event: ZvtEvent) => {
      const timestamp = new Date().toISOString();
      setLog((entries) => [
        `${timestamp} | ${event.type} | ${JSON.stringify(event)}`,
        ...entries,
      ]);

      switch (event.type) {
        case "connected":
          setStatus("Connected");
          break;
        case "disconnected":
          setStatus("Disconnected");
          break;
        case "error":
          setStatus(`Error: ${event.message}`);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, []);

  const parsedConfig = useMemo(() => {
    const port = Number.parseInt(form.port, 10);
    const connectMs = Number.parseInt(form.connectMs, 10);
    const idleMs = Number.parseInt(form.idleMs, 10);

    return {
      host: form.host.trim(),
      port: Number.isFinite(port) ? port : 0,
      terminalId: form.terminalId.trim() || undefined,
      connectionType: form.connectionType,
      currency: form.currency,
      password: form.password || undefined,
      tls: form.tlsEnabled
        ? {
            enabled: true,
            caCertPem: form.caCertPem.trim() || undefined,
            rejectUnauthorized: form.rejectUnauthorized,
          }
        : { enabled: false as const },
      timeouts: {
        connectMs: Number.isFinite(connectMs) ? connectMs : undefined,
        idleMs: Number.isFinite(idleMs) ? idleMs : undefined,
      },
    };
  }, [form]);

  const updateForm = useCallback(
    <K extends keyof ConnectionForm>(key: K, value: ConnectionForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!window?.ecr) return;

      setBusy(true);
      try {
        const result = await window.ecr.connectTerminal(parsedConfig);
        setStatus(
          result.success
            ? "Connecting…"
            : `Failed: ${result.message ?? "Unknown error"}`
        );
        if (!result.success && result.message) {
          setLog((entries) => [
            `${new Date().toISOString()} | connect-error | ${result.message}`,
            ...entries,
          ]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed: ${message}`);
        setLog((entries) => [
          `${new Date().toISOString()} | connect-error | ${message}`,
          ...entries,
        ]);
      } finally {
        setBusy(false);
      }
    },
    [parsedConfig]
  );

  const handleDisconnect = useCallback(async () => {
    if (!window?.ecr) return;
    setBusy(true);
    try {
      await window.ecr.disconnectTerminal();
      setStatus("Disconnected");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleTestPayment = useCallback(async () => {
    if (!window?.ecr) return;
    setPaymentBusy(true);
    const timestamp = new Date().toISOString();
    try {
      const result = await window.ecr.startPayment({
        amountCents: 1299,
        currency: form.currency,
      });
      setLog((entries) => [
        `${timestamp} | test-payment | ${JSON.stringify(result)}`,
        ...entries,
      ]);
      if (!result.success && result.message) {
        setStatus(`Payment failed: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLog((entries) => [
        `${timestamp} | test-payment-error | ${message}`,
        ...entries,
      ]);
      setStatus(`Payment error: ${message}`);
    } finally {
      setPaymentBusy(false);
    }
  }, [form.currency]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <section className="w-full lg:max-w-3xl border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/70 backdrop-blur px-8 py-10 lg:px-12 lg:py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">
            Payment Terminal Settings (ZVT)
          </h1>
          <p className="text-sm text-slate-400">
            Configure and manage your payment terminal connection here.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span>IP</span>
              <input
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                type="text"
                required
                value={form.host}
                onChange={(event) => updateForm("host", event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span>Port</span>
              <input
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                type="number"
                min={1}
                max={65535}
                required
                value={form.port}
                onChange={(event) => updateForm("port", event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span>Terminal-ID</span>
              <input
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                type="text"
                value={form.terminalId}
                onChange={(event) =>
                  updateForm("terminalId", event.target.value)
                }
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span>Connection Type</span>
              <select
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                value={form.connectionType}
                onChange={(event) =>
                  updateForm(
                    "connectionType",
                    event.target.value as ConnectionType
                  )
                }
              >
                <option value="tcp">TCP/IP</option>
                <option value="serial">Serial</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span>Timeout (ms)</span>
              <input
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                type="number"
                min={0}
                value={form.idleMs}
                onChange={(event) => updateForm("idleMs", event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-sm md:col-span-2">
              <span>Passwort (optional)</span>
              <input
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                type="password"
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span>Currency</span>
              <select
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                value={form.currency}
                onChange={(event) =>
                  updateForm("currency", event.target.value as Currency)
                }
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span>Connect Timeout (ms)</span>
              <input
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                type="number"
                min={0}
                value={form.connectMs}
                onChange={(event) =>
                  updateForm("connectMs", event.target.value)
                }
              />
            </label>
          </div>

          <fieldset className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-4">
            <legend className="px-2 text-sm uppercase tracking-wide text-slate-400">
              TLS
            </legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-emerald-500"
                checked={form.tlsEnabled}
                onChange={(event) =>
                  updateForm("tlsEnabled", event.target.checked)
                }
              />
              Use TLS for TCP connection
            </label>

            {form.tlsEnabled && (
              <div className="space-y-4">
                <label className="grid gap-1.5 text-sm">
                  <span>CA Certificate (PEM)</span>
                  <textarea
                    className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base font-mono focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                    rows={5}
                    value={form.caCertPem}
                    onChange={(event) =>
                      updateForm("caCertPem", event.target.value)
                    }
                    placeholder="-----BEGIN CERTIFICATE-----"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-emerald-500"
                    checked={form.rejectUnauthorized}
                    onChange={(event) =>
                      updateForm("rejectUnauthorized", event.target.checked)
                    }
                  />
                  Certificate verification required
                </label>
              </div>
            )}
          </fieldset>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              Save settings
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Disconnect
            </button>
          </div>
        </form>

        <p className="text-sm text-slate-400">
          <span className="font-semibold text-slate-200">Status:</span> {status}
        </p>

        {/* TESTING PAYMENT */}
        <div className="pt-6 border-t border-slate-800">
          <h2 className="text-lg font-semibold mb-4">Test Payment</h2>
          <Button
            variant="default"
            size="sm"
            className="ml-4"
            disabled={busy || paymentBusy || status !== "Connected"}
            onClick={handleTestPayment}
          >
            Start Test Payment
          </Button>
        </div>
      </section>

      <section className="flex-1 px-8 py-10 lg:px-12 lg:py-12">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Event Log</h2>
            <p className="text-sm text-slate-400">
              Monitor raw events from the terminal here.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setLog([])}>
            Clear Log
          </Button>
        </header>
        <div className="h-[calc(100vh-200px)] min-h-[320px] rounded-2xl border border-slate-800 bg-slate-950/70 p-6 overflow-auto font-mono text-xs leading-relaxed">
          {log.length === 0 ? (
            <p className="text-slate-500">
              No events yet. Start the terminal connection to monitor logs.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap break-words">
              {log.join("\n")}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
