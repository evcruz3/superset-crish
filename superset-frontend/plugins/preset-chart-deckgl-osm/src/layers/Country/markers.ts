import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faExclamationCircle, 
  faWarning,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
  faQuestionCircle,
  faFlag,
  faBell
} from '@fortawesome/free-solid-svg-icons';

export const ICON_MAPPING = {
  'fa-exclamation-circle': faExclamationCircle,
  'fa-warning': faWarning,
  'fa-info-circle': faInfoCircle,
  'fa-check-circle': faCheckCircle,
  'fa-times-circle': faTimesCircle,
  'fa-question-circle': faQuestionCircle,
  'fa-flag': faFlag,
  'fa-bell': faBell,
};

export const createSVGIcon = (icon: any, color: string, size: number) => {
  // Add padding to prevent icon from being cut off
  const padding = size * 0.2; // 20% padding
  const totalSize = size + (padding * 2);
  
  // Create SVG with padding and centered icon
  const svgString = `
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="${totalSize}" 
      height="${totalSize}" 
      viewBox="0 0 ${totalSize} ${totalSize}"
    >
      <g transform="translate(${padding},${padding})">
        <path 
          fill="${color}" 
          d="${icon.icon[4]}" 
          transform="scale(${size/512})"
        />
      </g>
    </svg>`.trim();
  
  const base64 = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${base64}`;
};

// Remove cleanup since we're not using object URLs anymore
export const cleanupIconUrl = (url: string) => {
  // No cleanup needed for data URLs
}; 