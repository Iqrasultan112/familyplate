ALTER TABLE "Event" ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'gathering';
ALTER TABLE "Event" ADD COLUMN "guestCount" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "EventSuggestion" ADD COLUMN "recipeId" INTEGER REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyMenu" ADD COLUMN "eventId" INTEGER REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommunityGroup" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'friends',
  "inviteCode" TEXT NOT NULL,
  "creatorId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityGroup_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityGroup_inviteCode_key" ON "CommunityGroup"("inviteCode");

CREATE TABLE "CommunityGroupMember" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "groupId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityGroupMember_groupId_userId_key" ON "CommunityGroupMember"("groupId", "userId");

CREATE TABLE "CommunityGroupMessage" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "groupId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'text',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityGroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CommunityGroupMessage_groupId_createdAt_idx" ON "CommunityGroupMessage"("groupId", "createdAt");
