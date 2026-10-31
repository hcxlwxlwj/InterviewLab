export interface PersonalSettings {
  display_name: string;
  bio: string;
  target_role: string;
  practice_minutes: number;
  default_resume_id: string | null;
}
export interface PersonalMaterial {
  id: string;
  kind: 'resume' | 'experience';
  version: number;
  title: string;
  text: string;
  confirmed: boolean;
  created_at: string;
}
