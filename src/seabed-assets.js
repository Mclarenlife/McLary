import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { compressedTextures } from "./compressed-textures.js";

// All geometry, textures and decoder files are hosted locally, including on Pages.
export async function loadSeabedAssets(day, time, reveal, renderer) {
  const draco=new DRACOLoader().setDecoderPath("/models/draco/").setWorkerLimit(2);
  const loader=new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(compressedTextures(renderer));
  try {
    const results=await Promise.allSettled(["shipwreck-detail","ruins-detail"].map(async name => {
      const version=name==="ruins-detail"?"?v=individual-fractures-2":"";
      let compressed;
      const {scene}=await (async()=>{
        await compressedTextures(renderer).init();
        compressed=await loader.loadAsync(`/models/${name}-ktx2.glb`);
        // GLTFLoader can resolve a model even when an embedded texture failed.
        // Inspect declared maps so a blank material never silently replaces it.
        const materials=await compressed.parser.getDependencies("material");
        compressed.parser.json.materials.forEach((definition,index)=>{
          const material=materials[index], pbr=definition.pbrMetallicRoughness;
          if((definition.normalTexture&&!material.normalMap)||
            (pbr?.baseColorTexture&&!material.map)||
            (pbr?.metallicRoughnessTexture&&!material.roughnessMap))
            throw new Error(`Missing compressed material texture: ${definition.name}`);
        });
        return compressed;
      })().catch(error=>{
        if(compressed) {
          const resources=new Set();
          compressed.scene.traverse(mesh=>{
            if(mesh.geometry) resources.add(mesh.geometry);
            if(mesh.material) {
              resources.add(mesh.material);
              for(const value of Object.values(mesh.material)) if(value?.isTexture) resources.add(value);
            }
          });
          resources.forEach(resource=>resource.dispose());
        }
        // A blocked WASM/worker or failed compressed download must not erase the scene.
        console.warn(`Compressed seabed texture unavailable; loading original ${name}`, error);
        return loader.loadAsync(`/models/${name}.glb${version}`);
      });
      scene.traverse(mesh=>{
        if(!mesh.isMesh) return;
        const material=mesh.material;
        material.fog=false;
        material.transparent=true;
        material.side=THREE.DoubleSide;
        // These are solid wreck/stone surfaces, not layered translucent glass.
        // Keep both faces and the reveal fade without drawing every mesh twice.
        material.forceSinglePass=true;
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
      if(import.meta.env?.DEV && new URLSearchParams(location.search).has("profile")) {
        const textures=new Set();
        scene.traverse(mesh=>{
          for(const map of [mesh.material?.map,mesh.material?.normalMap,mesh.material?.roughnessMap])
            if(map) textures.add(map);
        });
        console.info("KTX2 "+JSON.stringify({name,textures:[...textures].map(t=>({
          compressed:t.isCompressedTexture===true,format:t.format,mips:t.mipmaps.length,
          width:t.image.width,height:t.image.height,
          bytes:t.mipmaps.reduce((sum,m)=>sum+(m.data?.byteLength||0),0)
        }))}));
      }
      return scene;
    }));
    const failed=results.find(result=>result.status==="rejected");
    if(failed) throw failed.reason;
    return {wreck:results[0].value,ruins:results[1].value};
  } finally {draco.dispose();}
}
