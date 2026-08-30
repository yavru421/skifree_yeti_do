// public/js/SpriteUtils.js
// Universal Chroma-Key Canvas Texture Preprocessor for Pixel-Perfect Retro Sprites

export function loadChromaKeyTexture(url, threshold = 215, onLoaded) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    // Strip white/off-white background pixels to 100% alpha transparency
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > threshold && g > threshold && b > threshold) {
        data[i + 3] = 0; // Transparent
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    if (onLoaded) onLoaded(texture);
  };
  img.src = url;
}
