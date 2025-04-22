import { type NextRequest, NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import path from "path"
import { crawlWebsite } from "@/lib/crawler"
import { createZipArchive } from "@/lib/archive"

// Store active crawling jobs
const activeJobs = new Map()

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  // Create a unique job ID based on the URL
  const jobId = Buffer.from(url).toString("base64").replace(/[/+=]/g, "")

  // Set up SSE response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create job directory
        const jobDir = path.join(process.cwd(), "tmp", jobId)
        await mkdir(jobDir, { recursive: true })

        // Check if job is already running
        if (activeJobs.has(jobId)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "Job already running" })}\n\n`))
          return
        }

        // Set up progress tracking
        const progressCallback = (progress: number, status: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress, status })}\n\n`))
        }

        // Store the controller in activeJobs
        activeJobs.set(jobId, { controller, progress: 0 })

        // Start the crawling process
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ status: "Starting crawler...", progress: 0 })}\n\n`),
        )

        const result = await crawlWebsite(url, progressCallback)

        if (result.success) {
          // Create a zip file of the output
          const zipPath = path.join(jobDir, "output.zip")
          await createZipArchive(result.outputDir, zipPath)

          // Generate a download URL
          const downloadUrl = `/api/download?jobId=${jobId}`

          // Send completion message
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                complete: true,
                downloadUrl,
                pagesVisited: result.pagesVisited,
                imagesDownloaded: result.imagesDownloaded,
                status: "Crawling complete! Ready for download.",
                progress: 100,
              })}\n\n`,
            ),
          )
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: result.error })}\n\n`))
        }
      } catch (error) {
        console.error("Error in crawl-progress:", error)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error occurred",
            })}\n\n`,
          ),
        )
      } finally {
        // Remove job from active jobs
        activeJobs.delete(jobId)
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
