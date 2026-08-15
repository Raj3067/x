// ---------------------------------------------------------------------------
// Procedural PBR textures for the castle scene.
//
// Every map is drawn to a canvas at runtime and turned into a CanvasTexture.
// Nothing is downloaded. That constraint is the whole reason this file exists
// separately from the geometry: generating a believable masonry or roof-tile
// map is a different kind of work from assembling meshes, and mixing the two
// made castle-scene.js unreadable.
//
// Each surface gets three maps:
//   map          albedo — colour variation, grime, mortar lines
//   normalMap    derived from a height canvas by Sobel, so the bumps agree
//                with the albedo instead of being invented separately
//   roughnessMap the same height canvas reused as gloss variation. Recessed,
//                sheltered areas hold dirt and read rougher; a dedicated third
//                canvas per surface would cost 5 more megabytes to say almost
//                exactly this.
//
// All noise is tileable and deterministic — no Math.random, so the castle looks
// identical on every load, and no seams where a texture wraps.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

/**
 * Lattice hash. Coordinates wrap at `period`, which is what makes the noise
 * built on top of it tile seamlessly.
 */
function hash(ix, iy, period, seed) {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Hermite ease, so interpolated noise has no directional creases. */
function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);

  const a = hash(ix, iy, period, seed);
  const b = hash(ix + 1, iy, period, seed);
  const c = hash(ix, iy + 1, period, seed);
  const d = hash(ix + 1, iy + 1, period, seed);

  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Fractal sum of value noise. `period` doubles with each octave alongside the
 * frequency, so every octave wraps on the same boundary and the total still
 * tiles.
 */
function fbm(x, y, period, seed, octaves = 4) {
  let sum = 0;
  let norm = 0;
  let amp = 0.5;
  let freq = 1;

  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(x * freq, y * freq, period * freq, seed + o * 13) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return sum / norm;
}

// Anisotropy applied to every texture. Set once from the renderer's reported
// maximum before any texture is built — the castle is seen almost entirely at
// grazing angles, where anisotropic filtering is the difference between crisp
// roof tiles and a grey smear halfway up the roof.
let anisotropy = 4;

/** Called by createCastleScene before building, with renderer capabilities. */
export function setTextureAnisotropy(max) {
  if (typeof max === 'number' && max > 0) anisotropy = Math.min(max, 8);
}

