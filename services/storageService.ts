
import { supabase } from './supabase';
import { CheckIn, User, AlgorithmTask, AlgorithmSubmission, Goal, RatingHistory, LeaveStatus, SubjectCategory } from "../types";

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

// --- Constants for Calculation ---
const SUBJECT_WEIGHTS: Record<string, number> = {
    [SubjectCategory.MATH]: 1.2,
    [SubjectCategory.CS_DS]: 1.2,
    [SubjectCategory.CS_CO]: 1.2,
    [SubjectCategory.CS_OS]: 1.2,
    [SubjectCategory.CS_CN]: 1.2,
    [SubjectCategory.ENGLISH]: 1.0,
    [SubjectCategory.POLITICS]: 0.8,
    [SubjectCategory.DAILY]: 0.8,
    [SubjectCategory.OTHER]: 0.8,
    [SubjectCategory.ALGORITHM]: 1.0, 
};

// Helper: Calculate Points (Replicating Logic from Dashboard.tsx)
const calculatePoints = (rating: number, duration: number, subject: string, isPenalty: boolean): number => {
    if (isPenalty) {
        let penaltyMultiplier = 1.5;
        if (rating > 1800) penaltyMultiplier = 2.0;
        return -Math.round((duration / 10) * penaltyMultiplier) - 1;
    } else {
        const basePoints = Math.floor(duration / 10);
        const multiplier = SUBJECT_WEIGHTS[subject] || 1.0;
        
        let tierMultiplier = 1.0;
        if (rating < 1200) tierMultiplier = 1.0;
        else if (rating < 1400) tierMultiplier = 0.8;
        else if (rating < 1600) tierMultiplier = 0.7;
        else if (rating < 1900) tierMultiplier = 0.6;
        else if (rating < 2500) tierMultiplier = 0.5;
        else if (rating < 3000) tierMultiplier = 0.4;
        else if (rating < 4000) tierMultiplier = 0.3;
        else tierMultiplier = 0.15; // 4000+

        return Math.ceil(basePoints * multiplier * tierMultiplier) + 1;
    }
};

// --- User Management ---
export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*').order('rating', { ascending: false });
  if (error) {
    console.error('Error fetching ALL users (Check RLS?):', error);
    return [];
  }
  return data.map((u: any) => ({
      ...u,
      dailyGoal: u.daily_goal,
      lastGoalEditDate: u.last_goal_edit_date // Map from DB snake_case
  })) as User[];
};

export const getUserById = async (id: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) return null;
    return { 
        ...data, 
        dailyGoal: data.daily_goal,
        lastGoalEditDate: data.last_goal_edit_date
    } as User;
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
    user = { 
        ...existingUsers, 
        dailyGoal: existingUsers.daily_goal,
        lastGoalEditDate: existingUsers.last_goal_edit_date 
    } as User;
    
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
    if (updates.lastGoalEditDate) {
        dbUpdates.last_goal_edit_date = updates.lastGoalEditDate;
        delete dbUpdates.lastGoalEditDate;
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

// --- System Config ---
export const getSystemConfig = () => {
    const startDate = localStorage.getItem('kaoyan_sys_start_date');
    return {
        absentStartDate: startDate || ''
    };
};

export const setSystemConfig = (key: string, value: string) => {
    if (key === 'absentStartDate') {
        localStorage.setItem('kaoyan_sys_start_date', value);
    }
};

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
    // 1. Get the record BEFORE deleting to know its timestamp position
    const { data: recordToDelete, error: fetchError } = await supabase
        .from('rating_history')
        .select('*')
        .eq('id', historyId)
        .single();
    
    if (fetchError || !recordToDelete) {
        console.error("Record not found or fetch error", fetchError);
        return;
    }

    // 2. Delete the specific record
    const { error } = await supabase.from('rating_history').delete().eq('id', historyId);
    if (error) throw error;

    // 3. Calculate updates if value changed
    if (refundAmount !== 0) {
        // A. Update Current User Rating (Head)
        const { data: user } = await supabase.from('users').select('rating').eq('id', userId).single();
        if (user) {
            const currentRating = user.rating || 1200;
            const newRating = currentRating + refundAmount;
            await supabase.from('users').update({ rating: newRating }).eq('id', userId);
        }

        // B. Update SUBSEQUENT History Records (Chain)
        // Find all records that happened AFTER the deleted record
        const { data: subsequentRecords } = await supabase
            .from('rating_history')
            .select('*')
            .eq('user_id', userId)
            .gt('recorded_at', recordToDelete.recorded_at) // Strictly after
            .order('recorded_at', { ascending: true });

        if (subsequentRecords && subsequentRecords.length > 0) {
            for (const record of subsequentRecords) {
                // Calculate new rating snapshot for this point in time
                const oldSnapshotRating = record.rating;
                const newSnapshotRating = oldSnapshotRating + refundAmount;

                let newReason = record.change_reason || '';

                // Attempt to fix the text description "R: 1200 -> 1210" or "R:1200->1210"
                const regex = /R:\s*(\d+)\s*->\s*(\d+)/;
                const match = newReason.match(regex);
                
                if (match) {
                    const oldPrev = parseInt(match[1]);
                    const oldCurr = parseInt(match[2]);
                    
                    const newPrev = oldPrev + refundAmount;
                    const newCurr = oldCurr + refundAmount;
                    
                    newReason = newReason.replace(match[0], `R:${newPrev}->${newCurr}`);
                }

                // Execute Update
                await supabase
                    .from('rating_history')
                    .update({ 
                        rating: newSnapshotRating,
                        change_reason: newReason 
                    })
                    .eq('id', record.id);
            }
        }
    }
}

