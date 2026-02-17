import { NextResponse } from 'next/server'
import mockdata from '@/data/mock-data.json'

export async function GET() {
  return NextResponse.json({ data: mockdata })
}