/** A canvas plus its 2D context, or null where canvas is unavailable (SSR). */
function makeCanvas(size) {
  // Guarded rather than assumed. This module is only ever imported from a lazily
  // loaded Client Component, so in production `document` is always there — but a
  // headless import (a node check, a prerender that pulled this in by mistake)
  // would otherwise throw from inside an async build and surface as a rejected
  // promise rather than the flat-colour fallback every caller already handles.
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

function finish(canvas, { srgb = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Only albedo is colour data. Normal, roughness, and AO maps are raw numbers
  // and must stay linear — tagging them sRGB is the classic way to get
  // washed-out bumps and a surface that will not go properly matte.
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  // Trilinear with mipmaps. The default is already this, but it is worth being
  // explicit here: without mipmaps a tiled texture on a surface running to the
  // horizon aliases into moire, which is the single most artificial-looking
  // failure mode this scene can have.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Separable box blur over a greyscale canvas's red channel, wrapping at the
 * edges so the result tiles like its source. Returns a Float32Array, not a
 * canvas — the only consumer is the AO pass below, which wants numbers.
 *
 * Uses a sliding window rather than re-summing the kernel per pixel, so cost is
 * independent of `radius`. That matters: the wide AO pass below wants a radius of
 * ~28 at 1024px, and the naive form would be some 60M multiply-adds per pass.
 */
function blurHeight(heightCanvas, radius) {
  const size = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;

  const rows = new Float32Array(size * size);
  const out = new Float32Array(size * size);
  const span = radius * 2 + 1;
  const wrap = (i) => ((i % size) + size) % size;

  // Horizontal pass. Seed the window at x = 0, then add the entering sample and
  // drop the leaving one for each step.
  for (let y = 0; y < size; y += 1) {
    const row = y * size;
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      sum += src[(row + wrap(k)) * 4];
    }
    for (let x = 0; x < size; x += 1) {
      rows[row + x] = sum / span;
      sum += src[(row + wrap(x + radius + 1)) * 4];
      sum -= src[(row + wrap(x - radius)) * 4];
    }
  }

  // Vertical pass over the horizontal result.
  for (let x = 0; x < size; x += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      sum += rows[wrap(k) * size + x];
    }
    for (let y = 0; y < size; y += 1) {
      out[y * size + x] = sum / span;
      sum += rows[wrap(y + radius + 1) * size + x];
      sum -= rows[wrap(y - radius) * size + x];
    }
  }

  return out;
}

/**
 * Ambient occlusion, derived from the same height canvas as everything else.
 *
 * This is a cavity map: a pixel that sits below the average height of its
 * neighbourhood is in a recess, and a recess catches less ambient light. It is
 * not a ray-traced AO bake and it cannot be — but for tiling surface detail it is
 * what actually matters, because the occlusion a viewer notices is mortar joints
 * going dark and tile valleys going dark, both of which this gets right.
 *
 * Two radii are combined: a tight one for the fine tooth and a wide one for the
 * broad forms. Using one radius means either the joints or the courses read, not
 * both.
 */
function aoFromHeight(heightCanvas, { tight = 3, wide = 14, strength = 2.4 } = {}) {
  const size = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const near = blurHeight(heightCanvas, tight);
  const far = blurHeight(heightCanvas, wide);

  const out = makeCanvas(size);
  if (!out) return null;
  const image = out.ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i += 1) {
    const h = src[i * 4];
    // Positive where the pixel is below its surroundings.
    const cavityNear = Math.max(0, near[i] - h) / 255;
    const cavityWide = Math.max(0, far[i] - h) / 255;
    const occlusion = cavityNear * strength + cavityWide * strength * 0.7;
    // Floor at 0.35: driving AO to black kills the shape entirely, and real
    // ambient light does reach into a mortar joint.
    const value = Math.max(0.35, 1 - Math.min(occlusion, 1)) * 255;

    const p = i * 4;
    image.data[p] = value;
    image.data[p + 1] = value;
    image.data[p + 2] = value;
    image.data[p + 3] = 255;
  }

  out.ctx.putImageData(image, 0, 0);
  return out.canvas;
}

/**
 * Sobel-derives a normal map from a greyscale height canvas.
 *
 * Done here rather than with a shader because it runs once at startup, and
 * because deriving it from the same canvas that produced the albedo is the only
 * way to guarantee a mortar line in the colour has a groove in the relief at
 * exactly the same pixel. Sampling wraps, so the result tiles like its source.
 */
function normalFromHeight(heightCanvas, strength) {
  const size = heightCanvas.width;
  const src = heightCanvas
    .getContext('2d')
    .getImageData(0, 0, size, size).data;

  const out = makeCanvas(size);
  if (!out) return null;
  const image = out.ctx.createImageData(size, size);
  const data = image.data;

  // Red channel is enough: the height canvases below are drawn greyscale.
  const at = (x, y) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return src[(wy * size + wx) * 4] / 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        at(x - 1, y - 1) +
        2 * at(x - 1, y) +
        at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) +
        2 * at(x, y - 1) +
        at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));

      // Tangent-space normal: X/Y from the gradient, Z fixed, then normalised.
      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;

      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz / len) * 255;
      data[i + 3] = 255;
    }
  }

  out.ctx.putImageData(image, 0, 0);
  return out.canvas;
}

/**
 * Ashlar masonry for the stone base — irregular blocks in offset courses, with
 * recessed mortar between them.
 *
 * Both canvases are drawn in the same loop from the same block list. That is
 * deliberate: the albedo's block edges and the height map's mortar grooves come
 * from one set of rectangles, so they cannot drift apart.
 */
