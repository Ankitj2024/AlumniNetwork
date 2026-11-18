export const ROLES = ['student', 'alumnus', 'aro', 'placement', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: Role[] = ['aro', 'placement', 'admin'];

export const MENTORING_AREAS = [
  'career_guidance',
  'interview_prep',
  'resume_review',
  'higher_studies',
  'entrepreneurship',
  'technical_skills',
  'industry_insight',
  'networking',
  'leadership',
] as const;

export const MENTORING_AREA_LABELS: Record<(typeof MENTORING_AREAS)[number], string> = {
  career_guidance: 'Career guidance',
  interview_prep: 'Interview preparation',
  resume_review: 'Resume review',
  higher_studies: 'Higher studies',
  entrepreneurship: 'Entrepreneurship',
  technical_skills: 'Technical skills',
  industry_insight: 'Industry insight',
  networking: 'Professional networking',
  leadership: 'Leadership',
};

export const INDUSTRIES = [
  'Software',
  'FinTech',
  'Consulting',
  'Data & AI',
  'Healthcare',
  'Manufacturing',
  'E-commerce',
  'Semiconductors',
  'Public Sector',
  'Research & Academia',
  'Telecom',
  'Energy',
] as const;

export const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Information Technology',
  'Management Studies',
] as const;

/** Preset, guilt-free decline reasons. Mentors may also decline with no reason at all. */
export const DECLINE_REASONS = [
  'at_capacity',
  'not_my_expertise',
  'timing',
  'better_match_elsewhere',
  'other',
] as const;

export const DECLINE_REASON_LABELS: Record<(typeof DECLINE_REASONS)[number], string> = {
  at_capacity: "I'm at capacity right now",
  not_my_expertise: "This isn't my area of expertise",
  timing: 'The timing does not work for me',
  better_match_elsewhere: 'Another mentor would be a better fit',
  other: 'Other',
};
