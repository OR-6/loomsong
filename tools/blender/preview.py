"""Render an exported GLB from 4 views (clay or material) for review.
Usage: Blender -b -P tools/blender/preview.py -- <in.glb> <out_prefix> [clay|material] [object-name-filter]"""
import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, mode = argv[0], argv[1], (argv[2] if len(argv) > 2 else 'material')
only = argv[3] if len(argv) > 3 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if only:
    keep = set()
    for o in bpy.context.scene.objects:
        if o.name.startswith(only):
            keep.add(o)
            keep.update(o.children_recursive)
    for o in objs:
        if o not in keep:
            o.hide_render = True
    objs = [o for o in objs if o in keep]
if mode == 'clay':
    clay = bpy.data.materials.new('Clay')
    clay.use_nodes = True
    clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.75, 0.73, 0.70, 1)
    clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.7
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(clay)

pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center, radius = (lo + hi) / 2, (hi - lo).length / 2

s = bpy.context.scene
s.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
s.render.resolution_x, s.render.resolution_y = 640, 480
s.world = bpy.data.worlds.new('w')
s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.92, 0.9, 0.86, 1)
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))
key.data.energy = 3.5
key.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
s.collection.objects.link(key)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
s.collection.objects.link(cam)
s.camera = cam
cam.data.lens = 50
views = {  # blender: -Y is the player side (game +Z)
    'front': Vector((0, -1, 0.35)), 'side': Vector((1, 0, 0.25)),
    'top': Vector((0.001, -0.001, 1)), 'quarter': Vector((0.8, -1, 0.75)),
}
for name, d in views.items():
    d = d.normalized()
    cam.location = center + d * radius * 3.4
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = f'{out}-{name}.png'
    bpy.ops.render.render(write_still=True)
print('PREVIEW DONE')