function buildStoneMaps(size = 512) {
  const albedo = makeCanvas(size);
  const height = makeCanvas(size);
  if (!albedo || !height) return null;

  const COURSES = 9;
  const courseH = size / COURSES;

  // Mortar: dark in albedo, low in height, so blocks stand proud of it.
  albedo.ctx.fillStyle = '#1a1a20';
  albedo.ctx.fillRect(0, 0, size, size);
  height.ctx.fillStyle = '#3a3a3a';
  height.ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < COURSES; row += 1) {
    // Offset alternate courses by half a block — a running bond. Aligned
    // vertical joints all the way up read as tiles, not masonry.
    const blocks = 5 + (row % 3);
    const blockW = size / blocks;
    const offset = (row % 2) * blockW * 0.5;

    for (let col = -1; col <= blocks; col += 1) {
      const x = col * blockW + offset;
      const y = row * courseH;
      // Mortar gap: 2px on each edge, plus a per-block jitter so no two blocks
      // are quite the same size.
      const jx = hash(col, row, 97, 3) * 2.5;
      const jy = hash(col, row, 97, 8) * 2;
      const w = blockW - 4 - jx;
      const h = courseH - 4 - jy;

      // Per-block base tone, then fbm grain on top.
      const tone = 0.62 + hash(col, row, 97, 17) * 0.38;
      const grain = albedo.ctx.createLinearGradient(x, y, x + w, y + h);
      const lo = Math.round(28 * tone);
      const hi = Math.round(46 * tone);
      grain.addColorStop(0, `rgb(${hi}, ${hi}, ${hi + 5})`);
      grain.addColorStop(1, `rgb(${lo}, ${lo}, ${lo + 4})`);
      albedo.ctx.fillStyle = grain;
      albedo.ctx.fillRect(x + 2, y + 2, w, h);

      // Height: block face bright (proud), with a soft top edge highlight so
      // the Sobel pass produces a chamfer rather than a vertical cliff.
      const hv = Math.round(190 + hash(col, row, 97, 29) * 50);
      height.ctx.fillStyle = `rgb(${hv}, ${hv}, ${hv})`;
      height.ctx.fillRect(x + 2, y + 2, w, h);
      height.ctx.fillStyle = `rgba(255, 255, 255, 0.35)`;
      height.ctx.fillRect(x + 2, y + 2, w, 2);
    }
  }

  // Weathering pass over everything: fbm streaks, denser toward the bottom
  // where rain runs off and moss collects.
  const img = albedo.ctx.getImageData(0, 0, size, size);
  const hImg = height.ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = fbm(x / 26, y / 60, 20, 5, 4);
      const damp = 0.35 + (y / size) * 0.65; // more grime low down
      const stain = (n - 0.5) * 26 * damp;

      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + stain));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + stain * 1.05));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + stain * 0.8));

      // Same noise into height, gently — pitted stone, not a new pattern.
      hImg.data[i] = Math.max(0, Math.min(255, hImg.data[i] + stain * 0.7));
      hImg.data[i + 1] = hImg.data[i];
      hImg.data[i + 2] = hImg.data[i];
    }
  }
  albedo.ctx.putImageData(img, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);

  const normalCanvas = normalFromHeight(height.canvas, 2.6);
  // Wide radius scaled to the course height, so the AO reads as "this block sits
  // back from its neighbours" rather than as a uniform grey wash.
  const aoCanvas = aoFromHeight(height.canvas, {
    tight: Math.round(size / 170),
    wide: Math.round(size / 36),
    strength: 2.6,
  });

  return {
    map: finish(albedo.canvas, { srgb: true }),
    normalMap: normalCanvas ? finish(normalCanvas) : null,
    // Height doubles as roughness: mortar recesses are darker, and darker means
    // rougher here, which is what we want — sheltered joints hold dust.
    roughnessMap: finish(height.canvas),
    aoMap: aoCanvas ? finish(aoCanvas) : null,
  };
}

