import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ArtworkController } from './artwork.controller';
import { ArtworkService } from './artwork.service';
import { RetentionService } from './retention.service';

@Module({
  imports: [JobsModule],
  controllers: [ArtworkController],
  providers: [ArtworkService, RetentionService],
  exports: [ArtworkService],
})
export class FilesModule {}