export const recalculateUserRating = async (userId: string, adminUser: User): Promise<number> => {
    // Legacy simple sync (fallback)
    const { data: history } = await supabase
        .from('rating_history')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: true });

    let correctRating = 1200;
    if (history && history.length > 0) {
        correctRating = history[history.length - 1].rating;
    }

    await supabase.from('users').update({ rating: correctRating }).eq('id', userId);
    return correctRating;
}

// --- NEW FUNCTION: Recalculate Rating By Range (Replay Logic) ---
export const recalculateUserRatingByRange = async (
    userId: string, 
    startDate: string, 
    endDate: string, 
    adminUser: User,
    onProgress?: (current: number, total: number) => void,
    overrideBaseRating?: number
): Promise<number> => {
    const targetUser = await getUserById(userId);
    if (!targetUser) throw new Error("用户不存在");

    // 1. Determine Baseline Rating
    let runningRating = 1200;
    
    if (overrideBaseRating !== undefined) {
        runningRating = overrideBaseRating;
    } else {
        const { data: priorHistory } = await supabase
            .from('rating_history')
            .select('*')
            .eq('user_id', userId)
            .lt('recorded_at', startDate)
            .order('recorded_at', { ascending: false }) // Get closest previous record
            .limit(1);
        runningRating = priorHistory && priorHistory.length > 0 ? priorHistory[0].rating : 1200;
    }
    
    // 2. Fetch ALL records from StartDate to NOW (End of Time)
    // CRITICAL FIX: We must process ALL future records to maintain consistency.
    // The `endDate` param is technically used to define the "start of the replay", but we replay until now.
    const { data: rangeHistory } = await supabase
        .from('rating_history')
        .select('*')
        .eq('user_id', userId)
        .gte('recorded_at', startDate) 
        .order('recorded_at', { ascending: true });

    const { data: rangeCheckIns } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', new Date(startDate).getTime())
        .order('timestamp', { ascending: true });

    if (!rangeHistory || rangeHistory.length === 0) {
        // If no history in range, just update user to baseline (in case they were manually desynced)
        await supabase.from('users').update({ rating: runningRating }).eq('id', userId);
        return runningRating;
    }

    const totalRecords = rangeHistory.length;

    // 3. Replay Loop
    for (let i = 0; i < totalRecords; i++) {
        const record = rangeHistory[i];
        if (onProgress) onProgress(i + 1, totalRecords);

        let delta = 0;
        let reason = record.change_reason || '';
        
        // Try to match with a check-in
        const recordTime = new Date(record.recorded_at).getTime();
        const matchedCheckIn = rangeCheckIns?.find(c => Math.abs(c.timestamp - recordTime) < 5000);

        if (matchedCheckIn) {
            // It's a Check-In Log: Always RECALCULATE points based on the running rating
            // This ensures tiers (1200 vs 2000) are applied correctly based on the *new* timeline
            const prevRating = runningRating;
            
            const duration = matchedCheckIn.duration || 0;
            const subject = matchedCheckIn.subject;
            const isPenalty = matchedCheckIn.is_penalty;

            delta = calculatePoints(prevRating, duration, subject, isPenalty);
            
            // Reconstruct Reason string
            if (isPenalty) {
                reason = matchedCheckIn.content.split('\n')[0].replace(/\(R:.*\)/, '').trim(); 
                if (reason.includes('扣分')) {
                     // UPDATED: Include (R: A->B) in penalty string even during recalculation
                     reason = reason.replace(/扣分\s*-?\d+/, `扣分 ${Math.abs(delta)}`);
                     if (!reason.includes('(R:')) {
                         reason += ` (R:${prevRating}->${prevRating + delta})`;
                     } else {
                         reason = reason.replace(/R:\s*(\d+)\s*->\s*(\d+)/, `R:${prevRating}->${prevRating + delta}`);
                     }
                }
            } else {
                reason = `学习 ${subject} ${duration}m (R:${prevRating}->${prevRating + delta})`;
            }

            // Update CheckIn snapshot
            await supabase.from('checkins').update({ user_rating: prevRating + delta }).eq('id', matchedCheckIn.id);

        } else {
            // It's a Manual Adjustment / Bonus / System Penalty without check-in link
            // For these, we PRESERVE the original relative delta
            // Example: Admin added 50 points manually. We keep adding 50 points, regardless of base.
            
            // Find this record in the original fetched array to calculate its ORIGINAL delta
            // Note: `rangeHistory` contains the *old* values before we started updating
            // But we need the delta relative to the *old previous* value.
            
            const originalPrevRating = i > 0 ? rangeHistory[i - 1].rating : (rangeHistory[0].rating); // Fallback logic approximate
            const originalDelta = rangeHistory.length > 0 && i > 0 ? (rangeHistory[i].rating - rangeHistory[i-1].rating) : 0; 
            // Better logic: if this record had a delta in original history, preserve it.
            // But manually calculating delta from record stream is safer.
            // Let's assume the delta is preserved from description or previous calculation?
            // Actually, for manual adjustments, `record.rating` was the snapshot. 
            // We need to infer the intended delta.
            
            // Simplification: Try to extract delta from reason string if possible, otherwise rely on diff
            // If we can't infer, we assume 0 change to be safe, OR we calculate diff from previous record in the *old* array.
            const oldThisRating = record.rating;
            const oldPrevRating = i > 0 ? rangeHistory[i-1].rating : (overrideBaseRating !== undefined ? overrideBaseRating : 1200); // Approximate
            
            // Actually, we should just check if we can parse the delta from the reason string?
            // "Admin Manual Update" doesn't have delta in text usually.
            // Let's rely on array diff.
            delta = oldThisRating - oldPrevRating;

            // Update reason text if it contains "R: A->B" pattern
            const regex = /R:\s*(\d+)\s*->\s*(\d+)/;
            const match = reason.match(regex);
            if (match) {
                reason = reason.replace(match[0], `R:${runningRating}->${runningRating + delta}`);
            }
        }

        // Apply Delta
        runningRating += delta;

        // Update DB Record
        await supabase
            .from('rating_history')
            .update({ 
                rating: runningRating,
                change_reason: reason
            })
            .eq('id', record.id);
    }

    // 4. Final User Update (Head)
    // CRITICAL: This ensures the user's current displayed rating matches the end of the replay chain.
    await supabase.from('users').update({ rating: runningRating }).eq('id', userId);

    // 5. Post Announcement
    const announcementCheckIn: CheckIn = {
        id: `sys-recalc-${Date.now()}`,
        userId: adminUser.id,
        userName: adminUser.name,
        userAvatar: adminUser.avatar,
        userRating: adminUser.rating,
        userRole: 'admin',
        subject: SubjectCategory.OTHER,
        content: `🔧 **系统操作公示**\n\n管理员对用户 **${targetUser.name}** 执行了积分全量校准。\n\n📅 **重算起点**: ${startDate}\n📊 **修正后 Rating**: \`${runningRating}\``,
        duration: 0,
        isAnnouncement: true,
        timestamp: Date.now(),
        likedBy: []
    };
    await addCheckIn(announcementCheckIn);

    return runningRating;
}

