import bpy, math, random, struct, json, zipfile, base64
from mathutils import Vector,noise
from pathlib import Path
from math import sin,cos,exp,pi
from array import array
r=random.Random(496)
scene=bpy.data.scenes.new('Earth | Wind meadow'); bpy.context.window.scene=scene
def noise2(x,y):
 return noise.noise_vector(Vector((x,y,0.374))).x
def terrain(x,y):
 return .65*sin(x*.09+y*.044)+.32*cos(y*.20-x*.06)+.58*noise2(x*.075,y*.075)+max(0,y-8)*.13*(1+.67*sin(x*.135+y*.11))
def material(name):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.use_backface_culling=False
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=1
 col=m.node_tree.nodes.new('ShaderNodeVertexColor');col.layer_name='paint';m.node_tree.links.new(col.outputs['Color'],bs.inputs['Base Color']);return m
def create(name,points,faces,colors,weights=None):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],faces);mesh.update()
 attr=mesh.color_attributes.new(name='paint',type='BYTE_COLOR',domain='POINT')
 attr.data.foreach_set('color',array('f',(v for rgb in colors for v in (*rgb,1))))
 if weights:
  uv=mesh.uv_layers.new(name='BladeHeight')
  uv.data.foreach_set('uv',array('f',(v for l in mesh.loops for v in (weights[l.vertex_index],.5))))
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);mesh.materials.append(material(name))
 return obj
vs=[];fs=[];cols=[]
for j in range(55):
 for i in range(87):
  x=i-43+r.uniform(-.19,.19);y=j-18+r.uniform(-.19,.19);z=terrain(x,y)
  vs.append((x,y,z));k=noise2(x*.15,y*.15);cols.append((.17+.048*k,.24+.044*k,.065+.018*k))
  if j and i:
   q=len(vs)-1;fs.extend([(q-88,q-87,q),(q-88,q,q-1)])
ground=create('TallMeadowGround',vs,fs,cols)
# A shared blade silhouette for GPU instancing; units in metres.
blade=create('BladeTemplate',[(-.012,0,0),(.012,0,0),(-.007,.045,.57),(.007,.045,.57),(.002,.10,1)],[(0,1,2),(1,3,2),(2,3,4)],[(.08,.14,.028),(.08,.14,.028),(.27,.39,.09),(.27,.39,.09),(.52,.58,.17)],[0,0,.57,.57,1])
d=Path(__file__).resolve().parent if '__file__' in globals() else Path(bpy.path.abspath('//'))/'earth_grassland'
d.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(d/'earth.glb'),use_active_scene=True,export_yup=True,export_vertex_color='ACTIVE',export_normals=False)
