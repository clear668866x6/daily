
import { supabase } from './supabase';
import { CheckIn, User, AlgorithmTask, AlgorithmSubmission, Goal, RatingHistory, LeaveStatus } from "../types";

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
  return data.map((u: any) => ({
      ...u,
      dailyGoal: u.daily_goal
  })) as User[];
};

export const getUserById = async (id: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) return null;
    return { ...data, dailyGoal: data.daily_goal } as User;
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
    user = { ...existingUsers, dailyGoal: existingUsers.daily_goal } as User;
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
      rating: initialRating,
      dailyGoal: 90
    };
    
    const { error } = await supabase.from('users').insert({
      id: newUser.id,
      name: newUser.name,
      avatar: newUser.avatar,
      role: newUser.role,
      password: newUser.password,
      rating: newUser.rating,
      daily_goal: newUser.dailyGoal
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
    const dbUpdates: any = { ...updates };
    if (updates.dailyGoal) {
        dbUpdates.daily_goal = updates.dailyGoal;
        delete dbUpdates.dailyGoal;
    }
    
    const { error } = await supabase.from('users').update(dbUpdates).eq('id', userId);
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
        rating: initialRating,
        dailyGoal: 90
    };

    const { error } = await supabase.from('users').insert({
        ...newUser,
        daily_goal: 90
    });
    if (error) throw error;
    
    await recordRatingHistory(newUser.id, initialRating, "Admin Created User");
}

export const adminDeleteUser = async (userId: string): Promise<void> => {
    await supabase.from('checkins').delete().eq('user_id', userId);
    await supabase.from('rating_history').delete().eq('user_id', userId);
    await supabase.from('goals').delete().eq('user_id', userId);
    await supabase.from('algorithm_submissions').delete().eq('user_id', userId);
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

export const deleteRatingHistoryRecord = async (historyId: number, userId: string, refundAmount: number): Promise<void> => {
    const { error } = await supabase.from('rating_history').delete().eq('id', historyId);
    if (error) throw error;

    if (refundAmount !== 0) {
        const { data: user } = await supabase.from('users').select('rating').eq('id', userId).single();
        if (user) {
            const currentRating = user.rating || 1200;
            const newRating = currentRating + refundAmount;
            await supabase.from('users').update({ rating: newRating }).eq('id', userId);
        }
    }
}

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
      
      isLeave: item.is_leave || false,
      leaveDays: item.leave_days || 0,
      leaveReason: item.leave_reason || '',
      leaveStatus: item.leave_status || 'approved',
      makeupMinutes: item.makeup_minutes || 0,

      wordCount: item.word_count || 0,
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

      isLeave: item.is_leave || false,
      leaveDays: item.leave_days || 0,
      leaveReason: item.leave_reason || '',
      leaveStatus: item.leave_status || 'approved',
      makeupMinutes: item.makeup_minutes || 0,

      wordCount: item.word_count || 0,
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
    
    is_leave: checkIn.isLeave || false,
    leave_days: checkIn.leaveDays || 0,
    leave_reason: checkIn.leaveReason || '',
    leave_status: checkIn.leaveStatus || 'approved',
    makeup_minutes: checkIn.makeupMinutes || 0,

    word_count: checkIn.wordCount || 0,
    is_announcement: checkIn.isAnnouncement || false, 
    timestamp: checkIn.timestamp,
    liked_by: checkIn.likedBy || []
  };

  const { error } = await supabase.from('checkins').insert(fullPayload);
  
  if (error) {
    console.error("Supabase Insert Error:", error);
    throw error;
  }
};

export const updateLeaveStatus = async (checkInId: string, status: LeaveStatus, makeupMinutes: number) => {
    const { error } = await supabase.from('checkins').update({
        leave_status: status,
        makeup_minutes: makeupMinutes
    }).eq('id', checkInId);
    if (error) throw error;
}

export const deleteCheckIn = async (id: string, skipRatingReversal: boolean = false): Promise<number> => {
    // Get checkin first to know impact
    const { data: checkIn } = await supabase.from('checkins').select('*').eq('id', id).single();
    if (!checkIn) return 0;
    
    let ratingDelta = 0;
    
    // Only calculate rating impact if NOT skipping reversal (e.g. non-admin delete)
    if (!skipRatingReversal) {
        if (checkIn.is_penalty) {
            if (checkIn.content.includes('缺勤') || checkIn.content.includes('偿还失败')) {
                ratingDelta = 50; // Restore 50 points
            } else if (checkIn.content.includes('时长不足')) {
                ratingDelta = 15; // Restore 15 points
            } else if (checkIn.duration) {
                ratingDelta = Math.round((checkIn.duration / 10) * 1.5) + 1; 
            }
        } else {
            // Was study (+points), undoing means (-points)
            if (checkIn.duration) {
                 ratingDelta = -(Math.floor(checkIn.duration / 10) + 1);
            }
        }
    }

    const { error } = await supabase.from('checkins').delete().eq('id', id);
    if (error) throw error;
    
    if (ratingDelta !== 0) {
        const { data: user } = await supabase.from('users').select('rating').eq('id', checkIn.user_id).single();
        if (user) {
             const newRating = (user.rating || 1200) + ratingDelta;
             await updateRating(checkIn.user_id, newRating, `撤销打卡/惩罚 (ID:${id.substring(0,4)})`);
        }
    }

    return ratingDelta;
}

