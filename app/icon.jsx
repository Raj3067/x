import { ImageResponse } from 'next/og';

// ---------------------------------------------------------------------------
// Favicon — generated at build time, no image file to maintain.
//
// An "LB" monogram in cyan on the near-black background, matching the wordmark.
// Next.js picks this up automatically from app/icon.jsx.
// ---------------------------------------------------------------------------

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05060A',
          color: '#22D3EE',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          fontFamily: 'sans-serif',
          border: '1.5px solid #22304A',
          borderRadius: 4,
        }}
      >
        LB
      </div>
    ),
    size
  );
}
