import { LinearInterpolator } from '@deck.gl/core';

// Type definitions moved from index.tsx

export interface Facility {
  id: number;
  name: string;
  facility_type: string;
  location: string; // Administrative Post
  municipality: string;
  code?: string; // Optional code
  suco?: string; // Optional suco
  aldeia?: string; // Optional aldeia
  latitude: number;
  longitude: number;
  elevation?: number; // Optional elevation
  property_type?: string; // Optional property type
  address?: string;
  phone?: string;
  email?: string;
  services?: string;
  operating_days?: string; // Optional operating days
  operating_hours?: string;
  total_beds?: number;
  maternity_beds?: number;
  has_ambulance: boolean;
  has_emergency: boolean;
  created_on?: string;
  distance?: number; // Added for nearby search results
}

export interface FacilityCountData {
  total: number;
  by_type: Record<string, number>;
  by_location: Record<string, number>; // By Administrative Post
  by_municipality: Record<string, number>;
}

export interface ChartDataItem {
  name: string;
  value: number;
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number | 'auto'; // Allow 'auto'
  transitionInterpolator?: LinearInterpolator;
}

// Interface for facility icons
export interface IconDefinition {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}
