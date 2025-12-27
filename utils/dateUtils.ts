
/**
 * 考研人专属业务日期逻辑：
 * 凌晨 4:00 之前属于前一天。
 * 例如：6月2日 02:00 -> 6月1日
 */
export const getBusinessDate = (timestamp: number): string => {
    // 减去 4 小时的偏移量
    const date = new Date(timestamp - 4 * 60 * 60 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getPreviousBusinessDate = (timestamp: number): string => {
    // 减去 24 + 4 小时的偏移量
    const date = new Date(timestamp - 28 * 60 * 60 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const isSameBusinessDay = (ts1: number, ts2: number): boolean => {
    return getBusinessDate(ts1) === getBusinessDate(ts2);
};