/**
 * Kawara roof tiles — the rounded, overlapping clay tiles of a Japanese roof.
 *
 * Drawn as columns of half-round ridges with a horizontal course line where each
 * tile laps the one below. The height map carries the barrel of each ridge, so
 * the normal pass gives the roof its corrugated read even though the geometry
 * underneath is a smooth swept surface.
 */
function buildTileMaps(size = 512) {
  const albedo = makeCanvas(size);
  const height = makeCanvas(size);
  if (!albedo || !height) return null;

  const COLS = 10; // tile columns across the texture
  const ROWS = 12; // laps down it
  const colW = size / COLS;
  const rowH = size / ROWS;

  albedo.ctx.fillStyle = '#161a20';
  albedo.ctx.fillRect(0, 0, size, size);
  height.ctx.fillStyle = '#1e1e1e'; // valleys between ridges
  height.ctx.fillRect(0, 0, size, size);

  for (let col = 0; col < COLS; col += 1) {
    const cx = col * colW;

    // Barrel across the column: bright at the crown, falling to the valleys.
    const barrel = albedo.ctx.createLinearGradient(cx, 0, cx + colW, 0);
    barrel.addColorStop(0, '#0f1216');
    barrel.addColorStop(0.32, '#2b323d');
    barrel.addColorStop(0.5, '#39424f'); // crown catches the sky
    barrel.addColorStop(0.68, '#2b323d');
    barrel.addColorStop(1, '#0f1216');
    albedo.ctx.fillStyle = barrel;
    albedo.ctx.fillRect(cx, 0, colW, size);

    const hBarrel = height.ctx.createLinearGradient(cx, 0, cx + colW, 0);
    hBarrel.addColorStop(0, '#202020');
    hBarrel.addColorStop(0.5, '#f0f0f0');
    hBarrel.addColorStop(1, '#202020');
    height.ctx.fillStyle = hBarrel;
    height.ctx.fillRect(cx, 0, colW, size);
  }

  // Course lines: each tile's lower lip sits over the next course, casting a
  // thin shadow. Drawn after the barrels so it crosses every column.
  for (let row = 0; row <= ROWS; row += 1) {
    const y = row * rowH;
    const lip = albedo.ctx.createLinearGradient(0, y - rowH * 0.22, 0, y);
    lip.addColorStop(0, 'rgba(0, 0, 0, 0)');
    lip.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    albedo.ctx.fillStyle = lip;
    albedo.ctx.fillRect(0, y - rowH * 0.22, size, rowH * 0.22);

    // A raised lip, then a hard drop into the course below.
    height.ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    height.ctx.fillRect(0, y - 4, size, 4);
    height.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    height.ctx.fillRect(0, y, size, 3);
  }

  // Per-tile tone variation, so the roof is not a perfect repeat. Applied as a
  // translucent rect per tile rather than per pixel — far cheaper, and tile
  // boundaries are exactly where real variation lives anyway.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const v = hash(col, row, 61, 41);
      albedo.ctx.fillStyle =
        v > 0.5
          ? `rgba(120, 150, 190, ${(v - 0.5) * 0.16})` // cool glaze sheen
          : `rgba(20, 14, 10, ${(0.5 - v) * 0.3})`; // soot
      albedo.ctx.fillRect(col * colW, row * rowH, colW, rowH);
    }
  }

  const normalCanvas = normalFromHeight(height.canvas, 3.2);
  // Tight radii: on a roof the occlusion that reads is the shadow line under each
  // tile lap, which is a few pixels wide, not a broad form.
  const aoCanvas = aoFromHeight(height.canvas, {
    tight: Math.round(size / 200),
    wide: Math.round(size / 60),
    strength: 2.2,
  });

  // Roughness is inverted height: the crowns are worn smooth and glazed, the
  // valleys hold moss and grit. Reusing height directly would get this backwards.
  const rough = makeCanvas(size);
  if (rough) {
    const src = height.ctx.getImageData(0, 0, size, size);
    const dst = rough.ctx.createImageData(size, size);
    for (let i = 0; i < src.data.length; i += 4) {
      // 0.30 at the crown to 0.85 in the valley.
      const inv = 255 - src.data[i];
      const r = 76 + (inv / 255) * 140;
      dst.data[i] = r;
      dst.data[i + 1] = r;
      dst.data[i + 2] = r;
      dst.data[i + 3] = 255;
    }
    rough.ctx.putImageData(dst, 0, 0);
  }

  return {
    // No `repeat` here or on the other building surfaces: castle-scene.js writes
    // its own UVs from world-space size constants, so one repeat of this texture
    // covers a fixed number of scene units whatever mesh it lands on. A repeat
    // set here would multiply against those UVs and shrink the courses.
    map: finish(albedo.canvas, { srgb: true }),
    normalMap: normalCanvas ? finish(normalCanvas) : null,
    roughnessMap: rough ? finish(rough.canvas) : null,
    aoMap: aoCanvas ? finish(aoCanvas) : null,
  };
}

