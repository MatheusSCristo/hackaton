import { Global, Module } from "@nestjs/common";

import { LegacyDbService } from "./legacy-db.service";
import { LegacyDbWriteService } from "./legacy-db-write.service";

@Global()
@Module({
  providers: [LegacyDbService, LegacyDbWriteService],
  exports: [LegacyDbService, LegacyDbWriteService],
})
export class LegacyDbModule {}
