# Authoring the player's body parts in Blender, headlessly.
#
#   blender --background --python tools/blender/make-parts.py
#
# Why this file exists
# --------------------
# anim/rig.js says, in its header, that there is no authored mesh "because
# there is no Blender in this environment to author one". There is now, so this
# is that mesh — generated, not downloaded. No Mixamo, no Adobe account, no
# marketplace, no manual step: the shapes are described here in Python and the
# script is the asset's source code, which means it can be reviewed, diffed and
# regenerated on any machine with Blender on PATH.
#
# What it must respect
# --------------------
# instancedBody.js draws every player from FOUR unit geometries, scaled per
# instance (that is what keeps ten animated players at four draw calls). So
# these parts are drop-in replacements for the primitives and must keep exactly
# the same convention, or every limb in the game changes length:
#
#   limb  cylinder-like, radius 1 in X/Z, height 1 in Y, centred on the origin
#   body  the same, but shaped like a torso
#   head  sphere-like, radius 1
#   boot  box-like, 1 x 1 x 1, centred, +Z is forward (the toe)
#
# The instance scale in rig.js PARTS turns each into metres. Nothing here may
# be off-centre and nothing may exceed the unit bounds, so the script asserts
# both before it exports.
#
# Triangle budget: rendering-optimization.md caps the scene at 150k triangles
# and ten players must not be most of it. These come to ~230 triangles per
# player, against ~150 for the primitives they replace.

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

OUT_DIR = os.path.join(os.getcwd(), "dist-assets")
OUT_GLB = os.path.join(OUT_DIR, "player-parts.glb")

# Per-part triangle ceilings. Exceeding one is a build failure, not a warning:
# the budget is the whole reason the rig is instanced in the first place.
TRI_BUDGET = {"limb": 80, "body": 110, "head": 130, "boot": 40}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            block.remove(item)


