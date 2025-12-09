import { GoogleGenAI, Type } from "@google/genai";
import { EnglishDailyContent } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateEnglishDaily = async (): Promise<EnglishDailyContent> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
    你是一个专业的考研英语辅导老师。请按照以下要求生成今天的每日阅读素材：
    1. 从考研英语大纲词汇中随机抽取 30-50 个高频难词。
    2. 将这些单词编写成一篇逻辑通顺、短小精悍的英文短文（约 150-200 词），题材可以是科技、文化、教育或社会热点，风格贴近考研阅读真题。
    3. 提供该短文的中文全文翻译。
    4. 列出短文中用到的 10 个核心重点单词及其简明中文释义。

    请以 JSON 格式返回，不要包含 markdown 代码块标记。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            article: { type: Type.STRING, description: "The English article" },
            translation: { type: Type.STRING, description: "Chinese translation of the article" },
            vocabList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  definition: { type: Type.STRING }
                }
              }
            }
          },
          required: ["article", "translation", "vocabList"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        ...data,
        date: new Date().toISOString().split('T')[0]
      };
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback data in case of API failure or missing key
    return {
      article: "Gemini API key is missing or invalid. Please check your configuration. Here is a placeholder: Persistence is to the character of man as carbon is to steel.",
      translation: "API 调用失败。坚持之于人格，犹如碳之于钢铁。",
      vocabList: [{ word: "Persistence", definition: "坚持" }],
      date: new Date().toISOString().split('T')[0]
    };
  }
};