# Generates the app icons and the color wheel image from the repository's
# Tauri icon set. Run from the repository root: python3 native/scripts/assets.py
import colorsys, math, shutil
from PIL import Image

out = "native/assets"
shutil.copy("src-tauri/icons/ios/AppIcon-512@2x.png", f"{out}/icon.png")
shutil.copy(
    "src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png",
    f"{out}/android-icon-foreground.png",
)
Image.open("src-tauri/icons/icon.png").resize((256, 256), Image.LANCZOS).save(
    f"{out}/splash-icon.png"
)

# Hue runs clockwise from red at the top; saturation grows from the white
# center to the rim, like the web app's conic and radial gradients.
size = 600
wheel = Image.new("RGBA", (size, size))
pixels = wheel.load()
r = size / 2
for y in range(size):
    for x in range(size):
        dx, dy = x + 0.5 - r, y + 0.5 - r
        dist = math.hypot(dx, dy) / r
        if dist > 1.0 + 1 / r:
            continue
        hue = (math.degrees(math.atan2(dx, -dy)) + 360) % 360
        red, green, blue = colorsys.hsv_to_rgb(hue / 360, min(1, dist), 1)
        alpha = max(0.0, min(1.0, (1 - dist) * r + 1))
        pixels[x, y] = (round(red * 255), round(green * 255), round(blue * 255), round(alpha * 255))
wheel.save(f"{out}/color-wheel.png", optimize=True)
