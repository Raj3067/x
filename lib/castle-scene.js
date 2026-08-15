// ---------------------------------------------------------------------------
// Procedural Japanese castle (tenshu) — pure Three.js, no React.
//
// Kept separate from the component so the lifecycle code stays readable and this
// file can be reasoned about as plain 3D work. Only CastleScene3D imports it, and
// that import is dynamic, so this lands in the lazy chunk alongside three itself
// rather than in the shared bundle.
//
// Everything is generated in code — no models and no image files. The surface
// detail comes from castle-textures.js, which draws its albedo/normal/roughness
// maps to canvases at runtime.
//
// Density
// -------
// This is a high-poly build: roofs are swept surfaces at 96 x 18, the stone base
// is a curved batter rather than a box, and the tree canopies are subdivided
// icosahedra. It measures ~88k triangles across 145 draw calls, 116 unique
// geometries, and 11 materials. Every small repeated part — posts, balusters,
// window frames, mullions, eave brackets, lantern parts, trunks, canopies — is an
// InstancedMesh, which is what keeps 1,278 copies of those inside 20-odd calls.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import {
  buildCastleTextures,
  disposeCastleTextures,
  setTextureAnisotropy,
} from './castle-textures.js';

// Dusk palette. Deliberately kept dark: this sits behind page copy, so the
// bright horizon band is narrow and low in frame rather than filling it.
const SKY_TOP = new THREE.Color(0x140d2b);
const SKY_MID = new THREE.Color(0x452a58);
const SKY_LOW = new THREE.Color(0x8f4f45);
const FOG_COLOR = 0x2e1f38;

// Fallback colours, used only where a texture set failed to build. Where a map
// is present the material's colour is white and the map carries the tone — the
// two must not both darken the surface.
const STONE = 0x24242b;
const PLASTER = 0xc9c2b6;
const TILE = 0x1f232b;
const WOOD = 0x33241d;
const GROUND = 0x1b1a22;

const LANTERN = 0xffb45c;
const FOLIAGE = 0x24352b;
const WATER = 0x0d141d;

// Tier stack, ground floor first. `eave` is how far the roof oversails the wall
// it covers — the deep overhang is most of what reads as "Japanese castle".
// Unchanged from the low-poly build: the camera path is tuned against these
// dimensions, so the silhouette had to stay put while the surface got denser.
const TIERS = [
  { w: 4.6, h: 2.9, eave: 6.0, roof: 1.9 },
  { w: 3.9, h: 2.5, eave: 5.1, roof: 1.7 },
  { w: 3.2, h: 2.2, eave: 4.3, roof: 1.5 },
  { w: 2.6, h: 2.0, eave: 3.6, roof: 1.4 },
  { w: 2.0, h: 1.8, eave: 2.9, roof: 1.6 },
];

const STONE_H = 5.2;
const BASE_BOTTOM = 6.3; // half-width at the footing
const BASE_TOP = 5.5; // half-width where the first tier sits
const PETAL_COUNT = 900;
const LOOP_SECONDS = 132;
// Extra rotation contributed by a full page scroll, in turns. Kept well under 1
// so a long page never spins the castle round more than once.
const SCROLL_TURNS = 0.35;

// Swept-surface density. 96 around and 18 up per roof is what smooths the
// concave sweep and the upturned corners; at the old 48 x 7 the eave line was
// visibly faceted whenever the camera passed close.
const ROOF_SEGMENTS = 96;
const ROOF_RINGS = 18;
const BASE_SEGMENTS = 96;
const BASE_RINGS = 14;

// World size, in scene units, that one repeat of each texture covers. Driving
// UVs from these rather than from a per-texture `repeat` is what keeps the block
// courses the same size on the 12-unit base and on a 46-unit outer wall.
const STONE_SCALE = 6;
const PLASTER_SCALE = 5;
const WOOD_SCALE = 2.5;
const TILE_SCALE = 3;

/* --------------------------------------------------------------------------
 * Outer defences
 *
 * A real castle enceinte is three things stacked, not one slab: a battered stone
 * rampart (ishigaki), a white plaster curtain wall on top of it (dobei) framed
 * in dark timber and pierced with loopholes, and a small tiled roof capping the
 * whole run so rain never reaches the plaster. Corner turrets (sumi-yagura) sit
 * astride the junctions and a gatehouse breaks the front run.
 *
 * WALL_HALF is the distance from the centre to each run's centre line. 20.5
 * rather than anything larger because the corner turrets overhang it by 3.15 and
 * the plateau they stand on ends at radius 34: at 20.5 the outermost turret
 * corner lands at 33.4, just inside the edge. Pushing the circuit out any
 * further leaves the turrets floating over the moat.
 * ------------------------------------------------------------------------ */
const WALL_HALF = 20.5;
const WALL_PLINTH_H = 2.2; // battered stone rampart
const WALL_PLINTH_BOTTOM = 1.5; // half-depth at the footing
const WALL_PLINTH_TOP = 1.05; // half-depth where the plaster starts
const WALL_BODY_H = 2.1; // plaster curtain
const WALL_BODY_HALF = 0.9;
const WALL_TOP = WALL_PLINTH_H + WALL_BODY_H;
const WALL_CAP_HALF = 1.5; // capping roof, overhangs the plaster both sides
const WALL_CAP_RISE = 0.55;
// Spacing of the timber posts, and therefore of the loopholes between them.
const WALL_POST_SPACING = 2.3;

// Gate opening, half-width. The lantern-lined approach runs through it.
const GATE_HALF = 3.2;

const TURRET_HALF = 2.1; // plaster body half-width
const TURRET_PLINTH_H = 2.0;
const TURRET_BODY_H = 2.0;
const TURRET_ROOF_H = 1.35;
const TURRET_EAVE_HALF = 3.15;

/**
 * Sky dome. A vertex-coloured inverted sphere rather than a texture: three bands
 * blended per-vertex cost nothing to download and never show seams. Rendered
 * with depthWrite off and a huge radius so it always sits behind.
 */
function buildSky() {
  const geometry = new THREE.SphereGeometry(240, 48, 32);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const position = geometry.attributes.position;
  const tint = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    // Normalised height, -1 at the nadir to 1 at the zenith.
    const h = position.getY(i) / 240;
    if (h > 0.08) {
      tint.copy(SKY_MID).lerp(SKY_TOP, Math.min((h - 0.08) / 0.6, 1));
    } else {
      // Warm band low in frame — the last of the sunset.
      tint.copy(SKY_LOW).lerp(SKY_MID, Math.min(Math.max(h + 0.22, 0) / 0.3, 1));
    }
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  return new THREE.Mesh(geometry, material);
}

/* ---------------------------------------------------------------------------
 * Swept-surface helpers
 *
 * The keep is almost entirely square-plan surfaces of revolution: the roofs, the
 * battered stone base, the veranda floors. All of them are the same operation —
 * walk the perimeter of a square, walk a profile from bottom to top, emit a grid.
 * So it is one function, `sweepSquare`, parameterised by a profile callback.
 * ------------------------------------------------------------------------- */

/**
 * A point on the outline of a square with rounded corners, walked by perimeter
 * fraction.
 *
 * The rounding is what the low-poly version lacked: a true 90-degree corner puts
 * two coincident normals on one vertex column, and the corner reads as a crease
 * of hard specular however many segments the sweep has. `radius` is in the same
 * units as `halfWidth`.
 */
function squarePoint(fraction, halfWidth, radius, out) {
  const straight = Math.max(halfWidth - radius, 0);
  // Perimeter is 4 straight runs of 2*straight plus a full circle of arcs.
  const straightLen = straight * 2;
  const arcLen = (Math.PI / 2) * radius;
  const sideLen = straightLen + arcLen;
  const total = sideLen * 4;

  let d = ((fraction % 1) + 1) % 1;
  d *= total;

  // Which side (0..3), and how far along that side's straight+arc pair.
  const side = Math.min(Math.floor(d / sideLen), 3);
  let local = d - side * sideLen;

  let x;
  let z;
  if (local < straightLen) {
    // Along the flat, from -straight to +straight on the +Z face.
    x = -straight + local;
    z = halfWidth;
  } else {
    // Around the corner arc at (+straight, +straight).
    const a = ((local - straightLen) / arcLen) * (Math.PI / 2);
    x = straight + Math.sin(a) * radius;
    z = straight + Math.cos(a) * radius;
  }

  // Rotate into place for sides 1..3.
  const turns = side;
  for (let i = 0; i < turns; i += 1) {
    const nx = z;
    z = -x;
    x = nx;
  }

  out[0] = x;
  out[1] = z;
  return out;
}

/**
 * How close a perimeter fraction sits to a corner: 0 at a side's midpoint, 1 at
 * a corner. Drives the upturned eave tips.
 */
function cornerness(fraction) {
  const withinSide = (((fraction * 4) % 1) + 1) % 1;
  return Math.abs(withinSide - 0.5) * 2;
}

/**
 * Builds a swept square surface.
 *
 * `profile(t)` returns, for t = 0 at the bottom ring to 1 at the top:
 *   half    half-width of the square at this ring
 *   y       height of this ring
 *   radius  corner rounding at this ring
 *   lift    extra height added in proportion to `cornerness`, for upturned tips
 *
 * UVs run in world units divided by `uvScale`, so a texture keeps a constant
 * physical size no matter how large the surface is. `uAroundEave` measures u
 * from the bottom ring's perimeter for every ring, which is what makes roof tile
 * columns converge toward the ridge the way cut kawara actually do.
 */
