// The shaders of vfx.mjs (one program for every VFX point). Shader source only: scripts/vi-coverage.mjs skips *-glsl.mjs files.
// Layers (aB.x): 0 home air (or the rain), 1 land air, 2 critters (fireflies / butterflies), 3 pond glints, 4 ground (rain
// splashes, puddle glints), 5 anchored life (aB.y the sort: 0 chimney smoke, 1 warm glow, 2 oven sparks, 3 dragonfly, 4 water
// strider, 5 shore foam, 6 outpost beacon), 9 one-shot bursts.
// Shapes (vShape): 0 soft disc, 1 petal, 2 leaf, 3 glow, 4 bubble, 5 star sparkle, 6 confetti, 7 puff, 8 ring, 9 droplet,
// 10 rain streak, 11 heart, 12 dragonfly, 13 water strider with its ripple, 14 ring lying on the ground, 15 butterfly.
export const VERT = /* glsl */`
uniform float uTime, uScale, uMax, uBox, uKd;
uniform vec3 uCenter;
uniform vec2 uWind;
uniform vec4 uP[5], uQ[5], uR[5];
uniform vec3 uCol[15];
uniform float uK[8];
attribute vec4 aA, aB;
attribute vec3 aC;
varying vec3 vColor;
varying float vAlpha, vAngle, vShape, vAdd, vSeed;
float h1(float a, float b){ return fract(sin(a * 12.9898 + b * 78.233) * 43758.5453); }
void main(){
  int layer = int(aB.x + .5);
  vec3 wp = position; float size = 0., alpha = 0.; vAngle = 0.; vSeed = aA.y; vColor = aC; vShape = 0.; vAdd = 0.;
  float t = uTime;
  if (layer < 4) {
    vec4 P = uP[layer], Q = uQ[layer], R = uR[layer];
    if (R.x > .003 && aA.w <= R.y) {
      if (layer == 3) {
        float tw = .5 + .5 * sin(t * (1.6 + aA.x * 2.6) + aA.y * 40.);
        alpha = R.x * smoothstep(.55, 1., tw);
        vAngle = aA.z * .8;
      } else {
        float band = Q.w - Q.z;
        vec2 xz = position.xz * uBox + Q.xy * t;
        xz.x += sin(t * (.6 + aA.x) + aA.y * 6.2832) * P.y;
        xz.y += cos(t * (.5 + aA.y) + aA.x * 6.2832) * P.y * .7;
        float fy = fract(position.y - P.x * (.6 + .8 * aA.z) * t / band);
        vec2 rel = mod(xz - uCenter.xz + .5 * uBox, uBox) - .5 * uBox;
        wp = vec3(uCenter.x + rel.x, Q.z + fy * band, uCenter.z + rel.y);
        float r = length(rel) / (.5 * uBox);
        alpha = R.x * (1. - smoothstep(.55, 1., r)) * smoothstep(0., .1, fy) * (1. - smoothstep(.85, 1., fy));
        vAngle = aA.x * 6.2832 + t * P.z * (aA.z * 2. - 1.);
        if (R.z > 14.5) { wp.y += sin(t * 4.2 + aA.y * 30.) * .16; vAngle = sin(t * .9 + aA.y * 20.) * .35; }
      }
      size = P.w * (.6 + .8 * aB.w);
      vShape = R.z; vAdd = R.w;
      vColor = uCol[layer * 3 + int(aA.y * 2.999)];
    }
  } else if (layer == 4) {
    // Rain on the ground round the player: a splash ring every cycle at a new spot of its cell, a few puddle glints.
    vec4 R = uR[4];
    if (R.x > .003 && aA.w <= R.y) {
      float rate = 1. / (.55 + .5 * aA.x), cyc = t * rate + aA.y * 9., c = floor(cyc), k = fract(cyc);
      vec2 xz = position.xz * uBox + (vec2(h1(c, aA.y), h1(c + 3.1, aA.z)) - .5) * 6.;
      vec2 rel = mod(xz - uCenter.xz + .5 * uBox, uBox) - .5 * uBox;
      wp = vec3(uCenter.x + rel.x, .06, uCenter.z + rel.y);
      float fade = 1. - smoothstep(.4, .85, length(rel) / (.5 * uBox));
      if (aA.z > .8) { vShape = 5.; vAdd = 1.; size = .5; alpha = R.x * fade * smoothstep(.5, 1., sin(k * 3.1416)); vAngle = aA.x; vColor = vec3(1.); }
      else { vShape = 14.; size = .3 + 1.1 * sqrt(k); alpha = R.x * fade * (1. - k) * (1. - k); vColor = uCol[12]; }
    }
  } else if (layer == 5) {
    int sub = int(aB.y + .5);
    float K = uK[sub], far = length(position.xz - uCenter.xz);
    if (K > .003 && aA.w <= uKd && far < (sub == 6 ? 190. : 80.)) {
      float ph = aA.x; size = aB.w;
      if (sub == 0) { // chimney smoke: puffs rise, drift with the wind, swell and thin out
        float k = fract(t / (4.2 + aA.z) + ph);
        wp = position + vec3(uWind.x * k * 2.4 + sin(t * .8 + ph * 6.2832) * .18 * k, k * 3.6, uWind.y * k * 2.4);
        size *= .45 + 1.3 * sqrt(k);
        alpha = K * .72 * smoothstep(0., .1, k) * (1. - smoothstep(.4, 1., k));
        vShape = 7.;
      } else if (sub == 1) { // warm glow: a window, the oven's mouth, a lamp
        alpha = K * (.84 + .16 * sin(t * (1.1 + aA.y) + ph * 20.)); vShape = 3.; vAdd = 1.; vSeed = 0.;
      } else if (sub == 2) { // sparks rising from the oven's chimney
        float k = fract(t / (1.3 + .6 * aA.z) + ph);
        wp = position + vec3(sin(ph * 40. + t * 3.) * .3 * k, k * 2.8, cos(ph * 30. + t * 2.7) * .3 * k);
        alpha = K * (1. - k) * (.55 + .45 * sin(t * 17. + ph * 50.)); vShape = 3.; vAdd = 1.; size *= 1. - .5 * k;
      } else if (sub == 3) { // dragonfly: darts and hovers in loops over the water, nose first
        float s = t * (.32 + .18 * aA.y) + ph * 6.2832, hop = s + .55 * sin(s * 2.3);
        vec2 o = vec2(sin(hop) * 3.4 + sin(hop * 2.7) * .9, cos(hop * 1.3) * 2.3);
        wp = position + vec3(o.x, .75 + .25 * sin(t * 1.7 + ph * 9.), o.y);
        vec2 v = vec2(cos(hop) * 3.4 + cos(hop * 2.7) * 2.43, -sin(hop * 1.3) * 2.99);
        vec4 a = projectionMatrix * viewMatrix * vec4(wp, 1.), b = projectionMatrix * viewMatrix * vec4(wp + vec3(v.x, 0., v.y) * .05, 1.);
        vec2 d = (b.xy / b.w - a.xy / a.w) / vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
        vAngle = atan(d.y, d.x); vShape = 12.; alpha = K; vSeed = ph;
      } else if (sub == 4) { // water strider: a glide to a new spot, then a ripple spreads where it stopped
        float cyc = t / (1.3 + .5 * aA.z) + ph * 7., c = floor(cyc), k = fract(cyc);
        vec2 p0 = (vec2(h1(c, ph), h1(c + 5.3, ph)) - .5) * 3., p1 = (vec2(h1(c + 1., ph), h1(c + 6.3, ph)) - .5) * 3.;
        vec2 o = mix(p0, p1, smoothstep(0., .22, k));
        wp = position + vec3(o.x, 0., o.y);
        alpha = K; vShape = 13.; vSeed = smoothstep(.22, 1., k);
      } else if (sub == 5) { // the pond's shore: soft foam beads that breathe, a few sun sparkles
        float b = .5 + .5 * sin(t * (.7 + aA.y) + ph * 30.);
        if (aA.z > .82) { vShape = 5.; vAdd = 1.; alpha = K * smoothstep(.6, 1., b); vAngle = ph * 3.; size *= 1.2; }
        else { alpha = K * (.3 + .45 * b); size *= .8 + .35 * b; }
      } else if (sub == 6) { // an outpost's beacon: motes spiral up from the Home pad
        float k = fract(t / 3.2 + ph), a = ph * 6.2832 + t * 1.3, r = .8 * (1. - .5 * k);
        wp = position + vec3(cos(a) * r, .4 + k * 9., sin(a) * r);
        alpha = K * smoothstep(0., .08, k) * (1. - k); vShape = 3.; vAdd = 1.; size *= 1. - .4 * k;
      }
    }
  } else {
    float age = uTime - aA.w, life = aB.z;
    if (age >= 0. && age < life) {
      float k = age / life, g = 0., drag = 0.; int kind = int(aB.y + .5);
      size = aB.w; alpha = 1.;
      if (kind == 0) { g = -1.2; drag = 2.6; vShape = 5.; vAdd = .3; alpha = 1. - k * k; size *= 1. - .45 * k; vAngle = aA.x * 3. + age * 2.; }
      else if (kind == 1) { g = 9.; drag = .2; vShape = 9.; alpha = 1. - smoothstep(.75, 1., k); }
      else if (kind == 2) { g = -.7; drag = 3.2; vShape = 7.; alpha = .85 * (1. - k) * smoothstep(0., .08, k); size *= .55 + 1.1 * sqrt(k); }
      else if (kind == 3) { g = 3.2; drag = 1.6; vShape = 6.; alpha = 1. - smoothstep(.75, 1., k); vAngle = aA.x * 5. + age * (6. + aA.z * 3.); }
      else if (kind == 4) { vShape = 8.; vAdd = 1.; alpha = (1. - k) * (1. - k); size *= .25 + 1.1 * sqrt(k); }
      else if (kind == 5) { g = 2.4; drag = 2.2; vShape = 2.; alpha = 1. - smoothstep(.7, 1., k); vAngle = aA.x * 4. + age * 5.; }
      else if (kind == 8) { g = -.3; drag = 1.8; vShape = 11.; alpha = 1. - smoothstep(.7, 1., k); size *= smoothstep(0., .12, k) * (1. + .25 * sin(min(k * 18., 9.42))); vAngle = sin(age * 4. + aA.x * 9.) * .25; }
      float e = drag > 0. ? (1. - exp(-drag * age)) / drag : age;
      wp = position + aA.xyz * e;
      wp.y -= .5 * g * age * age;
      if (kind == 6) { // a shimmer column: sparkles spiral up round the spot
        float r = length(aA.xz), a = atan(aA.z, aA.x) + age * 3.2;
        wp = position + vec3(cos(a) * r, age * aA.y, sin(a) * r);
        vShape = 5.; vAdd = .6; alpha = smoothstep(0., .1, k) * (1. - k * k); size *= 1. - .35 * k; vAngle = age * 2. + aA.x;
      } else if (kind == 7) { // a gust: a leaf or a petal carried across, fluttering
        wp = position + aA.xyz * age + vec3(0., sin(age * 3.1 + aA.x * 7.) * .35, sin(age * 2.3 + aA.z * 5.) * .4);
        vShape = h1(aA.x, aA.z) > .5 ? 1. : 2.; alpha = smoothstep(0., .12, k) * (1. - smoothstep(.75, 1., k)); vAngle = aA.x * 4. + age * (2.5 + abs(aA.z));
      } else if (kind == 9) { wp = position; vShape = 14.; alpha = .9 * (1. - k); size *= .15 + .85 * sqrt(k); } // a shock ring along the ground
      if (wp.y < .02) { alpha = kind == 1 ? 0. : alpha; wp.y = max(wp.y, .02); }
    }
  }
  if (alpha <= .003) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; vAlpha = 0.; return; }
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
  // uScale is the canvas height in pixels; an orthographic projection's [1][1] is 2 zoom / (top - bottom): pixels per metre.
  gl_PointSize = min(uMax, size * projectionMatrix[1][1] * .5 * uScale);
  vAlpha = alpha;
}`;
export const FRAG = /* glsl */`
uniform float uTime;
varying vec3 vColor;
varying float vAlpha, vAngle, vShape, vAdd, vSeed;
void main(){
  vec2 pc = gl_PointCoord - .5;
  float c = cos(vAngle), s = sin(vAngle);
  vec2 q = vec2(c * pc.x - s * pc.y, s * pc.x + c * pc.y);
  float d = length(pc), a = 0.;
  vec3 col = vColor;
  int sh = int(vShape + .5);
  if (sh == 0) a = smoothstep(.5, .2, d);
  else if (sh == 1) { vec2 e = q * vec2(2.4, 1.45); float l = length(e); a = smoothstep(.52, .44, l) * (1. - smoothstep(.06, 0., abs(q.x - .2)) * step(0., q.y) * .8); col = mix(col * .78, mix(col, vec3(1.), .22), smoothstep(.5, .1, l)); }
  else if (sh == 2) { vec2 l = q * vec2(1., 2.2); float edge = abs(l.y) - (.42 - abs(l.x)) * .9; a = smoothstep(.03, -.02, edge); col *= (1. - smoothstep(.035, 0., abs(q.y)) * .3) * mix(.78, 1., smoothstep(0., -.08, edge)); }
  else if (sh == 3) { a = pow(max(0., 1. - d * 2.), 1.6) + smoothstep(.12, .02, d); col = mix(col, vec3(1.), smoothstep(.14, 0., d) * .8); a *= .45 + .55 * (.5 + .5 * sin(uTime * 2.3 + vSeed * 40.)); }
  else if (sh == 4) { a = smoothstep(.06, 0., abs(d - .38)) * .85 + smoothstep(.12, 0., length(pc - vec2(-.13, -.13))) * .9 + smoothstep(.4, .0, d) * .12; }
  else if (sh == 5) { vec2 m = abs(q); a = max(1. - smoothstep(0., 1., m.x * 7. + m.y * 2.), 1. - smoothstep(0., 1., m.y * 7. + m.x * 2.)) + smoothstep(.15, 0., d); col = mix(col, vec3(1.), smoothstep(.12, 0., d)); }
  else if (sh == 6) { a = (1. - smoothstep(.3, .34, abs(q.x))) * (1. - smoothstep(.15, .19, abs(q.y))); col *= mix(1.08, .82, smoothstep(-.15, .15, q.y)); }
  else if (sh == 7) { a = smoothstep(.5, .3, d); col *= mix(1.12, .82, pc.y + .5); }
  else if (sh == 8) { a = smoothstep(.07, 0., abs(d - .42)) * .9; }
  else if (sh == 9) { float l = length(vec2(pc.x * 2.1, pc.y + .05 - pc.x * pc.x)); a = 1. - smoothstep(.36, .42, l); col = mix(col, vec3(1.), smoothstep(.09, 0., length(pc - vec2(-.06, -.1))) * .85); }
  else if (sh == 10) { float x = pc.x + pc.y * .14; a = (1. - smoothstep(.03, .065, abs(x))) * smoothstep(.5, .15, abs(pc.y)) * (.6 + .4 * (.5 - pc.y)); col = mix(col, vec3(1.), smoothstep(.03, 0., abs(x)) * .5); }
  else if (sh == 11) { vec2 p = vec2(q.x, .1 - q.y) * 2.7; float f = pow(dot(p, p) - 1., 3.) - p.x * p.x * p.y * p.y * p.y; a = smoothstep(.06, -.06, f); col = mix(col, vec3(1.), smoothstep(.1, 0., length(q - vec2(-.15, -.12))) * .9) * mix(1., .82, smoothstep(0., .3, q.y)); }
  else if (sh == 12) { // a dragonfly seen from above: a slim body along x, four glassy wings across it
    float body = (1. - smoothstep(.035, .06, abs(q.y))) * step(-.36, q.x) * step(q.x, .3) + smoothstep(.08, .05, length(q - vec2(.3, 0.)));
    float fl = .75 + .25 * sin(uTime * 40. + vSeed * 30.);
    vec2 w1 = vec2(q.x - .1, abs(q.y) - .2 * fl), w2 = vec2(q.x + .08, abs(q.y) - .18 * fl);
    float wing = max(smoothstep(.06, .04, length(w1 * vec2(2.6, .55))), smoothstep(.06, .04, length(w2 * vec2(2.8, .6))));
    a = max(min(body, 1.), wing * .6); col = mix(vec3(.85, .97, 1.), col, min(body, 1.));
  }
  else if (sh == 13) { // a strider: a dark speck and its ring spreading on the water
    vec2 e = vec2(pc.x, pc.y * 1.5); float r = .08 + .38 * vSeed, ring = smoothstep(.035, 0., abs(length(e) - r)) * (1. - vSeed) * .9;
    float bug = smoothstep(.05, .03, length(e * vec2(1., .7))) + (1. - smoothstep(.006, .016, min(abs(e.x - e.y * .6), abs(e.x + e.y * .6)))) * step(length(e), .13) * .8;
    a = max(bug, ring); col = mix(vec3(1.), vec3(.16, .2, .3), step(.5, bug));
  }
  else if (sh == 14) { float l = length(vec2(pc.x, pc.y * 1.55)); a = smoothstep(.06, 0., abs(l - .43)) * .9 + smoothstep(.43, .2, l) * .12; }
  else { // a butterfly seen from above, its wings beating
    float flap = .35 + .65 * abs(sin(uTime * 13. + vSeed * 40.));
    vec2 w = vec2(abs(q.x) / max(.15, flap), q.y);
    float up = smoothstep(.2, .16, length((w - vec2(.2, -.08)) * vec2(1., 1.15))), low = smoothstep(.13, .1, length((w - vec2(.16, .14)) * vec2(1., 1.1)));
    float body = (1. - smoothstep(.02, .035, abs(q.x))) * step(abs(q.y), .2);
    a = max(max(up, low), body); col = body > .5 ? vec3(.2, .15, .15) : mix(col, vec3(1.), smoothstep(.06, 0., length(w - vec2(.24, -.12))) * .7) * mix(1., .78, low * (1. - up));
  }
  a = min(1., a) * vAlpha;
  if (a < .01) discard;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * (1. - vAdd));
}`;
