# The body parts the game actually draws, authored in Blender.
#
#   blender --background --python tools/blender/make-view-parts.py
#   (or: npm run build:viewparts)
#
# Why a second script
# -------------------
# make-parts.py authors the four unit parts for arena/anim's instanced rig. That
# rig is not wired into the view yet, so nothing it produces is on screen. This
# one targets view/playerView.js — the code that draws every player in BOTH the
# shipping game and the arena today — so what it makes is visible immediately.
#
# The contract
# ------------
# playerView builds each player from four primitives at fixed metric sizes:
#
#   torso   CapsuleGeometry(0.26, 0.45)        radius 0.26, total height 0.97
#   head    SphereGeometry(0.16)               radius 0.16
#   leg     CylinderGeometry(0.075, 0.06, 0.55)  top 0.075, bottom 0.06, h 0.55
#   arm     CylinderGeometry(0.055, 0.045, 0.48) top 0.055, bottom 0.045, h 0.48
#
# These are authored at exactly those extents, centred on the origin with +Y up
# and +Z forward, so swapping one for the other is a geometry assignment and
# nothing else — no offsets to retune, no animation to re-time. The script
# asserts the extents before it exports, because a part that is a centimetre
# taller silently changes where every knee bends.
#
# Colour comes from playerView's existing materials (jersey, skin), so these
# carry no materials and need no UVs.

import bpy
import bmesh
import math
import os
import sys

OUT_DIR = os.path.join(os.getcwd(), "dist-assets")
OUT_GLB = os.path.join(OUT_DIR, "view-parts.glb")

# Metres. Half-extents in x/y/z, matching the primitives listed above.
SPEC = {
    # name: (half x, half y, half z, triangle budget)
    "torso": (0.26, 0.485, 0.26, 420),
    "head": (0.16, 0.16, 0.16, 300),
    "leg": (0.075, 0.275, 0.075, 200),
    "arm": (0.055, 0.24, 0.055, 200),
}


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


