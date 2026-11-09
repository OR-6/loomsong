"""Build public/models/loom.glb: the toy loom frame + lever knob + bobbin.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/build_loom.py
Named nodes: Loom/Frame/*, LeverKnob (Cap material 'KnobPaint' is recoloured
per lever in code), Bobbin. Origin = loom-local desk contact (game coords)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *

reset()
L, LV, B, C = DIMS['LOOM'], DIMS['LEVER'], DIMS['BOBBIN'], DIMS['CARD']
wood_img = wood_image()
yarn_img = yarn_image()
WOOD = mat_tex('Beech', wood_img, rough=0.55, clearcoat=0.15)
DARK = mat_paint('Walnut', (0.22, 0.13, 0.08), rough=0.5, clearcoat=0.1)
KNOB = mat_paint('KnobPaint', (0.89, 0.34, 0.23))
YARN = mat_tex('Yarn', yarn_img, rough=0.95)

root = empty('Loom')
frame = empty('Frame', parent=root)

HW = L['frameHalfWidth'] + 0.014          # rail centre x
Z0, Z1 = L['backBeamZ'] - 0.012, L['frontBeamZ'] + 0.014
ZM, ZL = (Z0 + Z1) / 2, (Z1 - Z0)

parts = []
for s, n in ((-1, 'RailL'), (1, 'RailR')):
    parts.append(rounded_box(n, (0.022, 0.02, ZL), (s * HW, 0.015, ZM), bevel=0.006, mat=WOOD, parent=frame))
    for zf, fn in ((Z0 + 0.012, 'Back'), (Z1 - 0.012, 'Front')):
        # turned foot: lifts the loom ~5 mm off the desk
        parts.append(lathe(f'Foot{n[-1]}{fn}', [(0.0, 0.0), (0.0105, 0.0), (0.012, 0.0025), (0.0105, 0.006), (0.008, 0.0065)],
                           (s * HW, 0.0, zf), mat=DARK, parent=frame))

def roller(name, y, z, r, knob_r, crank=False):
    half = HW + 0.012
    prof = [(0.0, -half - 0.006), (knob_r * 0.7, -half - 0.006), (knob_r, -half - 0.002), (knob_r, -half + 0.004),
            (r, -half + 0.006), (r, half - 0.006), (knob_r, half - 0.004), (knob_r, half + 0.002),
            (knob_r * 0.7, half + 0.006), (0.0, half + 0.006)]
    o = lathe(name, prof, (0, y, z), axis='X', segs=28, mat=WOOD, parent=frame)
    if crank:
        lathe(name + 'Crank', [(0, 0), (0.0035, 0), (0.0035, 0.016), (0.006, 0.019), (0.0055, 0.024), (0, 0.025)],
              (half + 0.006, y + 0.002, z), axis='X', segs=16, mat=DARK, parent=frame)
    return o

parts.append(roller('BackBeam', L['beamY'] + 0.004, L['backBeamZ'], 0.011, 0.0145))
parts.append(roller('FrontBeam', L['beamY'], L['frontBeamZ'], 0.012, 0.0155, crank=True))

# Uprights + heddle bar (the "castle" that holds the heddle)
PH = 0.074
for s, n in ((-1, 'PostL'), (1, 'PostR')):
    parts.append(rounded_box(n, (0.018, PH, 0.018), (s * HW, PH / 2 + 0.008, L['heddleZ']), bevel=0.006, mat=WOOD, parent=frame))
    lathe(n + 'Finial', [(0, 0), (0.0092, 0), (0.0102, 0.005), (0.0068, 0.0105), (0, 0.0125)],
          (s * HW, PH + 0.008, L['heddleZ']), segs=20, mat=DARK, parent=frame)
parts.append(rounded_box('HeddleBar', (HW * 2 + 0.01, 0.013, 0.014), (0, PH - 0.004, L['heddleZ']), bevel=0.0045, mat=WOOD, parent=frame))

# Dowel pegs at the joints (contrasting walnut): tells you it's made of wood.
for s in (-1, 1):
    for (y, z) in ((0.015, Z0 + 0.03), (0.015, Z1 - 0.03), (PH - 0.004, L['heddleZ'])):
        # lathe runs along +X; on the left start further out so the dome faces in
        x0 = HW + 0.011 if s > 0 else -(HW + 0.011 + 0.0042)
        lathe('Peg', [(0, 0), (0.0042, 0), (0.0042, 0.0034), (0, 0.0042)], (x0, y, z), axis='X', segs=12, mat=DARK, parent=frame)

# ---------- Lever block: a carved block with four slots (right-hand layout) ----------
x_first, sp, n = LV['firstX'], LV['spacing'], DIMS['LEVERS']
bx0, bx1 = x_first - 0.016, x_first + sp * (n - 1) + 0.016
bz0, bz1 = LV['restZ'] - LV['travel'] - 0.017, LV['restZ'] + 0.017
block = rounded_box('LeverBlock', (bx1 - bx0, 0.014, bz1 - bz0), ((bx0 + bx1) / 2, 0.007, (bz0 + bz1) / 2),
                    bevel=0.0055, mat=WOOD, parent=frame)
for k in range(n):
    cut = rounded_box(f'Slot{k}', (0.0065, 0.03, LV['travel'] + 0.012), (x_first + k * sp, 0.012, LV['restZ'] - LV['travel'] / 2),
                      bevel=0.002, segs=2)
    mod = block.modifiers.new('slot', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    apply_mods(block)
    bpy.data.objects.remove(cut, do_unlink=True)
# a darker inlay at the bottom of each slot reads as depth
for k in range(n):
    rounded_box(f'SlotFloor{k}', (0.0062, 0.002, LV['travel'] + 0.011), (x_first + k * sp, 0.0055, LV['restZ'] - LV['travel'] / 2),
                bevel=0.0008, segs=1, mat=DARK, parent=frame)

# ---------- Card stand: slotted base at the back corner opposite the bank ----------
rounded_box('CardStand', (0.11, 0.008, 0.022), (-C['x'], 0.004, C['z']), bevel=0.003, mat=WOOD, parent=frame)
rounded_box('CardSlot', (0.104, 0.002, 0.004), (-C['x'], 0.0085, C['z']), bevel=0.0008, segs=1, mat=DARK, parent=frame)

# ---------- Lever knob prototype (cloned ×4 in code; cap recoloured) ----------
knob = empty('LeverKnob', at=(0, 0, 0))
r = LV['knobRadius']
lathe('Stem', [(0, 0.0), (0.003, 0.0), (0.003, LV['knobY'] - r * 0.6), (0, LV['knobY'] - r * 0.6)],
      (0, 0, 0), segs=12, mat=DARK, parent=knob)
cap_prof = [(0, -r)] + [(r * math.sin(a), -r * math.cos(a)) for a in [i * math.pi / 14 for i in range(1, 14)]] + [(0, r)]
cap = lathe('Cap', cap_prof, (0, LV['knobY'], 0), segs=28, mat=KNOB, parent=knob)
cap.scale = (1, 1, 0.82)  # slightly squashed ball: friendlier, easier to see from above

# ---------- Bobbin (undo spool): turned wood flanges, wound yarn ----------
bob = empty('Bobbin', at=(0, 0, 0))
br = B['radius']
lathe('Spool', [(0, -0.012), (br * 1.25, -0.012), (br * 1.3, -0.010), (br * 0.55, -0.008), (br * 0.55, 0.008),
                (br * 1.3, 0.010), (br * 1.25, 0.012), (0, 0.012)], (0, 0, 0), axis='X', segs=24, mat=WOOD, parent=bob)
lathe('Wound', [(0, -0.0078), (br * 1.05, -0.0078), (br * 1.12, -0.004), (br * 1.12, 0.004), (br * 1.05, 0.0078), (0, 0.0078)],
      (0, 0, 0), axis='X', segs=24, mat=YARN, parent=bob)

for o in [*root.children_recursive]:
    if o.type == 'MESH' and o.data.uv_layers.__len__() == 0:
        uv_project(o, 0.05)
for o in [*knob.children_recursive, *bob.children_recursive]:
    if o.type == 'MESH' and len(o.data.uv_layers) == 0:
        uv_project(o, 0.05)

out = os.path.join(HERE, '..', '..', 'public', 'models', 'loom.glb')
bpy.ops.object.select_all(action='DESELECT')
for o in [root, *root.children_recursive, knob, *knob.children_recursive, bob, *bob.children_recursive]:
    o.select_set(True)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_image_format='WEBP')
tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == 'MESH' and not o.data.calc_loop_triangles())
print('EXPORTED', os.path.abspath(out))
