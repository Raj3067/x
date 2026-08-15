import { Russo_One, Chakra_Petch } from 'next/font/google';
import { site } from '@/content/site.config';
import { MotionProvider } from '@/components/MotionProvider';
import { SceneStatusProvider } from '@/components/SceneStatusProvider';
import BootScreen from '@/components/BootScreen';
import CrtEffects from '@/components/CrtEffects';
import MotionToggle from '@/components/MotionToggle';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import SiteBackdrop from '@/components/SiteBackdrop';
import './globals.css';

// next/font self-hosts these at build time — no runtime request to Google, and
// no layout shift while a webfont loads.
const display = Russo_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const body = Chakra_Petch({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata = {
  title: {
    default: `${site.serverName} — Discord community`,
    template: `%s — ${site.serverName}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.serverName} — Discord community`,
    description: site.description,
    type: 'website',
    siteName: site.serverName,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.serverName} — Discord community`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05060A',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      {/* suppressHydrationWarning is here for browser extensions, not for our
          own markup. Privacy/antivirus extensions (Bitdefender writes
          `bis_register`, others add their own) mutate <body> before React
          hydrates, which React reports as an attribute mismatch we cannot fix
          from this side.

          It applies to this element's own attributes and text only — it does not
          cascade to children, so a genuine mismatch anywhere inside the tree is
          still reported. Do not add it further down to silence a real warning. */}
      <body
        suppressHydrationWarning
        className="min-h-dvh bg-ink text-body antialiased"
      >
        <MotionProvider>
          {/* Shared "is the 3D scene up yet" signal. Wraps both the backdrop
              that reports it and the boot screen that waits on it. */}
          <SceneStatusProvider>
            {/* Skip link — first thing in the tab order. */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-modal focus:rounded-sm focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink"
            >
              Skip to content
            </a>

            {/* Fixed 3D background behind every page. Mounted here rather than
                per page so client-side navigation does not tear down and rebuild
                the WebGL scene on every route change. */}
            <SiteBackdrop />

            <CrtEffects />

            {/* The flicker rides on this wrapper so it composites in isolation
                and never affects the fixed overlays above it. `relative` puts
                the whole content column above the fixed backdrop at z-index 0. */}
            <div className="relative crt-flicker">
              <SiteHeader />

              {/* Top padding clears the fixed header. */}
              <main id="main" className="pt-24 sm:pt-28">
                {children}
              </main>

              <SiteFooter />
            </div>

            <MotionToggle />

            {/* Last in the tree and above everything in the z-index ladder: it
                covers the site until the castle has painted its first frame.

                It is server-rendered on purpose, so it is up in the very first
                HTML rather than appearing a beat after hydration. That means it
                would also be up for good if JS never runs at all — hence the
                noscript rule below, which is the only thing standing between a
                JS-disabled visitor and a permanently covered page. */}
            <BootScreen />
            <noscript
              // The panel is plain server-rendered HTML, so with JS disabled it
              // paints and nothing is ever able to take it down. This is the one
              // rule that keeps that from being a blank site.
              dangerouslySetInnerHTML={{
                __html: '<style>.boot-screen{display:none!important}</style>',
              }}
            />
          </SceneStatusProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