/**
 * Shirokabe — the white lime plaster of the upper storeys. Almost flat by
 * design; the interest is in the trowel swirl and the dirt that gathers where
 * rain runs down from the eave above.
 */
function buildPlasterMaps(size = 512) {
  const albedo = makeCanvas(size);
  const height = makeCanvas(size);
  if (!albedo || !height) return null;

  const aImg = albedo.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Two scales: broad trowel sweeps plus a fine tooth.
      const broad = fbm(x / 72, y / 72, 8, 61, 3);
      const fine = fbm(x / 9, y / 9, 64, 77, 2);
      const swirl = broad * 0.75 + fine * 0.25;

      // Vertical rain streaks. Stretched 8:1 so they run down, not across.
      const streak = fbm(x / 14, y / 110, 40, 91, 3);
      const dirt = Math.max(0, streak - 0.56) * 1.9;

      const base = 196 + (swirl - 0.5) * 26;
      const r = base - dirt * 62;
      const g = base - dirt * 58;
      const b = base - dirt * 46; // grime goes warm-grey, not blue

      const i = (y * size + x) * 4;
      aImg.data[i] = Math.max(0, Math.min(255, r));
      aImg.data[i + 1] = Math.max(0, Math.min(255, g));
      aImg.data[i + 2] = Math.max(0, Math.min(255, b));
      aImg.data[i + 3] = 255;

      // Relief is subtle — plaster is nearly flat. Mostly the fine tooth.
      const hv = 140 + (fine - 0.5) * 90 + (broad - 0.5) * 30;
      hImg.data[i] = Math.max(0, Math.min(255, hv));
      hImg.data[i + 1] = hImg.data[i];
      hImg.data[i + 2] = hImg.data[i];
      hImg.data[i + 3] = 255;
    }
  }

  albedo.ctx.putImageData(aImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);

  const normalCanvas = normalFromHeight(height.canvas, 1.1);
  // Plaster is nearly flat, so the AO is nearly nothing — but the rain streaks do
  // sit in shallow channels, and a weak wide-radius pass is what makes them read
  // as dirt in a groove rather than a decal painted on a plane.
  const aoCanvas = aoFromHeight(height.canvas, {
    tight: Math.round(size / 256),
    wide: Math.round(size / 40),
    strength: 1.3,
  });

  return {
    map: finish(albedo.canvas, { srgb: true }),
    normalMap: normalCanvas ? finish(normalCanvas) : null,
    roughnessMap: finish(height.canvas),
    aoMap: aoCanvas ? finish(aoCanvas) : null,
  };
}

/**
 * Dark stained timber for the beams, railings, and pillars. Grain runs along the
 * canvas's Y axis; the geometry that uses it is built so that axis follows the
 * length of each member.
 */
