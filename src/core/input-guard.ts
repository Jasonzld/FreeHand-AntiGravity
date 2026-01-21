/**
 * Input Guard
 * Detects if user is currently typing to avoid interruption
 */

export class InputGuard {
    /**
     * Check if the current active element indicates user is typing
     * This is used as a fallback when we can't check via CDP
     */
    isTypingIndicator(tagName: string, className: string): boolean {
        const lowerTag = tagName.toLowerCase();
        const lowerClass = className.toLowerCase();

        // Check tag name
        if (lowerTag === 'input' || lowerTag === 'textarea') {
            return true;
        }

        // Check class names
        const typingClasses = [
            'monaco-editor',
            'inputarea',
            'prosemirror',
            'chat-input',
            'message-input',
            'contenteditable',
        ];

        return typingClasses.some(c => lowerClass.includes(c));
    }
}
