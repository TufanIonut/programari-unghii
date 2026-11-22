import * as THREE from 'three'
import { STROKES } from './timeline'

// Material fizic (lumini, reflexii, clearcoat) în care injectăm masca de ojă:
// unde a trecut pensula, culoarea unghiei devine culoarea ojei, iar suprafața devine lucioasă.

export interface PolishUniforms {
  uColor: { value: THREE.Color }     // oja care se aplică acum
  uBase: { value: THREE.Color }      // ce era dedesubt (oja precedentă)
  uBaseMix: { value: number }        // 0 = unghie naturală, 1 = uBase
  uFronts: { value: THREE.Vector3 }  // frontul fiecărei trăsături
  uGlint: { value: number }          // reflexia care trece la final
}

const strokeConst = (i: number) =>
  `vec2(${STROKES[i].u.toFixed(3)}, ${STROKES[i].half.toFixed(3)})`

const FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uBase;
uniform float uBaseMix;
uniform vec3 uFronts;
uniform float uGlint;
varying vec2 vNailUv;

float nHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(nHash(i), nHash(i + vec2(1.0, 0.0)), w.x),
             mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), w.x), w.y);
}

// O bandă de ojă: lățime cu margini ușor neregulate (fire de pensulă),
// front rotunjit în direcția mișcării, puțin mai gros (o „mărgea” de lac).
float strokeMask(vec2 uv, vec2 stroke, float front, float seed) {
  if (front <= 0.05) return 0.0;
  float wobble = (nNoise(vec2(uv.y * 14.0, seed)) - 0.5) * 0.035;
  float across = abs(uv.x - stroke.x) + wobble;
  float band = smoothstep(stroke.y + 0.012, stroke.y - 0.02, across);
  float lead = front - 0.06 * pow(across / stroke.y, 2.0) + (nNoise(vec2(uv.x * 30.0, seed + 3.0)) - 0.5) * 0.012;
  float along = smoothstep(lead + 0.006, lead - 0.012, uv.y);
  return band * along;
}

// spațiul liber de la cuticulă și laterale, ca la o manichiură reală (și pentru oja veche)
float edgeMask(vec2 uv) {
  return smoothstep(0.025, 0.06, uv.y) * smoothstep(0.0, 0.012, uv.x) * smoothstep(1.0, 0.988, uv.x);
}

float polishMask(vec2 uv) {
  float m = strokeMask(uv, ${strokeConst(0)}, uFronts.x, 1.0);
  m = max(m, strokeMask(uv, ${strokeConst(1)}, uFronts.y, 7.0));
  m = max(m, strokeMask(uv, ${strokeConst(2)}, uFronts.z, 13.0));
  return m * edgeMask(uv);
}

vec3 naturalNail(vec2 uv) {
  vec3 bed = vec3(0.9, 0.66, 0.64);
  vec3 freeEdge = vec3(0.98, 0.94, 0.9);
  float s = 2.0 * uv.x - 1.0;
  float smile = 0.8 + 0.05 * (1.0 - s * s);   // linia „zâmbetului” de la marginea liberă
  vec3 c = mix(bed, freeEdge, smoothstep(smile - 0.02, smile + 0.02, uv.y));
  return mix(c * 0.93, c, smoothstep(0.0, 0.18, uv.y)); // lunula, puțin mai mată spre cuticulă
}
`

/** Materialul unghiei. Uniformele se actualizează din useFrame, fără recompilare. */
export function createPolishMaterial(): { material: THREE.MeshPhysicalMaterial; uniforms: PolishUniforms } {
  const uniforms: PolishUniforms = {
    uColor: { value: new THREE.Color('#e8c4c4') },
    uBase: { value: new THREE.Color('#e8c4c4') },
    uBaseMix: { value: 0 },
    uFronts: { value: new THREE.Vector3(0, 0, 0) },
    uGlint: { value: -1 },
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.42,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vNailUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNailUv = uv;')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float polish = polishMask(vNailUv);
        float baseCover = uBaseMix * edgeMask(vNailUv);
        vec3 under = mix(naturalNail(vNailUv), uBase, baseCover);
        diffuseColor.rgb = mix(under, uColor, polish);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        float paintedBefore = uBaseMix;
        roughnessFactor = mix(roughnessFactor, 0.12, max(polish, paintedBefore * edgeMask(vNailUv)));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // reflexia finală: o bandă diagonală de lumină care trece peste lac
        float g = vNailUv.y * 0.9 - vNailUv.x * 0.25;
        float glint = smoothstep(0.2, 0.0, abs(g - uGlint)) * step(-0.5, uGlint);
        totalEmissiveRadiance += vec3(1.0, 0.96, 0.97) * glint * 0.14 * max(polish, uBaseMix);`,
      )
  }
  material.customProgramCacheKey = () => 'nail-polish-v3'

  return { material, uniforms }
}
