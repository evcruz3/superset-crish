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

export interface DiseaseForecastAlert {
  id: number;
  municipality_code: string;
  municipality_name: string;
  forecast_date: string;
  disease_type: string;
  alert_level: string;
}

export interface WeatherForecastAlert {
  municipality_code: string;
  municipality_name: string;
  created_date: string;
  forecast_date: string;
  weather_parameter: string;
  alert_level: string;
  parameter_value: number;
  alert_title: string;
  alert_message: string;
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
  disease_forecast_alert?: DiseaseForecastAlert;
  weather_forecast_alert?: WeatherForecastAlert;
  weather_forecast_alert_composite_id?: string;
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