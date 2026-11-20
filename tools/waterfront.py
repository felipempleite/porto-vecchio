"""Reconstruct the inner bay from registered IGN photographs. Called by export_relief.py."""
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt


def inside(point, ring):
    x, y = point
    contained = False
    a, b = ring[-1]
    for c, d in ring:
        if (b > y) != (d > y) and x < a + (c-a)*(y-b)/(d-b):
            contained = not contained
        a, b = c, d
    return contained


def split_terrain(terrain, bounds):
    """Keep the original, registered surface available for the Terrier and contemporary model."""
    reference = terrain.copy()
    reference.data = terrain.data.copy()
    reference.name = 'RiveDeReference'
    bpy.context.scene.collection.objects.link(reference)
    left, bottom, right, top = bounds
    for ob in (terrain, reference):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        remove = []
        for face in bm.faces:
            center = face.calc_center_median()
            in_study = left < center.x < right and bottom < center.y < top
            if in_study == (ob == terrain):
                remove.append(face)
        bmesh.ops.delete(bm, geom=remove, context='FACES')
        bm.to_mesh(ob.data)
        bm.free()
    return reference


def build(terrain, source, make_material):
    traces = json.loads((Path.cwd()/'sources/rivages.json').read_text())
    width, height = traces['imageSize']
    x0, y0 = traces['cropOrigin']
    imin, imax, jmin, jmax = traces['gridBounds']
    nx, ny = 251, 252
    west, south = source.vertices[0].co.xy
    east, north = source.vertices[-1].co.xy
    south_lat, north_lat = 41.5774, 41.604

    def merc(lat):
        return math.log(math.tan(math.pi/4+math.radians(lat)/2))

    ms, mn = merc(south_lat), merc(north_lat)

    def pixel(i, j):
        lat = south_lat + j/(ny-1)*(north_lat-south_lat)
        return (i/(nx-1)*width-x0, (mn-merc(lat))/(mn-ms)*height-y0)

    def model_point(point):
        x, y = point
        u, v = (x+x0)/width, (y+y0)/height
        lat = math.degrees(2*math.atan(math.exp(mn-v*(mn-ms)))-math.pi/2)
        t = (lat-south_lat)/(north_lat-south_lat)
        return west + u*(east-west), south + t*(north-south), u*(nx-1), t*(ny-1)

    def altitude(point):
        _, _, col, row = model_point(point)
        i, j = math.floor(col), math.floor(row)
        dx, dy = col-i, row-j
        z = [source.vertices[(j+b)*nx+i+a].co.z for b in (0, 1) for a in (0, 1)]
        return (1-dy)*((1-dx)*z[0]+dx*z[1])+dy*((1-dx)*z[2]+dx*z[3])

    left, top = pixel(imin, jmax)
    right, bottom = pixel(imax, jmin)
    reference = split_terrain(terrain, (*model_point((left, bottom))[:2],
                                        *model_point((right, top))[:2]))
    materials = [
        make_material('Terre du golfe', (.59,.51,.36)),
        make_material('Eau du golfe', (.075,.28,.30)),
        make_material('Pierre du rivage', (.55,.44,.28)),
        make_material('Ouvrages du port', (.86,.70,.43)),
        make_material('Tranche du port', (.30,.26,.19)),
    ]
    # Border samples coincide with the two-grid-step terrain retained outside the study.
    border = ([pixel(i,jmax) for i in range(imin,imax,2)] +
              [pixel(imax,j) for j in range(jmax,jmin,-2)] +
              [pixel(i,jmin) for i in range(imax,imin,-2)] +
              [pixel(imin,j) for j in range(jmin,jmax,2)])
    periods = {}
    for era in ('1951','1975','2024'):
        trace = traces[era]
        line = [tuple(p) for p in trace['shore']]
        def crossing(y):
            for a,b in zip(line,line[1:]):
                if a[1] <= y <= b[1] and a[1] != b[1]:
                    return (a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),y)
            raise ValueError(f'{era}: trace does not reach study boundary')
        coast = [crossing(top)] + [p for p in line if top<p[1]<bottom] + [crossing(bottom)]
        mainland = [(left,top), *coast, (left,bottom)]
        islands = trace.get('islands',[])
        inlets = trace.get('inlets',[])
        def is_land(point):
            return ((inside(point,mainland) or any(inside(point,r) for r in islands))
                    and not any(inside(point,r) for r in inlets))

        points, ids, edges = [], {}, []
        def point_id(point):
            key = tuple(round(v,5) for v in point)
            if key not in ids:
                ids[key] = len(points)
                points.append(Vector(key))
            return ids[key]
        def constrain(ring, closed):
            indices = [point_id(p) for p in ring]
            if closed:
                indices.append(indices[0])
            edges.extend(zip(indices,indices[1:]))
        constrain(border, True)
        constrain(coast, False)
        for ring in islands + inlets:
            constrain(ring, True)
        # Constrained triangulation preserves narrow spits and breakwaters at full trace resolution.
        for j in range(jmin+1,jmax):
            for i in range(imin+1,imax):
                p = pixel(i,j)
                if is_land(p):
                    point_id(p)
        verts, _, triangles, _, _, _ = delaunay_2d_cdt(points,edges,[],0,.00008)
        shore_points = {tuple(round(c,3) for c in p) for r in [coast,*islands,*inlets] for p in r}
        vertices, uvs, faces, roles = [], [], [], []
        def vertex(p,z):
            vertices.append((*model_point(p)[:2],z))
            uvs.append(((p[0]+x0)/width,1-(p[1]+y0)/height))
            return len(vertices)-1
        def face(indices, role):
            faces.append(indices)
            roles.append(role)
        terrain_vertices = {}
        def surface(p,land):
            key = (tuple(round(c,3) for c in p),land)
            if key not in terrain_vertices:
                z = 0
                if land:
                    z = .002 if key[0] in shore_points else max(.002,altitude(p))
                terrain_vertices[key] = vertex(p,z)
            return terrain_vertices[key]
        for tri in triangles:
            pts = [verts[k] for k in tri]
            center = sum(pts,Vector((0,0)))/len(pts)
            land = is_land(center)
            face([surface(p,land) for p in reversed(pts)],0 if land else 1)
        def walls(path):
            for a,b in zip(path,path[1:]):
                face([surface(a,False),surface(b,False),surface(b,True),surface(a,True)],2)
        walls(coast)
        for ring in islands+inlets:
            walls(ring+[ring[0]])
        # Construct the visible study edge. It lies below the shared sheet in the wide atlas.
        for a,b in zip(border,border[1:]+border[:1]):
            mid = ((a[0]+b[0])/2,(a[1]+b[1])/2)
            # Sample just inside the rectangle so the land/water classification is unambiguous.
            test = (min(right-.01,max(left+.01,mid[0])),min(bottom-.01,max(top+.01,mid[1])))
            land = is_land(test)
            face([vertex(a,-.041),vertex(b,-.041),surface(b,land),surface(a,land)],4)
        corners=[(left,top),(right,top),(right,bottom),(left,bottom)]
        face([vertex(p,-.041) for p in corners],4)
        for breadth,path in trace['decks']:
            # Offset the photographed centerline into a connected strip, with mitered bends.
            pairs=[]
            for k,p in enumerate(path):
                before=Vector(p)-Vector(path[max(0,k-1)])
                after=Vector(path[min(len(path)-1,k+1)])-Vector(p)
                direction=(before.normalized()+after.normalized()).normalized()
                normal=Vector((-direction.y,direction.x))
                tangent=after.normalized() if after.length else before.normalized()
                half=breadth/2/max(.35,abs(normal.dot(Vector((-tangent.y,tangent.x)))))
                pairs.append((Vector(p)+normal*half,Vector(p)-normal*half))
            for (a,b),(c,d) in zip(pairs,pairs[1:]):
                # Height is symbolic. The images establish plan position, not quay elevations.
                verts_top=[vertex(p,.0031) for p in (a,c,d,b)]
                face(verts_top,3)
                for start,end in ((a,c),(c,d),(d,b),(b,a)):
                    face([vertex(start,0),vertex(end,0),vertex(end,.0031),vertex(start,.0031)],2)
        mesh=bpy.data.meshes.new('Tracé '+era)
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        ob=bpy.data.objects.new('Rivage'+era,mesh)
        bpy.context.scene.collection.objects.link(ob)
        for mat in materials:
            mesh.materials.append(mat)
        uv=mesh.uv_layers.new(name='UV')
        for loop in mesh.loops:
            uv.data[loop.index].uv=uvs[loop.vertex_index]
        for f,role in zip(mesh.polygons,roles):
            f.material_index=role
            if role in (0,1,3) and f.normal.z<0:
                f.flip()
            f.use_smooth=role==0
        periods[era]=ob
    return reference,periods


