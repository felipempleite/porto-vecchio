"""Run from the repository root with Blender 5.2:
blender -b sources/portivechju.blend -P tools/export_relief.py -- /tmp/relief-export
Writes source PNGs and an uncompressed GLB. The wider IGN tiles are cached in the output directory.
"""
import math
import json
import re
import runpy
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

out = Path(sys.argv[sys.argv.index('--') + 1])
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.frame_set(5)
west, south, east, north = 9.2685, 41.5774, 9.3032, 41.604
midlat, midlon = (north + south) / 2, (west + east) / 2
xscale, yscale = 111.32 * math.cos(math.radians(midlat)), 111.2
nx, ny = 251, 252
original = bpy.data.objects['Maquette · bâti actuel']
buildings = bpy.data.collections['Bâti contemporain'].objects[0]
sides = bpy.data.objects['Tranche du relief']
cam = scene.camera
source_image = bpy.data.materials['Photographie 2024'].node_tree.nodes.get('Image Texture').image
pixels = np.empty(len(source_image.pixels), dtype=np.float32)
source_image.pixels.foreach_get(pixels)
pixels = pixels.reshape(source_image.size[1], source_image.size[0], 4)
source = original.data

def xy(lon, lat):
    return ((lon-midlon)*xscale, (lat-midlat)*yscale)

def z_at(lon, lat):
    col = min(nx-1, max(0, round((lon-west)/(east-west)*(nx-1))))
    row = min(ny-1, max(0, round((lat-south)/(north-south)*(ny-1))))
    return source.vertices[row*nx+col].co.z

def mesh_object(name, vertices, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    return ob

def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*rgb, 1)
    return m

def grid_faces(cols, rows):
    return [(j*cols+i, j*cols+i+1, (j+1)*cols+i+1, (j+1)*cols+i)
            for j in range(rows-1) for i in range(cols-1)]

def aim(camera, location, target):
    camera.location = Vector(location)
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z', 'Y').to_euler()

def render(name, width=1440, height=810):
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)

# A portable, lower-density ground surface. Keep source UVs and tint from the aerial.
rows = sorted(set(range(0, ny, 2)) | {ny-1})
cols = sorted(set(range(0, nx, 2)) | {nx-1})
vertices, texcoords, colors = [], [], []
merc = lambda lat: math.log(math.tan(math.pi/4+math.radians(lat)/2))
for j in rows:
    for i in cols:
        idx = j*nx+i
        vertices.append(tuple(source.vertices[idx].co))
        u = i/(nx-1)
        v = (merc(south+(north-south)*j/(ny-1))-merc(south))/(merc(north)-merc(south))
        texcoords.append((u, v))
        w, h = source_image.size
        rgb = pixels[min(h-1, round(v*(h-1))), min(w-1, round(u*(w-1))), :3]
        shade = float(np.dot(rgb, [.213,.715,.072]))
        water = source.attributes['mer'].data[idx].value > .5
        c1, c2 = ((.065,.21,.22),(.47,.53,.43)) if water else ((.23,.27,.19),(.83,.74,.58))
        factor = min(1, shade/(.28 if water else .48))
        colors.append(tuple(a+(b-a)*factor for a,b in zip(c1,c2))+(1,))
terrain = mesh_object('Terrain', vertices, grid_faces(len(cols), len(rows)))
uv = terrain.data.uv_layers.new(name='UV')
for loop in terrain.data.loops:
    uv.data[loop.index].uv = texcoords[loop.vertex_index]
attr = terrain.data.color_attributes.new('Patine','FLOAT_COLOR','POINT')
for datum, color in zip(attr.data, colors):
    datum.color = color
for face in terrain.data.polygons:
    face.use_smooth = True
