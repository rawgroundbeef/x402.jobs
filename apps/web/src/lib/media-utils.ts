/** Extract image URLs from various response shapes (imageDataUrl, artifactUrl, images as string[] or [{url}]) */
export function extractImageUrls(data: Record<string, unknown>): string[] {
  const urls: string[] = [];

  // Check imageDataUrl (base64 inline)
  if (
    typeof data.imageDataUrl === "string" &&
    data.imageDataUrl.startsWith("data:image/")
  ) {
    urls.push(data.imageDataUrl);
  }

  // Check artifactUrl (hosted image)
  if (
    typeof data.artifactUrl === "string" &&
    !urls.includes(data.artifactUrl) &&
    (data.artifactUrl.startsWith("data:image/") ||
      /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|$)/i.test(data.artifactUrl))
  ) {
    urls.push(data.artifactUrl);
  }

  // Check images array
  if (Array.isArray(data.images)) {
    for (const img of data.images as Array<string | { url: string }>) {
      const url = typeof img === "string" ? img : img?.url;
      if (url && !urls.includes(url)) urls.push(url);
    }
  }

  return urls;
}

/** JSON replacer that truncates base64 data URLs for readable display */
export function truncateBase64(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:")) {
    const sizeKB = Math.round(value.length / 1024);
    const mimeMatch = value.match(/^data:([^;]+)/);
    const mimeType = mimeMatch?.[1] || "unknown";
    return `[${mimeType} - ${sizeKB}KB base64]`;
  }
  return value;
}
