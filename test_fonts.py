
from PIL import ImageFont
import os

def test_font(path, size, index=0):
    print(f"Testing {path}...")
    if not os.path.exists(path):
        print(f"  FAILED: Path does not exist.")
        return
    
    try:
        font = ImageFont.truetype(path, size, index=index)
        print(f"  SUCCESS: Loaded font object {font}")
        print(f"  Size: {font.size}")
    except Exception as e:
        print(f"  ERROR: {e}")

fonts_to_test = [
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc"
]

for f in fonts_to_test:
    test_font(f, 100)
