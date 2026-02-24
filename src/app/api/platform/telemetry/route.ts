import { type NextRequest, NextResponse } from "next/server";
import type { PlatformTelemetryEvent } from "@/types";

// Endpoint to receive telemetry data from the frontend and log it for now
export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<PlatformTelemetryEvent>;

  if (payload.event !== "fleet_command_executed" || !payload.data) {
    return NextResponse.json(
      { error: "Unsupported telemetry event payload" },
      { status: 400 },
    );
  }

  console.log("Received telemetry event", payload);

  return NextResponse.json({
    status: "accepted",
    receivedAt: new Date().toISOString(),
  });
}