m = material('Patine du relief',(.6,.55,.42))
node = m.node_tree.nodes.new('ShaderNodeVertexColor')
node.layer_name = 'Patine'
m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
terrain.data.materials.append(m)
buildings.animation_data_clear()
buildings.hide_viewport = False
buildings.hide_render = False
buildings.name = 'Maisons'
sides.name = 'Tranche'

# Digitize the marks on the Porto-Vecchio sheet. These are symbols, with a uniform
# thickness for reading them in relief, independent of any historical roof height.
def from_detail(x, y):
    u, v = (400+x/1.5)/1700, (700+y/1.5)/1743
    lon = west+u*(east-west)
    lat = math.degrees(2*math.atan(math.exp(merc(north)-v*(merc(north)-merc(south))))-math.pi/2)
    # Conform the thin ink to the ground between sampled vertices.
    gx, gy = u*(nx-1), (lat-south)/(north-south)*(ny-1)
    i, j = int(gx), int(gy)
    dx, dy = gx-i, gy-j
    heights = [source.vertices[(j+b)*nx+i+a].co.z for b in (0, 1) for a in (0, 1)]
    z = (1-dy)*((1-dx)*heights[0]+dx*heights[1])+dy*((1-dx)*heights[2]+dx*heights[3])
    return (*xy(lon,lat),z+.0003)

marks = [
 [(200,273),(205,269),(210,274),(205,279)],[(223,257),(228,252),(234,258),(229,264)],
 [(232,269),(238,264),(243,269),(237,275)],[(248,250),(253,243),(259,249),(253,255)],
 [(264,230),(273,221),(279,227),(270,237)],[(282,238),(286,231),(304,244),(299,251)],
 [(314,219),(319,215),(332,225),(327,231)],[(269,264),(277,257),(284,263),(277,271)],
 [(288,264),(295,258),(313,274),(309,279),(300,274),(296,269)],
 [(214,289),(221,282),(228,290),(222,296)],[(251,297),(255,291),(250,284),(256,278),(275,302),(269,309)],
 [(270,293),(280,281),(297,295),(287,308)],[(214,323),(223,315),(231,325),(225,331),(231,337),(225,342)],
 [(231,318),(237,311),(253,327),(247,334)]]
v,f = [],[]
for ring in marks:
    base = len(v)
    points = [from_detail(x,y) for x,y in ring]
    v.extend(points)
    v.extend([(x,y,z+.0018) for x,y,z in points])
    n = len(points)
    f.append(tuple(base+n+i for i in reversed(range(n))))
    for i in range(n):
        k = (i+1)%n
        f.append((base+i,base+k,base+k+n,base+i+n))
historic = mesh_object('SignesDuTerrier',v,f)
historic.data.materials.append(material('Encre du Terrier',(.36,.065,.034)))

waterfront = runpy.run_path(str(Path.cwd()/'tools/waterfront.py'))
reference, port = waterfront['build'](terrain, source, material)
for ob in bpy.context.selected_objects:
    ob.select_set(False)
for ob in [terrain, reference, buildings, sides, historic, *port.values()]:
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'portivechju.glb'),use_selection=True,
                          export_format='GLB',export_animations=False,export_cameras=False,
                          export_lights=False,export_yup=True,export_extras=False)

for ob in [terrain, reference, *port.values()]:
    ob.hide_render = True
historic.hide_render = True
original.animation_data_clear()
buildings.animation_data_clear()
for ob in bpy.data.collections['Époques'].objects:
    ob.animation_data_clear()
    ob.hide_render = ob != original
