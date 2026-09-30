"""Original McLary marine assets. Run with Blender --background --python this_file.

All design coordinates are Y-up; export converts Blender's Z-up coordinates back
to Y-up glTF. No downloaded models or textures are used.
"""
import bpy, bmesh, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def xyz(p): return (p[0], -p[2], p[1])
def mix(a,b,t): return tuple(x+(y-x)*t for x,y in zip(a,b))
def material(name, color, rough=.45, metal=0, vertex=False):
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*color,1); mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if vertex:
        col=mat.node_tree.nodes.new('ShaderNodeVertexColor'); col.layer_name='Color'
        mat.node_tree.links.new(col.outputs['Color'],bs.inputs['Base Color'])
    return mat

skin=material('Marine skin',(.16,.23,.25),.43,vertex=True)
dark=material('Eyes and creases',(.008,.015,.017),.25)
pale=material('Ivory underside',(.48,.53,.48),.55)
shellmat=material('Carapace olive bronze',(.20,.25,.12),.52,vertex=True)
shellline=material('Scute seams',(.065,.10,.048),.65)
navy=material('Deep petrol enamel',(.026,.115,.135),.23,.22)
cream=material('Warm ivory enamel',(.81,.79,.67),.34,.05)
wood=material('Oiled teak',(.34,.19,.085),.54)
woodlight=material('Teak end grain',(.46,.29,.14),.6)
metal=material('Brushed stainless',(.50,.56,.58),.27,.85)
glass=material('Smoked cabin glass',(.025,.085,.10),.14,.35)

def mesh(name, vertices, faces, mat, colors=None):
    data=bpy.data.meshes.new(name); data.from_pydata([xyz(p) for p in vertices],[],faces); data.update()
    bm=bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(data); bm.free()
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.data.materials.append(mat)
    for p in data.polygons: p.use_smooth=True
    if colors:
        attr=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(colors): attr.data[i].color=(*c,1)
    return obj

def smooth_profile(points,t):
    v=t*(len(points)-1); i=min(int(v),len(points)-2); f=v-i
    a,b,c,d=[points[max(0,min(len(points)-1,k))] for k in [i-1,i,i+1,i+2]]
    return tuple(.5*((2*b[j])+(-a[j]+c[j])*f+(2*a[j]-5*b[j]+4*c[j]-d[j])*f*f+(-a[j]+3*b[j]-3*c[j]+d[j])*f*f*f) for j in range(len(b)))

def section_at(profile,x):
    lo=0.;hi=1.
    for _ in range(24):
        t=(lo+hi)/2
        if smooth_profile(profile,t)[0]<x:lo=t
        else:hi=t
    return smooth_profile(profile,(lo+hi)/2)

def body(name, profile, top, bottom, mat=skin):
    vs=[]; fs=[]; cs=[]; rings=80; sides=48
    for i in range(rings+1):
        x,ry,rz,cy=smooth_profile(profile,i/rings)
        for j in range(sides):
            a=j*math.tau/sides; y=cy+max(.002,ry)*math.sin(a); z=max(.002,rz)*math.cos(a)
            vs.append((x,y,z))
            blend=max(0,min(1,(-math.sin(a)-.10)*2.2))
            c=mix(top,bottom,blend)
            detail=1+.09*math.sin(x*24+math.sin(a*19)*2)*math.sin(a*33+x*12)+.05*math.sin(x*8+a*5)
            cs.append(tuple(v*detail for v in c))
    for i in range(rings):
        for j in range(sides):
            k=i*sides+j; n=i*sides+(j+1)%sides; fs.append((k,n,n+sides,k+sides))
    fs.extend([tuple(range(sides-1,-1,-1)),tuple(rings*sides+j for j in range(sides))])
    return mesh(name,vs,fs,mat,cs)

