import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { LogEntry } from '@/lib/types'

const LOG_PATH = path.join(process.cwd(), 'data', 'log.json')

async function readLog(): Promise<LogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeLog(entries: LogEntry[]) {
  await fs.writeFile(LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

export async function GET() {
  const entries = await readLog()
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entries = await readLog()

  // Update existing entry or append new one
  const existingIndex = entries.findIndex((e) => e.id === body.id)
  if (existingIndex >= 0) {
    entries[existingIndex] = { ...entries[existingIndex], ...body }
  } else {
    entries.push(body)
  }

  await writeLog(entries)
  return NextResponse.json({ success: true })
}