function buildWoodMaps(size = 512) {
  const albedo = makeCanvas(size);
  const height = makeCanvas(size);
  if (!albedo || !height) return null;

  const aImg = albedo.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Growth rings: a warped coordinate pushed through fract() gives bands
      // that wobble like real grain instead of ruled lines.
      const warp = fbm(x / 40, y / 200, 12, 101, 3);
      const rings = ((x / 7 + warp * 3.2) % 1 + 1) % 1;
      const band = Math.abs(rings - 0.5) * 2;

      // Long fibres down the length.
      const fibre = fbm(x / 3, y / 90, 128, 113, 2);

      const tone = 0.55 + band * 0.35 + (fibre - 0.5) * 0.28;
      const i = (y * size + x) * 4;
      aImg.data[i] = Math.max(0, Math.min(255, 74 * tone));
      aImg.data[i + 1] = Math.max(0, Math.min(255, 50 * tone));
      aImg.data[i + 2] = Math.max(0, Math.min(255, 38 * tone));
      aImg.data[i + 3] = 255;

      // Late wood stands slightly proud of early wood.
      const hv = 110 + band * 80 + (fibre - 0.5) * 70;
      hImg.data[i] = Math.max(0, Math.min(255, hv));
      hImg.data[i + 1] = hImg.data[i];
      hImg.data[i + 2] = hImg.data[i];
      hImg.data[i + 3] = 255;
    }
  }

  albedo.ctx.putImageData(aImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);

  const normalCanvas = normalFromHeight(height.canvas, 1.7);
  // Grain channels are narrow; a wide pass here would just darken the whole board.
  const aoCanvas = aoFromHeight(height.canvas, {
    tight: Math.round(size / 200),
    wide: Math.round(size / 64),
    strength: 1.7,
  });

  return {
    map: finish(albedo.canvas, { srgb: true }),
    normalMap: normalCanvas ? finish(normalCanvas) : null,
    roughnessMap: finish(height.canvas),
    aoMap: aoCanvas ? finish(aoCanvas) : null,
  };
}

/**
 * Packed earth and gravel for the plateau. Repeated many times across a large
 * plane, so it has to be featureless enough not to show its own tiling — all
 * noise, no landmarks.
 */
function buildGroundMaps(size = 512) {
  const albedo = makeCanvas(size);
  const height = makeCanvas(size);
  if (!albedo || !height) return null;

  const aImg = albedo.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coarse = fbm(x / 30, y / 30, 18, 131, 4);
      const grit = fbm(x / 3.5, y / 3.5, 146, 149, 2);
      const tone = 0.6 + (coarse - 0.5) * 0.5 + (grit - 0.5) * 0.35;

      const i = (y * size + x) * 4;
      aImg.data[i] = Math.max(0, Math.min(255, 44 * tone));
      aImg.data[i + 1] = Math.max(0, Math.min(255, 41 * tone));
      aImg.data[i + 2] = Math.max(0, Math.min(255, 48 * tone));
      aImg.data[i + 3] = 255;

      const hv = 100 + (coarse - 0.5) * 110 + (grit - 0.5) * 120;
      hImg.data[i] = Math.max(0, Math.min(255, hv));
      hImg.data[i + 1] = hImg.data[i];
      hImg.data[i + 2] = hImg.data[i];
      hImg.data[i + 3] = 255;
    }
  }

  albedo.ctx.putImageData(aImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);

  const normalCanvas = normalFromHeight(height.canvas, 2.2);
  const aoCanvas = aoFromHeight(height.canvas, {
    tight: Math.round(size / 200),
    wide: Math.round(size / 48),
    strength: 2.0,
  });

  return {
    map: finish(albedo.canvas, { srgb: true }),
    normalMap: normalCanvas ? finish(normalCanvas) : null,
    roughnessMap: finish(height.canvas),
    aoMap: aoCanvas ? finish(aoCanvas) : null,
  };
}

/**
 * Ripple normals for the moat. Only normal maps — the water's colour comes from
 * its material and from what it reflects, not from a texture.
 *
 * Two independent maps rather than one: the update loop scrolls them in different
 * directions at different rates, and two crossing wave trains is what reads as
 * water. One map scrolled in any direction reads as a patterned sheet sliding,
 * which is the giveaway that killed the previous version's realism.
 */
