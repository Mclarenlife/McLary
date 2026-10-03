// Integrate sunlit water along a view ray. The pattern is advected on the water
// surface, so shafts continuously join, separate, and soften with optical depth.
export const underwaterLight = /* glsl */ `
  uniform float time;
  uniform float aspect;
  uniform vec2 pointer;
  uniform vec3 deep;
  uniform vec3 shallow;
  uniform vec3 beam;
  uniform vec3 direction;
  uniform float strength;
  uniform float night;
  uniform float descent;
  varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  float caustic(vec2 p){
    p+=vec2(sin(p.y*1.6+time*.36),cos(p.x*1.35-time*.29))*.48;
    float a=sin(p.x*3.1+p.y*1.7+time*.37);
    float b=sin(p.x*-1.8+p.y*3.4-time*.43);
    float c=sin(p.x*2.2-p.y*2.5+time*.23);
    return pow(clamp(1.-abs(a+b+c)*.53,0.,1.),10.);
  }
  void main(){
    vec2 uv=vUv+pointer*.006;
    uv.y -= descent * .75;
    float depth=max(0.,1.-uv.y);
    vec2 q=vec2((uv.x-.5)*aspect,depth);
    vec3 color=mix(deep,shallow,exp(-depth*2.8));
    vec2 source=vec2(direction.x*.85,-.18-direction.y*.55);
    float shafts=0.;
    for(int i=0;i<14;i++){
      float s=(float(i)+.5)/14.;
      // Refraction at a moving surface produces a continuous, irregular fan.
      vec2 samplePoint=mix(q,source,s*.64);
      vec2 surface=vec2((samplePoint.x-source.x)/(samplePoint.y-source.y),s*.65)*vec2(5.5,2.1);
      surface+=vec2(time*.018,-time*.032);
      float focus=caustic(surface);
      float broad=noise(surface*1.7+vec2(time*.075,0.));
      float attenuation=exp(-depth*(1.8+s*2.2));
      shafts+=(focus*.82+pow(broad,4.)*.65)*attenuation;
    }
    shafts/=14.;
    float envelope=exp(-pow((q.x+.19)/(1.+depth*.8),2.));
    color+=beam*shafts*envelope*strength*.58;
    float surfaceBand=exp(-depth*24.);
    vec2 surfaceUV=vec2(q.x*8./(.18+depth),1./(.10+depth));
    color+=beam*.24*strength*caustic(surfaceUV)*surfaceBand;
    color+=beam*.34*strength*exp(-depth*9.)*exp(-pow((q.x-source.x)*1.2,2.));
    float haze=noise(uv*vec2(9.,5.)+vec2(time*.018,-time*.025));
    color+=shallow*.045*haze;
    // Sparse nocturnal plankton glow drifts independently of the light shafts.
    vec2 plankton=uv*vec2(aspect,1.)*38.+vec2(time*.08,time*.14);
    vec2 cell=floor(plankton), f=fract(plankton)-.5;
    float seed=hash(cell);
    float glow=step(.976,seed)*exp(-dot(f,f)*110.)*pow(.5+.5*sin(time*.65+seed*90.),3.);
    color+=vec3(.035,.36,.38)*glow*night*smoothstep(.02,.45,depth);
    color*=1.-.19*pow(abs(uv.x-.5)*2.,2.);
    vec3 abyss = mix(vec3(.012,.115,.16), vec3(.004,.017,.035), night);
    vec3 deepScene = abyss * (.55 + vUv.y * .85);
    float opening=exp(-pow((vUv.x-.58)*2.8,2.))*pow(vUv.y,3.);
    deepScene+=beam*opening*.12*strength;
    color = mix(color, deepScene, descent * .86);
    gl_FragColor=vec4(color,1.);
  }
`;
