/**
 * Constants
 * Shared constants across the extension
 */

export const EXTENSION_ID = 'freehand-antigravity';
export const EXTENSION_NAME = 'FreeHand AntiGravity';

// CDP Constants
export const CDP_DEFAULT_PORT = 9222;
export const CDP_POLL_INTERVAL_MS = 1000;

// Button patterns to auto-click
export const ACCEPT_PATTERNS = [
    'accept',
    'accept all',
    'run',
    'run command',
    'apply',
    'execute',
    'retry',
    'try again',
    'resume',
    'confirm',
    'allow once',
    'allow',
];

// Patterns to reject (never click)
export const REJECT_PATTERNS = [
    'skip',
    'reject',
    'cancel',
    'discard',
    'deny',
    'close',
    'refine',
    'other',
];

// Default blocked commands
export const DEFAULT_BLOCKLIST = [
    'rm -rf /',
    'rm -rf ~',
    'rm -rf *',
    'format c:',
    'del /f /s /q',
    'rmdir /s /q',
    ':(){:|:&};:',
    'dd if=',
    'mkfs.',
    '> /dev/sda',
    'chmod -R 777 /',
];

// Status bar icons
export const ICONS = {
    OFF: '$(zap)',
    ON: '⚡',
    MULTI: '⚡',
    LOADING: '$(sync~spin)',
    ERROR: '$(error)',
    WARNING: '$(warning)',
};
