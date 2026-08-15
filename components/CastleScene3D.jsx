'use client';

/**
 * Japanese castle flythrough — the site-wide 3D background.
 *
 * Owns the renderer, the post-processing chain, and the animation loop; the scene
 * itself lives in lib/castle-scene.js. This file is loaded lazily by SiteBackdrop
 * and must never be imported statically from a Server Component — that would pull
 * three.js into the shared bundle for every visitor.
 *
 * Contract with SiteBackdrop:
 *   onReady() fires once the first frame is on screen, cueing the CSS fallback
 *   to fade out. onLost() fires if the GPU drops the context, cueing it back.
 *   onProgress(fraction, label) fires as the scene builds, driving the boot
 *   screen's bar. Neither onReady nor onLost is guaranteed to fire before it.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCastleScene } from '@/lib/castle-scene';

// Render resolution ceiling. Lower than the old grid's 1.75 because this scene
// shades far more pixels, and lower again on the low tier.
const MAX_DPR_HIGH = 1.5;
const MAX_DPR_LOW = 1;

/**
 * Splits visitors into a high and a low tier.
 *
 * SiteBackdrop has already rejected phones, coarse pointers, <4 cores, declared
 * low memory, and data-saver. This is a second, finer cut among the machines that
 * passed: the high tier gets 1024px textures, a 4096 shadow map, MSAA, and bloom.
 *
 * Reads the GL renderer string where the driver exposes it. Software rasterisers
 * (SwiftShader, llvmpipe, "Basic Render Driver") will happily create a WebGL2
 * context and then run this at two frames a second, and they are the one case the
 * capability checks in SiteBackdrop cannot catch.
 */
function pickQuality(renderer) {
  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores < 8) return 'low';

  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) {
      const name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
      if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 'low';
    }
  } catch {
    // Extension is commonly blocked for fingerprinting reasons. Not knowing the
    // GPU is not a reason to downgrade — the core count already gated this.
  }

  return 'high';
}