def fin(name, controls, top, bottom, vertical=False):
    vs=[]; fs=[]; cs=[]; rings=26; sides=16
    for i in range(rings+1):
        x,y,z,w,h=smooth_profile(controls,i/rings)
        for j in range(sides):
            a=j*math.tau/sides
            p=(x+max(.002,w)*math.cos(a),y+(0 if vertical else max(.002,h)*math.sin(a)),z+(max(.002,h)*math.sin(a) if vertical else 0))
            vs.append(p); cs.append(mix(top,bottom,max(0,-math.sin(a))))
    for i in range(rings):
        for j in range(sides):
            k=i*sides+j; n=i*sides+(j+1)%sides; fs.append((k,n,n+sides,k+sides))
    fs.extend([tuple(range(sides-1,-1,-1)),tuple(rings*sides+j for j in range(sides))])
    return mesh(name,vs,fs,skin,cs)

def sphere(name, pos, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=xyz(pos))
    obj=bpy.context.object; obj.name=name; obj.scale=(scale[0],scale[2],scale[1]); obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def line(name, points, radius, mat, closed=False):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=2; cu.bevel_depth=radius; cu.bevel_resolution=2
    sp=cu.splines.new('POLY'); sp.points.add(len(points)-1)
    for p,v in zip(sp.points,points):p.co=(*xyz(v),1)
    sp.use_cyclic_u=closed
    ob=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(ob); cu.materials.append(mat)
    return ob

def box(name,pos,size,mat,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos)); o=bpy.context.object; o.name=name; o.scale=(size[0],size[2],size[1]); o.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def begin(): return set(bpy.context.scene.objects)
def finish(name,before):
    parts=[o for o in bpy.context.scene.objects if o not in before]
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join();obj=bpy.context.object;obj.name=name
    # Bake the arbitrary active object's transform before export and deformation.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
    obj.hide_render=True; obj.hide_set(True)
    return obj

b=begin()
top=(.12,.20,.23);bottom=(.56,.61,.58)
shark_profile=[(-2.35,.025,.025,0),(-1.65,.16,.15,0),(-.8,.34,.31,.01),(.3,.47,.43,.02),(1.25,.40,.39,.02),(2,.21,.29,-.035),(2.55,.012,.035,-.06)]
body('Shark fusiform body',shark_profile,top,bottom)
fin('Swept dorsal',[(.1,.35,0,.5,.12),(-.12,.68,0,.29,.08),(-.52,1.2,0,.08,.025),(-.62,1.28,0,.004,.004)],top,bottom,True)
fin('Second dorsal',[(-1.2,.16,0,.22,.055),(-1.47,.44,0,.08,.03),(-1.53,.47,0,.002,.002)],top,bottom,True)
for side in [-1,1]:
    fin('Shark pectoral',[(.60,-.2,side*.25,.48,.10),(.15,-.31,side*.70,.34,.06),(-.48,-.43,side*1.25,.14,.025),(-.72,-.40,side*1.46,.002,.002)],top,bottom)
    fin('Shark pelvic',[(-1,-.13,side*.10,.23,.055),(-1.4,-.21,side*.46,.15,.035),(-1.6,-.22,side*.57,.002,.002)],top,bottom)
    sphere('Shark eye',(1.96,.12,side*.25),(.047,.047,.025),dark)
    line('Shark mouth',[(2.25,-.13,side*.17),(2.0,-.20,side*.25),(1.55,-.25,side*.30)],.011,dark)
    for i in range(5):
        x=1.13-i*.12
        points=[]
        for j in range(14):
            y=.21-j*.027;xx=x-.04*math.sin(j/13*math.pi)
            _,ry,rz,cy=section_at(shark_profile,xx)
            points.append((xx,y,side*(rz*math.sqrt(max(.01,1-((y-cy)/ry)**2))+.004)))
        line('Gill slit',points,.006,dark)
fin('Heterocercal upper tail',[(-2.1,0,0,.2,.08),(-2.32,.45,0,.27,.055),(-2.73,1.06,0,.13,.028),(-2.99,1.45,0,.002,.002)],top,bottom,True)
fin('Lower tail',[(-2.12,-.03,0,.2,.08),(-2.43,-.47,0,.23,.045),(-2.8,-.83,0,.002,.002)],top,bottom,True)
finish('shark',b)

