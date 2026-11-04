import os
import zipfile
from PIL import Image, ImageOps, ImageEnhance
import numpy as np

os.makedirs('assets/images/recovery', exist_ok=True)
os.makedirs('assets/images/hardware', exist_ok=True)
os.makedirs('assets/images/sem', exist_ok=True)
os.makedirs('assets/images/team', exist_ok=True)

def save_optimized_jpg(im, out_path, max_dim=1600, quality=85, contrast=1.06, sharpness=1.08, brightness=1.02):
    if im.mode in ('RGBA', 'P'):
        bg = Image.new('RGB', im.size, (10, 15, 28))
        if im.mode == 'P':
            im = im.convert('RGBA')
        bg.paste(im, mask=im.split()[3])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    if brightness != 1.0:
        im = ImageEnhance.Brightness(im).enhance(brightness)
    if contrast != 1.0:
        im = ImageEnhance.Contrast(im).enhance(contrast)
    if sharpness != 1.0:
        im = ImageEnhance.Sharpness(im).enhance(sharpness)
    im.save(out_path, 'JPEG', quality=quality, optimize=True, progressive=True)
    print(f"Saved {out_path} ({im.size[0]}x{im.size[1]}, {os.path.getsize(out_path)//1024} KB)")

# 1. Process Recovery & Damaged Box Photos (Rotate, Crop, Enhance)
# 1a. NASA Letter (CamScanner)
letter = ImageOps.exif_transpose(Image.open('GeneralData/CamScanner 7-10-26 20.09_1.JPG'))
w, h = letter.size
# Trim rough scanner edges slightly
letter_crop = letter.crop((int(w*0.03), int(h*0.02), int(w*0.96), int(h*0.95)))
save_optimized_jpg(letter_crop, 'assets/images/recovery/nasa_letter.jpg', max_dim=1500, quality=86, contrast=1.12, sharpness=1.15)

# 1b. IMG_1814: Crushed Flight Box + NASA Letter side-by-side
im1814 = ImageOps.exif_transpose(Image.open('GeneralData/IMG_1814.jpeg'))
w, h = im1814.size
# Crop out top-left desk cable and frame tightly around letter + crushed payload
im1814_crop = im1814.crop((int(w*0.03), int(h*0.02), int(w*0.97), int(h*0.97)))
save_optimized_jpg(im1814_crop, 'assets/images/recovery/box_and_letter.jpg', max_dim=1600, quality=85, contrast=1.08, brightness=1.05)

# 1c. IMG_1822: Buckled & crumpled chassis close-up
im1822 = ImageOps.exif_transpose(Image.open('GeneralData/IMG_1822.jpeg'))
w, h = im1822.size
im1822_crop = im1822.crop((int(w*0.14), int(h*0.06), int(w*0.96), int(h*0.94)))
save_optimized_jpg(im1822_crop, 'assets/images/recovery/crushed_chassis_closeup.jpg', max_dim=1500, quality=85, contrast=1.08, brightness=1.03)

# 1d. IMG_1826: Overhead Forensic Teardown Table (rotate 90 deg CCW so table & components sit horizontally!)
im1826 = ImageOps.exif_transpose(Image.open('GeneralData/IMG_1826.jpeg'))
im1826_rot = im1826.rotate(90, expand=True) # Now landscape!
w, h = im1826_rot.size
# Crop out floor/wall edges to focus cleanly on the white teardown table
im1826_crop = im1826_rot.crop((int(w*0.02), int(h*0.12), int(w*0.96), int(h*0.96)))
save_optimized_jpg(im1826_crop, 'assets/images/recovery/forensic_teardown_table.jpg', max_dim=1600, quality=85, contrast=1.08, brightness=1.05)

# 1e. IMG_1823: Surviving Camera PCB & Kapton-Taped 128GB SanDisk Extreme MicroSD
im1823 = ImageOps.exif_transpose(Image.open('GeneralData/IMG_1823.jpeg'))
w, h = im1823.size
im1823_crop = im1823.crop((int(w*0.22), int(h*0.0), int(w*0.94), int(h*0.88)))
save_optimized_jpg(im1823_crop, 'assets/images/recovery/surviving_sd_card.jpg', max_dim=1400, quality=85, contrast=1.07)

# 1f. IMG_1820: Looking straight through the emptied, bent enclosure shell
im1820 = ImageOps.exif_transpose(Image.open('GeneralData/IMG_1820.jpeg'))
w, h = im1820.size
im1820_crop = im1820.crop((int(w*0.06), int(h*0.14), int(w*0.94), int(h*0.92)))
save_optimized_jpg(im1820_crop, 'assets/images/recovery/bent_enclosure_interior.jpg', max_dim=1400, quality=84, contrast=1.06)

