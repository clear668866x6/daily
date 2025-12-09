import { CheckIn, SubjectCategory, User } from "../types";

const STORAGE_KEY_CHECKINS = 'kaoyan_checkins';
const STORAGE_KEY_USER = 'kaoyan_current_user';

// Mock Data for "Multi-user" simulation
const MOCK_USERS: User[] = [
  { id: 'u2', name: '上岸学姐', avatar: 'https://picsum.photos/seed/u2/100/100' },
  { id: 'u3', name: '408战神', avatar: 'https://picsum.photos/seed/u3/100/100' },
  { id: 'u4', name: '数学满分', avatar: 'https://picsum.photos/seed/u4/100/100' },
];

const INITIAL_CHECKINS: CheckIn[] = [
  {
    id: 'c1',
    userId: 'u2',
    userName: '上岸学姐',
    userAvatar: 'https://picsum.photos/seed/u2/100/100',
    subject: SubjectCategory.ENGLISH,
    content: '今天背了Unit 5的单词，感觉长难句还是有点难，大家加油！\n\n> Success is not final, failure is not fatal.',
    timestamp: Date.now() - 3600000 * 2,
    likes: 12
  },
  {
    id: 'c2',
    userId: 'u3',
    userName: '408战神',
    userAvatar: 'https://picsum.photos/seed/u3/100/100',
    subject: SubjectCategory.CS_DS,
    content: '红黑树的旋转终于搞懂了，画了好多图。\n\n关键点：\n1. 节点是红色或黑色。\n2. 根节点是黑色。',
    imageUrl: 'https://picsum.photos/seed/tree/400/300',
    timestamp: Date.now() - 3600000 * 5,
    likes: 24
  },
  {
    id: 'c3',
    userId: 'u4',
    userName: '数学满分',
    userAvatar: 'https://picsum.photos/seed/u4/100/100',
    subject: SubjectCategory.MATH,
    content: '泰勒公式展开到第三项就够用了，不要展开太多浪费时间。',
    timestamp: Date.now() - 3600000 * 12,
    likes: 8
  }
];

export const getCurrentUser = (): User => {
  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (stored) return JSON.parse(stored);
  
  const newUser: User = {
    id: 'u1',
    name: '我 (备考中)',
    avatar: 'https://picsum.photos/seed/me/100/100'
  };
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  return newUser;
};

export const getCheckIns = (): CheckIn[] => {
  const stored = localStorage.getItem(STORAGE_KEY_CHECKINS);
  if (stored) {
    return JSON.parse(stored);
  }
  // Initialize with mock data if empty
  localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(INITIAL_CHECKINS));
  return INITIAL_CHECKINS;
};

export const addCheckIn = (checkIn: CheckIn): CheckIn[] => {
  const current = getCheckIns();
  const updated = [checkIn, ...current];
  localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(updated));
  return updated;
};

export const toggleLike = (checkInId: string): CheckIn[] => {
  const current = getCheckIns();
  const updated = current.map(c => {
    if (c.id === checkInId) {
      return { ...c, likes: c.likes + 1 };
    }
    return c;
  });
  localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(updated));
  return updated;
};