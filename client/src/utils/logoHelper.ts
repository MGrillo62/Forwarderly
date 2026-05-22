/**
 * Helper to fetch a remote image URL and convert it safely to a Base64 data URL.
 * Handles CORS with crossOrigin = 'Anonymous' and includes a timeout fallback.
 * Returns null if the conversion fails or times out, allowing the PDF to print without the logo rather than failing.
 */
export function getBase64ImageFromUrl(url: string | null | undefined, timeoutMs = 3000): Promise<string | null> {
  if (!url) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`Timeout converting image to base64: ${url}`);
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      if (timedOut) return;
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (err) {
        console.error(`Error converting loaded image to base64:`, err);
        resolve(null);
      }
    };

    img.onerror = (err) => {
      if (timedOut) return;
      clearTimeout(timer);
      console.warn(`Error loading image for base64 conversion: ${url}`, err);
      resolve(null);
    };

    img.crossOrigin = 'Anonymous';
    img.src = url;
  });
}
