export type User = {
  id: number;
  api_key: string;
  name: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Backend = {
  id: number;
  name: string;
  base_url: string;
  api_key?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: number;
  user_id: number;
  backend_id: number;
  created_at: string;
};

export type RequestLog = {
  id: number;
  user_id: number;
  backend_id: number;
  endpoint: string;
  request_model?: string;
  response_model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  status_code: number;
  response_time_ms?: number;
  error_message?: string;
  created_at: string;
};

export type UsageStats = {
  id: number;
  user_id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
};

export type BackendMetrics = {
  id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
};