b=begin();top=(.09,.15,.18);bottom=(.42,.47,.46)
whale_profile=[(-3.1,.05,.06,0),(-2.5,.18,.22,0),(-1.7,.40,.42,0),(-.7,.67,.66,.04),(.6,.85,.80,.06),(1.65,.77,.76,.08),(2.5,.48,.55,.09),(2.87,.15,.27,.07),(2.98,.01,.01,.04)]
body('Humpback continuous body',whale_profile,top,bottom)
fin('Whale dorsal',[(-.95,.52,0,.35,.13),(-1.17,.84,0,.16,.075),(-1.39,.96,0,.005,.006)],top,bottom,True)
for side in [-1,1]:
    fin('Long humpback flipper',[(1.15,-.35,side*.51,.40,.14),(.65,-.60,side*1.1,.39,.1),(-.20,-.83,side*1.9,.22,.07),(-.75,-.9,side*2.4,.025,.02)],top,(.66,.68,.61))
    fin('Whale fluke',[(-2.85,0,side*.02,.26,.09),(-3.10,.03,side*.55,.40,.07),(-3.27,.12,side*1.1,.24,.04),(-3.5,.18,side*1.48,.003,.003)],top,bottom)
    sphere('Whale eye',(2.15,.02,side*.67),(.047,.044,.025),dark)
    line('Whale mouth',[(2.89,-.03,side*.20),(2.63,-.14,side*.51),(2.17,-.22,side*.69),(1.63,-.27,side*.72)],.015,dark)
    for i in range(6):
        x=1.8+i*.16
        sphere('Rostral tubercle',(x,.48-(x-1.8)*.25,side*(.27+(2.6-x)*.2)),(.055,.031,.04),pale)
for j in range(-6,7):
    z=j*.070
    points=[]
    for i in range(32):
        x=2.45-i*2.3/31;_,ry,rz,cy=section_at(whale_profile,x)
        zz=z*(.7+.5*math.sin(i/31*math.pi))
        points.append((x,cy-ry*math.sqrt(max(.01,1-(zz/rz)**2))-.003,zz))
    line('Ventral throat pleat',points,.006,pale)
finish('whale',b)

b=begin();top=(.27,.31,.13);bottom=(.54,.51,.30)
shell_profile=[(-1.2,.02,.03,0),(-.8,.29,.60,.07),(0,.44,.82,.08),(.7,.33,.69,.05),(1.05,.08,.35,0)]
body('Turtle shell',shell_profile,top,bottom,shellmat)
body('Turtle neck and head',[(.82,.12,.20,-.03),(1.12,.18,.23,.01),(1.44,.21,.25,.04),(1.70,.13,.18,.01),(1.78,.03,.10,-.02)],(.29,.35,.21),(.57,.58,.40))
for side in [-1,1]:
    fin('Turtle fore flipper',[(.55,-.08,side*.48,.29,.09),(.4,-.15,side*.94,.30,.065),(-.10,-.23,side*1.52,.22,.035),(-.62,-.28,side*1.83,.005,.005)],top,bottom)
    fin('Turtle hind flipper',[(-.73,-.08,side*.40,.23,.075),(-1.04,-.12,side*.80,.24,.055),(-1.36,-.18,side*.97,.008,.008)],top,bottom)
    sphere('Turtle eye',(1.57,.12,side*.195),(.045,.045,.025),dark)
    line('Turtle beak',[(1.76,-.005,side*.08),(1.63,-.06,side*.17),(1.40,-.08,side*.19)],.009,dark)
    for i in range(7):
        x=.94+i*.10
        line('Head scale',[(x,.17,side*.12),(x+.04,.12,side*.20),(x+.025,.04,side*.235)],.004,shellline)
# Scute network follows the domed surface rather than floating above a sphere.
def shellpoint(x,z):
    _,ry,rz,cy=section_at(shell_profile,x)
    z=max(-rz*.95,min(rz*.95,z))
    y=cy+ry*math.sqrt(max(.005,1-(z/rz)**2))+.002
    return (x,y,z)
def scute(name,points):
    projected=[]
    for a,b in zip(points,points[1:]+points[:1]):
        for j in range(8):
            x,z=mix(a,b,j/8);projected.append(shellpoint(x,z))
    line(name,projected,.005,shellline,True)
for i in range(5):
    x=-.85+i*.37
    hexagon=[(x+math.cos(a*math.tau/6)*.25,math.sin(a*math.tau/6)*.25) for a in range(6)]
    scute('Vertebral scute',hexagon)
