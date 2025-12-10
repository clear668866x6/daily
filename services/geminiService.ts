
import { GoogleGenAI, Type } from "@google/genai";
import { EnglishDailyContent } from "../types";

// Helper to safely get environment variables
const getApiKey = () => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_API_KEY || process.env.API_KEY;
  }
  return '';
};

const API_KEY = getApiKey();

// 定义期望的 JSON 输出结构 (Schema)
// Gemini 2.5 Flash 支持原生结构化输出
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    article: {
      type: Type.STRING,
      description: "一篇逻辑通顺、短小精悍的考研英语阅读短文（约 150-200 词）。",
    },
    translation: {
      type: Type.STRING,
      description: "短文的中文全文翻译。",
    },
    vocabList: {
      type: Type.ARRAY,
      description: "短文中用到的 10 个核心重点单词及其释义。",
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "英文单词" },
          definition: { type: Type.STRING, description: "简明中文释义" },
        },
        required: ["word", "definition"],
      },
    },
  },
  required: ["article", "translation", "vocabList"],
};

export const generateEnglishDaily = async (): Promise<EnglishDailyContent> => {
  if (!API_KEY) {
    return getFallbackData("请在 .env 文件中配置 VITE_API_KEY (使用 Google Gemini API Key)。");
  }

  try {
    // 初始化 Google GenAI SDK
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // 使用 gemini-2.5-flash 模型，它是目前性价比最高且速度最快的模型
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        你是一个专业的考研英语辅导老师。
        请从考研英语大纲词汇中随机抽取 30-50 个高频难词，编写一篇题材（科技、文化、教育或社会热点）贴近考研真题的短文。
        输出必须严格符合 JSON Schema 定义。
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 1, // 增加创造性
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini 返回内容为空");

    const parsedData = JSON.parse(text);

    return {
      ...parsedData,
      date: new Date().toISOString().split('T')[0]
    };

  } catch (error: any) {
    console.error("Gemini SDK Error:", error);
    
    // 友好的错误提示
    let msg = error.message || "未知错误";
    if (msg.includes("403") || msg.includes("API key not valid")) {
      msg = "API Key 无效或未启用。请检查 Google AI Studio 控制台。";
    } else if (msg.includes("Failed to fetch")) {
      msg = "网络连接失败。请检查是否需要魔法上网访问 Google API。";
    }

    return getFallbackData(`Gemini 调用失败: ${msg}`);
  }
};

const getFallbackData = (errorMsg: string): EnglishDailyContent => ({
  article: `🔴 系统提示：\n${errorMsg}\n\n----------------\n[Static Placeholder] Persistence is to the character of man as carbon is to steel.`,
  translation: `🔴 发生错误，请查看上方英文提示。\n\n这是预设内容：坚持之于人格，犹如碳之于钢铁。`,
  vocabList: [{ word: "Error", definition: "错误" }, { word: "CheckConsole", definition: "请查看控制台日志" }],
  date: new Date().toISOString().split('T')[0]
});
