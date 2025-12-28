
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
  const { data, error } = await supabase.from('users').select('*').order('rating', { ascending: false });
  if (error) {
    console.error('Error fetching ALL users (Check RLS?):', error);
    return [];
  }
  return data as User[];
};

export const getUserById = async (id: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) return null;
    return data as User;
}

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

  const { data: existingUsers, error: selectError } = await supabase.from('users').select('*').eq('name', username).single();
  
  if (selectError && selectError.code !== 'PGRST116') {
      console.error("Login Select Error:", selectError);
      throw new Error("Database connection error or permission denied.");
  }

  let user: User;

  if (existingUsers) {
    user = existingUsers as User;
    if (user.password && password) {
      if (user.password !== password) throw new Error("密码错误");
    } else if (user.password && !password) {
        throw new Error("该账号已设置密码，请输入密码");
    }
  } else {
    // Registration Logic
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
      console.error("Register Error:", error);
      throw new Error(`注册失败: ${error.message} (Is RLS disabled?)`);
    }
    user = newUser;
  }
  
  await recordRatingHistory(user.id, user.rating ?? 1200, "Initial Login / Sync");

  localStorage.setItem('kaoyan_current_user', JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem('kaoyan_current_user');
};

export const updateUserLocal = (user: User) => {
    localStorage.setItem('kaoyan_current_user', JSON.stringify(user));
}

// --- Admin User Functions ---
export const adminUpdateUser = async (userId: string, updates: Partial<User>): Promise<void> => {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) throw error;

    if (updates.rating !== undefined) {
        await recordRatingHistory(userId, updates.rating, "Admin Manual Update");
    }
};

