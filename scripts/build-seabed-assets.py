"""Author the portfolio's wreck and carved masonry in Blender; no external assets.
Run: blender --background --factory-startup --python scripts/build-seabed-assets.py
"""
import bpy, math, random, os, json
import numpy as np
from mathutils import Vector
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public'/'models'
SOURCE=ROOT/'design'/'seabed'
OUT.mkdir(parents=True,exist_ok=True); SOURCE.mkdir(parents=True,exist_ok=True)
random.seed(1776)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def noise(w,h,seed):
    rng=np.random.default_rng(seed); result=np.zeros((h,w),np.float32)
    for cells,weight in [(4,.48),(12,.25),(40,.16),(130,.08),(350,.03)]:
        grid=rng.random((cells+1,cells+1)); xs=np.linspace(0,cells,w,endpoint=False); ys=np.linspace(0,cells,h,endpoint=False)
        xi=xs.astype(int);yi=ys.astype(int); fx=xs-xi;fy=ys-yi;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
        a=grid[yi[:,None],xi[None,:]]*(1-fx)+grid[yi[:,None],xi[None,:]+1]*fx
        b=grid[yi[:,None]+1,xi[None,:]]*(1-fx)+grid[yi[:,None]+1,xi[None,:]+1]*fx
        result+=(a*(1-fy[:,None])+b*fy[:,None])*weight
    return result

def texture(name,pixels,noncolor=False):
    h,w=pixels.shape[:2]; image=bpy.data.images.new(name,width=w,height=h,alpha=False)
    if noncolor:image.colorspace_settings.name='Non-Color'
    rgba=np.ones((h,w,4),np.float32); rgba[:,:,:3]=pixels
    image.pixels.foreach_set(rgba.ravel()); image.filepath_raw=str(SOURCE/(name+'.png'));image.file_format='PNG'
    image.save();image.pack();return image

def surface(name,color,kind):
    size=1024;n=noise(size,size,123 if kind=='wood' else 647)
    yy,xx=np.mgrid[0:size,0:size]/size
    if kind=='wood':
        grain=np.sin(yy*630+np.sin(xx*17+yy*9)*2+n*5)*.5+.5
        fine=np.sin(yy*2300+n*8)*.5+.5
        cracks=np.maximum(0,np.sin(yy*133+np.sin(xx*6)*1.1)-.965)*15
        relief=n*.15+grain*.035+fine*.012-cracks*.12
        value=np.clip(.48+n*.65+grain*.13-cracks*.2, .2,1.25)
        rgb=value[:,:,None]*np.array(color)
        algae=np.clip((n-.51)*4,0,.55)*(1-xx*.5)
        rgb=rgb*(1-algae[:,:,None])+np.array([.15,.22,.14])*algae[:,:,None]
    elif kind=='stone':
        # Quiet mineral grain: erosion belongs in the silhouette, not large,
        # high-contrast stains repeated over every piece of masonry.
        rng=np.random.default_rng(977)
        grain=rng.random((size,size)).astype(np.float32)
        pits=np.maximum(0,grain-.965)*.18
        relief=n*.025+(grain-.5)*.0015-pits
        value=.88+n*.16+(grain-.5)*.018
        rgb=value[:,:,None]*np.array(color)
        algae=np.clip((noise(size,size,989)-.66)*1.4,0,.12)
        rgb=rgb*(1-algae[:,:,None])+np.array([.30,.35,.29])*algae[:,:,None]
    else:
        weave=(np.sin(xx*1800)+np.sin(yy*1800))*.01
        relief=n*.06+weave;rgb=(.62+n*.55)[:,:,None]*np.array(color)
    dx=(np.roll(relief,-1,axis=1)-np.roll(relief,1,axis=1))*22
    dy=(np.roll(relief,-1,axis=0)-np.roll(relief,1,axis=0))*22
    normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    base=texture(name+'-color',np.clip(rgb,0,1));norm=texture(name+'-normal',normal*.5+.5,True)
    rough=texture(name+'-roughness',np.repeat(np.clip(.68+n*.22,0,1)[:,:,None],3,axis=2),True)
    m=bpy.data.materials.new(name);m.use_nodes=True;nodes=m.node_tree.nodes;links=m.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    for image,input in [(base,'Base Color'),(rough,'Roughness')]:
        t=nodes.new('ShaderNodeTexImage');t.image=image;links.new(t.outputs['Color'],bsdf.inputs[input])
    t=nodes.new('ShaderNodeTexImage');t.image=norm;normalnode=nodes.new('ShaderNodeNormalMap');normalnode.inputs['Strength'].default_value=.55
    links.new(t.outputs['Color'],normalnode.inputs['Color']);links.new(normalnode.outputs['Normal'],bsdf.inputs['Normal'])
    return m

