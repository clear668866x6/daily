
import { GoogleGenAI, Type } from "@google/genai";
import { EnglishDailyContent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getFallbackData = (errorTitle: string, errorDetail: string): EnglishDailyContent => {
    return {
      article: `> **⚠️ ${errorTitle}**\n> ${errorDetail}\n\n---\n\n### 📖 [备用真题] The Impact of Technology\n\nTechnological {{innovation}} has redefined how we {{interact}} with the world. From business to education, the {{integration}} of digital tools is now {{mandatory}}. However, some {{skeptics}} remain concerned about privacy.`,
      translation: `(当前显示为备用文章翻译)\n\n技术创新重新定义了我们与世界的互动方式。从商业到教育，数字工具的整合现在是强制性的。然而，一些怀疑论者仍然担心隐私问题。`,
      vocabList: [
        { word: "innovation", definition: "n. 创新" },
        { word: "interact", definition: "v. 互动，交流" },
        { word: "integration", definition: "n. 整合，集成" },
        { word: "mandatory", definition: "adj. 强制性的，义务的" },
        { word: "skeptics", definition: "n. 怀疑论者" }
      ],
      date: new Date().toISOString().split('T')[0]
    };
};

export const generateEnglishDaily = async (
    wordCount: number = 20, 
    book: string = 'kaoyan', 
    style: string = 'academic',
    excludeWords: string[] = []
): Promise<EnglishDailyContent> => {
  const bookNameMap: Record<string, string> = {
      'kaoyan': '考研英语大纲核心词汇',
      'cet4': '大学英语四级(CET-4)必备词汇',
      'cet6': '大学英语六级(CET-6)高频词汇',
      'ielts': '雅思(IELTS)学术类词汇'
  };
  
  const styleMap: Record<string, string> = {
      'academic': '学术议论文 (Academic Paper)',
      'news': '新闻报道 (News Report)',
      'science': '科普前沿 (Popular Science)',
      'literature': '文学名著 (Classic Literature)',
      'daily': '生活口语 (Daily Life)',
      'opinion': '观点评论 (Opinion Piece)',
      'biography': '人物传记 (Biography)',
      'travel': '地理游记 (Travelogue)',
      'economics': '经济学人 (Economics)',
      'technology': '硅谷科技 (Technology)'
  };

  const targetBook = bookNameMap[book] || '考研英语大纲';
  const targetStyle = styleMap[style] || '学术议论文';
  const excludeStr = excludeWords.slice(0, 50).join(', ');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `你是一个资深的英语教育专家。请生成一篇风格为【${targetStyle}】的英语阅读文章。
      要求：
      1. 使用约 ${wordCount} 个来自【${targetBook}】的重点词汇。
      2. 尽量避免使用这些已掌握单词：[${excludeStr}]。
      3. 在英语文章中，将选中的 ${wordCount} 个核心词汇用 {{单词}} 的格式标注，例如 {{innovation}}。
      4. 文章总长度约 200-300 词。
      5. 提供准确的中文翻译，且翻译风格要贴合【${targetStyle}】。
      6. 返回结果必须是严格的 JSON 格式。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            article: { type: Type.STRING, description: "包含{{word}}格式的英文文章" },
            translation: { type: Type.STRING, description: "对应的中文翻译" },
            vocabList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  definition: { type: Type.STRING }
                },
                required: ["word", "definition"]
              }
            }
          },
          required: ["article", "translation", "vocabList"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    return {
      ...parsedData,
      date: new Date().toISOString().split('T')[0]
    };
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    return getFallbackData("生成失败", error.message || "请稍后重试");
  }
};
