/**
 * Input Guard
 * Detects when user is actively typing to prevent interruption
 */

export class InputGuard {
    private lastActivityTime = 0;
    private isTyping = false;
    private debounceMs = 500;

    /**
     * Record user input activity
     */
    recordActivity(): void {
        this.lastActivityTime = Date.now();
        this.isTyping = true;
    }

    /**
     * Check if user is currently typing
     */
    isUserTyping(): boolean {
        if (!this.isTyping) {
            return false;
        }

        // Check if debounce time has passed
        if (Date.now() - this.lastActivityTime > this.debounceMs) {
            this.isTyping = false;
            return false;
        }

        return true;
    }

    /**
     * Clear typing state
     */
    clearState(): void {
        this.isTyping = false;
        this.lastActivityTime = 0;
    }
}
