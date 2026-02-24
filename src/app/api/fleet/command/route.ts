import { type NextRequest, NextResponse } from "next/server";
import { applyFleetCommandMutation } from "@/lib/fleet-store";
import type {
  FleetCommandAction,
  FleetCommandRequest,
  FleetCommandResponse,
} from "@/types";

const VALID_ACTIONS: FleetCommandAction[] = [
  "emergency_shutdown",
  "firmware_reset",
  "set_temperature",
];

// Endpoint to receive commands from the frontend and log them for now
export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<FleetCommandRequest>;
  const sensorIds = Array.isArray(payload.sensor_ids)
    ? payload.sensor_ids.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const action = payload.action;

  if (!sensorIds.length) {
    return NextResponse.json(
      { error: "sensor_ids must be a non-empty string[]" },
      { status: 400 },
    );
  }

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (
    action === "set_temperature" &&
    typeof payload.params?.temperature !== "number"
  ) {
    return NextResponse.json(
      { error: "set_temperature requires params.temperature (number)" },
      { status: 400 },
    );
  }

  const response: FleetCommandResponse = {
    status: "accepted",
    commandId: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    affectedSensors: sensorIds.length,
    updatedSensors: applyFleetCommandMutation({
      ...payload,
      sensor_ids: sensorIds,
      action,
    } as FleetCommandRequest),
  };

  console.log("Received fleet command", {
    ...payload,
    sensor_ids: sensorIds,
    action,
  });

  return NextResponse.json(response);
}
