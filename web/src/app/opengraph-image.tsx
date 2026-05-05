import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CineRadar - Indonesia Movie Tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #581c87 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 120,
            marginBottom: 20,
          }}
        >
          🎬
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            letterSpacing: '-0.05em',
          }}
        >
          CineRadar
        </div>
        <div
          style={{
            fontSize: 30,
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: 10,
          }}
        >
          Indonesia Movie Intelligence
        </div>
      </div>
    ),
    { ...size }
  );
}
