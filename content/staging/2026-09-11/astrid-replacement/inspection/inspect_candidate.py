"""Import an original FBX/GLB, pack a separate native file, verify and render.

Usage: bpy-python inspect_candidate.py source.fbx output-directory
Original geometry/materials are not edited. Import interpretation is not a
byte-lossless format conversion; the original source remains authoritative.
"""
import argparse
from array import array
import hashlib
import json
import math
import os
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def sha(data):
    return hashlib.sha256(data).hexdigest()


def floats_hash(collection, key, width):
    values = array('f', [0]) * (len(collection) * width)
    collection.foreach_get(key, values)
    return sha(values.tobytes())


def scalar(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    try:
        return list(value)
    except TypeError:
        return str(type(value).__name__)


def inventory(names):
    result = {'objects': [], 'materials': [], 'images': [], 'actions': []}
    for name in sorted(names):
        obj = bpy.data.objects[name]
        item = {'name': name, 'type': obj.type, 'hideRender': obj.hide_render,
                'matrixWorld': [list(row) for row in obj.matrix_world],
                'parent': obj.parent.name if obj.parent else None}
        if obj.type == 'MESH':
            mesh = obj.data
            indices = array('i', [0]) * len(mesh.loops)
            mesh.loops.foreach_get('vertex_index', indices)
            weights = array('f')
            for vertex in mesh.vertices:
                for group in vertex.groups:
                    weights.extend((vertex.index, group.group, group.weight))
            item.update(vertices=len(mesh.vertices), polygons=len(mesh.polygons),
                        polygonSizes={str(n): sum(len(p.vertices) == n for p in mesh.polygons)
                                      for n in sorted(set(len(p.vertices) for p in mesh.polygons))},
                        positionSha256=floats_hash(mesh.vertices, 'co', 3),
                        loopIndicesSha256=sha(indices.tobytes()),
                        skinWeightsSha256=sha(weights.tobytes()),
                        uvLayers={uv.name: floats_hash(uv.data, 'uv', 2) for uv in mesh.uv_layers},
                        materials=[m.name if m else None for m in mesh.materials],
                        vertexGroups=[g.name for g in obj.vertex_groups],
                        morphs={k.name: floats_hash(k.data, 'co', 3)
                                for k in mesh.shape_keys.key_blocks} if mesh.shape_keys else {})
        elif obj.type == 'ARMATURE':
            item['bones'] = [{'name': b.name, 'parent': b.parent.name if b.parent else None,
                              'restMatrix': [list(row) for row in b.matrix_local]}
                             for b in obj.data.bones]
        result['objects'].append(item)
    for material in sorted(bpy.data.materials, key=lambda m: m.name):
        nodes = material.node_tree.nodes if material.use_nodes else []
        result['materials'].append({
            'name': material.name,
            'nodes': [{'name': n.name, 'type': n.bl_idname,
                       'image': n.image.name if n.type == 'TEX_IMAGE' and n.image else None,
                       'defaults': {s.identifier: scalar(s.default_value) for s in n.inputs
                                    if hasattr(s, 'default_value')}} for n in nodes],
            'links': sorted([[l.from_node.name, l.from_socket.identifier,
                              l.to_node.name, l.to_socket.identifier]
                             for l in material.node_tree.links]) if material.use_nodes else []})
    for image in sorted(bpy.data.images, key=lambda i: i.name):
        if image.type in {'RENDER_RESULT', 'COMPOSITING'}:
            continue
        packed = [sha(p.packed_file.data) for p in image.packed_files]
        result['images'].append({'name': image.name, 'size': list(image.size),
                                 'source': image.source, 'colorSpace': image.colorspace_settings.name,
                                 'packedSha256': packed})
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        result['actions'].append({'name': action.name, 'frameRange': list(action.frame_range),
                                   'slots': [s.identifier for s in action.slots]})
    return result


def point_camera(camera, point):
    camera.rotation_euler = (point-camera.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--front-angle', type=float, default=0,
                        help='Camera azimuth; default looks along Blender +Y.')
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--no-render', action='store_true')
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if source.suffix.lower() not in {'.fbx', '.glb', '.gltf'}:
        raise ValueError('Expected FBX, GLB or glTF source; retain/unpack archives first.')
    output.mkdir(parents=True, exist_ok=True)
    native = output/'candidate-packed.blend'
    if native.exists():
        raise FileExistsError(f'Refusing to replace {native}; choose a fresh output folder.')
    original_sha = sha(source.read_bytes())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(source), use_image_search=True)
    else:
        bpy.ops.import_scene.gltf(filepath=str(source))
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    names = [o.name for o in scene.objects]
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if not meshes:
        raise ValueError('Imported file contains no meshes.')
    missing = []
    for image in bpy.data.images:
        if image.type in {'RENDER_RESULT', 'COMPOSITING'}:
            continue
        if min(image.size) == 0:
            missing.append(image.name)
        elif not image.packed_file:
            image.pack()
    if missing:
        raise ValueError(f'Missing/undecodable source textures: {missing}')
    before = inventory(names)
    bpy.ops.wm.save_as_mainfile(filepath=str(native))
    bpy.ops.wm.open_mainfile(filepath=str(native))
    bpy.context.view_layer.update()
    after = inventory(names)
    if before != after:
        (output/'inventory-before.json').write_text(json.dumps(before, indent=2))
        (output/'inventory-after.json').write_text(json.dumps(after, indent=2))
        raise ValueError('Packed native reopen changed inventoried source data.')
    if sha(source.read_bytes()) != original_sha:
        raise ValueError('Original source file changed.')
    report = {'source': str(source), 'sourceSha256': original_sha,
              'native': str(native), 'nativeSha256': sha(native.read_bytes()),
              'nativeReopenInventoryMatches': True, 'inventory': after,
              'limitations': ['Importer interpretation is not byte-lossless conversion.',
                              'Renders show the imported pose; no seated pose is authored.',
                              'Hand crops are geometric heuristics and require visual review.',
                              'No claim of game-camera equivalence or realistic animation.']}
    (output/'inspection.json').write_text(json.dumps(report, indent=2))
    if args.no_render:
        return
    scene = bpy.context.scene
    points = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bone_shapes = {bone.custom_shape.name for obj in scene.objects if obj.type == 'ARMATURE'
                   for bone in obj.pose.bones if bone.custom_shape}
    for obj in scene.objects:
        if obj.type != 'MESH' or obj.hide_render or obj.name in bone_shapes:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    height = hi.z-lo.z
    if height <= 0:
        raise ValueError('Model has zero height; inspect source axes.')
    centre = (lo+hi)/2
    angle = math.radians(args.front_angle)
    front = Vector((math.sin(angle), -math.cos(angle), 0))
    screen_right = Vector((math.cos(angle), math.sin(angle), 0))
    world = bpy.data.worlds.new('Inspection_world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.16, .16, .16, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .4
    scene.world = world
    focus = Vector((centre.x, centre.y, lo.z+.74*height))
    for name, offset, energy, size in [
            ('Key', (-.6, -.7, 1.1), 35, .7),
            ('Fill', (.6, -.5, .8), 17, .8),
            ('Rim', (.3, .5, 1), 25, .6)]:
        light = bpy.data.objects.new('Inspection_'+name, bpy.data.lights.new('Inspection_'+name, 'AREA'))
        scene.collection.objects.link(light)
        light.location = Vector((centre.x, centre.y, lo.z))+Vector(offset)*height
        light.data.energy = energy*(height/1.73)**2
        light.data.shape, light.data.size = 'DISK', size*height
        point_camera(light, focus)
    camera = bpy.data.objects.new('Inspection_camera', bpy.data.cameras.new('Inspection_camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.clip_start, camera.data.clip_end = height*.001, height*10
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.render.threads_mode, scene.render.threads = 'FIXED', 6
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    camera.data.type, camera.data.lens = 'PERSP', 55
    camera.location = focus+front*height*1.3+Vector((0, 0, -height*.08))
    point_camera(camera, focus)
    scene.render.resolution_x, scene.render.resolution_y = 960, 800
    scene.render.filepath = str(output/'upper-body.png')
    bpy.ops.render.render(write_still=True)
    crops = []
    for side, sign in [('image-left', -1), ('image-right', 1)]:
        eligible = [p for p in points if lo.z+.42*height < p.z < lo.z+.63*height
                    and (p-centre).dot(screen_right)*sign > height*.13]
        if not eligible:
            crops.append({'side': side, 'status': 'not located; inspect manually'})
            continue
        extremity = max((p-centre).dot(screen_right)*sign for p in eligible)
        hand = [p for p in eligible if (p-centre).dot(screen_right)*sign > extremity-height*.09]
        target = Vector(tuple((min(p[i] for p in hand)+max(p[i] for p in hand))/2 for i in range(3)))
        camera.data.type, camera.data.ortho_scale = 'ORTHO', height*.21
        camera.location = target+front*height*.6
        point_camera(camera, target)
        scene.render.resolution_x = scene.render.resolution_y = 720
        scene.render.filepath = str(output/(side+'-hand.png'))
        bpy.ops.render.render(write_still=True)
        crops.append({'side': side, 'target': list(target), 'orthoScale': camera.data.ortho_scale})
    report['renderCrops'] = crops
    report['frontAngleDegrees'] = args.front_angle
    report['renderBounds'] = {'min': list(lo), 'max': list(hi), 'height': height}
    (output/'inspection.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'native': str(native), 'renders': str(output), 'status': 'ready for visual inspection'}))


if __name__ == '__main__':
    main()
    # Avoid the observed macOS bpy interpreter-teardown crash after successful
    # completed checks, save and rendering. Exceptions still produce failure.
    sys.stdout.flush()
    os._exit(0)
