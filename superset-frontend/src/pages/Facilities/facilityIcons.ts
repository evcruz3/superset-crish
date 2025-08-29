// Facility icon mapping utilities
import { IconDefinition } from './types';

// Define the type for the facility icon mapping including all known facility types and a default
export type FacilityIconMappingType = {
  [key: string]: IconDefinition;
  'Health Post': IconDefinition;
  'Multi Drug Rehabilitation Center': IconDefinition;
  'National Hospital': IconDefinition;
  'Referral Hospital': IconDefinition;
  Pharmacy: IconDefinition;
  'Regional Hospital': IconDefinition;
  'Disability Rehabilitation Center': IconDefinition;
  Clinic: IconDefinition;
  'Mental Rehabilitation Center': IconDefinition;
  'Community Health Center': IconDefinition;
  'Health Post ': IconDefinition; // Note the space at the end
  'Clinic and Pharmacy': IconDefinition;
  'Community Health Center (Internment)': IconDefinition;
  default: IconDefinition;
};

// Create path constants for SVG files
const SVG_BASE_PATH = '/static/assets/images/icons/facilities/';

// Map facility types to icons with proper typing
export const FACILITY_ICON_MAPPING: FacilityIconMappingType = {
  'Health Post': {
    url: `${SVG_BASE_PATH}health-post.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Multi Drug Rehabilitation Center': {
    url: `${SVG_BASE_PATH}multi-drug-rehab.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'National Hospital': {
    url: `${SVG_BASE_PATH}national-hospital.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Referral Hospital': {
    url: `${SVG_BASE_PATH}referral-hospital.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  Pharmacy: {
    url: `${SVG_BASE_PATH}pharmacy.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Regional Hospital': {
    url: `${SVG_BASE_PATH}regional-hospital.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Disability Rehabilitation Center': {
    url: `${SVG_BASE_PATH}disability-rehab.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  Clinic: {
    url: `${SVG_BASE_PATH}clinic.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Mental Rehabilitation Center': {
    url: `${SVG_BASE_PATH}mental-rehab.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Community Health Center': {
    url: `${SVG_BASE_PATH}community-health-center.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Health Post ': {
    // Note the space at the end
    url: `${SVG_BASE_PATH}health-post.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Clinic and Pharmacy': {
    url: `${SVG_BASE_PATH}clinic-pharmacy.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  'Community Health Center (Internment)': {
    url: `${SVG_BASE_PATH}community-health-center-internment.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
  // Default icon for any unmatched facility types
  default: {
    url: `${SVG_BASE_PATH}default.svg`,
    width: 32,
    height: 32,
    anchorX: 16,
    anchorY: 16,
  },
};

// Helper function to get icon for a facility type with proper typing
export const getFacilityIcon = (facilityType: string): IconDefinition =>
  FACILITY_ICON_MAPPING[facilityType] || FACILITY_ICON_MAPPING.default;
