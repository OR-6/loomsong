"""Build public/models/pip.glb: Pip, the shuttle songbird (mascot).
Lies along game +X (head at +X), centred on its origin at shuttle height 0.
Named nodes for animation: Pip/Body, Belly, Beak, EyeL, EyeR, WingL, WingR, Tail."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *

reset()
NAVY = mat_paint('PipBody', (0.24, 0.35, 0.50), rough=0.4, clearcoat=0.35)
WING = mat_paint('PipWing', (0.33, 0.48, 0.64), rough=0.45, clearcoat=0.3)
CREAM = mat_paint('PipBelly', (0.99, 0.93, 0.82), rough=0.55, clearcoat=0.2)
BEAK = mat_paint('PipBeak', (0.95, 0.66, 0.16), rough=0.4, clearcoat=0.3)
TAIL = mat_paint('PipTail', (0.89, 0.34, 0.23), rough=0.45, clearcoat=0.3)
INK = mat_paint('PipEye', (0.06, 0.05, 0.05), rough=0.15, clearcoat=0.8)
SHINE = mat_paint('PipShine', (1, 1, 1), rough=0.2, clearcoat=0.5)
BLUSH = mat_paint('PipBlush', (0.96, 0.55, 0.52), rough=0.6, clearcoat=0.0)

pip = empty('Pip')
# Boat-shaped body: tapered tail, full middle, round head.
prof = [(0, -0.035), (0.0025, -0.034), (0.0055, -0.029), (0.0085, -0.02), (0.0103, -0.009), (0.0108, 0.0),
        (0.0104, 0.009), (0.0096, 0.017), (0.0099, 0.024), (0.0093, 0.030), (0.0068, 0.0355), (0.0025, 0.0385), (0, 0.039)]
body = lathe('Body', prof, (0, 0, 0), axis='X', segs=32, mat=NAVY, parent=pip)
body.scale = (1, 1, 0.86)  # a touch flatter than round
ellipsoid('Belly', (0.026, 0.0045, 0.0078), (0.002, -0.0062, 0), mat=CREAM, parent=pip)
lathe('Beak', [(0, 0), (0.0034, 0), (0.0026, 0.004), (0.0008, 0.0085), (0, 0.0092)], (0.0375, 0.0005, 0), axis='X', segs=16, mat=BEAK, parent=pip)
for s, n in ((1, 'L'), (-1, 'R')):
    eye = ellipsoid('Eye' + n, (0.0031, 0.0038, 0.0022), (0.0272, 0.0036, s * 0.0071), mat=INK, parent=pip, segs=18)
    ellipsoid('Shine' + n, (0.0011, 0.0011, 0.0007), (0.0286, 0.0052, s * 0.0089), mat=SHINE, parent=eye, segs=10)
    ellipsoid('Cheek' + n, (0.0028, 0.0018, 0.0010), (0.0300, -0.0012, s * 0.0084), mat=BLUSH, parent=pip, segs=12)
    ellipsoid('Wing' + n, (0.0165, 0.0032, 0.0072), (-0.002, 0.0035, s * 0.0093), rot=(s * 18, 0, -8), mat=WING, parent=pip)
tail = ellipsoid('Tail', (0.0075, 0.0018, 0.0062), (-0.0355, 0.0028, 0), rot=(0, 0, -14), mat=TAIL, parent=pip)

for o in pip.children_recursive:
    if o.type == 'MESH' and len(o.data.uv_layers) == 0:
        uv_project(o, 0.05)
out = os.path.abspath(os.path.join(HERE, '..', '..', 'public', 'models', 'pip.glb'))
bpy.ops.object.select_all(action='DESELECT')
for o in [pip, *pip.children_recursive]:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
print('EXPORTED', out)