def render_study(periods, out, pins):
    """Publish texture-free matched views and a small self-contained editable Blender scene."""
    from bpy_extras.object_utils import world_to_camera_view
    scene=bpy.data.scenes.new('La Marine — trois rivages')
    scene.render.engine='CYCLES'
    scene.cycles.samples=16
    scene.cycles.use_denoising=True
    scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1440,810,100
    scene.world=bpy.data.worlds.new('Jour sur la baie')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.80,.83,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.54
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.frame_start,scene.frame_end=1,3
    for i,(era,ob) in enumerate(periods.items(),1):
        item=ob.copy()
        item.name='Le port — '+era
        scene.collection.objects.link(item)
        # Discard the object-level photograph overrides used to print the wide plates.
        for slot in item.material_slots:
            slot.link='OBJECT'
            slot.material=None
            slot.link='DATA'
        for frame in (1,2,3):
            item.hide_render=item.hide_viewport=frame!=i
            for prop in ('hide_render','hide_viewport'):
                item.keyframe_insert(data_path=prop,frame=frame)
        scene.timeline_markers.new('1951–52' if era=='1951' else era,frame=i)
    light=bpy.data.lights.new('Jour de mer','SUN')
    sun=bpy.data.objects.new('Jour de mer',light)
    scene.collection.objects.link(sun)
    sun.rotation_euler=Vector((1.4,.75,-1.25)).to_track_quat('-Z','Y').to_euler()
    light.energy=3.2
    light.angle=math.radians(7)
    light.color=(1,.93,.80)
    backdrop=bpy.data.meshes.new('Table')
    backdrop.from_pydata([(-12,-12,-.044),(12,-12,-.044),(12,12,-.044),(-12,12,-.044)],[],[(0,1,2,3)])
    floor=bpy.data.objects.new('Table de lecture',backdrop)
    scene.collection.objects.link(floor)
    floor_mat=bpy.data.materials.new('Fond de lecture')
    floor_mat.diffuse_color=(.027,.039,.038,1)
    floor.data.materials.append(floor_mat)
    camera=bpy.data.objects.new('Depuis la mer',bpy.data.cameras.new('Port'))
    scene.collection.objects.link(camera)
    scene.camera=camera
    bounds=periods['1951'].bound_box
    focus=Vector(((bounds[0][0]+bounds[6][0])/2,(bounds[0][1]+bounds[6][1])/2,.027))
    offset=Vector((1.25,-2.3,1.08))
    camera.location=focus+offset
    camera.rotation_euler=(-offset).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=2.15
    # Rendering a secondary scene from the atlas context can reuse the atlas frame.
    # Evaluate the visibility keyframes in the study's own window and view layer.
    bpy.context.window.scene=scene
    for frame,era in enumerate(periods,1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        visible=[ob.name for ob in scene.objects if ob.name.startswith('Le port — ') and not ob.hide_render]
        if visible!=['Le port — '+era]:
            raise RuntimeError(f'Expected only the waterfront of {era}, got {visible}')
        scene.render.filepath=str(out/('port-'+era+'.png'))
        bpy.ops.render.render(write_still=True)
    # Record the camera and projected pins for the browser's matching view.
    def pin(point):
        v=world_to_camera_view(scene,camera,point)
        return [round(v.x*100,3),round((1-v.y)*100,3)]
    (out/'camera-port.json').write_text(json.dumps({
        'target':list(focus),'direction':list(offset),'width':camera.data.ortho_scale,
        'pins':[pin(p) for p in pins]
    }))
    scene.frame_set(1)
    scene.render.filepath='//port-'
    save_study(scene,out)


def save_study(scene, out):
    """Open the source file directly to the first waterfront, with a standard Blender workspace."""
    name = scene.name
    with TemporaryDirectory(dir=out) as directory:
        library = str(Path(directory)/'study.blend')
        bpy.data.libraries.write(library, {scene})
        bpy.ops.wm.read_factory_settings(use_empty=True)
        empty = bpy.context.scene
        with bpy.data.libraries.load(library) as (_, target):
            target.scenes = [name]
        study = target.scenes[0]
        bpy.context.window.scene = study
        bpy.data.scenes.remove(empty)
        study.unit_settings.system = 'METRIC'
        study.unit_settings.scale_length = 1000
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                space.shading.color_type = 'MATERIAL'
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'rivages.blend'),compress=True)
