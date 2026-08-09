# Conditioning downloaded models into the game's contract.
#
#   blender --background --python tools/blender/prep-vendor.py
#   (or: npm run prep:vendor)
#
# A model from a marketplace arrives in whatever units, orientation and origin
# its author happened to use: this ball came in centred on nothing in
# particular, and a stadium modelled in centimetres is a hundred times too big.
# Dropping one of those into the scene and hand-tuning a scale factor in JS is
# how a renderer ends up with magic numbers nobody can justify later.
#
# So every vendor model goes through here first and comes out obeying the same
# rule the Blender-authored parts obey: centred on its own origin, +Y up,
# +Z forward, and sized in metres to the dimension the game actually needs.
# The JS then loads it and applies no correction at all.
#
# Sources and licences: vendor-assets/CREDITS.md (written by fetch-models.mjs).
# This script does not check licences — fetch-models.mjs refuses anything that
# may not ship, so whatever is on disk here has already passed that gate.

import bpy
import math
import os
import sys
from mathutils import Vector

ROOT = os.getcwd()
IN_DIR = os.path.join(ROOT, "vendor-assets")
OUT_DIR = os.path.join(ROOT, "dist-assets", "vendor")

# name -> (target size in metres, which axis that size is measured on)
#
# AXES: the glTF importer has already converted the file into Blender's Z-up,
# so here "z" is HEIGHT and "y" is depth. Sizing a standing figure by "y" scales
# it by its depth — which is how a 1.78 m substitute came out several metres
# tall on the first run.
#
# The ball is sized by diameter because that is the number the renderer knows;
# the seating block by its width, because it gets tiled along a stand.
TARGETS = {
    "soccer-ball": {"size": 0.30, "axis": "max", "note": "match ball diameter"},
    "bleacher-seating": {"size": 2.00, "axis": "x", "note": "one seating block"},
    "stadium-lowpoly": {"size": 60.0, "axis": "x", "note": "reference only"},
    "bench": {"size": 2.60, "axis": "max", "ground": True,
              "note": "substitutes' bench, seats 4"},
    # sized to the crowd's row pitch in view/crowdView.js (SEAT_PITCH 0.6)
    "stadium-seat": {"size": 0.56, "axis": "x", "ground": True,
                     "note": "one seat in a row"},
    "floodlight": {"size": 3.20, "axis": "z", "ground": True,
                   "note": "the head unit that tops a pylon"},
    "substitute": {"size": 1.78, "axis": "z", "ground": True,
                   "note": "a player on the bench; z is height after import"},
    "scoreboard": {"size": 6.00, "axis": "max", "note": "over the far stand"},
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.objects, bpy.data.materials):
        for item in list(block):
            try:
                block.remove(item)
            except RuntimeError:
                pass


def world_bounds(objects):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi



def shrink_textures(limit=512):
    """Cap every image at `limit` pixels on its long side.

    A marketplace model ships 2K or 4K maps because it is meant for a render,
    not a browser: the downloaded ball was 1.6 MB of texture for something that
    is forty pixels across on screen. Blender can resample in place, so the
    conditioning step is also where the download stops being a page-weight
    problem.
    """
    saved = 0
    for img in bpy.data.images:
        w, h = img.size
        if max(w, h) <= limit or w == 0 or h == 0:
            continue
        k = limit / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
        saved += 1
    return saved


def prep(name, spec):
    src = os.path.join(IN_DIR, name, "model.glb")
    if not os.path.exists(src):
        print(f"  {name}: not downloaded, skipped")
        return False

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=src)
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not objects:
        print(f"  {name}: no mesh in the file")
        return False

    # Bake every imported transform into the vertices BEFORE touching the
    # hierarchy.
    #
    # A marketplace file usually carries its unit conversion on an ancestor
    # node — this bench had a 0.0254 inch-to-metre scale two levels up. Parenting
    # the mesh to our own pivot drops that ancestor, so the mesh silently grew by
    # 1/0.0254 and a 2.6 m bench came out 102 m long across the pitch. Measuring
    # matrix_world first hid it, because the measurement was taken while the
    # ancestor was still attached.
    #
    # Clearing the parents with CLEAR_KEEP_TRANSFORM and then applying puts the
    # whole chain into the mesh data, after which matrix_world is the identity
    # and every number below means what it says.
    # Rigged models first: bake the armature into the vertices.
    #
    # A downloaded character usually arrives skinned, and its mesh data is in
    # bind pose relative to bones rather than in place. Clearing the parents
    # then detaches it from the armature that was posing it, and the mesh
    # collapses — this footballer came out 1.68 x 0.29 x 1.67, a pancake, and
    # then got scaled to "1.78 m tall" by its widest axis. Applying the armature
    # modifier freezes the pose into the mesh, after which it is ordinary static
    # geometry and everything below is true of it.
    for o in objects:
        for mod in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except RuntimeError:
                o.modifiers.remove(mod)          # nothing to bake; drop it

    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")

    lo, hi = world_bounds(objects)
    size = hi - lo
    centre = (hi + lo) / 2
    tris = sum(len(o.data.polygons) for o in objects)

    # Blender is Z-up and the glTF importer has already converted the file's
    # Y-up into it, so "how tall" is z here and becomes y again on export.
    extent = {
        "max": max(size.x, size.y, size.z),
        "x": size.x,
        "y": size.y,
        "z": size.z,
    }[spec["axis"]]
    if extent <= 1e-9:
        print(f"  {name}: degenerate bounds")
        return False
    k = spec["size"] / extent

    # One empty as the parent, so a multi-part model is centred and scaled as
    # one thing rather than each mesh drifting to its own origin.
    pivot = bpy.data.objects.new(f"{name}_pivot", None)
    bpy.context.collection.objects.link(pivot)
    for o in objects:
        o.parent = pivot
        o.matrix_parent_inverse = pivot.matrix_world.inverted()
    # Things that stand on something want their BASE at the origin, not their
    # middle: a seat centred on its own bounding box is half buried in the step
    # it is bolted to. Everything else (a ball, a scoreboard) is placed by its
    # centre and stays that way.
    offset = -centre * k
    if spec.get("ground"):
        offset.z = -lo.z * k
    pivot.location = offset
    pivot.scale = (k, k, k)

    bpy.context.view_layer.update()
    shrunk = shrink_textures()
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    kb = os.path.getsize(out) / 1024
    print(
        f"  {name:18s} {tris:6d} tris  {size.x:.2f} x {size.y:.2f} x {size.z:.2f} "
        f"-> {spec['size']:.2f} m ({spec['axis']})  scale x{k:.4f}  {kb:.0f} KB"
    )
    return True


def main():
    print("\nconditioning vendor models")
    done = 0
    for name, spec in TARGETS.items():
        try:
            done += 1 if prep(name, spec) else 0
        except Exception as err:  # noqa: BLE001
            print(f"  {name}: FAILED — {err}")
    print(f"\n{done} written to dist-assets/vendor/")
    if done == 0:
        sys.exit(1)


main()
