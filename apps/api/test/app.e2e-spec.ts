import { Body, Controller, Get, type INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { AppError } from '../src/common/errors/app-error';
import { buildLoggerParams } from '../src/common/logging/logger.config';

class NameDto {
  @IsString()
  name!: string;
}

@Controller('__test')
class TestErrorsController {
  @Get('app-error')
  appError(): never {
    throw new AppError('IN_USE', 'en uso', 409, { id: 'x' });
  }

  @Post('dto')
  dto(@Body() body: NameDto): NameDto {
    return body;
  }

  @Get('boom')
  boom(): never {
    throw new Error('db password=hunter2');
  }
}

@Module({
  imports: [LoggerModule.forRoot(buildLoggerParams({ LOG_LEVEL: 'fatal', NODE_ENV: 'test' }))],
  controllers: [TestErrorsController],
})
class TestAppModule {}

describe('formato de error común (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('formatea AppError', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/__test/app-error').expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      code: 'IN_USE',
      message: 'en uso',
      details: { id: 'x' },
      requestId: expect.any(String),
    });
  });

  it('valida DTOs con whitelist y forbidNonWhitelisted', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/dto')
      .send({ name: 1, extra: true })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.details.fields)).toEqual(expect.arrayContaining(['name', 'extra']));
  });

  it('ruta inexistente → 404 con el formato común', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nada').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toEqual(expect.any(String));
  });

  it('un error desconocido no filtra detalles internos', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/__test/boom').expect(500);
    expect(res.body.code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('propaga x-request-id entrante', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nada').set('x-request-id', 'abc-123');
    expect(res.body.requestId).toBe('abc-123');
  });
});
