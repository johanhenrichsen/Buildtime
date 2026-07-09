import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EnrollWorkerDto } from './dto/enroll-worker.dto';

const MIN_QUALITY = parseFloat(process.env.MIN_EMBEDDING_QUALITY ?? '0.6');

@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  async enroll(workerId: string, dto: EnrollWorkerDto, enrolledBy: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, status: true, name: true },
    });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);
    if (worker.status !== 'active') {
      throw new BadRequestException('Worker must be active to enroll');
    }
    if (dto.qualityScore < MIN_QUALITY) {
      throw new BadRequestException(
        `Quality score ${dto.qualityScore} is below minimum threshold ${MIN_QUALITY}`,
      );
    }

    // Format vector as Postgres literal: '[0.1,0.2,...]'
    const vectorLiteral = `[${dto.embeddingVector.join(',')}]`;

    return this.prisma.$transaction(async (tx) => {
      // Find existing active embedding (if any) for re-enrollment audit
      const previous = await tx.faceEmbedding.findFirst({
        where: { workerId, active: true },
        select: { id: true, qualityScore: true, enrolledAt: true },
      });

      if (previous) {
        // Deactivate the old embedding before inserting the new one.
        // The partial unique index (active=true per worker) enforces this
        // at DB level, so the deactivation must happen inside this transaction.
        await tx.faceEmbedding.update({
          where: { id: previous.id },
          data: { active: false },
        });
      }

      // Insert new embedding via raw SQL — Prisma cannot write vector(512) columns
      const [row] = await tx.$queryRaw<{ id: string; enrolled_at: Date }[]>`
        INSERT INTO face_embeddings (worker_id, embedding_vector, quality_score, enrolled_by, active)
        VALUES (${workerId}::uuid, ${vectorLiteral}::vector, ${dto.qualityScore}, ${enrolledBy}::uuid, true)
        RETURNING id, enrolled_at
      `;

      // Point worker to the new active embedding
      await tx.worker.update({
        where: { id: workerId },
        data: { faceEmbeddingRef: row.id },
      });

      // Immutable audit record
      await tx.auditLog.create({
        data: {
          actorId: enrolledBy,
          action: previous ? 'reenroll' : 'enroll',
          entity: 'face_embeddings',
          entityId: row.id,
          before: previous
            ? { previousEmbeddingId: previous.id, previousQualityScore: previous.qualityScore }
            : Prisma.JsonNull,
          after: { qualityScore: dto.qualityScore, enrolledAt: row.enrolled_at },
        },
      });

      return {
        id: row.id,
        workerId,
        qualityScore: dto.qualityScore,
        enrolledAt: row.enrolled_at,
        enrolledBy,
        active: true,
        wasReenrollment: !!previous,
      };
    });
  }

  async getStatus(workerId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, name: true, faceEmbeddingRef: true },
    });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);

    if (!worker.faceEmbeddingRef) {
      return { workerId, enrolled: false, embedding: null };
    }

    const embedding = await this.prisma.faceEmbedding.findUnique({
      where: { id: worker.faceEmbeddingRef },
      select: {
        id: true,
        qualityScore: true,
        enrolledAt: true,
        active: true,
        enrolledByWorker: { select: { id: true, name: true } },
      },
    });

    return { workerId, enrolled: !!embedding?.active, embedding };
  }

  async revoke(workerId: string, actorId: string) {
    const embedding = await this.prisma.faceEmbedding.findFirst({
      where: { workerId, active: true },
      select: { id: true, qualityScore: true, enrolledAt: true },
    });
    if (!embedding) {
      throw new NotFoundException('No active enrollment found for this worker');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.faceEmbedding.update({
        where: { id: embedding.id },
        data: { active: false },
      });

      await tx.worker.update({
        where: { id: workerId },
        data: { faceEmbeddingRef: null },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'revoke_enrollment',
          entity: 'face_embeddings',
          entityId: embedding.id,
          before: { active: true, qualityScore: embedding.qualityScore },
          after: { active: false },
        },
      });
    });
  }

  // Returns all embedding history for a worker (active + deactivated), without vectors.
  // Used by HR for dispute review / re-enrollment decisions.
  getHistory(workerId: string) {
    return this.prisma.faceEmbedding.findMany({
      where: { workerId },
      select: {
        id: true,
        qualityScore: true,
        enrolledAt: true,
        active: true,
        enrolledByWorker: { select: { id: true, name: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
