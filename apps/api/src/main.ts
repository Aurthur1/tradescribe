import "./instrument.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { createRateLimitMiddleware } from "./common/rate-limit.middleware.js";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser("json", { limit: process.env.JSON_BODY_LIMIT ?? "1mb" });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", process.env.APP_BASE_URL ?? "http://localhost:3000"],
          fontSrc: ["'self'", "https:", "data:"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"]
        }
      }
    })
  );
  app.use(createRateLimitMiddleware("default"));

  const allowedOrigins = [
    process.env.APP_BASE_URL ?? "http://localhost:3000",
    ...(process.env.CORS_EXTRA_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  ];
  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true
  });
  app.useGlobalPipes(new ZodValidationPipe());

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
