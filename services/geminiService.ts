
import { GoogleGenAI, Type } from "@google/genai";
import { RuleResponse, EComRule, GroundingSource, AgentLog, DynamicCollections } from "../types";

const API_KEY = process.env.API_KEY || "";
const GLOBAL_CACHE_KEY = "ecom_rules_v10";

const PLATFORM_OFFICIAL_DOMAINS: Record<string, string> = {
  'Shopee': 'help.shopee.vn, shopee.vn/m/bieu-phi-nguoi-ban',
  'TikTok Shop': 'seller-vn.tiktok.com, tiktoksellercenter.com',
  'Thuế & Pháp lý': 'gdt.gov.vn, thuvienphapluat.vn'
};

export const StorageDB = {
  getData: () => JSON.parse(localStorage.getItem(GLOBAL_CACHE_KEY) || "{}"),
  saveData: (data: any) => localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify(data)),
  
  getPlatformMaster: (platform: string) => {
    const db = StorageDB.getData();
    return db[`master:${platform}`] || null;
  },
  
  getLogs: (): AgentLog[] => {
    const db = StorageDB.getData();
    return db.logs || [];
  },

  addLog: (log: Omit<AgentLog, 'id' | 'timestamp'>) => {
    const db = StorageDB.getData();
    const newLog: AgentLog = { ...log, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
    db.logs = [newLog, ...(db.logs || [])].slice(0, 50);
    StorageDB.saveData(db);
  }
};

const AGENT_INSTRUCTION = `
Bạn là "Sentinel Agent TMĐT 2026". 
Nhiệm vụ: 
1. Tự động quét và phát hiện các thay đổi quy định mới nhất.
2. Phân loại độ ưu tiên: 'high' cho các thay đổi về phí, thuế hoặc luật cấm; 'medium' cho vận hành; 'low' cho mẹo vặt.
3. Nếu phát hiện một chủ đề mới chưa có trong danh mục (ví dụ: Quy định về AI Content), hãy đề xuất tên danh mục mới.
4. Luôn trích dẫn nguồn từ các tên miền chính thống.
`;

export const EComAgent = {
  // Quét toàn bộ dữ liệu của một sàn để cập nhật "Master Data" và "Global Library"
  runDeepScan: async (platform: string): Promise<RuleResponse> => {
    StorageDB.addLog({ action: `Bắt đầu quét Deep Scan cho ${platform}`, platform, type: 'info' });
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const officialDomain = PLATFORM_OFFICIAL_DOMAINS[platform as keyof typeof PLATFORM_OFFICIAL_DOMAINS];
    
    const prompt = `[PROACTIVE AGENT SCAN 2026] 
    Quét toàn bộ tin tức, thông báo và trung tâm trợ giúp tại ${officialDomain}.
    Tìm ra 10 quy định/thông báo QUAN TRỌNG NHẤT đang có hiệu lực hoặc sắp áp dụng trong năm 2026.
    Phân tích và trả về danh sách thẻ quy tắc.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: AGENT_INSTRUCTION,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    platform: { type: Type.STRING },
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    details: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tips: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
                  },
                  required: ["id", "platform", "category", "title", "summary", "details", "tips", "priority"]
                }
              },
              suggestedCategories: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{"rules":[], "suggestedCategories":[]}');
      const timestamp = Date.now();
      
      const sources: GroundingSource[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((c: any) => { if (c.web) sources.push({ title: c.web.title, uri: c.web.uri }); });
      }

      const rules = data.rules.map((r: any) => ({ ...r, fetchedAt: timestamp, sources, isNew: true }));
      
      StorageDB.addLog({ 
        action: `Hoàn tất quét. Tìm thấy ${rules.length} quy tắc. Đề xuất ${data.suggestedCategories?.length || 0} mục mới.`, 
        platform, 
        type: 'update' 
      });

      return { rules, sources, timestamp, suggestedCategories: data.suggestedCategories };
    } catch (e) {
      StorageDB.addLog({ action: `Lỗi khi quét: ${e}`, platform, type: 'warning' });
      throw e;
    }
  }
};

export const generateEComRules = async (query: string, platform: string): Promise<RuleResponse> => {
  // Giữ nguyên logic tìm kiếm theo yêu cầu người dùng, nhưng sử dụng Agent Instruction
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Phân tích chuyên sâu về chủ đề: "${query}" tại ${platform} năm 2026.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: AGENT_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                platform: { type: Type.STRING },
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                details: { type: Type.ARRAY, items: { type: Type.STRING } },
                tips: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
              },
              required: ["id", "platform", "category", "title", "summary", "details", "tips", "priority"]
            }
          }
        }
      }
    }
  });

  const data = JSON.parse(response.text || '{"rules":[]}');
  const timestamp = Date.now();
  const sources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((c: any) => { if (c.web) sources.push({ title: c.web.title, uri: c.web.uri }); });
  }

  return { 
    rules: data.rules.map((r: any) => ({ ...r, fetchedAt: timestamp, sources, platform })), 
    sources, 
    timestamp 
  };
};