export default function CastleScene3D({ onReady, onLost, onProgress }) {
  const hostRef = useRef(null);
  // Callbacks in a ref so the effect never re-runs — rebuilding the scene
  // because a parent re-rendered would be an expensive no-op.
  const callbacksRef = useRef({ onReady, onLost, onProgress });
  callbacksRef.current = { onReady, onLost, onProgress };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // Context creation can fail even when the support probe passed.
      callbacksRef.current.onLost?.();
      return undefined;
    }

    const quality = pickQuality(renderer);
    const high = quality === 'high';
    const maxDpr = high ? MAX_DPR_HIGH : MAX_DPR_LOW;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // AgX over ACES filmic. Both are filmic curves, but AgX holds hue through the
    // highlight rolloff where ACES skews warm tones toward yellow — and this scene
    // is a warm sun on white plaster, which is exactly that case.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    // PCF, not PCFSoft — the latter is deprecated as of r185 and the renderer
    // silently swaps it for this while logging a warning on the first frame.
    //
    // Nothing is lost by moving: r185's PCF is a 5-tap Vogel disk rotated per
    // pixel by interleaved gradient noise, which is a better-distributed filter
    // than the old fixed 3x3 grid, and it still scales its kernel by
    // `shadow.radius`. The wide penumbra set on the sun for a low dusk light is
    // therefore unchanged.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // The transmissive shoji and canopies make the renderer re-draw all the opaque
    // geometry into a backdrop target each frame. At half resolution that pass is a
    // quarter of the cost, and nothing reading it is in sharp focus — transmission
    // through paper and leaves is diffuse by definition.
    renderer.transmissionResolutionScale = 0.5;
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(host.clientWidth, host.clientHeight, false);

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);

    // First report of the run. Everything before this point — splitting the lazy
    // chunk out, downloading it, parsing three.js, getting a GL context — is dead
    // time the boot screen cannot see into, so the bar sits at zero through it.
    // Moving off zero as soon as there is something true to say is the difference
    // between a bar that looks slow and one that looks broken.
    callbacksRef.current.onProgress?.(0.04, 'renderer');

    // The texture build yields to the event loop between surfaces rather than
    // blocking it for its full duration, so this resolves a good few frames later
    // and a remount or a route change can land in the middle of it. `cancelled` is
    // how the continuation knows the host is gone; `teardown` is how cleanup knows
    // which phase it is undoing.
    let cancelled = false;
    let teardown = null;

    const building = createCastleScene({
      width: host.clientWidth,
      height: host.clientHeight,
      renderer,
      quality,
      // Stops reporting the moment the host is gone, so a build finishing after
      // an unmount cannot drive a boot screen that has already dismissed.
      onProgress: (fraction, label) => {
        if (!cancelled) callbacksRef.current.onProgress?.(fraction, label);
      },
    });

    building.then((castle) => {
      if (cancelled) {
        // Finished building after the component went away. Free it rather than
        // leaving a few thousand textures and geometries on the GPU.
        castle.dispose();
        return;
      }

      /* -------------------------------------------------------------------
       * Post-processing
       *
       * Half-float target, MSAA on the high tier, bloom, then OutputPass.
       *
       * The half-float target is the point, not the bloom: it lets the scene
       * render in linear HDR so the sun and the lit shoji can exceed 1.0 and be
       * rolled off by the tone curve, instead of clipping to flat white in an
       * 8-bit buffer. That is what stops a bright dusk sky looking like paper.
       *
       * OutputPass must be last, and it takes tone mapping and colour space off
       * the renderer. The renderer applies its own tone mapping only when drawing
       * to the default framebuffer, so once a composer is in play the settings
       * above are read by OutputPass rather than being applied twice.
       * ----------------------------------------------------------------- */
      const dpr = renderer.getPixelRatio();
      const target = new THREE.WebGLRenderTarget(
        host.clientWidth * dpr,
        host.clientHeight * dpr,
        {
          type: THREE.HalfFloatType,
          colorSpace: THREE.LinearSRGBColorSpace,
          // MSAA in the target rather than the renderer's `antialias`, which does
          // nothing once rendering goes through a composer.
          samples: high ? 4 : 0,
        },
      );

      const composer = new EffectComposer(renderer, target);
      composer.setPixelRatio(dpr);
      composer.setSize(host.clientWidth, host.clientHeight);
      composer.addPass(new RenderPass(castle.scene, castle.camera));

      // Bloom, on the high tier only. Threshold 0.85 so it catches the lit
      // windows, the lanterns, and the sun's glance off the tiles, and leaves the
      // plaster alone — a low threshold fogs the frame and reads as a dirty lens.
      let bloom = null;
      if (high) {
        bloom = new UnrealBloomPass(
          new THREE.Vector2(host.clientWidth, host.clientHeight),
          0.42, // strength
          0.7, // radius
          0.85, // threshold
        );
        composer.addPass(bloom);
      }

      const outputPass = new OutputPass();
      composer.addPass(outputPass);

      const timer = new THREE.Timer();

      // Last report before the first frame. The frame itself is what compiles
      // every shader in the scene — on a cold cache that is the single longest
      // pause left, and it happens after this line, so the bar should already be
      // showing something honest by now.
      callbacksRef.current.onProgress?.(0.99, 'compositing');

      // Pointer parallax. Target set by the listener, current eases toward it in
      // the loop so a fast flick glides instead of snapping.
      const target2d = { x: 0, y: 0 };
      const current = { x: 0, y: 0 };

      const handlePointer = (event) => {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        target2d.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        target2d.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      };
      window.addEventListener('pointermove', handlePointer, { passive: true });

      // Scroll progress, 0 at the top of the page to 1 at the bottom. Read in the
      // listener and eased in the loop, same as the pointer — a raw value applied
      // straight to the camera makes a trackpad flick look like a jump cut.
      let scrollTarget = 0;
      let scrollCurrent = 0;

      const readScroll = () => {
        const scrollable =
          document.documentElement.scrollHeight - window.innerHeight;
        // Short pages have nothing to scroll; leave the camera at the start of
        // the path rather than dividing by zero.
        scrollTarget =
          scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      };
      readScroll();
      window.addEventListener('scroll', readScroll, { passive: true });
      window.addEventListener('resize', readScroll, { passive: true });

      let firstFrameDone = false;

      const renderFrame = () => {
        timer.update();

        current.x += (target2d.x - current.x) * 0.04;
        current.y += (target2d.y - current.y) * 0.04;
        scrollCurrent += (scrollTarget - scrollCurrent) * 0.06;

        castle.update(timer.getElapsed(), current, scrollCurrent);
        composer.render(timer.getDelta());

        if (!firstFrameDone) {
          firstFrameDone = true;
          callbacksRef.current.onReady?.();
        }
      };

      const start = () => renderer.setAnimationLoop(renderFrame);
      const stop = () => renderer.setAnimationLoop(null);

      start();

      // The host is fixed and full-viewport, so it is always intersecting — an
      // IntersectionObserver here would never fire. What is worth pausing for is a
      // backgrounded tab: rAF already throttles hidden tabs, but stopping the loop
      // outright guarantees no GPU work while the visitor is elsewhere.
      const handleVisibility = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener('visibilitychange', handleVisibility);

      const handleContextLost = () => {
        stop();
        callbacksRef.current.onLost?.();
      };
      canvas.addEventListener('webglcontextlost', handleContextLost);

      let resizeObserver;
      const applySize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        castle.resize(w, h);
        const ratio = Math.min(window.devicePixelRatio || 1, maxDpr);
        renderer.setPixelRatio(ratio);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(ratio);
        composer.setSize(w, h);
        bloom?.setSize(w * ratio, h * ratio);
      };
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(applySize);
        resizeObserver.observe(host);
      } else {
        window.addEventListener('resize', applySize);
      }

      // Handed to the effect's cleanup, which may already have run — hence the
      // `cancelled` check above rather than relying on this being called.
      teardown = () => {
        stop();
        resizeObserver?.disconnect();
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('resize', applySize);
        window.removeEventListener('pointermove', handlePointer);
        window.removeEventListener('scroll', readScroll);
        window.removeEventListener('resize', readScroll);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        castle.dispose();
        // Composer owns two render targets (the one passed in and its clone) plus
        // each pass's own; bloom alone holds a dozen. Its dispose walks them all.
        composer.dispose();
        bloom?.dispose();
        outputPass.dispose?.();
      };
    });

    // Chained rather than a second handler on `building`, so this covers both a
    // failed texture build and a throw while wiring the composer up. Either way
    // the renderer is alive with nothing to draw, so report it as a lost context
    // and let SiteBackdrop keep the CSS gradient up.
    building.catch(() => {
      if (!cancelled) callbacksRef.current.onLost?.();
    });

    return () => {
      cancelled = true;
      // Null until the build resolves. Either way the renderer and the canvas are
      // ours from the moment the effect ran, so they come down unconditionally.
      teardown?.();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 castle-canvas"
    />
  );
}
