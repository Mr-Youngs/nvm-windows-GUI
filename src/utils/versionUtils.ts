/**
 * Version String Utilities
 * 集中处理版本号字符串的格式化和比较
 */

/**
 * 移除版本号前的 'v' 前缀
 * @example cleanVersion('v18.20.0') => '18.20.0'
 * @example cleanVersion('18.20.0') => '18.20.0'
 */
export const cleanVersion = (version: string): string => {
    return version.startsWith('v') ? version.substring(1) : version;
};

/**
 * 确保版本号有 'v' 前缀
 * @example ensureVPrefix('18.20.0') => 'v18.20.0'
 * @example ensureVPrefix('v18.20.0') => 'v18.20.0'
 */
export const ensureVPrefix = (version: string): string => {
    return version.startsWith('v') ? version : `v${version}`;
};

/**
 * 获取版本号的主版本号
 * @example getMajorVersion('v18.20.0') => 18
 * @example getMajorVersion('20.11.0') => 20
 */
export const getMajorVersion = (version: string): number => {
    const clean = cleanVersion(version);
    const major = parseInt(clean.split('.')[0], 10);
    return isNaN(major) ? 0 : major;
};

/**
 * 解析版本号为数字数组
 * @example parseVersion('v18.20.5') => [18, 20, 5]
 */
export const parseVersion = (version: string): number[] => {
    const clean = cleanVersion(version);
    return clean.split('.').map(s => parseInt(s, 10) || 0);
};

/**
 * 比较两个版本号
 * @returns 负数表示 a < b, 正数表示 a > b, 0 表示相等
 */
export const compareVersions = (a: string, b: string): number => {
    const partsA = parseVersion(a);
    const partsB = parseVersion(b);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA !== numB) {
            return numB - numA; // 降序排列
        }
    }
    return 0;
};

/**
 * 按版本号降序排序
 */
export const sortVersionsDesc = <T extends { version: string }>(versions: T[]): T[] => {
    return [...versions].sort((a, b) => compareVersions(a.version, b.version));
};
