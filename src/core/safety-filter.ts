/**
 * Safety Filter
 * Manages blocklist for dangerous commands
 */

import { ConfigService } from '../shared/config';

export class SafetyFilter {
    private config: ConfigService;
    private defaultBlocklist = [
        'rm -rf /',
        'rm -rf ~',
        'format c:',
        'del /f /s /q',
        ':(){:|:&};:',
        'mkfs.',
        'dd if=/dev/zero',
        '> /dev/sda',
        'wget | sh',
        'curl | sh',
    ];

    constructor(config: ConfigService) {
        this.config = config;
    }

    /**
     * Get the current blocklist
     */
    getBlocklist(): string[] {
        const userList = this.config.get<string[]>('safety.blocklist');
        if (userList && userList.length > 0) {
            return userList;
        }
        return this.defaultBlocklist;
    }

    /**
     * Check if a command contains blocked patterns
     */
    isBlocked(command: string): boolean {
        if (!command) return false;

        const lowerCommand = command.toLowerCase();
        const blocklist = this.getBlocklist();

        for (const pattern of blocklist) {
            if (lowerCommand.includes(pattern.toLowerCase())) {
                return true;
            }
        }

        // Additional safety checks
        if (this.containsDangerousPatterns(lowerCommand)) {
            return true;
        }

        return false;
    }

    /**
     * Additional pattern-based checks
     */
    private containsDangerousPatterns(command: string): boolean {
        const dangerousPatterns = [
            /rm\s+(-[rf]+\s+)*\/(?!\w)/,      // rm -rf /
            /mkfs\.\w+\s+\/dev/,              // mkfs.* /dev/*
            /dd\s+.*of=\/dev\/\w+/,           // dd of=/dev/*
            /:\s*\(\s*\)\s*{\s*:\s*\|/,       // Fork bomb
            />\s*\/dev\/sd[a-z]/,             // Overwrite disk
            /curl.*\|\s*(?:ba)?sh/,           // Pipe to shell
            /wget.*\|\s*(?:ba)?sh/,           // Pipe to shell
        ];

        return dangerousPatterns.some(pattern => pattern.test(command));
    }

    /**
     * Check if action type should be safety filtered
     */
    shouldFilterAction(actionType: 'accept' | 'run' | 'retry'): boolean {
        // Only filter 'run' actions which execute commands
        return actionType === 'run';
    }
}