export const adminCreateUser = async (username: string, password?: string, initialRating: number = 1200): Promise<void> => {
    const { data: existing } = await supabase.from('users').select('id').eq('name', username).single();
    if (existing) throw new Error("用户名已存在");

    const newUser: User = {
        id: crypto.randomUUID(),
        name: username,
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${username}`,
        role: 'user',
        password: password,
        rating: initialRating
    };

    const { error } = await supabase.from('users').insert(newUser);
    if (error) throw error;
    
    await recordRatingHistory(newUser.id, initialRating, "Admin Created User");
}

export const adminDeleteUser = async (userId: string): Promise<void> => {
    await supabase.from('checkins').delete().eq('user_id', userId);
    await supabase.from('rating_history').delete().eq('user_id', userId);
    await supabase.from('goals').delete().eq('user_id', userId);
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
}

// --- Rating Logic (Updated) ---
export const updateRating = async (userId: string, newRating: number, reason: string) => {
    await supabase.from('users').update({ rating: newRating }).eq('id', userId);
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
        .order('recorded_at', { ascending: false });
    return (data as RatingHistory[]) || [];
}

// NEW: Delete a rating history record and refund the user's rating if needed
export const deleteRatingHistoryRecord = async (historyId: number, userId: string, refundAmount: number): Promise<void> => {
    // 1. Delete the record
    const { error } = await supabase.from('rating_history').delete().eq('id', historyId);
    if (error) throw error;

    // 2. Refund/Adjust the user's current rating
    // refundAmount should be positive if we are reverting a penalty (e.g. was -50, so refund +50)
    // or negative if reverting a bonus.
    if (refundAmount !== 0) {
        const { data: user } = await supabase.from('users').select('rating').eq('id', userId).single();
        if (user) {
            const currentRating = user.rating || 1200;
            const newRating = currentRating + refundAmount;
            
            await supabase.from('users').update({ rating: newRating }).eq('id', userId);
            
            // Log the refund implicitly or explicitly? 
            // The prompt asks to modify/delete. If we just update the user rating, it might look like magic.
            // Let's NOT insert a new history record to keep it clean (as if the penalty never happened), 
            // OR we insert a system log. 
            // Current decision: Just update the User table rating.
        }
    }
}

// NEW: Update a rating history record (e.g. reason)
export const updateRatingHistoryRecord = async (historyId: number, updates: Partial<RatingHistory>): Promise<void> => {
    const { error } = await supabase.from('rating_history').update(updates).eq('id', historyId);
    if (error) throw error;
}

// --- Check-in & Goals ---

export const getCheckIns = async (): Promise<CheckIn[]> => {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .order('timestamp', { ascending: false }); 
    
  if (error) return [];
  
  return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.user_name || '未知研友', 
      userAvatar: item.user_avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=Unknown',
      userRating: item.user_rating ?? 1200, 
      userRole: item.user_role || 'user', 
      subject: item.subject,
      content: item.content,
      imageUrl: item.image_url,
      duration: item.duration || 0,
      isPenalty: item.is_penalty || false,
      isAnnouncement: item.is_announcement || false, 
      timestamp: Number(item.timestamp), 
      likedBy: item.liked_by || []
  })) as CheckIn[];
};

export const getUserCheckIns = async (userId: string): Promise<CheckIn[]> => {
    const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });
    
    if (error) return [];
    
     return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.user_name,
      userAvatar: item.user_avatar,
      userRating: item.user_rating,
      userRole: item.user_role,
      subject: item.subject,
      content: item.content,
      imageUrl: item.image_url,
      duration: item.duration,
      isPenalty: item.is_penalty,
      isAnnouncement: item.is_announcement,
      timestamp: Number(item.timestamp),
      likedBy: item.liked_by || []
  })) as CheckIn[];
}

export const addCheckIn = async (checkIn: CheckIn): Promise<void> => {
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
    await supabase.from('checkins').insert(safePayload);
  }
};

export const updateCheckIn = async (checkInId: string, content: string): Promise<void> => {
    const { error } = await supabase.from('checkins').update({ content }).eq('id', checkInId);
    if (error) throw error;
};

export const deleteCheckIn = async (checkInId: string): Promise<number> => {
    const { data: checkIn, error: fetchError } = await supabase.from('checkins').select('*').eq('id', checkInId).single();
    if (fetchError || !checkIn) throw new Error("Check-in not found");

    const { error: deleteError } = await supabase.from('checkins').delete().eq('id', checkInId);
    if (deleteError) throw deleteError;

    let ratingDelta = 0;
    const duration = checkIn.duration || 0;

    if (checkIn.is_penalty) {
        ratingDelta = Math.round((duration / 10) * 1.5) + 1;
    } else if (duration > 0) {
        ratingDelta = -(Math.floor(duration / 10) + 1);
    }

    if (ratingDelta !== 0) {
        const { data: userData } = await supabase.from('users').select('rating').eq('id', checkIn.user_id).single();
        if (userData) {
            const currentRating = userData.rating ?? 1200;
            const newRating = currentRating + ratingDelta;
            
            await updateRating(
                checkIn.user_id, 
                newRating, 
                `撤销打卡 (ID: ${checkInId.substring(0,6)}...)`
            );
        }
    }

    return ratingDelta;
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
        .limit(50);
    
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
      const safePayload = {
          user_id: user.id,
          title: title
      };
      const { data: safeData, error: safeError } = await supabase.from('goals').insert(safePayload).select().single();
      if (!safeError) return safeData as Goal;
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
  
  return data.map((item: any) => ({
      ...item,
      assignedTo: item.assigned_to || [] // Map snake_case to camelCase
  })) as AlgorithmTask[];
};

export const addAlgorithmTask = async (task: AlgorithmTask): Promise<void> => {
  const { error } = await supabase.from('algorithm_tasks').insert({
    id: task.id,
    title: task.title,
    description: task.description,
    difficulty: task.difficulty,
    date: task.date,
    assigned_to: task.assignedTo || null // Map camelCase to snake_case
  });
  if (error) throw error;
};

// NEW: Delete Algorithm Task
export const deleteAlgorithmTask = async (taskId: string): Promise<void> => {
    const { error } = await supabase.from('algorithm_tasks').delete().eq('id', taskId);
    if (error) throw error;
}

// NEW: Update Algorithm Task
export const updateAlgorithmTask = async (taskId: string, updates: Partial<AlgorithmTask>): Promise<void> => {
    const payload: any = { ...updates };
    if (updates.assignedTo) {
        payload.assigned_to = updates.assignedTo;
        delete payload.assignedTo;
    }
    const { error } = await supabase.from('algorithm_tasks').update(payload).eq('id', taskId);
    if (error) throw error;
}

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
