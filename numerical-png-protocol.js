import { encode as fastPngEncode } from "https://cdn.jsdelivr.net/npm/fast-png@6.1.0/+esm";

// 数値PNG(RGB) → 浸水深(m)
const rgb2value = (r, g, b) => (r * 65536 + g * 256 + b) * 0.001;

// カラーパレット
const value2color = (d, ALPHA = 153) => {
  if (d >= 200) return [150, 0, 24, ALPHA]; // 深赤
  if (d >= 150) return [200, 45, 38, ALPHA]; // 赤
  if (d >= 100) return [240, 140, 70, ALPHA]; // オレンジ
  if (d >= 80) return [250, 220, 120, ALPHA]; // 黄
  if (d >= 60) return [200, 230, 240, ALPHA]; // 淡水色
  if (d >= 40) return [160, 200, 225, ALPHA]; // 水色
  if (d >= 20) return [120, 170, 210, ALPHA]; // 淡青
  if (d > 0) return [80, 130, 190, ALPHA]; // 青
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
        const value = rgb2value(r, g, b);
        const [nr, ng, nb, na] = value2color(value);
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
maplibregl.addProtocol("numpng", (params, callback) => {
  const url = params.url.replace("numpng://", "");

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
