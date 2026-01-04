# Unit Sprite Sheets

These PNG sprite sheets are generated from animated WebP files in the parent directory (`unit_assets/`).

## Format

Each sprite sheet is a horizontal strip of 16x16 pixel frames:
- 4-frame animations: 64x16 pixels
- 2-frame animations: 32x16 pixels

## Generating Sprite Sheets

Requires Python 3 with Pillow:

```bash
pip install Pillow
```

Run from the `unit_assets/` directory:

```bash
cd unit_assets
python3 -c "
from PIL import Image
import os

os.makedirs('sprites', exist_ok=True)

for f in os.listdir('.'):
    if not f.endswith('.webp'):
        continue
    name = f[:-5]
    img = Image.open(f)

    # Extract all frames
    frames = []
    try:
        while True:
            frames.append(img.copy())
            img.seek(img.tell() + 1)
    except EOFError:
        pass

    if len(frames) > 1:
        # Create horizontal strip
        width = frames[0].width
        height = frames[0].height
        strip = Image.new('RGBA', (width * len(frames), height))
        for i, frame in enumerate(frames):
            if frame.mode != 'RGBA':
                frame = frame.convert('RGBA')
            strip.paste(frame, (i * width, 0))
        strip.save(f'sprites/{name}.png')
        print(f'Created sprites/{name}.png ({len(frames)} frames, {width}x{height})')
"
```

## Adding New Units

1. Place the animated WebP in `unit_assets/` (e.g., `GENewUnit.webp`)
2. Run the script above to generate the sprite sheet
3. Add an entry to `UNIT_SPRITE_SHEETS` in `src/textures.ts`:

```typescript
newUnit: { file: 'GENewUnit.png', frameCount: 4, frameDuration: 250 },
```

## Inspecting WebP Frame Info

To check frame count and timing of a WebP file:

```bash
webpmux -info GEInfantry.webp
```
