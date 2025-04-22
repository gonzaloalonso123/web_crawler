"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { startCrawling } from "@/app/actions"
import { AlertCircle, Download, Globe, Loader2, BugIcon as Spider, Sparkles, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { motion, AnimatePresence } from "framer-motion"

export default function Home() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")
  const [stats, setStats] = useState<{ pages: number; images: number } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url) {
      setError("Please enter a URL")
      return
    }

    try {
      // Validate URL
      new URL(url)
    } catch (e) {
      setError("Please enter a valid URL (including http:// or https://)")
      return
    }

    setIsLoading(true)
    setError("")
    setDownloadUrl("")
    setStats(null)
    setProgress(0)
    setStatus("Starting crawler...")

    try {
      const eventSource = new EventSource(`/api/crawl-progress?url=${encodeURIComponent(url)}`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.progress) {
          setProgress(data.progress)
        }

        if (data.status) {
          setStatus(data.status)
        }

        if (data.complete) {
          eventSource.close()
          setIsLoading(false)
          setDownloadUrl(data.downloadUrl)
          setStats({
            pages: data.pagesVisited || 0,
            images: data.imagesDownloaded || 0,
          })
        }

        if (data.error) {
          eventSource.close()
          setIsLoading(false)
          setError(data.error)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setIsLoading(false)
        setError("Connection error. Please try again.")
      }

      // Start the crawling process
      const result = await startCrawling(url)
      if (!result.success) {
        setError(result.error || "Failed to start crawling")
        setIsLoading(false)
        eventSource.close()
      }
    } catch (err) {
      setIsLoading(false)
      setError("An error occurred while crawling")
      console.error(err)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-violet-50 via-slate-50 to-blue-50">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-20 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-3xl relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto bg-gradient-to-r from-violet-600 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md">
                <Spider className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-700 to-indigo-500 text-transparent bg-clip-text">
                Web Crawler
              </CardTitle>
              <CardDescription className="text-slate-600 mt-2 text-base max-w-md mx-auto">
                Extract clean content from any website. We'll filter out the noise and give you just the good stuff.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-5 w-5 text-slate-400" />
                    </div>
                    <Input
                      type="text"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 py-6 border-slate-200 focus:border-violet-500 focus:ring-violet-500 transition-all duration-200"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-6 px-6 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Crawling...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Start Crawling
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Alert variant="destructive" className="mt-4 border-red-200 bg-red-50 text-red-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-8 space-y-4"
                  >
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-slate-600">Progress</span>
                      <span className="text-indigo-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-2 animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      <p>{status}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {stats && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="mt-8"
                  >
                    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-6 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <h3 className="font-semibold text-slate-800">Crawling Complete</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                          <p className="text-sm text-slate-500 mb-1">Pages Crawled</p>
                          <p className="text-2xl font-bold text-indigo-600">{stats.pages}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                          <p className="text-sm text-slate-500 mb-1">Images Downloaded</p>
                          <p className="text-2xl font-bold text-violet-600">{stats.images}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <AnimatePresence>
              {downloadUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <CardFooter className="px-6 pb-6 pt-0">
                    <a href={downloadUrl} download className="w-full">
                      <Button
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-6 shadow-md hover:shadow-lg transition-all duration-200"
                        variant="outline"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        Download Crawled Content
                      </Button>
                    </a>
                  </CardFooter>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
    </main>
  )
}