# 2. Extract & Optimize Hardware, Prototype & Team Photos from PPTX
pptx_map = {
    'ppt/media/image5.png':  ('assets/images/hardware/v1_12tube_diagram.jpg', 1400),
    'ppt/media/image6.png':  ('assets/images/hardware/v1_perforated_tube_cad.jpg', 1200),
    'ppt/media/image3.png':  ('assets/images/hardware/v1_cylinder_cad.jpg', 1200),
    'ppt/media/image9.jpg':  ('assets/images/hardware/v2_whiteboard_sketch.jpg', 1400),
    'ppt/media/image14.jpg': ('assets/images/hardware/v2_rotary_plate_cad.jpg', 1400),
    'ppt/media/image15.jpg': ('assets/images/hardware/v2_3dprinted_rig.jpg', 1400),
    'ppt/media/image11.jpg': ('assets/images/hardware/v2_cardboard_mockup.jpg', 1400),
    'ppt/media/image13.jpg': ('assets/images/hardware/final_payload_front.jpg', 1600),
    'ppt/media/image12.jpg': ('assets/images/hardware/final_payload_electronics.jpg', 1600),
    'ppt/media/image10.jpg': ('assets/images/team/team_soldering_trio.jpg', 1500),
    'ppt/media/image17.jpg': ('assets/images/team/team_soldering_qual.jpg', 1400),
    'ppt/media/image16.jpg': ('assets/images/team/team_soldering_bench.jpg', 1400),
    'ppt/media/image18.jpg': ('assets/images/team/team_cad_coding.jpg', 1400),
}

with zipfile.ZipFile('GeneralData/TR5_World 24_Showcase Presentation.pptx', 'r') as z:
    for zpath, (out_path, mdim) in pptx_map.items():
        with z.open(zpath) as f:
            im = ImageOps.exif_transpose(Image.open(f))
            # For PNG diagrams with white/light interiors, preserve crispness on white or original bg
            if zpath.endswith('.png'):
                if im.mode in ('RGBA', 'P'):
                    bg = Image.new('RGB', im.size, (240, 246, 252))
                    if im.mode == 'P': im = im.convert('RGBA')
                    bg.paste(im, mask=im.split()[3])
                    im = bg
            save_optimized_jpg(im, out_path, max_dim=mdim, quality=86, contrast=1.04, sharpness=1.06, brightness=1.0)

# Wiring Diagram
wiring = Image.open('GeneralData/Wiring Diagram.jpg').convert('RGB')
# Trim excessive blank white bottom/right margin on Wiring Diagram!
arr_w = np.array(wiring)
non_white = (arr_w.min(axis=2) < 245)
ys, xs = np.where(non_white)
pad = 28
wiring_crop = wiring.crop((max(0, xs.min()-pad), max(0, ys.min()-pad), min(wiring.width, xs.max()+pad), min(wiring.height, ys.max()+pad)))
save_optimized_jpg(wiring_crop, 'assets/images/hardware/wiring_diagram.jpg', max_dim=1800, quality=90, contrast=1.05, sharpness=1.1, brightness=1.0)

# 3. Process SEM & EDS Zirconium Images
sem_hd = Image.open('GeneralData/ZirconiumHighDefinition.png').convert('RGB')
sem_hd.save('assets/images/sem/zirconium_sem_35kx.jpg', 'JPEG', quality=92, optimize=True)
# Also save a pure electron-field crop (without the bottom white banner) so we can pixel-overlay EDS channels cleanly!
arr_sem = np.array(sem_hd)
# Find where the white info bar starts at bottom (row mean > 230)
bar_rows = np.where(arr_sem.mean(axis=(1,2)) > 220)[0]
sem_field_bottom = int(bar_rows[0]) - 2 if len(bar_rows) > 0 else int(sem_hd.height * 0.88)
sem_field = sem_hd.crop((2, 2, sem_hd.width - 2, sem_field_bottom))
sem_field.save('assets/images/sem/zirconium_sem_field_only.jpg', 'JPEG', quality=92)
print(f"SEM field crop: {sem_field.size}")

sem_low = Image.open('GeneralData/10388F40-91B3-4D05-8354-50781FF440AE.png').convert('RGB')
sem_low.save('assets/images/sem/zirconium_sem_29kx.jpg', 'JPEG', quality=92, optimize=True)

eds_full = Image.open('GeneralData/ZicroniumComposition.png').convert('RGB')
eds_full.save('assets/images/sem/eds_composite_grid.png', 'PNG', optimize=True)

# Exact 181x145 pixel grid of the 8 EDS elemental maps in ZicroniumComposition.png:
eds_coords = [
    ('C',  (47,  36, 228, 181)),
    ('Zr', (254, 36, 435, 181)),
    ('P',  (461, 36, 642, 181)),
    ('O',  (47,  221, 228, 366)),
    ('Ni', (254, 221, 435, 366)),
    ('Ce', (461, 221, 642, 366)),
    ('Fe', (146, 406, 327, 551)),
    ('Cr', (353, 406, 534, 551)),
]
print(f"Extracting {len(eds_coords)} exact EDS boxes:")
for name, (x0, y0, x1, y1) in eds_coords:
    # Pure data region (excluding the 9px black margin strip at bottom of each map box)
    box_im = eds_full.crop((x0, y0, x1, y1 - 8))
    box_im.save(f'assets/images/sem/eds_map_{name}.png', 'PNG', optimize=True)
    # Full card version including element spectroscopic line label above & 1um scale bar below
    card_im = eds_full.crop((max(0, x0-6), max(0, y0-20), min(eds_full.width, x1+6), min(eds_full.height, y1+22)))
    card_im.save(f'assets/images/sem/eds_card_{name}.png', 'PNG', optimize=True)
    print(f"  EDS {name}: box=({x0},{y0},{x1},{y1-8}) size={box_im.size[0]}x{box_im.size[1]}")
