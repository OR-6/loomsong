"""Build public/models/pip.glb: Pip, the shuttle songbird (mascot).
A plump canary: big round head, tiny beak, big shiny eyes. Lies along game +X
(head at +X), centred on its origin at shuttle height 0.
Named nodes for animation: Pip/Body, Head, Belly, Beak, EyeL, EyeR, WingL, WingR, Tail."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *

reset()
YEL = mat_paint('PipBody', 0xffcf3a, rough=0.42, clearcoat=0.4)
WING = mat_paint('PipWing', 0xf5a623, rough=0.45, clearcoat=0.35)
CREAM = mat_paint('PipBelly', 0xfff3d6, rough=0.55, clearcoat=0.2)
BEAK = mat_paint('PipBeak', 0xf06a2a, rough=0.4, clearcoat=0.4)
TAIL = mat_paint('PipTail', 0x2a9d8f, rough=0.45, clearcoat=0.35)
INK = mat_paint('PipEye', 0x1a1412, rough=0.12, clearcoat=0.9)
SHINE = mat_paint('PipShine', 0xffffff, rough=0.2, clearcoat=0.5)
BLUSH = mat_paint('PipBlush', 0xff8f87, rough=0.6, clearcoat=0.0)

pip = empty('Pip')
# Round body + a big head that overlaps it (chibi proportions, head ≈ body).
body = ellipsoid('Body', (0.0215, 0.0135, 0.0135), (-0.006, -0.001, 0), mat=YEL, parent=pip, segs=32)
head = ellipsoid('Head', (0.0128, 0.0125, 0.0125), (0.017, 0.0055, 0), mat=YEL, parent=pip, segs=32)
ellipsoid('Belly', (0.016, 0.0085, 0.0105), (-0.002, -0.0055, 0), mat=CREAM, parent=pip, segs=24)
lathe('Beak', [(0, 0), (0.0034, 0), (0.0024, 0.0035), (0, 0.0058)], (0.0285, 0.0045, 0), axis='X', segs=16, mat=BEAK, parent=pip)
for s, n in ((1, 'L'), (-1, 'R')):
    eye = ellipsoid('Eye' + n, (0.0034, 0.0044, 0.0024), (0.0232, 0.0085, s * 0.0078), mat=INK, parent=pip, segs=20)
    ellipsoid('Shine' + n, (0.0012, 0.0012, 0.0008), (0.0246, 0.0102, s * 0.0094), mat=SHINE, parent=eye, segs=10)
    ellipsoid('Cheek' + n, (0.0030, 0.0020, 0.0012), (0.0228, 0.0018, s * 0.0102), mat=BLUSH, parent=pip, segs=12)
    ellipsoid('Wing' + n, (0.0135, 0.0042, 0.0062), (-0.008, 0.002, s * 0.0128), rot=(s * 22, 0, -12), mat=WING, parent=pip)
# A perky two-feather tail tipped up.
for i, dz in enumerate((-0.0028, 0.0028)):
    ellipsoid(f'Tail{"" if i == 0 else "2"}', (0.0085, 0.0018, 0.0042), (-0.029, 0.006, dz), rot=(0, (-12 if dz < 0 else 12), -32), mat=TAIL, parent=pip)
# Crest tuft: three tiny feathers on top of the head.
for i, (dx, rz) in enumerate(((-0.003, 25), (0.0005, 5), (0.0035, -18))):
    ellipsoid(f'Tuft{i}', (0.0014, 0.0042, 0.0012), (0.016 + dx, 0.0185, 0), rot=(0, 0, rz), mat=WING, parent=pip, segs=10)

# The boat shuttle Pip rides: a pointed beech boat (the thing you grab and
# slide) with a bobbin of weft yarn in its hollow. Boat centre is 20 mm below Pip.
BOATW = mat_paint('BoatWood', 0xe0b07a, rough=0.45, clearcoat=0.35)
TIPS = mat_paint('BoatTips', 0x7a4e32, rough=0.4, clearcoat=0.4)
YARN = mat_paint('BoatYarn', 0xfff6e8, rough=0.95, clearcoat=0.0)
BY = -0.02
prof = [(0.0, -0.046), (0.0025, -0.042), (0.0065, -0.032), (0.0092, -0.018), (0.0102, 0.0), (0.0092, 0.018), (0.0065, 0.032), (0.0025, 0.042), (0.0, 0.046)]
boat = lathe('Boat', prof, (0, BY, 0), axis='X', segs=28, mat=BOATW, parent=pip)
boat.scale = (1.0, 1.0, 0.62)  # flatter than round (blender Z = game up), like a real boat shuttle
# bobbin of weft yarn showing in the boat's hollow (recoloured to the weft in code)
lathe('BoatYarn', [(0, -0.017), (0.0052, -0.017), (0.0058, -0.012), (0.0058, 0.012), (0.0052, 0.017), (0, 0.017)],
      (0, BY + 0.0035, 0), axis='X', segs=20, mat=YARN, parent=pip)

for o in pip.children_recursive:
    if o.type == 'MESH' and len(o.data.uv_layers) == 0:
        uv_project(o, 0.05)
out = os.path.abspath(os.path.join(HERE, '..', '..', 'public', 'models', 'pip.glb'))
bpy.ops.object.select_all(action='DESELECT')
for o in [pip, *pip.children_recursive]:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
print('EXPORTED', out)
