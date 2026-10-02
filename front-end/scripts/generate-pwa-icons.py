"""Regenerate opaque app icons: python3 -m pip install Pillow; python3 scripts/generate-pwa-icons.py."""
from pathlib import Path
from PIL import Image, ImageDraw

public = Path(__file__).resolve().parents[1] / 'public'
for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png'), (512, 'icon-maskable-512.png')]:
    scale = 4
    image = Image.new('RGB', (size * scale, size * scale), '#f5f0e6')
    draw = ImageDraw.Draw(image)
    # The brand's compass sparkle stays inside the maskable icon's safe circle.
    points = [(50, 19), (57, 43), (81, 50), (57, 57), (50, 81), (43, 57), (19, 50), (43, 43)]
    draw.polygon([(round(x * size * scale / 100), round(y * size * scale / 100)) for x, y in points], fill='#6e282d')
    image.resize((size, size), Image.Resampling.LANCZOS).save(public / name)
