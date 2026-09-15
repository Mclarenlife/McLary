import * as THREE from "three";

export const polygonsOf = (geometry) =>
  geometry.type === "MultiPolygon"
    ? geometry.coordinates
    : [geometry.coordinates];

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function countryTexture(countries) {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Red records land; green records fine country boundaries, independently of
  // palette and lighting. Geographic polygons are rasterized only once at preload.
  for (const country of countries) {
    for (const polygon of country.polygons) {
      for (const shift of [-4096, 0, 4096]) {
        ctx.beginPath();
        for (const ring of polygon) {
          let previous;
          ring.forEach(([lon, lat], i) => {
            let x = ((lon + 180) / 360) * canvas.width;
            if (previous !== undefined) {
              while (x - previous > 2048) x -= 4096;
              while (x - previous < -2048) x += 4096;
            }
            previous = x;
            const y = ((90 - lat) / 180) * canvas.height;
            if (!i) ctx.moveTo(x + shift, y);
            else ctx.lineTo(x + shift, y);
          });
          ctx.closePath();
        }
        ctx.fillStyle = "#ff0000";
        ctx.fill("evenodd");
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function regionInfo(feature) {
  const points = polygonsOf(feature.geometry).flat(2);
  const minLon = Math.min(...points.map((p) => p[0])),
    maxLon = Math.max(...points.map((p) => p[0]));
  const minLat = Math.min(...points.map((p) => p[1])),
    maxLat = Math.max(...points.map((p) => p[1]));
  const lat = (minLat + maxLat) / 2,
    lon = (minLon + maxLon) / 2;
  const extent = Math.max(
    maxLat - minLat,
    (maxLon - minLon) * Math.cos((lat * Math.PI) / 180),
  );
  const padding = Math.max(maxLon - minLon, maxLat - minLat) * 0.08;
  return {
    lat,
    lon,
    extent,
    bounds: new THREE.Vector4(
      minLon - padding,
      minLat - padding,
      maxLon - minLon + padding * 2,
      maxLat - minLat + padding * 2,
    ),
  };
}

export function regionTexture(feature, bounds) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = "white";
  for (const polygon of polygonsOf(feature.geometry)) {
    ctx.beginPath();
    for (const ring of polygon) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon - bounds.x) / bounds.z) * 1024;
        const y = (1 - (lat - bounds.y) / bounds.w) * 1024;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
  return canvasTexture(canvas);
}

export function contextTexture(context) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1536;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 1536, 1536);
  const [x, y, w, h] = context.bounds;
  for (const polygon of context.polygons) {
    ctx.beginPath();
    for (const ring of polygon) {
      ring.forEach(([lon, lat], i) => {
        const px = ((lon - x) / w) * 1536,
          py = (1 - (lat - y) / h) * 1536;
        if (!i) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
    ctx.fillStyle = "#ff0000";
    ctx.fill("evenodd");
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 0.65;
    ctx.stroke();
  }
  return canvasTexture(canvas);
}

export function createGlobeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      worldMap: { value: null },
      regionMap: { value: null },
      regionBounds: { value: new THREE.Vector4() },
      contextMap: { value: null },
      contextBounds: { value: new THREE.Vector4() },
      focus: { value: new THREE.Vector3(0, 0, 1) },
      magnification: { value: 1 },
      detail: { value: 0 },
      highlight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 localDirection; varying vec3 viewNormal; varying vec3 viewDirection;
      void main() {
        localDirection=normalize(position);
        vec4 p=modelViewMatrix*vec4(position,1.);
        viewNormal=normalize(normalMatrix*normal); viewDirection=-p.xyz;
        gl_Position=projectionMatrix*p;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D worldMap; uniform sampler2D regionMap; uniform sampler2D contextMap;
      uniform vec4 regionBounds; uniform vec4 contextBounds; uniform vec3 focus;
      uniform float magnification; uniform float detail; uniform float highlight;
      varying vec3 localDirection; varying vec3 viewNormal; varying vec3 viewDirection;
      const float PI=3.14159265359;
      vec2 geographic(vec3 p) { return vec2(atan(-p.z,p.x)/ (2.*PI)+.5,asin(clamp(p.y,-1.,1.))/PI+.5); }
      void main() {
        vec3 n=normalize(localDirection), f=normalize(focus);
        float angle=acos(clamp(dot(n,f),-.999999, .999999));
        vec3 tangent=n-f*dot(n,f);
        tangent=length(tangent)>.00001?normalize(tangent):vec3(0.,1.,0.);
        // Compress geographic angles inside an unchanged physical sphere.
        vec3 sampleDirection=magnification>.9999?n:normalize(f*cos(angle*magnification)+tangent*sin(angle*magnification));
        vec2 uv=geographic(sampleDirection);
        float facing=max(0.,dot(normalize(viewNormal),normalize(viewDirection)));
        float blur=detail*pow(1.-facing,4.)*.003;
        vec2 map=texture2D(worldMap,uv).rg*.5;
        map+=(texture2D(worldMap,uv+vec2(blur,0.)).rg+texture2D(worldMap,uv-vec2(blur,0.)).rg)*.125;
        map+=(texture2D(worldMap,uv+vec2(0.,blur)).rg+texture2D(worldMap,uv-vec2(0.,blur)).rg)*.125;
        vec2 degrees=vec2((uv.x-.5)*360.,(uv.y-.5)*180.);
        vec2 contextUv=(degrees-contextBounds.xy)/max(contextBounds.zw,vec2(.0001));
        vec2 contextEdge=smoothstep(vec2(0.),vec2(.12),contextUv)*(1.-smoothstep(vec2(.88),vec2(1.),contextUv));
        map=mix(map,texture2D(contextMap,clamp(contextUv,0.,1.)).rg,contextEdge.x*contextEdge.y*smoothstep(.4,1.,detail));
        vec2 grid=geographic(n)*vec2(360.,180.);
        float circle=length(fract(grid)-.5);
        float aa=max(fwidth(circle),.02);
        float dots=1.-smoothstep(.19-aa,.19+aa,circle);
        float light=.62+.38*max(0.,dot(normalize(viewNormal),normalize(vec3(-.4,.6,1.))));
        vec3 ocean=vec3(.0015)+vec3(.033)*dots*light;
        vec3 land=vec3(.135,.143,.15)*light;
        vec3 color=mix(ocean,land,map.r);
        color=mix(color,vec3(.42,.44,.46)*light,map.g*.65);
        vec2 regionUv=(degrees-regionBounds.xy)/max(regionBounds.zw,vec2(.0001));
        float inside=step(0.,regionUv.x)*step(regionUv.x,1.)*step(0.,regionUv.y)*step(regionUv.y,1.);
        float region=texture2D(regionMap,clamp(regionUv,0.,1.)).r*inside;
        color=mix(color,vec3(.92)*(.85+.15*light),region*highlight);
        float edge=smoothstep(.0,mix(.055,.58,detail),facing);
        gl_FragColor=vec4(color,edge);
      }
    `,
  });
}
