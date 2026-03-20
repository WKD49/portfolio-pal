import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { LogEntry } from '@/lib/types'
import { validateLogEntry } from '@/lib/guardrails'

const LOG_PATH = path.join(process.cwd(), 'data', 'log.json')
const TMP_PATH = LOG_PATH + '.tmp'

// ─── Startup recovery and validation (Rule 12) ───────────────────────────────
// Runs once when this module first loads. Handles two scenarios:
//   1. log.tmp exists (crashed write): promote to log.json if valid, delete if not
//   2. log.json exists: validate all entries — throw if corrupt (refuse to start)
// If log.json does not exist yet, that is fine — it will be created on first write.

async function initLog(): Promise<void> {
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true })

  // Attempt tmp recovery
  try {
    const tmpRaw = await fs.readFile(TMP_PATH, 'utf-8')
    let tmpData: unknown
    try {
      tmpData = JSON.parse(tmpRaw)
    } catch {
      tmpData = null
    }
    if (Array.isArray(tmpData) && tmpData.every(validateLogEntry)) {
      await fs.rename(TMP_PATH, LOG_PATH)
    } else {
      await fs.unlink(TMP_PATH)
    }
  } catch {
    // No log.tmp — normal case, nothing to recover
  }

  // Validate existing log.json
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf-8')
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(
        'log.json contains invalid JSON. Fix or delete data/log.json and restart the server.'
      )
    }
    if (!Array.isArray(data) || !data.every(validateLogEntry)) {
      throw new Error(
        'log.json failed schema validation on startup. One or more entries have missing or malformed fields. ' +
        'Fix or delete data/log.json and restart the server.'
      )
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return // file doesn't exist yet — fine
    throw e
  }
}

// Store the promise so both GET and POST can await it without re-running initLog
const initPromise = initLog()

// ─── Read / write helpers ─────────────────────────────────────────────────────

async function readLog(): Promise<LogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// Atomic write (Rule 12): write to log.tmp, verify, rename to log.json.
// fs.rename is atomic on macOS/Linux when source and destination are on the same filesystem.
async function writeLog(entries: LogEntry[]): Promise<void> {
  const serialised = JSON.stringify(entries, null, 2)
  await fs.writeFile(TMP_PATH, serialised, 'utf-8')
  // Re-parse to confirm the file written is valid JSON before committing
  JSON.parse(await fs.readFile(TMP_PATH, 'utf-8'))
  await fs.rename(TMP_PATH, LOG_PATH)
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  await initPromise
  const entries = await readLog()
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  await initPromise

  const body = await req.json()

  // Rule 11 — reject invalid entries server-side before any persistence
  if (!validateLogEntry(body)) {
    return NextResponse.json(
      { error: 'Invalid log entry: missing or malformed fields. The recommendation was not recorded.' },
      { status: 400 }
    )
  }

  const entries = await readLog()

  const existingIndex = entries.findIndex((e) => e.id === body.id)
  if (existingIndex >= 0) {
    entries[existingIndex] = { ...entries[existingIndex], ...body }
  } else {
    entries.push(body)
  }

  await writeLog(entries)
  return NextResponse.json({ success: true })
}
