
import { GoogleGenAI, Type } from "@google/genai";
import { RuleResponse } from "../types";

const API_KEY = process.env.API_KEY || "";
const GLOBAL_CACHE_KEY = "ecom_rules_global_cache";
const USAGE_STATS_KEY = "ecom_api_usage_stats";

// DANH SÁCH TỪ KHÓA ĐỂ LỌC NHIỄU (GATEKEEPER)
const ECOM_KEYWORDS = [
  'shopee', 'lazada', 'tiktok', 'tiki', 'phí', 'hoàn hàng', 'vận chuyển', 
  'livestream', 'điểm phạt', 'sao quả tạ', 'vi phạm', 'thuế', 'hóa đơn',
  'kho', 'đóng gói', 'vouchers', 'quảng cáo', 'đấu thầu', 'shop yêu thích',
  'mall', 'affiliate', 'tiếp thị', 'đối soát', 'ví', 'rút tiền'
];

/**
 * SECURITY ENGINE
 * Quản lý định mức và lọc nhiễu
 */
export const SecurityGuard = {
  // Kiểm tra định mức sử dụng trong ngày
  checkQuota: (): { allowed: boolean; remaining: number } => {
    const today = new Date().toDateString();
    const statsRaw = localStorage.getItem(USAGE_STATS_KEY);
    let stats = statsRaw ? JSON.parse(statsRaw) : { date: today, count: 0 };

    if (stats.date !== today) {
      stats = { date: today, count: 0 };
    }

    const DAILY_LIMIT = 20; // Giới hạn 20 lần/ngày cho mỗi trình duyệt
    return {
      allowed: stats.count < DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - stats.count)
    };
  },

  // Ghi nhận một lần sử dụng thành công
  recordUsage: () => {
    const today = new Date().toDateString();
    const statsRaw = localStorage.getItem(USAGE_STATS_KEY);
    let stats = statsRaw ? JSON.parse(statsRaw) : { date: today, count: 0 };
    
    if (stats.date !== today) stats = { date: today, count: 0 };
    stats.count += 1;
    localStorage.setItem(USAGE_STATS_KEY, JSON.stringify(stats));
  },

  // Lọc nhiễu: Kiểm tra xem query có liên quan đến TMĐT không
  isValidQuery: (query: string): boolean => {
    const q = query.toLowerCase();
    // Nếu là link sàn TMĐT thì cho qua luôn
    if (q.includes('shopee.vn') || q.includes('tiktok.com') || q.includes('lazada.vn')) return true;
    
    // Kiểm tra từ khóa
    return ECOM_KEYWORDS.some(kw => q.includes(kw));
  }
};

export const StorageDB = {
  getStats: () => {
    const raw = localStorage.getItem(GLOBAL_CACHE_KEY) || "{}";
    const size = new Blob([raw]).size;
    const count = Object.keys(JSON.parse(raw)).length;
    return { 
      sizeKb: (size / 1024).toFixed(2), 
      count,
      limitKb: 4096 
    };
  },

  getGlobal: (query: string): RuleResponse | null => {
    try {
      const db = JSON.parse(localStorage.getItem(GLOBAL_CACHE_KEY) || "{}");
      const normalizedKey = query.toLowerCase().trim();
      return db[normalizedKey] || null;
    } catch (e) {
      return null;
    }
  },

  saveGlobal: (query: string, data: RuleResponse) => {
    try {
      const db = JSON.parse(localStorage.getItem(GLOBAL_CACHE_KEY) || "{}");
      const normalizedKey = query.toLowerCase().trim();
      db[normalizedKey] = { ...data, timestamp: Date.now() };
      
      let raw = JSON.stringify(db);
      while (new Blob([raw]).size > 4 * 1024 * 1024) {
        const keys = Object.keys(db);
        const oldestKey = keys.reduce((a, b) => db[a].timestamp < db[b].timestamp ? a : b);
        delete db[oldestKey];
        raw = JSON.stringify(db);
      }
      localStorage.setItem(GLOBAL_CACHE_KEY, raw);
    } catch (e) {
      console.error("Storage Error:", e);
    }
  }
};

export const generateEComRules = async (query: string): Promise<RuleResponse> => {
  // 1. Kiểm tra Cache trước (Không tốn xu nào)
  const cachedData = StorageDB.getGlobal(query);
  if (cachedData) return cachedData;

  // 2. Kiểm tra Gatekeeper (Chống nhiễu)
  if (!SecurityGuard.isValidQuery(query)) {
    throw new Error("QUERY_REJECTED: Nội dung không liên quan đến TMĐT.");
  }

  // 3. Kiểm tra Quota (Chống phá hoại)
  const quota = SecurityGuard.checkQuota();
  if (!quota.allowed) {
    throw new Error("QUOTA_EXCEEDED: Bạn đã hết lượt tra cứu hôm nay. Vui lòng quay lại sau.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const today = new Date().toLocaleDateString('vi-VN');
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `BỐI CẢNH: Bạn là chuyên gia luật TMĐT. Chỉ phân tích các vấn đề liên quan đến Shopee, Lazada, TikTok Shop, Tiki, phí vận hành, chính sách nhà bán hàng. 
      NGÀY: ${today}.
      TRUY VẤN: "${query}".

      QUY TẮC BẢO MẬT: 
      - Nếu truy vấn CỐ TÌNH hỏi về chủ đề khác (chính trị, nấu ăn, lập trình, v.v.), hãy trả về {"rules": []} ngay lập tức.
      - Nếu là câu hỏi TMĐT hợp lệ, hãy thực hiện Google Search để lấy dữ liệu mới nhất.`,
      config: {
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
                  sourceUrl: { type: Type.STRING }
                },
                required: ["id", "platform", "category", "title", "summary", "details", "tips", "sourceUrl"]
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || '{"rules":[]}');
    
    // Ghi nhận sử dụng API thành công sau khi có kết quả
    SecurityGuard.recordUsage();

    if (!parsedData.rules || parsedData.rules.length === 0) return { rules: [], sources: [] };

    const sources: any[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
      });
    }

    const finalResult = { rules: parsedData.rules, sources };
    StorageDB.saveGlobal(query, finalResult);

    return finalResult;
  } catch (error: any) {
    if (error.message.includes('QUOTA') || error.message.includes('REJECTED')) throw error;
    throw new Error("Lỗi kết nối AI.");
  }
};