def mesh_from_bmesh(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def lathe(bm, rings, sides, cap_bottom=True, cap_top=True):
    """Build a solid of revolution from (y, radius) rings.

    Rings are given bottom-up. A radius of 0 collapses the ring to a point,
    which is how the boot's toe and the head's crown close without a fan of
    degenerate triangles.
    """
    loops = []
    for y, r in rings:
        if r <= 1e-6:
            loops.append([bm.verts.new((0.0, y, 0.0))])
            continue
        loop = []
        for i in range(sides):
            a = (i / sides) * math.tau
            loop.append(bm.verts.new((math.cos(a) * r, y, math.sin(a) * r)))
        loops.append(loop)
    bm.verts.ensure_lookup_table()

    for lower, upper in zip(loops, loops[1:]):
        if len(lower) == 1:
            for i in range(len(upper)):
                bm.faces.new((lower[0], upper[i], upper[(i + 1) % len(upper)]))
        elif len(upper) == 1:
            for i in range(len(lower)):
                bm.faces.new((lower[i], lower[(i + 1) % len(lower)], upper[0]))
        else:
            n = len(lower)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((lower[i], lower[j], upper[j], upper[i]))

    if cap_bottom and len(loops[0]) > 1:
        bm.faces.new(list(reversed(loops[0])))
    if cap_top and len(loops[-1]) > 1:
        bm.faces.new(loops[-1])
    return bm


def make_limb():
    """An arm or a leg.

    The primitive was a straight taper, which reads as a pipe. A real limb is
    thickest a third of the way down from the joint and narrows into the next
    one, so three rings and a soft shade do most of the work of a muscle.
    """
    bm = bmesh.new()
    lathe(bm, [(-0.5, 0.84), (-0.17, 0.98), (0.20, 1.00), (0.5, 0.88)], 7)
    return mesh_from_bmesh("limb", bm)


def make_body():
    """The torso and the hips share this one.

    Shoulders wider than the waist is the single silhouette cue that separates
    a person from a barrel at this size. X and Z stay circular here — the
    elliptical cross-section is the instance scale's job (0.195 by 0.130).
    """
    bm = bmesh.new()
    lathe(
        bm,
        [
            (-0.50, 0.80),  # waist
            (-0.22, 0.92),
            (0.10, 1.00),
            (0.36, 1.00),  # chest
            (0.50, 0.88),  # neck shelf
        ],
        8,
    )
    return mesh_from_bmesh("body", bm)


def make_head():
    """A head, not a ball: flatter at the back, a jaw at the front.

    Built as a lathe and then pushed in Z so the profile has a face. Kept under
    130 triangles because ten of these are on screen and none is ever more than
    a few dozen pixels tall.
    """
    bm = bmesh.new()
    rings = []
    steps = 8
    for i in range(steps + 1):
        t = i / steps
        y = -1.0 + 2.0 * t
        r = math.sqrt(max(0.0, 1.0 - y * y))
        rings.append((y, r))
    lathe(bm, rings, 8, cap_bottom=False, cap_top=False)

    # crown and chin: close the poles, then shape the profile
    for v in bm.verts:
        # flatten the back of the skull, round out the brow
        if v.co.z < 0:
            v.co.z *= 0.88
        else:
            v.co.z *= 1.02
        # narrow the jaw so the head is not a sphere with ears
        if v.co.y < -0.35:
            k = (v.co.y + 0.35) / -0.65
            v.co.x *= 1.0 - 0.22 * k
            v.co.z *= 1.0 - 0.12 * k
    return mesh_from_bmesh("head", bm)


def make_boot():
    """A boot: flat sole, tapered toe, heel counter. +Z is forward."""
    bm = bmesh.new()
    # Cross-sections along Z, each a rectangle (half width, y bottom, y top).
    sections = [
        (-0.50, 0.42, -0.50, 0.34),  # heel
        (-0.18, 0.50, -0.50, 0.50),  # instep
        (0.16, 0.50, -0.50, 0.34),
        (0.42, 0.40, -0.50, 0.05),  # toe box
        (0.50, 0.24, -0.50, -0.16),  # toe
    ]
    loops = []
    for z, hw, y0, y1 in sections:
        loops.append(
            [
                bm.verts.new((-hw, y0, z)),
                bm.verts.new((hw, y0, z)),
                bm.verts.new((hw, y1, z)),
                bm.verts.new((-hw, y1, z)),
            ]
        )
    bm.verts.ensure_lookup_table()
    for a, b in zip(loops, loops[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(loops[0])))
    bm.faces.new(loops[-1])
    return mesh_from_bmesh("boot", bm)


def finish(obj, smooth=True):
    """Triangulate, shade, and recalculate normals outward."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = smooth
    return len(me.polygons)



def normalise(obj, limits):
    """Snap the part into the unit box instancedBody.js assumes.

    A lathe with an odd number of sides is not symmetric about its own axis —
    seven-sided limbs came out 5% off-centre — and hand-picked ring radii miss
    the bound by a percent either way. Rather than hand-tune numbers until the
    assertion passes, the shape is authored freely and then recentred and
    scaled per axis to fit exactly. Relative proportions along each axis are
    untouched; only the overall extent changes.
    """
    vs = obj.data.vertices
    for axis, lim in enumerate(limits):
        lo = min(v.co[axis] for v in vs)
        hi = max(v.co[axis] for v in vs)
        mid = (hi + lo) / 2
        half = (hi - lo) / 2
        k = (lim / half) if half > 1e-9 else 1.0
        for v in vs:
            v.co[axis] = (v.co[axis] - mid) * k


def check_bounds(obj, limits, name):
    """The instance scale assumes these bounds. Drift here silently resizes
    every limb in the game, so it is an error, not a note."""
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    got = (max(map(abs, xs)), max(map(abs, ys)), max(map(abs, zs)))
    centre = (
        (max(xs) + min(xs)) / 2,
        (max(ys) + min(ys)) / 2,
        (max(zs) + min(zs)) / 2,
    )
    problems = []
    for axis, g, lim in zip("xyz", got, limits):
        if g > lim + 1e-4:
            problems.append(f"{name}.{axis} reaches {g:.4f}, unit bound is {lim}")
    for axis, c in zip("xyz", centre):
        if abs(c) > 1e-4:
            problems.append(f"{name} is off-centre in {axis} by {c:.4f}")
    return problems, got



def to_blender_axes(obj):
    """Author in three.js axes, hand Blender the axes it expects.

    Everything above is written the way the game thinks: +Y up, +Z forward.
    Blender is Z-up, and the exporter's yup conversion maps blender (x, y, z)
    to gltf (x, z, -y). Feeding it a Y-up mesh therefore lands the long axis of
    every limb in Z — the arm exported as 0.055 x 0.055 x 0.240 instead of
    0.055 x 0.240 x 0.055, and the loader rejected it.

    So the last thing before export is (x, y, z) -> (x, -z, y): the script's up
    becomes Blender's up, the script's forward becomes Blender's forward, and
    the exporter converts it back to exactly what was authored.
    """
    for v in obj.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        v.co.x, v.co.y, v.co.z = x, -z, y


def main():
    clear_scene()
    builders = [
        ("limb", make_limb, (1.0, 0.5, 1.0), True),
        ("body", make_body, (1.0, 0.5, 1.0), True),
        ("head", make_head, (1.0, 1.0, 1.0), True),
        ("boot", make_boot, (0.5, 0.5, 0.5), False),
    ]
    problems = []
    report = []
    for name, build, limits, smooth in builders:
        obj = build()
        tris = finish(obj, smooth)
        normalise(obj, limits)
        bad, got = check_bounds(obj, limits, name)
        problems += bad
        if tris > TRI_BUDGET[name]:
            problems.append(f"{name} is {tris} triangles, budget is {TRI_BUDGET[name]}")
        report.append(
            f"  {name:5s} {tris:4d} tris   extents "
            f"{got[0]:.3f} x {got[1]:.3f} x {got[2]:.3f}"
        )

    print("\nplayer parts")
    print("\n".join(report))
    if problems:
        print("\nFAILED:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)

    for obj in bpy.context.collection.objects:
        to_blender_axes(obj)

    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,
        export_materials="NONE",  # colour is per-instance in the renderer
        export_normals=True,
        export_texcoords=False,
        export_yup=True,
    )
    size = os.path.getsize(OUT_GLB)
    print(f"\nwrote {OUT_GLB} ({size} bytes)")


main()
