
import { EnglishDailyContent } from "../types";

// Helper to safely get environment variables
const getApiKey = () => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env.VITE_DEEPSEEK_API_KEY || import.meta.env.VITE_API_KEY;
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_DEEPSEEK_API_KEY || process.env.API_KEY;
  }
  return '';
};

const API_KEY = getApiKey();
// DeepSeek 官方 API 地址
const API_URL = "https://api.deepseek.com/chat/completions";

export const generateEnglishDaily = async (): Promise<EnglishDailyContent> => {
  if (!API_KEY) {
    return getFallbackData("未配置 API Key", "请在 .env 文件中配置 VITE_API_KEY (填入 DeepSeek API Key)。");
  }

  // DeepSeek 提示词：强制要求 JSON 格式
  const systemPrompt = `你是一个专业的考研英语辅导老师。请编写一篇考研英语阅读短文。
  
  要求：
  1. 题材：科技、文化、教育或社会热点，风格贴近考研真题（The Economist/Time 风格）。
  2. 词汇：从考研英语大纲中随机抽取 30-50 个高频难词。
  3. 篇幅：150-200 词。
  4. 输出格式：必须是合法的 JSON 格式。

  JSON 结构示例：
  {
    "article": "英语文章全文...",
    "translation": "中文全文翻译...",
    "vocabList": [
      { "word": "单词1", "definition": "中文释义" },
      { "word": "单词2", "definition": "中文释义" }
    ]
  }`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 使用 DeepSeek-V3 模型
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "请生成今天的考研英语阅读练习内容，包含新颖的题材。" }
        ],
        response_format: { type: "json_object" }, // 强制 JSON 模式
        temperature: 1.2, // 稍微提高创造性
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `DeepSeek API Error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // 清理可能存在的 Markdown 代码块标记（虽然 json_object 模式通常很干净）
    const cleanContent = content.replace(/```json\n?|```/g, '').trim();
    
    let parsedData;
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse Error", cleanContent);
        throw new Error("DeepSeek 返回格式解析失败");
    }

    return {
      ...parsedData,
      date: new Date().toISOString().split('T')[0]
    };

  } catch (error: any) {
    console.error("AI Service Error:", error);
    
    const msg = error.message || "未知错误";

    // DeepSeek 常见错误处理
    if (msg.includes("402") || msg.includes("Insufficient Balance") || msg.includes("Payment Required")) {
       return getFallbackData("余额不足 (402)", "DeepSeek API 账户余额不足，请前往 DeepSeek 开放平台充值。");
    }
    
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return getFallbackData("API Key 无效", "密钥无效，请检查 .env 配置。");
    }

    if (msg.includes("429") || msg.includes("Rate limit")) {
        return getFallbackData("系统繁忙 (429)", "DeepSeek 服务器繁忙，请稍后再试。系统为您显示备用真题。");
    }
    
    if (msg.includes("Failed to fetch")) {
      return getFallbackData("网络连接失败", "无法连接到 DeepSeek 服务器，请检查网络设置。");
    }

    return getFallbackData("AI 服务暂时不可用", `错误详情: ${msg.substring(0, 100)}...`);
  }
};

// 提供高质量的备用数据
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
