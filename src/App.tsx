import { useState, useRef, useEffect } from "react"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { Progress } from "./components/ui/progress"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { save } from "@tauri-apps/plugin-dialog"
import "./App.css"

export default function App() {
  const [url, setUrl] = useState("")
  const [activeTab, setActiveTab] = useState("auto")
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "success" | "error" | "invalid">("idle")
  const [progress, setProgress] = useState(0)
  const [showFormats, setShowFormats] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const invalidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [appName] = useState("Ejemplo")

  const allowedDomains = [
    "tiktok.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "x.com",
    "twitter.com",
    "reddit.com",
    "v.redd.it",
    "facebook.com",
    "vimeo.com",
  ]

  // Function to format domain names for display
  const formatDomainForDisplay = (domain: string) => {
    // Remove common TLDs
    return domain.replace(".com", "").replace(".be", "").replace(".it", "")
  }

  const isValidAllowedUrl = (urlString: string) => {
    try {
      const parsedUrl = new URL(urlString)
      return allowedDomains.some((domain) => parsedUrl.hostname.endsWith(domain))
    } catch (e) {
      return false
    }
  }

  const doDownload = async () => {
    if (!isValidAllowedUrl(url)) {
      setDownloadState("invalid")
      if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current)
      invalidTimeoutRef.current = setTimeout(() => {
        setDownloadState("idle")
      }, 3000)
      return
    }

    // Obtenemos el título sugerido (con extensión) usando el comando get_video_title
    let defaultName = "video.mp4"
    try {
      const title = await invoke<string>("get_video_title", {
        url,
        downloadType: activeTab,
      })
      if (title && typeof title === "string") {
        defaultName = title
      }
    } catch (err) {
      console.error("Error obteniendo título:", err)
    }

    // Extraemos la extensión del título sugerido
    const parts = defaultName.split(".");
    const ext = parts.length > 1 ? parts.pop()! : "mp4";


    // Abrir diálogo para elegir ruta, usando el nombre sugerido y filtrando por la extensión correcta
    const filePath = await save({
      title: "Save Video As",
      defaultPath: defaultName,
      filters: [{ name: "Video", extensions: [ext] }],
    })
    if (!filePath || typeof filePath !== "string") {
      // Si se cancela el diálogo, salimos
      return
    }
    try {
      setDownloadState("downloading")
      setProgress(10)

      const progressInterval = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + 5 : prev))
      }, 500)

      const downloadType = activeTab
      await invoke<string>("download_video", {
        url,
        savePath: filePath,
        downloadType,
      });
      

      clearInterval(progressInterval)
      setProgress(100)
      setDownloadState("success")
    } catch (error) {
      console.error("Download failed:", error)
      setDownloadState("error")
      setProgress(0)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (inputRef.current) {
        inputRef.current.focus()
        setUrl(text)
        setDownloadState("idle")
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "v") {
        handlePaste()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current)
  }, [url])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-right mb-2">
          <button
            onClick={() => setShowFormats(!showFormats)}
            className="text-gray-400 hover:text-white text-sm inline-flex items-center"
          >
            supported formats <span className="ml-1 text-lg">+</span>
          </button>
        </div>
        <div className="text-center mb-8">
          <img src="./ejemplo.png" alt="Cat Logo" className="mx-auto h-32 w-auto" />
        </div>
        {showFormats && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="bg-[#1a1a1a] rounded-lg p-6 max-w-md w-full relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-sm font-mono">supported services</h3>
                <button
                  onClick={() => setShowFormats(false)}
                  className="text-gray-400 hover:text-white bg-[#2a2a2a] rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <span className="sr-only">Close</span>✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {allowedDomains.map((domain, index) => (
                  <div key={index} className="bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs text-center">
                    {formatDomainForDisplay(domain)}
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-4">
                {appName} is not affiliated with any of the services listed above.
              </p>
            </div>
          </div>
        )}
        <Tabs defaultValue="auto" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="relative">
            <Input
              placeholder="Paste the link here"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={downloadState === "downloading"}
              className="text-white placeholder:text-gray-400 bg-gray-800 border-gray-700"
              ref={inputRef}
            />
          </div>
          <TabsList className="grid grid-cols-3 bg-gray-800 rounded-md">
            <TabsTrigger value="auto" className="data-[state=active]:bg-black data-[state=active]:text-white">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="inline-block w-4 h-4">💥</span>
                <span>Auto</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-black data-[state=active]:text-white">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="inline-block w-4 h-4">🎶</span>
                Audio
              </div>
            </TabsTrigger>
            <TabsTrigger value="mute" className="data-[state=active]:bg-black data-[state=active]:text-white">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="inline-block w-4 h-4">🔇</span>
                Mute
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="auto">
            <div className="min-h-[20px]"></div>
          </TabsContent>
          <TabsContent value="audio">
            <div className="min-h-[20px]"></div>
          </TabsContent>
          <TabsContent value="mute">
            <div className="min-h-[20px]"></div>
          </TabsContent>
        </Tabs>
        {downloadState === "downloading" && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Downloading...</span>
            </div>
            <Progress value={progress} className="h-2 bg-gray-700" />
          </div>
        )}
        {downloadState === "success" && (
          <div className="bg-green-900/50 p-3 rounded-md border border-green-700/50">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Download complete!</span>
            </div>
          </div>
        )}
        {downloadState === "error" && (
          <div className="bg-red-900/50 p-3 rounded-md border border-red-700/50">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Error downloading video</span>
            </div>
          </div>
        )}
        {downloadState === "invalid" && (
          <div className="bg-red-900/50 p-3 rounded-md border border-red-700/50">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Invalid URL</span>
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <Button
            onClick={doDownload}
            disabled={!url || downloadState === "downloading"}
            className="bg-white text-black hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-400 px-8 mt-4"
            variant="default"
          >
            {downloadState === "downloading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              "Download"
            )}
          </Button>
        </div>
        <p className="text-xs text-center text-gray-500 mt-4">Created by Ejemplo with ❤️</p>
      </div>
    </div>
  )
}