export const exemptPenalty = async (id: string): Promise<{ ratingDelta: number, newContent: string }> => {
    const { data: checkIn } = await supabase.from('checkins').select('*').eq('id', id).single();
    if (!checkIn || !checkIn.is_penalty) {
        throw new Error("Target is not a penalty record");
    }

    let ratingDelta = 0;
    // Calculate refund amount based on content heuristics (same as deleteCheckIn)
    if (checkIn.content.includes('缺勤') || checkIn.content.includes('偿还失败')) {
        ratingDelta = 50; 
    } else if (checkIn.content.includes('时长不足')) {
        ratingDelta = 15;
    } else {
        ratingDelta = 15; // Default safe fallback
    }

    // Instead of deleting, we update the content and remove penalty flag
    const originalContent = checkIn.content.replace(/(\n|^)⚠️/g, '').replace(/(\n|^)\[系统\]/g, '').trim();
    const newContent = `~~${originalContent}~~ \n\n> 🛡️ **[管理员已豁免]** 扣分已返还，记录已归档。`;
    
    const { error } = await supabase.from('checkins').update({
        is_penalty: false,
        content: newContent
    }).eq('id', id);

    if (error) throw error;

    if (ratingDelta !== 0) {
        const { data: user } = await supabase.from('users').select('rating').eq('id', checkIn.user_id).single();
        if (user) {
             const newRating = (user.rating || 1200) + ratingDelta;
             await updateRating(checkIn.user_id, newRating, `管理员豁免惩罚 (ID:${id.substring(0,4)})`);
        }
    }
    
    return { ratingDelta, newContent };
}

export const updateCheckIn = async (id: string, content: string): Promise<void> => {
    const { error } = await supabase.from('checkins').update({ content }).eq('id', id);
    if (error) throw error;
}

export const toggleLike = async (checkInId: string, userId: string): Promise<void> => {
    const { data } = await supabase.from('checkins').select('liked_by').eq('id', checkInId).single();
    if (data) {
        let likes: string[] = data.liked_by || [];
        if (likes.includes(userId)) {
            likes = likes.filter(id => id !== userId);
        } else {
            likes.push(userId);
        }
        await supabase.from('checkins').update({ liked_by: likes }).eq('id', checkInId);
    }
}

// --- Goals ---
export const getUserGoals = async (userId: string): Promise<Goal[]> => {
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return [];
    return data as Goal[];
}

export const addGoal = async (user: User, title: string): Promise<Goal | null> => {
    const { data, error } = await supabase.from('goals').insert({
        user_id: user.id,
        user_name: user.name,
        user_avatar: user.avatar,
        user_rating: user.rating,
        title,
        is_completed: false
    }).select().single();
    
    if (error) return null;
    return data as Goal;
}

export const toggleGoal = async (id: number, status: boolean): Promise<void> => {
    await supabase.from('goals').update({ is_completed: status }).eq('id', id);
}

export const deleteGoal = async (id: number): Promise<void> => {
    await supabase.from('goals').delete().eq('id', id);
}

// --- Algorithm Tasks (Database backed) ---

export const getAlgorithmTasks = async (): Promise<AlgorithmTask[]> => {
    const { data, error } = await supabase.from('algorithm_tasks').select('*');
    if (error) return [];
    return data.map((t:any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        difficulty: t.difficulty,
        date: t.date,
        assignedTo: t.assigned_to
    }));
};

export const addAlgorithmTask = async (task: AlgorithmTask) => {
    const { error } = await supabase.from('algorithm_tasks').insert({
        id: task.id,
        title: task.title,
        description: task.description,
        difficulty: task.difficulty,
        date: task.date,
        assigned_to: task.assignedTo
    });
    if (error) throw error;
};

export const updateAlgorithmTask = async (id: string, updates: Partial<AlgorithmTask>) => {
    const payload: any = { ...updates };
    if (updates.assignedTo) {
        payload.assigned_to = updates.assignedTo;
        delete payload.assignedTo;
    }
    const { error } = await supabase.from('algorithm_tasks').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteAlgorithmTask = async (id: string) => {
    await supabase.from('algorithm_submissions').delete().eq('task_id', id);
    const { error } = await supabase.from('algorithm_tasks').delete().eq('id', id);
    if (error) throw error;
};

// --- Algorithm Submissions (Database backed) ---

export const getAllAlgorithmSubmissions = async (): Promise<AlgorithmSubmission[]> => {
    const { data, error } = await supabase
        .from('algorithm_submissions')
        .select('*')
        .order('timestamp', { ascending: false });
        
    if (error) return [];
    
    return data.map((s: any) => ({
        id: s.id.toString(),
        taskId: s.task_id,
        userId: s.user_id,
        userName: s.user_name,
        userAvatar: s.user_avatar,
        code: s.code,
        language: s.language,
        status: s.status,
        timestamp: Number(s.timestamp),
        duration: s.duration
    }));
};

export const getAlgorithmSubmissions = async (userId: string): Promise<AlgorithmSubmission[]> => {
    const { data, error } = await supabase
        .from('algorithm_submissions')
        .select('*')
        .eq('user_id', userId);
        
    if (error) return [];
    
    return data.map((s: any) => ({
        id: s.id.toString(),
        taskId: s.task_id,
        userId: s.user_id,
        userName: s.user_name,
        userAvatar: s.user_avatar,
        code: s.code,
        language: s.language,
        status: s.status,
        timestamp: Number(s.timestamp),
        duration: s.duration
    }));
};

export const submitAlgorithmCode = async (submission: AlgorithmSubmission) => {
    const { error } = await supabase.from('algorithm_submissions').insert({
        task_id: submission.taskId,
        user_id: submission.userId,
        user_name: submission.userName,
        user_avatar: submission.userAvatar,
        code: submission.code,
        language: submission.language,
        status: submission.status,
        timestamp: submission.timestamp,
        duration: submission.duration
    });
    if (error) throw error;
};

export const deleteAlgorithmSubmission = async (id: string) => {
    const { error } = await supabase.from('algorithm_submissions').delete().eq('id', id);
    if (error) throw error;
};
