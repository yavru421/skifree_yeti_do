from PIL import Image
import numpy as np

img = Image.open('C:/dev/skifree-yeti-do/public/assets/pine_tree.jpg').convert('RGBA')
data = np.array(img)

# White background removal: if R>235, G>235, B>235 -> Alpha = 0
r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
mask = (r > 230) & (g > 230) & (b > 230)
data[mask, 3] = 0

# Soft alpha feathering on near-white
near_white = (r > 210) & (g > 210) & (b > 210) & (~mask)
alpha_factor = 1.0 - ((r[near_white].astype(float) - 210) / 20.0)
data[near_white, 3] = (alpha_factor * 255).astype(np.uint8)

res = Image.fromarray(data)
res.save('C:/dev/skifree-yeti-do/public/assets/pine_tree.png')
print("Saved pine_tree.png with transparent alpha channel successfully.")
