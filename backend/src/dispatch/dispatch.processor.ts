import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '../jobs/queues.js';
import { DispatchService } from './dispatch.service.js';

/** WhatsApp Cloud API throughput is tier-limited; stay well under 80 msg/s per number. */
@Processor(QUEUES.dispatch, { concurrency: 5, limiter: { max: 20, duration: 1000 } })
export class DispatchProcessor extends WorkerHost {
  constructor(private readonly dispatch: DispatchService) {
    super();
  }

  async process(job: Job<{ messageId: string }>) {
    const attempts = job.opts.attempts ?? 1;
    await this.dispatch.deliver(job.data.messageId, job.attemptsMade + 1 >= attempts);
  }
}