def plain(name,color,metal=0,rough=.8):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

MATS={
 'timber':surface('Waterlogged oak',(.38,.27,.17),'wood'),
 'trim':surface('Carved stern teak',(.49,.36,.20),'wood'),
 'stone':surface('Eroded limestone',(.53,.57,.51),'stone'),
 'cloth':surface('Salt worn sailcloth',(.48,.50,.39),'cloth'),
 'iron':plain('Oxidised iron',(.095,.12,.105),.55),
 'rope':plain('Tarred hemp',(.21,.20,.135)),
 'dark':plain('Dark cabin interior',(.012,.031,.025)),
 'growth':plain('Barnacle limestone',(.48,.51,.39)),
}

class Batch:
    def __init__(self):self.data={}
    def add(self,kind,verts,faces,uv=None):
        d=self.data.setdefault(kind,[[],[],[]]);start=len(d[0]);d[0].extend(verts)
        # Stable fractional offsets and rotation per stone, with world-unit
        # texel density. A full 0..1 square on every face stretched the same
        # stain onto blocks of completely different sizes.
        if kind=='stone' and uv is None:
            center=np.mean(verts,axis=0); phase=float(np.dot(center,[7.31,3.17,11.93]))
            angle=math.sin(phase)*math.pi; ca,sa=math.cos(angle),math.sin(angle)
            scale=.19+.045*math.sin(phase*1.37);uv=[]
            for f in faces:
                normal=(Vector(verts[f[1]])-Vector(verts[f[0]])).cross(Vector(verts[f[2]])-Vector(verts[f[0]]))
                axes=[k for k in range(3) if k!=max(range(3),key=lambda k:abs(normal[k]))]
                coords=[]
                for j in f:
                    a,b=verts[j][axes[0]]*scale,verts[j][axes[1]]*scale
                    coords.append((a*ca-b*sa+math.sin(phase)*8.7,a*sa+b*ca+math.cos(phase)*6.3))
                uv.append(coords)
        for i,f in enumerate(faces):
            d[1].append(tuple(start+j for j in f))
            d[2].append(uv[i] if uv else [(verts[j][0]*.3,verts[j][2]*.3+verts[j][1]*.3) for j in f])
    def box(self,at,size,kind='timber',rz=0,ry=0):
        x,y,z=at;a,b,c=[v/2 for v in size];vs=[]
        for px,py,pz in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]:
            px,pz=px*math.cos(ry)+pz*math.sin(ry),-px*math.sin(ry)+pz*math.cos(ry)
            vs.append((x+px*math.cos(rz)-py*math.sin(rz),y+px*math.sin(rz)+py*math.cos(rz),z+pz))
        fs=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
        self.add(kind,vs,fs,None if kind=='stone' else [[(0,0),(1,0),(1,1),(0,1)]]*6)
    def beam(self,a,b,r,kind='timber',r2=None,sides=10):
        r=float(r); r2=float(r2) if r2 is not None else r
        a=Vector(a);b=Vector(b);direction=(b-a).normalized();u=direction.cross(Vector((0,0,1)))
        if u.length<.01:u=direction.cross(Vector((0,1,0)))
        u.normalize();v=direction.cross(u);vs=[];r2=r if r2 is None else r2
        for center,rad in [(a,r),(b,r2)]:
            vs.extend([tuple(center+rad*(u*math.cos(i*2*math.pi/sides)+v*math.sin(i*2*math.pi/sides))) for i in range(sides)])
        faces=[];uv=[]
        for i in range(sides):
            j=(i+1)%sides;faces.append((i,j,j+sides,i+sides));uv.append([(0,i/sides),(0,(i+1)/sides),(1,(i+1)/sides),(1,i/sides)])
        faces.extend([tuple(reversed(range(sides))),tuple(range(sides,2*sides))]);uv.extend([[(vs[j][0],vs[j][1]) for j in f] for f in faces[-2:]])
        if kind=='stone':
            phase=float(a.x*3.17+a.y*7.39+a.z*1.73)
            uv=[[(u*(b-a).length*.22+math.sin(phase)*4.3,v*2*math.pi*r*.22+math.cos(phase)*6.7) for u,v in coords] for coords in uv]
        self.add(kind,vs,faces,uv)
    def cable(self,a,b,sag=.2,r=.025,kind='rope',steps=12):
        a=Vector(a);b=Vector(b)
        pts=[a.lerp(b,i/steps)+Vector((0,0,-sag*math.sin(math.pi*i/steps))) for i in range(steps+1)]
        for i in range(steps):self.beam(pts[i],pts[i+1],r,kind,sides=5)
    def finish(self,name,bevel=False):
        objects=[]
        for kind,(vs,faces,uvs) in self.data.items():
            mesh=bpy.data.meshes.new(name+' '+kind);mesh.from_pydata(vs,[],faces);mesh.update()
            uv=mesh.uv_layers.new(name='Material UV')
            for poly,coords in zip(mesh.polygons,uvs):
                for loop,co in zip(poly.loop_indices,coords):uv.data[loop].uv=co
            obj=bpy.data.objects.new(name+' '+kind,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(MATS[kind]);objects.append(obj)
            if bevel and kind in ['timber','trim','stone']:
                bpy.context.view_layer.objects.active=obj;obj.select_set(True)
                mod=obj.modifiers.new('Worn solid edges','BEVEL');mod.width=.018 if kind!='stone' else .05;mod.segments=1;mod.limit_method='ANGLE'
                bpy.ops.object.modifier_apply(modifier=mod.name)
                mod=obj.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
                bpy.ops.object.modifier_apply(modifier=mod.name);obj.select_set(False)
        return objects

ship=Batch()
def breadth(x):return 4.15*max(.025,math.sin(math.pi*(x+16.7)/34))**.57
def sheer(x):return .25+1.4*(abs(x)/16)**3
def hull(x,a,s):return (x,s*breadth(x)*math.sin(a),sheer(x)+4.9*(1-math.cos(a)))

# Solid individually curved strakes, splintered breach, open cannon ports.
for side in [-1,1]:
 for course in range(17):
  a=.09+course*.088;b=a+.080
  for section in range(16):
   x0=-16+section*2;x1=x0+1.975
   breach=side==-1 and 5<course<15 and -6.5+(course%3)*.65<x0<-.5-(course%2)*.5
   port=course in [13,14] and x0 in [2,6,10]
   if breach or port:continue
   points=[]
   for j in range(5):
    x=x0+(x1-x0)*j/4
    if side==-1 and 6<course<14 and (x0 in [-8,0]) and j in [0,4]:x+=(random.random()-.5)*.4
    for angle in [a,b]:
     p=hull(x,angle,side);points.append(p)
   vs=points+[(x,y*.976,z+.015) for x,y,z in points];fs=[]
   for j in range(4):
    n=j*2;fs.extend([(n,n+2,n+3,n+1),(n+10,n+11,n+13,n+12),(n,n+10,n+12,n+2),(n+1,n+3,n+13,n+11)])
   fs.extend([(0,1,11,10),(8,18,19,9)]);ship.add('timber',vs,fs)
   if course%3==0:
    for x in [x0+.13,x1-.13]:
     p=hull(x,(a+b)/2,side);ship.beam((p[0],p[1]-.022,p[2]),(p[0],p[1]+.022,p[2]),.035,'iron',sides=6)
 # Continuous heavy wale bands and upper rail.
 for a in [.55,1.00,1.47]:
  for j in range(64):ship.beam(hull(-16+j*.5,a,side),hull(-15.5+j*.5,a,side),.11,'trim',sides=8)

# Transverse frames and inner stringers visible through the breached hull.
for x in np.arange(-14.8,15,1.05):
 for side in [-1,1]:
  for j in range(12):
   a=.1+j*.12;b=a+.12;pa=hull(float(x),a,side);pb=hull(float(x),b,side)
   ship.beam((pa[0],pa[1]*.94,pa[2]),(pb[0],pb[1]*.94,pb[2]),.12,sides=8)
ship.beam((-16,0,.2),(15,0,.2),.27,sides=12)
for y in np.arange(-3.8,3.9,.31):
 for x in np.arange(-14,15,2.1):
  if abs(y)>breadth(x)*.94 or (-6<x<0 and y<.6) or random.random()<.07:continue
  ship.box((x+.95,y,4.8+sheer(x)),(2.03,.285,.16))
for x in np.arange(-13,15,2):ship.box((x,0,4.5+sheer(x)),(.20,breadth(x)*1.8,.26))

# Raised quarterdeck, stern galleries and framed cabin windows.
for row in range(9):
 for side in [-1,1]:ship.box((12,side*2.8,5+row*.26),(6,.18,.245),'trim')
for y in np.arange(-2.85,2.9,.29):ship.box((12,y,7.35),(6.3,.265,.16),'trim')
for x in [9,15]:
 for row in range(9):ship.box((x,0,5.0+row*.26),(.18,5.7,.245),'trim')
for y in [-2.1,-1.05,0,1.05,2.1]:
 ship.box((15.13,y,6.2),(.07,.79,1.1),'dark')
 for dy in [-.44,.44]:ship.box((15.2,y+dy,6.2),(.14,.09,1.34),'trim')
 for z in [5.57,6.2,6.85]:ship.box((15.2,y,z),(.16,.96,.08),'trim')
 ship.box((15.22,y,6.2),(.16,.07,1.3),'trim')
for side in [-1,1]:
 for x in np.arange(9,15.3,.37):
  ship.beam((x,side*2.95,7.4),(x,side*2.95,8.25),.045,'trim',sides=8)
  ship.beam((x,side*2.95,7.65),(x,side*2.95,7.95),.07,'trim',sides=8)
 ship.beam((8.9,side*2.95,8.28),(15.4,side*2.95,8.28),.08,'trim',sides=10)
 # Upper bulwarks have broken sections and paired stanchions.
 for x in np.arange(-13,9,.6):
  if side==-1 and -6<x<0:continue
  p=hull(x,1.5,side);ship.beam(p,(p[0],p[1],p[2]+.6),.055,'trim',sides=6)
 for x in [2.8,6.8,10.8]:
  y=side*(breadth(x)*.92)
  ship.beam((x,y-side*.85,4.95),(x,y+side*.45,4.95),.16,'iron',r2=.21,sides=14)
  ship.box((x,y-side*.75,4.63),(.8,.95,.20))
  for dx in [-.3,.3]:
   for dy in [-.34,.34]:ship.beam((x+dx,y-side*.75+dy-.08,4.45),(x+dx,y-side*.75+dy+.08,4.45),.19,'timber',sides=12)
# Deck fittings: gratings, companionway stairs, capstan and cargo barrels.
for x0,y0 in [(4,0),(-10,0)]:
 for i in range(9):ship.box((x0-.75+i*.19,y0,5.15),(.065,1.8,.10),'trim')
 for i in range(10):ship.box((x0,y0-.85+i*.19,5.2),(1.6,.06,.06),'trim')
for i in range(9):ship.box((7.2+i*.22,-1.1,5+i*.27),(.35,1.05,.12),'trim')
ship.beam((4,1.8,5),(4,1.8,6),.27,'trim',r2=.33,sides=16)
for i in range(6):
 a=i*math.pi/3;ship.beam((4,1.8,5.85),(4+math.cos(a),1.8+math.sin(a),5.85),.055,'trim')
for x,y in [(11,-1),(13,1),(-11,1.5)]:
 for j in range(12):
  a=j*math.pi/6;ship.beam((x+.31*math.cos(a),y+.31*math.sin(a),5.2),(x+.31*math.cos(a),y+.31*math.sin(a),6),.065)
 for z in [5.3,5.8]:
  for j in range(16):
   a=j*math.pi/8;b=(j+1)*math.pi/8;ship.beam((x+.37*math.cos(a),y+.37*math.sin(a),z),(x+.37*math.cos(b),y+.37*math.sin(b),z),.025,'iron',sides=5)

# Tapered, banded masts, yards, crow's nest, shrouds, ratlines and hanging canvas.
for mi,(x,h,width) in enumerate([(-8,15.5,4.5),(1,21,5.7),(10,16.5,3.5)]):
 tip=(x+.65,0,h)
 ship.beam((x,0,2),tip,.32,r2=.10,sides=16)
 for z in np.arange(6,h,1.5):ship.beam((x+(z/h)*.65,0,z),(x+(z/h)*.65,0,z+.065),.34*(1-z/h)+.14,'iron',sides=12)
 for level,span in [(h*.72,width),(h*.9,width*.66)]:
  ship.beam((x+.4,-span,level),(x+.4,span,level+.15),.115,r2=.085,sides=12)
  # Mesh-cut tears, missing panels and irregular lower edges; visible thickness.
  vs=[];fs=[];nx=28;nz=14
  for row in range(nz+1):
   v=row/nz
   for col in range(nx+1):
    u=col/nx; yy=(u-.5)*span*2
    zz=level-v*(2.2+(math.sin(u*17+mi)+1)*.5)
    xx=x+.42+math.sin(u*math.pi)*math.sin(v*math.pi)*.85+math.sin(yy*2+v*3)*.07
    vs.append((xx,yy,zz))
  for row in range(nz):
   for col in range(nx):
    u=col/nx;v=row/nz
    if (u-.57)**2/.055+(v-.58)**2/.10<1 or (row>9 and (col%7<2)) or (mi==0 and .1<u<.32 and v>.25):continue
    a=row*(nx+1)+col;fs.append((a,a+1,a+nx+2,a+nx+1))
  ship.add('cloth',vs,fs,[[(vs[j][1]/(span*2)+.5,(level-vs[j][2])/3) for j in f] for f in fs])
  for side in [-1,1]:ship.cable((x+.4,side*span,level),(x-2.5,side*3,5.5),.5,.025)
 for side in [-1,1]:
  for k in range(4):
   base=(x-1.6+k*.9,side*3.6,5.3);top=(x+.5,side*.22,h*.75)
   ship.cable(base,top,.12,.033)
   if k<3:
    other=(x-1.6+(k+1)*.9,side*3.6,5.3)
    for j in range(1,24):
     t=j/27;a=Vector(base).lerp(Vector(top),t);b=Vector(other).lerp(Vector(top),t);ship.cable(a,b,.025,.016,steps=1)
 for target in [(-17,0,6),(14,0,7.4)]:ship.cable(tip,target,.65,.035)
 # Crow's nest platform and ring.
 z=h*.68;ship.beam((x+.4,0,z-.12),(x+.4,0,z),.65,'trim',sides=16)
 for j in range(12):
  a=j*math.pi/6;b=(j+1)*math.pi/6
  p=(x+.4+.68*math.cos(a),.68*math.sin(a),z)
  ship.beam(p,(p[0],p[1],z+.7),.025,'trim',sides=5)
  ship.beam((p[0],p[1],z+.7),(x+.4+.68*math.cos(b),.68*math.sin(b),z+.7),.03,'trim',sides=5)
ship.beam((-13,0,4.8),(-22,0,9),.26,r2=.07,sides=12)
ship.cable((-22,0,9),(-16,0,1),.2,.055)
# Fallen beams and small barnacle colonies on the lower hull.
for i in range(30):
 ship.box((random.uniform(-10,13),random.uniform(-6,-4),.3),(random.uniform(.5,3),.2,.16),rz=random.uniform(-1,1))
for i in range(260):
 x=random.uniform(-15,14);a=random.uniform(.25,1.3);p=hull(x,a,-1)
 r=random.uniform(.025,.075);ship.beam(p,(p[0],p[1]-.04,p[2]+.04),r,'growth',r2=r*.55,sides=5)
ship_objects=ship.finish('Galleon',True)
for obj in ship_objects:
 obj.scale=(.78,.78,.78)
 bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.select_set(False)

def sand(x,z):
 def mound(cx,cz,sx,sz):return math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2))
 channel=x-(2.8*math.sin(z*.085)+1.2*math.sin(z*.19))
 value=-25.5+math.sin(z*.24+x*.1+math.sin(x*.13)*1.2)*.55+math.sin(z*.48-x*.18)*.17
 value+=3.6*mound(-15,-14,10,15)+4.3*mound(19,-30,12,18)+2.5*mound(-25,-58,18,13)+2.1*mound(13,5,7,11)-1.5*math.exp(-(channel/3.9)**2)
 berth=math.exp(-((x/15)**4+((z+42)/8)**4))*.94
 return value*(1-berth)-25.7*berth

