// Integrate sunlit water along a view ray. The pattern is advected on the water
// surface, so shafts continuously join, separate, and soften with optical depth.
export const underwaterLight = /* glsl */ `
  uniform float time;
  uniform float aspect;
  uniform vec2 pointer;
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
    float depth=max(0.,1.-uv.y);
    vec2 q=vec2((uv.x-.5)*aspect,depth);
    vec3 color=mix(vec3(.004,.031,.048),vec3(.035,.23,.28),exp(-depth*2.8));
    vec2 source=vec2(-.24,-.38);
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
    color+=vec3(.18,.35,.33)*shafts*envelope;
    float surfaceBand=exp(-depth*24.);
    vec2 surfaceUV=vec2(q.x*8./(.18+depth),1./(.10+depth));
    color+=vec3(.08,.18,.17)*caustic(surfaceUV)*surfaceBand;
    color+=vec3(.10,.23,.23)*exp(-depth*9.)*exp(-pow((q.x+.22)*1.2,2.));
    float haze=noise(uv*vec2(9.,5.)+vec2(time*.018,-time*.025));
    color+=vec3(.004,.012,.014)*haze;
    color*=1.-.19*pow(abs(uv.x-.5)*2.,2.);
    gl_FragColor=vec4(color,1.);
  }
`;