bare = material('Calcaire de lecture',(.62,.57,.43))
attr = bare.node_tree.nodes.new('ShaderNodeAttribute')
attr.attribute_name='mer'
mix = bare.node_tree.nodes.new('ShaderNodeMixRGB')
mix.inputs[1].default_value=(.59,.55,.43,1)
mix.inputs[2].default_value=(.085,.22,.24,1)
bare.node_tree.links.new(attr.outputs['Fac'],mix.inputs[0])
bare.node_tree.links.new(mix.outputs['Color'],bare.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
original.material_slots[0].material = bare
buildings.hide_render = True
focus = Vector((*xy(9.2810,41.5900),.041))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 1.30
aim(cam,focus+Vector((2.6,-5.3,4)),focus)
render('ville-rocher')
original.material_slots[0].material = bpy.data.materials['Terrier de Corse']
historic.hide_render = False
render('ville-terrier')
overview = Vector((0,0,.036))
cam.data.ortho_scale = 4.70
aim(cam,overview+Vector((2.6,-5.3,4)),overview)
render('golfe-terrier')
historic.hide_render = True

# The dated wide and town views use the same waterfront geometry as the browser.
original.hide_render = True
terrain.hide_render = False
outer_material = terrain.material_slots[0].material
for era, name in [('1951','Mission Corse'),('1975','Photographie 1975'),('2024','Photographie 2024')]:
    photo = bpy.data.materials[name]
    terrain.material_slots[0].material = photo
    shore = port[era]
    shore.hide_render = False
    for slot in (0,1,3):
        shore.material_slots[slot].link='OBJECT'
        shore.material_slots[slot].material=photo
    for label,target,width in [('golfe',overview,4.70),('ville',focus,1.30)]:
        cam.data.ortho_scale=width
        aim(cam,target+Vector((2.6,-5.3,4)),target)
        render(label+'-'+era)
    for slot in (0,1,3):
        shore.material_slots[slot].link='DATA'
    shore.hide_render = True
terrain.material_slots[0].material = outer_material
terrain.hide_render = True
original.hide_render = False
pins=[Vector((*xy(lon,lat),z_at(lon,lat))) for lon,lat in [(9.27895,41.59105),(9.28445,41.5901)]]

# A street-level conclusion. Use the OSM street lines already documented in the site.
original.material_slots[0].material = bpy.data.materials['Sable, eau et courbes']
buildings.hide_render = False
town = ET.parse('assets/map/vieille-ville.svg')
for key,color,lift in [('home',(.72,.28,.055),.0018),('abbatucci',(.075,.25,.09),.0018)]:
    d = next(el.get('d') for el in town.iter() if 'town-street--'+key in el.get('class','').split())
    paths = re.findall(r'M[^M]+', d)
    for points in paths:
        curve = bpy.data.curves.new('Tracé '+key,'CURVE')
        curve.dimensions='3D'
        curve.bevel_depth=.0026
        curve.bevel_resolution=2
        spline=curve.splines.new('POLY')
        coords=re.findall(r'[ML]([0-9.-]+),([0-9.-]+)',points)
        spline.points.add(len(coords)-1)
        for point,(x,y) in zip(spline.points,coords):
            lon=9.2765+float(x)/600*.0048
            lat=41.5922-float(y)/600*.0048*math.cos(math.radians(41.591))
            position=Vector((*xy(lon,lat),z_at(lon,lat)+lift))
            position+=Vector((.04,-.65,1.0)).normalized()*.32
            point.co=(*position,1)
        ob=bpy.data.objects.new('Rue '+key,curve)
        scene.collection.objects.link(ob)
        ink=material('Pigment '+key,color)
        ink.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(*color,1)
        ink.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.4
        ob.visible_shadow=False
        ob.data.materials.append(ink)
focus=Vector((*xy(9.27898,41.59098),.092))
cam.data.ortho_scale=.40
aim(cam,focus+Vector((.04,-.65,1.0)),focus)
render('deux-rues',1260,840)
for ob in list(scene.objects):
    if ob.name.startswith('Rue '):
        ob.hide_render=True

# The mountain frame covers the entire sightline. Use IGN WGS84G level 11.
tile_size=360/4096
tiles={}
def region_alt(lon,lat):
    tx,ty=(180+lon)/tile_size,(90-lat)/tile_size
    i,j=int(tx),int(ty)
    if (i,j) not in tiles:
        local=out/f'ign-11-{i}-{j}.bil'
        if not local.exists():
            url=('https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile'
                 '&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLE=normal'
                 f'&TILEMATRIXSET=WGS84G&TILEMATRIX=11&TILEROW={j}&TILECOL={i}&FORMAT=image%2Fx-bil%3Bbits%3D32')
            with urllib.request.urlopen(url,timeout=30) as resp:
                local.write_bytes(resp.read())
        tiles[i,j]=np.frombuffer(zlib.decompress(local.read_bytes()),'<f4').reshape(256,256)
    return float(tiles[i,j][int((ty-j)*256),int((tx-i)*256)])
rw,rs,reast,rn=9.156,41.555,9.378,41.697
rcols,rrows=290,248
v,land=[],[]
for j in range(rrows):
    for i in range(rcols):
        lon=rw+(reast-rw)*i/(rcols-1)
        lat=rs+(rn-rs)*j/(rrows-1)
        h=region_alt(lon,lat)
        v.append((*xy(lon,lat),max(0,h)*.001))
        land.append(h>=-100)
region=mesh_object('Relief régional',v,grid_faces(rcols,rrows))
for name,col in [('Maquis',(.28,.34,.235)),('Golfe',(.064,.23,.25))]:
    region.data.materials.append(material(name,col))
for face in region.data.polygons:
    face.material_index = int(sum(land[k] for k in face.vertices)<2)
    face.use_smooth=True
sides.hide_render=True
table=bpy.data.objects['Table de lecture']
table.hide_render=True
original.hide_render=True
buildings.hide_render=True
# Section of the landscape from the highlands looking toward the gulf.
focus=Vector((*xy(9.263,41.619),.28))
cam.data.type='ORTHO'
cam.data.ortho_scale=17.6
aim(cam,focus+Vector((-12,10,6.7)),focus)
table.hide_render=False
region_ink=region.data.materials[0]
nodes=region_ink.node_tree.nodes
geometry=nodes.new('ShaderNodeNewGeometry')
sep=nodes.new('ShaderNodeSeparateXYZ')
region_ink.node_tree.links.new(geometry.outputs['Position'],sep.inputs[0])
ramp=nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color=(.53,.53,.35,1)
ramp.color_ramp.elements[1].color=(.35,.35,.27,1)
moss=ramp.color_ramp.elements.new(.37)
moss.color=(.205,.30,.20,1)
region_ink.node_tree.links.new(sep.outputs['Z'],ramp.inputs[0])
region_ink.node_tree.links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
def project(pt):
    v=world_to_camera_view(scene,cam,Vector(pt))
    return [round(100*v.x,2),round(100*(1-v.y),2)]
bpy.context.view_layer.update()
locations={name:project((*xy(lon,lat),max(0,region_alt(lon,lat))*.001)) for name,lon,lat in [
    ('ospedale',9.1965,41.654),('ville',9.2795,41.5913)]}
(out/'montagne.json').write_text(json.dumps(locations))
render('ospedale-golfe')
table.hide_render=True
# The direction of the photograph is reproduced approximately from the salt pans.
original.hide_render=False
buildings.hide_render=False
original.scale.z=buildings.scale.z=.5
for face in region.data.polygons:
    c=face.center
    if abs(c.x)<1.48 and abs(c.y)<1.51:
        # Move coincident regional ground beneath the finer urban mesh.
        for k in face.vertices:
            region.data.vertices[k].co.z=min(region.data.vertices[k].co.z,-.012)
cam.data.type='PERSP'
cam.data.lens=52
cam.data.clip_start=.0002
station=(*xy(9.2884,41.5822),max(.002,z_at(9.2884,41.5822)*.5)+.0025)
aim(cam,station,(*xy(9.2805,41.59115),.043))
render('depuis-les-salines',1260,840)
waterfront['render_study'](port,out,pins)
