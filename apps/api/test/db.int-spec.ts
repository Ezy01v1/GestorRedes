import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { startTestDatabase, type TestDatabase } from './support/postgres';

let db: TestDatabase;
let prisma: PrismaClient;

async function seedAccountAndPost(client: PrismaClient) {
  const account = await client.connectedAccount.create({
    data: {
      network: 'INSTAGRAM',
      kind: 'IG_BUSINESS',
      externalId: `ig-${Math.random()}`,
      displayName: 'Cuenta de prueba',
    },
  });
  const post = await client.post.create({ data: { baseText: 'hola' } });
  return { account, post };
}

beforeAll(async () => {
  db = await startTestDatabase();
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: db.url }) });
});

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

describe('migración inicial', () => {
  it('solo permite un usuario', async () => {
    await prisma.user.create({ data: { username: 'a', passwordHash: 'h' } });
    await expect(
      prisma.$executeRaw`INSERT INTO users (id, singleton, username, password_hash, updated_at)
        VALUES (gen_random_uuid(), false, 'b', 'h', now())`,
    ).rejects.toThrow(/users_singleton/);
    await expect(
      prisma.user.create({ data: { username: 'c', passwordHash: 'h' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('un target SCHEDULED exige scheduled_at', async () => {
    const { account, post } = await seedAccountAndPost(prisma);
    await expect(
      prisma.postTarget.create({
        data: { postId: post.id, accountId: account.id, format: 'FEED', status: 'SCHEDULED' },
      }),
    ).rejects.toThrow(/scheduled_needs_date/);
  });

  it('un snapshot por cuenta y día', async () => {
    const { account } = await seedAccountAndPost(prisma);
    const row = {
      accountId: account.id,
      network: 'INSTAGRAM' as const,
      snapshotDate: new Date('2026-10-01'),
      source: 'CRON' as const,
      metrics: {},
      catalogVersion: 1,
      apiVersion: 'v26.0',
    };
    await prisma.accountSnapshot.create({ data: row });
    await expect(prisma.accountSnapshot.create({ data: row })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('metrics debe ser un objeto JSON', async () => {
    const { account } = await seedAccountAndPost(prisma);
    await expect(
      prisma.$executeRaw`INSERT INTO account_snapshots (account_id, network, snapshot_date, source, metrics, catalog_version, api_version)
        VALUES (${account.id}, 'INSTAGRAM', '2026-10-02', 'CRON', '[1,2]'::jsonb, 1, 'v26.0')`,
    ).rejects.toThrow(/metrics_is_object/);
  });

  it('account_daily_stats calcula el neto y detecta huecos', async () => {
    const { account } = await seedAccountAndPost(prisma);
    const days: Array<[string, number]> = [
      ['2026-10-01', 100],
      ['2026-10-02', 104],
      ['2026-10-05', 101],
    ];
    for (const [day, followers] of days) {
      await prisma.accountSnapshot.create({
        data: {
          accountId: account.id,
          network: 'INSTAGRAM',
          snapshotDate: new Date(day),
          source: 'CRON',
          metrics: { followers_count: followers },
          catalogVersion: 1,
          apiVersion: 'v26.0',
        },
      });
    }
    const rows = await prisma.$queryRaw<
      Array<{ net_followers: number | null; days_since_prev: number | null }>
    >`SELECT net_followers, days_since_prev FROM account_daily_stats
      WHERE account_id = ${account.id} ORDER BY snapshot_date`;
    expect(rows).toEqual([
      { net_followers: null, days_since_prev: null },
      { net_followers: 4, days_since_prev: 1 },
      { net_followers: -3, days_since_prev: 3 },
    ]);
  });

  it('no se puede borrar un medio en uso', async () => {
    const { account, post } = await seedAccountAndPost(prisma);
    const media = await prisma.mediaAsset.create({
      data: {
        kind: 'IMAGE',
        storagePath: `2026/10/${Math.random()}.jpg`,
        originalFilename: 'foto.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1234n,
        sha256: `sha-${Math.random()}`,
      },
    });
    const target = await prisma.postTarget.create({
      data: { postId: post.id, accountId: account.id, format: 'FEED' },
    });
    await prisma.postTargetMedia.create({
      data: { targetId: target.id, mediaId: media.id, position: 0 },
    });
    await expect(prisma.mediaAsset.delete({ where: { id: media.id } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });
});
