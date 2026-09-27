export interface Report {
  id: string;
  tracking_code: string;
  reporter_name: string;
  reporter_phone: string;
  photo_url: string | null;
  video_url: string | null;
  text_description: string | null;
  transcript: string | null;
  location: string;
  category: string;
  severity_score: number;
  confidence_score: number;
  recommended_action?: string;
  duplicate_of: string | null;
  model_name: string;
  gpu_type: string;
  latency_ms: number;
  status: string;
  created_at: string;
  is_mock?: boolean;
  duplicates?: Report[];
  duplicate_count?: number;
  matched_parent?: {
    tracking_code: string;
    category: string;
    severity_score: number;
    status: string;
    location: string;
  } | null;
  duplicate_reports?: Report[];
}
