import { NextResponse } from 'next/server'
import mockdata from '@/data/mock-data.json'

// Endpoint to return the mock fleet data to the frontend
export async function GET() {
  return NextResponse.json({ data: mockdata })
}
