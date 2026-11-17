import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUES } from '../jobs/queues.js';
import { RegistryService } from './registry.service.js';

@Processor(QUEUES.maintenance)
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly registry: RegistryService,
    @InjectQueue(QUEUES.maintenance) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler('expire-holds', { every: 15_000 }, { name: 'expire-holds' });
  }

  async process(job: Job) {
    if (job.name !== 'expire-holds') return;
    const result = await this.registry.expireHolds();
    if (result.releasedTiles || result.expiredContributions) this.logger.log(`Released expired holds: ${JSON.stringify(result)}`);
    return result;
  }
}
