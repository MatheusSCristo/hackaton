import { Global, Module } from "@nestjs/common";

import { Poll360DbService } from "./poll360-db.service";

@Global()
@Module({
  providers: [Poll360DbService],
  exports: [Poll360DbService],
})
export class Poll360DbModule {}
