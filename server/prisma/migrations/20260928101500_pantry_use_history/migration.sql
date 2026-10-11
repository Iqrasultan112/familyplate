CREATE TABLE "PantryUse" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL,
  "recipeName" TEXT NOT NULL,
  "ingredient" TEXT NOT NULL,
  "quantityUsed" TEXT NOT NULL,
  "quantityRemaining" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PantryUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PantryUse_userId_createdAt_idx" ON "PantryUse"("userId", "createdAt");
