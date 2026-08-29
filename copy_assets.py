import shutil
import os

src_dir = r"C:\Users\John\.gemini\antigravity\brain\fcbc5d89-5220-4699-8d76-e49d2dfd4e1f"
dst_dir = r"C:\dev\skifree-yeti-do\public\assets"

os.makedirs(dst_dir, exist_ok=True)

yeti_src = os.path.join(src_dir, "yeti_spritesheet_1787978466287.jpg")
skier_src = os.path.join(src_dir, "skier_spritesheet_1787978451901.jpg")

shutil.copyfile(yeti_src, os.path.join(dst_dir, "yeti.jpg"))
shutil.copyfile(skier_src, os.path.join(dst_dir, "skier.jpg"))
print("Assets copied successfully!")
