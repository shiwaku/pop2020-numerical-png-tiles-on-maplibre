import { encode as fastPngEncode } from "https://cdn.jsdelivr.net/npm/fast-png@6.1.0/+esm";

// 数値PNG(RGB) → 浸水深(m)
const rgb2depth = (r, g, b) => (r * 65536 + g * 256 + b) * 0.001;

// パレット色
const depth2color = (d, ALPHA = 204) => {
  if (d >= 120) return [223, 115, 255, ALPHA];
  // if (d >= 120) return [255, 0, 0, ALPHA];
  if (d >= 100) return [0, 112, 255, ALPHA];
  if (d >= 80) return [45, 193, 223, ALPHA];
  if (d >= 60) return [115, 255, 222, ALPHA];
  if (d >= 40) return [77, 230, 0, ALPHA];
  if (d >= 20) return [255, 255, 0, ALPHA];
  if (d > 0.0) return [255, 255, 204, ALPHA];
  return [0, 0, 0, 0]; // 0 または NoData は透明
};

// 画像を読み→色変換→PNG(ArrayBuffer) を返す共通関数
const buildPngArrayBuffer = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        const depth = rgb2depth(r, g, b);
        const [nr, ng, nb, na] = depth2color(depth);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
        data[i + 3] = a === 0 ? 0 : na; // 元が透明なら維持
      }

      const pngData = fastPngEncode({
        width: canvas.width,
        height: canvas.height,
        data,
      });
      resolve({ data: pngData.buffer, cacheControl: null, expires: null });
    };
    image.onerror = (e) => reject(e?.error || new Error("image load failed"));
    image.src = url;
  });

// 両API対応版 addProtocol
maplibregl.addProtocol("shinsui", (params, callback) => {
  const url = params.url.replace("shinsui://", "");

  // 旧API: (params, callback)
  if (typeof callback === "function") {
    buildPngArrayBuffer(url)
      .then(({ data, cacheControl, expires }) =>
        callback(null, data, cacheControl, expires)
      )
      .catch((err) => callback(err));
    return { cancel: () => {} };
  }

  // 新API: Promise を返す
  return buildPngArrayBuffer(url);
});
