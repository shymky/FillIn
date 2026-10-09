import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = (process.env.API_URL ?? "http://localhost:9000").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const { search } = new URL(req.url);
  try {
    const res = await fetch(`${UPSTREAM}/tts${search}`, { cache: "no-store" });
    if (!res.ok) {
      return new NextResponse(await res.text(), {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type")?.includes("application/json")
            ? "application/json"
            : "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
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
    return NextResponse.json(
      { detail: "TTS API is unavailable. Start the API server and check that API_URL points to its address." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
