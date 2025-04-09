"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, Trash2, Eye, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ImageData {
  id: string
  file: File
  url: string
  fileName: string
  fileSize: number
  fileType: string
  dimensions: { width: number; height: number }
  pixelData: any[]
  analyzed: boolean
}

export default function MultiImageAnalyzer() {
  const [images, setImages] = useState<ImageData[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analyzeProgress, setAnalyzeProgress] = useState<number>(0)
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; color: string } | null>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [activeTab, setActiveTab] = useState<string>("gallery")
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Create a copy of the current images array to avoid state mutation issues
    const currentImages = [...images]
    let processedCount = 0
    const totalFiles = files.length

    Array.from(files).forEach((file) => {
      // Validate file is an image
      if (!file.type.startsWith("image/")) {
        console.error(`File "${file.name}" is not an image`)
        processedCount++
        return
      }

      const reader = new FileReader()

      // Add error handling for FileReader
      reader.onerror = () => {
        console.error(`Error reading file: ${file.name}`)
        processedCount++

        // If all files have been processed (even with errors), update state
        if (processedCount === totalFiles) {
          setImages(currentImages)
          if (currentImages.length > 0 && !selectedImageId) {
            setSelectedImageId(currentImages[0].id)
            setActiveTab("details")
          }
        }
      }

      reader.onload = (event) => {
        if (!event.target?.result) {
          console.error(`Failed to load file: ${file.name}`)
          processedCount++
          return
        }

        const img = new Image()

        // Add error handling for Image loading
        img.onerror = () => {
          console.error(`Error loading image: ${file.name}`)
          processedCount++

          // If all files have been processed (even with errors), update state
          if (processedCount === totalFiles) {
            setImages(currentImages)
            if (currentImages.length > 0 && !selectedImageId) {
              setSelectedImageId(currentImages[0].id)
              setActiveTab("details")
            }
          }
        }

        img.onload = () => {
          const newImage: ImageData = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            url: event.target?.result as string,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dimensions: { width: img.width, height: img.height },
            pixelData: [],
            analyzed: false,
          }

          currentImages.push(newImage)
          processedCount++

          // If all files have been processed, update state
          if (processedCount === totalFiles) {
            setImages(currentImages)
            if (currentImages.length > 0 && !selectedImageId) {
              setSelectedImageId(currentImages[0].id)
              setActiveTab("details")
            }
          }
        }

        // Set the src after setting up event handlers
        img.src = event.target.result as string
      }

      // Start reading the file
      try {
        reader.readAsDataURL(file)
      } catch (error) {
        console.error(`Error reading file: ${file.name}`, error)
        processedCount++
      }
    })

    // Reset the file input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const selectedImage = images.find((img) => img.id === selectedImageId)

  const analyzeImage = () => {
    if (!selectedImage || !canvasRef.current) return

    setIsAnalyzing(true)
    setAnalyzeProgress(0)

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setIsAnalyzing(false)
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"

    // Add error handling for image loading
    img.onerror = () => {
      console.error("Error loading image for analysis")
      setIsAnalyzing(false)
    }

    img.onload = () => {
      try {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const pixels: any[] = []

        // Process in chunks to avoid UI freezing
        const totalPixels = img.width * img.height
        const chunkSize = 10000
        let processedPixels = 0

        function processChunk() {
          try {
            const end = Math.min(processedPixels + chunkSize, totalPixels)

            for (let i = processedPixels; i < end; i++) {
              const x = i % img.width
              const y = Math.floor(i / img.width)
              const idx = i * 4

              const r = imageData.data[idx]
              const g = imageData.data[idx + 1]
              const b = imageData.data[idx + 2]
              const a = imageData.data[idx + 3]

              if (x % 10 === 0 && y % 10 === 0) {
                // Sample every 10th pixel to keep data manageable
                pixels.push({
                  x,
                  y,
                  color: `rgba(${r}, ${g}, ${b}, ${a / 255})`,
                  r,
                  g,
                  b,
                  a,
                })
              }
            }

            processedPixels = end
            const progress = Math.round((processedPixels / totalPixels) * 100)
            setAnalyzeProgress(progress)

            if (processedPixels < totalPixels) {
              setTimeout(processChunk, 0)
            } else {
              setImages((prev) =>
                prev.map((img) => (img.id === selectedImageId ? { ...img, pixelData: pixels, analyzed: true } : img)),
              )
              setIsAnalyzing(false)
            }
          } catch (error) {
            console.error("Error processing image chunk", error)
            setIsAnalyzing(false)
          }
        }

        processChunk()
      } catch (error) {
        console.error("Error analyzing image", error)
        setIsAnalyzing(false)
      }
    }

    // Set the src after setting up event handlers
    img.src = selectedImage.url
  }

  const renderPixelViewer = () => {
    if (!pixelCanvasRef.current || !selectedImage || selectedImage.pixelData.length === 0) return

    const canvas = pixelCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = selectedImage.dimensions.width * zoom
    canvas.height = selectedImage.dimensions.height * zoom

    // Draw the base image
    const img = new Image()
    img.crossOrigin = "anonymous"

    // Add error handling for image loading
    img.onerror = () => {
      console.error("Error loading image for pixel viewer")

      // Draw an error message on the canvas
      ctx.fillStyle = "#f8f9fa"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = "16px sans-serif"
      ctx.fillStyle = "#dc2626"
      ctx.textAlign = "center"
      ctx.fillText("Error loading image", canvas.width / 2, canvas.height / 2)
    }

    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Highlight grid if zoom is high enough
        if (zoom >= 4) {
          ctx.strokeStyle = "rgba(200, 200, 200, 0.5)"
          ctx.lineWidth = 0.5

          for (let x = 0; x < canvas.width; x += zoom) {
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, canvas.height)
            ctx.stroke()
          }

          for (let y = 0; y < canvas.height; y += zoom) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(canvas.width, y)
            ctx.stroke()
          }
        }

        // Highlight hovered pixel if any
        if (hoveredPixel) {
          const x = hoveredPixel.x * zoom
          const y = hoveredPixel.y * zoom
          ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, zoom, zoom)
        }
      } catch (error) {
        console.error("Error rendering pixel viewer", error)
      }
    }

    // Set the src after setting up event handlers
    img.src = selectedImage.url
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pixelCanvasRef.current || !selectedImage || selectedImage.pixelData.length === 0) return

    const canvas = pixelCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / zoom)
    const y = Math.floor((e.clientY - rect.top) / zoom)

    // Find the closest pixel in our data
    const pixel = selectedImage.pixelData.find((p) => Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5)

    if (pixel) {
      setHoveredPixel({
        x: pixel.x,
        y: pixel.y,
        color: pixel.color,
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
    if (selectedImageId === id) {
      const remaining = images.filter((img) => img.id !== id)
      setSelectedImageId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const removeAllImages = () => {
    setImages([])
    setSelectedImageId(null)
    setActiveTab("gallery")
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Create a synthetic event object that mimics the file input change event
      const fileList = e.dataTransfer.files
      const event = {
        target: {
          files: fileList,
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>

      handleFileChange(event)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    try {
      if (selectedImage && selectedImage.pixelData.length > 0) {
        renderPixelViewer()
      }
    } catch (error) {
      console.error("Error in renderPixelViewer effect", error)
    }
  }, [selectedImage, zoom, hoveredPixel])

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Multi-Image Analyzer</h1>
          <p className="text-muted-foreground">Upload multiple images to analyze and compare their properties</p>
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="gallery">Gallery</TabsTrigger>
                <TabsTrigger value="details" disabled={!selectedImageId}>
                  Details
                </TabsTrigger>
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Images
                </Button>
                {images.length > 0 && (
                  <Button variant="outline" onClick={removeAllImages} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <TabsContent value="gallery" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Image Gallery</CardTitle>
                  <CardDescription>
                    {images.length === 0
                      ? "Upload images to begin analysis"
                      : `${images.length} image${images.length !== 1 ? "s" : ""} uploaded`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {images.length === 0 ? (
                    <div
                      className="border border-dashed rounded-lg flex flex-col items-center justify-center p-12 text-center"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                    >
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2">
                        Drag and drop images here or click the Add Images button
                      </p>
                      <p className="text-xs text-muted-foreground">Supports JPG, PNG, GIF, WebP, and SVG</p>
                      {uploadError && (
                        <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md text-sm">{uploadError}</div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {images.map((image) => (
                        <div
                          key={image.id}
                          className={`relative group border rounded-lg overflow-hidden cursor-pointer transition-all ${
                            selectedImageId === image.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => {
                            setSelectedImageId(image.id)
                            setActiveTab("details")
                          }}
                        >
                          <div className="aspect-square bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                            <img
                              src={image.url || "/placeholder.svg"}
                              alt={image.fileName}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                // Handle image loading errors
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg?height=200&width=200"
                                target.alt = "Failed to load image"
                              }}
                            />
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-white"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedImageId(image.id)
                                setActiveTab("details")
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-white"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeImage(image.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="p-2 text-xs truncate">{image.fileName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="mt-0">
              {selectedImage && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedImage.fileName}</CardTitle>
                        <CardDescription>
                          {formatFileSize(selectedImage.fileSize)} • {selectedImage.dimensions.width} ×{" "}
                          {selectedImage.dimensions.height} px
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="icon" onClick={() => removeImage(selectedImage.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <div className="border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900">
                          <div className="flex items-center justify-center min-h-[300px]">
                            <img
                              src={selectedImage.url || "/placeholder.svg"}
                              alt={selectedImage.fileName}
                              className="max-w-full max-h-[500px] object-contain"
                              onError={(e) => {
                                // Handle image loading errors
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg?height=400&width=400"
                                target.alt = "Failed to load image"
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Image Information</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-1">
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">File Name</div>
                              <div className="col-span-2 text-sm truncate">{selectedImage.fileName}</div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">File Size</div>
                              <div className="col-span-2 text-sm">{formatFileSize(selectedImage.fileSize)}</div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">File Type</div>
                              <div className="col-span-2 text-sm">{selectedImage.fileType}</div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">Dimensions</div>
                              <div className="col-span-2 text-sm">
                                {selectedImage.dimensions.width} × {selectedImage.dimensions.height} px
                              </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">Total Pixels</div>
                              <div className="col-span-2 text-sm">
                                {selectedImage.dimensions.width * selectedImage.dimensions.height}
                              </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">Aspect Ratio</div>
                              <div className="col-span-2 text-sm">
                                {(() => {
                                  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
                                  const w = selectedImage.dimensions.width
                                  const h = selectedImage.dimensions.height
                                  const divisor = gcd(w, h)
                                  return `${w / divisor}:${h / divisor}`
                                })()}
                              </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 py-1">
                              <div className="text-sm font-medium">Analyzed</div>
                              <div className="col-span-2 text-sm">{selectedImage.analyzed ? "Yes" : "No"}</div>
                            </div>
                          </CardContent>
                          <CardFooter></CardFooter>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Image Comparison</CardTitle>
                  <CardDescription>Compare properties of all uploaded images</CardDescription>
                </CardHeader>
                <CardContent>
                  {images.length === 0 ? (
                    <div className="text-center p-6">
                      <p className="text-muted-foreground">Upload images to compare their properties</p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>File Name</TableHead>
                            <TableHead>Dimensions</TableHead>
                            <TableHead>File Size</TableHead>
                            <TableHead>File Type</TableHead>
                            <TableHead>Total Pixels</TableHead>
                            <TableHead>Aspect Ratio</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {images.map((image) => (
                            <TableRow key={image.id}>
                              <TableCell>
                                <div className="h-10 w-10 rounded-md overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                                  <img
                                    src={image.url || "/placeholder.svg"}
                                    alt={image.fileName}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="font-medium truncate max-w-[150px]">{image.fileName}</TableCell>
                              <TableCell>
                                {image.dimensions.width} × {image.dimensions.height}
                              </TableCell>
                              <TableCell>{formatFileSize(image.fileSize)}</TableCell>
                              <TableCell>{image.fileType.split("/")[1]}</TableCell>
                              <TableCell>{image.dimensions.width * image.dimensions.height}</TableCell>
                              <TableCell>
                                {(() => {
                                  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
                                  const w = image.dimensions.width
                                  const h = image.dimensions.height
                                  const divisor = gcd(w, h)
                                  return `${w / divisor}:${h / divisor}`
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedImageId(image.id)
                                    setActiveTab("details")
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeImage(image.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
