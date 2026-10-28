-- Instrumento por aula (null = segue o do aluno) e vínculo reposição → aula cancelada
ALTER TABLE "lessons" ADD COLUMN "instrument" "Instrument";
ALTER TABLE "lessons" ADD COLUMN "makeupForLessonId" TEXT;

CREATE INDEX "lessons_makeupForLessonId_idx" ON "lessons"("makeupForLessonId");

ALTER TABLE "lessons" ADD CONSTRAINT "lessons_makeupForLessonId_fkey"
  FOREIGN KEY ("makeupForLessonId") REFERENCES "lessons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
