import { createWriteStream } from "fs"
import archiver from "archiver"

export async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create a file to stream archive data to
    const output = createWriteStream(outputPath)
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level
    })

    // Listen for all archive data to be written
    output.on("close", () => {
      console.log(`Archive created: ${archive.pointer()} total bytes`)
      resolve()
    })

    // Good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn(err)
      } else {
        reject(err)
      }
    })

    // Good practice to catch this error explicitly
    archive.on("error", (err) => {
      reject(err)
    })

    // Pipe archive data to the file
    archive.pipe(output)

    // Append files from the directory
    archive.directory(sourceDir, false)

    // Finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize()
  })
}
