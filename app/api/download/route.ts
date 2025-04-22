import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId")

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
  }

  const zipPath = path.join(process.cwd(), "tmp", jobId, "output.zip")

  if (!existsSync(zipPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  try {
    const fileBuffer = await readFile(zipPath)

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="crawled-content.zip"`,
      },
    })
  } catch (error) {
    console.error("Error serving zip file:", error)
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 })
  }
}
