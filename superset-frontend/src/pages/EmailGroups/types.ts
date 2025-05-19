export interface EmailGroupUser {
  id: number;
  first_name: string;
  last_name: string;
}

export interface EmailGroup {
  id: number;
  name: string;
  description?: string | null;
  emails: string; // Comma-separated string of emails
  created_by: EmailGroupUser;
  created_on: string; // ISO date string
  changed_by?: EmailGroupUser | null; // May not always be present or could be null
  changed_on?: string | null; // ISO date string, may not always be present
}

// For API responses, especially for _info endpoint if used
export interface EmailGroupApiResponse {
  count: number;
  ids: number[];
  result: EmailGroup[];
  // Add other fields from the API response if necessary, like permissions
  permissions?: string[]; 
} 