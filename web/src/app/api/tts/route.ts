import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = (process.env.API_URL ?? "http://localhost:9000").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const { search } = new URL(req.url);
  try {
    const res = await fetch(`${UPSTREAM}/tts${search}`, { cache: "no-store" });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("TTS proxy error:", e);
    return new NextResponse(null, { status: 502 });
  }
}