function buildWaterMaps(size = 512) {
  const build = (seedA, seedB, swellScale, chopScale, strength) => {
    const height = makeCanvas(size);
    if (!height) return null;

    const img = height.ctx.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const swell = fbm(x / swellScale, y / (swellScale * 0.65), 8, seedA, 3);
        const chop = fbm(x / chopScale, y / (chopScale * 0.75), 32, seedB, 2);
        const hv = 128 + (swell - 0.5) * 90 + (chop - 0.5) * 60;
        const i = (y * size + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, hv));
        img.data[i + 1] = img.data[i];
        img.data[i + 2] = img.data[i];
        img.data[i + 3] = 255;
      }
    }
    height.ctx.putImageData(img, 0, 0);

    const normalCanvas = normalFromHeight(height.canvas, strength);
    return normalCanvas ? finish(normalCanvas) : null;
  };

  const normalMap = build(167, 173, 34, 8, 1.4);
  // Second train: coarser swell, finer chop, so the two never beat in step.
  const normalMap2 = build(191, 197, 52, 5.5, 1.1);

  return normalMap ? { normalMap, normalMap2 } : null;
}

/** Yields to the event loop so a long build never blocks input. */
function yieldToBrowser() {
  // scheduler.yield where it exists — it resumes at higher priority than a
  // setTimeout continuation, so the build finishes sooner while still letting
  // input through between surfaces.
  if (typeof scheduler !== 'undefined' && scheduler.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Builds every texture set the scene needs.
 *
 * Async, and deliberately so. At 1024px this is roughly 6M pixels of canvas work
 * plus six Sobel passes and five two-radius AO passes — measured at ~1.9s in one
 * synchronous block, which would freeze scrolling and clicking for that whole time
 * even though the page has already painted. Yielding between surfaces caps any
 * single task at a few hundred milliseconds; the visitor keeps the CSS gradient
 * background until the whole thing is ready, which they were getting anyway.
 *
 * `size` is the edge length of every map. The caller drops it on weaker hardware;
 * a scene that stutters is less convincing than one with softer textures.
 *
 * Any surface that fails to get a 2D context comes back null and the caller falls
 * back to a flat material, so a locked-down browser degrades to the untextured
 * look rather than throwing.
 *
 * `onProgress(fraction, label)` is called after each surface lands, on the yield
 * boundary rather than before it, so the number the loading screen shows is work
 * finished and not work started. It is optional and never awaited — a throwing
 * listener must not be able to take the scene build down with it.
 */
export async function buildCastleTextures(size = 1024, onProgress) {
  const textures = {};

  const surfaces = [
    ['stone', () => buildStoneMaps(size), 'masonry'],
    ['tile', () => buildTileMaps(size), 'roof tiles'],
    ['plaster', () => buildPlasterMaps(size), 'plaster'],
    ['wood', () => buildWoodMaps(size), 'timber'],
    ['ground', () => buildGroundMaps(size), 'grounds'],
    // Water ripples read at any resolution and there are two of them, so this one
    // stays half-size regardless.
    ['water', () => buildWaterMaps(Math.max(256, size / 2)), 'water'],
  ];

  for (let i = 0; i < surfaces.length; i += 1) {
    const [name, build, label] = surfaces[i];
    textures[name] = build();
    await yieldToBrowser();
    try {
      onProgress?.((i + 1) / surfaces.length, label);
    } catch {
      // A broken progress listener is a cosmetic fault. Keep building.
    }
  }

  return textures;
}

/**
 * Frees every texture in a set built above. A WebGL texture is not garbage
 * collected just because the JS reference went away — this has to be explicit.
 *
 * Iterates whatever keys each set actually has rather than naming them: sets hold
 * between one and four maps depending on the surface, and a hardcoded list is how
 * a fifth map added later leaks silently.
 */
export function disposeCastleTextures(textures) {
  if (!textures) return;
  for (const set of Object.values(textures)) {
    if (!set) continue;
    for (const value of Object.values(set)) {
      if (value?.isTexture) value.dispose();
    }
  }
}
