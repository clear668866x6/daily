
import React from 'react';
import { SubjectCategory, AlgorithmSubmission, AlgorithmTask } from './types';
import { Zap, Star, Flame, Trophy, Moon, Sparkles, Megaphone, Calculator, BookOpen, ScrollText, LayoutGrid, Cpu, HardDrive, Network, Code2, Coffee, Layers, Clock, Calendar, RefreshCcw } from 'lucide-react';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    condition: (submissions: AlgorithmSubmission[], tasks: AlgorithmTask[], checkIns?: any[]) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    // Algorithm Achievements
    {
        id: 'first_blood',
        title: '初出茅庐',
        description: '成功通过第 1 道算法题',
        icon: Zap,
        color: 'text-yellow-600 bg-yellow-100',
        condition: (s) => s.filter(x => x.status === 'Passed').length >= 1
    },
    {
        id: 'three_streak',
        title: '持之以恒',
        description: '累计 AC 题目达到 3 道',
        icon: Star,
        color: 'text-blue-600 bg-blue-100',
        condition: (s) => new Set(s.filter(x => x.status === 'Passed').map(x => x.taskId)).size >= 3
    },
    {
        id: 'five_kills',
        title: '渐入佳境',
        description: '累计 AC 题目达到 5 道',
        icon: Flame,
        color: 'text-orange-600 bg-orange-100',
        condition: (s) => new Set(s.filter(x => x.status === 'Passed').map(x => x.taskId)).size >= 5
    },
    {
        id: 'master',
        title: '算法大师',
        description: '累计 AC 题目达到 20 道',
        icon: Trophy,
        color: 'text-purple-600 bg-purple-100',
        condition: (s) => new Set(s.filter(x => x.status === 'Passed').map(x => x.taskId)).size >= 20
    },
    {
        id: 'night_owl',
        title: '夜战考研人',
        description: '在深夜 (23:00 - 04:00) 提交并通过代码',
        icon: Moon,
        color: 'text-indigo-600 bg-indigo-100',
        condition: (s) => false 
    },
    
    // Study Habit Achievements (New)
    {
        id: 'streak_7',
        title: '一周全勤',
        description: '连续打卡达到 7 天',
        icon: Calendar,
        color: 'text-green-600 bg-green-100',
        condition: (s, t, checkIns) => {
            // Logic handled in App.tsx mainly, simplified check here if possible or just rely on manual trigger
            return false; 
        }
    },
    {
        id: 'volume_100h',
        title: '百炼成钢',
        description: '累计学习时长超过 100 小时',
        icon: Clock,
        color: 'text-pink-600 bg-pink-100',
        condition: (s, t, checkIns) => {
            if(!checkIns) return false;
            const totalMin = checkIns.reduce((acc, c) => acc + (c.isPenalty ? 0 : (c.duration || 0)), 0);
            return totalMin >= 6000;
        }
    },
    {
        id: 'polymath',
        title: '博学家',
        description: '单日学习超过 3 个不同科目',
        icon: Layers,
        color: 'text-cyan-600 bg-cyan-100',
        condition: (s, t, checkIns) => {
            if(!checkIns) return false;
            const dateMap: Record<string, Set<string>> = {};
            checkIns.forEach(c => {
                if(c.isPenalty) return;
                const d = new Date(c.timestamp).toDateString();
                if(!dateMap[d]) dateMap[d] = new Set();
                dateMap[d].add(c.subject);
            });
            return Object.values(dateMap).some(set => set.size >= 3);
        }
    },
    {
        id: 'comeback_kid',
        title: '绝地反击',
        description: '在请假后的一天内完成双倍学习任务 (180分钟)',
        icon: RefreshCcw,
        color: 'text-red-600 bg-red-100',
        condition: (s, t, checkIns) => {
            if (!checkIns) return false;
            // Logic implies checking history for a leave followed by >180min day
            for (let i = 1; i < checkIns.length; i++) {
                const prev = checkIns[i];
                const curr = checkIns[i-1]; // Assuming sorted desc
                if (prev.isLeave && !curr.isLeave && (curr.duration || 0) >= 180) {
                    return true;
                }
            }
            return false;
        }
    }
];

export const FILTER_GROUPS = [
    { id: 'ALL', label: '全部', icon: Sparkles, color: 'text-brand-500' },
    { id: 'ANNOUNCEMENT', label: '公告', icon: Megaphone, color: 'text-red-500' },
    { id: 'MATH', label: '数学', icon: Calculator, subjects: [SubjectCategory.MATH], color: 'text-blue-500' },
    { id: 'ENGLISH', label: '英语', icon: BookOpen, subjects: [SubjectCategory.ENGLISH], color: 'text-violet-500' },
    { id: 'POLITICS', label: '政治', icon: ScrollText, subjects: [SubjectCategory.POLITICS], color: 'text-rose-500' },
    { id: 'CS_DS', label: 'DS', icon: LayoutGrid, subjects: [SubjectCategory.CS_DS], color: 'text-emerald-500' },
    { id: 'CS_CO', label: 'CO', icon: Cpu, subjects: [SubjectCategory.CS_CO], color: 'text-emerald-600' },
    { id: 'CS_OS', label: 'OS', icon: HardDrive, subjects: [SubjectCategory.CS_OS], color: 'text-emerald-700' },
    { id: 'CS_CN', label: 'CN', icon: Network, subjects: [SubjectCategory.CS_CN], color: 'text-emerald-800' },
    { id: 'ALGORITHM', label: '算法', icon: Code2, subjects: [SubjectCategory.ALGORITHM], color: 'text-amber-500' },
    { id: 'DAILY', label: '日常', icon: Coffee, subjects: [SubjectCategory.DAILY], color: 'text-slate-500' },
];
