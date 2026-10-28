// The shaders of vfx.mjs (one program for every VFX point). Shader source only: scripts/vi-coverage.mjs skips *-glsl.mjs files.
export const VERT = /* glsl */`
uniform float uTime, uScale, uMax, uBox;
uniform vec3 uCenter;
uniform vec4 uP[4], uQ[4], uR[4];
uniform vec3 uCol[12];
attribute vec4 aA, aB;
attribute vec3 aC;
varying vec3 vColor;
varying float vAlpha, vAngle, vShape, vAdd, vSeed;
void main(){
  int layer = int(aB.x + .5);
  vec3 wp; float size = 0., alpha = 0.; vAngle = 0.; vSeed = aA.y; vColor = aC;
  if (layer < 4) {
    vec4 P = uP[layer], Q = uQ[layer], R = uR[layer];
    if (R.x > .003 && aA.w <= R.y) {
      float t = uTime;
      if (layer == 3) {
        wp = position;
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
      }
      size = P.w * (.6 + .8 * aB.w);
      vShape = R.z; vAdd = R.w;
      vColor = uCol[layer * 3 + int(aA.y * 2.999)];
    }
  } else {
    float age = uTime - aA.w, life = aB.z;
    if (age >= 0. && age < life) {
      float k = age / life, g = 0., drag = 0.; int kind = int(aB.y + .5);
      size = aB.w; alpha = 1.;
      if (kind == 0) { g = -1.2; drag = 2.6; vShape = 5.; vAdd = .3; alpha = 1. - k * k; size *= 1. - .45 * k; vAngle = aA.x * 3. + age * 2.; }
      else if (kind == 1) { g = 9.; drag = .2; vShape = 9.; vAdd = 0.; alpha = 1. - smoothstep(.75, 1., k); }
      else if (kind == 2) { g = -.7; drag = 3.2; vShape = 7.; vAdd = 0.; alpha = .85 * (1. - k) * smoothstep(0., .08, k); size *= .55 + 1.1 * sqrt(k); }
      else if (kind == 3) { g = 3.2; drag = 1.6; vShape = 6.; vAdd = 0.; alpha = 1. - smoothstep(.75, 1., k); vAngle = aA.x * 5. + age * (6. + aA.z * 3.); }
      else if (kind == 4) { vShape = 8.; vAdd = 1.; alpha = (1. - k) * (1. - k); size *= .25 + 1.1 * sqrt(k); }
      else { g = 2.4; drag = 2.2; vShape = 2.; vAdd = 0.; alpha = 1. - smoothstep(.7, 1., k); vAngle = aA.x * 4. + age * 5.; }
      float e = drag > 0. ? (1. - exp(-drag * age)) / drag : age;
      wp = position + aA.xyz * e;
      wp.y -= .5 * g * age * age;
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
  else { float l = length(vec2(pc.x * 2.1, pc.y + .05 - pc.x * pc.x)); a = 1. - smoothstep(.36, .42, l); col = mix(col, vec3(1.), smoothstep(.09, 0., length(pc - vec2(-.06, -.1))) * .85); }
  a = min(1., a) * vAlpha;
  if (a < .01) discard;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * (1. - vAdd));
}`;

