import { type NextRequest, NextResponse } from 'next/server'

// Endpoint to receive commands from the frontend and log them for now
export async function POST(request: NextRequest) {
  const { event, data } = await request.json()

  console.log(`Received command event: ${event}`, data)

  return NextResponse.json({ status: 'fleet command success' })
}