function sweepSquare({
  segments,
  rings,
  profile,
  uvScale,
  uAroundEave = false,
  closeTop = false,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const p = [0, 0];

  const bottom = profile(0);
  const bottomPerimeter = bottom.half * 8; // rough: 4 sides of 2*half

  // v is cumulative distance up the surface, so a texture does not stretch where
  // the profile steepens. Measured on the side midpoint, which is the only place
  // the sweep has a well-defined single slope.
  const vAt = [];
  let travelled = 0;
  let prev = null;
  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const cur = profile(t);
    if (prev) {
      travelled += Math.hypot(cur.half - prev.half, cur.y - prev.y);
    }
    vAt.push(travelled);
    prev = cur;
  }

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const { half, y, radius, lift = 0 } = profile(t);

    for (let c = 0; c <= segments; c += 1) {
      const fraction = c / segments;
      squarePoint(fraction, half, radius, p);
      positions.push(p[0], y + cornerness(fraction) * lift, p[1]);

      const u = uAroundEave
        ? (fraction * bottomPerimeter) / uvScale
        : (fraction * half * 8) / uvScale;
      uvs.push(u, vAt[r] / uvScale);
    }
  }

  const stride = segments + 1;
  for (let r = 0; r < rings - 1; r += 1) {
    for (let c = 0; c < segments; c += 1) {
      const a = r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  // Cap: a fan from the centre of the top ring. Roofs need it — the ridge is a
  // small flat square, and without a cap you see straight down inside the shell.
  if (closeTop) {
    const top = profile(1);
    const centreIndex = positions.length / 3;
    positions.push(0, top.y, 0);
    uvs.push(0.5, vAt[rings - 1] / uvScale);

    const lastRing = (rings - 1) * stride;
    for (let c = 0; c < segments; c += 1) {
      indices.push(lastRing + c, centreIndex, lastRing + c + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Generated rather than hand-authored: the profile is curved, so smoothed
  // vertex normals are the only way the lighting follows the sweep.
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * One irimoya (hip-and-gable) roof shell.
 *
 * The profile is concave — shallow at the eave, steepening toward the ridge —
 * which is the single most recognisable thing about the silhouette. Corner tips
 * lift, and the lift decays toward the ridge so the flare belongs to the eave
 * only.
 */
function buildRoofShell(width, height) {
  const half = width / 2;

  return sweepSquare({
    segments: ROOF_SEGMENTS,
    rings: ROOF_RINGS,
    uvScale: TILE_SCALE,
    uAroundEave: true,
    closeTop: true,
    profile(t) {
      // Ends at 0.10 rather than 0: a true apex pinches every normal into one
      // vertex and catches a hard specular dot.
      const scale = 1 - 0.9 * t;
      return {
        half: half * scale,
        y: Math.pow(t, 1.75) * height,
        // Rounding tracks the width, so the corner radius stays proportionate as
        // the rings shrink.
        radius: Math.max(half * scale * 0.16, 0.05),
        lift: 0.5 * Math.pow(1 - t, 1.6),
      };
    },
  });
}

/**
 * The thin fascia board hanging below the eave edge. Real kawara roofs end in a
 * course of blunt tile ends over a board; without it the roof is a zero-thickness
 * sheet and reads as paper from underneath, which the camera passes under twice
 * per orbit.
 */
function buildEaveFascia(width, depth = 0.22) {
  const half = width / 2;
  return sweepSquare({
    segments: ROOF_SEGMENTS,
    rings: 2,
    uvScale: WOOD_SCALE,
    profile(t) {
      return {
        half: half * (1 - t * 0.012),
        y: -depth * t,
        radius: half * 0.16,
        lift: 0.5, // follows the tip flare so the board stays under the tiles
      };
    },
  });
}

/**
 * Hip ribs — the raised tile ridges running from each corner tip up to the apex.
 * Four per roof, each a tube along the corner line of the shell.
 *
 * Built as one geometry with four tubes merged by hand rather than four meshes:
 * five tiers x four ribs would otherwise be twenty draw calls for trim.
 */
function buildHipRibs(width, height) {
  const half = width / 2;
  const RADIAL = 8;
  const STEPS = 20;
  const tubeR = Math.max(width * 0.014, 0.045);

  const positions = [];
  const uvs = [];
  const indices = [];
  const curve = new THREE.Vector3();
  const next = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // The corner line of the shell, in the profile's own terms.
  const pointAt = (t, corner, out) => {
    const scale = 1 - 0.9 * t;
    const r = half * scale;
    const lift = 0.5 * Math.pow(1 - t, 1.6);
    const a = (corner * Math.PI) / 2 + Math.PI / 4;
    // Corners sit at the square's diagonal, at distance r*sqrt(2) from centre.
    out.set(
      Math.cos(a) * r * Math.SQRT2,
      Math.pow(t, 1.75) * height + lift + tubeR * 0.6,
      Math.sin(a) * r * Math.SQRT2,
    );
    return out;
  };

  for (let corner = 0; corner < 4; corner += 1) {
    const base = positions.length / 3;

    for (let s = 0; s <= STEPS; s += 1) {
      const t = s / STEPS;
      pointAt(t, corner, curve);
      pointAt(Math.min(t + 0.01, 1), corner, next);
      tangent.subVectors(next, curve).normalize();
      // Frenet frame from world up. The corner line never runs vertical, so up
      // is never parallel to the tangent and this cannot degenerate.
      binormal.crossVectors(tangent, up).normalize();
      normal.crossVectors(binormal, tangent).normalize();

      for (let i = 0; i <= RADIAL; i += 1) {
        const a = (i / RADIAL) * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        positions.push(
          curve.x + (normal.x * cos + binormal.x * sin) * tubeR,
          curve.y + (normal.y * cos + binormal.y * sin) * tubeR,
          curve.z + (normal.z * cos + binormal.z * sin) * tubeR,
        );
        uvs.push((i / RADIAL) * 0.5, (t * height * 2) / TILE_SCALE);
      }
    }

    const stride = RADIAL + 1;
    for (let s = 0; s < STEPS; s += 1) {
      for (let i = 0; i < RADIAL; i += 1) {
        const a = base + s * stride + i;
        const b = a + 1;
        const d = a + stride;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Chidori-hafu — the small triangular dormer gable that breaks up a roof face.
 * Two of these per tier, on opposite faces, are what stop the stack of roofs
 * reading as a wedding cake.
 *
 * Returned as a group so the caller can place and rotate it as one unit: a
 * bargeboard-framed triangular face plus its own little swept hood.
 */
function buildGable(materials, width, height) {
  const group = new THREE.Group();
  const half = width / 2;

  // The triangular tympanum, as a flat plastered face.
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), materials.plaster);
  // ShapeGeometry lays UVs out in the shape's own coordinates, which are already
  // world units here — dividing by the plaster scale gives the same texture size
  // as the walls it sits against.
  scaleUv(face.geometry, 1 / PLASTER_SCALE);
  face.castShadow = true;
  group.add(face);

  // Bargeboards: two raked timbers along the sloping edges, meeting at the peak.
  const rake = Math.hypot(half, height);
  const boardGeometry = new THREE.BoxGeometry(0.12, rake, 0.16);
  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(boardGeometry, materials.wood);
    board.position.set((-side * half) / 2, height / 2, 0.09);
    board.rotation.z = side * Math.atan2(half, height);
    group.add(board);
  }

  // A hood over the gable, sloping forward. Same sweep machinery as a roof, then
  // cut to the front half by scaling the group — cheaper and more robust than
  // authoring a half-sweep.
  const hood = new THREE.Mesh(buildRoofShell(width * 1.25, height * 0.5), materials.tile);
  hood.position.y = height * 0.06;
  hood.position.z = -width * 0.18;
  hood.castShadow = true;
  group.add(hood);

  // Gable finial — the small carved boss at the peak.
  const boss = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 12),
    materials.metal,
  );
  boss.position.set(0, height * 0.94, 0.1);
  group.add(boss);

  return group;
}

/**
 * Multiplies a geometry's UVs in place.
 *
 * Needed wherever a stock Three.js primitive wears one of the world-space
 * materials. Cylinder, Cone, Lathe, Ring, and Shape geometries all lay UVs out
 * 0..1 across the whole surface, so a 0.4-unit lantern cap would otherwise show
 * one entire masonry texture — a single block the size of the cap. Scaling by
 * worldSize / textureScale puts it back in step with the swept surfaces.
 */
function scaleUv(geometry, factor) {
  const uv = geometry.getAttribute('uv');
  if (!uv) return geometry;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, uv.getX(i) * factor, uv.getY(i) * factor);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Rewrites a box's UVs so its texture is sized in world units rather than
 * stretched to each face. BoxGeometry ships 0..1 UVs per face, which means a
 * 46-unit wall and a 1-unit post would show the same number of stone courses.
 *
 * Uses each face's own two world axes, taken from the face index: the six faces
 * come in a fixed order (+X, -X, +Y, -Y, +Z, -Z), four vertices each.
 */
function boxUvWorld(geometry, w, h, d, scale) {
  const uv = geometry.getAttribute('uv');
  if (!uv) return geometry;
  // Per-face extents in the two axes BoxGeometry's UVs run along.
  const spans = [
    [d, h], // +X
    [d, h], // -X
    [w, d], // +Y
    [w, d], // -Y
    [w, h], // +Z
    [w, h], // -Z
  ];

  for (let face = 0; face < 6; face += 1) {
    const [su, sv] = spans[face];
    for (let v = 0; v < 4; v += 1) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * su) / scale, (uv.getY(i) * sv) / scale);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Shared materials. Created once and reused across every tier — five tiers
 * pointing at one material is five fewer shader programs to compile.
 *
 * Where a texture set built successfully the base colour is white and the albedo
 * map carries the tone; multiplying a tinted colour against a toned map darkens
 * everything twice. Where it failed (no 2D context) the flat colour stands in.
 *
 * `high` gates transmission. Any transmissive material in the scene makes the
 * renderer run an extra pass over all the opaque geometry into a backdrop target,
 * every frame — a fixed cost whether one object is transmissive or fifty. It buys
 * a lot here (glowing shoji, sun through the canopies) and is worth it on the high
 * tier, but on the low tier it is the first thing to go.
 */
function buildMaterials(textures, high = true) {
  const pbr = (set, fallbackColor, extra = {}) => {
    if (!set?.map) {
      return new THREE.MeshStandardMaterial({
        color: fallbackColor,
        ...extra,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: set.map,
      normalMap: set.normalMap ?? null,
      roughnessMap: set.roughnessMap ?? null,
      // aoMap.channel defaults to 0, so this reads the same UVs as every other
      // map — no uv2 attribute needed. Intensity above 1 is deliberate: the
      // cavity map is conservative by design (floored at 0.35) and at 1.0 the
      // joints barely darken.
      aoMap: set.aoMap ?? null,
      aoMapIntensity: set.aoMap ? 1.25 : 1,
      ...extra,
    });
  };

  return {
    stone: pbr(textures.stone, STONE, { roughness: 0.95, metalness: 0 }),
    plaster: pbr(textures.plaster, PLASTER, { roughness: 0.85, metalness: 0 }),
    tile: pbr(textures.tile, TILE, {
      roughness: 0.5,
      metalness: 0.12,
      // The roof shell is open underneath and the camera passes below the eaves.
      side: THREE.DoubleSide,
    }),
    wood: pbr(textures.wood, WOOD, { roughness: 0.8, metalness: 0 }),
    ground: pbr(textures.ground, GROUND, { roughness: 1, metalness: 0 }),

    // Shoji paper: lit from inside, so it emits rather than reflects. Standard
    // rather than Basic, because the frames around it cast onto it and a Basic
    // surface would ignore them entirely.
    //
    // Physical rather than Standard here: `transmission` is what makes a paper
    // screen read as paper. Light passes through it and scatters, so the panel
    // glows from within instead of being a lit rectangle, and the mullions in
    // front of it darken it the way real ones do.
    paper: new THREE.MeshPhysicalMaterial({
      color: 0x3a2c1e,
      emissive: new THREE.Color(LANTERN),
      emissiveIntensity: 1.15,
      roughness: 0.92,
      metalness: 0,
      transmission: high ? 0.55 : 0,
      thickness: 0.06,
      ior: 1.35,
    }),

    // Patinated copper for the finials, bosses, and shachihoko. Physical for the
    // clearcoat: aged copper roofing has a thin oxide sheen over a rough body,
    // which is two different reflections and cannot be one roughness value.
    metal: new THREE.MeshPhysicalMaterial({
      color: 0x53685c,
      roughness: 0.48,
      metalness: 0.9,
      clearcoat: 0.5,
      clearcoatRoughness: 0.28,
    }),

    // Foliage. Two-sided with transmission so the sun behind a canopy lights its
    // near face — the leaf-glow that makes trees read as trees at dusk rather
    // than as dark blobs.
    foliage: new THREE.MeshPhysicalMaterial({
      color: FOLIAGE,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
      transmission: high ? 0.28 : 0,
      thickness: 0.5,
      sheen: 0.4,
      sheenColor: new THREE.Color(0x86a06a),
    }),

    water: new THREE.MeshPhysicalMaterial({
      color: WATER,
      // Very low roughness with metalness 0 and a strong clearcoat, rather than
      // the metal-mirror trick: water is a dielectric, and faking it as metal
      // tints the reflected sky toward the base colour instead of reflecting it
      // cleanly. The environment map from PMREM is what it actually reflects.
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      normalMap: textures.water?.normalMap ?? null,
      // Scale keeps the ripples shallow. At 1 the derived normals are far too
      // steep for a still moat and it reads as churning surf.
      normalScale: new THREE.Vector2(0.35, 0.35),
      // The second wave train rides on the clearcoat rather than the body. That is
      // both the physically sensible slot — the sheen of the surface film ripples
      // independently of the water beneath it — and the only way two maps can
      // scroll separately on one material without a custom shader.
      clearcoatNormalMap: textures.water?.normalMap2 ?? null,
      clearcoatNormalScale: new THREE.Vector2(0.5, 0.5),
      transparent: true,
      opacity: 0.9,
    }),
  };
}

/**
 * The battered stone base (tenshudai). A real one curves — near-vertical at the
 * top, flaring out to the footing on a concave sweep known as ogi-no-kobai, the
 * "fan slope". The low-poly build approximated it with two stacked boxes; this
 * is the actual curve, so the camera can pass close without the trick showing.
 */
function buildStoneBase(materials) {
  const geometry = sweepSquare({
    segments: BASE_SEGMENTS,
    rings: BASE_RINGS,
    uvScale: STONE_SCALE,
    profile(t) {
      // t = 0 at the footing, 1 at the top. The exponent puts most of the flare
      // in the bottom third, which is where the fan slope actually lives.
      const flare = Math.pow(1 - t, 2.2);
      return {
        half: BASE_TOP + (BASE_BOTTOM - BASE_TOP) * flare,
        y: t * STONE_H,
        radius: 0.55,
      };
    },
  });

  const base = new THREE.Mesh(geometry, materials.stone);
  base.castShadow = true;
  base.receiveShadow = true;
  return base;
}

/**
 * A veranda deck ringing a tier, with a timber balustrade.
 *
 * Posts and balusters are InstancedMesh: there are 4 x 9 balusters per tier and
 * five tiers, so as individual meshes they alone would be 180 draw calls.
 */
function buildVeranda(materials, half, thickness = 0.14) {
  const group = new THREE.Group();

  // Deck: a flat swept ring, two rings deep so it has a visible edge.
  const deck = new THREE.Mesh(
    sweepSquare({
      segments: 48,
      rings: 2,
      uvScale: WOOD_SCALE,
      profile(t) {
        return { half, y: -thickness * t, radius: half * 0.1 };
      },
    }),
    materials.wood,
  );
  deck.receiveShadow = true;
  deck.castShadow = true;
  group.add(deck);

  const RAIL_H = 0.52;
  const PER_SIDE = 9;

  // Handrail: four boxes, one per side, each spanning the full width.
  const railGeometry = boxUvWorld(
    new THREE.BoxGeometry(half * 2, 0.07, 0.09),
    half * 2,
    0.07,
    0.09,
    WOOD_SCALE,
  );
  for (let side = 0; side < 4; side += 1) {
    const rail = new THREE.Mesh(railGeometry, materials.wood);
    rail.rotation.y = (side * Math.PI) / 2;
    rail.position.y = RAIL_H;
    rail.translateZ(half - 0.06);
    group.add(rail);
  }

  // Balusters, instanced across all four sides at once.
  const balusterGeometry = new THREE.BoxGeometry(0.045, RAIL_H, 0.045);
  const balusters = new THREE.InstancedMesh(
    balusterGeometry,
    materials.wood,
    PER_SIDE * 4,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const positionVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);

  let index = 0;
  for (let side = 0; side < 4; side += 1) {
    const angle = (side * Math.PI) / 2;
    quaternion.setFromAxisAngle(axis, angle);
    for (let i = 0; i < PER_SIDE; i += 1) {
      // Spread across the side, inset from the corners so posts do not collide.
      const along = ((i + 0.5) / PER_SIDE - 0.5) * (half * 1.82);
      const depth = half - 0.06;
      // Rotate (along, depth) into the side's orientation.
      positionVec.set(
        Math.cos(angle) * along + Math.sin(angle) * depth,
        RAIL_H / 2,
        -Math.sin(angle) * along + Math.cos(angle) * depth,
      );
      matrix.compose(positionVec, quaternion, scaleVec);
      balusters.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  balusters.instanceMatrix.needsUpdate = true;
  balusters.castShadow = true;
  group.add(balusters);

  // Corner posts, carrying the rail where it turns.
  const postGeometry = new THREE.BoxGeometry(0.1, RAIL_H + 0.12, 0.1);
  const posts = new THREE.InstancedMesh(postGeometry, materials.wood, 4);
  for (let corner = 0; corner < 4; corner += 1) {
    const a = (corner * Math.PI) / 2 + Math.PI / 4;
    positionVec.set(
      Math.cos(a) * half * 1.34,
      (RAIL_H + 0.12) / 2,
      Math.sin(a) * half * 1.34,
    );
    quaternion.setFromAxisAngle(axis, a);
    matrix.compose(positionVec, quaternion, scaleVec);
    posts.setMatrixAt(corner, matrix);
  }
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  group.add(posts);

  return group;
}

/**
 * A tier's window bay: recessed shoji panels in timber frames with mullions.
 *
 * The low-poly build used a bare lit plane per opening. At the density the camera
 * now gets to, a window needs three things to read: a frame that stands proud of
 * the wall, a paper panel set back inside it so the frame casts onto the paper,
 * and mullions dividing the panel into a grid.
 *
 * Frames, panels, and mullions are each one InstancedMesh across all four faces.
 */
function buildWindows(materials, tier, y) {
  const group = new THREE.Group();
  const wallW = tier.w * 2;

  const panelCount = Math.max(2, Math.round(tier.w * 1.6));
  const panelW = (wallW * 0.6) / panelCount;
  const panelH = Math.min(tier.h * 0.44, 0.86);
  const panelY = y + tier.h * 0.5;
  const pitch = panelW * 1.7;

  const total = panelCount * 4;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const positionVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);

  // Frame: a slab slightly larger than the opening, standing 6cm off the wall.
  const frameGeometry = boxUvWorld(
    new THREE.BoxGeometry(panelW + 0.14, panelH + 0.14, 0.07),
    panelW + 0.14,
    panelH + 0.14,
    0.07,
    WOOD_SCALE,
  );
  const frames = new THREE.InstancedMesh(frameGeometry, materials.wood, total);

  // Paper, set back behind the frame face.
  const paperGeometry = new THREE.PlaneGeometry(panelW, panelH);
  const papers = new THREE.InstancedMesh(paperGeometry, materials.paper, total);

  // Mullions: 2 vertical + 3 horizontal per panel.
  const MULLION_V = 2;
  const MULLION_H = 3;
  const mullionCount = total * (MULLION_V + MULLION_H);
  const mullionGeometry = new THREE.BoxGeometry(1, 1, 0.03);
  const mullions = new THREE.InstancedMesh(
    mullionGeometry,
    materials.wood,
    mullionCount,
  );

  let index = 0;
  let mullionIndex = 0;

  for (let face = 0; face < 4; face += 1) {
    const angle = (face * Math.PI) / 2;
    quaternion.setFromAxisAngle(axis, angle);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Places a point given its offset along the face and its depth out from the
    // wall centre, in that face's own frame.
    const place = (along, depth, height, target) => {
      target.set(cos * along + sin * depth, height, -sin * along + cos * depth);
    };

    for (let p = 0; p < panelCount; p += 1) {
      const along = (p - (panelCount - 1) / 2) * pitch;

      place(along, wallW / 2 + 0.035, panelY, positionVec);
      matrix.compose(positionVec, quaternion, scaleVec);
      frames.setMatrixAt(index, matrix);

      // Paper sits 2cm behind the frame's outer face — enough for the frame lip
      // to throw a shadow line across it at grazing sun angles.
      place(along, wallW / 2 + 0.05, panelY, positionVec);
      matrix.compose(positionVec, quaternion, scaleVec);
      papers.setMatrixAt(index, matrix);

      index += 1;

      // Mullion grid, in front of the paper.
      const mullionDepth = wallW / 2 + 0.062;
      for (let v = 0; v < MULLION_V; v += 1) {
        const dx = ((v + 1) / (MULLION_V + 1) - 0.5) * panelW;
        place(along + dx, mullionDepth, panelY, positionVec);
        scaleVec.set(0.022, panelH, 1);
        matrix.compose(positionVec, quaternion, scaleVec);
        mullions.setMatrixAt(mullionIndex, matrix);
        mullionIndex += 1;
      }
      for (let h = 0; h < MULLION_H; h += 1) {
        const dy = ((h + 1) / (MULLION_H + 1) - 0.5) * panelH;
        place(along, mullionDepth, panelY + dy, positionVec);
        scaleVec.set(panelW, 0.022, 1);
        matrix.compose(positionVec, quaternion, scaleVec);
        mullions.setMatrixAt(mullionIndex, matrix);
        mullionIndex += 1;
      }
      scaleVec.set(1, 1, 1);
    }
  }

  frames.instanceMatrix.needsUpdate = true;
  papers.instanceMatrix.needsUpdate = true;
  mullions.instanceMatrix.needsUpdate = true;
  frames.castShadow = true;

  group.add(frames, papers, mullions);
  return group;
}

/**
 * The keep: battered stone base, then the stacked tiers. Each tier is a walled
 * box with a veranda, a window bay, two dormer gables, and a roof that oversails
 * it — plus the hip ribs and eave fascia that make the roof read as tiled rather
 * than as a shell.
 */
function buildKeep(materials) {
  const group = new THREE.Group();
  group.add(buildStoneBase(materials));

  let y = STONE_H;

  for (let i = 0; i < TIERS.length; i += 1) {
    const tier = TIERS[i];
    const wallW = tier.w * 2;

    // Wall. Slightly tapered like the base, but far more subtly — real upper
    // storeys lean in a little and the taper catches the light along each corner.
    const wall = new THREE.Mesh(
      sweepSquare({
        segments: 48,
        rings: 4,
        uvScale: PLASTER_SCALE,
        profile(t) {
          return {
            half: tier.w * (1 - t * 0.02),
            y: t * tier.h,
            radius: 0.14,
          };
        },
      }),
      materials.plaster,
    );
    wall.position.y = y;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Veranda at the floor line, sized to sit inside the roof above it.
    const veranda = buildVeranda(materials, tier.w + 0.42);
    veranda.position.y = y + 0.02;
    group.add(veranda);

    // Exposed timber band where the wall meets the deck.
    const band = new THREE.Mesh(
      boxUvWorld(
        new THREE.BoxGeometry(wallW + 0.1, 0.2, wallW + 0.1),
        wallW + 0.1,
        0.2,
        wallW + 0.1,
        WOOD_SCALE,
      ),
      materials.wood,
    );
    band.position.y = y + tier.h - 0.13;
    band.castShadow = true;
    group.add(band);

    group.add(buildWindows(materials, tier, y));

    // Bracket blocks under the eave — the visible ends of the beams carrying the
    // overhang. Instanced: 14 per side, 4 sides, on every tier.
    group.add(buildEaveBrackets(materials, tier, y));

    const roofY = y + tier.h;

    const roof = new THREE.Mesh(buildRoofShell(tier.eave, tier.roof), materials.tile);
    roof.position.y = roofY;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    const fascia = new THREE.Mesh(buildEaveFascia(tier.eave), materials.wood);
    fascia.position.y = roofY;
    group.add(fascia);

    const ribs = new THREE.Mesh(buildHipRibs(tier.eave, tier.roof), materials.tile);
    ribs.position.y = roofY;
    ribs.castShadow = true;
    group.add(ribs);

    // Dormer gables. Skipped on the top tier, which gets the shachihoko ridge
    // instead — putting both there crowds the silhouette's one clean peak.
    if (i < TIERS.length - 1) {
      const gableW = tier.eave * 0.42;
      const gableH = tier.roof * 0.85;
      for (const face of [0, 2]) {
        const gable = buildGable(materials, gableW, gableH);
        gable.rotation.y = (face * Math.PI) / 2;
        gable.position.y = roofY + tier.roof * 0.12;
        // Out along the roof face, far enough that the hood clears the tiles.
        gable.translateZ(tier.eave * 0.3);
        group.add(gable);
      }
    }

    y += tier.h;
  }

  group.add(buildRidgeCrown(materials, y + TIERS[TIERS.length - 1].roof));

  return group;
}

/**
 * Kioroshi — the row of bracket blocks under an eave, reading as the ends of the
 * beams that carry the overhang. One InstancedMesh per tier.
 */
function buildEaveBrackets(materials, tier, y) {
  const PER_SIDE = 14;
  const geometry = boxUvWorld(
    new THREE.BoxGeometry(0.1, 0.14, 0.4),
    0.1,
    0.14,
    0.4,
    WOOD_SCALE,
  );
  const mesh = new THREE.InstancedMesh(geometry, materials.wood, PER_SIDE * 4);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const positionVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);

  // Just under the eave line, projecting out past the wall.
  const height = y + tier.h - 0.03;
  const reach = tier.w + (tier.eave / 2 - tier.w) * 0.45;

  let index = 0;
  for (let side = 0; side < 4; side += 1) {
    const angle = (side * Math.PI) / 2;
    quaternion.setFromAxisAngle(axis, angle);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = 0; i < PER_SIDE; i += 1) {
      const along = ((i + 0.5) / PER_SIDE - 0.5) * (tier.w * 2.1);
      positionVec.set(cos * along + sin * reach, height, -sin * along + cos * reach);
      matrix.compose(positionVec, quaternion, scaleVec);
      mesh.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}

/**
 * The ridge crown: a tiled ridge beam with a shachihoko — the mythical carp-tiger
 * — at each end, in patinated copper. This is the one piece of the silhouette a
 * viewer will actually recognise as a castle rather than a pagoda, so it is worth
 * the geometry despite being small in frame.
 */
function buildRidgeCrown(materials, y) {
  const group = new THREE.Group();

  const ridge = new THREE.Mesh(
    // Stock CylinderGeometry lays UVs 0..1, so it needs scaling into the tile
    // material's world-space convention or the ridge shows one giant tile.
    scaleUv(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 16), 1.5 / TILE_SCALE),
    materials.tile,
  );
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = y + 0.06;
  ridge.castShadow = true;
  group.add(ridge);

  for (const side of [-1, 1]) {
    // Body: a lathe-turned taper, tail up. LatheGeometry is the cheapest way to
    // get a fish silhouette with smooth normals.
    const points = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      // Fat at the head, pinching to the tail.
      const r = Math.sin(t * Math.PI * 0.9) * 0.17 + 0.02;
      points.push(new THREE.Vector2(r, t * 0.62));
    }
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(points, 20),
      materials.metal,
    );
    body.position.set(side * 0.75, y + 0.04, 0);
    // Leaning outward, head down, the way they are always mounted.
    body.rotation.z = side * -0.35;
    body.castShadow = true;
    group.add(body);

    // Tail fin: a flattened cone splayed at the top.
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.3, 10, 1, true),
      materials.metal,
    );
    fin.scale.set(1, 1, 0.32);
    fin.position.set(side * 0.9, y + 0.68, 0);
    fin.rotation.z = side * -0.5;
    group.add(fin);
  }

  return group;
}

/**
 * Extrudes a 2D outline along X.
 *
 * `outline` is a list of [z, y] points describing the cross-section. Every wall
 * run in the circuit is one of these swept down its length, which is a much
 * better fit than a box: a rampart batters inward as it rises and a capping roof
 * is a shallow gable, neither of which a BoxGeometry can be.
 *
 * Vertices are shared along the outline, so a curved run of points shades
 * smoothly. To keep a hard edge — the top arris of a rampart, the ridge of a cap
 * roof — repeat the point: the two copies are separate vertices at the same
 * place, so no normal is averaged across them and the degenerate quad between
 * them contributes nothing.
 *
 * UVs come out in world units over `uvScale`, matching every swept surface in the
 * scene, so a run of masonry has the same course height as the keep's base.
 */
function extrudeAlongX(outline, length, uvScale) {
  const half = length / 2;
  const positions = [];
  const uvs = [];
  const indices = [];

  // v is cumulative distance along the cross-section, so the texture does not
  // stretch where the outline steepens.
  let travelled = 0;
  for (let i = 0; i < outline.length; i += 1) {
    if (i > 0) {
      travelled += Math.hypot(
        outline[i][0] - outline[i - 1][0],
        outline[i][1] - outline[i - 1][1],
      );
    }
    const [z, y] = outline[i];
    positions.push(-half, y, z, half, y, z);
    uvs.push(0, travelled / uvScale, length / uvScale, travelled / uvScale);
  }

  for (let i = 0; i < outline.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Cross-section of a battered rampart: concave sides flaring to the footing, a
 * flat top, and a crease where the two meet.
 *
 * Same fan-slope curve as the keep's own base, so the outer defences read as
 * built by the same hands. Returns points from the outer footing up over the top
 * and back down to the inner footing.
 */
function batteredOutline(bottom, top, height, steps = 5) {
  const outline = [];
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const flare = Math.pow(1 - t, 2.2);
    outline.push([-(top + (bottom - top) * flare), t * height]);
  }
  // Repeated top points crease the arris instead of rounding it over.
  outline.push([-top, height], [top, height]);
  for (let s = steps; s >= 0; s -= 1) {
    const t = s / steps;
    const flare = Math.pow(1 - t, 2.2);
    outline.push([top + (bottom - top) * flare, t * height]);
  }
  return outline;
}
/**
 * Cross-section of the capping roof over a wall run: a shallow symmetric gable
 * with a blunt fascia on each eave.
 *
 * The ridge point is repeated so the apex stays a crease. The fascia is what
 * stops the cap reading as a folded sheet when the camera looks along a run.
 */
function capOutline(halfWidth, baseY, rise) {
  return [
    [-halfWidth, baseY - 0.06],
    [-halfWidth, baseY + 0.03],
    [0, baseY + rise],
    [0, baseY + rise],
    [halfWidth, baseY + 0.03],
    [halfWidth, baseY - 0.06],
  ];
}

/**
 * One length of curtain wall (dobei), built at the origin running along X.
 *
 * Four parts: the battered stone rampart, the plaster curtain above it, a timber
 * rail across the joint between them, and the tiled cap. Posts and loopholes are
 * not here — buildWallCircuit instances those across the whole circuit at once,
 * because there are over a hundred and one draw call each is the point.
 *
 * The circuit has only two distinct run lengths, so the caller caches templates
 * by length and clones them. Mesh.clone shares geometry and material, and the
 * dispose sweep already de-duplicates shared geometries.
 */
function buildWallRun(materials, length) {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(
    extrudeAlongX(
      batteredOutline(WALL_PLINTH_BOTTOM, WALL_PLINTH_TOP, WALL_PLINTH_H),
      length,
      STONE_SCALE,
    ),
    materials.stone,
  );
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const body = new THREE.Mesh(
    boxUvWorld(
      new THREE.BoxGeometry(length, WALL_BODY_H, WALL_BODY_HALF * 2),
      length,
      WALL_BODY_H,
      WALL_BODY_HALF * 2,
      PLASTER_SCALE,
    ),
    materials.plaster,
  );
  body.position.y = WALL_PLINTH_H + WALL_BODY_H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Nageshi — the horizontal timber rail along the foot of the plaster. Stands
  // proud of both faces, which also hides the joint where plaster meets stone.
  const rail = new THREE.Mesh(
    boxUvWorld(
      new THREE.BoxGeometry(length, 0.17, WALL_BODY_HALF * 2 + 0.16),
      length,
      0.17,
      WALL_BODY_HALF * 2 + 0.16,
      WOOD_SCALE,
    ),
    materials.wood,
  );
  rail.position.y = WALL_PLINTH_H + 0.12;
  rail.castShadow = true;
  group.add(rail);

  const cap = new THREE.Mesh(
    extrudeAlongX(
      capOutline(WALL_CAP_HALF, WALL_TOP, WALL_CAP_RISE),
      // Slight overrun at each end so consecutive runs never show a seam of sky
      // between their caps; the turrets and gate cover the joints anyway.
      length + 0.3,
      TILE_SCALE,
    ),
    materials.tile,
  );
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  return group;
}

/**
 * Sumi-yagura — a corner turret, built at the origin.
 *
 * Straddles the junction of two wall runs, which is both how they were actually
 * built (the corner is the weak point, so you put the guard post there) and what
 * saves the model from four visible mitre joints. Reuses the keep's own roof
 * shell, fascia, and hip ribs at a smaller scale, so the turrets read as smaller
 * siblings of the tower rather than as different architecture.
 */
function buildCornerTurret(materials) {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(
    sweepSquare({
      segments: 40,
      rings: 8,
      uvScale: STONE_SCALE,
      profile(t) {
        const flare = Math.pow(1 - t, 2.2);
        return {
          half: TURRET_HALF + 0.55 + 0.5 * flare,
          y: t * TURRET_PLINTH_H,
          radius: 0.35,
        };
      },
    }),
    materials.stone,
  );
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const body = new THREE.Mesh(
    boxUvWorld(
      new THREE.BoxGeometry(TURRET_HALF * 2, TURRET_BODY_H, TURRET_HALF * 2),
      TURRET_HALF * 2,
      TURRET_BODY_H,
      TURRET_HALF * 2,
      PLASTER_SCALE,
    ),
    materials.plaster,
  );
  body.position.y = TURRET_PLINTH_H + TURRET_BODY_H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof, sitting on the plaster. Same builders as the keep's tiers.
  const roofY = TURRET_PLINTH_H + TURRET_BODY_H;
  const roof = new THREE.Mesh(
    buildRoofShell(TURRET_EAVE_HALF * 2, TURRET_ROOF_H),
    materials.tile,
  );
  roof.position.y = roofY;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const fascia = new THREE.Mesh(
    buildEaveFascia(TURRET_EAVE_HALF * 2),
    materials.wood,
  );
  fascia.position.y = roofY;
  fascia.castShadow = true;
  group.add(fascia);

  const ribs = new THREE.Mesh(
    buildHipRibs(TURRET_EAVE_HALF * 2, TURRET_ROOF_H),
    materials.tile,
  );
  ribs.position.y = roofY;
  ribs.castShadow = true;
  group.add(ribs);

  // Lit window on each of the two outward faces. Emissive paper only — a turret
  // is small enough that a full frame-and-mullion assembly would never be read.
  const paneGeometry = new THREE.PlaneGeometry(1.15, 0.85);
  for (const rotation of [0, Math.PI / 2]) {
    const pane = new THREE.Mesh(paneGeometry, materials.paper);
    pane.position.y = TURRET_PLINTH_H + TURRET_BODY_H * 0.55;
    pane.rotation.y = rotation;
    pane.translateZ(TURRET_HALF + 0.01);
    group.add(pane);
  }

  const finial = new THREE.Mesh(
    scaleUv(new THREE.ConeGeometry(0.2, 0.5, 8), 0.5 / STONE_SCALE),
    materials.metal,
  );
  finial.position.y = roofY + TURRET_ROOF_H + 0.2;
  group.add(finial);

  return group;
}

/**
 * The gatehouse (yaguramon) straddling the gap in the front run: two stone piers,
 * a timber lintel, a plaster chamber over the opening, and its own tiled roof.
 *
 * Placed on the +Z run because that is where the lantern-lined approach already
 * runs — a gate anywhere else would leave the lanterns pointing at solid wall.
 */
function buildGatehouse(materials) {
  const group = new THREE.Group();

  const PIER_W = 1.5;
  const PIER_H = WALL_TOP;

  const pierGeometry = boxUvWorld(
    new THREE.BoxGeometry(PIER_W, PIER_H, 2.6),
    PIER_W,
    PIER_H,
    2.6,
    STONE_SCALE,
  );
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(pierGeometry, materials.stone);
    pier.position.set(side * (GATE_HALF + PIER_W / 2), PIER_H / 2, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
  }

  // Lintel across the opening, sitting on the piers.
  const span = (GATE_HALF + PIER_W) * 2;
  const lintel = new THREE.Mesh(
    boxUvWorld(
      new THREE.BoxGeometry(span, 0.45, 2.2),
      span,
      0.45,
      2.2,
      WOOD_SCALE,
    ),
    materials.wood,
  );
  lintel.position.y = PIER_H + 0.225;
  lintel.castShadow = true;
  group.add(lintel);

  // Chamber above the gate — the part that makes it a gate tower rather than a
  // hole in a wall. Its floor is the lintel, so the wall walk runs through it.
  const CHAMBER_H = 2.4;
  const chamber = new THREE.Mesh(
    boxUvWorld(
      new THREE.BoxGeometry(span, CHAMBER_H, 2.0),
      span,
      CHAMBER_H,
      2.0,
      PLASTER_SCALE,
    ),
    materials.plaster,
  );
  chamber.position.y = PIER_H + 0.45 + CHAMBER_H / 2;
  chamber.castShadow = true;
  chamber.receiveShadow = true;
  group.add(chamber);

  // Three lit windows across the chamber's outward face.
  const paneGeometry = new THREE.PlaneGeometry(0.8, 1.0);
  for (let i = -1; i <= 1; i += 1) {
    const pane = new THREE.Mesh(paneGeometry, materials.paper);
    pane.position.set(i * 2.1, PIER_H + 0.45 + CHAMBER_H * 0.55, 1.01);
    group.add(pane);
  }

  const roofY = PIER_H + 0.45 + CHAMBER_H;
  const roofWidth = span + 2.2;
  const roof = new THREE.Mesh(
    buildRoofShell(roofWidth, 1.5),
    materials.tile,
  );
  roof.position.y = roofY;
  // Squashed on Z: the chamber is a long thin box, so a square roof would sit on
  // it like a hat two sizes too big.
  roof.scale.z = 0.44;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const fascia = new THREE.Mesh(buildEaveFascia(roofWidth), materials.wood);
  fascia.position.y = roofY;
  fascia.scale.z = 0.44;
  fascia.castShadow = true;
  group.add(fascia);

  return group;
}

/**
 * The whole enceinte: four curtain-wall runs with a gate breaking the front one,
 * four corner turrets, and the timber posts and loopholes instanced across every
 * run at once.
 *
 * Layout is a square with its runs' centre lines at WALL_HALF, so a run spans
 * corner to corner at 2 * WALL_HALF, and the turrets sit astride the corners. The
 * front (+Z) run is split either side of the gate piers.
 *
 * Draw calls: 4 per wall run x 5 runs, plus the turrets and gate, plus exactly
 * two for all 260-odd posts and loopholes. Geometry for the two distinct run
 * lengths is built once and shared by cloning, so the 41-unit template is one
 * geometry no matter how many runs use it.
 */
function buildWallCircuit(materials) {
  const group = new THREE.Group();

  const SIDE = WALL_HALF * 2;
  // Where a split run starts: outside the gate pier.
  const GATE_EDGE = GATE_HALF + 1.5;
  const SPLIT = (WALL_HALF - GATE_EDGE) / 2 + GATE_EDGE; // centre of a half run
  const SPLIT_LEN = WALL_HALF - GATE_EDGE;

  // Each run: half-length, and where its centre sits, and which way it faces.
  // Angle is the rotation about Y that takes local +X along the run.
  const runs = [
    // Back and the two sides: full length, corner to corner.
    { length: SIDE, x: 0, z: -WALL_HALF, angle: 0 },
    { length: SIDE, x: -WALL_HALF, z: 0, angle: Math.PI / 2 },
    { length: SIDE, x: WALL_HALF, z: 0, angle: Math.PI / 2 },
    // Front, split either side of the gate.
    { length: SPLIT_LEN, x: -SPLIT, z: WALL_HALF, angle: 0 },
    { length: SPLIT_LEN, x: SPLIT, z: WALL_HALF, angle: 0 },
  ];

  // One template per distinct length, cloned for the rest. Mesh.clone shares
  // geometry and material, and the dispose sweep de-duplicates by geometry.
  const templates = new Map();
  for (const run of runs) {
    let template = templates.get(run.length);
    if (!template) {
      template = buildWallRun(materials, run.length);
      templates.set(run.length, template);
      group.add(template);
      template.position.set(run.x, 0, run.z);
      template.rotation.y = run.angle;
      continue;
    }
    const clone = template.clone();
    clone.position.set(run.x, 0, run.z);
    clone.rotation.y = run.angle;
    group.add(clone);
  }

  // Turrets astride the four corners.
  const turret = buildCornerTurret(materials);
  for (const [i, corner] of [
    [-WALL_HALF, -WALL_HALF],
    [WALL_HALF, -WALL_HALF],
    [-WALL_HALF, WALL_HALF],
    [WALL_HALF, WALL_HALF],
  ].entries()) {
    const instance = i === 0 ? turret : turret.clone();
    instance.position.set(corner[0], 0, corner[1]);
    group.add(instance);
  }

  const gate = buildGatehouse(materials);
  gate.position.z = WALL_HALF;
  group.add(gate);

  /* ------------------------------------------------------------------------
   * Posts and loopholes, instanced across every run.
   *
   * Posts (hashira) stand on both faces of the plaster at WALL_POST_SPACING;
   * loopholes (sama) sit between them, inset into the face. Alternating square
   * and diamond is the yazama / teppozama pair — arrow slits and gun ports.
   *
   * Counted first, then filled: InstancedMesh needs its count up front, and
   * getting it wrong either throws or leaves unset identity matrices stacked at
   * the origin.
   * --------------------------------------------------------------------- */
  const postSpans = runs.map((run) =>
    Math.max(2, Math.floor(run.length / WALL_POST_SPACING)),
  );
  const postCount = postSpans.reduce((sum, n) => sum + (n + 1) * 2, 0);
  const holeCount = postSpans.reduce((sum, n) => sum + n * 2, 0);

  const postGeometry = boxUvWorld(
    new THREE.BoxGeometry(0.16, WALL_BODY_H, 0.1),
    0.16,
    WALL_BODY_H,
    0.1,
    WOOD_SCALE,
  );
  const holeGeometry = boxUvWorld(
    new THREE.BoxGeometry(0.3, 0.3, 0.14),
    0.3,
    0.3,
    0.14,
    WOOD_SCALE,
  );

  const posts = new THREE.InstancedMesh(
    postGeometry,
    materials.wood,
    postCount,
  );
  // Dark timber shutters standing in for openings. A real hole would need the
  // plaster punched through, and at this size the difference does not survive
  // being seen from thirty units away.
  const holes = new THREE.InstancedMesh(holeGeometry, materials.wood, holeCount);
  posts.castShadow = true;
  holes.castShadow = true;

  const runMatrix = new THREE.Matrix4();
  const localMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const positionVec = new THREE.Vector3();
  const unitScale = new THREE.Vector3(1, 1, 1);

  let postIndex = 0;
  let holeIndex = 0;

  for (const [r, run] of runs.entries()) {
    euler.set(0, run.angle, 0);
    runMatrix.compose(
      positionVec.set(run.x, 0, run.z),
      quaternion.setFromEuler(euler),
      unitScale,
    );

    const spans = postSpans[r];
    const step = run.length / spans;
    const start = -run.length / 2;

    for (const face of [-1, 1]) {
      // Posts: one at each span boundary, so the ends of a run are posted.
      for (let i = 0; i <= spans; i += 1) {
        localMatrix.makeTranslation(
          start + i * step,
          WALL_PLINTH_H + WALL_BODY_H / 2,
          face * (WALL_BODY_HALF + 0.05),
        );
        worldMatrix.multiplyMatrices(runMatrix, localMatrix);
        posts.setMatrixAt(postIndex, worldMatrix);
        postIndex += 1;
      }

      // Loopholes: midway between posts, alternating square and diamond.
      for (let i = 0; i < spans; i += 1) {
        euler.set(0, 0, i % 2 === 0 ? 0 : Math.PI / 4);
        localMatrix.compose(
          positionVec.set(
            start + (i + 0.5) * step,
            WALL_PLINTH_H + WALL_BODY_H * 0.62,
            face * (WALL_BODY_HALF - 0.02),
          ),
          quaternion.setFromEuler(euler),
          unitScale,
        );
        worldMatrix.multiplyMatrices(runMatrix, localMatrix);
        holes.setMatrixAt(holeIndex, worldMatrix);
        holeIndex += 1;
      }
    }
  }

  posts.instanceMatrix.needsUpdate = true;
  holes.instanceMatrix.needsUpdate = true;
  group.add(posts, holes);

  return group;
}

/**
 * Grounds the keep: a stone plateau, a moat, the outer wall, stone lanterns, and
 * trees. Without these the castle floats and the flythrough has nothing to give
 * the camera a sense of speed.
 */
function buildGrounds(materials) {
  const group = new THREE.Group();

  // Plateau. 96 sides rather than the old 6, so its edge never reads as a
  // hexagon when the camera drops near ground level.
  const plateau = new THREE.Mesh(
    scaleUv(
      new THREE.CylinderGeometry(34, 40, 3.2, 96, 4),
      // The ground map's own repeat of 14 already covers this surface; the UV
      // scale here only has to stop the 80-unit cap reading as one repeat.
      6,
    ),
    materials.ground,
  );
  plateau.position.y = -1.6;
  plateau.receiveShadow = true;
  group.add(plateau);

  // Moat: a flat ring outside the plateau. Its ripples come from scrolling the
  // shared water normal map in update(), so nothing here needs a handle to it.
  // RingGeometry lays UVs 0..1 across a 156-unit span, which would stretch one
  // ripple over the whole moat — scaled up so the ripples stay ripple-sized.
  const moat = new THREE.Mesh(
    scaleUv(new THREE.RingGeometry(40, 78, 128, 1), 9),
    materials.water,
  );
  moat.rotation.x = -Math.PI / 2;
  moat.position.y = -2.6;
  group.add(moat);

  // Outer defences: rampart, plaster curtain, capping roof, corner turrets, and
  // a gatehouse on the approach. Replaces the four bare slabs this used to have —
  // those read as a low garden wall, not as fortification.
  group.add(buildWallCircuit(materials));

  group.add(buildLanterns(materials));
  group.add(...buildTrees(materials));

  return group;
}

/**
 * Ishidoro — stone lanterns lining the approach. Six of them, each five parts:
 * base, shaft, platform, light box, and cap. All five parts are instanced across
 * all six lanterns, so the whole set is five draw calls rather than thirty.
 */
function buildLanterns(materials) {
  const group = new THREE.Group();
  const COUNT = 6;

  const spots = [];
  for (let i = 0; i < COUNT; i += 1) {
    // Two rows flanking the approach on the +Z side. The spacing skips the band
    // the front wall occupies: the rampart's inner face is at WALL_HALF minus its
    // footing half-depth (19.0) and its cap's outer edge at 22.0, so the middle
    // pair sits at 17.7 — inside the gate — and the outer pair at 23.9, just
    // beyond it on the approach.
    const side = i % 2 === 0 ? -1 : 1;
    const along = 11.5 + Math.floor(i / 2) * 6.2;
    spots.push({ x: side * 5.4, z: along });
  }

  // Each part's UVs are scaled by its own world size over the stone texture's
  // scale, so a 0.4-unit cap shows a 0.4-unit patch of masonry rather than one
  // whole block stretched over it. The paper light box is left alone — its
  // material has no map, only emission.
  const parts = [
    // geometry, y offset from the ground, material
    {
      geo: scaleUv(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 16), 1 / STONE_SCALE),
      y: 0.15,
      mat: materials.stone,
    },
    {
      geo: scaleUv(new THREE.CylinderGeometry(0.16, 0.2, 1.15, 12), 1 / STONE_SCALE),
      y: 0.87,
      mat: materials.stone,
    },
    {
      geo: scaleUv(new THREE.CylinderGeometry(0.42, 0.3, 0.14, 16), 1 / STONE_SCALE),
      y: 1.51,
      mat: materials.stone,
    },
    { geo: new THREE.BoxGeometry(0.44, 0.44, 0.44), y: 1.8, mat: materials.paper },
    {
      geo: scaleUv(new THREE.ConeGeometry(0.5, 0.34, 4), 1 / STONE_SCALE),
      y: 2.19,
      mat: materials.stone,
    },
  ];

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const positionVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);

  for (const part of parts) {
    const mesh = new THREE.InstancedMesh(part.geo, part.mat, COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      positionVec.set(spots[i].x, part.y, spots[i].z);
      // Rotate each lantern a little so the square caps do not all align.
      quaternion.setFromAxisAngle(axis, (i * Math.PI) / 7);
      matrix.compose(positionVec, quaternion, scaleVec);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

/**
 * Trees ringing the grounds. Deterministic placement — a seeded angle walk rather
 * than Math.random(), so the scene looks identical on every load and there is no
 * chance of a trunk landing in front of the keep on some visits only.
 *
 * Trunks are tapered cylinders and canopies are twice-subdivided icosahedra with
 * per-vertex displacement, so no two canopies are the same shape. Both are
 * instanced, which is what makes 34 trees cost two draw calls.
 */
function buildTrees(materials) {
  const COUNT = 34;

  // Trunk UVs scaled so the grain runs at its real size — 1.9 units of height
  // over the wood texture's scale, rather than one whole texture per trunk.
  const trunkGeometry = scaleUv(
    new THREE.CylinderGeometry(0.14, 0.26, 1.9, 10, 3),
    1.9 / WOOD_SCALE,
  );

  // One canopy geometry, displaced once. Instancing means every tree shares the
  // shape; the per-instance scale and rotation below are what break up the repeat.
  const canopyGeometry = new THREE.IcosahedronGeometry(1.2, 2);
  const cPos = canopyGeometry.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < cPos.count; i += 1) {
    v.fromBufferAttribute(cPos, i);
    // Lumpy but still convex — trig on the direction, so it is seamless.
    const bump =
      1 +
      Math.sin(v.x * 3.1 + v.y * 1.7) * 0.11 +
      Math.sin(v.z * 2.4 - v.y * 2.9) * 0.09;
    v.multiplyScalar(bump);
    cPos.setXYZ(i, v.x, v.y, v.z);
  }
  canopyGeometry.computeVertexNormals();

  const trunks = new THREE.InstancedMesh(trunkGeometry, materials.wood, COUNT);
  const canopies = new THREE.InstancedMesh(canopyGeometry, materials.foliage, COUNT);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const positionVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < COUNT; i += 1) {
    const angle = i * 2.399963; // golden angle, spreads without clustering
    // Outside the enceinte. The circuit's widest point is a corner turret's eave
    // at radius 23.65, and the plateau ends at 34 — so the band is 25 to 32,
    // which also stops a canopy poking through a curtain wall from behind.
    const radius = 25 + ((i * 7) % 8);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scale = 0.8 + ((i % 5) * 0.12);

    quaternion.setFromAxisAngle(axis, angle);

    positionVec.set(x, 0.95, z);
    scaleVec.set(1, 1, 1);
    matrix.compose(positionVec, quaternion, scaleVec);
    trunks.setMatrixAt(i, matrix);

    // Canopy centre and radius here must stay in step with the camera-clearance
    // check in cameraAt: centre 2.2 + scale*0.4, radius 1.2*scale (plus the
    // displacement above, which stays under 1.2).
    positionVec.set(x, 2.2 + scale * 0.4, z);
    scaleVec.setScalar(scale);
    matrix.compose(positionVec, quaternion, scaleVec);
    canopies.setMatrixAt(i, matrix);
  }

  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  canopies.castShadow = true;

  return [trunks, canopies];
}

/**
 * Petal sprite, drawn to a canvas at runtime. A 96px canvas beats shipping a
 * PNG: no request, no decode, and it scales with DPR anyway since Points are
 * screen-space sized.
 */
function buildPetalTexture() {
  // Same guard as makeCanvas in castle-textures: a headless import must fall back
  // to an untextured sprite rather than throwing.
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Soft radial falloff so the edges never look like clipped squares.
  const gradient = ctx.createRadialGradient(48, 48, 3, 48, 48, 45);
  gradient.addColorStop(0, 'rgba(255, 232, 240, 1)');
  gradient.addColorStop(0.45, 'rgba(255, 186, 208, 0.88)');
  gradient.addColorStop(1, 'rgba(255, 183, 206, 0)');

  ctx.fillStyle = gradient;
  // Ellipse rather than a circle — reads as a petal at small sizes.
  ctx.beginPath();
  ctx.ellipse(48, 48, 45, 30, Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();

  // Notch at the tip: the one detail that separates a sakura petal from a blob.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(78, 62, 11, 8, Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Falling sakura. One Points cloud; motion is computed per frame on the CPU,
 * which is fine at this count and avoids a custom shader.
 *
 * Petals wrap rather than respawn: each one has its own fall speed and drift
 * phase, and its height is `startY - (t * speed) mod span`, so the field is
 * seamless and stateless — no per-frame branching to recycle anything.
 */
function buildPetals(texture) {
  const positions = new Float32Array(PETAL_COUNT * 3);
  const seeds = new Float32Array(PETAL_COUNT * 3); // speed, phase, swayScale

  for (let i = 0; i < PETAL_COUNT; i += 1) {
    // Deterministic pseudo-random: same trig trick every load, no Math.random.
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.6789;
    const c = Math.sin(i * 39.425) * 24634.6345;
    const rx = a - Math.floor(a);
    const rz = b - Math.floor(b);
    const ry = c - Math.floor(c);

    positions[i * 3] = (rx - 0.5) * 90;
    positions[i * 3 + 1] = ry * 46;
    positions[i * 3 + 2] = (rz - 0.5) * 90;

    seeds[i * 3] = 0.8 + ry * 1.4; // fall speed
    seeds[i * 3 + 1] = rx * Math.PI * 2; // sway phase
    seeds[i * 3 + 2] = 0.5 + rz; // sway amplitude
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.32,
    map: texture ?? null,
    transparent: true,
    depthWrite: false, // Overlapping petals must not punch holes in each other.
    opacity: 0.85,
    sizeAttenuation: true,
    // Fog off: petals near the camera are the point, and fogging them at this
    // density just greys the whole cloud out.
    fog: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // Spans the whole scene; culling misfires.

  return { points, geometry, material, seeds, basePositions: positions.slice() };
}

/**
 * Dusk lighting. Four sources: a warm low sun for the rim, a cool hemisphere fill
 * for the sky bounce, one lantern point light inside the keep so the emissive
 * windows have some spill, and a dim violet backlight that separates the roof
 * silhouette from the sky.
 *
 * The hemisphere fill is weaker than it was, because the PMREM environment map now
 * carries most of the sky bounce and does it directionally — leaving the fill at
 * its old strength on top of IBL double-counts the ambient and flattens
 * everything.
 *
 * Shadows: 4096 with a VSM-friendly radius on the high tier. At this geometric
 * density the eave brackets, balusters, and window mullions all cast, and their
 * shadows are a few pixels wide — 2048 turned them into mush.
 */
function buildLights(high = true) {
  const sun = new THREE.DirectionalLight(0xffb07a, 1.7);
  sun.position.set(-26, 16, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(high ? 4096 : 1024, high ? 4096 : 1024);
  // Frustum sized to the shadow casters, which now reach further than the keep:
  // a corner turret's outermost eave lands at (23.65, 23.65), radius 33.4, and the
  // sun is low and off to one side so the depth range grows too. The old ±26 x 32
  // x 80 clipped ten casters — the far turrets sat unshadowed and lit flat from
  // every side, which is the one thing that would have given the new walls away as
  // decoration. Bounds below are measured, not guessed: every caster's eight AABB
  // corners land inside clip space with margin.
  //
  // The cost is resolution. 4096 over 70 world units is 58 px/unit rather than the
  // old 78, but the finest casters — window mullions at 0.05 units — are still
  // three pixels wide, so nothing that resolved before stops resolving.
  // Near has to come down as well as far going out. The sun sits at
  // (-26, 16, -18) and the nearest turret's plaster reaches (-23.7, 5.4, -23.7),
  // only 3.6 units along the view direction — the old near of 4 clipped it, so
  // the turret closest to the light was the one turret casting nothing.
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 124;
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 44;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.0004;
  // Normal bias handles the acne that plain bias cannot: the curved base and the
  // swept roofs meet the light at grazing angles where a flat offset is wrong.
  sun.shadow.normalBias = 0.025;
  // A low sun casts soft-edged shadows. r185's PCF filter scales its 5-tap Vogel
  // disk by this, in texels, so it still widens the penumbra to match a sun near
  // the horizon — the deprecation of PCFSoftShadowMap did not change that.
  sun.shadow.radius = high ? 3 : 1;

  const fill = new THREE.HemisphereLight(0x6a5a8f, 0x14121a, 0.28);

  const lantern = new THREE.PointLight(LANTERN, 2.4, 30, 2);
  lantern.position.set(0, STONE_H + 5, 0);

  const rim = new THREE.DirectionalLight(0x8f7fd8, 0.35);
  rim.position.set(20, 9, 24);

  return { sun, fill, lantern, rim };
}

// Lowest the eye is ever allowed to sit, after every other term including
// pointer parallax.
//
// Set by the tallest thing the camera path can pass over. The tree canopies top
// out at 4.56 and now ring the grounds from radius 25 to 32; the curtain wall's
// capping roof reaches 4.85; the corner turret finials reach 5.80 at radius 29,
// which the scrolled-in path crosses. 6.5 clears that by 0.20 beyond the 0.5 near
// plane. The gate tower is taller at 8.65, but it sits at radius 20.5 on the +Z
// axis and the path's low points fall at other azimuths — verified by sweep
// rather than assumed, since the two are only coupled through `angle`.
const MIN_EYE = 6.5;

/**
 * Camera path — a slow orbit that also rises and falls, so it reads as a
 * flythrough rather than a turntable. Loops exactly: every term is a whole
 * number of cycles over LOOP_SECONDS, so there is no jump at the seam.
 *
 * `scroll` (0..1 down the page) adds to the orbit angle and pulls the camera
 * inward and down, so scrolling flies toward the keep. It is added to the time
 * term rather than replacing it — a scroll-only camera freezes whenever the
 * visitor stops reading, which looks broken rather than calm.
 *
 * Pointer parallax is applied here rather than by the caller, so that MIN_EYE is
 * the last word on height. Clamping before parallax is how the previous version
 * ended up 2.8 units under its own floor.
 */
function cameraAt(t, scroll, parallax, out, lookAt) {
  const angle = (t + scroll * SCROLL_TURNS) * Math.PI * 2;

  // Scroll closes the distance and drops the eye height, so the bottom of a
  // long page sits much nearer the walls than the top does.
  const pull = scroll * 11;
  const radius = 30 + Math.sin(angle * 2) * 7 - pull;
  const height = 9 + Math.sin(angle) * 5.5 - scroll * 2.5;

  out.set(
    Math.cos(angle) * radius + parallax.x * 2.4,
    Math.max(MIN_EYE, height - parallax.y * 1.6),
    Math.sin(angle) * radius,
  );

  // Aim at the middle of the keep, drifting up slightly as the camera drops so
  // the tower stays framed rather than sliding out of shot.
  lookAt.set(0, 8.5 - Math.sin(angle) * 1.8 + scroll * 2, 0);
}

/**
 * Assembles everything and returns the handles the React component needs.
 *
 * The component owns the renderer and the loop; this owns the scene and knows how
 * to take it apart again. Keeping `dispose` next to the construction is the only
 * reliable way to be sure nothing gets missed — every geometry, material, and
 * texture created above is freed here.
 */
/**
 * Assembles everything and returns the handles the React component needs.
 *
 * The component owns the renderer and the loop; this owns the scene and knows how
 * to take it apart again. Keeping `dispose` next to the construction is the only
 * reliable way to be sure nothing gets missed — every geometry, material, and
 * texture created above is freed here.
 *
 * `renderer` is required, for two reasons that both matter to how the scene looks:
 * anisotropic filtering has to be set from the hardware's reported maximum before
 * any texture is built, and the environment map has to be prefiltered through
 * PMREMGenerator, which needs a GL context.
 *
 * `quality` is 'high' or 'low'. Low halves the texture resolution and drops the
 * shadow map — a scene that stutters is less convincing than one with softer
 * surfaces.
 *
 * Async because the texture build yields to the event loop between surfaces
 * rather than blocking it for its full duration. Callers must handle being torn
 * down before this resolves: dispose the returned scene if the component that
 * asked for it is already gone.
 *
 * `onProgress(fraction, label)` reports build progress for the loading screen.
 * The texture build owns 0..0.8 of it — it is by far the longest phase and the
 * only one that can be measured from inside — and assembly, IBL, and the first
 * frame take the rest.
 */
export async function createCastleScene({
  width,
  height,
  renderer,
  quality = 'high',
  onProgress,
}) {
  const high = quality === 'high';
  // Wrapped once here so no call site below has to null-check or worry about a
  // listener that throws.
  const report = (fraction, label) => {
    try {
      onProgress?.(fraction, label);
    } catch {
      // Cosmetic. Never let the loading screen break the scene.
    }
  };

  // Before any texture is built. The castle is seen almost entirely at grazing
  // angles, where this is the difference between crisp roof tiles and a smear.
  setTextureAnisotropy(renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);

  const scene = new THREE.Scene();
  // Exponential rather than linear fog. Linear fog has a visible start plane the
  // camera crosses on every orbit; exp2 has no such boundary and is what actual
  // atmospheric scattering looks like.
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0125);

  const camera = new THREE.PerspectiveCamera(
    52,
    width / Math.max(height, 1),
    0.5,
    320,
  );

  const textures = await buildCastleTextures(high ? 1024 : 512, (fraction, label) =>
    report(fraction * 0.8, label),
  );
  const materials = buildMaterials(textures, high);
  const sky = buildSky();
  const keep = buildKeep(materials);
  report(0.86, 'keep');
  const grounds = buildGrounds(materials);
  const petalTexture = buildPetalTexture();
  const petals = buildPetals(petalTexture);
  const { sun, fill, lantern, rim } = buildLights(high);
  report(0.92, 'walls');

  scene.add(sky, keep, grounds, petals.points, sun, fill, lantern, rim);

  // Image-based lighting from the sky dome itself.
  //
  // This is the single largest realism gain available here. Without it, every
  // surface is lit only by three analytic lights, so anything facing away from the
  // sun falls to the flat hemisphere colour and metal has nothing to reflect. With
  // it, the plaster picks up violet from the zenith and warm from the horizon on
  // the correct faces, the copper reflects an actual sky, and the moat reflects
  // something worth reflecting.
  //
  // Generated from a throwaway scene holding only the sky, so the keep does not
  // end up reflected in itself.
  let environment = null;
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyOnly = new THREE.Scene();
    const skyClone = new THREE.Mesh(sky.geometry, sky.material);
    skyOnly.add(skyClone);
    // near/far bracket the dome's radius of 240.
    environment = pmrem.fromScene(skyOnly, 0, 1, 300).texture;
    scene.environment = environment;
    // Modest: the analytic sun still does the shaping. At 1.0 the IBL flattens
    // the whole scene into even ambient light.
    scene.environmentIntensity = 0.55;
    skyOnly.remove(skyClone);
    pmrem.dispose();
  }
  report(0.97, 'lighting');

  const position = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  // Reused across frames — allocating a Vector3 per frame is how you get a
  // sawtooth GC trace on a loop that runs 60 times a second.
  const petalArray = petals.geometry.getAttribute('position').array;
  const { seeds, basePositions } = petals;
  const waterNormal = materials.water.normalMap ?? null;
  const waterNormal2 = textures.water?.normalMap2 ?? null;

  return {
    scene,
    camera,

    /**
     * Advances the scene.
     *   elapsed  seconds since the loop started
     *   parallax pointer offset, -1..1 on each axis
     *   scroll   page scroll progress, 0..1
     */
    update(elapsed, parallax, scroll = 0) {
      const t = (elapsed % LOOP_SECONDS) / LOOP_SECONDS;
      cameraAt(t, scroll, parallax, position, lookAt);
      camera.position.copy(position);
      camera.lookAt(lookAt);

      for (let i = 0; i < PETAL_COUNT; i += 1) {
        const i3 = i * 3;
        const speed = seeds[i3];
        const phase = seeds[i3 + 1];
        const sway = seeds[i3 + 2];

        // Wrap through a 46-unit column: a petal that reaches the ground
        // reappears at the top with no per-petal bookkeeping. `fallen` is
        // already < 46, so one conditional add is enough to stay in range.
        const fallen = (elapsed * speed) % 46;
        let nextY = basePositions[i3 + 1] - fallen;
        if (nextY < 0) nextY += 46;
        petalArray[i3 + 1] = nextY;

        petalArray[i3] =
          basePositions[i3] + Math.sin(elapsed * 0.6 + phase) * sway;
        petalArray[i3 + 2] =
          basePositions[i3 + 2] + Math.cos(elapsed * 0.45 + phase) * sway * 0.7;
      }
      petals.geometry.getAttribute('position').needsUpdate = true;

      // Moat ripples: scroll two normal maps in different directions at different
      // rates. Where they cross, the surface reads as interfering wave trains; a
      // single map scrolled anywhere reads as a patterned sheet sliding, which is
      // the giveaway on almost every procedural water surface.
      if (waterNormal) {
        waterNormal.offset.set(elapsed * 0.013, elapsed * 0.021);
      }
      if (waterNormal2) {
        waterNormal2.offset.set(elapsed * -0.017, elapsed * 0.009);
      }

      // Lantern breathes very slightly. Any more and it reads as a fault.
      lantern.intensity = 2.4 + Math.sin(elapsed * 1.7) * 0.18;
    },

    resize(w, h) {
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    },

    dispose() {
      // Traverse rather than tracking every mesh by hand: the keep alone builds
      // well over a hundred, and a list would rot the moment a part was added.
      // InstancedMesh is covered — it reports isMesh true.
      const seen = new Set();
      scene.traverse((object) => {
        if (object.isMesh || object.isPoints) {
          if (object.geometry && !seen.has(object.geometry)) {
            seen.add(object.geometry);
            object.geometry.dispose();
          }
          object.dispose?.(); // InstancedMesh releases its instance buffers here
        }
      });
      for (const material of Object.values(materials)) material.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      petals.geometry.dispose();
      petals.material.dispose();
      petalTexture?.dispose();
      disposeCastleTextures(textures);
      // The PMREM output is a render target texture the generator handed over; the
      // generator itself was disposed at build time but this outlives it.
      environment?.dispose();
      scene.environment = null;
      sun.shadow?.map?.dispose();
      scene.clear();
    },
  };
}
