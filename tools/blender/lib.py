"""Shared helpers for Loomsong's Blender asset scripts (run headless).

Coordinates: helpers take GAME coordinates (metres; Y up, +Z toward the
player, origin = loom-local desk contact). They are converted to Blender
(Z up) so the glTF exporter's Y-up conversion lands back on game axes.
"""
import bpy, bmesh, json, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
DIMS = json.load(open(os.path.join(HERE, 'dims.json')))


def G(x, y, z):
    """Game (Y-up, +Z to player) -> Blender (Z-up)."""
    return Vector((x, -z, y))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    return s


def smooth(obj, angle=40):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def rounded_box(name, size, at, bevel=0.003, segs=3, mat=None, parent=None):
    """Bevelled box; size/at in game coords (sx, sy, sz)."""
    sx, sy, sz = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=G(*at))
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sz, sy)  # blender axes: x, y(=-gameZ), z(=gameY)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = bevel
    m.segments = segs
    m.limit_method = 'ANGLE'
    apply_mods(o)
    smooth(o)
    return finish(o, mat, parent)


def lathe(name, profile, at, axis='Y', segs=32, mat=None, parent=None):
    """Turned part from a (radius, height) profile, revolved around the game axis."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, h)) for r, h in profile]
    for a, b in zip(verts, verts[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=math.tau, steps=segs, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    # Default lathe axis is blender Z (= game Y). Rotate for other game axes.
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Z':
        o.rotation_euler = (math.radians(90), 0, 0)
    o.location = G(*at)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(rotation=True)
    o.select_set(False)
    smooth(o, 60)
    return finish(o, mat, parent)


def finish(o, mat, parent):
    if mat is not None:
        o.data.materials.clear()
        o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def empty(name, at=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = G(*at)
    if parent is not None:
        o.parent = parent
    return o


# ---------- materials (glTF-exportable: Principled BSDF + image textures) ----------

def _cycles(samples=8):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = samples
    s.cycles.device = 'CPU'


def bake_texture(name, build_nodes, size=512):
    """Bake a procedural shader (built by build_nodes(nodes, links) -> colour
    socket) into a tileable image, via an emission bake on a unit UV plane."""
    _cycles()
    img = bpy.data.images.new(name, size, size, alpha=False)
    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.active_object
    mat = bpy.data.materials.new(name + '_bake')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    col = build_nodes(nt.nodes, nt.links)
    nt.links.new(col, emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    plane.data.materials.append(mat)
    bpy.context.view_layer.objects.active = plane
    plane.select_set(True)
    bpy.ops.object.bake(type='EMIT')
    bpy.data.objects.remove(plane, do_unlink=True)
    img.pack()
    return img


def wood_image():
    """Light beech grain: stretched noise + gentle rings, tileable-ish."""
    def nodes(n, l):
        coord = n.new('ShaderNodeTexCoord')
        mapping = n.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (1.5, 12.0, 1.0)
        l.new(coord.outputs['UV'], mapping.inputs['Vector'])
        noise = n.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 3.0
        noise.inputs['Detail'].default_value = 8.0
        l.new(mapping.outputs['Vector'], noise.inputs['Vector'])
        wave = n.new('ShaderNodeTexWave')
        wave.inputs['Scale'].default_value = 2.2
        wave.inputs['Distortion'].default_value = 6.0
        wave.inputs['Detail'].default_value = 3.0
        l.new(mapping.outputs['Vector'], wave.inputs['Vector'])
        mix = n.new('ShaderNodeMix')
        mix.data_type = 'FLOAT'
        mix.inputs['Factor'].default_value = 0.35
        l.new(noise.outputs['Fac'], mix.inputs['A'])
        l.new(wave.outputs['Fac'], mix.inputs['B'])
        ramp = n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (0.82, 0.65, 0.45, 1)  # beech light
        ramp.color_ramp.elements[1].color = (0.72, 0.53, 0.34, 1)  # soft grain
        ramp.color_ramp.elements[0].position = 0.38
        ramp.color_ramp.elements[1].position = 0.72
        l.new(mix.outputs['Result'], ramp.inputs['Fac'])
        return ramp.outputs['Color']
    return bake_texture('wood', nodes)


def yarn_image():
    """Wound yarn: fine diagonal strands, light (tinted by vertex colour/material)."""
    def nodes(n, l):
        coord = n.new('ShaderNodeTexCoord')
        wave = n.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = 'DIAGONAL'
        wave.inputs['Scale'].default_value = 28.0
        wave.inputs['Distortion'].default_value = 1.5
        l.new(coord.outputs['UV'], wave.inputs['Vector'])
        ramp = n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (0.72, 0.72, 0.72, 1)
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        l.new(wave.outputs['Fac'], ramp.inputs['Fac'])
        return ramp.outputs['Color']
    return bake_texture('yarn', nodes, 256)


def mat_tex(name, img, tint=(1, 1, 1, 1), rough=0.6, clearcoat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    mul.inputs['B'].default_value = (*lin(tint[:3]), 1) if not isinstance(tint, int) else (*lin(tint), 1)
    nt.links.new(tex.outputs['Color'], mul.inputs['A'])
    # glTF exports a texture × base-colour factor; keep the factor = tint.
    nt.links.new(mul.outputs['Result'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = clearcoat
    return m


def lin(c):
    """sRGB 0..1 (or 0xRRGGBB) → linear RGB tuple. Blender colours are linear."""
    if isinstance(c, int):
        c = ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(f(v) for v in c)


def load_image(path, size=512):
    """Load a texture file and downscale it for the web (exported as WEBP)."""
    img = bpy.data.images.load(os.path.abspath(path))
    if max(img.size) > size:
        img.scale(size, size)
    return img


def mat_paint(name, rgb, rough=0.45, clearcoat=0.25):
    """Painted toy finish. `rgb` is sRGB (tuple 0..1 or 0xRRGGBB)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*lin(rgb), 1)
    bsdf.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = clearcoat
    return m


def uv_project(obj, scale=1.0):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=scale)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)


def export_glb(path, root):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root, *root.children_recursive]:
        o.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_texcoords=True,
                              export_normals=True, export_materials='EXPORT',
                              export_image_format='WEBP', export_draco_mesh_compression_enable=False)


def ellipsoid(name, radii, at, rot=(0, 0, 0), mat=None, parent=None, segs=24):
    """Ellipsoid with game-axis radii (rx, ry, rz) and game-space euler rot (deg)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=1, location=G(*at))
    o = bpy.context.active_object
    o.name = name
    rx, ry, rz = radii
    o.scale = (rx, rz, ry)
    o.rotation_euler = (math.radians(rot[0]), math.radians(-rot[2]), math.radians(rot[1]))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    bpy.ops.object.shade_smooth()
    return finish(o, mat, parent)
