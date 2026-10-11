# 🍽️ FamilyPlate

> **Smart Family Meal Planner & Recipe Community**  
> HCI Semester Project — Full Stack Web Application

---

## 📋 Project Overview

FamilyPlate is a web-based HCI application that combines **private family meal planning** with a **community recipe-sharing platform**.

### Two Core Experiences

| 🏠 Private Family Space | 🌐 Community Space |
|---|---|
| Family group chat | Recipe posts & requests |
| Meal requests & voting | Community chat |
| 7-day weekly meal planner | Like, comment, share |
| Duplicate recipe prevention | Text & voice recipe sharing |
| Special event menu planning | Add recipes to your menu |

### AI Feature
- Convert **unstructured text or voice** recipes into structured recipe cards
- User always **reviews and edits** before saving (HCI: User Control)
- Everyday recipe ideas match the actual pantry and avoid family food restrictions
- Recipe photos and optional recipe discovery use free TheMealDB/Unsplash sources
- Nutrition numbers are clearly marked as approximate estimates

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite + Prisma ORM |
| Real-time | Socket.io |
| Auth | JWT + bcrypt |
| Voice | Web Speech API (browser-native) |
| AI | Google Gemini API (gemini-1.5-flash) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 8+

### 1. Clone / Open the project
```bash
cd D:\antigrav\hciproject
```

### 2. Setup the Backend

```bash
cd server
npm install
```

Copy the environment file and edit it:
```bash
copy .env.example .env
```

Open `server/.env`. Generate a unique secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and use it for `JWT_SECRET`:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="paste-your-generated-secret-here"
GEMINI_API_KEY=""                       # Optional; app works without it
PORT=5000
CLIENT_URL="http://localhost:5173"
```

> **Note:** If `GEMINI_API_KEY` is blank, FamilyPlate uses pantry-matched local recipes and free TheMealDB discovery where available. It does not invent a mock recipe or pantry contents.

Initialize the database:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

Start the backend:
```bash
npm run dev
```
✅ Server runs at **http://localhost:5000**

### 3. Setup the Frontend

Open a new terminal:
```bash
cd client
npm install
npm run dev
```
✅ Frontend runs at **http://localhost:5173**

---

## 📁 Project Structure

```
hciproject/
├── server/                     # Express backend
│   ├── prisma/
│   │   └── schema.prisma       # Full DB schema (15 tables)
│   ├── routes/                 # 13 REST API route files
│   │   ├── auth.js             # Register, login, logout
│   │   ├── family.js           # Family group management
│   │   ├── mealRequests.js     # Meal requests
│   │   ├── votes.js            # Voting system
│   │   ├── weeklyMenu.js       # 7-day family menu
│   │   ├── events.js           # Special events
│   │   ├── recipes.js          # Recipe CRUD
│   │   ├── community.js        # Posts, likes, comments
│   │   ├── ai.js               # AI recipe structuring
│   │   ├── menu.js             # Personal menu
│   │   ├── inventory.js        # Inventory management
│   │   ├── shopping.js         # Shopping cart
│   │   └── profile.js          # User profile
│   ├── socket/
│   │   ├── familyChat.js       # Private family chat (Socket.io)
│   │   └── communityChat.js    # Community chat (Socket.io)
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   └── upload.js           # Multer file uploads
│   ├── index.js                # Server entry point
│   └── package.json
│
└── client/                     # React + Vite frontend
    └── src/
        ├── pages/              # 21 pages (one per SRS section)
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Dashboard.jsx
        │   ├── FamilyHome.jsx
        │   ├── FamilyChat.jsx
        │   ├── MealRequests.jsx
        │   ├── FamilyVoting.jsx
        │   ├── WeeklyMenu.jsx
        │   ├── EventPlanner.jsx
        │   ├── CommunityHome.jsx
        │   ├── CommunityChat.jsx
        │   ├── CreateRecipePost.jsx
        │   ├── RecipeDetails.jsx
        │   ├── RecipesPage.jsx
        │   ├── AIRecipeProcessor.jsx
        │   ├── MyMenu.jsx
        │   ├── Inventory.jsx
        │   ├── ShoppingCart.jsx
        │   ├── SavedRecipes.jsx
        │   └── Profile.jsx
        ├── components/         # 7 shared components
        │   ├── Avatar.jsx
        │   ├── RecipeCard.jsx
        │   ├── RecipeReview.jsx
        │   ├── DayPickerModal.jsx
        │   ├── NotificationBell.jsx
        │   ├── LoadingSpinner.jsx
        │   └── EmptyState.jsx
        ├── layouts/
        │   ├── AppLayout.jsx   # Sidebar + bottom nav
        │   └── AuthLayout.jsx  # Centered auth card
        ├── store/
        │   └── authStore.js    # Zustand auth state
        ├── lib/
        │   ├── api.js          # Axios instance
        │   └── utils.js        # Helpers (formatDate, etc.)
        └── App.jsx             # Routes (React Router v6)
