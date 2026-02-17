import { type NextRequest, NextResponse } from 'next/server'

// Endpoint to open a SSE connection and stream mock fleet updates every second to the frontend
export async function GET(request: NextRequest) {
  const { event, data } = await request.json()

  console.log(`Received updates event: ${event}`, data)

  return NextResponse.json({ status: 'updates success' })
}
