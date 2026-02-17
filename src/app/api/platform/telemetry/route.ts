import { type NextRequest, NextResponse } from 'next/server'

// Endpoint to receive telemetry data from the frontend and log it for now
export async function POST(request: NextRequest) {
  const { event, data } = await request.json()

  console.log(`Received telemetry event: ${event}`, data)

  return NextResponse.json({ status: 'telemetry success' })
}
