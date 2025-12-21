'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LandscapeWarning() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    // Function to check if device is in landscape mode
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        // Check if mobile device (screen width < 768px for tablets and below)
        const isMobile = window.innerWidth < 768;
        // Check if landscape (width > height)
        const isLandscapeMode = window.innerWidth > window.innerHeight;

        setIsLandscape(isMobile && isLandscapeMode);
      }
    };

    // Check on mount
    checkOrientation();

    // Listen for orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isLandscape) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-6">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <RotateCcw className="h-16 w-16 animate-pulse text-white" />
        </div>
        <h2 className="mb-3 font-bold text-2xl text-white">
          Rotate Your Device
        </h2>
        <p className="text-gray-300 text-lg">
          This app is best viewed in portrait mode. Please rotate your device to
          continue.
        </p>
      </div>
    </div>
  );
}
