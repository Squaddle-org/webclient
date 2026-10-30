import jsQR from "jsqr";

export interface QrScanner {
  /** Call when the UI unmounts/the user cancels - stops the camera stream and the scan loop. */
  stop(): void;
}

/** `false` without even asking for camera permission - lets the caller show "not supported"
 * instead of a doomed permission prompt. */
export function cameraSupported(): boolean {
  return "mediaDevices" in navigator && typeof navigator.mediaDevices?.getUserMedia === "function";
}

/**
 * Opens the camera into [video], decoding every frame with `jsQR` (self-hosted, pure-JS - same
 * "bundled, not CDN-loaded" posture as `qrcode`) until [onDecoded] fires with a non-empty string,
 * or the caller calls {@link QrScanner.stop}. Rejects if camera permission is denied or no camera
 * is available - caller should catch and show an error state.
 */
export async function startQrScan(video: HTMLVideoElement, onDecoded: (text: string) => void): Promise<QrScanner> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true"); // iOS Safari - otherwise it forces fullscreen playback
  await video.play();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stopped = false;

  const tick = (): void => {
    if (stopped) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(frame.data, frame.width, frame.height);
      if (result && result.data) {
        onDecoded(result.data);
        return; // caller decides whether to stop() or keep scanning
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
