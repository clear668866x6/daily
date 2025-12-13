
import { supabase } from './supabase';
import { CheckIn, User, AlgorithmTask, AlgorithmSubmission, Goal, RatingHistory } from "../types";

const getEnv = (key: string, fallback: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

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
    role: 'guest',
    rating: 1200 
  };
  localStorage.setItem('kaoyan_current_user', JSON.stringify(guestUser));
  return guestUser;
};

export const loginUser = async (username: string, password?: string, inviteCode?: string): Promise<User> => {
  if (username === ADMIN_USERNAME) {
    if (password === ADMIN_PASSWORD) {
      const adminUser: User = {
        id: 'admin-001',
        name: '管理员',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Admin',
        role: 'admin',
        rating: 3000
      };
      localStorage.setItem('kaoyan_current_user', JSON.stringify(adminUser));
      return adminUser;
    } else {
      throw new Error("管理员密码错误");
    }
  }

  const { data: existingUsers } = await supabase.from('users').select('*').eq('name', username).single();
  let user: User;

  if (existingUsers) {
    user = existingUsers as User;
    if (user.password && password) {
      if (user.password !== password) throw new Error("密码错误");
    } else if (user.password && !password) {
        throw new Error("该账号已设置密码，请输入密码");
    }
  } else {
    if (inviteCode !== INVITE_CODE) throw new Error(`邀请码错误，请联系管理员获取。`);
    if (!password) throw new Error("注册新账号请设置密码");

    const initialRating = Math.floor(Math.random() * 200) + 1100;
    const newUser: User = {
      id: crypto.randomUUID(),
      name: username,
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${username}`,
      role: 'user',
      password: password,
      rating: initialRating
    };
    
    const { error } = await supabase.from('users').insert({
      id: newUser.id,
      name: newUser.name,
      avatar: newUser.avatar,
      role: newUser.role,
      password: newUser.password,
      rating: newUser.rating 
    });
    
    if (error) {
      console.error("Register Error", error);
      throw new Error("注册失败，用户名可能已存在或数据库连接异常");
    }
    user = newUser;
  }
  
  // Login 成功时，记录一次初始 Rating 历史（如果还没有的话）
  await recordRatingHistory(user.id, user.rating || 1200, "Initial Login");

  localStorage.setItem('kaoyan_current_user', JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem('kaoyan_current_user');
};

export const updateUserLocal = (user: User) => {
    localStorage.setItem('kaoyan_current_user', JSON.stringify(user));
}

// --- Rating Logic ---
export const updateRating = async (userId: string, newRating: number, reason: string) => {
    // 1. Update User Table
    await supabase.from('users').update({ rating: newRating }).eq('id', userId);
    // 2. Add History Record
    await recordRatingHistory(userId, newRating, reason);
}

export const recordRatingHistory = async (userId: string, rating: number, reason: string) => {
    await supabase.from('rating_history').insert({
        user_id: userId,
        rating: rating,
        change_reason: reason
    });
}

export const getRatingHistory = async (userId: string): Promise<RatingHistory[]> => {
    const { data } = await supabase
        .from('rating_history')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: true });
    return (data as RatingHistory[]) || [];
}

// --- Check-in & Goals ---

export const getCheckIns = async (): Promise<CheckIn[]> => {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .order('timestamp', { ascending: false }); 
    
  if (error) {
      console.error("Fetch Checkins Error:", error);
      return [];
  }
  
  // 映射数据库字段到前端类型，并处理 NULL 值情况
  return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.user_name || '未知研友', // 默认值
      userAvatar: item.user_avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=Unknown', // 默认值
      userRating: item.user_rating || 1200, // 默认值
      userRole: item.user_role || 'user', // 默认值
      subject: item.subject,
      content: item.content,
      imageUrl: item.image_url,
      duration: item.duration || 0,
      isPenalty: item.is_penalty || false,
      isAnnouncement: item.is_announcement || false, // 确保读取布尔值
      timestamp: Number(item.timestamp), // 确保转为数字
      likedBy: item.liked_by || []
  })) as CheckIn[];
};

export const addCheckIn = async (checkIn: CheckIn): Promise<void> => {
  // 1. 优先使用完整 Payload，包含 user_rating 和 is_announcement
  const fullPayload = {
    id: checkIn.id,
    user_id: checkIn.userId,
    user_name: checkIn.userName,
    user_avatar: checkIn.userAvatar,
    user_rating: checkIn.userRating, 
    user_role: checkIn.userRole, 
    subject: checkIn.subject,
    content: checkIn.content,
    image_url: checkIn.imageUrl || null,
    duration: checkIn.duration || 0, 
    is_penalty: checkIn.isPenalty || false, 
    is_announcement: checkIn.isAnnouncement || false, 
    timestamp: checkIn.timestamp,
    liked_by: checkIn.likedBy || []
  };

  const { error } = await supabase.from('checkins').insert(fullPayload);
  
  if (error) {
    console.warn("初次提交失败，尝试降级提交...", error);
    
    // 降级策略：如果某些字段不存在（例如用户未运行最新 SQL），尝试写入基础字段
    // 这样能保证至少数据能显示出来，不丢失
    const safePayload = {
        id: checkIn.id,
        user_id: checkIn.userId,
        user_name: checkIn.userName,
        user_avatar: checkIn.userAvatar,
        subject: checkIn.subject,
        content: checkIn.content,
        timestamp: checkIn.timestamp,
        image_url: checkIn.imageUrl || null,
        liked_by: []
    }
    const { error: safeError } = await supabase.from('checkins').insert(safePayload);
    if (safeError) throw safeError; // 如果降级也失败，抛出异常
  }
};

export const toggleLike = async (checkInId: string, userId: string): Promise<void> => {
  const { data: currentCheckIn, error: fetchError } = await supabase.from('checkins').select('liked_by').eq('id', checkInId).single();
  if (fetchError || !currentCheckIn) return;

  const likedBy = (currentCheckIn.liked_by as string[]) || [];
  const isLiked = likedBy.includes(userId);
  const newLikedBy = isLiked ? likedBy.filter(id => id !== userId) : [...likedBy, userId];

  await supabase.from('checkins').update({ liked_by: newLikedBy }).eq('id', checkInId);
};

// --- Goals Management ---

export const getAllPublicGoals = async (): Promise<Goal[]> => {
    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // 只显示最近的50条
    
    if (error) return [];
    return data as Goal[];
}

export const getUserGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (error) return [];
  return data as Goal[];
};

export const addGoal = async (user: User, title: string): Promise<Goal | null> => {
  const payload: any = { 
    user_id: user.id, 
    title: title,
    user_name: user.name, 
    user_avatar: user.avatar,
    user_rating: user.rating
  };

  const { data, error } = await supabase
    .from('goals')
    .insert(payload)
    .select()
    .single();
    
  if (error) {
      // 简单的重试
      const safePayload = {
          user_id: user.id,
          title: title
      };
      const { data: safeData, error: safeError } = await supabase.from('goals').insert(safePayload).select().single();
      if (!safeError) return safeData as Goal;
      
      console.error("Add Goal Error", error);
      return null;
  }
  return data as Goal;
};

export const toggleGoal = async (goalId: number, isCompleted: boolean): Promise<void> => {
  await supabase.from('goals').update({ is_completed: isCompleted }).eq('id', goalId);
};

export const deleteGoal = async (goalId: number): Promise<void> => {
  await supabase.from('goals').delete().eq('id', goalId);
};

// --- Algorithm ---
export const getAlgorithmTasks = async (): Promise<AlgorithmTask[]> => {
  const { data, error } = await supabase.from('algorithm_tasks').select('*').order('date', { ascending: false });
  if (error) return [];
  return data as AlgorithmTask[];
};

export const addAlgorithmTask = async (task: AlgorithmTask): Promise<void> => {
  const { error } = await supabase.from('algorithm_tasks').insert({
    id: task.id,
    title: task.title,
    description: task.description,
    difficulty: task.difficulty,
    date: task.date
  });
  if (error) throw error;
};

export const getAlgorithmSubmissions = (userId: string): AlgorithmSubmission[] => {
  const stored = localStorage.getItem('kaoyan_algo_subs');
  const all: AlgorithmSubmission[] = stored ? JSON.parse(stored) : [];
  return all.filter(s => s.userId === userId);
};

export const submitAlgorithmCode = (submission: AlgorithmSubmission) => {
  const stored = localStorage.getItem('kaoyan_algo_subs');
  const all: AlgorithmSubmission[] = stored ? JSON.parse(stored) : [];
  const filtered = all.filter(s => !(s.userId === submission.userId && s.taskId === submission.taskId));
  filtered.push(submission);
  localStorage.setItem('kaoyan_algo_subs', JSON.stringify(filtered));
};
