/**
 * Safety Filter
 * Blocks dangerous commands from being auto-executed
 */

import { ConfigService } from '../shared/config';
import { DEFAULT_BLOCKLIST } from '../shared/constants';

export class SafetyFilter {
    private config: ConfigService;

    constructor(config: ConfigService) {
        this.config = config;
    }

    /**
     * Get the current blocklist
     */
    getBlocklist(): string[] {
        const custom = this.config.get<string[]>('safety.blocklist');
        return custom && custom.length > 0 ? custom : DEFAULT_BLOCKLIST;
    }

    /**
     * Check if a command is blocked
     */
    isBlocked(command: string): boolean {
        const blocklist = this.getBlocklist();
        const lowerCommand = command.toLowerCase();

        for (const pattern of blocklist) {
            const lowerPattern = pattern.toLowerCase().trim();
            if (!lowerPattern) continue;

            // Check for regex pattern
            if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                try {
                    const lastSlash = pattern.lastIndexOf('/');
                    const regexPattern = pattern.substring(1, lastSlash);
                    const flags = pattern.substring(lastSlash + 1) || 'i';
                    const regex = new RegExp(regexPattern, flags);
                    if (regex.test(command)) {
                        return true;
                    }
                } catch {
                    // Invalid regex, fall back to literal match
                    if (lowerCommand.includes(lowerPattern)) {
                        return true;
                    }
                }
            } else {
                // Literal match
                if (lowerCommand.includes(lowerPattern)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Add a pattern to the blocklist
     */
    async addToBlocklist(pattern: string): Promise<void> {
        const current = this.getBlocklist();
        if (!current.includes(pattern)) {
            await this.config.set('safety.blocklist', [...current, pattern]);
        }
    }

    /**
     * Remove a pattern from the blocklist
     */
    async removeFromBlocklist(pattern: string): Promise<void> {
        const current = this.getBlocklist();
        const updated = current.filter(p => p !== pattern);
        await this.config.set('safety.blocklist', updated);
    }

    /**
     * Reset blocklist to default
     */
    async resetBlocklist(): Promise<void> {
        await this.config.set('safety.blocklist', DEFAULT_BLOCKLIST);
    }
}
