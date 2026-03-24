import React from 'react';

export function GoogleMapsLoaderProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useGoogleMapsLoader() {
  return null;
}
