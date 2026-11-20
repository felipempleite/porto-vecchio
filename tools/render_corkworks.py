"""Blender study of the documented spaces at Saint-Joseph. Dimensions other than
the two floor areas are illustrative. Run with -P tools/render_corkworks.py -- OUT.
Source: Inventaire général, IA2A001310.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

out = Path(sys.argv[-1])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.engine='CYCLES'
s.cycles.samples=20
s.cycles.use_denoising=True
s.world=bpy.data.worlds.new('Atelier')
s.world.use_nodes=True
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.75,.80,.79,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.48

def mat(name, color):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=.86
    return m

ground=mat('Fond graphite',(.026,.038,.037))
stone=mat('Maçonnerie de granit',(.61,.54,.423))
floor=mat('Sol des ateliers',(.47,.43,.35))
paper=mat('Socle',(.65,.585,.46))
corrugated=mat('Couverture grise',(.31,.345,.33))
structure=mat('Charpente',(.27,.225,.16))
cork=mat('Plaques de liège',(.48,.215,.086))
machine=mat('Machines',(.115,.225,.185))
metal=mat('Métal',(.32,.34,.30))

def box(name,pos,dims,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object
    o.name=name
    o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Arêtes','BEVEL');mod.width=bevel;mod.segments=2
    return o

box('Table',(0,0,-1.7),(500,500,1),ground)
box('Socle',(0,0,-.55),(47,44,1.2),paper,.17)
roofs=[]
for name,y,length,width in [('Nord',11,32,433/32),('Sud',-11,37,590/37)]:
    near=1 if y<0 else -1
    wall=.48
    box('Plancher '+name,(0,y,.16),(length,width,.22),floor)
    box('Mur extérieur '+name,(0,y-near*width/2,2.22),(length,.48,4.3),stone)
    for side in [-1,1]:
        box('Pignon '+name,(side*length/2,y,2.22),(wall,width,4.3),stone)
    # Broad openings toward the courtyard keep the two work areas readable.
    for x in [-length*.39,0,length*.39]:
        box('Mur côté cour '+name,(x,y+near*width/2,2.22),(length*.21,wall,4.3),stone)
    for x in [-length*.25,length*.25]:
        box('Linteau '+name,(x,y+near*width/2,3.98),(length*.19,.5,.75),stone)
    pitch=math.radians(20)
    for sign in [-1,1]:
        slope_width=(width/2+.5)/math.cos(pitch)
        roof=box('Toit '+name,(0,y+sign*width/4,4.35+width/4*math.tan(pitch)),
                 (length+1,slope_width,.19),corrugated)
        roof.rotation_euler.x=-sign*pitch
        roofs.append(roof)
        for j in range(-int(length),int(length)+1,2):
            rib=box('Nervure',(j*.5,y+sign*width/4,4.48+width/4*math.tan(pitch)),
                    (.07,slope_width,.055),corrugated)
            rib.rotation_euler.x=-sign*pitch
            roofs.append(rib)
    for x in [-length*.32,0,length*.32]:
        for sign in [-1,1]:
            beam=box('Arbalétrier',(x,y+sign*width/4,4.18+width/4*math.tan(pitch)),
                     (.2,slope_width,.20),structure)
            beam.rotation_euler.x=-sign*pitch

for i,(x,y) in enumerate([(-11,8),(-7,8),(-11,12),(-7,12),(6,12),(10,12),(9,8)]):
    for k in range(4+i%3):
        o=box('Plaques',(x+.04*(k%3),y,.37+k*.23),(2.65,1.40,.19),cork,.035)
        o.rotation_euler.z=.035*((i+k)%3-1)
for x in [-11,-4,3,10]:
    for y in [-9,-13]:
        box('Poste de fabrication',(x,y,1.05),(2.6,1.4,1.55),machine,.10)
        box('Plan de travail',(x,y,1.9),(2.85,1.65,.2),metal)
        box('Tête de machine',(x+.6,y,2.25),(.68,.64,.54),machine,.08)

sun_data=bpy.data.lights.new('Jour','SUN')
sun=bpy.data.objects.new('Jour',sun_data);s.collection.objects.link(sun)
sun.rotation_euler=Vector((1.5,-.4,-2.15)).to_track_quat('-Z','Y').to_euler()
sun_data.energy=3.2;sun_data.angle=math.radians(12)
cd=bpy.data.cameras.new('La cour')
cam=bpy.data.objects.new('La cour',cd);s.collection.objects.link(cam);s.camera=cam
target=Vector((0,0,1.4));cam.location=target+Vector((44,-60,57))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cd.type='ORTHO';cd.ortho_scale=75
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage=1250,860,100
for opened in [False,True]:
    for roof in roofs:roof.hide_render=opened
    s.render.filepath=str(out/('ateliers-ouverts.png' if opened else 'ateliers.png'))
    bpy.ops.render.render(write_still=True)
