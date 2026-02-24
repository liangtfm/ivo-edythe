import { type NextRequest, NextResponse } from "next/server";

import { simulateSectorFailure } from "@/lib/fleet-store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    sectorId?: string;
  };

  const result = simulateSectorFailure(body.sectorId);

  return NextResponse.json({
    status: "accepted",
    sectorId: result.sectorId,
    affectedSensors: result.updatedSensors.length,
    updatedSensors: result.updatedSensors,
    simulatedAt: new Date().toISOString(),
  });
}
