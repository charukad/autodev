import WebSocket, { type RawData } from "ws";
import { buildEventStreamUrl } from "./config";
import type { AiOfficeEventStreamClient, CliConfig, StreamEvent, StreamRequest } from "./types";

export type WebSocketEventStreamClientOptions = {
  config: CliConfig;
  reconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
};

export class WebSocketEventStreamClient implements AiOfficeEventStreamClient {
  private readonly reconnectAttempts: number;
  private readonly initialReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  constructor(private readonly options: WebSocketEventStreamClientOptions) {
    this.reconnectAttempts = options.reconnectAttempts ?? 5;
    this.initialReconnectDelayMs = options.initialReconnectDelayMs ?? 200;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 2_000;
  }

  async streamEvents(request: StreamRequest): Promise<void> {
    let attempts = 0;
    let receivedEvents = 0;

    const timeoutController = new AbortController();
    let timeoutHandle: NodeJS.Timeout | undefined;

    if (request.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        timeoutController.abort();
      }, request.timeoutMs);
    }

    const signal = mergeSignals(request.signal, timeoutController.signal);

    try {
      while (attempts <= this.reconnectAttempts && !signal.aborted) {
        try {
          await this.openConnection(request, signal, () => {
            receivedEvents += 1;
            return receivedEvents;
          });
          return;
        } catch (error) {
          attempts += 1;
          if (signal.aborted || attempts > this.reconnectAttempts) {
            throw error;
          }

          const delay = Math.min(
            this.initialReconnectDelayMs * 2 ** Math.max(attempts - 1, 0),
            this.maxReconnectDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async openConnection(
    request: StreamRequest,
    signal: AbortSignal,
    incrementCounter: (event: StreamEvent) => number
  ): Promise<void> {
    const eventUrl = new URL(buildEventStreamUrl(this.options.config));

    if (request.sessionId) {
      eventUrl.searchParams.set("session_id", request.sessionId);
    }

    const apiKey = process.env.AI_OFFICE_API_KEY ?? this.options.config.backend.api_key;
    if (apiKey) {
      eventUrl.searchParams.set("token", apiKey);
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(eventUrl, {
        handshakeTimeout: this.options.config.backend.request_timeout_ms,
      });

      let settled = false;

      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
        ws.removeAllListeners();
      };

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        callback();
      };

      const onAbort = () => {
        ws.close();
        finish(resolve);
      };

      signal.addEventListener("abort", onAbort, { once: true });

      ws.on("message", async (data: RawData) => {
        const event = JSON.parse(String(data)) as StreamEvent;
        await request.onEvent(event);
        const receivedCount = incrementCounter(event);

        if (request.count && receivedCount >= request.count) {
          ws.close();
          finish(resolve);
        }
      });

      ws.on("error", (error: Error) => {
        finish(() => reject(error));
      });

      ws.on("close", (code: number) => {
        if (signal.aborted || code === 1000) {
          finish(resolve);
          return;
        }

        finish(() => reject(new Error(`WebSocket closed unexpectedly with code ${code}.`)));
      });
    });
  }
}

function mergeSignals(signalA: AbortSignal | undefined, signalB: AbortSignal): AbortSignal {
  if (!signalA) {
    return signalB;
  }

  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  if (signalA.aborted || signalB.aborted) {
    abort();
  } else {
    signalA.addEventListener("abort", abort, { once: true });
    signalB.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}
