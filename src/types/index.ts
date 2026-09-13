export type Facility = {
  id: string
  code: string | null
  name: string
  facility_type: string | null
  affiliation: string | null
  district: string | null
  province: string | null
  cup_hospital: string | null
  address: string | null
  contact: string | null
  created_at: string
}

export type StandardVersion = {
  id: string
  code: string
  name: string
  description: string | null
}

export type Category = {
  id: string
  standard_version_id: string
  code: string
  name_th: string
  description: string | null
  sort_order: number
}

export type TopicGroup = {
  id: string
  category_id: string
  code: string
  name_th: string
  description: string | null
  sort_order: number
}

export type S3Breakdown = {
  staff?: Record<'0' | '1' | '2', string>
  system?: Record<'0' | '1' | '2', string>
  structure?: Record<'0' | '1' | '2', string>
}

export type Topic = {
  id: string
  category_id: string
  topic_group_id: string | null
  code: string
  name_th: string
  intent_text: string | null
  must_text: string | null
  score0_text: string | null
  score1_text: string | null
  score2_text: string | null
  content_text: string | null
  s3_breakdown: S3Breakdown | null
  is_optional: boolean
  allow_na: boolean
  sort_order: number
}

export type TopicEvidenceItem = {
  id: string
  topic_id: string
  label: string
  sort_order: number
}

export type TopicScoreItem = {
  id: string
  topic_id: string
  score_level: -2 | -1 | 0 | 1 | 2
  item_text: string
  sort_order: number
}

export type TopicPhoto = {
  id: string
  round_id: string
  topic_id: string
  item_id: string | null
  uploaded_by: string | null
  file_path: string
  file_name: string | null
  size_bytes: number | null
  created_at: string
}

export type ItemNote = {
  checked: boolean
  comment: string
}

export type ScoringMode = 'average' | 'collaborative'

export type AssessmentRound = {
  id: string
  facility_id: string
  standard_version_id: string
  name: string
  survey_date: string | null
  join_code: string
  status: 'draft' | 'in_progress' | 'completed'
  is_public: boolean
  scoring_mode: ScoringMode
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export type ParticipantRole = 'evaluator' | 'viewer' | 'chair'

export type Participant = {
  id: string
  round_id: string
  name: string
  role: ParticipantRole
  device_key: string
  civil_service_level: string | null
  affiliation: string | null
  joined_at: string
}

export type AdminProfile = {
  user_id: string
  first_name: string | null
  last_name: string | null
  profession: string | null
  email: string | null
  updated_at: string
}

export type AdminAllowlistEntry = {
  email: string
  added_by: string | null
  created_at: string
}

export type CommitteeMember = {
  id: string
  name: string
  civil_service_level: string | null
  affiliation: string | null
  position: string | null
  phone: string | null
  email: string | null
  note: string | null
  created_at: string
}

export type ScoreValue = 0 | 1 | 2

export type Score = {
  id: string
  round_id: string
  topic_id: string
  participant_id: string
  score: ScoreValue | null
  is_na: boolean
  must_pass: boolean | null
  comment: string | null
  evidence_checked: string[]
  item_notes: Record<string, ItemNote>
  updated_at: string
}

export type TeamItemNote = ItemNote & { checkedBy?: string | null }

export type TeamScore = {
  id: string
  round_id: string
  topic_id: string
  score: ScoreValue | null
  is_na: boolean
  must_pass: boolean | null
  comment: string | null
  item_notes: Record<string, TeamItemNote>
  updated_by: string | null
  must_pass_updated_by: string | null
  updated_at: string
}

export type TeamScoreAuditField = 'score' | 'must_pass' | 'item_checked'

export type TeamScoreAudit = {
  id: string
  round_id: string
  topic_id: string
  item_id: string | null
  field: TeamScoreAuditField
  participant_id: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

export type FullStandard = {
  standardVersion: StandardVersion
  categories: (Category & {
    groups: (TopicGroup & { topics: (Topic & { evidence: TopicEvidenceItem[]; scoreItems: TopicScoreItem[] })[] })[]
    topics: (Topic & { evidence: TopicEvidenceItem[]; scoreItems: TopicScoreItem[] })[]
  })[]
}
