'use client';

interface FoamPreviewProps {
  imageUrl: string;
}

export default function FoamPreview({ imageUrl }: FoamPreviewProps) {
  return (
    <div className="foam-preview">
      <div className="cup-outer">
        <div className="cup-inner">
          <img src={imageUrl} alt="Coffee Foam Art" className="foam-art" />
          <div className="froth-texture"></div>
        </div>
      </div>
      
      <style jsx>{`
        .foam-preview {
          padding: 2rem;
          display: flex;
          justify-content: center;
        }
        .cup-outer {
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: #f0f0f0;
          border: 12px solid #fff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2), inset 0 0 10px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .cup-outer::after {
          content: '';
          position: absolute;
          width: 60px;
          height: 100px;
          border: 12px solid #fff;
          border-left: none;
          border-radius: 0 50px 50px 0;
          right: -60px;
          top: 100px;
          z-index: -1;
        }
        .cup-inner {
          width: 280px;
          height: 280px;
          border-radius: 50%;
          overflow: hidden;
          background: #3e2723; /* Coffee color underneath */
          position: relative;
          box-shadow: inset 0 0 40px rgba(0,0,0,0.6);
        }
        .foam-art {
          width: 100%;
          height: 100%;
          object-fit: cover;
          mix-blend-mode: screen; /* Blend with coffee color */
          opacity: 0.9;
        }
        .froth-texture {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, transparent 70%, rgba(255,255,255,0.3) 100%);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
