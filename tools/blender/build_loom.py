"""Build public/models/loom.glb: the toy loom + lever box + knob + bobbin + shelf + basket.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/build_loom.py

Art direction: a chunky lacquered-wood toy loom (warm glossy wood, soft round
beams on tomato bun feet, spool tops) with bright painted accents only on
small round parts. The lever box (cream, tomato band) stands beside it.
Named nodes the game relies on: Loom/Frame/* (Lever*, SlotFloor* mirror with
the lever side), LeverKnob (Stem, Cap0 'KnobPaint'), Bobbin (Spool, Wound),
Shelf, Basket. Origin = loom-local desk contact (game coords)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *

reset()
L, LV, B, C = DIMS['LOOM'], DIMS['LEVER'], DIMS['BOBBIN'], DIMS['CARD']
SRC = os.path.join(HERE, '..', '..', 'assets-src', 'ambientcg')
wood_img = load_image(os.path.join(SRC, 'Wood095_1K-JPG', 'Wood095_soft512.png'), 512)  # soft, low-contrast grain
knit_img = load_image(os.path.join(SRC, 'Fabric019_1K-JPG', 'Fabric019_rgb256.png'), 256)
# Two wood values: honey for the loom frame (the hero), walnut for the
# furniture around it (lever box, shelf, easel) so the loom stands out.
WOOD = mat_tex('Beech', wood_img, tint=0xf2cc98, rough=0.48, clearcoat=0.15)
WALNUT = mat_tex('WalnutWood', wood_img, tint=0x9a6038, rough=0.5, clearcoat=0.12)
SLOT = mat_paint('SlotDark', 0x2e1c12, rough=0.7, clearcoat=0.0)
SAGE = mat_paint('PaintSage', 0x9cbf86, rough=0.45, clearcoat=0.3)
SAGE_DARK = mat_paint('PaintSageDark', 0x7a9d66, rough=0.6, clearcoat=0.1)
DARK = mat_paint('Walnut', 0x7a4e32, rough=0.45, clearcoat=0.2)
TOMATO = mat_paint('PaintTomato', 0xe2563b, rough=0.38, clearcoat=0.45)
MUSTARD = mat_paint('PaintMustard', 0xf2b632, rough=0.38, clearcoat=0.45)
TEAL = mat_paint('PaintTeal', 0x2a9d8f, rough=0.38, clearcoat=0.45)
KNOB = mat_paint('KnobPaint', 0xe2563b, rough=0.35, clearcoat=0.5)
YARN = mat_tex('Yarn', knit_img, tint=0xffffff, rough=0.95)
CLOTH = mat_tex('ClothRoll', knit_img, tint=0xc98a4b, rough=0.95)  # honey: the first cream row stands out against it
YARN_L = mat_tex('SpoolYarnTomato', knit_img, tint=0xe2563b, rough=0.95)
YARN_R = mat_tex('SpoolYarnTeal', knit_img, tint=0x2a9d8f, rough=0.95)

root = empty('Loom')
frame = empty('Frame', parent=root)

HW = L['frameHalfWidth'] + 0.008          # rail centre x (kept clear of lever slot 0)
Z0, Z1 = L['backBeamZ'] - 0.04, L['frontBeamZ'] + 0.016
ZM, ZL = (Z0 + Z1) / 2, (Z1 - Z0)
RY = 0.02                                  # rail centre height

# Painted accents shared with the props (shelf, basket, knobs).
YELLOW = mat_paint('PaintYellow', 0xf7be3b, rough=0.4, clearcoat=0.45)
CREAM = mat_paint('PaintCream', 0xfff2dc, rough=0.45, clearcoat=0.35)
NAVY = mat_paint('FeltBed', 0x34507a, rough=0.85, clearcoat=0.0)
INK = DARK
# ---- Rails: fat, very soft beech beams on bun feet ----
for s, n in ((-1, 'RailL'), (1, 'RailR')):
    rounded_box(n, (0.026, 0.028, ZL), (s * HW, RY, ZM), bevel=0.009, segs=4, mat=WOOD, parent=frame)
    for zf, fn in ((Z0 + 0.016, 'Back'), (Z1 - 0.016, 'Front')):
        lathe(f'Foot{n[-1]}{fn}', [(0.0, 0.0), (0.0135, 0.0), (0.0155, 0.003), (0.0145, 0.0065), (0.011, 0.0085), (0.0, 0.009)],
              (s * HW, 0.0, zf), segs=28, mat=WALNUT, parent=frame)

def roller(name, y, z, r, cap_r, body_mat, cap_mat, crank=False):
    half = HW + 0.016
    lathe(name, [(0.0, -half + 0.004), (r, -half + 0.004), (r, half - 0.004), (0.0, half - 0.004)],
          (0, y, z), axis='X', segs=32, mat=body_mat, parent=frame)
    for s in (-1, 1):  # round painted end caps
        ellipsoid(f'{name}Cap{"L" if s < 0 else "R"}', (0.006, cap_r, cap_r), (s * (half - 0.001), y, z), mat=cap_mat, parent=frame, segs=24)
    if crank:
        # On the left (away from the lever bank); mirrored in code for left-handed play.
        lathe(name + 'Crank', [(0, 0), (0.0032, 0), (0.0032, 0.018), (0, 0.018)], (-(half + 0.022), y, z), axis='X', segs=12, mat=DARK, parent=frame)
        ellipsoid(name + 'Handle', (0.0062, 0.0062, 0.0062), (-(half + 0.024), y, z), mat=MUSTARD, parent=frame, segs=18)

roller('BackBeam', L['beamY'] + 0.006, L['backBeamZ'], 0.0115, 0.0135, WOOD, DARK)
roller('FrontBeam', L['beamY'] - 0.009, L['frontBeamZ'], 0.0072, 0.0098, WOOD, DARK)
# Woven cloth wound onto the front beam: a thin wrap only as wide as the cloth.
lathe('ClothWrap', [(0.0, -0.098), (0.0078, -0.098), (0.0086, -0.094), (0.0086, 0.094), (0.0078, 0.098), (0.0, 0.098)],
      (0, L['beamY'] - 0.009, L['frontBeamZ']), axis='X', segs=32, mat=CLOTH, parent=frame)

# Navy felt bed inset inside the frame: the picture reads on it (figure/ground),
# and the floor or desk never shows through the weaving area.
rounded_box('Bed', (HW * 2 - 0.024, 0.004, ZL - 0.05), (0, 0.002, ZM + 0.004), bevel=0.0018, segs=2, mat=NAVY, parent=frame)
# Pip's lane: a slim wooden shuttle race across the loom; the lowered threads lie on it.
SZ = DIMS['SHUTTLE']['z']
rounded_box('ShuttleRace', (HW * 2 - 0.024, 0.006, 0.018), (0, 0.016, SZ), bevel=0.0026, segs=3, mat=WALNUT, parent=frame)
# Pip's perches: a round walnut stand outside each side rail at the end of the
# race (clear of the posts), with a tomato pad on top. Identical both sides.
for sx in (-1, 1):
    nm = 'L' if sx < 0 else 'R'
    lathe(f'Perch{nm}', [(0, 0), (0.0225, 0), (0.0235, 0.003), (0.0225, 0.006), (0, 0.006)], (sx * 0.168, 0.031, SZ), segs=32, mat=WALNUT, parent=frame)
    lathe(f'PerchPad{nm}', [(0, 0), (0.019, 0), (0.0195, 0.002), (0.018, 0.003), (0, 0.003)], (sx * 0.168, 0.037, SZ), segs=32, mat=SAGE, parent=frame)
    ellipsoid(f'PerchDent{nm}', (0.017, 0.0007, 0.0065), (sx * 0.168, 0.0402, SZ), mat=SAGE_DARK, parent=frame, segs=24)
    lathe(f'PerchLeg{nm}', [(0, 0), (0.006, 0), (0.0055, 0.031), (0, 0.031)], (sx * 0.168, 0, SZ), segs=16, mat=WALNUT, parent=frame)
# Little walnut ramps from each perch pad down over the rail into the race,
# so perch → race → perch reads as one continuous track for Pip.
for sx in (-1, 1):
    x0, y0, x1, y1 = sx * 0.104, 0.019, sx * 0.148, 0.038
    dx, dy = x1 - x0, y1 - y0
    rp = rounded_box(f'Ramp{"L" if sx < 0 else "R"}', (math.hypot(dx, dy) + 0.004, 0.005, 0.018), ((x0 + x1) / 2, (y0 + y1) / 2, SZ), bevel=0.002, segs=2, mat=WALNUT, parent=frame)
    rp.rotation_euler = (0, -math.atan2(dy, dx) if sx > 0 else math.atan2(dy, -dx), 0)
for sx in (-1, 1):  # end stops: the boat parks against them
    rounded_box('RaceStop', (0.006, 0.011, 0.018), (sx * (HW - 0.016), 0.022, SZ), bevel=0.0025, segs=3, mat=WALNUT, parent=frame)

# ---- Uprights + heddle bar, crowned with big painted ball finials ----
PH = 0.086  # the heddle bar clears the fully lifted threads
for s, n in ((-1, 'PostL'), (1, 'PostR')):
    rounded_box(n, (0.024, PH, 0.024), (s * HW, PH / 2 + 0.01, L['heddleZ']), bevel=0.009, segs=4, mat=WOOD, parent=frame)
    # Post top: a turned collar holding a little spool of yarn (a craft-table detail,
    # not a generic ball). Tomato yarn on the left post, teal on the right.
    top = PH + 0.01 + 0.0005
    lathe(n + 'Collar', [(0, 0), (0.0105, 0), (0.0118, 0.002), (0.0105, 0.004), (0.004, 0.0045), (0, 0.0045)],
          (s * HW, top, L['heddleZ']), segs=28, mat=DARK, parent=frame)
    lathe(n + 'Spool', [(0, 0), (0.0095, 0), (0.0098, 0.0025), (0.0052, 0.0032), (0.0052, 0.0158), (0.0098, 0.0165),
                        (0.0095, 0.019), (0.0022, 0.019), (0.0022, 0.0205), (0, 0.0205)],
          (s * HW, top + 0.0045, L['heddleZ']), segs=28, mat=WOOD, parent=frame)
    lathe(n + 'SpoolYarn', [(0, 0.0032), (0.0078, 0.0032), (0.0086, 0.0055), (0.0086, 0.0135), (0.0078, 0.0158), (0, 0.0158)],
          (s * HW, top + 0.0045, L['heddleZ']), segs=28, mat=(YARN_L if s < 0 else YARN_R), parent=frame)
rounded_box('HeddleBar', (HW * 2 + 0.004, 0.017, 0.016), (0, PH - 0.003, L['heddleZ']), bevel=0.0065, segs=4, mat=WOOD, parent=frame)

# Painted dowel ends where beams meet (reads as "built from wood").
for s in (-1, 1):
    for (y, z) in ((RY, Z0 + 0.034), (RY, Z1 - 0.034)):
        ellipsoid('Peg', (0.0035, 0.0052, 0.0052), (s * (HW + 0.013), y, z), mat=TOMATO, parent=frame, segs=16)

# ---- Lever box: a standalone toy box beside the loom (right-hand layout) ----
# Cream-painted body with a tomato band and bun feet, a beech top plate with
# four slots; each slot has two chevrons (push this way) and an end dot.
CREAM = mat_paint('PaintCream', 0xfff0dc, rough=0.4, clearcoat=0.4)
x_first, sp, n = LV['firstX'], LV['spacing'], DIMS['LEVERS']
bx0, bx1 = x_first - 0.019, x_first + sp * (n - 1) + 0.019
bz0, bz1 = LV['restZ'] - LV['travel'] - 0.02, LV['restZ'] + 0.02
BW, BD, BX, BZ = bx1 - bx0, bz1 - bz0, (bx0 + bx1) / 2, (bz0 + bz1) / 2
TOP = 0.029
# one wooden block (same lacquered wood as the loom), dark slot grooves
plate = rounded_box('LeverBase', (BW, TOP, BD), (BX, TOP / 2, BZ), bevel=0.008, segs=4, mat=WALNUT, parent=frame)
for k in range(n):
    cut = rounded_box(f'Slot{k}', (0.0082, 0.03, LV['travel'] + 0.013), (x_first + k * sp, TOP, LV['restZ'] - LV['travel'] / 2),
                      bevel=0.0025, segs=2)
    mod = plate.modifiers.new('slot', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    apply_mods(plate)
    bpy.data.objects.remove(cut, do_unlink=True)
for k in range(n):
    rounded_box(f'SlotFloor{k}', (0.0078, 0.002, LV['travel'] + 0.012), (x_first + k * sp, TOP - 0.0062, LV['restZ'] - LV['travel'] / 2),
                bevel=0.0008, segs=1, mat=SLOT, parent=frame)

# Wooden plugs that fill unused lever slots (shown per level in code).
for k in range(n):
    rounded_box(f'LeverSlotPlug{k}', (0.0078, 0.004, LV['travel'] + 0.011), (x_first + k * sp, TOP - 0.0015, LV['restZ'] - LV['travel'] / 2),
                bevel=0.0012, segs=2, mat=WALNUT, parent=frame)

# The undo bobbin rests in a solid walnut cradle beside the left rail (it
# slides back along the cradle when pulled). Mirrored with the crank side in code.
BX0 = -B['x']
# a short chunky saddle centred under the spool at rest
rounded_box('BobbinRodCradle', (0.03, 0.012, 0.032), (BX0, 0.006, B['z']), bevel=0.004, segs=3, mat=WALNUT, parent=frame)

# ---- Easel: a music stand behind the heddle that holds the pattern card ----
EZ, EY = C['z'], C['baseY']
rounded_box('EaselStretcher', (HW * 2, 0.018, 0.016), (0, RY, EZ), bevel=0.006, segs=3, mat=WOOD, parent=frame)
for s in (-1, 1):
    lathe(f'EaselPost{"L" if s < 0 else "R"}', [(0, 0), (0.005, 0), (0.005, EY - RY), (0, EY - RY)],
          (s * 0.078, RY, EZ), segs=16, mat=WALNUT, parent=frame)
rounded_box('EaselLedge', (0.212, 0.009, 0.022), (0, EY - 0.0035, EZ - 0.002), bevel=0.003, segs=3, mat=WALNUT, parent=frame)
rounded_box('EaselLip', (0.212, 0.009, 0.005), (0, EY + 0.002, EZ + 0.0075), bevel=0.0022, segs=3, mat=WALNUT, parent=frame)
# Two little clothes pegs clip the card to the ledge.
for s in (-1, 1):
    for side, dz in (('F', 0.0028), ('B', -0.0028)):
        rounded_box(f'Peg{"L" if s < 0 else "R"}{side}', (0.007, 0.026, 0.0034), (s * 0.048, EY + 0.008, EZ + 0.0062 + dz),
                    bevel=0.0014, segs=2, mat=MUSTARD, parent=frame)
    lathe(f'PegSpring{"L" if s < 0 else "R"}', [(0, -0.0045), (0.0019, -0.0045), (0.0019, 0.0045), (0, 0.0045)],
          (s * 0.048, EY + 0.006, EZ + 0.0062), axis='Z', segs=10, mat=DARK, parent=frame)

# ---- Plush shelf: a yellow bench with tomato feet, origin on the desk ----
shelf = empty('Shelf', at=(0, 0, 0))
SW, SD, SY = 0.245, 0.056, 0.03
rounded_box('ShelfTop', (SW, 0.012, SD), (0, SY, 0), bevel=0.0055, segs=4, mat=WALNUT, parent=shelf)
rounded_box('ShelfLip', (SW - 0.006, 0.01, 0.006), (0, SY + 0.007, SD / 2 - 0.003), bevel=0.0025, segs=3, mat=WALNUT, parent=shelf)
for s_ in (-1, 1):
    lathe(f'ShelfLeg{"L" if s_ < 0 else "R"}', [(0, 0), (0.0105, 0), (0.0095, SY - 0.006), (0, SY - 0.006)],
          (s_ * (SW / 2 - 0.024), 0, 0), segs=24, mat=WALNUT, parent=shelf)

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
lathe('Stem', [(0, 0.0), (0.0048, 0.0), (0.0045, KY - r * 0.55), (0, KY - r * 0.55)], (0, 0, 0), segs=18, mat=CREAM, parent=knob)
head = [(0, -r)] + [(r * math.sin(a), -r * math.cos(a)) for a in [i * math.pi / 18 for i in range(1, 18)]] + [(0, r)]
cap = lathe('Cap0', head, (0, KY, 0), segs=36, mat=KNOB, parent=knob)
cap.scale = (1.0, 1.0, 0.95)  # a round lollipop handle on its stem: reads as 'grab me'

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
