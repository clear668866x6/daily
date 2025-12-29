
export enum SubjectCategory {
  MATH = '数学',
  ENGLISH = '英语',
  POLITICS = '政治',
  CS_DS = '408-数据结构',
  CS_CO = '408-计组',
  CS_OS = '408-操作系统',
  CS_CN = '408-计网',
  ALGORITHM = '算法训练',
  DAILY = '日常',
  OTHER = '其他'
}

export type UserRole = 'user' | 'admin' | 'guest';

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  password?: string;
  rating?: number; 
}

export interface CheckIn {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRating?: number;
  userRole?: UserRole;
  subject: SubjectCategory;
  content: string; 
  imageUrl?: string;
  duration?: number; // 学习时长(分钟)
  isPenalty?: boolean; // 是否为惩罚/摸鱼记录
  isAnnouncement?: boolean; // 新增：是否为置顶公告
  timestamp: number;
  likedBy: string[]; 
}

export interface Goal {
  id: number;
  user_id: string;
  // 新增用户信息字段
  user_name?: string;
  user_avatar?: string;
  user_rating?: number;
  title: string;
  is_completed: boolean;
  created_at?: string;
}

export interface RatingHistory {
  id: number;
  user_id: string;
  rating: number;
  change_reason?: string;
  recorded_at: string;
}

export interface EnglishDailyContent {
  article: string;
  translation: string;
  vocabList: Array<{ word: string; definition: string }>;
  date: string;
}

export interface AlgorithmTask {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  date: string;
  assignedTo?: string[]; // Array of User IDs. If present, only these users are penalized for missing it.
}

export interface AlgorithmSubmission {
  id?: string; // Database ID (string to handle bigint/uuid)
  taskId: string;
  userId: string;
  userName?: string; 
  userAvatar?: string;
  code: string;
  language: string; 
  status: 'Passed' | 'Failed';
  timestamp: number;
  duration?: number; // Minutes spent solving
}

export interface DailyStats {
  date: string;
  count: number;
}

// --- Helper for Codeforces Style Rating Colors ---
export const getUserStyle = (role: UserRole, rating: number = 0) => {
  if (role === 'admin') {
    return "font-black text-black"; 
  }
  
  if (rating < 1200) return "text-gray-500 font-medium"; // Newbie (Gray)
  if (rating < 1400) return "text-green-600 font-medium"; // Pupil (Green)
  if (rating < 1600) return "text-cyan-600 font-medium"; // Specialist (Cyan)
  if (rating < 1900) return "text-blue-600 font-medium"; // Expert (Blue)
  if (rating < 2100) return "text-violet-600 font-bold"; // Candidate Master (Violet)
  if (rating < 2400) return "text-orange-500 font-bold"; // Master (Orange)
  return "text-red-600 font-bold"; // Grandmaster (Red)
};

export const getTitleName = (role: UserRole, rating: number = 0) => {
  if (role === 'admin') return "Admin";
  if (rating < 1200) return "Newbie";
  if (rating < 1400) return "Pupil";
  if (rating < 1600) return "Specialist";
  if (rating < 1900) return "Expert";
  if (rating < 2100) return "Candidate Master";
  if (rating < 2400) return "Master";
  return "Grandmaster";
}