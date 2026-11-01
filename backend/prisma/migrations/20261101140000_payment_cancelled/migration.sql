-- Fatura anulada pelo admin: novo status + quando/por quê
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "payments" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT,
-- Último dia do período de aulas ajustado pelo admin (null = calculado pela matrícula)
ADD COLUMN "periodEnd" DATE;
