import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = [
    'https://buildtime.vercel.app',
    'https://buildtime-admin.vercel.app',
    /^https:\/\/buildtime.*\.vercel\.app$/,
    /^http:\/\/localhost:\d+$/,
  ];
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`BuildTime API running on port ${port}`);
}

bootstrap();
