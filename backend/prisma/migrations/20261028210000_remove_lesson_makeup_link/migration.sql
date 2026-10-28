-- Desfaz o vínculo reposição → aula cancelada (a ideia foi descartada).
-- IF EXISTS: o ambiente pode ou não ter chegado a aplicar a migration anterior.
ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_makeupForLessonId_fkey";
DROP INDEX IF EXISTS "lessons_makeupForLessonId_idx";
ALTER TABLE "lessons" DROP COLUMN IF EXISTS "makeupForLessonId";
