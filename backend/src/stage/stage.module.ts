import { Module } from '@nestjs/common';
import { BlessingsModule } from '../blessings/blessings.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { StageController } from './stage.controller.js';

@Module({
  imports: [RegistryModule, BlessingsModule],
  controllers: [StageController],
})
export class StageModule {}
