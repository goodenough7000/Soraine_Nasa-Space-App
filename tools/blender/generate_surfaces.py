import bpy, math, random, struct, json, zipfile
from mathutils import Vector, noise
from pathlib import Path
from math import sin,cos,exp,sqrt,pi
d = Path(__file__).resolve().parent if '__file__' in globals() else Path(bpy.path.abspath('//')) / 'planet_surfaces'
d.mkdir(parents=True, exist_ok=True)
s=bpy.data.scenes.new('Planet surfaces');bpy.context.window.scene=s
def n(x,y,f):
 return noise.noise_vector(Vector((x*f,y*f,2.743)),noise_basis='PERLIN_ORIGINAL').x
def smooth(t):
 t=min(1,max(t,0));return t*t*(3-2*t)
for kind,seed in [('moon',401),('mars',702)]:
 rng=random.Random(seed);moon=kind=='moon'; vs=[]; faces=[];colors=[]
 cr=[(-6,0,4.9),(4,8,3),(10,-1,2.2),(-12,9,2),(.8,-5,1.4),(-10,-7,2.3)]
 for i in range(77):cr.append((rng.uniform(-32,32),rng.uniform(-15,24),rng.uniform(.58,2.35)))
 mesas=[(-13,8,8,4,3.8),(5,12,7,3.4,4.5),(14,5,3,2,2.6),(-3,17,5,2,3.4),(-1,1,2.7,1.2,.9)]
 def height(x,y):
  low=n(x,y,.081); fine=n(x,y,.34); h=.72*low+.12*fine
  hills=exp(-((y-17)/4.8)**2)*(1.25+1.9*n(x,y,.105))
  if moon:
   for a,b,r in cr:
    t=((x-a)**2+(y-b)**2)/r**2
    if t<2.56:
     t=sqrt(t)*(1+.055*fine);h+=r*(-.31*max(0,1-t*t)**1.55+.128*exp(-((t-.99)/.18)**2))
   return h+hills
  phase=1.43*(y+.24*x)+2.2*low+.57*sin(x*.43)
  h+=.20*(.5+.5*cos(phase))**2.7*(.8+.4*fine)
  for a,b,rx,ry,H in mesas:
   t=sqrt(((x-a)/rx)**2+((y-b)/ry)**2)+.13*low+.07*fine
   h+=H*(.23*smooth((1.45-t)/.55)+.29*smooth((1.04-t)/.21)+.34*smooth((.89-t)/.17)+.14*smooth((.72-t)/.16))
  return h+.65*hills
 def face(tri,c):faces.append(tri);colors.append(c)
 nx,ny=161,101
 for j in range(ny):
  for i in range(nx):
   x=-32+.4*i+(rng.uniform(-.105,.105) if 0<i<nx-1 else 0); y=-15+.4*j+(rng.uniform(-.105,.105) if 0<j<ny-1 else 0);vs.append((x,y,height(x,y)))
 for j in range(ny-1):
  for i in range(nx-1):
   k=j*nx+i; x,y,z=vs[k]; tint=n(x,y,.21);v=1+.16*tint+.055*rng.uniform(-1,1)
   if moon:c=(.29*v,.28*v,.275*v)
   else:
    band=(.5+.5*sin(z*10+.3*n(x,y,.18)))**4
    c=(v*(.49+.13*band),v*(.185+.064*band),v*(.083+.036*band))
   for tri in ([(k,k+1,k+nx),(k+1,k+nx+1,k+nx)] if rng.random()<.5 else [(k,k+1,k+nx+1),(k,k+nx+1,k+nx)]):face(tri,c)
 for _ in range(370):
  x,y=rng.uniform(-31,31),rng.uniform(-14,23);z=height(x,y)-.07;r=.10+.62*rng.random()**3;start=len(vs);angle=rng.random()*pi;N=rng.randrange(5,8)
  for level in range(3):
   for k in range(N):
    a=angle+2*pi*k/N;rad=(.89,1,.59)[level]*r*rng.uniform(.85,1.12);vs.append((x+cos(a)*rad,y+sin(a)*rad*.76,z+r*(level*.42+rng.uniform(-.10,.10))))
  c=(.16,.155,.15) if moon else (.31,.099,.043)
  for j in range(2):
   for k in range(N):face((start+j*N+k,start+j*N+(k+1)%N,start+(j+1)*N+(k+1)%N,start+(j+1)*N+k),c)
  face(tuple(start+2*N+k for k in range(N)),c)
 mesh=bpy.data.meshes.new(kind);mesh.from_pydata(vs,[],faces);mesh.update();ob=bpy.data.objects.new(kind+' terrain',mesh);s.collection.objects.link(ob)
 attr=mesh.color_attributes.new(name='TerrainColor',type='BYTE_COLOR',domain='CORNER')
 from array import array
 vals=array('f')
 for poly,col in zip(mesh.polygons,colors):vals.extend((*col,1)*poly.loop_total)
 attr.data.foreach_set('color',vals)
 m=bpy.data.materials.new(kind+' regolith');m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=1
 vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='TerrainColor';m.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);mesh.materials.append(m)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 bpy.ops.export_scene.gltf(filepath=str(d/(kind+'.glb')),use_selection=True,use_active_scene=True,export_yup=True,export_vertex_color='ACTIVE',export_materials='EXPORT')
