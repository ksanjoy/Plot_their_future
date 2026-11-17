import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '../jobs/queues.js';
import { ReceiptsService } from './receipts.service.js';

@Processor(QUEUES.receipts, { concurrency: 5 })
export class ReceiptsProcessor extends WorkerHost {
  constructor(private readonly receipts: ReceiptsService) {
    super();
  }

  async process(job: Job<{ contributionId: string }>) {
    return this.receipts.issue(job.data.contributionId);
  }
}
