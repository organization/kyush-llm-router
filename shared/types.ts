export interface User {
  id: number;
  api_key: string;
  name: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Backend {
  id: number;
  name: string;
  base_url: string;
  api_key?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  user_id: number;
  backend_id: number;
  created_at: string;
}

export interface CreateUserData {
  name: string;
  email?: string;
}

export interface CreateBackendData {
  name: string;
  base_url: string;
  api_key?: string;
}

export interface CreatePermissionData {
  user_id: number;
  backend_id: number;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  is_active?: boolean;
}

export interface UpdateBackendData {
  name?: string;
  base_url?: string;
  api_key?: string;
  is_active?: boolean;
}

export interface RequestLog {
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
}

export interface UsageStats {
  id: number;
  user_id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
}

export interface BackendMetrics {
  id: number;
  backend_id: number;
  date: string;
  total_requests: number;
  total_tokens: number;
  avg_response_time_ms: number;
  error_count: number;
  success_rate: number;
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}
