export interface CreatedBy {
  first_name: string;
  last_name: string;
}

export interface Bulletin {
  id: number;
  title: string;
  advisory: string;
  risks: string;
  safety_tips: string;
  hashtags: string;
  chart_id: number | null;
  thumbnail_url?: string;
  created_by: CreatedBy;
  created_on: string;
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
  chart_id: number | null;
} 