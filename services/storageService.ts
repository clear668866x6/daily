
import { supabase } from './supabase';
import { CheckIn, User, AlgorithmTask, AlgorithmSubmission } from "../types";

// --- Helper to get Env Vars safe for Vite/Netlify ---
const getEnv = (key: string, fallback: string) => {
  // 1. Try Vite import.meta.env
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // 2. Try Node process.env
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

// --- Admin & Security Configuration ---
// 优先读取 VITE_ 前缀的环境变量（适配 Netlify/Vite）
const ADMIN_USERNAME = getEnv('VITE_ADMIN_USER', getEnv('ADMIN_USER', 'admin'));
const ADMIN_PASSWORD = getEnv('VITE_ADMIN_PASSWORD', getEnv('ADMIN_PASSWORD', 'admin123'));
const INVITE_CODE = getEnv('VITE_INVITE_CODE', getEnv('INVITE_CODE', 'ky2025')); 

// --- User Management ---

export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data as User[];
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem('kaoyan_current_user');
  if (stored) return JSON.parse(stored);
  return null;
};

export const loginGuest = (): User => {
  const guestUser: User = {
    id: 'guest-' + Date.now(),
    name: '访客',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Guest',
    role: 'guest'
  };
  localStorage.setItem('kaoyan_current_user', JSON.stringify(guestUser));
  return guestUser;
};

export const loginUser = async (username: string, password?: string, inviteCode?: string): Promise<User> => {
  // 1. 管理员登录判定 (基于环境变量，不查数据库)
  if (username === ADMIN_USERNAME) {
    if (password === ADMIN_PASSWORD) {
      const adminUser: User = {
        id: 'admin-001',
        name: '管理员',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Admin',
        role: 'admin'
      };
      localStorage.setItem('kaoyan_current_user', JSON.stringify(adminUser));
      return adminUser;
    } else {
      throw new Error("管理员密码错误");
    }
  }

  // 2. 普通用户查询
  const { data: existingUsers } = await supabase
    .from('users')
    .select('*')
    .eq('name', username)
    .single();

  let user: User;

  if (existingUsers) {
    // --- 登录逻辑 ---
    user = existingUsers as User;
    
    // 兼容旧数据：如果数据库里有密码字段，必须验证；如果没有，允许免密进入（或者你可以强制要求重置）
    if (user.password && password) {
      if (user.password !== password) {
        throw new Error("密码错误");
      }
    } else if (user.password && !password) {
        throw new Error("该账号已设置密码，请输入密码");
    }
    // 登录成功
  } else {
    // --- 注册逻辑 ---
    
    // 核心修改：校验邀请码
    if (inviteCode !== INVITE_CODE) {
      throw new Error(`邀请码错误，请联系管理员获取。`);
    }

    if (!password) {
      throw new Error("注册新账号请设置密码");
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name: username,
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${username}`,
      role: 'user',
      password: password 
    };
    
    // 写入 Supabase
    const { error } = await supabase.from('users').insert({
      id: newUser.id,
      name: newUser.name,
      avatar: newUser.avatar,
      role: newUser.role,
      password: newUser.password
    });
    
    if (error) {
      console.error("Register Error", error);
      throw new Error("注册失败，用户名可能已存在或数据库连接异常");
    }
    user = newUser;
  }

  localStorage.setItem('kaoyan_current_user', JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem('kaoyan_current_user');
};

// --- Check-in Data Management ---

export const getCheckIns = async (): Promise<CheckIn[]> => {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .order('timestamp', { ascending: false }); // Newest first
    
  if (error) {
    console.error('Error fetching checkins:', error);
    return [];
  }
  return data as CheckIn[];
};

export const addCheckIn = async (checkIn: CheckIn): Promise<void> => {
  const dbPayload = {
    id: checkIn.id,
    user_id: checkIn.userId,
    user_name: checkIn.userName,
    user_avatar: checkIn.userAvatar,
    subject: checkIn.subject,
    content: checkIn.content,
    image_url: checkIn.imageUrl,
    timestamp: checkIn.timestamp,
    liked_by: checkIn.likedBy
  };

  const { error } = await supabase.from('checkins').insert(dbPayload);
  if (error) {
    console.error('Error adding checkin:', error);
    throw error;
  }
};

export const toggleLike = async (checkInId: string, userId: string): Promise<void> => {
  const { data: currentCheckIn, error: fetchError } = await supabase
    .from('checkins')
    .select('liked_by')
    .eq('id', checkInId)
    .single();

  if (fetchError || !currentCheckIn) return;

  const likedBy = (currentCheckIn.liked_by as string[]) || [];
  const isLiked = likedBy.includes(userId);
  
  let newLikedBy;
  if (isLiked) {
    newLikedBy = likedBy.filter(id => id !== userId);
  } else {
    newLikedBy = [...likedBy, userId];
  }

  const { error: updateError } = await supabase
    .from('checkins')
    .update({ liked_by: newLikedBy })
    .eq('id', checkInId);
    
  if (updateError) console.error('Error toggling like:', updateError);
};

// --- Mock Algorithm Storage (Local Storage Simulation for Demo) ---
// 算法题目的发布和做题记录暂时存在 LocalStorage，这不影响“打卡动态”存入数据库
// 如果你想把题目本身也存数据库，需要额外建 algorithm_tasks 表

export const getAlgorithmTasks = (): AlgorithmTask[] => {
  const stored = localStorage.getItem('kaoyan_algo_tasks');
  return stored ? JSON.parse(stored) : [];
};

export const addAlgorithmTask = (task: AlgorithmTask) => {
  const tasks = getAlgorithmTasks();
  tasks.push(task);
  localStorage.setItem('kaoyan_algo_tasks', JSON.stringify(tasks));
};

export const getAlgorithmSubmissions = (userId: string): AlgorithmSubmission[] => {
  const stored = localStorage.getItem('kaoyan_algo_subs');
  const all: AlgorithmSubmission[] = stored ? JSON.parse(stored) : [];
  return all.filter(s => s.userId === userId);
};

export const submitAlgorithmCode = (submission: AlgorithmSubmission) => {
  const stored = localStorage.getItem('kaoyan_algo_subs');
  const all: AlgorithmSubmission[] = stored ? JSON.parse(stored) : [];
  // Remove old submission for same task/user
  const filtered = all.filter(s => !(s.userId === submission.userId && s.taskId === submission.taskId));
  filtered.push(submission);
  localStorage.setItem('kaoyan_algo_subs', JSON.stringify(filtered));
};
