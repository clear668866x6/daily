
import { EnglishDailyContent } from "../types";

// Helper to safely get environment variables (compatible with Vite and Node)
const getApiKey = () => {
  // 1. 尝试读取 VITE_ 开头的变量 (Vite 标准)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    // @ts-ignore
    if (import.meta.env.VITE_DEEPSEEK_API_KEY) return import.meta.env.VITE_DEEPSEEK_API_KEY;
    // @ts-ignore
    if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
  }

  // 2. 尝试读取 process.env (Node/System 环境)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
    if (process.env.VITE_DEEPSEEK_API_KEY) return process.env.VITE_DEEPSEEK_API_KEY;
    if (process.env.API_KEY) return process.env.API_KEY;
  }
  
  return '';
};

const API_KEY = getApiKey();
const API_URL = "https://api.deepseek.com/chat/completions";

export const generateEnglishDaily = async (): Promise<EnglishDailyContent> => {
  if (!API_KEY) {
    return getFallbackData("未检测到 API Key。请确保环境变量名为 VITE_API_KEY，并已正确配置。");
  }

  const prompt = `
    你是一个专业的考研英语辅导老师。请按照以下要求生成今天的每日阅读素材：
    1. 从考研英语大纲词汇中随机抽取 30-50 个高频难词。
    2. 将这些单词编写成一篇逻辑通顺、短小精悍的英文短文（约 150-200 词），题材可以是科技、文化、教育或社会热点，风格贴近考研阅读真题。
    3. 提供该短文的中文全文翻译。
    4. 列出短文中用到的 10 个核心重点单词及其简明中文释义。

    请务必只返回纯 JSON 格式字符串，不要包含 markdown 标记（如 \`\`\`json），格式如下：
    {
      "article": "英文文章内容...",
      "translation": "中文翻译...",
      "vocabList": [
        {"word": "单词1", "definition": "释义1"},
        {"word": "单词2", "definition": "释义2"}
      ]
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 使用 DeepSeek V3 模型
        messages: [
          { role: "system", content: "你是一个输出 JSON 格式数据的助手。" },
          { role: "user", content: prompt }
        ],
        temperature: 1.3, // 稍微高一点的温度让生成内容更多样
        stream: false,
        response_format: { type: "json_object" } // 强制 JSON 模式
      })
    });

    if (!response.ok) {
      // 增加详细的错误日志
      const errText = await response.text();
      console.error("DeepSeek API Error Detail:", errText);
      throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const contentStr = data.choices?.[0]?.message?.content;

    if (contentStr) {
      try {
        const parsedData = JSON.parse(contentStr);
        return {
          ...parsedData,
          date: new Date().toISOString().split('T')[0]
        };
      } catch (jsonError) {
        console.error("JSON Parse Error:", contentStr);
        throw new Error("DeepSeek 返回的格式不是有效的 JSON");
      }
    }
    throw new Error("No content returned from DeepSeek");

  } catch (error: any) {
    console.error("AI Service Error:", error);
    return getFallbackData(`API 调用失败: ${error.message}`);
  }
};

const getFallbackData = (errorMsg: string): EnglishDailyContent => ({
  article: `System Message: ${errorMsg} \n\nHere is a static placeholder: Persistence is to the character of man as carbon is to steel.`,
  translation: `系统提示：${errorMsg} \n\n这是预设内容：坚持之于人格，犹如碳之于钢铁。`,
  vocabList: [{ word: "Persistence", definition: "坚持" }],
  date: new Date().toISOString().split('T')[0]
});
