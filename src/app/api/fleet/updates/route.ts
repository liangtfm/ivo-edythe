import { generateRandomUpdateBatch } from "@/lib/fleet-store";
import type { FleetUpdatesEvent } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_BATCH_SIZE = 120;
const DEFAULT_INTERVAL_MS = 1000;

function sseMessage(eventName: string, payload: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

// Endpoint to open an SSE connection and stream mock fleet updates every second to the frontend
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const { searchParams } = new URL(request.url);

  const batchSize = Math.max(
    1,
    Math.min(Number(searchParams.get("batchSize")) || DEFAULT_BATCH_SIZE, 1000),
  );
  const intervalMs = Math.max(
    250,
    Math.min(
      Number(searchParams.get("intervalMs")) || DEFAULT_INTERVAL_MS,
      5000,
    ),
  );

  let sequence = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (eventName: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sseMessage(eventName, payload)));
      };

      send("connected", {
        type: "connected",
        sentAt: new Date().toISOString(),
        batchSize,
        intervalMs,
      });

      intervalId = setInterval(() => {
        sequence += 1;
        const payload: FleetUpdatesEvent = {
          type: "fleet-updates",
          sequence,
          sentAt: new Date().toISOString(),
          updates: generateRandomUpdateBatch(batchSize),
        };

        send("fleet-updates", payload);
      }, intervalMs);

      heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        if (intervalId) clearInterval(intervalId);
        if (heartbeatId) clearInterval(heartbeatId);
        controller.close();
      });
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
      if (heartbeatId) clearInterval(heartbeatId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
