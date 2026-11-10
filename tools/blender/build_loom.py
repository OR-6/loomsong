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

# ---- Lever box: a standalone toy box beside the loom (right-hand layout) ----
# Cream-painted body with a tomato band and bun feet, a beech top plate with
# four slots; each slot has two chevrons (push this way) and an end dot.
CREAM = mat_paint('PaintCream', 0xfff0dc, rough=0.4, clearcoat=0.4)
x_first, sp, n = LV['firstX'], LV['spacing'], DIMS['LEVERS']
bx0, bx1 = x_first - 0.019, x_first + sp * (n - 1) + 0.019
bz0, bz1 = LV['restZ'] - LV['travel'] - 0.02, LV['restZ'] + 0.02
BW, BD, BX, BZ = bx1 - bx0, bz1 - bz0, (bx0 + bx1) / 2, (bz0 + bz1) / 2
TOP = 0.029
rounded_box('LeverBase', (BW, 0.022, BD), (BX, 0.004 + 0.011, BZ), bevel=0.007, segs=4, mat=CREAM, parent=frame)
rounded_box('LeverBand', (BW + 0.0012, 0.0045, BD + 0.0012), (BX, 0.0105, BZ), bevel=0.002, segs=2, mat=TOMATO, parent=frame)
for fx in (bx0 + 0.014, bx1 - 0.014):
    for fz in (bz0 + 0.013, bz1 - 0.013):
        ellipsoid('LeverFoot', (0.0075, 0.0042, 0.0075), (fx, 0.0035, fz), mat=TOMATO, parent=frame, segs=16)
plate = rounded_box('LeverTop', (BW - 0.003, 0.0065, BD - 0.003), (BX, TOP - 0.00325, BZ), bevel=0.003, segs=3, mat=WOOD, parent=frame)
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
                bevel=0.0008, segs=1, mat=DARK, parent=frame)
    # two painted chevrons beside the slot, pointing the way to push
    for j, zf in enumerate((0.3, 0.68)):
        zc = LV['restZ'] - LV['travel'] * zf
        ch = lathe(f'SlotArrow{k}_{j}', [(0, 0), (0.0046, 0), (0.0046, 0.0011), (0, 0.0011)],
                   (x_first + k * sp + 0.0108, TOP, zc), segs=3, mat=KNOB, parent=frame)
        ch.scale = (0.75, 1.0, 1.0)
        ch.rotation_euler = (0, 0, math.radians(90))  # one point toward -Z (away from the player)
    # painted dot at the far (latched) end of each slot: "push it here"; recoloured per lever in code
    ellipsoid(f'SlotDot{k}', (0.0045, 0.0012, 0.0045), (x_first + k * sp, TOP, LV['restZ'] - LV['travel'] - 0.0125),
              mat=KNOB, parent=frame, segs=16)

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

# ---- Yarn basket (chapter picker): a low oval wicker bowl, origin on the desk ----
WICKER = mat_paint('Wicker', 0xc9965a, rough=0.85, clearcoat=0.05)
basket = empty('Basket', at=(0, 0, 0))
prof = [(0.0, 0.002), (0.028, 0.002)]
# ribbed outer wall: alternating radii read as woven wicker rows
for j in range(9):
    h = 0.003 + j * 0.0028
    rr = 0.031 + j * 0.0011 + (0.0009 if j % 2 else -0.0004)
    prof.append((rr, h))
prof += [(0.0418, 0.0285), (0.0405, 0.031), (0.0385, 0.0285), (0.034, 0.008), (0.0, 0.006)]
bowl = lathe('BasketBowl', prof, (0, 0, 0), segs=40, mat=WICKER, parent=basket)
bowl.scale = (1.45, 1, 1)  # oval (game x is blender x)
rim = lathe('BasketRim', [(0.0385, 0.0275), (0.0425, 0.0275), (0.0435, 0.0305), (0.0405, 0.0325), (0.0385, 0.0305)],
            (0, 0, 0), segs=40, mat=DARK, parent=basket)
rim.scale = (1.45, 1, 1)
# Upright wicker stakes around the wall: the woven look (rows + stakes).
STAKE = mat_paint('WickerStake', 0xa8743f, rough=0.85, clearcoat=0.05)
for j in range(22):
    th = j / 22 * math.tau
    for h0, h1, r0, r1 in ((0.003, 0.0285, 0.0312, 0.0412),):
        x0, z0 = math.cos(th) * (r0 + 0.0009) * 1.45, math.sin(th) * (r0 + 0.0009)
        x1, z1 = math.cos(th) * (r1 + 0.0009) * 1.45, math.sin(th) * (r1 + 0.0009)
        st = lathe(f'Stake{j}', [(0, 0), (0.0014, 0), (0.0014, 1), (0, 1)], (0, 0, 0), segs=6, mat=STAKE, parent=basket)
        # unit stake along +Y → stretch and tilt it to span (x0,h0,z0)→(x1,h1,z1)
        dx, dy, dz = x1 - x0, h1 - h0, z1 - z0
        L_ = math.sqrt(dx * dx + dy * dy + dz * dz)
        st.scale = (1, 1, L_)
        from mathutils import Vector as _V
        d = G(dx, dy, dz).normalized()
        st.rotation_mode = 'QUATERNION'
        st.rotation_quaternion = _V((0, 0, 1)).rotation_difference(d)
        st.location = G(x0, h0, z0)