ruin=Batch()
def stonebox(x,z,h,size,rz=0):ruin.box((x,-z,h),size,'stone',rz)
column_designs=[]

def column(x,z,h,r,lean,style,seed):
 """Individual ruins: irregular fracture rings, lost wedges, shifted courses.
 Heights and UV offsets are authored independently for every column.
 """
 rng=random.Random(seed);y=sand(x,z)-.2;phase=rng.uniform(0,math.tau)
 flutes=rng.choice([0,12,16,20,24]);drums=math.ceil(h/rng.uniform(1.7,2.6))
 broken=style not in ['scroll-remnant','plain-capital','split-capital']
 tilt=rng.uniform(-.055,.055);fracture=rng.uniform(.65,1.2)*r
 column_designs.append(dict(seed=seed,style=style,height=h,flutes=flutes,drums=drums,x=x,z=z))
 # Missing corners and offset foundation courses; no identical square stacks.
 for k,(dy,w,t) in enumerate([(.27,3.1,.54),(.69,2.65,.27),(.95,2.3,.22)]):
  for side in [-1,1]:
   size=r*w/2;shift=rng.uniform(-.09,.09)
   ruin.box((x+side*size*.5+shift,-z+shift,y+dy),(size-.035,r*w-rng.uniform(0,.22),t),'stone',rz=rng.uniform(-.055,.055))
 # Unequal course heights and angular alignment keep the stacked masonry real.
 weights=[rng.uniform(.78,1.24) for _ in range(drums)];bounds=[1.12]
 for weight in weights:bounds.append(bounds[-1]+h*weight/sum(weights))
 uoff,voff=rng.random()*7,rng.random()*9;texscale=rng.uniform(.18,.24)
 fracture_steps=[rng.uniform(-.3,.3) for _ in range(9)]
 sides=64
 for d in range(drums):
  lo=bounds[d];hi=bounds[d+1]-.027;last=d==drums-1
  rotation=phase+rng.uniform(-.08,.08);vs=[];uvs=[];fs=[]
  stagger=(.22*r if style in ['slipped-drums','split-capital'] and d>drums*.64 else 0)
  for level in range(4):
   t=level/3;zz=lo+(hi-lo)*t
   for j in range(sides):
    a=j*math.tau/sides;az=a+rotation
    radius=r*(1-.15*zz/(h+1.12))
    flute=.043*(.5+.5*math.cos(a*flutes)) if flutes else .012*math.sin(a*7+zz)
    radius*=1-flute+.013*math.sin(a*9+phase+zz*.7)
    # One weathered scar per shaft, tapered in height, not repeated each drum.
    scar=max(0,math.cos(az-phase*.6)-.69)/.31
    scar*=math.exp(-((zz/h-.72)/.20)**2)
    radius-=r*scar*(.36 if style in ['hollow-shell','split-capital','diagonal-scar'] else .13)
    top=0
    if last and broken:
     segment=(j/sides*9);step=int(segment);blend=segment-step
     chipped=fracture_steps[step]*(1-blend)+fracture_steps[(step+1)%9]*blend
     top=fracture*(.72*math.sin(az+phase)+chipped)
     if style=='hollow-shell':top+=r*.6*math.cos(az*2+phase)
     if style=='stepped-break':top+=r*.35*(1 if math.sin(az+phase)>.25 else -1)
     top*=t*t
    vs.append((x-lean*zz+stagger+radius*math.cos(az),-z+tilt*zz+radius*math.sin(az),y+zz+top))
  # Explicit cylindrical UVs follow stone circumference and true height.
  # Fractional per-drum offsets prevent repeated vertical stain stripes.
  for level in range(3):
   for j in range(sides):
    jj=(j+1)%sides;f=(level*sides+j,level*sides+jj,(level+1)*sides+jj,(level+1)*sides+j);fs.append(f)
    coords=[]
    for index,u in zip(f,[j,j+1,j+1,j]):coords.append((u/sides*math.tau*r*texscale+uoff+d*.371,(vs[index][2]-y)*texscale+voff+d*.619))
    uvs.append(coords)
  fs.append(tuple(reversed(range(sides))));uvs.append([(vs[j][0]*texscale+uoff,vs[j][1]*texscale+voff) for j in fs[-1]])
  # Triangulated, recessed fracture core. It remains solid at oblique angles.
  center=len(vs);rim=vs[-sides:]
  vs.append((sum(p[0] for p in rim)/sides,sum(p[1] for p in rim)/sides,sum(p[2] for p in rim)/sides-(.22*r if broken and last else 0)))
  for j in range(sides):
   f=(3*sides+j,3*sides+(j+1)%sides,center);fs.append(f)
   uvs.append([(vs[k][0]*texscale+uoff,vs[k][1]*texscale+voff) for k in f])
  ruin.add('stone',vs,fs,uvs)
 if not broken:
  cx=x-lean*(h+1.12)+(r*.22 if style=='split-capital' else 0);cy=-z+tilt*(h+1.12)
  # Fragmented collar sectors leave real gaps, distinct from painted damage.
  missing={'scroll-remnant':{2,3,4},'plain-capital':{6},'split-capital':{0,1,2,7}}[style]
  for k in range(8):
   if k in missing:continue
   a=k*math.tau/8+phase
   ruin.box((cx+math.cos(a)*r*.81,cy+math.sin(a)*r*.81,y+h+1.40),(r*.78,r*.82,.46),'stone',rz=a)
  for side in [-1,1]:
   if side==1 and style=='split-capital':continue
   ruin.box((cx+side*r*.65,cy,y+h+1.88),(r*1.28,r*2.55,.35),'stone',rz=phase*.035+side*.035,ry=side*.025)
  if style=='scroll-remnant':
   for j in range(23):
    a=j*.24;b=(j+1)*.24;ra=.36*(1-j/32);rb=.36*(1-(j+1)/32)
    ruin.beam((cx-r*.85+ra*math.cos(a),cy-r*1.1,y+h+1.64+ra*math.sin(a)),(cx-r*.85+rb*math.cos(b),cy-r*1.1,y+h+1.64+rb*math.sin(b)),.065,'stone',sides=6)
 # Displaced fragments sit outside the sightline to the wreck.
 if seed%3!=0:
  fx=x+(-1 if x<0 else 1)*r*2.3;fz=z+rng.uniform(-2.5,2.5);fy=sand(fx,fz)
  direction=Vector((math.cos(phase),math.sin(phase),rng.uniform(-.12,.12)))
  a=Vector((fx,-fz,fy+r*.65));b=a+direction*r*rng.uniform(1.5,2.6)
  ruin.beam(a,b,r*.65,'stone',r2=r*.53,sides=20)
  for j in range(3):
   px=fx+rng.uniform(-2,2);pz=fz+rng.uniform(-2,2)
   ruin.box((px,-pz,sand(px,pz)+.2),(rng.uniform(.4,1.1),rng.uniform(.3,.9),rng.uniform(.25,.6)),'stone',rz=rng.random()*math.tau,ry=rng.uniform(-.4,.4))

