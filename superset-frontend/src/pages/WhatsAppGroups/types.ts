export interface User {
  id: number;
  first_name: string;
  last_name: string;
}

export interface WhatsAppGroup {
  id: number;
  name: string;
  description?: string | null;
  phone_numbers?: string | null; // Assuming it's a comma-separated string for now
  created_on: string; // ISO date string
  changed_on?: string | null; // ISO date string
  created_by?: User | null;
  changed_by?: User | null;
}
