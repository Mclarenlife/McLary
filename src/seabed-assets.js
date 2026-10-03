import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

// All geometry, textures and decoder files are hosted locally, including on Pages.
export async function loadSeabedAssets(day, time, reveal, renderer) {
  const draco=new DRACOLoader().setDecoderPath("/models/draco/").setWorkerLimit(2);
  const loader=new GLTFLoader().setDRACOLoader(draco);
  try {
    const models=await Promise.all(["shipwreck-detail","ruins-detail"].map(async name => {
      const version=name==="ruins-detail"?"?v=individual-fractures-2":"";
      const {scene}=await loader.loadAsync(`/models/${name}.glb${version}`);
      scene.traverse(mesh=>{
        if(!mesh.isMesh) return;
        const material=mesh.material;
        material.fog=false;
        material.transparent=true;
        material.side=THREE.DoubleSide;
        material.envMapIntensity=.25;
        material.roughness=Math.max(.82,material.roughness);
        if(material.normalMap) material.normalScale.multiplyScalar(name==="ruins-detail"?.35:.65);
        for(const map of [material.map,material.normalMap,material.roughnessMap])
          if(map) map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        material.onBeforeCompile=shader=>{
          Object.assign(shader.uniforms,{seabedReveal:reveal,seabedTime:time,seabedDay:day.uniforms.daylight,seabedNight:day.uniforms.night});
          shader.vertexShader="varying vec3 seabedWorld;\n"+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nseabedWorld=(modelMatrix*vec4(position,1.)).xyz;");
          shader.fragmentShader="varying vec3 seabedWorld; uniform float seabedReveal,seabedTime,seabedDay,seabedNight;\n"+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`
            vec3 waterTint=vec3(.52,.81,.90);
            outgoingLight*=waterTint*(.36+.64*seabedDay);
            float caustic=sin(seabedWorld.x*1.3+seabedWorld.z*.8+seabedTime*.26)
              +sin(seabedWorld.z*1.9-seabedWorld.x*.7-seabedTime*.21);
            outgoingLight+=vec3(.04,.10,.11)*pow(max(0.,1.-abs(caustic)),12.)*seabedDay*.25;
            vec3 haze=mix(vec3(.012,.115,.16),vec3(.004,.017,.035),seabedNight);
            float fog=1.-exp(-max(0.,length(vViewPosition)-10.)*.021);
            outgoingLight=mix(outgoingLight,haze,fog);
            diffuseColor.a*=seabedReveal;
            #include <opaque_fragment>
          `);
        };
        material.customProgramCacheKey=()=>"blender-seabed-v1";
      });
      return scene;
    }));
    return {wreck:models[0],ruins:models[1]};
  } finally {draco.dispose();}
}
