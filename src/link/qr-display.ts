import QRCode from "qrcode";

/** Renders [text] (a `squaddle-link:v1:...` URI) as a QR code into a fresh `<canvas>` - a
 * self-hosted, pure-JS encoder (`qrcode` npm package, bundled by Vite, not loaded from a CDN -
 * same posture as `sql.js`/`libsodium-wrappers-sumo` already have). */
export async function renderLinkQr(text: string, sizePx = 240): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, { width: sizePx, margin: 1 });
  return canvas;
}
