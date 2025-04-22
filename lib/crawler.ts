import { JSDOM } from "jsdom"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import sanitize from "sanitize-filename"

type ProgressCallback = (progress: number, status: string) => void

export async function crawlWebsite(startUrl: string, progressCallback?: ProgressCallback) {
  try {
    console.log(`Starting to crawl: ${startUrl}`)

    // Extract the base URL and domain
    const urlObj = new URL(startUrl)
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`
    const domain = urlObj.hostname

    // Create output directories
    const outputDir = path.join(process.cwd(), "tmp", sanitize(`${domain}-crawl-${Date.now()}`))
    const imagesDir = path.join(outputDir, "images")

    await mkdir(outputDir, { recursive: true })
    await mkdir(imagesDir, { recursive: true })

    // Initialize variables
    const visited = new Set()
    const queue = [startUrl]
    const contentLines = []
    let imageCounter = 0
    let pagesProcessed = 0

    // Process URLs until queue is empty
    while (queue.length > 0) {
      const currentUrl = queue.shift()

      // Skip if already visited
      if (visited.has(currentUrl)) continue
      visited.add(currentUrl)

      try {
        console.log(`Crawling: ${currentUrl}`)

        if (progressCallback) {
          // Calculate progress as a percentage of pages processed vs total discovered
          const progress = Math.min(
            95, // Cap at 95% until completely done
            Math.round((pagesProcessed / (pagesProcessed + queue.length)) * 100),
          )
          progressCallback(progress, `Crawling: ${currentUrl}`)
        }

        // Fetch the page
        const response = await fetch(currentUrl)
        if (!response.ok) {
          console.log(`Failed to fetch ${currentUrl}: ${response.status}`)
          continue
        }

        const html = await response.text()
        const dom = new JSDOM(html)
        const document = dom.window.document

        // Extract page title
        const title = document.title || "No Title"
        contentLines.push(`\n\n==== PAGE: ${title} ====`)
        contentLines.push(`URL: ${currentUrl}\n`)

        // Extract only meaningful text content (no scripts, styles, etc.)
        const textContent = extractCleanContent(document)
        contentLines.push(textContent)

        // Process images
        const images = document.querySelectorAll("img")
        for (const img of images) {
          if (img.src) {
            try {
              // Create absolute URL for the image
              const imgUrl = new URL(img.src, currentUrl).href

              // Skip data URLs
              if (imgUrl.startsWith("data:")) continue

              // Generate image ID
              const imageId = String.fromCharCode(65 + (imageCounter % 26))
              imageCounter++

              // Add image reference to content
              const altText = img.alt || "No description"
              contentLines.push(`\nimage["${imageId}"]: ${altText}`)

              // Download the image
              const imgResponse = await fetch(imgUrl)
              if (imgResponse.ok) {
                const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
                const imgExt = path.extname(imgUrl) || ".jpg"
                const imgFilename = `image_${imageId}${imgExt}`
                await writeFile(path.join(imagesDir, imgFilename), imgBuffer)
              }
            } catch (imgError) {
              console.log(`Error processing image: ${imgError.message}`)
            }
          }
        }

        // Find links to other pages on the same domain
        const links = document.querySelectorAll("a")
        for (const link of links) {
          if (link.href) {
            try {
              const linkUrl = new URL(link.href, currentUrl).href
              const linkHostname = new URL(linkUrl).hostname

              // Skip social media and external domains
              if (isExternalOrSocialMediaLink(linkHostname, domain)) {
                continue
              }

              // Only follow links to the exact same domain or its subdomains
              if (
                (linkHostname === domain || linkHostname.endsWith(`.${domain}`)) &&
                !linkUrl.includes("#") &&
                !visited.has(linkUrl) &&
                !queue.includes(linkUrl)
              ) {
                queue.push(linkUrl)
              }
            } catch (linkError) {
              // Skip invalid URLs
            }
          }
        }

        pagesProcessed++
      } catch (error) {
        console.log(`Error processing ${currentUrl}: ${error.message}`)
      }
    }

    // Write content to file
    const outputFile = path.join(outputDir, `${domain}-content.txt`)
    await writeFile(outputFile, contentLines.join("\n"))

    console.log(`\nCrawling complete!`)
    console.log(`- Visited ${visited.size} pages`)
    console.log(`- Downloaded ${imageCounter} images`)
    console.log(`- Content saved to: ${outputFile}`)
    console.log(`- Images saved to: ${imagesDir}`)

    if (progressCallback) {
      progressCallback(100, "Crawling complete!")
    }

    return {
      success: true,
      outputDir,
      pagesVisited: visited.size,
      imagesDownloaded: imageCounter,
    }
  } catch (error) {
    console.error("Crawling failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Checks if a URL is an external link or points to a social media site
 */
function isExternalOrSocialMediaLink(hostname: string, baseDomain: string): boolean {
  // List of common social media domains
  const socialMediaDomains = [
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "pinterest.com",
    "tiktok.com",
    "reddit.com",
    "tumblr.com",
    "snapchat.com",
    "whatsapp.com",
    "telegram.org",
    "discord.com",
    "medium.com",
    "t.co", // Twitter short links
    "fb.me", // Facebook short links
    "youtu.be", // YouTube short links
    "bit.ly",
    "goo.gl",
    "tinyurl.com",
    "ow.ly",
    "is.gd",
  ]

  // Check if it's a social media domain
  for (const socialDomain of socialMediaDomains) {
    if (hostname.endsWith(socialDomain) || hostname === socialDomain) {
      return true
    }
  }

  // Check if it's an external domain (not the same as base domain or its subdomain)
  if (hostname !== baseDomain && !hostname.endsWith(`.${baseDomain}`)) {
    return true
  }

  return false
}

/**
 * Extracts clean, readable content from a webpage by using a whitelist approach
 * and aggressive filtering of non-content elements
 */
function extractCleanContent(document: Document): string {
  // Clone the document to avoid modifying the original
  const clone = document.cloneNode(true) as Document
  const body = clone.body

  // 1. Remove all script, style, iframe, noscript tags and their content
  const elementsToRemove = body.querySelectorAll(
    "script, style, iframe, noscript, svg, canvas, code, pre, [style*='display:none'], [style*='display: none'], [style*='visibility:hidden'], [style*='visibility: hidden'], link, meta",
  )
  elementsToRemove.forEach((el) => el.parentNode?.removeChild(el))

  // 2. Remove common non-content containers by ID or class
  const nonContentSelectors = [
    // Common IDs
    "#header",
    "#footer",
    "#nav",
    "#navigation",
    "#menu",
    "#sidebar",
    "#comments",
    "#related",
    "#social",
    "#sharing",
    "#ad",
    "#ads",
    "#advertisement",
    // Common classes
    ".header",
    ".footer",
    ".nav",
    ".navigation",
    ".menu",
    ".sidebar",
    ".comments",
    ".related",
    ".social",
    ".sharing",
    ".ad",
    ".ads",
    ".advertisement",
    // Next.js and React specific
    "[data-nextjs-data]",
    "[data-reactroot]",
    "[id^='__next']",
    "[class^='__next']",
    // Common non-content elements
    ".cookie-banner",
    ".popup",
    ".modal",
    ".overlay",
    ".notification",
    // Common navigation elements
    ".breadcrumbs",
    ".pagination",
    ".search",
    ".search-form",
    // Common UI components
    ".button",
    ".btn",
    ".icon",
    ".dropdown",
    ".tooltip",
  ]

  try {
    body.querySelectorAll(nonContentSelectors.join(", ")).forEach((el) => {
      el.parentNode?.removeChild(el)
    })
  } catch (e) {
    // Some complex selectors might fail, continue with what we have
    console.log("Error removing non-content elements:", e)
  }

  // 3. Extract text from remaining content elements
  const contentElements = body.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, p, article, section, main, .content, .article, .post, .entry, li, td, th, dt, dd, figcaption, blockquote",
  )

  const textBlocks: string[] = []

  // If we found specific content elements, use them
  if (contentElements.length > 0) {
    contentElements.forEach((el) => {
      const text = el.textContent?.trim()
      if (text && text.length > 0) {
        // Format headings specially
        if (/^H[1-6]$/.test(el.tagName)) {
          textBlocks.push(`\n== ${text} ==\n`)
        } else {
          textBlocks.push(text)
        }
      }
    })
  } else {
    // Fallback: try to extract text from the body directly
    const paragraphs = body.querySelectorAll("p")
    if (paragraphs.length > 0) {
      paragraphs.forEach((p) => {
        const text = p.textContent?.trim()
        if (text && text.length > 0) {
          textBlocks.push(text)
        }
      })
    } else {
      // Last resort: get all text nodes directly
      const textNodes = getAllTextNodes(body)
      textNodes.forEach((node) => {
        const text = node.textContent?.trim()
        if (text && text.length > 0 && text.length < 500) {
          // Avoid very long text blocks which are likely code
          textBlocks.push(text)
        }
      })
    }
  }

  // 4. Post-process the extracted text
  let content = textBlocks.join("\n")

  // 5. Apply additional filters to remove code-like content
  content = filterCodeLikeContent(content)

  return content
}

/**
 * Gets all text nodes from an element
 */
function getAllTextNodes(element: Element): Text[] {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  let node
  while ((node = walker.nextNode())) {
    // Skip if parent is in a blacklist
    const parent = node.parentElement
    if (parent) {
      const tagName = parent.tagName.toUpperCase()
      if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "CANVAS", "CODE"].includes(tagName)) {
        continue
      }

      // Skip hidden elements
      const style = document.defaultView?.getComputedStyle(parent)
      if (style && (style.display === "none" || style.visibility === "hidden")) {
        continue
      }
    }

    textNodes.push(node as Text)
  }

  return textNodes
}

/**
 * Filters out code-like content based on patterns
 */
function filterCodeLikeContent(text: string): string {
  // Split into lines for processing
  const lines = text.split("\n")
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim()

    // Skip empty lines
    if (trimmed.length === 0) return false

    // Skip lines that are likely code or script content
    if (
      // JavaScript/JSON patterns
      trimmed.includes("function(") ||
      trimmed.includes("() =>") ||
      trimmed.includes("var ") ||
      trimmed.includes("const ") ||
      trimmed.includes("let ") ||
      trimmed.includes("self.__next") ||
      trimmed.includes("window.") ||
      trimmed.includes("document.") ||
      trimmed.includes("$.") ||
      trimmed.includes("jQuery") ||
      (trimmed.match(/[{}[\]"':]/) && trimmed.match(/[{}[\]"':]/g)!.length > 3) ||
      // URL/path patterns
      trimmed.includes("/static/") ||
      trimmed.includes("/_next/") ||
      trimmed.includes(".js") ||
      trimmed.includes(".css") ||
      // HTML-like patterns
      trimmed.includes("<div") ||
      trimmed.includes("<span") ||
      trimmed.includes("<script") ||
      trimmed.includes("<style") ||
      // Other code indicators
      trimmed.includes("===") ||
      trimmed.includes("!==") ||
      trimmed.includes("++") ||
      trimmed.includes("--") ||
      // Very long lines without spaces (likely minified code)
      (trimmed.length > 100 && !trimmed.includes(" ")) ||
      // Lines with lots of special characters
      (trimmed.match(/[^\w\s]/g) && trimmed.match(/[^\w\s]/g)!.length > trimmed.length * 0.3)
    ) {
      return false
    }

    return true
  })

  // Join filtered lines and clean up any remaining issues
  let result = filteredLines.join("\n")

  // Remove any remaining code blocks
  result = result.replace(/\{[^{}]*\}/g, "")

  // Clean up excessive whitespace
  result = result.replace(/\s{3,}/g, "\n\n")

  return result
}
