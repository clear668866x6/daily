export enum SubjectCategory {
  MATH = '数学',
  ENGLISH = '英语',
  POLITICS = '政治',
  CS_DS = '408-数据结构',
  CS_CO = '408-计组',
  CS_OS = '408-操作系统',
  CS_CN = '408-计网',
  OTHER = '其他'
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  subject: SubjectCategory;
  content: string; // Markdown supported
  imageUrl?: string;
  timestamp: number;
  likes: number;
}

export interface EnglishDailyContent {
  article: string;
  translation: string;
  vocabList: Array<{ word: string; definition: string }>;
  date: string;
}

export interface DailyStats {
  date: string;
  count: number;
}

export interface SubjectStats {
  subject: string;
  count: number;
}