landmarks=[
 (-11,-7,9.4,1.65,.055,'diagonal-scar',101),
 (12,-13,7.8,1.5,-.09,'hollow-shell',202),
 (-19,-28,25,1.5,-.025,'scroll-remnant',303),
 (20,-32,20.5,1.65,.14,'stepped-break',404),
 (-28,-55,27,1.85,.065,'slipped-drums',505),
 (8,-80,37,2,.02,'plain-capital',606),
 (-15,-87,20,1.6,-.11,'diagonal-scar',707),
 (34,-77,35,2.1,.035,'split-capital',808),
 (-39,-98,40,2.3,.03,'jagged-crown',909)]
for args in landmarks:column(*args)
tx,tz=27,-58;base=sand(tx,tz)
for i in range(5):
 for j in range(10):stonebox(tx+(j-4.5)*(2-i*.065),tz+i*.42,base+i*.55,(1.97-i*.065,14-i*.5,.53))
for k,(x,z,h,style) in enumerate([(20,-62,18,'plain-capital'),(20,-54,11.2,'stepped-break'),(27,-62,18,'scroll-remnant'),(27,-54,14.6,'hollow-shell'),(34,-62,18,'split-capital'),(34,-54,17.4,'diagonal-scar')]):
 column(x,z,h,1.45,.018+k*.004,style,1101+k*113)
