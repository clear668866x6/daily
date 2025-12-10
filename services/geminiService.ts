
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
    return getFallbackData("未配置 API Key", "请在 .env 文件中配置 VITE_API_KEY (使用 Google Gemini API Key)。");
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
    
    // 错误信息处理
    // 有些 error 是对象，需要 stringify 才能看到细节，或者直接读取 message
    const msg = error.message || JSON.stringify(error) || "未知错误";

    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
       return getFallbackData(
         "⚠️ API 调用次数超限 (429)",
         "Google Gemini 免费版有调用频率限制（每分钟约 15 次）。AI 暂时累了，系统为您自动展示一篇【精选真题】作为替代，请稍后重试。"
       );
    }
    
    if (msg.includes("403") || msg.includes("API key not valid")) {
      return getFallbackData("API Key 无效", "密钥无效或未在 Google AI Studio 启用，请检查配置。");
    } 
    
    if (msg.includes("Failed to fetch")) {
      return getFallbackData("网络连接失败", "无法连接到 Google 服务器，请检查网络设置 (国内环境通常需要代理)。");
    }

    return getFallbackData("AI 服务暂时不可用", `错误详情: ${msg.substring(0, 100)}...`);
  }
};

// 提供高质量的备用数据，确保在 API 挂掉时用户依然可用
const getFallbackData = (errorTitle: string, errorDetail: string): EnglishDailyContent => {
    // 备用文章：考研英语真题选段 (2010 Text 2)
    const backupArticle = `Over the past decade, thousands of patents have been granted for business methods. Amazon.com received one for its "one-click" online payment system. Merrill Lynch got legal protection for an asset allocation strategy. One inventor patented a technique for lifting a box.

Now the nation's top patent court appears ready to scale back on business-method patents, which have been controversial ever since they were first authorized 10 years ago. In a move that has intellectual-property lawyers abuzz, the U.S. Court of Appeals for the Federal Circuit said it would use a particular case to conduct a broad review of business-method patents.`;

    const backupTranslation = `在过去的十年中，成千上万的商业方法被授予了专利。亚马逊公司的“一键”在线支付系统获得了专利。美林证券的一项资产配置策略获得了法律保护。一位发明者为提升箱子的技术申请了专利。

现在，国家最高专利法院似乎准备缩减商业方法专利，自从10年前首次授权以来，这些专利一直备受争议。在一个让知识产权律师议论纷纷的举动中，美国联邦巡回上诉法院表示，它将利用一个特定案件对商业方法专利进行广泛审查。`;

    return {
      article: `> **${errorTitle}**\n> ${errorDetail}\n\n---\n\n### 📖 [备用精选] Business Method Patents\n\n${backupArticle}`,
      translation: `(当前显示为备用文章翻译)\n\n${backupTranslation}`,
      vocabList: [
        { word: "patent", definition: "n. 专利；v. 获得专利" },
        { word: "controversial", definition: "adj. 有争议的" },
        { word: "authorize", definition: "v. 批准，授权" },
        { word: "scale back", definition: "缩减，削减" },
        { word: "asset allocation", definition: "资产配置" },
        { word: "intellectual-property", definition: "知识产权" }
      ],
      date: new Date().toISOString().split('T')[0]
    };
};
