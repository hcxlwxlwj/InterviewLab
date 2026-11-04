export interface PersonalSettings {
  display_name: string;
  bio: string;
  target_role: string;
  practice_minutes: number;
  city?: string;
  career_stage?: string;
  strengths?: string;
  learning_goals?: string;
  interaction_mode?: 'text_fallback' | 'realtime_voice';
  interviewer_style?: '标准' | '友好' | '深入追问';
  default_resume_id: string | null;
}
export interface PersonalMaterial {
  id: string;
  kind: 'resume' | 'experience';
  version: number;
  structure?: import('./resume-template').ResumeTemplate;
  title: string;
  text: string;
  confirmed: boolean;
  created_at: string;
}
