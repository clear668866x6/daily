
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

// 增加 style 参数 和 excludeWords 参数
export const generateEnglishDaily = async (
    wordCount: number = 30, 
    book: string = 'kaoyan', 
    style: string = 'academic',
    excludeWords: string[] = []
): Promise<EnglishDailyContent> => {
  if (!API_KEY) {
    return getFallbackData("未配置 API Key", "请在 .env 文件中配置 VITE_API_KEY (填入 DeepSeek API Key)。");
  }

  const API_URL = getApiUrl();
  
  const bookNameMap: Record<string, string> = {
      'kaoyan': '考研英语大纲',
      'cet4': '大学英语四级(CET-4)',
      'cet6': '大学英语六级(CET-6)',
      'ielts': '雅思(IELTS)'
  };
  
  const styleMap: Record<string, string> = {
      'academic': '学术议论文 (Academic/Argumentative) - 适合考研阅读Part A',
      'news': '新闻报道 (News/Journalism) - 经济学人风格',
      'narrative': '记叙文 (Narrative/Story) - 轻松易读',
      'philosophy': '哲理散文 (Philosophical Essay) - 深度思考',
      'science': '科技前沿 (Science/Tech) - 说明文风格',
      'literature': '经典文学 (Classic Literature) - 小说片段',
      'dialogue': '日常对话 (Dialogue) - 口语/听力场景'
  };

  const targetBook = bookNameMap[book] || '考研英语大纲';
  const targetStyle = styleMap[style] || '学术议论文';
  
  // 限制排除词的数量，防止 Prompt 过长
  const excludeStr = excludeWords.slice(0, 100).join(', ');

  const systemPrompt = `你是一个专业的英语辅导老师。请编写一篇英语阅读短文。
  
  要求：
  1. 题材与风格：请严格按照【${targetStyle}】风格编写。
  2. 词汇来源：从【${targetBook}】中随机抽取 ${wordCount} 个重点单词。
  3. **去重避让**：请尽量避免使用以下用户近期已背过的单词：[${excludeStr}]。如果必须使用，请不要将其作为本篇的核心生词。
  4. **重要：在文章正文中，必须将这 ${wordCount} 个重点生词用双大括号包裹，例如 {{ambiguous}}，以便前端识别高亮。**
  5. 单词释义：**必须提供该单词在本文语境下的确切含义，不要直接给通用字典释义。**
  6. 篇幅：150-250 词。
  7. 输出格式：必须是合法的 JSON 格式。

  JSON 结构示例：
  {
    "article": "This is an {{ambiguous}} situation...",
    "translation": "中文全文翻译...",
    "vocabList": [
      { "word": "ambiguous", "definition": "adj. (在本句中指) 模棱两可的，局势不明朗的" }
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
          { role: "user", content: `请生成一篇${targetStyle}风格的英语阅读，基于${targetBook}，包含 ${wordCount} 个重点词。` }
        ],
        response_format: { type: "json_object" }, 
        temperature: 1.3,
        max_tokens: 2500
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
    const backupArticle = `Over the past decade, thousands of {{patents}} have been granted for business methods. Amazon.com received one for its "one-click" online payment system. Merrill Lynch got legal protection for an {{asset allocation}} strategy. One inventor patented a technique for lifting a box.

Now the nation's top patent court appears ready to {{scale back}} on business-method patents, which have been {{controversial}} ever since they were first {{authorized}} 10 years ago.`;

    const backupTranslation = `在过去的十年中，成千上万的商业方法被授予了专利...`;

    return {
      article: `> **⚠️ ${errorTitle}**\n> ${errorDetail}\n\n---\n\n### 📖 [备用真题] Business Method Patents\n\n${backupArticle}`,
      translation: `(当前显示为备用文章翻译)\n\n${backupTranslation}`,
      vocabList: [
        { word: "patents", definition: "n. 专利 (本文指商业模式专利)" },
        { word: "controversial", definition: "adj. 有争议的 (指引起了法律界的争论)" },
        { word: "authorized", definition: "v. 批准，授权" },
        { word: "scale back", definition: "缩减，削减 (指法院打算减少专利发放)" },
        { word: "asset allocation", definition: "资产配置" }
      ],
      date: new Date().toISOString().split('T')[0]
    };
};
