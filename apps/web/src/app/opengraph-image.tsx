import { ImageResponse } from 'next/og';

/** The preview image shown when the site is shared (Open Graph / Twitter). */
export const alt = 'Alumni Mentor Network — mentoring that respects everyone’s time';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, background: '#f5f5f7', color: '#1d1d1f', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: '#1d1d1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 48 48">
              <path d="M13 37A30 30 0 0 1 24 16A30 30 0 0 1 35 37" stroke="#f5f5f7" strokeWidth="4.4" fill="none" strokeLinecap="round" />
              <path d="M14.4 30.2Q24 25.2 33.6 30.2" stroke="#f5f5f7" strokeWidth="3.4" fill="none" strokeLinecap="round" />
              <circle cx="24" cy="13.4" r="4.9" fill="#f5f5f7" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>Alumni Mentor Network</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.02 }}>Mentoring that respects</div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.02, color: '#0071e3' }}>everyone’s time.</div>
          <div style={{ marginTop: 28, fontSize: 30, color: '#6e6e73' }}>Verified alumni mentorship for institutions — privately.</div>
        </div>
      </div>
    ),
    size,
  );
}
