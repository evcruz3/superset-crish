export interface CreatedBy {
  first_name: string;
  last_name: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
}

export interface ImageAttachment {
  id: number;
  s3_key: string;
  caption?: string;
  url: string;
  created_on?: string;
  changed_on?: string;
  file?: File; // For client-side handling of new uploads
}

export interface Bulletin {
  id: number;
  title: string;
  advisory: string;
  risks: string;
  safety_tips: string;
  hashtags: string;
  thumbnail_url?: string | null;
  created_by?: User;
  created_on?: string;
  changed_on?: string;
  image_attachments?: ImageAttachment[]; // Updated from string to ImageAttachment[]
}

export interface BulletinApiResponse {
  count: number;
  result: Bulletin[];
}

export interface CreateBulletinPayload {
  title: string;
  advisory: string;
  risks: string;
  safety_tips: string;
  hashtags: string;
}

export interface BulletinFormData {
  title: string;
  advisory: string;
  risks: string;
  safety_tips: string;
  hashtags: string;
  image_attachments?: string | null;
  image_attachment_file?: File | null;
}

export interface BulletinSortOption {
  // ... existing code ...
} 