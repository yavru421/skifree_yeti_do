import shutil
import os

src_dir = r"C:\Users\John\.gemini\antigravity\brain\fcbc5d89-5220-4699-8d76-e49d2dfd4e1f"
dst_dir = r"C:\dev\skifree-yeti-do\public\assets"

os.makedirs(dst_dir, exist_ok=True)

shutil.copyfile(
    os.path.join(src_dir, "realistic_yeti_sprite_1787980894142.jpg"),
    os.path.join(dst_dir, "yeti_v2.jpg")
)

shutil.copyfile(
    os.path.join(src_dir, "npc_skiers_sprite_1787980904494.jpg"),
    os.path.join(dst_dir, "npc_skiers.jpg")
)

print("Copied realistic Yeti v2 and NPC skiers successfully!")
