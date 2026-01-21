/**
 * Wake Scheduler
 * Controls automation based on time schedules
 */

import { ConfigService } from '../shared/config';
import { Logger } from '../shared/logger';

export class WakeScheduler {
    private config: ConfigService;
    private logger: Logger;
    private checkInterval: NodeJS.Timeout | null = null;
    private isAwake = true;

    constructor(config: ConfigService, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    start(): void {
        if (this.checkInterval) {
            return;
        }

        this.logger.info('Wake scheduler started');

        // Check every minute
        this.checkInterval = setInterval(() => {
            this.checkSchedule();
        }, 60000);

        // Initial check
        this.checkSchedule();
    }

    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.logger.info('Wake scheduler stopped');
        }
    }

    isWithinWorkHours(): boolean {
        const config = this.config.getAll();
        if (!config.wake.enabled) {
            return true; // Always awake if scheduler is disabled
        }

        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday
        const currentTime = now.getHours() * 60 + now.getMinutes();

        // Check if today is a work day
        if (!config.wake.workDays.includes(currentDay)) {
            return false;
        }

        // Parse start and end times
        const startTime = this.parseTime(config.wake.startTime);
        const endTime = this.parseTime(config.wake.endTime);

        // Check if current time is within range
        return currentTime >= startTime && currentTime <= endTime;
    }

    private parseTime(timeStr: string): number {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    private checkSchedule(): void {
        const shouldBeAwake = this.isWithinWorkHours();

        if (shouldBeAwake !== this.isAwake) {
            this.isAwake = shouldBeAwake;
            this.logger.info(`Schedule check: ${shouldBeAwake ? 'AWAKE' : 'SLEEPING'}`);

            // TODO: Emit event to control AutoClicker
        }
    }

    getStatus(): { isAwake: boolean; nextWake?: Date; nextSleep?: Date } {
        return {
            isAwake: this.isAwake,
            // TODO: Calculate next wake/sleep times
        };
    }
}
