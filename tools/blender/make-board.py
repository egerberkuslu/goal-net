# The perimeter ad board, as a piece of furniture rather than a box.
#
#   npm run build:board
#   (PYTHONPATH must reach numpy for the glTF exporter — the npm script sets it)
#
# The boards were THREE.BoxGeometry: six identical faces, a banner smeared over
# all of them, no edge to catch the light. A real perimeter board is a thin
# panel in a dark frame, leaning back a few degrees so the floodlights rake
# across it. This authors that panel, in two lengths the stadium uses, and
# hands the game a glTF with TWO materials per board: `frame` (dark, no map)
# and `face` (white, the banner goes here, UV 0..1 across the front only).
#
# The contract with view/scene.js:
#   - two meshes, "board-6" and "board-3.8", metres, +Y up, +Z facing the pitch
#   - origin at the centre of the panel's footprint (x, z) and at HALF the
#     panel height in y — the same point the old box was positioned by, so
#     scene.js keeps every position it already has
#   - the front face's UV runs u 0..1 left to right as seen from the pitch,
#     v 0..1 bottom to top; the frame and back carry no meaningful UV
#
# Authored in three.js axes and converted at the end, the way make-view-parts.py
# does, for the same reason (see that file's to_blender_axes).

import bpy
import bmesh
import math
import os
import sys

OUT_DIR = os.path.join(os.getcwd(), "packages", "client", "src", "view", "boards")
OUT_GLB = os.path.join(OUT_DIR, "board.glb")

HEIGHT = 0.75  # metres, as the physics BOARD_TOP expects
DEPTH = 0.10  # panel thickness
FRAME = 0.035  # visible frame width around the face
LEAN = math.radians(6)  # the top leans back, away from the pitch
LENGTHS = {"board-6": 6.0, "board-3.8": 3.8}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            block.remove(item)


def material(name, rgba, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    return m


def box(bm, x0, x1, y0, y1, z0, z1):
    """Axis-aligned box from corner to corner; returns its faces."""
    vs = [bm.verts.new((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    # index: x*4 + y*2 + z
    faces = []
    quads = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),  # -x, +x
        (0, 4, 5, 1),
        (2, 3, 7, 6),  # -y, +y
        (0, 2, 6, 4),
        (1, 5, 7, 3),  # -z, +z
    ]
    for q in quads:
        faces.append(bm.faces.new([vs[i] for i in q]))
    return faces


def make_board(name, length):
    """A framed panel: a dark outer box with the front face recessed and
    replaced by a white inset that carries the banner."""
    hx = length / 2
    bm = bmesh.new()
    frame_faces = box(bm, -hx, hx, 0.0, HEIGHT, -DEPTH, 0.0)
    # The face: a slightly smaller, slightly proud panel on the +z side.
    inset = FRAME
    face_faces = box(
        bm,
        -hx + inset,
        hx - inset,
        inset,
        HEIGHT - inset,
        -0.002,
        0.012,
    )
    bm.faces.ensure_lookup_table()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    # material slots: 0 frame, 1 face
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(material("frame", (0.05, 0.06, 0.08, 1.0), 0.6))
    obj.data.materials.append(material("face", (1.0, 1.0, 1.0, 1.0), 0.85))
    bpy.context.collection.objects.link(obj)

    # assign slots and UVs: the +z face of the inset gets a clean 0..1 map
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        c = f.calc_center_median()
        is_face_box = abs(c.x) <= hx - inset + 1e-6 and c.z > -0.003
        f.material_index = 1 if is_face_box else 0
        front = is_face_box and f.normal.z > 0.5
        for loop in f.loops:
            v = loop.vert.co
            if front:
                u = (v.x + (hx - inset)) / (2 * (hx - inset))
                w = (v.y - inset) / (HEIGHT - 2 * inset)
                loop[uv].uv = (u, w)
            else:
                # the frame reads a single texel of its own material; keep the
                # UV finite and off the face's range so a shared map never
                # shows there by accident
                loop[uv].uv = (0.0, 0.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = False

    # Lean the top back: rotate about the bottom-front edge (y = 0, z = 0).
    for v in me.vertices:
        # a shear, not a rotation: the height stays exactly HEIGHT (the physics
        # wall's BOARD_TOP) and only the top slides back
        v.co.z = v.co.z - v.co.y * math.tan(LEAN)
    # Origin at half height, so scene.js's existing y = 0.38 placement holds.
    for v in me.vertices:
        v.co.y -= HEIGHT / 2
    return obj


def to_blender_axes(obj):
    """three.js (+Y up, +Z forward) -> Blender (+Z up, -Y forward) so the
    exporter's Y-up conversion returns exactly what was authored."""
    for v in obj.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        v.co.x, v.co.y, v.co.z = x, -z, y


def main():
    clear_scene()
    objs = [make_board(name, length) for name, length in LENGTHS.items()]
    for o in objs:
        to_blender_axes(o)
        o.select_set(True)
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    size = os.path.getsize(OUT_GLB)
    print(f"\nwrote {OUT_GLB} ({size} bytes): " + ", ".join(LENGTHS))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # make the failure visible in --background
        print("FAILED:", e, file=sys.stderr)
        sys.exit(1)
