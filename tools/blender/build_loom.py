"""Build public/models/loom.glb: the toy loom frame + lever knob + bobbin.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/build_loom.py
Style: a chunky painted wooden toy (Hape/Grimm's-like). Natural beech for the
structure, saturated paint only on round accents (feet, finials, roller ends,
pegs), so the coloured lever knobs and yarn stay the loudest things.
Named nodes: Loom/Frame/*, LeverKnob (Cap material 'KnobPaint' is recoloured
per lever in code), Bobbin. Origin = loom-local desk contact (game coords)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *

reset()
L, LV, B, C = DIMS['LOOM'], DIMS['LEVER'], DIMS['BOBBIN'], DIMS['CARD']
SRC = os.path.join(HERE, '..', '..', 'assets-src', 'ambientcg')
wood_img = load_image(os.path.join(SRC, 'Wood095_1K-JPG', 'Wood095_beech_quiet.png'), 1024)  # quiet straight beech: low contrast, toy lacquer
knit_img = load_image(os.path.join(SRC, 'Fabric019_1K-JPG', 'Fabric019_rgb256.png'), 256)
WOOD = mat_tex('Beech', wood_img, tint=0xfff4e6, rough=0.55, clearcoat=0.08)
DARK = mat_paint('Walnut', 0x7a4e32, rough=0.45, clearcoat=0.2)
TOMATO = mat_paint('PaintTomato', 0xe2563b, rough=0.38, clearcoat=0.45)
MUSTARD = mat_paint('PaintMustard', 0xf2b632, rough=0.38, clearcoat=0.45)
TEAL = mat_paint('PaintTeal', 0x2a9d8f, rough=0.38, clearcoat=0.45)
KNOB = mat_paint('KnobPaint', 0xe2563b, rough=0.35, clearcoat=0.5)
YARN = mat_tex('Yarn', knit_img, tint=0xffffff, rough=0.95)
CLOTH = mat_tex('ClothRoll', knit_img, tint=0xfff3e0, rough=0.95)
YARN_L = mat_tex('SpoolYarnTomato', knit_img, tint=0xe2563b, rough=0.95)
YARN_R = mat_tex('SpoolYarnTeal', knit_img, tint=0x2a9d8f, rough=0.95)

root = empty('Loom')
frame = empty('Frame', parent=root)

HW = L['frameHalfWidth'] + 0.008          # rail centre x (kept clear of lever slot 0)
Z0, Z1 = L['backBeamZ'] - 0.04, L['frontBeamZ'] + 0.016
ZM, ZL = (Z0 + Z1) / 2, (Z1 - Z0)
RY = 0.02                                  # rail centre height

# ---- Rails: fat, very soft beech beams on bun feet ----
for s, n in ((-1, 'RailL'), (1, 'RailR')):
    rounded_box(n, (0.026, 0.028, ZL), (s * HW, RY, ZM), bevel=0.009, segs=4, mat=WOOD, parent=frame)
    for zf, fn in ((Z0 + 0.016, 'Back'), (Z1 - 0.016, 'Front')):
        lathe(f'Foot{n[-1]}{fn}', [(0.0, 0.0), (0.0135, 0.0), (0.0155, 0.003), (0.0145, 0.0065), (0.011, 0.0085), (0.0, 0.009)],
              (s * HW, 0.0, zf), segs=28, mat=TOMATO, parent=frame)

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

roller('BackBeam', L['beamY'] + 0.006, L['backBeamZ'], 0.0115, 0.0145, WOOD, TEAL)
roller('FrontBeam', L['beamY'] - 0.001, L['frontBeamZ'], 0.0095, 0.012, WOOD, TEAL, crank=True)
# Woven cloth wound onto the front beam: a thin wrap only as wide as the cloth.
lathe('ClothWrap', [(0.0, -0.098), (0.0108, -0.098), (0.0118, -0.094), (0.0118, 0.094), (0.0108, 0.098), (0.0, 0.098)],
      (0, L['beamY'] - 0.001, L['frontBeamZ']), axis='X', segs=32, mat=CLOTH, parent=frame)

# ---- Uprights + heddle bar, crowned with big painted ball finials ----
PH = 0.074
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

# ---- Lever block: a carved beech block with four slots (right-hand layout) ----
x_first, sp, n = LV['firstX'], LV['spacing'], DIMS['LEVERS']
bx0, bx1 = x_first - 0.017, x_first + sp * (n - 1) + 0.017
bz0, bz1 = LV['restZ'] - LV['travel'] - 0.018, LV['restZ'] + 0.018
block = rounded_box('LeverBlock', (bx1 - bx0, 0.02, bz1 - bz0), ((bx0 + bx1) / 2, 0.01, (bz0 + bz1) / 2),
                    bevel=0.008, segs=4, mat=WOOD, parent=frame)
for k in range(n):
    cut = rounded_box(f'Slot{k}', (0.0078, 0.03, LV['travel'] + 0.012), (x_first + k * sp, 0.0175, LV['restZ'] - LV['travel'] / 2),
                      bevel=0.0025, segs=2)
    mod = block.modifiers.new('slot', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    apply_mods(block)
    bpy.data.objects.remove(cut, do_unlink=True)
for k in range(n):
    rounded_box(f'SlotFloor{k}', (0.0074, 0.002, LV['travel'] + 0.011), (x_first + k * sp, 0.0035 + 0.0045, LV['restZ'] - LV['travel'] / 2),
                bevel=0.0008, segs=1, mat=DARK, parent=frame)
    # painted dot at the far (latched) end of each slot: "push it here"; recoloured per lever in code
    ellipsoid(f'SlotDot{k}', (0.0042, 0.0012, 0.0042), (x_first + k * sp, 0.0198, LV['restZ'] - LV['travel'] - 0.0115),
              mat=KNOB, parent=frame, segs=16)

# Two painted dowels pin the lever block to the side rail.
for z in (bz0 + 0.014, bz1 - 0.014):
    ellipsoid('BlockPeg', (0.0042, 0.0026, 0.0042), (bx0 + 0.009, 0.0205, z), mat=TOMATO, parent=frame, segs=14)

# ---- Easel: a music stand behind the heddle that holds the pattern card ----
EZ, EY = C['z'], C['baseY']
rounded_box('EaselStretcher', (HW * 2, 0.018, 0.016), (0, RY, EZ), bevel=0.006, segs=3, mat=WOOD, parent=frame)
for s in (-1, 1):
    lathe(f'EaselPost{"L" if s < 0 else "R"}', [(0, 0), (0.005, 0), (0.005, EY - RY), (0, EY - RY)],
          (s * 0.05, RY, EZ), segs=16, mat=WOOD, parent=frame)
rounded_box('EaselLedge', (0.15, 0.009, 0.022), (0, EY - 0.0035, EZ - 0.002), bevel=0.003, segs=3, mat=WOOD, parent=frame)
rounded_box('EaselLip', (0.15, 0.009, 0.005), (0, EY + 0.002, EZ + 0.0075), bevel=0.0022, segs=3, mat=TOMATO, parent=frame)
# Two little clothes pegs clip the card to the ledge.
for s in (-1, 1):
    for side, dz in (('F', 0.0028), ('B', -0.0028)):
        rounded_box(f'Peg{"L" if s < 0 else "R"}{side}', (0.007, 0.026, 0.0034), (s * 0.048, EY + 0.008, EZ + 0.0062 + dz),
                    bevel=0.0014, segs=2, mat=MUSTARD, parent=frame)
    lathe(f'PegSpring{"L" if s < 0 else "R"}', [(0, -0.0045), (0.0019, -0.0045), (0.0019, 0.0045), (0, 0.0045)],
          (s * 0.048, EY + 0.006, EZ + 0.0062), axis='Z', segs=10, mat=DARK, parent=frame)

# ---- Plush shelf: a low beech bench, origin on the desk at its centre ----
# (Plushes sit on felt cushions added in code.)
shelf = empty('Shelf', at=(0, 0, 0))
SW, SD, SY = 0.245, 0.056, 0.03
rounded_box('ShelfTop', (SW, 0.012, SD), (0, SY, 0), bevel=0.005, segs=3, mat=WOOD, parent=shelf)
rounded_box('ShelfLip', (SW - 0.004, 0.006, 0.006), (0, SY + 0.004, SD / 2 - 0.002), bevel=0.0025, segs=2, mat=TEAL, parent=shelf)
for s_ in (-1, 1):
    lathe(f'ShelfLeg{"L" if s_ < 0 else "R"}', [(0, 0), (0.011, 0), (0.0125, 0.003), (0.0085, 0.008), (0.0075, SY - 0.006), (0.0095, SY - 0.006), (0, SY - 0.006)],
          (s_ * (SW / 2 - 0.022), 0, 0), segs=24, mat=WOOD, parent=shelf)
    ellipsoid(f'ShelfFoot{"L" if s_ < 0 else "R"}', (0.0115, 0.004, 0.0115), (s_ * (SW / 2 - 0.022), 0.0025, 0), mat=TOMATO, parent=shelf, segs=20)

# ---- Lever knob prototype (cloned ×4 in code; cap recoloured) ----
knob = empty('LeverKnob', at=(0, 0, 0))
r = LV['knobRadius']
lathe('Stem', [(0, 0.0), (0.0038, 0.0), (0.0034, LV['knobY'] - r * 0.6), (0, LV['knobY'] - r * 0.6)],
      (0, 0, 0), segs=14, mat=DARK, parent=knob)
cap_prof = [(0, -r)] + [(r * math.sin(a), -r * math.cos(a)) for a in [i * math.pi / 16 for i in range(1, 16)]] + [(0, r)]
cap = lathe('Cap', cap_prof, (0, LV['knobY'], 0), segs=32, mat=KNOB, parent=knob)
# Yarn wound round the stem in the lever's colour (recoloured with the cap).
lathe('StemWrap', [(0, 0.0), (0.0046, 0.0), (0.0052, 0.0015), (0.0052, 0.0055), (0.0046, 0.007), (0, 0.007)],
      (0, 0.0055, 0), segs=20, mat=KNOB, parent=knob)
cap.scale = (1.06, 1.06, 0.8)  # mushroom-ish: friendly, readable from above

# ---- Bobbin (undo spool): beech flanges, wound knit yarn ----
bob = empty('Bobbin', at=(0, 0, 0))
br = B['radius']
lathe('Spool', [(0, -0.012), (br * 1.25, -0.012), (br * 1.32, -0.010), (br * 0.55, -0.008), (br * 0.55, 0.008),
                (br * 1.32, 0.010), (br * 1.25, 0.012), (0, 0.012)], (0, 0, 0), axis='X', segs=28, mat=WOOD, parent=bob)
lathe('Wound', [(0, -0.0078), (br * 1.05, -0.0078), (br * 1.14, -0.004), (br * 1.14, 0.004), (br * 1.05, 0.0078), (0, 0.0078)],
      (0, 0, 0), axis='X', segs=28, mat=YARN, parent=bob)

for o in [*root.children_recursive, *knob.children_recursive, *bob.children_recursive, *shelf.children_recursive]:
    if o.type == 'MESH' and len(o.data.uv_layers) == 0:
        uv_project(o, 0.09)

out = os.path.join(HERE, '..', '..', 'public', 'models', 'loom.glb')
bpy.ops.object.select_all(action='DESELECT')
for o in [root, *root.children_recursive, knob, *knob.children_recursive, bob, *bob.children_recursive, shelf, *shelf.children_recursive]:
    o.select_set(True)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_image_format='WEBP')
print('EXPORTED', os.path.abspath(out))
