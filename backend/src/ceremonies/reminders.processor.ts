import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '../jobs/queues.js';
import { CeremoniesService } from './ceremonies.service.js';

@Processor(QUEUES.reminders)
export class RemindersProcessor extends WorkerHost {
  constructor(private readonly ceremonies: CeremoniesService) {
    super();
  }

  async process(job: Job<{ ceremonyId: string; startsAt: string }>) {
    return this.ceremonies.sendReminders(job.data.ceremonyId, job.data.startsAt);
  }
}
