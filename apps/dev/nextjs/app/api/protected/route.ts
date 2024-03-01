import { auth } from "auth"
import { NextResponse } from "next/server"

export const GET = auth(async function GET(req) {
    if (req.auth) return Promise.resolve(NextResponse.json(req.auth));
    return Promise.resolve(NextResponse.json({ message: "Not authenticated" }, { status: 401 }));
});