import { NextResponse } from "next/server";

import { getFleetSnapshot, getFleetSectorIds } from "@/lib/fleet-store";

// Endpoint to return the mock fleet data to the frontend
export async function GET() {
  return NextResponse.json({
    data: getFleetSnapshot(),
    sectors: getFleetSectorIds(),
  });
}
