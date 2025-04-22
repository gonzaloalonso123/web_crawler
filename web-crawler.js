import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';
import sanitize from 'sanitize-filename';

// Main function to crawl a website
async function crawlWebsite(startUrl) {
  console.log(`Starting to crawl: ${startUrl}`);
  
  // Extract the base URL and domain
  const urlObj = new URL(startUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
  const domain = urlObj.hostname;
  
  // Create output directories
  const outputDir = sanitize(`${domain}-crawl`);
  const imagesDir = path.join(outputDir, 'images');
  
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  
  // Initialize variables
  const visited = new Set();
  const queue = [startUrl];
  const contentLines = [];
  let imageCounter = 0;
  
  // Process URLs until queue is empty
  while (queue.length > 0) {
    const currentUrl = queue.shift();
    
    // Skip if already visited
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);
    
    try {
      console.log(`Crawling: ${currentUrl}`);
      
      // Fetch the page
      const response = await fetch(currentUrl);
      if (!response.ok) {
        console.log(`Failed to fetch ${currentUrl}: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract page title
      const title = document.title || 'No Title';
      contentLines.push(`\n\n==== PAGE: ${title} ====`);
      contentLines.push(`URL: ${currentUrl}\n`);
      
      // Extract text content
      const bodyText = document.body.textContent
        .replace(/\s+/g, ' ')
        .trim();
      contentLines.push(bodyText);
      
      // Process images
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (img.src) {
          try {
            // Create absolute URL for the image
            const imgUrl = new URL(img.src, currentUrl).href;
            
            // Skip data URLs
            if (imgUrl.startsWith('data:')) continue;
            
            // Generate image ID
            const imageId = String.fromCharCode(65 + (imageCounter % 26));
            imageCounter++;
            
            // Add image reference to content
            const altText = img.alt || 'No description';
            contentLines.push(`\nimage["${imageId}"]: ${altText}`);
            
            // Download the image
            const imgResponse = await fetch(imgUrl);
            if (imgResponse.ok) {
              const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
              const imgExt = path.extname(imgUrl) || '.jpg';
              const imgFilename = `image_${imageId}${imgExt}`;
              await fs.writeFile(path.join(imagesDir, imgFilename), imgBuffer);
            }
          } catch (imgError) {
            console.log(`Error processing image: ${imgError.message}`);
          }
        }
      }
      
      // Find links to other pages on the same domain
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.href) {
          try {
            const linkUrl = new URL(link.href, currentUrl).href;
            
            // Only follow links to the same domain
            if (linkUrl.includes(domain) && 
                !linkUrl.includes('#') && 
                !visited.has(linkUrl) && 
                !queue.includes(linkUrl)) {
              queue.push(linkUrl);
            }
          } catch (linkError) {
            // Skip invalid URLs
          }
        }
      }
    } catch (error) {
      console.log(`Error processing ${currentUrl}: ${error.message}`);
    }
  }
  
  // Write content to file
  const outputFile = path.join(outputDir, `${domain}-content.txt`);
  await fs.writeFile(outputFile, contentLines.join('\n'));
  
  console.log(`\nCrawling complete!`);
  console.log(`- Visited ${visited.size} pages`);
  console.log(`- Downloaded ${imageCounter} images`);
  console.log(`- Content saved to: ${outputFile}`);
  console.log(`- Images saved to: ${imagesDir}`);
  console.log(`\nOutput directory: ${outputDir}`);
}

// Check if URL is provided
if (process.argv.length < 3) {
  console.log('Please provide a URL to crawl');
  console.log('Example: node web-crawler.js https://example.com');
  process.exit(1);
}

// Start crawling
const url = process.argv[2];
crawlWebsite(url).catch(error => {
  console.error('Crawling failed:', error);
});
