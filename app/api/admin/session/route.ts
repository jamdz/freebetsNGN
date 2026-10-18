import { NextResponse } from 'next/server'
import { hasAdminSession } from '@/lib/admin-auth'
export async function GET() { return (await hasAdminSession()) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 401 }) }