for i in range(4):
 for j in range(8):stonebox(tx+(j-3.5)*2.6,tz,base+21.5+i*.4,(2.57,14+i*.3,.36))
for row in range(5):
 for j in range(9-row*2):stonebox(tx+(j-(8-row*2)/2)*2.3,tz+7,base+23+row*.7,(2.27,1.3,.67),random.uniform(-.01,.01))
for j in range(34):stonebox(17+j*.60,tz+7.2,base+22.3,(.28,.4,.32))
ax,az=-29,-49;ay=sand(ax,az)
for k,dx in enumerate([-5,5]):column(ax+dx,az,12 if k==0 else 10.8,1.25,.02,'plain-capital' if k==0 else 'jagged-crown',2101+k*137)
for j in range(16):
 if j in [4,5,6]:continue
 a=j/15*math.pi;ruin.box((ax+5*math.cos(a),-az,ay+14+5*math.sin(a)),(1.05,2.6,1.75),'stone',ry=math.pi/2-a)
for i in range(125):
 z=5-random.random()*85;x=random.choice([-1,1])*(7+random.random()*30);s=.35+random.random()**2*1.5
 stonebox(x,z,sand(x,z)+s*.25,(s*1.6,s,s*.7),random.random()*math.pi)
ruin_objects=ruin.finish('Ruins',True)

