
export interface EComRule {
  id: string;
  platform: string;
  category: string;
  title: string;
  summary: string;
  details: string[];
  tips: string;
  sourceUrl?: string;
  customColor?: string;
  userNotes?: string;
  isPinned?: boolean;
  priority?: 'high' | 'medium' | 'low';
  savedAt?: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface RuleResponse {
  rules: EComRule[];
  sources: GroundingSource[];
}
