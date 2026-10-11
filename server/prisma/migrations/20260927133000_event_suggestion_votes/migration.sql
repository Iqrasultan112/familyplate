CREATE TABLE IF NOT EXISTS "EventSuggestionVote" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "suggestionId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventSuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "EventSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventSuggestionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventSuggestionVote_suggestionId_userId_key" ON "EventSuggestionVote"("suggestionId", "userId");
