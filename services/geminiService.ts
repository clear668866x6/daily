
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

const getApiUrl = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal) {
        console.log("Environment: Local (Using Vite Proxy)");
        return "/api/deepseek/chat/completions";
    } else {
        console.log("Environment: Production (Using Public CORS Proxy)");
        const target = "https://api.deepseek.com/chat/completions";
        return `https://corsproxy.io/?${encodeURIComponent(target)}`;
    }
}

// 增加 wordCount 参数
export const generateEnglishDaily = async (wordCount: number = 30): Promise<EnglishDailyContent> => {
  if (!API_KEY) {
    return getFallbackData("未配置 API Key", "请在 .env 文件中配置 VITE_API_KEY (填入 DeepSeek API Key)。");
  }

  const API_URL = getApiUrl();
  console.log("Calling API URL:", API_URL);

  const systemPrompt = `你是一个专业的考研英语辅导老师。请编写一篇考研英语阅读短文。
  
  要求：
  1. 题材：科技、文化、教育或社会热点，风格贴近考研真题。
  2. 词汇：从考研英语大纲中随机抽取 ${wordCount} 个重点单词。
  3. **重要：在文章正文中，必须将这 ${wordCount} 个重点单词用双大括号包裹，例如 {{ambiguous}}，以便前端识别高亮。**
  4. 篇幅：150-200 词。
  5. 输出格式：必须是合法的 JSON 格式。

  JSON 结构示例：
  {
    "article": "This is an {{ambiguous}} situation...",
    "translation": "中文全文翻译...",
    "vocabList": [
      { "word": "ambiguous", "definition": "adj. 模棱两可的" }
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
        model: "deepseek-chat", 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请生成今天的考研英语阅读练习内容，包含 ${wordCount} 个新词。` }
        ],
        response_format: { type: "json_object" }, 
        temperature: 1.2,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
        throw new Error("API 返回结构异常");
    }

    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json\n?|```/g, '').trim();
    
    let parsedData;
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (e) {
        throw new Error("AI 返回格式解析失败");
    }

    return {
      ...parsedData,
      date: new Date().toISOString().split('T')[0]
    };

  } catch (error: any) {
    console.error("AI Service Error:", error);
    return getFallbackData("AI 生成失败", error.message || "未知错误");
  }
};

const getFallbackData = (errorTitle: string, errorDetail: string): EnglishDailyContent => {
    // 备用数据也模拟一下高亮格式
    const backupArticle = `Over the past decade, thousands of {{patents}} have been granted for business methods. Amazon.com received one for its "one-click" online payment system. Merrill Lynch got legal protection for an {{asset allocation}} strategy. One inventor patented a technique for lifting a box.

Now the nation's top patent court appears ready to {{scale back}} on business-method patents, which have been {{controversial}} ever since they were first {{authorized}} 10 years ago.`;

    const backupTranslation = `在过去的十年中，成千上万的商业方法被授予了专利...`;

    return {
      article: `> **⚠️ ${errorTitle}**\n> ${errorDetail}\n\n---\n\n### 📖 [备用真题] Business Method Patents\n\n${backupArticle}`,
      translation: `(当前显示为备用文章翻译)\n\n${backupTranslation}`,
      vocabList: [
        { word: "patents", definition: "n. 专利" },
        { word: "controversial", definition: "adj. 有争议的" },
        { word: "authorized", definition: "v. 批准，授权" },
        { word: "scale back", definition: "缩减，削减" },
        { word: "asset allocation", definition: "资产配置" }
      ],
      date: new Date().toISOString().split('T')[0]
    };
};
