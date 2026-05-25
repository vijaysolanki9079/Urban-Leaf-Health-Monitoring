import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { safeAssetPath } from "@/lib/data";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get("path");
  if (!relativePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const absolute = safeAssetPath(relativePath);
  if (!absolute) {
    return NextResponse.json({ error: "Asset not allowed" }, { status: 403 });
  }

  const data = await fs.readFile(absolute);
  const ext = absolute.slice(absolute.lastIndexOf(".")).toLowerCase();
  return new NextResponse(data, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
