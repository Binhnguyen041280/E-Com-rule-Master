
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface EComRule {
  id: string;
  platform: 'Shopee' | 'TikTok Shop' | 'Thuế & Pháp lý';
  category: string;
  title: string;
  summary: string;
  details: string[];
  tips: string;
  priority: 'high' | 'medium' | 'low';
  sources?: GroundingSource[];
  fetchedAt: number;
  userNotes?: string;
  backgroundImage?: string;
  isNew?: boolean; // Đánh dấu thẻ mới do Agent quét được
}

export interface AgentLog {
  id: string;
  timestamp: number;
  action: string;
  platform: string;
  type: 'info' | 'update' | 'warning';
}

export interface DynamicCollections {
  [platform: string]: {
    [category: string]: string[];
  };
}

export interface RuleResponse {
  rules: EComRule[];
  sources: GroundingSource[];
  timestamp: number;
  suggestedCategories?: string[]; // Agent gợi ý danh mục mới
}

export interface GlobalSettings {
  globalBackgroundImage?: string;
  useGlobalBackground: boolean;
  themeColor: string;
  lastAgentScan?: number;
}
