"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

export async function startCrawling(url: string) {
  try {
    // Create a unique ID for this crawling job
    const jobId = Date.now().toString()

    // Create a directory for this job
    const jobDir = path.join(process.cwd(), "tmp", jobId)
    await mkdir(jobDir, { recursive: true })

    // Write the URL to a file to indicate the job has started
    await writeFile(path.join(jobDir, "url.txt"), url)

    // Start the crawling process in the background
    // The actual crawling will be handled by the API route

    return { success: true, jobId }
  } catch (error) {
    console.error("Error starting crawling:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
