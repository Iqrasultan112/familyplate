CREATE TABLE "RecipeCollection" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "RecipeCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecipeCollection_userId_name_key" ON "RecipeCollection"("userId", "name");
CREATE INDEX "RecipeCollection_userId_updatedAt_idx" ON "RecipeCollection"("userId", "updatedAt");

CREATE TABLE "RecipeCollectionItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "collectionId" INTEGER NOT NULL,
  "recipeId" INTEGER NOT NULL,
  "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecipeCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "RecipeCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeCollectionItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecipeCollectionItem_collectionId_recipeId_key" ON "RecipeCollectionItem"("collectionId", "recipeId");
CREATE INDEX "RecipeCollectionItem_recipeId_idx" ON "RecipeCollectionItem"("recipeId");
