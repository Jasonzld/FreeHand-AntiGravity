/**
 * Quota Types
 * Type definitions for quota data
 */

/** Model quota information */
export interface ModelQuotaInfo {
    label: string;
    modelId: string;
    remainingFraction?: number;
    remainingPercentage?: number;
    isExhausted: boolean;
    resetTime: Date;
    resetTimeDisplay: string;
    timeUntilReset: number;
    timeUntilResetFormatted: string;
}

/** User information */
export interface UserInfo {
    name: string;
    email: string;
    planName: string;
    tier: string;
    monthlyPromptCredits: number;
    availablePromptCredits: number;
}

/** Quota snapshot */
export interface QuotaSnapshot {
    timestamp: Date;
    userInfo?: UserInfo;
    models: ModelQuotaInfo[];
    isConnected: boolean;
    errorMessage?: string;
}

/** Process info for Antigravity detection */
export interface ProcessInfo {
    pid: number;
    extensionPort: number;
    csrfToken: string;
}

/** Environment scan result */
export interface EnvironmentScanResult {
    extensionPort: number;
    connectPort: number;
    csrfToken: string;
}

/** Server API response types */
export interface QuotaInfo {
    remainingFraction?: number;
    resetTime: string;
}

export interface ClientModelConfig {
    label: string;
    modelOrAlias?: { model: string };
    quotaInfo?: QuotaInfo;
}

export interface PlanStatus {
    planInfo: {
        planName: string;
        monthlyPromptCredits: number;
        teamsTier: string;
    };
    availablePromptCredits: number;
}

export interface UserStatus {
    name: string;
    email: string;
    planStatus?: PlanStatus;
    cascadeModelConfigData?: {
        clientModelConfigs: ClientModelConfig[];
    };
}

export interface ServerUserStatusResponse {
    userStatus: UserStatus;
    message?: string;
    code?: string;
}