// --- NEW: Global Recalculate ---
export const recalculateAllUsersRating = async (
    startDate: string,
    endDate: string,
    adminUser: User,
    baseRating: number | undefined,
    onGlobalProgress: (current: number, total: number, currentUser: string) => void
) => {
     const users = await getAllUsers();
     const targetUsers = users.filter(u => u.role !== 'admin'); // Skip admins usually
     
     let count = 0;
     for (const user of targetUsers) {
         await recalculateUserRatingByRange(user.id, startDate, endDate, adminUser, undefined, baseRating);
         count++;
         onGlobalProgress(count, targetUsers.length, user.name);
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

// Special function for Admin Dashboard to find penalties
export const getAllPenalties = async (): Promise<CheckIn[]> => {
    const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('is_penalty', true)
        .order('timestamp', { ascending: false });
    
    if (error) return [];
    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.user_name,
      userAvatar: item.user_avatar,
      subject: item.subject,
      content: item.content,
      isPenalty: true,
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
    // Updated logic to parse the random penalty from the text content if possible
    // Example content: "⚠️ **[系统] 缺勤惩罚 (2025-01-01)** ... 扣分 52"
    const content = checkIn.content;
    const penaltyMatch = content.match(/扣分\s*-?(\d+)/);
    
    if (penaltyMatch) {
        ratingDelta = parseInt(penaltyMatch[1]);
    } else {
        // Fallback to old fixed values if not found in text
        if (checkIn.content.includes('缺勤') || checkIn.content.includes('偿还失败')) {
            ratingDelta = 50; 
        } else if (checkIn.content.includes('时长不足')) {
            ratingDelta = 15;
        } else {
            ratingDelta = 15; 
        }
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
