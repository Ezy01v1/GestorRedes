import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const DB_TIMEOUT_MS = 2_000;

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** 200 si la BD responde a tiempo; 503 si no. Nunca expone el motivo del fallo. */
  @Get('healthz')
  async check(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean }> {
    const ok = await this.pingDatabase();
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { ok };
  }

  private async pingDatabase(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), DB_TIMEOUT_MS);
    });
    const ping = this.prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([ping, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
