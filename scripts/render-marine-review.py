"""Render the authored assets for visual review in Blender's offline renderer."""
import bpy, os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
folder=os.path.join(root,'artifacts','marine-studio')
bpy.ops.wm.open_mainfile(filepath=os.path.join(folder,'McLary-marine-assets.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=750;scene.render.resolution_percentage=100
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.14,.19,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
models=list(scene.objects)
for o in models:o.location=(0,0,0);o.hide_render=True
def light(pos,power,size):
    bpy.ops.object.light_add(type='AREA',location=pos)
    o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
light((1,-3,7),950,7);light((-4,3,4),1100,5)
bpy.ops.object.camera_add(location=(4,-10,5))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=8
scene.camera=camera
for name in ['shark','whale','turtle','boat-hull']:
    o=bpy.data.objects[name];o.hide_render=False
    camera.data.ortho_scale=5 if name=='turtle' else 8
    scene.render.filepath=os.path.join(folder,name+'.png')
    bpy.ops.render.render(write_still=True)
    o.hide_render=True
