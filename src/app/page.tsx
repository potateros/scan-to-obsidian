'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export default function Home() {
  const [markdown, setMarkdown] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');
  const [filePreview, setFilePreview] = useState<{ url: string; type: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isWebcamActive) {
      const initWebcam = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          console.error('getUserMedia is not supported');
          alert('Your browser does not support webcam access');
          setIsWebcamActive(false);
          return;
        }

        try {
          console.log('Requesting webcam access...');
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log('Available video devices:', videoDevices);

          if (videoDevices.length === 0) {
            throw new Error('No video devices found');
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          console.log('Got webcam stream:', stream);

          if (videoRef.current) {
            console.log('Setting video source...');
            videoRef.current.srcObject = stream;
            streamRef.current = stream;

            // Wait for video to be ready
            await new Promise((resolve) => {
              if (videoRef.current) {
                videoRef.current.onloadedmetadata = () => {
                  console.log('Video metadata loaded');
                  resolve(null);
                };
              }
            });

            console.log('Starting video playback...');
            await videoRef.current.play();
          } else {
            console.error('Video ref is null');
          }
        } catch (error) {
          console.error('Error accessing webcam:', error);
          alert('Error accessing webcam. Please ensure you have granted camera permissions.');
          setIsWebcamActive(false);
        }
      };

      initWebcam();
    }

    return () => {
      if (streamRef.current) {
        console.log('Cleaning up webcam stream...');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isWebcamActive]);

  const startWebcam = () => {
    setIsWebcamActive(true);
  };

  const stopWebcam = () => {
    setIsWebcamActive(false);
  };

  const captureImage = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg');

    setIsProcessing(true);
    setUploadProgress(0);
    try {
      setFilePreview({
        url: base64Image,
        type: 'image/jpeg'
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const data = await response.json();
      setMarkdown(data.markdown);
      stopWebcam();
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (20MB limit)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > MAX_SIZE) {
      alert('File size exceeds 20MB limit. Please choose a smaller file.');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Create object URL for preview
      const previewUrl = URL.createObjectURL(file);
      setFilePreview({
        url: previewUrl,
        type: file.type
      });

      // Convert the file to base64
      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      reader.readAsDataURL(file);

      reader.onload = async () => {
        const base64Data = reader.result as string;
        const fileType = file.type;

        setUploadProgress(100);

        // Send to our API endpoint
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: base64Data,
            mimeType: fileType
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to analyze file');
        }

        const data = await response.json();
        setMarkdown(data.markdown);
      };
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please try again.');
      setFilePreview(null);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      alert('Markdown copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <main className="min-h-screen p-2 sm:p-4 bg-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)]">
        {/* Left Column - File Input and Preview */}
        <div className="flex flex-col gap-2 sm:gap-4">
          {/* File Input */}
          <div className="border border-gray-200 rounded-lg p-2 sm:p-4 flex flex-col bg-white shadow-sm">
            <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-gray-800">Upload File</h2>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-full max-w-md">
                {isWebcamActive ? (
                  <div className="flex flex-col items-center w-full">
                    <div className="w-full h-48 sm:h-64 mb-2 sm:mb-4 relative bg-black rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={captureImage}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Capture Photo
                      </button>
                      <button
                        onClick={stopWebcam}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input"
                    />
                    <label
                      htmlFor="file-input"
                      className="w-full h-48 sm:h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors mb-2 sm:mb-4 relative"
                    >
                      {isProcessing && (
                        <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center">
                          <div className="w-full max-w-xs">
                            <div className="bg-gray-200 rounded-full h-2.5 mb-2">
                              <div
                                className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-sm text-gray-600 text-center">
                              {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                            </p>
                          </div>
                        </div>
                      )}
                      <svg
                        className="w-12 h-12 text-gray-400 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span className="text-sm text-gray-500">
                        Click to upload an image or PDF (max 20MB)
                      </span>
                    </label>
                    <button
                      onClick={startWebcam}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Use Webcam
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* File Preview */}
          {filePreview && (
            <div className="border border-gray-200 rounded-lg p-2 sm:p-4 bg-white shadow-sm">
              <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-gray-800">File Preview</h2>
              <div className="w-full h-48 sm:h-64 relative rounded-lg overflow-hidden bg-gray-100">
                {filePreview.type.startsWith('image/') ? (
                  <img
                    src={filePreview.url}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <iframe
                    src={filePreview.url}
                    className="w-full h-full"
                    title="PDF preview"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Markdown Output */}
        <div className="border border-gray-200 rounded-lg p-2 sm:p-4 flex flex-col bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-4 gap-2 sm:gap-0">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Generated Markdown</h2>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={copyToClipboard}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                title="Copy to clipboard"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
              </button>
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab('raw')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'raw'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Raw
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 rounded p-2 sm:p-4">
            {isProcessing ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : activeTab === 'preview' ? (
              <div className="prose prose-sm sm:prose max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  className="markdown-body"
                >
                  {markdown || 'Markdown will appear here...'}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="font-mono text-sm whitespace-pre-wrap">
                {markdown || 'Markdown will appear here...'}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Markdown Styles */}
      <style jsx global>{`
        .markdown-body {
          color: #24292e;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.5;
        }
        .markdown-body h1 { font-size: 2em; margin: 0.67em 0; font-weight: 600; }
        .markdown-body h2 { font-size: 1.5em; margin: 0.83em 0; font-weight: 600; }
        .markdown-body h3 { font-size: 1.25em; margin: 1em 0; font-weight: 600; }
        .markdown-body h4 { font-size: 1em; margin: 1.33em 0; font-weight: 600; }
        .markdown-body h5 { font-size: 0.83em; margin: 1.67em 0; font-weight: 600; }
        .markdown-body h6 { font-size: 0.67em; margin: 2.33em 0; font-weight: 600; }
        .markdown-body p { margin: 1em 0; }
        .markdown-body ul, .markdown-body ol { padding-left: 2em; margin: 1em 0; }
        .markdown-body li { margin: 0.5em 0; }
        .markdown-body blockquote {
          margin: 1em 0;
          padding-left: 1em;
          color: #6a737d;
          border-left: 0.25em solid #dfe2e5;
        }
        .markdown-body pre {
          margin: 1em 0;
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background-color: #f6f8fa;
          border-radius: 6px;
        }
        .markdown-body code {
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          background-color: rgba(27,31,35,0.05);
          border-radius: 6px;
        }
        .markdown-body pre code {
          padding: 0;
          background-color: transparent;
        }
        .markdown-body table {
          border-spacing: 0;
          border-collapse: collapse;
          margin: 1em 0;
          width: 100%;
        }
        .markdown-body table th,
        .markdown-body table td {
          padding: 6px 13px;
          border: 1px solid #dfe2e5;
        }
        .markdown-body table tr:nth-child(2n) {
          background-color: #f6f8fa;
        }
        .markdown-body hr {
          height: 0.25em;
          padding: 0;
          margin: 24px 0;
          background-color: #e1e4e8;
          border: 0;
        }
        .markdown-body img {
          max-width: 100%;
          box-sizing: content-box;
        }
      `}</style>
    </main>
  );
}
