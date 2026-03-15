export interface User {
  id: string;
  name: string;
  email: string;
  is_verified: boolean;
  is_google_user: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatWithMessages {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  nickname: string | null;
  occupation: string | null;
  about_you: string | null;
  custom_instructions: string | null;
  tone: string;
  response_style: string;
  onboarding_completed: boolean;
}

export interface APIKey {
  id: string;
  key: string;
  key_preview?: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}
