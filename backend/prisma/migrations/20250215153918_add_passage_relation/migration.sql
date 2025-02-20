-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
