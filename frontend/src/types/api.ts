export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  email: string;
  org_id: string;
  role: string;
}

export interface SubjectOut {
  id: string;
  org_id: string;
  created_by_user_id: string;
  full_name: string;
  role_title: string | null;
  relationship_type: string;
  created_at: string;
  archived_at: string | null;
}

export interface SubjectListItem {
  id: string;
  full_name: string;
  role_title: string | null;
  relationship_type: string;
  created_at: string;
  archived_at: string | null;
  entry_count: number;
  last_entry_at: string | null;
  summary_status: "complete" | "stale" | "pending" | "failed" | null;
}

export interface EntryOut {
  id: string;
  subject_id: string;
  org_id: string;
  author_user_id: string;
  author_email: string;
  content_type: "text" | "voice";
  raw_text: string | null;
  audio_url: string | null;
  transcription_status: "pending" | "complete" | "failed" | null;
  tags: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntryPage {
  items: EntryOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface EvidenceItem {
  text: string;
  entry_id: string | null;
}

export interface CoreTrait {
  trait: string;
  evidence: EvidenceItem[];
}

export interface NotableEpisode {
  title: string;
  description: string;
  date_approx: string;
  qualities_demonstrated: string[];
}

export interface CautionItem {
  text: string;
  entry_ids: string[];
}

export interface StructuredSummary {
  core_traits: CoreTrait[];
  notable_episodes: NotableEpisode[];
  growth_arc: string;
  relationship_texture: string;
  cautions: CautionItem[];
  raw_entry_count: number;
  date_range: { earliest: string; latest: string };
}

export interface SummaryOut {
  id: string;
  subject_id: string;
  org_id: string;
  structured_summary: StructuredSummary | null;
  plain_text_summary: string | null;
  last_distilled_at: string | null;
  distillation_version: number;
  entry_count_at_distillation: number | null;
  distillation_status: "pending" | "complete" | "failed" | "stale";
}

export interface LetterOut {
  id: string;
  subject_id: string;
  org_id: string;
  requested_by_user_id: string;
  purpose: string;
  tone: "formal" | "warm" | "balanced";
  letter_text: string | null;
  grounding_entry_ids: string[];
  generation_metadata: Record<string, unknown> | null;
  created_at: string;
}
