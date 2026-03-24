import React, { createContext, useContext } from 'react';
import Constants from 'expo-constants';
import { useJsApiLoader } from '@react-google-maps/api';

function getGoogleMapsApiKey(): string {
  const fromExtra = Constants.expoConfig?.extra?.googleMapsApiKey;
  const fromEnv =
    typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const key = (fromExtra || fromEnv || '') as string;
  const placeholder = 'your_google_maps_api_key';
  return typeof key === 'string' && key && key !== placeholder ? key : '';
}

interface GoogleMapsLoaderContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
  apiKey: string;
}

const GoogleMapsLoaderContext = createContext<GoogleMapsLoaderContextValue | null>(null);

export function GoogleMapsLoaderProvider({ children }: { children: React.ReactNode }) {
  const apiKey = getGoogleMapsApiKey();
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script-tulkarm',
    googleMapsApiKey: apiKey || 'no-key',
    preventGoogleFontsLoading: true,
    language: 'ar',
    region: 'PS',
  });

  return (
    <GoogleMapsLoaderContext.Provider value={{ isLoaded, loadError, apiKey }}>
      {children}
    </GoogleMapsLoaderContext.Provider>
  );
}

export function useGoogleMapsLoader() {
  return useContext(GoogleMapsLoaderContext);
}
