export interface PublicEducationPost {
  id: number;
  title: string;
  message: string;
  hashtags: string;
  video_url?: string;
  youtube_embed_url?: string;
  attachments: Array<{
    id: number;
    file_url: string;
    file_type: 'pdf' | 'image';
    file_name: string;
    thumbnail_url: string | null;
  }>;
  created_by: {
    first_name: string;
    last_name: string;
  };
  created_on: string;
  changed_on: string;
}

export interface CreatePublicEducationPayload {
  title: string;
  message: string;
  hashtags: string;
  video_url?: string;
  attachments: File[];
}
