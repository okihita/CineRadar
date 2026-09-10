import { ImageResponse } from 'next/og';
import { id } from '@/i18n/locales/id';

export const alt = `${id.common.appName} - ${id.common.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const brandTitle = id.common.appName;
  const brandTagline = id.common.tagline;

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 32,
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            marginBottom: 32,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 3v18" />
            <path d="M3 7.5h4" />
            <path d="M3 12h18" />
            <path d="M3 16.5h4" />
            <path d="M17 3v18" />
            <path d="M17 7.5h4" />
            <path d="M17 16.5h4" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            letterSpacing: '-0.05em',
          }}
        >
          {brandTitle}
        </div>
        <div
          style={{
            fontSize: 30,
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: 10,
          }}
        >
          {brandTagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
