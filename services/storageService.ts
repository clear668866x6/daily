import { supabase } from './supabase';
import { CheckIn, User } from "../types";

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
  // Session is still kept local for simplicity in this demo
  const stored = localStorage.getItem('kaoyan_current_user');
  if (stored) return JSON.parse(stored);
  return null;
};

export const loginUser = async (username: string): Promise<User> => {
  // 1. Check if user exists
  const { data: existingUsers } = await supabase
    .from('users')
    .select('*')
    .eq('name', username)
    .single();

  let user: User;

  if (existingUsers) {
    user = existingUsers as User;
  } else {
    // 2. Register new user
    const newUser: User = {
      id: crypto.randomUUID(), // Generate a unique ID
      name: username,
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${username}`
    };
    
    const { error } = await supabase.from('users').insert(newUser);
    if (error) throw error;
    user = newUser;
  }

  // Save session locally so refreshing the page keeps login
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
  // We need to convert the object to match database columns if they differ, 
  // but we designed the table to match the TS interface closely.
  // Note: 'likedBy' in TS is camelCase, DB column is liked_by. 
  // Supabase JS client handles basic mapping but let's be explicit if needed.
  // However, for simplicity, we created the table columns as 'liked_by', 
  // we might need to map it if we strictly followed snake_case in DB.
  // Let's assume the DB columns were created as 'likedBy' (double quoted in SQL) or map them here.
  // Actually, standard SQL is snake_case. Let's map it.
  
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
  // 1. Get current checkin to see likes
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

  // 2. Update
  const { error: updateError } = await supabase
    .from('checkins')
    .update({ liked_by: newLikedBy })
    .eq('id', checkInId);
    
  if (updateError) console.error('Error toggling like:', updateError);
};