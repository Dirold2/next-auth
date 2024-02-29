import { auth } from "auth"
import { NextResponse } from "next/server"

export const GET = auth(async function GET(req) {
 if (req.auth) return new Response(JSON.stringify(req.auth), { status: 200, headers: { 'Content-Type': 'application/json' } });
 return new Response(JSON.stringify({ message: "Not authenticated" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
});