def export(objects,filename):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,export_apply=True,export_image_format='AUTO',export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
 return sum(len(o.data.polygons) for o in objects)

stats={'shipFaces':export(ship_objects,'shipwreck-detail.glb'),'ruinFaces':export(ruin_objects,'ruins-detail.glb'),'columns':column_designs}
# Save the editable Blender asset scene, separated into collections.
for name,objects in [('GALLEON — detailed wreck',ship_objects),('RUINS — carved limestone',ruin_objects)]:
 collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
 for o in objects:
  for c in list(o.users_collection):c.objects.unlink(o)
  collection.objects.link(o)
for o in ruin_objects:o.hide_render=True;o.hide_set(True)

# A studio camera makes the model's actual topology and materials reviewable.
bpy.ops.object.camera_add(location=(-24,-34,21));camera=bpy.context.object;camera.name='Wreck detail review'
camera.rotation_euler=(Vector((0,0,6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=35;bpy.context.scene.camera=camera
for name,at,power,size in [('Soft key',(-12,-16,24),2300,15),('Stern rim',(12,10,20),3000,12),('Front fill',(3,-20,10),1200,10)]:
 bpy.ops.object.light_add(type='AREA',location=at);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,5))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.16,.16,.16);scene.render.resolution_x=1500;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'artifacts'/'blender-wreck-review.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'McLary-seabed.blend'))
(SOURCE/'asset-stats.json').write_text(json.dumps(stats,indent=2))
print('ASSETS_READY',json.dumps(stats),flush=True)
bpy.ops.render.render(write_still=True)