```

---

## 🗄️ Database Tables

| Table | Purpose |
|---|---|
| User | Authentication + profile |
| Family | Private family groups |
| FamilyMember | Family membership |
| FamilyMessage | Family chat history |
| MealRequest | Meal requests from family members |
| Vote | Votes on meal requests |
| WeeklyMenu | 7-day meal plan with multiple dishes and meal types per day |
| Event | Special gatherings (Eid, birthday, etc.) |
| EventSuggestion | Dish suggestions for events |
| Recipe | Recipe cards with JSON ingredients + instructions |
| CommunityPost | Community recipe posts and requests |
| Comment | Post comments |
| Like | Post likes |
| Inventory | User's kitchen inventory |
| PantryUse | Cooking history with quantity used and quantity remaining |
| ShoppingItem | Shopping checklist |
| SavedRecipe | Bookmarked recipes |
| Notification | System notifications |

---

## 🔌 API Endpoints

| Route | Description |
|---|---|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Login, get JWT |
| `GET /api/auth/me` | Get current user |
| `POST /api/family/create` | Create family group |
| `POST /api/family/join` | Join by 6-char code |
| `GET /api/family/mine` | My family + members |
| `GET /api/family/messages/:id` | Family chat history |
| `GET /api/mealRequests/family/:id` | Family meal requests |
| `POST /api/mealRequests` | New meal request |
| `POST /api/votes` | Cast vote |
| `GET /api/votes/request/:id` | Vote tallies |
| `POST /api/weeklyMenu` | Add to weekly plan (409 if duplicate) |
| `POST /api/events` | Create event |
| `POST /api/events/:id/suggest` | Suggest dish |
| `POST /api/community/posts` | Create community post |
| `POST /api/community/posts/:id/like` | Toggle like |
| `POST /api/ai/structure` | AI recipe structuring |
| `POST /api/menu` | Add to personal menu |
| `POST /api/menu/check-ingredients` | Find missing ingredients |
| `POST /api/shopping/bulk` | Add missing items to cart |
| `GET /api/inventory` | Kitchen inventory |
| `GET /api/shopping` | Shopping checklist |

---

## 🎤 AI + Voice Features

### Text Recipe Processing
1. Go to **Recipes → AI Processor**
2. Paste any unstructured recipe text
3. Click **Process Recipe** → Gemini extracts structure
4. **Review and edit** the result
5. Click **Confirm & Save**

### Voice Recipe Processing
1. In AI Processor → **Voice Input** tab
2. Click the mic button, speak your recipe
3. Web Speech API transcribes to text
4. Auto-sent to Gemini for structuring
5. Review, edit, confirm

### Community Voice Recipes
1. In Community Chat, use the 🎤 mic button
2. AI detects a recipe in voice messages
3. Prompts: *"Convert to recipe card?"*
4. Navigates to AI Processor with text pre-filled

---

## 🎨 HCI Principles Demonstrated

| Principle | Implementation |
|---|---|
| **Visibility of System Status** | Loading spinners, toast notifications, status badges |
| **User Control & Freedom** | Always review/edit AI recipes before saving |
| **Error Prevention** | "This recipe is already planned for this week" (409 duplicate check) |
| **Recognition not Recall** | Calendar grid, recipe cards, icon buttons, day names |
| **Feedback** | Toast on every action (liked ❤️, saved 🔖, added ✅) |
| **Consistency** | Unified Tailwind design system across all 21 pages |
| **Simple Navigation** | 7-item sidebar, bottom nav on mobile |

---

## 👥 User Flows

### Family Meal Flow
Register → Login → Create Family → Invite Members → Family Chat → Create Meal Request → Vote → Add to Weekly Menu → Duplicate check → View Recipe → Check Ingredients → Add Missing to Cart

### Community Recipe Flow
Browse Community → Find Post → Like / Comment → Add to My Menu → Select Day → Ingredient Check → Missing Items → Shopping Cart

### AI Recipe Flow
AI Processor → Paste text or record voice → Processing spinner → Review structured recipe → Edit any field → Confirm & Save → Optional: Add to Menu

---

## 🔑 Getting a Free Gemini API Key

1. Visit [ai.google.dev](https://ai.google.dev)
2. Click **Get API key**
3. Create a project → Generate key
4. Paste in `server/.env` as `GEMINI_API_KEY`

The free tier (Gemini 1.5 Flash) is sufficient for this project.

---

## 📝 License

This project is a university semester HCI project. For educational use only.
