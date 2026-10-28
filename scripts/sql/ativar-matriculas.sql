-- Reativa matrículas marcadas como encerradas (isActive = false) por engano.
--
-- Use com psql no banco desejado (staging OU produção — confira antes!):
--   psql "$DATABASE_URL" -f scripts/sql/ativar-matriculas.sql
--
-- Segurança: só reativa a matrícula MAIS RECENTE de cada aluno, e só se o
-- aluno não tiver nenhuma ativa. Assim ninguém fica com duas matrículas
-- ativas (o cron geraria aulas e faturas em dobro) e matrículas antigas de
-- verdade encerradas continuam encerradas.
\set ON_ERROR_STOP on

-- 1) Como está agora
SELECT "isActive", count(*) AS matriculas FROM enrollments GROUP BY 1 ORDER BY 1;

BEGIN;

-- 2) Reativa
WITH reativadas AS (
  UPDATE enrollments e
  SET "isActive" = true
  WHERE e."isActive" = false
    AND e.id = (
      SELECT e2.id FROM enrollments e2
      WHERE e2."studentId" = e."studentId"
      ORDER BY e2."createdAt" DESC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM enrollments e3
      WHERE e3."studentId" = e."studentId" AND e3."isActive" = true
    )
  RETURNING e."studentId"
)
SELECT count(*) AS matriculas_reativadas FROM reativadas;

-- 3) Conferência: nenhum aluno pode ter mais de uma matrícula ativa
SELECT "studentId", count(*) AS ativas
FROM enrollments WHERE "isActive" = true
GROUP BY "studentId" HAVING count(*) > 1;

COMMIT;

-- 4) Como ficou
SELECT "isActive", count(*) AS matriculas FROM enrollments GROUP BY 1 ORDER BY 1;
