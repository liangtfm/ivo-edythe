import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { event, data } = await request.json()

  console.log(`Received updates event: ${event}`, data)

  return NextResponse.json({ status: 'updates success' })
}
