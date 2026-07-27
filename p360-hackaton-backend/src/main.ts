import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Allow-list de CORS (default `*`). Restringir fora de PoC.
  const origins = (config.get<string>("CORS_ALLOW_ORIGINS") ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.includes("*") ? true : origins,
    // O embed manda o token de sessão legado neste header.
    allowedHeaders: ["Content-Type", "Authorization", "X-Access-Token"],
  });

  const port = config.get<number>("PORT") ?? 8000;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
