
import { GoogleGenAI, Type } from "@google/genai";
import { RuleResponse } from "../types";

const API_KEY = process.env.API_KEY || "";
const USAGE_STATS_KEY = "ecom_api_usage_stats";
const GLOBAL_CACHE_KEY = "ecom_rules_global_cache";
const CONTEXT_CACHE_REF_KEY = "ecom_context_cache_id_v2";

/**
 * BỘ TRI THỨC TMĐT CỐ ĐỊNH (KNOWLEDGE BASE)
 * Dữ liệu này sẽ được nạp vào Context Cache để tiết kiệm chi phí Input Tokens.
 */
const STABLE_ECOM_KNOWLEDGE = `
HỆ THỐNG QUY ĐỊNH THƯƠNG MẠI ĐIỆN TỬ VIỆT NAM (Cập nhật 2024-2025):

1. NỀN TẢNG SHOPEE:
- Phí thanh toán: 4% áp dụng cho tất cả đơn hàng.
- Phí cố định: 5% cho Người bán không thuộc Shopee Mall, 2-5% cho Shopee Mall tùy ngành hàng.
- Hệ thống Sao Quả Tạ: Điểm phạt tính theo tỷ lệ đơn hàng không thành công và tỷ lệ phản hồi chậm.
- Shopee Video: Quy định về bản quyền âm nhạc và nội dung không được chứa điều hướng ngoài.

2. NỀN TẢNG TIKTOK SHOP:
- Phí sàn: 5% tổng giá trị đơn hàng.
- Kiểm duyệt Livestream: Cấm các từ ngữ nhạy cảm về y tế, cam kết 100%, hoặc để lộ số điện thoại.
- Điểm vi phạm: Tích lũy 48 điểm sẽ bị khóa shop vĩnh viễn.
- Affiliate: Quy định về việc gắn link và hoa hồng tối thiểu cho creator.

3. NỀN TẢNG LAZADA:
- Phí cố định: Thay đổi theo ngành hàng (thường từ 2-4% cho Marketplace).
- LazMall: Yêu cầu chứng từ nguồn gốc xuất xứ nghiêm ngặt, cam kết hàng chính hãng 100%.
- Tỷ lệ giao hàng đúng hạn (SOT): Phải duy trì trên 90% để không bị giới hạn đơn hàng.

4. QUY ĐỊNH CHUNG & THUẾ:
- Thuế TMĐT: Sàn tự động khấu trừ thuế TNCN và GTGT đối với cá nhân kinh doanh (thường là 1.5%).
- Đóng gói: Quy định về kích thước và cân nặng quy đổi (Dài x Rộng x Cao / 6000).
- Hoàn hàng: Quy định về bằng chứng (Video unboxing) là bắt buộc để khiếu nại thành công.
`;

export const SecurityGuard = {
  checkQuota: (): { allowed: boolean; remaining: number } => {
    const today = new Date().toDateString();
    const statsRaw = localStorage.getItem(USAGE_STATS_KEY);
    let stats = statsRaw ? JSON.parse(statsRaw) : { date: today, count: 0 };
    if (stats.date !== today) stats = { date: today, count: 0 };
    const DAILY_LIMIT = 20;
    return { allowed: stats.count < DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - stats.count) };
  },
  recordUsage: () => {
    const today = new Date().toDateString();
    const statsRaw = localStorage.getItem(USAGE_STATS_KEY);
    let stats = statsRaw ? JSON.parse(statsRaw) : { date: today, count: 0 };
    if (stats.date !== today) stats = { date: today, count: 0 };
    stats.count += 1;
    localStorage.setItem(USAGE_STATS_KEY, JSON.stringify(stats));
  },
  isValidQuery: (query: string): boolean => {
    const q = query.toLowerCase();
    const keywords = ['shopee', 'lazada', 'tiktok', 'tiki', 'phí', 'hoàn', 'thuế', 'vi phạm', 'vận chuyển', 'điểm phạt'];
    return keywords.some(kw => q.includes(kw)) || q.includes('.vn') || q.includes('.com');
  }
};

export const StorageDB = {
  getStats: () => {
    const raw = localStorage.getItem(GLOBAL_CACHE_KEY) || "{}";
    return { sizeKb: (new Blob([raw]).size / 1024).toFixed(2), count: Object.keys(JSON.parse(raw)).length };
  },
  getGlobal: (query: string): RuleResponse | null => {
    try {
      const db = JSON.parse(localStorage.getItem(GLOBAL_CACHE_KEY) || "{}");
      return db[query.toLowerCase().trim()] || null;
    } catch (e) { return null; }
  },
  saveGlobal: (query: string, data: RuleResponse) => {
    try {
      const db = JSON.parse(localStorage.getItem(GLOBAL_CACHE_KEY) || "{}");
      db[query.toLowerCase().trim()] = { ...data, timestamp: Date.now() };
      localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify(db));
    } catch (e) {}
  }
};

/**
 * QUẢN LÝ CONTEXT CACHING
 */
const getContextCache = async (ai: any) => {
  const cachedName = localStorage.getItem(CONTEXT_CACHE_REF_KEY);
  
  if (cachedName) {
    try {
      // Kiểm tra xem cache còn hiệu lực không
      const cache = await ai.caches.get({ name: cachedName });
      return cache.name;
    } catch (e) {
      console.debug("Cache expired, creating new context...");
    }
  }

  try {
    const newCache = await ai.caches.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Bạn là chuyên gia cố vấn pháp lý TMĐT. Bạn có bộ tri thức nền tảng được nạp sẵn. Hãy sử dụng nó để trả lời nhanh và chính xác.",
        contents: [{ role: 'user', parts: [{ text: STABLE_ECOM_KNOWLEDGE }] }],
        ttlSeconds: 86400 // 24 giờ
      }
    });
    localStorage.setItem(CONTEXT_CACHE_REF_KEY, newCache.name);
    return newCache.name;
  } catch (e) {
    console.error("Context Caching Error:", e);
    return null;
  }
};

export const generateEComRules = async (query: string): Promise<RuleResponse> => {
  // 1. Kiểm tra Local Storage Cache trước
  const cachedData = StorageDB.getGlobal(query);
  if (cachedData) return cachedData;

  // 2. Kiểm tra bảo mật & định mức
  if (!SecurityGuard.isValidQuery(query)) throw new Error("REJECTED");
  const quota = SecurityGuard.checkQuota();
  if (!quota.allowed) throw new Error("QUOTA_EXCEEDED");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // 3. Lấy hoặc Tạo Context Cache
  const cacheName = await getContextCache(ai);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tra cứu và phân tích chi tiết quy định cho: "${query}"`,
      config: {
        cachedContent: cacheName || undefined,
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
    
    // Ghi nhận sử dụng
    SecurityGuard.recordUsage();

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
    console.error("AI Generation Error:", error);
    throw error;
  }
};