for side in [-1,1]:
    for i in range(4):
        x=-.72+i*.41
        points=[(x-.20,side*.25),(x+.13,side*.25),(x+.26,side*.49),(x+.12,side*.67),(x-.17,side*.56)]
        scute('Costal scute',points)
rim=[]
for side in [-1,1]:
    for i in range(65):
        x,ry,rz,cy=smooth_profile(shell_profile,(i if side<0 else 64-i)/64)
        rim.append((x,cy,side*(rz+.004)))
line('Shell rim',rim,.013,pale,True)
finish('turtle',b)

b=begin();vs=[];fs=[];rows=64;cols=32
def beam(x):
    t=(x+2.12)/4.26
    return .56*max(.008,math.sin(math.pi*t*.84))**.67
for i in range(rows+1):
    x=-2.12+4.26*i/rows; w=beam(x); sheer=.43+.11*(abs(x)/2.14)**3
    for j in range(cols+1):
        a=math.pi*j/cols
        vs.append((x,sheer-.79*math.sin(a)**.73,w*math.cos(a)))
for i in range(rows):
    for j in range(cols):
        k=i*(cols+1)+j; fs.append((k,k+1,k+cols+2,k+cols+1))
fs.append(tuple(rows*(cols+1)+j for j in range(cols+1)))
mesh('Fair curved displacement hull',vs,fs,navy)
for sign in [-1,1]:
    line('Ivory gunwale',[(-2.12+4.26*i/64,.455+.11*(abs(-2.12+4.26*i/64)/2.14)**3,sign*beam(-2.12+4.26*i/64)) for i in range(65)],.029,cream)
    stripe=[]
    for i in range(65):
        x=-2.09+4.20*i/64
        sheer=.43+.11*(abs(x)/2.14)**3
        a=math.asin(((sheer-.21)/.79)**(1/.73))
        stripe.append((x,.21,sign*(beam(x)*math.cos(a)+.004)))
    line('Boot stripe',stripe,.012,cream)
    # Cockpit coaming, teak bench, and stainless safety rail.
    box('Cockpit coaming',(1.10,.49,sign*.32),(1.3,.19,.10),cream)
    box('Teak bench',(1.10,.50,sign*.38),(1.25,.055,.16),wood)
    rail=[]
    for x in [-1.65,-.85,.15,1.15,1.90]:
        z=sign*beam(x)*.97; line('Stanchion',[(x,.49,z),(x,.78,z)],.010,metal);rail.append((x,.78,z))
    line('Lifeline',rail,.006,metal)
# Individually fitted deck planks with dark caulking gaps.
for j in range(-7,8):
    z=j*.068
    for i in range(16):
        x=-1.98+i*.256
        if abs(z) < beam(x)*.92 and not (x>.45 and abs(z)<.26):
            box('Fitted teak plank',(x,.443,z),(.250,.028,.063),wood if (i+j)%5 else woodlight,.003)
box('Cockpit well',(1.13,.29,0),(1.25,.04,.50),navy)
box('Small cabin trunk',(-.27,.57,0),(1.24,.27,.65),cream,.10)
box('Cabin skylight',(-.27,.718,0),(.46,.018,.40),glass,.04)
for s in [-1,1]:
    for x in [-.58,-.04]:
        box('Cabin portlight',(x,.59,s*.322),(.28,.10,.014),glass,.045)
for x in [-1.7,1.75]:
    for z in [-.28,.28]:
        box('Mooring cleat',(x,.51,z),(.13,.045,.035),metal,.009)
line('Tiller',[(1.86,.51,0),(1.45,.69,0),(.98,.72,0)],.022,wood)
finish('boat-hull',b)

# Save an editable presentation layout separately; website GLBs stay at origin.
for i,o in enumerate(bpy.context.scene.objects):
    o.hide_render=False;o.hide_set(False);o.location.x=(i%2)*9;o.location.y=(i//2)*6
os.makedirs(os.path.join(ROOT,'artifacts','marine-studio'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'artifacts','marine-studio','McLary-marine-assets.blend'))
print('Marine assets authored and exported:',OUT)
