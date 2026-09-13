-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX "enrollments_isActive_idx" ON "enrollments"("isActive");

-- CreateIndex
CREATE INDEX "lessons_studentId_status_idx" ON "lessons"("studentId", "status");

-- CreateIndex
CREATE INDEX "lessons_schoolId_scheduledAt_idx" ON "lessons"("schoolId", "scheduledAt");

-- CreateIndex
CREATE INDEX "lessons_status_scheduledAt_idx" ON "lessons"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "payments_studentId_status_idx" ON "payments"("studentId", "status");

-- CreateIndex
CREATE INDEX "students_userId_idx" ON "students"("userId");

-- CreateIndex
CREATE INDEX "users_schoolId_idx" ON "users"("schoolId");
