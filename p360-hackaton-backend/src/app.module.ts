import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "./auth/auth.module";
import { AulasModule } from "./aulas/aulas.module";
import { CasoModule } from "./caso/caso.module";
import { CasosModule } from "./casos/casos.module";
import { EnqueteModule } from "./enquete/enquete.module";
import { HealthModule } from "./health/health.module";
import { MateriaisModule } from "./materiais/materiais.module";
import { LegacyDbModule } from "./legacy-db/legacy-db.module";
import { Poll360DbModule } from "./enquete/poll360-db.module";
import { LlmModule } from "./llm/llm.module";
import { MetricasModule } from "./metricas/metricas.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SessaoModule } from "./sessao/sessao.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    LegacyDbModule,
    Poll360DbModule,
    LlmModule,
    AuthModule,
    HealthModule,
    CasosModule,
    AulasModule,
    EnqueteModule,
    SessaoModule,
    CasoModule,
    MateriaisModule,
    MetricasModule,
  ],
})
export class AppModule {}