# ---- Lever knob prototype (cloned ×4 in code) ----
# Each lever has its own cap SHAPE as well as colour (colour-blind friendly):
# Cap0 round, Cap1 square, Cap2 triangle, Cap3 ring. Code shows one per lever
# and recolours it; the knots on the threads use the same shapes.
knob = empty('LeverKnob', at=(0, 0, 0))
r = LV['knobRadius']
KY = LV['knobY']
lathe('Stem', [(0, 0.0), (0.0042, 0.0), (0.0036, KY - r * 0.5), (0, KY - r * 0.5)],
      (0, 0, 0), segs=14, mat=DARK, parent=knob)
lathe('StemWrap', [(0, 0.0), (0.0052, 0.0), (0.0058, 0.0015), (0.0058, 0.0075), (0.0052, 0.009), (0, 0.009)],
      (0, 0.016, 0), segs=20, mat=KNOB, parent=knob)

def soft(o, levels=2):
    m = o.modifiers.new('sub', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    apply_mods(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    return o

# Cap0: a friendly squashed ball
cap_prof = [(0, -r)] + [(r * math.sin(a), -r * math.cos(a)) for a in [i * math.pi / 16 for i in range(1, 16)]] + [(0, r)]
c0 = lathe('Cap0', cap_prof, (0, KY, 0), segs=32, mat=KNOB, parent=knob)
c0.scale = (1.06, 1.06, 0.82)
# Cap1/Cap2: a soft square and a soft triangle (few-sided lathes, subdivided)
blk = [(0, -r * 0.8), (r * 1.05, -r * 0.8), (r * 1.15, -r * 0.2), (r * 1.15, r * 0.25), (r * 1.0, r * 0.75), (0, r * 0.8)]
c1 = soft(lathe('Cap1', blk, (0, KY, 0), segs=4, mat=KNOB, parent=knob))
c1.rotation_euler = (0, 0, math.radians(45))
tri = [(0, -r * 0.8), (r * 1.15, -r * 0.8), (r * 1.28, -r * 0.2), (r * 1.28, r * 0.25), (r * 1.1, r * 0.75), (0, r * 0.8)]
c2 = soft(lathe('Cap2', tri, (0, KY, 0), segs=3, mat=KNOB, parent=knob))
c2.rotation_euler = (0, 0, math.radians(90))  # one point toward the player
# Cap3: a ring (a fat donut lying flat)
bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.78, minor_radius=r * 0.42, major_segments=32, minor_segments=14, location=G(0, KY, 0))
c3 = bpy.context.active_object
c3.name = 'Cap3'
bpy.ops.object.shade_smooth()
finish(c3, KNOB, knob)

# ---- Bobbin (undo spool): beech flanges, wound knit yarn ----
bob = empty('Bobbin', at=(0, 0, 0))
br = B['radius']
lathe('Spool', [(0, -0.012), (br * 1.25, -0.012), (br * 1.32, -0.010), (br * 0.55, -0.008), (br * 0.55, 0.008),
                (br * 1.32, 0.010), (br * 1.25, 0.012), (0, 0.012)], (0, 0, 0), axis='X', segs=28, mat=WOOD, parent=bob)
lathe('Wound', [(0, -0.0078), (br * 1.05, -0.0078), (br * 1.14, -0.004), (br * 1.14, 0.004), (br * 1.05, 0.0078), (0, 0.0078)],
      (0, 0, 0), axis='X', segs=28, mat=YARN, parent=bob)

for o in [*root.children_recursive, *knob.children_recursive, *bob.children_recursive, *shelf.children_recursive, *basket.children_recursive]:
    if o.type == 'MESH' and len(o.data.uv_layers) == 0:
        uv_project(o, 0.09)

out = os.path.join(HERE, '..', '..', 'public', 'models', 'loom.glb')
bpy.ops.object.select_all(action='DESELECT')
for o in [root, *root.children_recursive, knob, *knob.children_recursive, bob, *bob.children_recursive, shelf, *shelf.children_recursive, basket, *basket.children_recursive]:
    o.select_set(True)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_image_format='WEBP')
print('EXPORTED', os.path.abspath(out))
