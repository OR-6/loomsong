"""Build public/models/loom.glb: the toy loom + lever box + knob + bobbin + shelf + basket.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/build_loom.py

Art direction ("chunky toy tray", see docs/ART-DIRECTION.md): one bold
silhouette, a thick sunny-yellow rim around a navy felt bed, tomato-red
accents, flat glossy paint, no photo textures, no thin parts. Shapes are soft
and rounded like moulded toys. Colour lives on big things; the yarn and the
woven picture are the brightest.

Named nodes the game relies on: Loom/Frame/* (Lever*, SlotFloor* mirror with
the lever side), LeverKnob (Stem, Cap0: material 'KnobPaint' recoloured per
lever), Bobbin (Spool, Wound), Shelf, Basket. Material 'Beech' is the rim paint
(the workshop theme tints it). Origin = loom-local desk contact (game coords)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *

reset()
L, LV, B, C = DIMS['LOOM'], DIMS['LEVER'], DIMS['BOBBIN'], DIMS['CARD']
# Palette (sRGB). Glossy toy paint everywhere; no textures.
YELLOW = mat_paint('Beech', 0xf7be3b, rough=0.4, clearcoat=0.45)   # the rim (name kept for theme tint)
NAVY = mat_paint('FeltBed', 0x34507a, rough=0.85, clearcoat=0.0)    # felt bed: matte
TOMATO = mat_paint('PaintTomato', 0xe8553e, rough=0.38, clearcoat=0.5)
CREAM = mat_paint('PaintCream', 0xfff2dc, rough=0.45, clearcoat=0.35)
TEAL = mat_paint('PaintTeal', 0x2a9d8f, rough=0.38, clearcoat=0.5)
INK = mat_paint('Walnut', 0x3a2a22, rough=0.5, clearcoat=0.2)
KNOB = mat_paint('KnobPaint', 0xe8553e, rough=0.28, clearcoat=0.8)  # glossy gumball
YARN = mat_paint('Yarn', 0xfff6e8, rough=0.95, clearcoat=0.0)
CLOTH = mat_paint('ClothRoll', 0xfff2dc, rough=0.95, clearcoat=0.0)
YARN_L = mat_paint('SpoolYarnTomato', 0xe8553e, rough=0.9, clearcoat=0.0)
YARN_R = mat_paint('SpoolYarnTeal', 0x2a9d8f, rough=0.9, clearcoat=0.0)

root = empty('Loom')
frame = empty('Frame', parent=root)

HW = L['frameHalfWidth'] + 0.008          # rail centre x
Z0, Z1 = L['backBeamZ'] - 0.04, L['frontBeamZ'] + 0.026
ZM, ZL = (Z0 + Z1) / 2, (Z1 - Z0)

# ---- The tray: a navy felt bed inside one thick, very round yellow rim ----
rounded_box('Bed', (HW * 2 + 0.02, 0.005, ZL - 0.01), (0, 0.0025, ZM), bevel=0.0024, segs=2, mat=NAVY, parent=frame)
for s, n in ((-1, 'RailL'), (1, 'RailR')):
    rounded_box(n, (0.03, 0.028, ZL), (s * HW, 0.014, ZM), bevel=0.012, segs=5, mat=YELLOW, parent=frame)
rounded_box('RailBack', (HW * 2 + 0.03, 0.024, 0.03), (0, 0.012, Z0 + 0.015), bevel=0.011, segs=5, mat=YELLOW, parent=frame)
rounded_box('RailFront', (HW * 2 + 0.03, 0.02, 0.028), (0, 0.01, Z1 - 0.014), bevel=0.0095, segs=5, mat=YELLOW, parent=frame)
# tomato corner bumpers (like the coloured corners on a mini-golf course)
for s in (-1, 1):
    for zc in (Z0 + 0.015, Z1 - 0.014):
        ellipsoid('Bumper', (0.019, 0.017, 0.019), (s * HW, 0.017, zc), mat=TOMATO, parent=frame, segs=24)

# Pip's perches: a round tomato pad on each side rail where the shuttle rests,
# so the yellow bird always sits on a contrasting colour.
for s, n in ((-1, 'PerchL'), (1, 'PerchR')):
    lathe(n, [(0, 0), (0.0175, 0), (0.0185, 0.003), (0.0175, 0.006), (0, 0.006)], (s * HW, 0.0275, DIMS['SHUTTLE']['z']), segs=32, mat=TOMATO, parent=frame)

# ---- Rollers: the warp beam at the back, the cloth roll at the front ----
def roller(name, y, z, r, body, cap):
    half = HW - 0.018
    lathe(name, [(0.0, -half), (r, -half), (r, half), (0.0, half)], (0, y, z), axis='X', segs=32, mat=body, parent=frame)
    for sx in (-1, 1):
        ellipsoid(f'{name}Cap{"L" if sx < 0 else "R"}', (0.006, r * 1.15, r * 1.15), (sx * half, y, z), mat=cap, parent=frame, segs=20)
roller('BackBeam', L['beamY'] + 0.006, L['backBeamZ'], 0.011, TOMATO, CREAM)
roller('FrontBeam', L['beamY'] + 0.001, L['frontBeamZ'], 0.0125, CLOTH, TOMATO)

# ---- Uprights + heddle bar: chunky tomato posts, a yellow bar, spool tops ----
PH = 0.074
for s, n in ((-1, 'PostL'), (1, 'PostR')):
    lathe(n, [(0, 0), (0.0125, 0), (0.0125, PH - 0.004), (0.0105, PH), (0, PH)], (s * HW, 0.012, L['heddleZ']), segs=28, mat=TOMATO, parent=frame)
    top = PH + 0.012
    lathe(n + 'Spool', [(0, 0), (0.0118, 0), (0.0122, 0.003), (0.0072, 0.0045), (0.0072, 0.0175), (0.0122, 0.019), (0.0118, 0.022), (0, 0.022)],
          (s * HW, top, L['heddleZ']), segs=28, mat=CREAM, parent=frame)
    lathe(n + 'SpoolYarn', [(0, 0.0045), (0.0098, 0.0045), (0.0106, 0.007), (0.0106, 0.015), (0.0098, 0.0175), (0, 0.0175)],
          (s * HW, top, L['heddleZ']), segs=28, mat=(YARN_L if s < 0 else YARN_R), parent=frame)
rounded_box('HeddleBar', (HW * 2 + 0.006, 0.019, 0.019), (0, PH + 0.004, L['heddleZ']), bevel=0.0085, segs=5, mat=YELLOW, parent=frame)

# ---- Lever box: a mini version of the tray (yellow rim, navy felt top) beside
# the loom, aligned with it. Slots are dark grooves; the knobs are gumballs. ----
x_first, sp, n = LV['firstX'], LV['spacing'], DIMS['LEVERS']
bx0, bx1 = x_first - 0.021, x_first + sp * (n - 1) + 0.021
bz0, bz1 = LV['restZ'] - LV['travel'] - 0.022, LV['restZ'] + 0.022
BW, BD, BX, BZ = bx1 - bx0, bz1 - bz0, (bx0 + bx1) / 2, (bz0 + bz1) / 2
TOP = 0.024
rounded_box('LeverBase', (BW, TOP, BD), (BX, TOP / 2, BZ), bevel=0.011, segs=5, mat=YELLOW, parent=frame)
plate = rounded_box('LeverTop', (BW - 0.014, 0.004, BD - 0.014), (BX, TOP - 0.0005, BZ), bevel=0.0018, segs=2, mat=NAVY, parent=frame)
for k in range(n):
    cut = rounded_box(f'Slot{k}', (0.0085, 0.03, LV['travel'] + 0.012), (x_first + k * sp, TOP, LV['restZ'] - LV['travel'] / 2),
                      bevel=0.003, segs=2)
    mod = plate.modifiers.new('slot', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    apply_mods(plate)
    bpy.data.objects.remove(cut, do_unlink=True)
for k in range(n):
    rounded_box(f'SlotFloor{k}', (0.0082, 0.002, LV['travel'] + 0.011), (x_first + k * sp, TOP - 0.004, LV['restZ'] - LV['travel'] / 2),
                bevel=0.0008, segs=1, mat=INK, parent=frame)

# ---- Card stand: a yellow easel behind the heddle (same family as the rim) ----
EZ, EY = C['z'], C['baseY']
for s in (-1, 1):
    lathe(f'EaselPost{"L" if s < 0 else "R"}', [(0, 0), (0.0062, 0), (0.0062, EY - 0.02), (0, EY - 0.02)],
          (s * 0.05, 0.02, EZ), segs=18, mat=YELLOW, parent=frame)
rounded_box('EaselLedge', (0.15, 0.009, 0.022), (0, EY - 0.0035, EZ - 0.002), bevel=0.004, segs=3, mat=YELLOW, parent=frame)
rounded_box('EaselLip', (0.15, 0.009, 0.006), (0, EY + 0.002, EZ + 0.0075), bevel=0.0028, segs=3, mat=TOMATO, parent=frame)

# ---- Plush shelf: a yellow bench with tomato feet, origin on the desk ----
shelf = empty('Shelf', at=(0, 0, 0))
SW, SD, SY = 0.245, 0.056, 0.03
rounded_box('ShelfTop', (SW, 0.012, SD), (0, SY, 0), bevel=0.0055, segs=4, mat=YELLOW, parent=shelf)
for s_ in (-1, 1):
    lathe(f'ShelfLeg{"L" if s_ < 0 else "R"}', [(0, 0), (0.0105, 0), (0.0095, SY - 0.006), (0, SY - 0.006)],
          (s_ * (SW / 2 - 0.024), 0, 0), segs=24, mat=TOMATO, parent=shelf)

# ---- Yarn basket (chapter picker): a smooth teal bowl with a cream rim ----
basket = empty('Basket', at=(0, 0, 0))
bowl = lathe('BasketBowl', [(0.0, 0.002), (0.029, 0.002), (0.033, 0.006), (0.0385, 0.016), (0.0412, 0.026), (0.0412, 0.029),
                             (0.0372, 0.029), (0.0352, 0.017), (0.031, 0.008), (0.0, 0.007)], (0, 0, 0), segs=48, mat=TEAL, parent=basket)
bowl.scale = (1.45, 1, 1)
rim = lathe('BasketRim', [(0.0368, 0.0285), (0.0425, 0.0285), (0.0432, 0.0312), (0.0405, 0.033), (0.0372, 0.031)],
            (0, 0, 0), segs=48, mat=CREAM, parent=basket)
rim.scale = (1.45, 1, 1)

# ---- Lever knob prototype (cloned ×4 in code): a cream stem and a big glossy
# gumball head (recoloured per lever). ----
knob = empty('LeverKnob', at=(0, 0, 0))
r = LV['knobRadius']
KY = LV['knobY']
lathe('Stem', [(0, 0.0), (0.0048, 0.0), (0.0045, KY - r * 0.7), (0, KY - r * 0.7)], (0, 0, 0), segs=18, mat=CREAM, parent=knob)
head = [(0, -r)] + [(r * math.sin(a), -r * math.cos(a)) for a in [i * math.pi / 18 for i in range(1, 18)]] + [(0, r)]
cap = lathe('Cap0', head, (0, KY, 0), segs=36, mat=KNOB, parent=knob)
cap.scale = (1.0, 1.0, 0.9)

# ---- Bobbin (undo spool): cream flanges, wound yarn ----
bob = empty('Bobbin', at=(0, 0, 0))
br = B['radius']
lathe('Spool', [(0, -0.012), (br * 1.3, -0.012), (br * 1.36, -0.010), (br * 0.55, -0.008), (br * 0.55, 0.008),
                (br * 1.36, 0.010), (br * 1.3, 0.012), (0, 0.012)], (0, 0, 0), axis='X', segs=28, mat=CREAM, parent=bob)
lathe('Wound', [(0, -0.0078), (br * 1.05, -0.0078), (br * 1.16, -0.004), (br * 1.16, 0.004), (br * 1.05, 0.0078), (0, 0.0078)],
      (0, 0, 0), axis='X', segs=28, mat=YARN, parent=bob)

out = os.path.join(HERE, '..', '..', 'public', 'models', 'loom.glb')
bpy.ops.object.select_all(action='DESELECT')
for o in [root, *root.children_recursive, knob, *knob.children_recursive, bob, *bob.children_recursive,
          shelf, *shelf.children_recursive, basket, *basket.children_recursive]:
    o.select_set(True)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True)
print('EXPORTED', os.path.abspath(out))
