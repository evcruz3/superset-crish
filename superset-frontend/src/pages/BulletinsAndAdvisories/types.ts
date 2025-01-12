export interface Bulletin {
  id: number;
  title: string;
  message: string;
  hashtags: string;
  chart_id: number | null;
  created_by: string;
  created_on: string;
}

export interface BulletinApiResponse {
  count: number;
  result: Bulletin[];
}

export interface CreateBulletinPayload {
  title: string;
  message: string;
  hashtags: string;
  chartId: number | null;
} 