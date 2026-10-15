// Record face shader. Units are millimetres from the spindle (12" LP proportions).
// Lighting is a small analytic studio (softboxes) evaluated in-shader, so no
// environment map has to be downloaded or baked.

export const RECORD = {
  radius: 150,
  hole: 3.6,
  label: 50.8,
  grooveIn: 60,
  grooveOut: 146,
  thickness: 1.9,
  gaps: [79, 96, 112, 127],
};

export const FACE_VERT = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vView;
  varying vec3 vN;
  varying vec3 vT;
  void main() {
    vLocal = position.xy;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    vN = normalMatrix * vec3(0.0, 0.0, 1.0);
    // Grooves run around the spindle, so the surface tangent is circular.
    vT = normalMatrix * vec3(-position.y, position.x, 0.0);
    gl_Position = projectionMatrix * mv;
  }
`;

export const FACE_FRAG = /* glsl */ `
  uniform sampler2D uLabel;
  uniform vec3 uKey;
  uniform vec3 uFill;
  uniform vec3 uTop;
  uniform vec4 uGaps;
  varying vec2 vLocal;
  varying vec3 vView;
  varying vec3 vN;
  varying vec3 vT;

  const float R_LABEL = ${RECORD.label.toFixed(2)};
  const float R_IN = ${RECORD.grooveIn.toFixed(2)};
  const float R_OUT = ${RECORD.grooveOut.toFixed(2)};

  float box(vec2 p, vec2 c, vec2 hs, float soft) {
    vec2 q = abs(p - c) - hs;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    return 1.0 - smoothstep(-soft, soft, d);
  }

  // What a mirror-smooth patch of the record sees: a dim room, one large key
  // softbox upper-left, a thin strip on the right and a soft top bounce.
  vec3 studio(vec3 d) {
    if (d.z <= 0.0) return vec3(0.0);
    vec2 p = d.xy / max(d.z, 0.2);
    vec3 c = vec3(0.015);
    c += vec3(1.0, 0.985, 0.96) * 2.6 * box(p, vec2(-0.22, 0.2), vec2(0.16, 0.2), 0.22);
    c += vec3(0.96, 0.98, 1.0) * 1.2 * box(p, vec2(0.34, -0.12), vec2(0.03, 0.4), 0.08);
    c += vec3(1.0) * 0.5 * box(p, vec2(0.0, 0.62), vec2(0.7, 0.08), 0.25);
    return c * smoothstep(0.0, 0.3, d.z);
  }

  float fresnel(float c) { return 0.045 + 0.955 * pow(1.0 - c, 5.0); }

  // Kajiya–Kay sheen along the groove tangent: the classic two-wedge vinyl highlight.
  float sheen(vec3 T, vec3 L, vec3 V, float e) {
    float th = dot(T, normalize(L + V));
    return pow(sqrt(max(0.0, 1.0 - th * th)), e);
  }

  void main() {
    float r = length(vLocal);
    vec3 N = normalize(vN);
    vec3 V = normalize(-vView);
    vec3 T = normalize(vT);
    float cosv = max(dot(N, V), 0.0);
    vec3 Rv = reflect(-V, N);
    float aa = fwidth(r) * 0.75;

    // Paper label: matte, lit by the same lamps.
    vec3 art = texture2D(uLabel, vLocal / (2.0 * R_LABEL) + 0.5).rgb;
    float dif = 0.42 + 0.5 * max(dot(N, uKey), 0.0) + 0.2 * max(dot(N, uFill), 0.0) + 0.1 * max(dot(N, uTop), 0.0);
    vec3 paper = art * dif + studio(Rv) * 0.025;

    // Where the grooves are, minus the smooth bands between tracks.
    float grooves = smoothstep(R_IN - aa, R_IN + aa, r) * (1.0 - smoothstep(R_OUT - aa, R_OUT + aa, r));
    float gap = 0.0;
    for (int i = 0; i < 4; i++) {
      gap = max(gap, 1.0 - smoothstep(0.55 - aa, 0.55 + aa, abs(r - uGaps[i])));
    }
    grooves *= 1.0 - gap;

    // Fine rings, faded out before they would alias.
    float x = r * 1.6;
    float fw = fwidth(x);
    float fine = mix(0.5, 0.5 + 0.5 * sin(x * 6.2831853), 1.0 - smoothstep(0.25, 0.7, fw));
    // Loud and quiet passages read as slightly different bands.
    float dyn = 0.8 + 0.2 * sin(r * 0.83 + 0.6) * sin(r * 0.29 + 1.7);

    vec3 base = vec3(0.009, 0.009, 0.010);
    float s = sheen(T, uKey, V, 220.0) * 1.1 + sheen(T, uKey, V, 30.0) * 0.08 + sheen(T, uFill, V, 260.0) * 0.18 + sheen(T, uTop, V, 120.0) * 0.1;
    vec3 grooved = base + vec3(0.86, 0.87, 0.9) * s * (0.45 + 0.55 * fine) * dyn * 0.42 + studio(Rv) * 0.02;
    vec3 smoothVinyl = base + studio(Rv) * fresnel(cosv);
    vec3 vinyl = mix(smoothVinyl, grooved, grooves);

    float onLabel = 1.0 - smoothstep(R_LABEL - aa, R_LABEL + aa, r);
    vec3 col = mix(vinyl, paper, onLabel);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
