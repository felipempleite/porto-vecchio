"""Render two architectural details observed in the photographs credited on the site.
The dimensions are relative to the photographed openings, not a measured survey.
Run with blender -b -P tools/render_citadelle.py -- OUTPUT_DIRECTORY.
"""
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

out=Path(sys.argv[-1])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene
s.render.engine='CYCLES'
s.cycles.samples=20
s.cycles.use_denoising=True
s.world=bpy.data.worlds.new('Lumière du jour')
s.world.use_nodes=True
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.80,.78,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.56

def pigment(name, rgb, grain=False):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.88
    if grain:
        tree=m.node_tree
        noise=tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value=12
        coords=tree.nodes.new('ShaderNodeTexCoord')
        tree.links.new(coords.outputs['Object'],noise.inputs['Vector'])
        ramp=tree.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=tuple(c*.62 for c in rgb)+(1,)
        ramp.color_ramp.elements[1].color=tuple(c*1.24 for c in rgb)+(1,)
        tree.links.new(noise.outputs['Fac'],ramp.inputs[0])
        tree.links.new(ramp.outputs[0],bs.inputs['Base Color'])
        bump=tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=.2
        bump.inputs['Distance'].default_value=.045
        tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
        tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    return m
stone=pigment('Maçonnerie',(.53,.44,.32),True)
dressed=pigment('Pierres de taille',(.71,.62,.48),True)
brick=pigment('Brique',(.46,.235,.13),True)
base=pigment('Sol',(.53,.48,.38))
dark=pigment('Ombre des ouvertures',(.065,.055,.042))
desk=pigment('Table',(.026,.038,.037))
pieces=[]

def solid(name,v,f,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update()
    ob=bpy.data.objects.new(name,mesh);s.collection.objects.link(ob);ob.data.materials.append(mat)
    pieces.append(ob)
    return ob

def box(name,xyz,dims,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz)
    ob=bpy.context.object;ob.name=name;ob.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(m);pieces.append(ob)
    return ob

def front_prism(name,outline,front,back,m):
    pts=[(x,y,z) for y in [front,back] for x,z in outline];n=len(outline)
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces.extend((i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n))
    return solid(name,pts,faces,m)

def plan_prism(name,outline,height,m):
    n=len(outline)
    pts=[(x,y,z) for z in (0,height) for x,y in outline]
    return solid(name,pts,[tuple(reversed(range(n))),tuple(range(n,2*n))]+
        [(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],m)

sun_data=bpy.data.lights.new('Soleil','SUN')
sun=bpy.data.objects.new('Soleil',sun_data);s.collection.objects.link(sun)
sun.rotation_euler=Vector((1.3,1,-1.6)).to_track_quat('-Z','Y').to_euler()
sun_data.energy=2.7;sun_data.angle=math.radians(12)
cd=bpy.data.cameras.new('Étude');cam=bpy.data.objects.new('Étude',cd);s.collection.objects.link(cam)
s.camera=cam;cd.type='ORTHO'
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage=1152,864,100
box('Table',(0,0,-.9),(200,200,.5),desk)
pieces.clear()

def render(name,pos,focus,scale):
    cam.location=Vector(pos)
    cam.rotation_euler=(Vector(focus)-cam.location).to_track_quat('-Z','Y').to_euler()
    cd.ortho_scale=scale;s.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    for ob in pieces:ob.hide_render=True
    pieces.clear()

# A section through the gate: the open passage passes entirely through the wall.
box('Socle',(0,.8,-.27),(10.2,6.8,.55),base)
a,rise,spring=1.52,.91,3.05
def arch(angle,outer=0):
    return ((a+outer)*math.cos(angle), spring+(rise+outer)*math.sin(angle))
for side in [-1,1]:
    box('Mur du passage',(side*(a+(4.3-a)/2),1.18,3.3),(4.3-a,3.75,6.6),stone)
outline=[arch(math.pi*i/30) for i in range(31)]+[(-a,6.6),(a,6.6)]
front_prism('Voûte',outline,-.695,3.055,stone)
for i in range(11):
    lo,hi=math.pi*(i+.025)/11,math.pi*(i+.975)/11
    front_prism('Voussoir',[arch(lo),arch(hi),arch(hi,.42),arch(lo,.42)],-.83,-.67,dressed)
for side in [-1,1]:
    for j in range(6):
        box('Jambage',(side*(a+.21),-.75,(j+.5)*spring/6),(.42,.22,spring/6-.022),dressed)
    box('Console',(side*.86,-.91,5.14),(.38,.61,.65),dressed)
box('Ouvrage en saillie',(0,-.94,6.17),(2.17,.72,.88),brick)
front_prism('Arc de la saillie',[(-1.08,5.81),(-1.08,5.49),(-.72,5.63),(0,5.7),(.72,5.63),(1.08,5.49),(1.08,5.81)],-1.3,-.66,brick)
render('detail-porte',(6.1,-16,8.2),(0,.8,2.9),12.7)

# Only the courtyard-facing forms are studied; the rear of the bastion is cropped.
box('Sol de la cour',(0,0,-.27),(16.2,9.4,.55),base)
round_end=[(-6.9+2.0*math.cos(i*math.pi/18),1.6+1.55*math.sin(i*math.pi/18)) for i in range(10,28)]
plan_prism('Épaule arrondie',round_end+[(-3.3,-.1),(-3.3,3.9),(-6.4,3.9)],4.9,stone)
box('Terrasse',(-2,1.8,2.48),(4.2,4.3,4.96),stone)
box('Tour',(1.67,1.47,3.39),(3.15,3.95,6.78),stone)
box('Parapet de la tour',(1.67,3.2,6.97),(3.15,.47,.38),stone)
for x,length in [(.46,.72),(2.20,2.1)]:
    box('Couronnement',(x,-.32,6.99),(length,.4,.42),stone)
plan_prism('Retour de courtine',[(3.18,-.2),(5.45,-.43),(7.25,-.98),(7.25,3.05),(3.18,3.05)],2.8,stone)
for x,y,w,h in [(-.77,-.37,.78,1.65),(1.04,-.52,.75,1.65),(.59,-.52,.32,.56),(-1.15,-.37,.42,.50)]:
    z=h/2 if h>1 else 3.1
    box('Baie',(x,y,z),(w,.035,h),dark)
render('detail-bastion',(9,-19,10.2),(0,1,2.7),20.4)