def lathe(bm, rings, sides):
    """Solid of revolution from (y, radius) rings, bottom-up.

    A radius of 0 collapses to a point, which closes the crown of a head or the
    end of a limb into a fan instead of a hole.
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
    if len(loops[0]) > 1:
        bm.faces.new(list(reversed(loops[0])))
    if len(loops[-1]) > 1:
        bm.faces.new(loops[-1])
    return bm


def make_torso():
    """Shoulders, chest, waist, hips — the silhouette a capsule cannot give.

    Profile in fractions of the half-height, radii in fractions of the max. The
    shoulder shelf near the top is the single cue that reads as "person" at the
    twenty-odd pixels a player occupies from the broadcast camera.
    """
    h = 0.485
    r = 0.26
    profile = [
        (-1.00, 0.00),
        (-0.96, 0.52),  # rounded bottom of the hips
        (-0.78, 0.80),
        (-0.50, 0.86),  # hips
        (-0.22, 0.78),  # waist
        (0.14, 0.92),
        (0.46, 1.00),  # chest
        (0.66, 0.98),  # shoulder shelf
        (0.80, 0.72),
        (0.93, 0.44),  # neck
        (1.00, 0.00),
    ]
    bm = bmesh.new()
    lathe(bm, [(y * h, rr * r) for y, rr in profile], 14)
    return mesh_from_bmesh("torso", bm)


def make_head():
    """A head with a jaw and a flatter occiput, not a ball."""
    r = 0.16
    bm = bmesh.new()
    rings = []
    steps = 12
    for i in range(steps + 1):
        t = i / steps
        y = -1.0 + 2.0 * t
        rings.append((y * r, math.sqrt(max(0.0, 1.0 - y * y)) * r))
    lathe(bm, rings, 12)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z *= 0.86  # back of the skull
        else:
            v.co.z *= 1.04  # brow and face
        if v.co.y < -0.35 * r:  # narrow the jaw
            k = (v.co.y + 0.35 * r) / (-0.65 * r)
            v.co.x *= 1.0 - 0.24 * k
            v.co.z *= 1.0 - 0.14 * k
    return mesh_from_bmesh("head", bm)


def make_limb(name, r_top, r_bottom, half_h, bulge_at, bulge):
    """A limb with a muscle. `bulge_at` is where along the limb it is thickest,
    -1 at the bottom and +1 at the top; `bulge` is how much wider, as a
    fraction of the radius there."""

    def radius(t):  # t from -1 (bottom) to +1 (top)
        base = r_bottom + (r_top - r_bottom) * (t + 1) / 2
        return base * (1 + bulge * math.exp(-((t - bulge_at) ** 2) / 0.18))

    bm = bmesh.new()
    rings = []
    steps = 8
    for i in range(steps + 1):
        t = -1 + 2 * i / steps
        rings.append((t * half_h, radius(t)))
    lathe(bm, rings, 9)
    return mesh_from_bmesh(name, bm)



def add_cylindrical_uv(obj, seam_z=True):
    """Wrap a cylindrical UV around a lathed part.

    U runs once around the body starting at the player's side and increasing
    the way a viewer OUTSIDE the cylinder reads it, so text on the shirt is not
    mirrored. Getting that direction backwards renders a 9 as a reversed 9,
    which is the kind of bug that looks like a font problem. The back lands at
    u=0.25 with the seam under the arm —
    where a real shirt's seam is, and more importantly not where the number
    goes. The first version put the seam down the spine, which would have cut
    every squad number in half.

    V runs bottom to top. Done by hand rather than with the unwrap operator
    because a lathe's topology is known exactly and an operator's result is not
    reproducible across Blender versions.

    Vertices on the seam belong to two different U values, so the mesh is split
    there first — otherwise the last column of faces runs the texture backwards
    across the whole body, which is the classic barber-pole artefact.
    """
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv_layer = bm.loops.layers.uv.new("UVMap")
    ys = [v.co.y for v in bm.verts]
    y0, y1 = min(ys), max(ys)
    span = (y1 - y0) or 1.0
    for face in bm.faces:
        # a face's own centre decides which side of the seam it is on, which is
        # what keeps the wrap continuous without duplicating vertices
        cx = sum(l.vert.co.x for l in face.loops) / len(face.loops)
        cz = sum(l.vert.co.z for l in face.loops) / len(face.loops)
        c_u = ((math.pi - math.atan2(cz, cx)) / math.tau) % 1.0
        for loop in face.loops:
            co = loop.vert.co
            u = ((math.pi - math.atan2(co.z, co.x)) / math.tau) % 1.0
            if u - c_u > 0.5:
                u -= 1.0
            elif c_u - u > 0.5:
                u += 1.0
            loop[uv_layer].uv = (u, (co.y - y0) / span)
    bm.to_mesh(me)
    bm.free()


def finish(obj):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    return len(me.polygons)


def normalise(obj, limits):
    """Recentre and scale each axis so the part occupies exactly the extents
    the primitive it replaces did. Authoring stays free; the contract holds."""
    vs = obj.data.vertices
    for axis, lim in enumerate(limits):
        lo = min(v.co[axis] for v in vs)
        hi = max(v.co[axis] for v in vs)
        mid = (hi + lo) / 2
        half = (hi - lo) / 2
        k = (lim / half) if half > 1e-9 else 1.0
        for v in vs:
            v.co[axis] = (v.co[axis] - mid) * k


def check(obj, limits, name):
    vs = obj.data.vertices
    problems = []
    for axis, lim in zip(range(3), limits):
        lo = min(v.co[axis] for v in vs)
        hi = max(v.co[axis] for v in vs)
        if abs((hi - lo) / 2 - lim) > 1e-4:
            problems.append(
                f"{name} half-extent {'xyz'[axis]} is {(hi-lo)/2:.4f}, want {lim}"
            )
        if abs((hi + lo) / 2) > 1e-4:
            problems.append(f"{name} is off-centre in {'xyz'[axis]}")
    return problems



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
        ("torso", make_torso),
        ("head", make_head),
        ("leg", lambda: make_limb("leg", 0.075, 0.06, 0.275, -0.35, 0.16)),
        ("arm", lambda: make_limb("arm", 0.055, 0.045, 0.24, 0.30, 0.13)),
    ]
    problems = []
    print("\nview parts (metres, drop-in for view/playerView.js)")
    for name, build in builders:
        hx, hy, hz, budget = SPEC[name]
        obj = build()
        tris = finish(obj)
        normalise(obj, (hx, hy, hz))
        # the torso and arms wear the kit, so they need somewhere to put it
        if name in ("torso", "arm"):
            add_cylindrical_uv(obj)
        problems += check(obj, (hx, hy, hz), name)
        if tris > budget:
            problems.append(f"{name} is {tris} triangles, budget is {budget}")
        print(
            f"  {name:6s} {tris:4d} tris   half-extents "
            f"{hx:.3f} x {hy:.3f} x {hz:.3f}"
        )

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
        export_materials="NONE",
        export_normals=True,
        export_texcoords=True,
        export_yup=True,
    )
    print(f"\nwrote {OUT_GLB} ({os.path.getsize(OUT_GLB)} bytes)")


main()
