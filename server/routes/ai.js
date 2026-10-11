import express from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { pantryHas, pantryOverlap, isStaple } from '../lib/foodMatching.js';
import { estimateNutrition } from '../lib/nutritionEstimate.js';

const router = express.Router();
const prisma = new PrismaClient();
router.use(authenticate);
const receiptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (/^audio\/(webm|mp4|mpeg|mp3|wav|x-wav|ogg|flac|mpga|m4a)(;|$)/i.test(file.mimetype)) return callback(null, true);
    callback(new Error('Use a WebM, MP4, WAV, OGG, MP3, or FLAC voice recording.'));
  }
});
const aiConfig = () => {
  const openRouterKey = String(process.env.OPENROUTER_API_KEY || '').trim();
  const groqKey = String(process.env.GROQ_API_KEY || '').trim();
  const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const googleKey = String(process.env.GOOGLE_API_KEY || '').trim();
  const legacyGroqKey = [geminiKey, googleKey].find(key => /^gsk_/i.test(key));
  if (groqKey && groqKey.length >= 20 && !/^(your|replace|changeme|placeholder)/i.test(groqKey)) return { provider: 'groq', key: groqKey };
  if (openRouterKey && openRouterKey.length >= 20 && !/^(your|replace|changeme|placeholder)/i.test(openRouterKey)) return { provider: 'openrouter', key: openRouterKey };
  if (legacyGroqKey && legacyGroqKey.length >= 20 && !/^(your|replace|changeme|placeholder)/i.test(legacyGroqKey)) return { provider: 'groq', key: legacyGroqKey };
  if (geminiKey && geminiKey.length >= 20 && !/^(your|replace|changeme|placeholder)/i.test(geminiKey)) return { provider: 'gemini', key: geminiKey };
  if (googleKey && googleKey.length >= 20 && !/^(your|replace|changeme|placeholder)/i.test(googleKey)) return { provider: 'gemini', key: googleKey };
  if (String(process.env.LOCAL_LLM_ENABLED || '').toLowerCase() === 'true') {
    return {
      provider: 'ollama',
      baseUrl: String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
      model: String(process.env.OLLAMA_MODEL || 'qwen3:8b')
    };
  }
  return null;
};
const recipeAiEnabled = () => Boolean(aiConfig());
const recipeModel = () => new GoogleGenerativeAI(aiConfig().key)
  .getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' });
const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const isExplicitMenuIntent = text => {
  const value = String(text || '').toLowerCase().replace(/\ba+d+\b/g, 'add').replace(/\bluch\b/g, 'lunch');
  return /\b(add|put|schedule|plan|include)\b.{0,100}\b(menu|breakfast|brunch|lunch|dinner|snack|meal)\b/.test(value)
    || /\b(menu|meal plan|breakfast|brunch|lunch|dinner|snack|meal)\b.{0,100}\b(add|put|schedule|plan|include)\b/.test(value)
    || /\bmenu\s*(mein|me|ma)\s*(add|daal|dalo|rakh|shamil)\b/.test(value)
    || /\b(add|daal|dalo|rakh|shamil)\b.{0,60}\b(menu\s*(mein|me|ma))\b/.test(value);
};
const parseMenuSchedule = (text, todayKey) => {
  const value = String(text || '').toLowerCase().replace(/\bluch\b/g, 'lunch').replace(/\blunc\b/g, 'lunch');
  const mealType = /\b(breakfast|brunch)\b/.test(value) ? 'Breakfast'
    : /\b(lunch)\b/.test(value) ? 'Lunch'
      : /\b(dinner|tonight|supper)\b/.test(value) ? 'Dinner'
        : /\b(snack)\b/.test(value) ? 'Snack' : null;
  const isoDate = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (isoDate) return { mealType, date: isoDate };
  const [year, month, day] = todayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (/\b(tomorrow|tmrw)\b/.test(value)) date.setDate(date.getDate() + 1);
  else {
    const weekdayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .findIndex(name => new RegExp(`\\b${name}\\b`).test(value));
    if (weekdayIndex >= 0) date.setDate(date.getDate() + ((weekdayIndex - date.getDay() + 7) % 7));
    else if (!/\b(today|tonight|now)\b/.test(value)) return { mealType, date: null };
  }
  return { mealType, date: localDateKey(date) };
};
const isFullRecipeIntent = text => /\b(full|complete|detailed|step[- ]by[- ]step|quantities|ingredients and steps)\b/i.test(String(text || ''))
  || /\b(pura|poori|tafseel|detail|mukammal)\b.{0,40}\b(recipe|ripi|tarika|steps)\b/i.test(String(text || ''))
  || /\b(recipe|ripi)\b.{0,40}\b(pura|poori|tafseel|detail|mukammal)\b/i.test(String(text || ''));
const extractChatFoodConstraints = turns => {
  const foodNames = new Set(['rice', 'basmati rice', 'potato', 'spinach', 'spinich', 'chicken', 'beef', 'mutton', 'egg', 'lentil', 'daal', 'tomato', 'onion', 'fish']);
  for (const recipe of RECIPE_DATABASE) for (const ingredient of recipe.ingredients || []) foodNames.add(String(ingredient.name || '').toLowerCase());
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const avoided = new Set();
  const required = new Set();
  for (const turn of turns.filter(item => item.role === 'user')) {
    const text = String(turn.content || '').toLowerCase();
    for (const food of foodNames) {
      if (!food || food.length < 3) continue;
      const term = escaped(food);
      const negative = new RegExp(`(?:\\bno\\s+(?:any\\s+)?|\\bwithout\\s+|\\bdon['’]?t\\s+(?:have|want|feel like)\\s+(?:any\\s+)?|\\bdo not\\s+(?:have|want|feel like)\\s+(?:any\\s+)?|\\bnot\\s+feeling\\s+(?:like\\s+)?|\\bavoid\\s+|\\bskip\\s+|\\ballergic to\\s+)${term}(?:s|es)?\\b`, 'i').test(text)
        || new RegExp(`\\b${term}(?:s|es)?\\s+(?:nahi|nahin)\\b`, 'i').test(text);
      const positive = new RegExp(`\\b(?:want|need|craving|like|make|cook|use|prefer)\\b[^.!?,;\\n]{0,28}\\b${term}(?:s|es)?\\b|\\b${term}(?:s|es)?\\b[^.!?,;\\n]{0,14}\\b(?:today|tonight|based|please)\\b`, 'i').test(text);
      const canonicalFood = ({
        spinich: 'spinach', potatoes: 'potato', eggs: 'egg', tomatoes: 'tomato',
        onions: 'onion', lentils: 'lentil', daal: 'lentil', dal: 'lentil',
        'basmati rice': 'rice'
      })[food] || food;
      if (negative) { avoided.add(canonicalFood); required.delete(canonicalFood); }
      else if (positive) { required.add(canonicalFood); avoided.delete(canonicalFood); }
    }
  }
  let maxMinutes = null;
  for (const turn of turns.filter(item => item.role === 'user')) {
    const text = String(turn.content || '').toLowerCase();
    const limit = text.match(/(?:under|within|in|only|ready in)\s*(\d{1,3})\s*(?:minutes?|mins?)\b/);
    if (limit) maxMinutes = Number(limit[1]);
    else if (/\b(quick|quickly|fast|easy-peasy)\b/.test(text)) maxMinutes = 30;
    else if (/\b(no rush|take your time)\b/.test(text)) maxMinutes = null;
  }
  return { avoided, required, maxMinutes };
};
const generateOllamaToolMessage = async (prompt, tools) => {
  const config = aiConfig();
  if (config?.provider !== 'ollama') throw new Error('Local tool calls are available only with Ollama enabled');
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      tools,
      stream: false,
      keep_alive: '30m',
      think: false,
      options: { temperature: 0.2, num_ctx: 4096, num_predict: 1200 }
    }),
    signal: AbortSignal.timeout(300000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Local Ollama tool request failed (${response.status})`);
  return result.message || {};
};
const generateGroqText = async (prompt, { json = false, image = null, system = '', maxTokens = 1800 } = {}) => {
  const groqKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!groqKey) throw new Error('Groq fallback is not configured');
  const content = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
      ]
    : prompt;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: image
        ? (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b')
        : (process.env.GROQ_MODEL || 'openai/gpt-oss-120b'),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content }
      ],
      temperature: 0.2,
      max_completion_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {})
    }),
    signal: AbortSignal.timeout(45000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Groq request failed (${response.status})`);
  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Groq returned an empty response');
  return text.trim();
};
const generateAiText = async (prompt, { json = false, image = null, maxTokens = 1800, timeoutMs = 300000, system = '' } = {}) => {
  const config = aiConfig();
  if (!config) throw new Error('No local model or AI provider is configured');
  if (config.provider === 'ollama') {
    if (image) throw new Error('The configured local Qwen3 8B model accepts text, not image input');
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        keep_alive: '30m',
        think: false,
        options: { temperature: 0.3, num_ctx: 4096, num_predict: maxTokens },
        ...(json ? { format: 'json' } : {})
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || `Local Ollama request failed (${response.status})`);
    const text = result.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Local Qwen returned an empty response');
    return text.trim();
  }
  if (config.provider === 'openrouter') {
    const content = image
      ? [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
        ]
      : prompt;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'X-Title': 'FamilyPlate'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free',
        messages: [{ role: 'user', content }],
        temperature: 0.3,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: AbortSignal.timeout(45000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (String(process.env.GROQ_API_KEY || '').trim()) {
        console.warn(`OpenRouter request failed (${response.status}); using Groq fallback.`);
        return generateGroqText(prompt, { json, image });
      }
      const error = new Error(result.error?.message || `OpenRouter request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const text = result.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      if (String(process.env.GROQ_API_KEY || '').trim()) {
        console.warn('OpenRouter returned an empty response; using Groq fallback.');
        return generateGroqText(prompt, { json, image });
      }
      throw new Error('OpenRouter returned an empty response');
    }
    return text.trim();
  }
  if (config.provider === 'groq') return generateGroqText(prompt, { json, image, maxTokens, system });

  const model = recipeModel();
  const input = image
    ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }, prompt]
    : prompt;
  const result = await model.generateContent(input);
  return (await result.response).text().trim();
};
const parseAiJson = raw => {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(text); } catch { /* trim prose around a JSON payload below */ }
  const starts = [text.indexOf('{'), text.indexOf('[')].filter(index => index >= 0);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (!starts.length || end < 0) throw new Error('AI response did not contain JSON');
  return JSON.parse(text.slice(Math.min(...starts), end + 1));
};
router.get('/capabilities', (_req, res) => {
  const provider = aiConfig()?.provider || null;
  res.json({
    ollama: provider === 'ollama',
    gemini: provider === 'gemini',
    groq: provider === 'groq',
    openrouter: provider === 'openrouter',
    billPhotoReading: Boolean(provider && provider !== 'ollama'),
    recipeTextStructuring: true,
    recipeTextMode: provider || 'offline'
  });
});

router.post('/transcribe', audioUpload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Record a voice note before transcribing it.' });
  const config = aiConfig();
  if (config?.provider !== 'groq') return res.status(503).json({ error: 'Voice transcription needs a Groq API key in the server .env file.' });
  try {
    const form = new FormData();
    const filename = String(req.file.originalname || 'familyplate-voice-note.webm').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90);
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), filename);
    form.append('model', process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    const language = String(req.body.language || '').toLowerCase().match(/^[a-z]{2}/)?.[0];
    if (language) form.append('language', language);
    form.append('prompt', 'Transcribe the speech faithfully in the language spoken. This is a home-cooking recipe note. Preserve ingredient names, amounts, cooking actions, and durations. Do not summarize or translate.');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}` },
      body: form,
      signal: AbortSignal.timeout(60000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error?.message || `Voice transcription failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const transcript = String(result.text || '').trim();
    if (!transcript) return res.status(422).json({ error: 'I could not hear clear words. Try speaking closer to the microphone.' });
    res.json({ text: transcript, model: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo' });
  } catch (error) {
    console.error('Groq voice transcription failed:', error.message);
    res.status(error.status === 429 ? 429 : 502).json({ error: error.status === 429
      ? 'The voice transcription limit was reached. Wait a little and try again, or type your recipe.'
      : 'Voice transcription could not connect to Groq. Check the server connection and try again, or type your recipe.' });
  }
});

const recipeIngredients = [
  ['ginger garlic paste', 'Ginger garlic paste'], ['green chili', 'Green chilies'], ['green chilli', 'Green chilies'],
  ['garam masala', 'Garam masala'], ['biryani masala', 'Biryani masala'], ['red chili powder', 'Red chili powder'],
  ['chilli powder', 'Chili powder'], ['chili powder', 'Chili powder'], ['black pepper', 'Black pepper'],
  ['cumin seeds', 'Cumin seeds'], ['cumin', 'Cumin'], ['coriander', 'Coriander'], ['turmeric', 'Turmeric'],
  ['noodles', 'Noodles'], ['pasta', 'Pasta'], ['chicken', 'Chicken'], ['mutton', 'Mutton'], ['beef', 'Beef'],
  ['qeema', 'Minced meat'], ['minced meat', 'Minced meat'], ['potatoes', 'Potatoes'], ['potato', 'Potato'],
  ['aloo', 'Potato'], ['tomatoes', 'Tomatoes'], ['tomato', 'Tomato'], ['onions', 'Onion'], ['onion', 'Onion'],
  ['eggs', 'Eggs'], ['egg', 'Egg'], ['milk', 'Milk'], ['yogurt', 'Yogurt'], ['dahi', 'Yogurt'], ['water', 'Water'],
  ['rice', 'Rice'], ['daal', 'Lentils'], ['dal', 'Lentils'], ['lentils', 'Lentils'], ['masala', 'Masala'],
  ['salt', 'Salt'], ['sugar', 'Sugar'], ['oil', 'Cooking oil'], ['ghee', 'Ghee'], ['butter', 'Butter'],
  ['garlic', 'Garlic'], ['ginger', 'Ginger'], ['flour', 'Flour'], ['atta', 'Flour'], ['peas', 'Peas'], ['matar', 'Peas'],
  ['carrots', 'Carrots'], ['carrot', 'Carrot'], ['spinach', 'Spinach'], ['palak', 'Spinach'], ['cheese', 'Cheese'],
  ['lemon', 'Lemon'], ['coriander leaves', 'Fresh coriander'], ['coriander leaves', 'Fresh coriander']
].sort((a, b) => b[0].length - a[0].length);

export const structureRecipeLocally = rawText => {
  const originalText = String(rawText || '').replace(/\r\n?/g, '\n').trim();
  const cleanText = originalText.replace(/\s+/g, ' ').trim();
  const found = new Map();
  const matches = [];
  for (const [term, name] of recipeIngredients) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`(^|[^\\p{L}])(${escapedTerm})(?=$|[^\\p{L}])`, 'giu');
    for (const match of cleanText.matchAll(expression)) {
      matches.push({ index: match.index + match[1].length, term, name });
    }
  }
  matches.sort((a, b) => a.index - b.index || b.term.length - a.term.length);
  for (const match of matches) {
    const before = cleanText.slice(Math.max(0, match.index - 64), match.index).replace(/[,;:]+\s*$/, ' ').trim();
    const quantityMatch = before.match(/((?:(?:half|a half|quarter|a quarter|one|two|three|four|five|six|few|some|little|a little|one dozen|a dozen)|(?:\d+(?:\.\d+)?(?:\s*\/\s*\d+)?|[½¼¾]))(?:\s+(?:small|medium|large|cups?|cup|kg|kilograms?|g|grams?|lit(?:er|re)s?|ml|tablespoons?|tbsp|teaspoons?|tsp|pieces?|pcs|cloves?|dozen|packs?|packets?))?(?:\s+of)?\s*)$/i);
    const qty = quantityMatch?.[1]?.trim();
    const quantity = qty && !/^(?:it|then|and|add|boil|cook|mix|heat|fry|stir|pour|serve|chop|put|take)$/i.test(qty)
      ? qty.replace(/\s+of$/i, '')
      : 'Not specified';
    const canonicalName = ({ Potatoes: 'Potato', Tomatoes: 'Tomato', Onions: 'Onion', 'Green Chilies': 'Green Chili', Eggs: 'Egg', Carrots: 'Carrot' })[match.name] || match.name;
    const existing = found.get(canonicalName);
    if (!existing || (existing.quantity === 'Not specified' && quantity !== 'Not specified')) {
      found.set(canonicalName, { name: canonicalName, quantity, sourceIndex: existing ? Math.min(existing.sourceIndex, match.index) : match.index });
    }
  }

  const actionWords = 'add|boil|cook|mix|heat|fry|stir|pour|serve|chop|put|saute|sauté|simmer|bake|grill|cover|knead|marinate|blend|whisk|roast|steam|drain|garnish|remove|turn off';
  const methodText = originalText
    .replace(/\b(?:recipe name|ingredients|method|instructions|steps)\s*:\s*/gi, '')
    .replace(/(\d+)\s+minutes?\b/gi, '$1 minutes')
    .replace(/\bmasala\s+(?:than|then)\b/gi, 'add masala. ')
    .replace(/\bthan\s+(?=(?:cook|add|boil|mix|stir|fry|heat|pour|cover|serve)\b)/gi, '. ')
    .replace(/\s+(?:and\s+then|then|after that|next|finally)\s+/gi, '. ')
    .replace(new RegExp(`\\s*,\\s*(?=(?:${actionWords})\\b)`, 'gi'), '. ')
    .replace(new RegExp(`\\s+(?=(?:${actionWords})\\b)`, 'gi'), '. ');
  const instructions = methodText.split(/[.!?;\n]+/).map(step => step.trim())
    .map(step => step.replace(/\s+(?:and|then|than)$/i, '').trim())
    .filter(step => step.length > 2 && new RegExp(`\\b(?:${actionWords})\\b`, 'i').test(step))
    .map(step => step[0].toUpperCase() + step.slice(1));
  const ingredients = [...found.values()].sort((a, b) => a.sourceIndex - b.sourceIndex).map(({ sourceIndex, ...item }) => item);
  const titleMatch = originalText.match(/^(?:recipe\s+name|name)\s*:\s*([^\n.!?;]{2,80})/i);
  const colonTitle = originalText.match(/^\s*([^\n:]{2,70})\s*:\s*/);
  const titleCandidate = (titleMatch?.[1] || colonTitle?.[1] || '').trim();
  const mainNames = ingredients.map(item => item.name).filter(name => !/^(water|salt|sugar|cooking oil|oil|masala|garam masala|cumin|turmeric|coriander)$/i.test(name));
  const name = titleCandidate && !new RegExp(`^(?:${actionWords}|use|take|for|serves)\\b`, 'i').test(titleCandidate)
    ? titleCandidate
    : mainNames.length ? `${mainNames.slice(0, 2).join(' and ')} Curry` : 'Family Recipe';
  const timings = [...cleanText.matchAll(/(\d+)\s*(?:minutes?|mins?|hours?|hrs?)\b/gi)].map(m => `${m[1]} ${/hour|hr/i.test(m[0]) ? 'hours' : 'minutes'}`);
  return {
    name: name.slice(0, 120), ingredients, instructions: instructions.length ? instructions : ['Add the ingredients and cooking steps, then review this draft before saving.'],
    prepTime: 'Not specified', cookTime: timings.join(', ') || 'Not specified', servings: '4',
    needsManualReview: true, source: 'local'
  };
};

const addRecipeToFamilyMenu = async ({ userId, familyId, membership, family, args, inventory, restrictions, preferences }) => {
  if (!membership || !family) return { error: 'Join this family before adding a meal to its menu.' };
  if (membership.role !== 'maker' && family.creatorId !== userId) return { error: 'Only the family meal planner can add directly to the shared menu. You can send this idea for the planner to review.' };
  if (!args || typeof args !== 'object') return { error: 'I could not read the meal details. Please repeat the date and meal.' };
  const dateKey = String(args?.date || '').trim();
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    && !Number.isNaN(new Date(`${dateKey}T00:00:00.000Z`).getTime())
    && new Date(`${dateKey}T00:00:00.000Z`).toISOString().slice(0, 10) === dateKey;
  if (!dateIsValid) return { error: 'Tell me the exact day for the menu, for example Friday.' };
  if (dateKey < localDateKey(new Date())) return { error: 'A meal cannot be added to a past date.' };
  const mealType = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].includes(args?.mealType) ? args.mealType : null;
  if (!mealType) return { error: 'Choose breakfast, lunch, dinner, or snack before I add it.' };
  const source = args?.recipe && typeof args.recipe === 'object' ? args.recipe : {};
  const name = String(source.name || '').trim().slice(0, 120);
  const ingredients = Array.isArray(source.ingredients) ? source.ingredients.slice(0, 40).map(item => ({
    name: String(item?.name || '').trim().slice(0, 100),
    quantity: String(item?.quantity || '').trim().slice(0, 60)
  })).filter(item => item.name) : [];
  const instructions = Array.isArray(source.instructions) ? source.instructions.slice(0, 20).map(step => String(step || '').trim().slice(0, 1000)).filter(Boolean) : [];
  if (!name || ingredients.length < 2 || instructions.length < 3) return { error: 'I need a complete recipe with ingredients and at least three clear cooking steps before adding it.' };
  const ingredientText = ingredients.map(item => `${item.name} ${item.quantity}`).join(' ');
  if (hasAvoidedIngredient(ingredientText, restrictions) || !isDietSafe(ingredientText, preferences)) return { error: 'This recipe conflicts with a saved family food restriction, so I did not add it.' };
  const pantryCoverage = Math.round(ingredients.filter(item => pantryHas(inventory, item.name)).length / ingredients.length * 100);
  if (pantryCoverage < 60) return { error: `Only ${pantryCoverage}% of this recipe matches the current pantry. I did not add it; choose another recipe or update the pantry first.` };
  const servings = Math.min(30, Math.max(1, Number.parseInt(args.servings, 10) || 4));
  const nutrition = estimateNutrition(ingredients, servings);
  const targetDate = new Date(`${dateKey}T00:00:00.000Z`);
  const dayEnd = new Date(targetDate);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const created = await prisma.$transaction(async tx => {
    const occupied = await tx.weeklyMenu.findFirst({
      where: { familyId, mealType, date: { gte: targetDate, lt: dayEnd } },
      include: { recipe: { select: { name: true } } }
    });
    if (occupied) return { error: `${dateKey} ${mealType} already has ${occupied.recipe.name}. Ask me to replace it if that is what you want.` };
    const recipe = await tx.recipe.create({
      data: {
        name,
        ingredients: JSON.stringify(ingredients),
        instructions: JSON.stringify(instructions),
        prepTime: String(source.prepTime || 'Not specified').slice(0, 40),
        cookTime: String(source.cookTime || 'Not specified').slice(0, 40),
        servings: String(servings),
        nutrition: nutrition ? JSON.stringify(nutrition) : null,
        creatorId: userId
      }
    });
    const menu = await tx.weeklyMenu.create({
      data: { familyId, recipeId: recipe.id, date: targetDate, mealType, servings, status: 'planned', userId },
      include: { recipe: true }
    });
    return { menu };
  });
  if (created.error) return created;
  return {
    menuItem: created.menu,
    recipe: {
      ...source,
      name,
      servings,
      ingredients: ingredients.map(item => ({ ...item, inPantry: pantryHas(inventory, item.name) })),
      instructions,
      nutrition,
      pantryCoverage
    }
  };
};
const familyMenuTools = [{
  type: 'function',
  function: {
    name: 'add_to_menu',
    description: 'Add a complete recipe to a family weekly menu. Call only when the user explicitly asks to add or schedule a meal and a specific future/today date plus meal slot are clear.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        date: { type: 'string', description: 'Meal date as YYYY-MM-DD using the current date from the household context.' },
        mealType: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'] },
        servings: { type: 'integer', minimum: 1, maximum: 30 },
        recipe: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' }, description: { type: 'string' },
            prepTime: { type: 'string' }, cookTime: { type: 'string' },
            ingredients: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'string' } }, required: ['name', 'quantity'] } },
            instructions: { type: 'array', items: { type: 'string' } }
          },
          required: ['name', 'ingredients', 'instructions']
        }
      },
      required: ['date', 'mealType', 'servings', 'recipe']
    }
  }
}];

// Conversational meal planning: each turn is grounded in the caller's family,
// pantry and recent meal history. The client sends only a short conversation
// window; the server independently verifies family access and loads private data.
router.post('/meal-chat', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.body.familyId, 10);
    const message = String(req.body.message || '').trim().slice(0, 1200);
    if (!Number.isInteger(familyId)) return res.status(400).json({ error: 'Choose a family before asking for meal ideas' });
    if (!message) return res.status(400).json({ error: 'Write what you need help deciding' });
    if (!recipeAiEnabled()) return res.status(503).json({ error: 'Meal chat needs a local Ollama model or a configured AI provider' });

    const [membership, family] = await Promise.all([
      prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId } } }),
      prisma.family.findUnique({ where: { id: familyId }, select: { id: true, name: true, creatorId: true } })
    ]);
    if (!membership || !family) return res.status(403).json({ error: 'Join this family to use its meal planner' });

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);
    const [inventory, members, recentMeals, recentRequests] = await Promise.all([
      prisma.inventory.findMany({ where: { userId: family.creatorId }, select: { ingredient: true, quantity: true } }),
      prisma.familyMember.findMany({ where: { familyId }, include: { user: { select: { name: true, role: true, allergies: true, dietaryPreferences: true, dislikes: true } } } }),
      prisma.weeklyMenu.findMany({ where: { familyId, date: { gte: fromDate } }, include: { recipe: { select: { name: true, ingredients: true } }, event: { select: { name: true, eventType: true } } }, orderBy: { date: 'desc' }, take: 60 }),
      prisma.mealRequest.findMany({ where: { familyId, createdAt: { gte: fromDate } }, include: { votes: { select: { selectedOption: true } } }, orderBy: { createdAt: 'desc' }, take: 30 })
    ]);
    const unpack = value => {
      if (Array.isArray(value)) return value.map(String);
      const raw = String(value || '').trim();
      if (!raw) return [];
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* plain text preference */ }
      return raw.split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
    };
    const familyNeeds = members.map(({ user }, index) => ({
      profile: `Member ${index + 1}`,
      allergies: unpack(user.allergies),
      preferences: unpack(user.dietaryPreferences),
      dislikes: unpack(user.dislikes)
    }));
    const allergies = familyNeeds.flatMap(member => member.allergies);
    const dislikes = familyNeeds.flatMap(member => member.dislikes);
    const preferences = familyNeeds.flatMap(member => member.preferences);
    const recentHistory = recentMeals.map(item => ({
      date: item.date.toISOString().slice(0, 10),
      meal: item.recipe?.name || 'Unknown meal',
      slot: item.mealType,
      status: item.status,
      occasion: item.event ? `${item.event.name} (${item.event.eventType})` : null
    }));
    const voteHistory = recentRequests.map(request => ({
      dish: request.mealName,
      requestedBy: `Member ${Math.max(0, members.findIndex(member => member.userId === request.userId)) + 1}`,
      status: request.status,
      votes: request.votes.map(vote => vote.selectedOption)
    }));
    const conversation = Array.isArray(req.body.history)
      ? req.body.history.slice(-12).map(turn => ({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: String(turn.content || '').slice(0, 1200),
        recipes: turn.role === 'assistant' && Array.isArray(turn.recipes) ? turn.recipes.map(name => String(name || '').slice(0, 100)).filter(Boolean).slice(0, 3) : []
      }))
      : [];
    conversation.push({ role: 'user', content: message, recipes: [] });
    const mealConstraints = extractChatFoodConstraints(conversation);
    const asksForDifferentMeal = /\b(different|another|something else|anything else|new idea|other idea)\b/i.test(message);
    const previouslySuggestedNames = new Set(conversation
      .filter(turn => turn.role === 'assistant')
      .flatMap(turn => turn.recipes || [])
      .map(normalizeRecipeName)
      .filter(Boolean));
    const requestedServings = Number.parseInt(req.body.servings, 10);
    const targetServings = Number.isInteger(requestedServings) ? Math.min(30, Math.max(1, requestedServings)) : members.length;
    const context = {
      date: localDateKey(new Date()),
      servings: targetServings,
      pantry: inventory.slice(0, 40).map(item => `${item.ingredient} (${item.quantity})`),
      familyNeeds,
      recentMeals: recentHistory.slice(0, 12),
      recentFamilyRequestsAndVotes: voteHistory.slice(0, 5),
      // Prior assistant recipes can anchor the model to a meal the family just
      // rejected. Keep the family's own requests as conversational context.
      conversation: conversation.slice(-8).map(({ role, content, recipes }) => ({ role, content: content.slice(0, 700), ...(Array.isArray(recipes) && recipes.length ? { suggestedRecipes: recipes } : {}) })),
      currentMealConstraints: {
        avoid: [...mealConstraints.avoided],
        include: [...mealConstraints.required],
        maxMinutes: mealConstraints.maxMinutes
      }
    };
    const priorAssistantIndex = conversation.slice(0, -1).findLastIndex(turn => turn.role === 'assistant');
    const previousUserBeforeAssistant = priorAssistantIndex >= 0
      ? conversation.slice(0, priorAssistantIndex).findLast(turn => turn.role === 'user')
      : null;
    const priorAssistantReply = priorAssistantIndex >= 0 ? conversation[priorAssistantIndex].content : '';
    const pendingMenuAdd = Boolean(previousUserBeforeAssistant
      && isExplicitMenuIntent(previousUserBeforeAssistant.content)
      && /exact day for the menu|choose breakfast, lunch, dinner|tell me the exact day/i.test(priorAssistantReply));
    const menuActionIntent = isExplicitMenuIntent(message) || pendingMenuAdd;
    const menuScheduleText = pendingMenuAdd ? `${previousUserBeforeAssistant.content} ${message}` : message;
    // A request such as "add this to today's lunch" already has a recipe card
    // in the chat. Save that exact recipe directly; asking the local model to
    // reconstruct it as a tool call can take minutes and loses the card data.
    if (menuActionIntent) {
      const schedule = parseMenuSchedule(menuScheduleText, context.date);
      const action = await addRecipeToFamilyMenu({
        userId: req.user.id,
        familyId,
        membership,
        family,
        args: {
          ...schedule,
          servings: targetServings,
          recipe: req.body.recipeToAdd
        },
        inventory,
        restrictions: [...allergies, ...dislikes],
        preferences
      });
      if (action.error) return res.json({ reply: action.error, recipes: [], historyUsed: recentHistory.length > 0, provider: 'direct-menu-action' });
      return res.json({
        reply: `Added ${action.recipe.name} to ${schedule.date} ${schedule.mealType}.`,
        recipes: [action.recipe],
        menuAction: { status: 'added', date: schedule.date, mealType: schedule.mealType, menuId: action.menuItem.id },
        historyUsed: recentHistory.length > 0,
        provider: 'direct-menu-action'
      });
    }
    const prompt = `/no_think You are FamilyPlate's warm, practical South Asian home-cooking conversation partner. Speak naturally in the same language/style as the last user turn (English, Urdu, Roman Urdu, or Hindi). You are helping a real household decide what to cook, not filling out a form.

Use this private household context only to help this family. Never reveal it outside the answer. Treat allergies as hard safety rules. Consider pantry quantities, family preferences/dislikes, recent dishes (avoid boring repetition), and votes. Read the user's mood and desired effort from the current turn. User corrections in the conversation always override earlier requests when they conflict. Treat currentMealConstraints as strict: never include an avoided ingredient, include every requested ingredient, and obey the total time limit. If the user says “no”, “not that”, “another”, “something else”, or asks for a different meal, identify the last assistant suggestion from the conversation and offer a genuinely different dish; do not repeat its name. Do not suggest a dish that depends on an ingredient they just said is unavailable. Prefer dishes that use at least 70% of listed pantry items and state exactly what is missing. Do not claim an ingredient is in the pantry unless the pantry list confirms it. Ask at most one short clarifying question only when the request cannot be answered safely; otherwise give one useful next suggestion.

For ordinary days, give practical desi home meals and prioritize available pantry ingredients. Respect a stated time limit; use total prep+cook time. If the user mentions rain/rainy weather, offer a cozy rainy-day meal and consider rainy-day dishes in the household's history. For dawat/guests, scale servings and suggest suitable hosting food. Offer one best idea and up to two brief alternatives in the conversational reply. Return one complete recipe object only, so the answer stays quick. When the user asks for full details, provide exact quantities for servings, prep/cook time, and clear numbered instructions. Do not invent precise nutrition: the app calculates an estimate separately. Do not claim the AI model has been fine-tuned; personalize from the supplied history. Never claim that a meal was saved unless the application confirms it through add_to_menu.

Return ONLY valid JSON: {"reply":"brief conversational answer, acknowledge the user's mood/constraints and explain the best fit plus brief alternatives","recipes":[{"name":"dish name","description":"why this fits","prepTime":"10 min","cookTime":"20 min","servings":"${targetServings}","category":"Lunch or Dinner","ingredients":[{"name":"ingredient","quantity":"amount"}],"instructions":["clear step"]}]}. Make the recipe for exactly ${targetServings} people. Provide zero recipes if first you must ask a clarifying question. Return one best recipe object. Never invent pantry availability. The recipe needs sensible quantities and at least 3 clear steps. Keep cooking time plausible. Do not output nutrition values.

${membership.role === 'maker' || family.creatorId === req.user.id ? 'This user is authorized as the family meal planner.' : 'This user is a family member, not the meal planner. They can get ideas or send them for review, but cannot add directly to the shared menu.'} If the current user explicitly asks to add/schedule a recipe, use the add_to_menu tool when it is available and the date, meal slot, and complete recipe are clear. Otherwise ask for the missing detail. Never say an item was added without a successful tool result.

HOUSEHOLD CONTEXT (JSON):\n${JSON.stringify(context)}\n\nCurrent user message: ${message}`;
    // Meal chat prefers the configured hosted Groq model when available: the
    // local 4B model can exceed a minute on this machine for a full recipe.
    // Keep Ollama as the configured fallback when no Groq key is present.
    const mealChatProvider = String(process.env.GROQ_API_KEY || '').trim() ? 'groq' : aiConfig()?.provider;
    let parsed;
    const fastPantryMatch = mealConstraints.avoided.size > 0
      || mealConstraints.required.size > 0
      || mealConstraints.maxMinutes !== null;
    try {
      const modelSystem = `You are the recipe-generating meal assistant for this household. Follow the latest user message first; use the conversation only to resolve references such as “that”, “another”, and “something else”. If the latest request changes an earlier preference, follow the latest request. Never put avoided foods or aliases in the recipe ingredients; include every requested food; obey the total prep plus cook time; and match the listed pantry. When a different meal is requested, do not repeat the previous suggestion. Return valid JSON only, with a natural brief reply and exactly one complete recipe for ${targetServings} people, including at least 3 ordered cooking steps. Current hard constraints: ${JSON.stringify(context.currentMealConstraints)}. Recent conversation: ${JSON.stringify(context.conversation)}. Pantry: ${JSON.stringify(context.pantry)}. Do not invent pantry availability.`;
      const modelText = mealChatProvider === 'groq'
        ? await generateGroqText(prompt, { json: true, system: modelSystem })
        : await generateAiText(prompt, {
          json: true,
          maxTokens: isFullRecipeIntent(message) ? 900 : 720,
          timeoutMs: 90000
        });
      parsed = parseAiJson(modelText);
      const generated = Array.isArray(parsed.recipes) ? parsed.recipes[0] : null;
      const generatedIngredients = Array.isArray(generated?.ingredients) ? generated.ingredients : [];
      const generatedText = generatedIngredients.map(item => `${item.name || ''} ${item.quantity || ''}`).join(' ');
      const generatedMinutes = Number.parseInt(generated?.prepTime, 10) + Number.parseInt(generated?.cookTime, 10);
      const generatedPantryCoverage = generatedIngredients.length
        ? generatedIngredients.filter(item => pantryHas(inventory, item.name)).length / generatedIngredients.length
        : 0;
      const repeatedSuggestion = asksForDifferentMeal && previouslySuggestedNames.has(normalizeRecipeName(generated?.name));
      const hasRequestedFoods = [...mealConstraints.required].every(food => generatedIngredients.some(item => pantryHas([{ ingredient: item.name }], food)));
      const timeIsValid = mealConstraints.maxMinutes === null
        || (Number.isFinite(generatedMinutes) && generatedMinutes <= mealConstraints.maxMinutes);
      const avoidsRestrictedFoods = !hasAvoidedIngredient(generatedText, [...allergies, ...dislikes, ...mealConstraints.avoided]);
      const invalidReasons = [
        !generated?.name && 'missing recipe name',
        generatedIngredients.length < 2 && 'too few ingredients',
        (!Array.isArray(generated?.instructions) || generated.instructions.filter(Boolean).length < 3) && 'too few cooking steps',
        !hasRequestedFoods && 'did not include a requested food',
        !timeIsValid && 'exceeded the requested time',
        !avoidsRestrictedFoods && 'included a food the user ruled out',
        repeatedSuggestion && 'repeated the previous suggestion after the user asked for a different meal',
        !isDietSafe(generatedText, preferences) && 'conflicted with family diet settings',
        generatedPantryCoverage < 0.6 && 'pantry match was below 60%'
      ].filter(Boolean);
      if (invalidReasons.length) throw new Error(`Model recipe rejected: ${invalidReasons.join(', ')}`);
    } catch (aiError) {
      console.warn(`Meal chat model unavailable or rejected: ${aiError.message}`);
      const previousMeals = new Set(recentHistory.filter(item => ['completed', 'cooked'].includes(String(item.status || '').toLowerCase())).map(item => normalizeRecipeName(item.meal)));
      if (asksForDifferentMeal) previouslySuggestedNames.forEach(name => previousMeals.add(name));
      for (const recipe of RECIPE_DATABASE) if (conversation.some(turn => turn.role === 'assistant' && String(turn.content || '').toLowerCase().includes(recipe.name.toLowerCase()))) previousMeals.add(normalizeRecipeName(recipe.name));
      const avoids = [...allergies, ...dislikes, ...mealConstraints.avoided];
      const candidates = RECIPE_DATABASE.filter(recipe => {
        const ingredientText = recipe.ingredients.map(item => item.name).join(' ');
        const covered = recipe.ingredients.filter(item => !isStaple(item.name) && pantryHas(inventory, item.name)).length;
        const missing = recipe.ingredients.filter(item => !isStaple(item.name) && !pantryHas(inventory, item.name)).length;
        const includesRequestedFoods = [...mealConstraints.required].every(food => recipe.ingredients.some(item => pantryHas([{ ingredient: item.name }], food)));
        const totalMinutes = Number.parseInt(recipe.prepTime, 10) + Number.parseInt(recipe.cookTime, 10);
        const timeOkay = mealConstraints.maxMinutes === null || (Number.isFinite(totalMinutes) && totalMinutes <= mealConstraints.maxMinutes);
        const dietSafe = isDietSafe(ingredientText, preferences);
        return covered > 0 && missing <= 3 && includesRequestedFoods && timeOkay && dietSafe && !hasAvoidedIngredient(`${ingredientText} ${recipe.allergens.join(' ')}`, avoids);
      }).sort((a, b) => {
        const aCoverage = pantryOverlap(inventory, a.ingredients);
        const bCoverage = pantryOverlap(inventory, b.ingredients);
        const aRecentPenalty = previousMeals.has(normalizeRecipeName(a.name)) ? 100 : 0;
        const bRecentPenalty = previousMeals.has(normalizeRecipeName(b.name)) ? 100 : 0;
        return (bCoverage - bRecentPenalty) - (aCoverage - aRecentPenalty);
      });
      // The small fallback library may not contain a fast dish that satisfies a
      // conversation's exact constraints. Build a simple pantry recipe for the
      // common "rice, quick, no chicken" request instead of returning an old
      // chicken suggestion or failing with no match.
      const wantsRice = [...mealConstraints.required].some(food => pantryHas([{ ingredient: food }], 'rice'));
      const riceInPantry = pantryHas(inventory, 'rice');
      const fallbackAvoids = [...allergies, ...dislikes, ...mealConstraints.avoided];
      const eggsOkay = pantryHas(inventory, 'eggs') && !hasAvoidedIngredient('Eggs', fallbackAvoids) && isDietSafe('eggs', preferences);
      const tomatoesOkay = pantryHas(inventory, 'tomatoes') && !hasAvoidedIngredient('Tomatoes', fallbackAvoids);
      const quickRiceFallback = riceInPantry
        && (wantsRice || (candidates.length === 0 && mealConstraints.maxMinutes !== null && mealConstraints.maxMinutes <= 30))
        ? (eggsOkay ? {
          id: 'quick-egg-fried-rice', name: 'Quick Egg Fried Rice',
          description: 'A quick, filling rice meal using pantry staples, without the ingredients you ruled out.',
          prepTime: '5 mins', cookTime: '20 mins', servings: '4', category: 'Dinner', allergens: ['Egg'], dietary: ['Vegetarian'],
          ingredients: [
            { name: 'Basmati Rice', quantity: '1½ cups' },
            { name: 'Eggs', quantity: '2' },
            { name: 'Onion', quantity: '1 small' },
            { name: 'Cooking Oil', quantity: '1 tbsp' },
            { name: 'Salt', quantity: '½ tsp' }
          ],
          instructions: ['Rinse the rice and cook it in water until tender; drain any excess water.', 'Finely chop the onion. Heat oil in a pan and cook the onion for 2–3 minutes.', 'Beat the eggs, add them to the pan, and scramble until fully cooked.', 'Add the cooked rice and salt. Stir-fry for 3–4 minutes, then serve hot.']
        } : tomatoesOkay ? {
          id: 'quick-tomato-rice', name: 'Quick Tomato Rice',
          description: 'A simple, quick rice meal built around the rice and tomatoes in your pantry.',
          prepTime: '5 mins', cookTime: '20 mins', servings: '4', category: 'Dinner', allergens: [], dietary: ['Vegan', 'Vegetarian'],
          ingredients: [
            { name: 'Basmati Rice', quantity: '1½ cups' },
            { name: 'Tomatoes', quantity: '2 medium' },
            { name: 'Onion', quantity: '1 small' },
            { name: 'Cooking Oil', quantity: '1 tbsp' },
            { name: 'Salt', quantity: '½ tsp' }
          ],
          instructions: ['Rinse the rice and cook it in water until tender; drain any excess water.', 'Chop the onion and tomatoes. Heat oil in a pan and cook the onion until soft.', 'Add tomatoes and salt, then cook for 5–7 minutes until soft.', 'Fold in the cooked rice and stir gently for 2–3 minutes before serving.']
        } : null)
        : null;
      const recipe = quickRiceFallback || candidates[0];
      if (!recipe) throw aiError;
      const baseServings = Number.parseInt(recipe.servings, 10) || 4;
      const factor = targetServings / baseServings;
      const ingredients = recipe.ingredients.map(item => ({
        name: item.name,
        quantity: scaleQuantity(item.quantity, factor),
        inPantry: pantryHas(inventory, item.name)
      }));
      const matchCount = ingredients.filter(item => item.inPantry).length;
      const alternatives = candidates.slice(1, 3).map(item => item.name);
      const choiceNotes = [
        mealConstraints.required.size ? `includes ${[...mealConstraints.required].join(' and ')}` : '',
        mealConstraints.avoided.size ? `without ${[...mealConstraints.avoided].map(food => food === 'lentil' ? 'daal' : food).join(', ')}` : '',
        mealConstraints.maxMinutes !== null ? `within ${mealConstraints.maxMinutes} minutes` : ''
      ].filter(Boolean).join(', ');
      const fallbackPhoto = await findRecipePhoto(recipe.name);
      return res.json({
        reply: fastPantryMatch
          ? `Got it${choiceNotes ? ` — ${choiceNotes}` : ''}. ${recipe.name} fits your pantry${alternatives.length ? `; another option is ${alternatives.join(' or ')}` : ''}.`
          : `I matched this idea to your pantry${alternatives.length ? ` and have ${alternatives.join(' or ')} as alternatives` : ''}.`,
        recipes: [{
          ...recipe,
          image: fallbackPhoto?.image || null,
          sourceUrl: fallbackPhoto?.sourceUrl || null,
          servings: String(targetServings),
          ingredients,
          pantryCoverage: Math.round(matchCount / ingredients.length * 100),
          missingIngredients: ingredients.filter(item => !item.inPantry).map(item => item.name),
          nutrition: estimateNutrition(ingredients, targetServings)
        }],
        historyUsed: recentHistory.length > 0,
        provider: 'pantry-library-fallback'
      });
    }
    const allergiesLower = allergies.map(value => value.toLowerCase());
    const restrictions = [...allergies, ...dislikes];
    const rawRecipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
    const recipes = rawRecipes.slice(0, 1).filter(recipe => {
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const text = ingredients.map(item => `${item.name || ''} ${item.quantity || ''}`).join(' ');
      const requiredFoodsPresent = [...mealConstraints.required].every(food => ingredients.some(item => pantryHas([{ ingredient: item.name }], food)));
      const suggestedMinutes = Number.parseInt(recipe.prepTime, 10) + Number.parseInt(recipe.cookTime, 10);
      const timeOkay = mealConstraints.maxMinutes === null || (Number.isFinite(suggestedMinutes) && suggestedMinutes <= mealConstraints.maxMinutes);
      return recipe.name && ingredients.length && requiredFoodsPresent && timeOkay && !hasAvoidedIngredient(text, [...restrictions, ...mealConstraints.avoided]) && isDietSafe(text, preferences);
    }).map(recipe => {
      const ingredients = recipe.ingredients.slice(0, 35).map(item => ({
        name: String(item.name || '').slice(0, 80),
        quantity: String(item.quantity || '').slice(0, 50),
        inPantry: pantryHas(inventory, item.name)
      })).filter(item => item.name);
      const matched = ingredients.filter(item => item.inPantry).length;
      return {
        ...recipe,
        name: String(recipe.name).slice(0, 100),
        prepTime: String(recipe.prepTime || 'Not specified').slice(0, 40),
        cookTime: String(recipe.cookTime || 'Not specified').slice(0, 40),
        servings: String(recipe.servings || members.length),
        ingredients,
        instructions: (Array.isArray(recipe.instructions) ? recipe.instructions : []).slice(0, 15).map(step => String(step).slice(0, 600)),
        pantryCoverage: ingredients.length ? Math.round(matched / ingredients.length * 100) : 0,
        missingIngredients: ingredients.filter(item => !item.inPantry).map(item => item.name),
        nutrition: estimateNutrition(ingredients, targetServings)
      };
    }).sort((a, b) => b.pantryCoverage - a.pantryCoverage);
    const pantryReadyRecipes = recipes.filter(recipe => recipe.pantryCoverage >= 70);
    const suggestedRecipes = pantryReadyRecipes.length ? pantryReadyRecipes : recipes.slice(0, 1);
    const recipesWithPhotos = await Promise.all(suggestedRecipes.map(async recipe => {
      const photo = await findRecipePhoto(recipe.name);
      return { ...recipe, image: photo?.image || null, sourceUrl: photo?.sourceUrl || null };
    }));
    res.json({ reply: String(parsed.reply || 'I have a meal idea for you.').slice(0, 2400), recipes: recipesWithPhotos, historyUsed: recentHistory.length > 0, provider: mealChatProvider || null });
  } catch (error) {
    console.error('Meal chat error:', error.message);
    res.status(502).json({ error: 'I could not get a meal-planning reply right now. Please try again in a moment.' });
  }
});

// Pre-built fallback recipe library for instant, high-quality suggestions matching kitchen inventory & allergies
const RECIPE_DATABASE = [
  {
    id: 101,
    name: "Chicken Karahi (Street Style)",
    description: "Tender chicken cooked with fresh tomatoes, ginger, green chilies, and aromatic spices in a traditional wok.",
    prepTime: "15 mins",
    cookTime: "30 mins",
    servings: "4",
    category: "Dinner",
    allergens: [],
    dietary: ["Halal", "Non-Veg", "High Protein", "Gluten-Free"],
    ingredients: [
      { name: "Chicken", quantity: "750g" },
      { name: "Tomatoes", quantity: "4 medium" },
      { name: "Ginger", quantity: "2 tbsp julienned" },
      { name: "Garlic", quantity: "1 tbsp minced" },
      { name: "Green Chilies", quantity: "3 pcs" },
      { name: "Cooking Oil", quantity: "3 tbsp" },
      { name: "Cumin / Spices", quantity: "1 tsp" }
    ],
    instructions: [
      "Heat oil in a karahi or heavy skillet, add chicken with garlic and salt, sauté until color changes.",
      "Add halved tomatoes, cover and simmer for 10 minutes until tomato skins soften.",
      "Remove tomato skins, mash tomatoes into the gravy, and cook on high flame until oil separates.",
      "Garnish with julienned ginger, chopped cilantro, and sliced green chilies. Serve hot with naan or roti."
    ]
  },
  {
    id: 102,
    name: "Classic Daal Chawal & Kachumber",
    description: "Comforting yellow lentil soup tempered with cumin and garlic, served with fluffy basmati rice and fresh salad.",
    prepTime: "10 mins",
    cookTime: "25 mins",
    servings: "4",
    category: "Lunch",
    allergens: [],
    dietary: ["Vegetarian", "Halal", "Gluten-Free"],
    ingredients: [
      { name: "Yellow Lentils / Moong Daal", quantity: "1 cup" },
      { name: "Basmati Rice", quantity: "2 cups" },
      { name: "Onion", quantity: "1 medium" },
      { name: "Garlic", quantity: "4 cloves" },
      { name: "Cumin Seeds", quantity: "1 tsp" },
      { name: "Tomatoes", quantity: "1 medium" },
      { name: "Turmeric / Salt", quantity: "1 tsp" }
    ],
    instructions: [
      "Boil soaked lentils with turmeric, salt, and water until soft and smooth.",
      "Cook basmati rice in lightly salted water until fluffy.",
      "Prepare the tadka: heat oil, add cumin seeds, sliced garlic, and dry chili until golden brown and fragrant.",
      "Pour tadka over hot daal and serve alongside fragrant steamed rice and diced salad."
    ]
  },
  {
    id: 103,
    name: "Creamy Garlic Herb Pasta",
    description: "Al dente pasta tossed in a rich garlic olive oil sauce with herbs and grated cheese.",
    prepTime: "10 mins",
    cookTime: "15 mins",
    servings: "3",
    category: "Dinner",
    allergens: ["Gluten", "Dairy"],
    dietary: ["Vegetarian"],
    ingredients: [
      { name: "Pasta / Penne", quantity: "300g" },
      { name: "Garlic", quantity: "5 cloves sliced" },
      { name: "Olive Oil / Butter", quantity: "3 tbsp" },
      { name: "Milk / Cream", quantity: "1/2 cup" },
      { name: "Parmesan / Cheese", quantity: "1/4 cup" },
      { name: "Black Pepper", quantity: "1/2 tsp" }
    ],
    instructions: [
      "Boil pasta in salted water until al dente; reserve 1/2 cup pasta water.",
      "In a skillet, gently sauté sliced garlic in olive oil or butter until light golden.",
      "Add cream or milk with pasta water, stir until emulsified.",
      "Toss in hot pasta and grated cheese until glossy and coated. Season with black pepper."
    ]
  },
  {
    id: 104,
    name: "Fragrant Vegetable Fried Rice",
    description: "Wok-tossed basmati rice with crunchy seasonal vegetables, soy sauce, and a hint of sesame.",
    prepTime: "15 mins",
    cookTime: "15 mins",
    servings: "4",
    category: "Lunch",
    allergens: ["Soy"],
    dietary: ["Vegetarian", "Vegan", "Halal"],
    ingredients: [
      { name: "Cooked Rice", quantity: "3 cups" },
      { name: "Carrots", quantity: "1 cup diced" },
      { name: "Peas", quantity: "1/2 cup" },
      { name: "Spring Onion / Green Onions", quantity: "3 stalks" },
      { name: "Eggs", quantity: "2 optional" },
      { name: "Soy Sauce", quantity: "2 tbsp" },
      { name: "Garlic", quantity: "3 cloves" }
    ],
    instructions: [
      "Heat oil in a wok over high flame, sauté minced garlic and chopped carrots for 2 minutes.",
      "Push veggies to one side, scramble eggs (if using) in the remaining space.",
      "Add cold cooked rice, peas, and green onions. Pour soy sauce evenly around the wok rim.",
      "Toss rapidly over high heat for 3-4 minutes until steaming and well mixed."
    ]
  },
  {
    id: 105,
    name: "Beef Qeema Matar (Minced Meat with Peas)",
    description: "Spiced ground beef slowly cooked with sweet green peas, onions, tomatoes, and whole garam masala.",
    prepTime: "15 mins",
    cookTime: "30 mins",
    servings: "4",
    category: "Dinner",
    allergens: [],
    dietary: ["Halal", "Non-Veg", "High Protein"],
    ingredients: [
      { name: "Ground Beef / Qeema", quantity: "500g" },
      { name: "Green Peas", quantity: "1 cup" },
      { name: "Onion", quantity: "2 sliced" },
      { name: "Tomatoes", quantity: "2 chopped" },
      { name: "Ginger Garlic Paste", quantity: "1 tbsp" },
      { name: "Spices / Garam Masala", quantity: "1 tbsp" }
    ],
    instructions: [
      "Brown onions in oil, add ginger-garlic paste and ground beef, sautéing until browned.",
      "Stir in chopped tomatoes and ground spices. Cover and simmer on low heat for 15 minutes.",
      "Add sweet green peas and 1/4 cup water, cook until peas are tender.",
      "Garnish with chopped green chilies and fresh coriander. Serve with roti or paratha."
    ]
  },
  {
    id: 106,
    name: "Chicken Biryani for a Celebration",
    description: "A fragrant family-style biryani with spiced chicken, basmati rice, mint and warm whole spices.",
    prepTime: "25 mins", cookTime: "55 mins", servings: "6", category: "Celebration",
    allergens: [], dietary: ["Halal", "Family style"],
    ingredients: [
      { name: "Chicken", quantity: "1 kg" }, { name: "Basmati Rice", quantity: "3 cups" },
      { name: "Onions", quantity: "3 large" }, { name: "Yogurt", quantity: "1 cup" },
      { name: "Tomatoes", quantity: "3 medium" }, { name: "Biryani Spices", quantity: "3 tbsp" },
      { name: "Mint and Coriander", quantity: "1 cup" }, { name: "Cooking Oil", quantity: "1/2 cup" }
    ],
    instructions: ["Rinse and soak rice while onions brown in oil until golden.", "Add chicken, tomatoes, yogurt and biryani spices; cook until the chicken is nearly tender.", "Boil rice until just tender, then layer it over the chicken with mint and coriander.", "Cover tightly and steam on low heat for 20 minutes. Rest briefly, then gently mix and serve."]
  },
  {
    id: 107,
    name: "Birthday Chicken Pulao",
    description: "A mild, aromatic chicken and rice centerpiece that is easy to serve to a family gathering.",
    prepTime: "20 mins", cookTime: "45 mins", servings: "6", category: "Celebration",
    allergens: [], dietary: ["Halal", "Family style"],
    ingredients: [
      { name: "Chicken", quantity: "1 kg" }, { name: "Basmati Rice", quantity: "3 cups" },
      { name: "Onions", quantity: "2 large" }, { name: "Ginger Garlic Paste", quantity: "2 tbsp" },
      { name: "Whole Pulao Spices", quantity: "2 tbsp" }, { name: "Yogurt", quantity: "1/2 cup" },
      { name: "Cooking Oil", quantity: "1/3 cup" }
    ],
    instructions: ["Brown sliced onions in oil, then add ginger garlic and whole spices.", "Add chicken and yogurt and cook until fragrant and lightly browned.", "Add soaked rice and enough water or stock for the rice to cook; season to taste.", "Cover and cook on low until rice is fluffy and chicken is tender. Rest 10 minutes before serving."]
  },
  {
    id: 108,
    name: "Eid Sheer Khurma",
    description: "A festive vermicelli pudding gently simmered with milk, dates, cardamom and nuts.",
    prepTime: "10 mins", cookTime: "25 mins", servings: "6", category: "Dessert",
    allergens: ["Dairy", "Nuts"], dietary: ["Halal", "Eid favorite"],
    ingredients: [
      { name: "Milk", quantity: "1.5 litres" }, { name: "Vermicelli", quantity: "1 cup" },
      { name: "Dates", quantity: "10 chopped" }, { name: "Sugar", quantity: "1/3 cup" },
      { name: "Ghee", quantity: "2 tbsp" }, { name: "Cardamom", quantity: "4 pods" },
      { name: "Mixed Nuts", quantity: "1/2 cup" }
    ],
    instructions: ["Warm ghee and lightly toast vermicelli and cardamom.", "Pour in milk and simmer gently, stirring often, until the vermicelli softens.", "Add dates and sugar, then cook until creamy.", "Finish with chopped nuts and serve warm or chilled."]
  },
  {
    id: 109, name: "Aloo Gobi", description: "Potatoes and cauliflower cooked with ginger, tomato and everyday spices.",
    prepTime: "15 mins", cookTime: "30 mins", servings: "4", category: "Dinner", allergens: [], dietary: ["Vegetarian", "Vegan", "Halal"],
    ingredients: [{ name: "Potatoes", quantity: "500g" }, { name: "Cauliflower", quantity: "1 medium" }, { name: "Onion", quantity: "1 medium" }, { name: "Tomatoes", quantity: "2 medium" }, { name: "Ginger", quantity: "1 tbsp" }, { name: "Turmeric", quantity: "1 tsp" }, { name: "Ground Coriander", quantity: "1 tsp" }, { name: "Cooking Oil", quantity: "2 tbsp" }],
    instructions: ["Cut potatoes and cauliflower into bite-size pieces.", "Soften onion in oil, then add ginger and spices.", "Add tomato, potatoes and cauliflower with a splash of water.", "Cover and cook until tender, stirring occasionally. Serve with roti or rice."]
  },
  {
    id: 110, name: "Chana Masala", description: "Chickpeas simmered in a tangy tomato and onion masala.",
    prepTime: "10 mins", cookTime: "30 mins", servings: "4", category: "Lunch", allergens: [], dietary: ["Vegetarian", "Vegan", "Halal", "Gluten-Free"],
    ingredients: [{ name: "Chickpeas", quantity: "2 cups cooked" }, { name: "Onion", quantity: "1 medium" }, { name: "Tomatoes", quantity: "2 medium" }, { name: "Garlic", quantity: "3 cloves" }, { name: "Cumin Seeds", quantity: "1 tsp" }, { name: "Ground Coriander", quantity: "1 tsp" }, { name: "Red Chili Powder", quantity: "1/2 tsp" }, { name: "Lemon", quantity: "1" }],
    instructions: ["Fry cumin and chopped onion until soft.", "Add garlic, tomatoes and ground spices; cook to a thick masala.", "Stir in cooked chickpeas and a little water; simmer for 15 minutes.", "Finish with lemon and coriander. Serve with rice or roti."]
  },
  {
    id: 111, name: "Masoor Daal", description: "A quick red lentil daal finished with a cumin and garlic tempering.",
    prepTime: "5 mins", cookTime: "25 mins", servings: "4", category: "Lunch", allergens: [], dietary: ["Vegetarian", "Vegan", "Halal", "Gluten-Free"],
    ingredients: [{ name: "Red Lentils / Masoor Daal", quantity: "1 cup" }, { name: "Onion", quantity: "1 small" }, { name: "Tomatoes", quantity: "1 medium" }, { name: "Garlic", quantity: "3 cloves" }, { name: "Cumin Seeds", quantity: "1 tsp" }, { name: "Turmeric", quantity: "1/2 tsp" }, { name: "Cooking Oil", quantity: "1 tbsp" }],
    instructions: ["Rinse lentils and simmer with turmeric until soft.", "Cook onion and tomato with a little salt until pulpy.", "Add the tomato mixture to the lentils and simmer briefly.", "Sizzle cumin and garlic in oil and pour over the daal. Serve with rice."]
  },
  {
    id: 112, name: "Anda Masala", description: "Boiled eggs served in a warmly spiced onion and tomato gravy.",
    prepTime: "10 mins", cookTime: "25 mins", servings: "4", category: "Dinner", allergens: ["Egg"], dietary: ["Halal", "High Protein"],
    ingredients: [{ name: "Eggs", quantity: "6" }, { name: "Onion", quantity: "1 medium" }, { name: "Tomatoes", quantity: "2 medium" }, { name: "Garlic", quantity: "2 cloves" }, { name: "Ginger", quantity: "1 tsp" }, { name: "Garam Masala", quantity: "1 tsp" }, { name: "Cooking Oil", quantity: "2 tbsp" }],
    instructions: ["Boil, peel and halve the eggs.", "Cook onion in oil until golden; add ginger, garlic and spices.", "Add tomatoes and cook until they form a thick sauce.", "Add eggs and simmer gently for five minutes. Serve with roti."]
  },
  {
    id: 113, name: "Bhindi Masala", description: "Okra cooked with onion, tomato and fragrant spices.",
    prepTime: "15 mins", cookTime: "25 mins", servings: "4", category: "Dinner", allergens: [], dietary: ["Vegetarian", "Vegan", "Halal", "Gluten-Free"],
    ingredients: [{ name: "Okra / Bhindi", quantity: "500g" }, { name: "Onion", quantity: "1 medium" }, { name: "Tomatoes", quantity: "2 medium" }, { name: "Cumin Seeds", quantity: "1 tsp" }, { name: "Ground Coriander", quantity: "1 tsp" }, { name: "Turmeric", quantity: "1/2 tsp" }, { name: "Cooking Oil", quantity: "2 tbsp" }],
    instructions: ["Wash and dry okra well, then slice it.", "Shallow-fry okra until lightly browned and set aside.", "Cook cumin, onion, tomato and spices until soft.", "Return okra to the pan and cook uncovered until tender."]
  },
  {
    id: 114, name: "Aloo Keema", description: "Minced beef and potatoes cooked in a simple tomato masala.",
    prepTime: "15 mins", cookTime: "35 mins", servings: "4", category: "Dinner", allergens: [], dietary: ["Halal", "High Protein"],
    ingredients: [{ name: "Beef Mince / Qeema", quantity: "500g" }, { name: "Potatoes", quantity: "2 medium" }, { name: "Onion", quantity: "1 medium" }, { name: "Tomatoes", quantity: "2 medium" }, { name: "Ginger Garlic Paste", quantity: "1 tbsp" }, { name: "Red Chili Powder", quantity: "1/2 tsp" }, { name: "Ground Coriander", quantity: "1 tsp" }],
    instructions: ["Brown onion in oil and stir in ginger garlic paste.", "Add mince and spices; cook until the meat changes color.", "Add tomatoes, potatoes and a little water.", "Cover and simmer until potatoes are tender and the gravy thickens."]
  },
  {
    id: 115, name: "Palak Paneer", description: "Paneer cubes in a gently spiced spinach sauce.",
    prepTime: "15 mins", cookTime: "25 mins", servings: "4", category: "Dinner", allergens: ["Dairy"], dietary: ["Vegetarian", "Halal"],
    ingredients: [{ name: "Spinach / Palak", quantity: "500g" }, { name: "Paneer", quantity: "300g" }, { name: "Onion", quantity: "1 small" }, { name: "Tomatoes", quantity: "1 medium" }, { name: "Garlic", quantity: "2 cloves" }, { name: "Garam Masala", quantity: "1/2 tsp" }, { name: "Cream", quantity: "2 tbsp" }],
    instructions: ["Wilt spinach, cool it and blend to a coarse puree.", "Cook onion, garlic and tomato with spices until soft.", "Add spinach and simmer gently; stir in paneer cubes.", "Finish with cream and serve with roti or rice."]
  },
  {
    id: 116, name: "Vegetable Pulao", description: "Mild basmati rice cooked with mixed vegetables and whole spices.",
    prepTime: "15 mins", cookTime: "30 mins", servings: "4", category: "Lunch", allergens: [], dietary: ["Vegetarian", "Vegan", "Halal"],
    ingredients: [{ name: "Basmati Rice", quantity: "2 cups" }, { name: "Carrots", quantity: "1 medium" }, { name: "Green Peas", quantity: "1/2 cup" }, { name: "Onion", quantity: "1 medium" }, { name: "Cumin Seeds", quantity: "1 tsp" }, { name: "Bay Leaf", quantity: "1" }, { name: "Cooking Oil", quantity: "2 tbsp" }],
    instructions: ["Rinse and soak rice for 15 minutes.", "Fry cumin and bay leaf, then soften sliced onion.", "Add vegetables and drained rice; stir gently.", "Add water and salt, cover and cook on low until rice is fluffy."]
  },
  {
    id: 117, name: "Aloo Palak", description: "Potatoes and spinach cooked together with garlic and everyday spices.",
    prepTime: "10 mins", cookTime: "30 mins", servings: "4", category: "Dinner", allergens: [], dietary: ["Vegetarian", "Vegan", "Halal", "Gluten-Free"],
    ingredients: [{ name: "Potatoes", quantity: "400g" }, { name: "Spinach / Palak", quantity: "300g" }, { name: "Onion", quantity: "1 medium" }, { name: "Garlic", quantity: "3 cloves" }, { name: "Tomatoes", quantity: "1 medium" }, { name: "Cumin Seeds", quantity: "1 tsp" }, { name: "Turmeric", quantity: "1/2 tsp" }],
    instructions: ["Cook cumin and onion in oil until soft.", "Add garlic, tomato and turmeric and cook down.", "Add diced potatoes and a splash of water; cover until nearly tender.", "Fold in spinach and cook until wilted and potatoes are soft."]
  },
  {
    id: 118, name: "Chicken Aloo Curry", description: "A homestyle chicken curry with potatoes, tomato and ginger garlic.",
    prepTime: "15 mins", cookTime: "40 mins", servings: "4", category: "Dinner", allergens: [], dietary: ["Halal", "High Protein"],
    ingredients: [{ name: "Chicken", quantity: "700g" }, { name: "Potatoes", quantity: "2 medium" }, { name: "Onion", quantity: "1 medium" }, { name: "Tomatoes", quantity: "2 medium" }, { name: "Ginger Garlic Paste", quantity: "1 tbsp" }, { name: "Ground Coriander", quantity: "1 tsp" }, { name: "Turmeric", quantity: "1/2 tsp" }],
    instructions: ["Brown onion in oil and add ginger garlic paste.", "Add chicken and spices and cook until lightly browned.", "Add tomatoes and potatoes with water to make gravy.", "Cover and simmer until chicken and potatoes are cooked through."]
  }
];

// Common smart culinary substitutes
const INGREDIENT_SUBSTITUTES = {
  "heavy cream": "Mix 3/4 cup Whole Milk + 1/4 cup Melted Butter, or use Thick Greek Yogurt / Malai",
  "cream": "Mix 3/4 cup Milk + 1/4 cup Melted Butter, or Greek Yogurt",
  "buttermilk": "1 cup Milk + 1 tbsp White Vinegar or Lemon Juice (let stand 5 mins)",
  "sour cream": "Equal amount of Plain Greek Yogurt or Hung Curd",
  "garam masala": "Blend 1/2 tsp Cumin + 1/2 tsp Coriander + pinch of Cinnamon, Cloves and Cardamom",
  "soy sauce": "Tamari (Gluten-Free) OR Worcestershire Sauce + pinch of salt",
  "tomato paste": "Simmer 3 tbsp Tomato Puree or mashed fresh tomatoes until thick",
  "eggs": "1/4 cup Applesauce OR 1 tbsp Ground Flaxseed mixed with 3 tbsp Water per egg",
  "butter": "Equal amount of Olive Oil, Coconut Oil, or Ghee",
  "parmesan cheese": "Nutritional Yeast OR sharp cheddar cheese",
  "mayonnaise": "Plain Greek Yogurt seasoned with salt, lemon juice, and a drop of mustard",
  "chicken broth": "1 cup hot water + 1/2 bouillon cube OR vegetable broth",
  "breadcrumbs": "Crushed cornflakes, rolled oats, or cracker crumbs",
  "cornstarch": "2 tbsp All-Purpose Flour per 1 tbsp Cornstarch",
  "lemon juice": "Equal parts White Vinegar or Apple Cider Vinegar"
};
const ESTIMATED_NUTRITION = {
  101: { calories: 390, proteinG: 38, carbsG: 12, fatG: 21, fiberG: 3 },
  102: { calories: 430, proteinG: 17, carbsG: 72, fatG: 9, fiberG: 11 },
  103: { calories: 510, proteinG: 19, carbsG: 58, fatG: 23, fiberG: 4 },
  104: { calories: 360, proteinG: 10, carbsG: 59, fatG: 10, fiberG: 6 },
  105: { calories: 460, proteinG: 31, carbsG: 22, fatG: 27, fiberG: 5 }
  ,106: { calories: 520, proteinG: 29, carbsG: 62, fatG: 18, fiberG: 3 },
  107: { calories: 490, proteinG: 28, carbsG: 60, fatG: 15, fiberG: 2 },
  108: { calories: 310, proteinG: 9, carbsG: 46, fatG: 11, fiberG: 2 }
};
const ALLERGEN_GROUPS = [
  ['peanut', 'groundnut', 'arachis'],
  ['milk', 'dairy', 'casein', 'whey', 'ghee', 'butter', 'cream', 'cheese', 'yogurt', 'yoghurt'],
  ['egg', 'eggs'],
  ['wheat', 'gluten', 'barley', 'rye', 'semolina', 'sooji', 'suji', 'atta', 'maida'],
  ['tree nut', 'nuts', 'almond', 'cashew', 'walnut', 'pistachio', 'pecan', 'hazelnut'],
  ['shellfish', 'prawn', 'shrimp', 'crab', 'lobster'],
  ['fish', 'salmon', 'tuna', 'anchovy'],
  ['soy', 'soya', 'soybean'],
  ['sesame', 'tahini', 'til']
];
const FOOD_AVOIDANCE_GROUPS = [
  ['seafood', 'fish', 'shellfish', 'prawn', 'shrimp', 'crab', 'lobster', 'squid', 'octopus'],
  ['bitter gourd', 'bitter melon', 'karela'], ['okra', 'lady finger', 'bhindi'],
  ['eggplant', 'aubergine', 'brinjal'], ['mushroom', 'mushrooms', 'champignon']
];
const singular = word => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
const hasAvoidedIngredient = (text, terms) => {
  const normalizeFoodWords = value => String(value || '').toLowerCase()
    .replace(/\bchilli(?:es)?\b/g, 'chili')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const searchableText = normalizeFoodWords(text);
  const searchable = ` ${searchableText} `;
  const searchableWords = searchableText.split(/\s+/).map(singular);
  return terms.some(term => {
    const normalized = normalizeFoodWords(String(term || '').replace(/\b(i dislike|i don't like|do not like|avoid|allergic to|allergy to|no)\b/gi, ' '));
    if (!normalized) return false;
    const words = normalized.split(/\s+/).map(singular);
    const group = [...ALLERGEN_GROUPS, ...FOOD_AVOIDANCE_GROUPS].find(aliases => aliases.some(alias =>
      alias.split(/\s+/).map(singular).every(word => words.includes(word))
    ));
    const phrases = group || [normalized];
    return phrases.some(alias => {
      const phrase = normalizeFoodWords(alias);
      if (!phrase) return false;
      if (phrase.includes(' ')) return searchable.includes(` ${phrase} `);
      return searchableWords.includes(singular(phrase));
    });
  });
};
const isDietSafe = (text, preferences) => {
  const ingredients = String(text || '').toLowerCase();
  const tags = (preferences || []).map(item => String(item).toLowerCase());
  const vegetarian = tags.some(tag => /vegetarian|vegan/.test(tag));
  const vegan = tags.some(tag => /vegan/.test(tag));
  const halal = tags.some(tag => /halal/.test(tag));
  if (vegetarian && /chicken|beef|mutton|lamb|pork|bacon|sausage|fish|salmon|tuna|prawn|shrimp|gelatin/.test(ingredients)) return false;
  if (vegan && /milk|dairy|cheese|butter|cream|egg|honey|yogurt|yoghurt|ghee|paneer/.test(ingredients)) return false;
  if (halal && /pork|bacon|ham|wine|beer|alcohol|gelatin/.test(ingredients)) return false;
  if (tags.some(tag => /dairy.free|lactose.free/.test(tag)) && hasAvoidedIngredient(ingredients, ['dairy'])) return false;
  if (tags.some(tag => /gluten.free/.test(tag)) && hasAvoidedIngredient(ingredients, ['gluten'])) return false;
  return true;
};
const getFavoriteTerms = preferences => preferences.flatMap(item => {
  const match = String(item).match(/favorite foods:\s*(.*)/i);
  return match ? match[1].split(/[,;]/).map(value => value.trim().toLowerCase()).filter(Boolean) : [];
});
const favoriteScore = (recipe, favoriteTerms = []) => {
  const text = `${recipe.name} ${recipe.description || ''} ${(recipe.ingredients || []).map(item => item.name).join(' ')}`.toLowerCase();
  return favoriteTerms.reduce((score, term) => score + (text.includes(term) ? 2 : 0), 0);
};
const normalizeRecipeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeRecipePhotoName = value => normalizeRecipeName(value)
  .split(/\s+/)
  .filter(word => !['recipe', 'quick', 'easy', 'simple', 'classic', 'family', 'style', 'homemade', 'traditional', 'authentic', 'for', 'with', 'a', 'the', 'celebration', 'everyday', 'meal', 'dish', 'mild', 'spicy', 'desi', 'special', 'best', 'delicious'].includes(word))
  .map(word => ({ pilau: 'pulao', pilaf: 'pulao', pulao: 'pulao', eggs: 'egg', tomatoes: 'tomato', onions: 'onion' }[word] || word))
  .sort()
  .join(' ');
const findMealDbPhoto = async name => {
  try {
    const coreName = normalizeRecipePhotoName(name);
    const query = String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
      .filter(word => !['recipe', 'quick', 'easy', 'simple', 'classic', 'family', 'style', 'homemade', 'traditional', 'authentic', 'for', 'with', 'a', 'the', 'celebration', 'everyday', 'meal', 'dish', 'mild', 'spicy', 'desi', 'special', 'best', 'delicious'].includes(word)).join(' ');
    for (const search of [...new Set([query, String(name || '').trim()].filter(Boolean))]) {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(search)}`, { signal: AbortSignal.timeout(3500) });
      if (!response.ok) continue;
      const meal = (await response.json()).meals?.find(item => item.strMealThumb && normalizeRecipePhotoName(item.strMeal) === coreName);
      if (meal?.strMealThumb) return { image: meal.strMealThumb, sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`, matchedName: meal.strMeal, photoSource: 'TheMealDB' };
    }
    return null;
  } catch { return null; }
};

const findCommonsRecipePhoto = async name => {
  try {
    const ignored = new Set(['recipe', 'quick', 'easy', 'simple', 'classic', 'family', 'style', 'homemade', 'traditional', 'authentic', 'for', 'with', 'a', 'the', 'celebration', 'everyday', 'meal', 'dish', 'mild', 'spicy', 'desi', 'special', 'best', 'delicious', 'and', 'of']);
    const normalize = value => normalizeRecipeName(value).split(/\s+/).filter(Boolean)
      .filter(word => !ignored.has(word))
      .map(word => ({ pilau: 'pulao', pilaf: 'pulao', qeema: 'keema', daal: 'dal', lentils: 'lentil', eggs: 'egg', tomatoes: 'tomato', onions: 'onion' }[word] || word));
    const terms = [...new Set(normalize(name))];
    if (!terms.length) return null;
    const base = 'https://commons.wikimedia.org/w/api.php';
    const search = new URLSearchParams({
      action: 'query', format: 'json', origin: '*', list: 'search', srnamespace: '6',
      srsearch: `"${terms.join(' ')}"`, srlimit: '10'
    });
    const searchResponse = await fetch(`${base}?${search}`, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'FamilyPlate/1.0 (recipe photo search)' } });
    if (!searchResponse.ok) return null;
    const pages = (await searchResponse.json()).query?.search || [];
    const candidates = pages.map(page => {
      const titleTerms = new Set(normalize(page.title));
      const matched = terms.filter(term => titleTerms.has(term)).length;
      return { ...page, score: matched / terms.length, matched };
    }).filter(page => page.matched >= Math.min(terms.length, 2) && page.score >= 0.5)
      .sort((a, b) => b.score - a.score || b.matched - a.matched).slice(0, 5);
    if (!candidates.length) return null;
    const imageInfo = new URLSearchParams({
      action: 'query', format: 'json', origin: '*', prop: 'imageinfo',
      titles: candidates.map(page => page.title).join('|'), iiprop: 'url|mime|size|extmetadata', iiurlwidth: '960'
    });
    const imageResponse = await fetch(`${base}?${imageInfo}`, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'FamilyPlate/1.0 (recipe photo search)' } });
    if (!imageResponse.ok) return null;
    const imagePages = Object.values((await imageResponse.json()).query?.pages || {});
    for (const candidate of candidates) {
      const page = imagePages.find(item => item.title === candidate.title);
      const info = page?.imageinfo?.[0];
      const image = info?.thumburl || info?.url;
      if (image && /^https:\/\//i.test(image) && /^image\/(jpeg|png|webp)/i.test(info.mime || '')) {
        return {
          image,
          sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
          matchedName: page.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
          photoSource: 'Wikimedia Commons'
        };
      }
    }
    return null;
  } catch { return null; }
};
const openversePhotoCache = new Map();
const findOpenverseRecipePhoto = async name => {
  try {
    const words = normalizeRecipePhotoName(name).split(/\s+/).filter(Boolean);
    const proteins = words.filter(word => ['chicken', 'beef', 'mutton', 'lamb', 'fish', 'egg', 'paneer', 'tofu'].includes(word));
    const dishTypes = words.filter(word => ['rice', 'pulao', 'dal', 'keema', 'curry', 'roti', 'bread', 'biryani', 'pasta', 'soup', 'salad', 'cake', 'pancake', 'paratha'].includes(word));
    const core = [...new Set([...proteins, ...dishTypes])];
    const queries = [...new Set([String(name || '').trim(), core.join(' ')].filter(Boolean))];
    for (const query of queries) {
      const cached = openversePhotoCache.get(query.toLowerCase());
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.photo) return cached.photo;
        continue;
      }
      const params = new URLSearchParams({ q: query, category: 'photograph', mature: 'false', page_size: '20' });
      const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, { signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'FamilyPlate/1.0 (recipe photo search)' } });
      if (!response.ok) continue;
      const results = (await response.json()).results || [];
      const normalizeWords = value => normalizeRecipePhotoName(value).split(/\s+/).filter(Boolean);
      const match = results.find(item => {
        const titleAndTags = new Set(normalizeWords(`${item.title || ''} ${(item.tags || []).map(tag => tag.name).join(' ')}`));
        const coreMatches = core.filter(word => titleAndTags.has(word)).length;
        const hasMealSignal = /food|meal|dish|recipe|cuisine|cooking/i.test(`${item.title || ''} ${(item.tags || []).map(tag => tag.name).join(' ')}`);
        return core.length >= 2 ? coreMatches === core.length : (coreMatches >= 1 && hasMealSignal);
      });
      const image = match?.thumbnail || match?.url;
      if (image && /^https:\/\//i.test(image) && (/\.(jpe?g|png|webp)(?:\?|$)/i.test(image) || /api\.openverse\.org\/v1\/images\/[^/]+\/thumb\/?$/i.test(image))) {
        const photo = {
          image,
          sourceUrl: match.foreign_landing_url || match.detail_url || 'https://openverse.org/',
          matchedName: match.title || name,
          photoSource: 'Openverse',
          photoAttribution: match.attribution || `${match.title || 'Photo'} by ${match.creator || 'unknown creator'} · ${match.license || 'license details'}`,
          photoLicenseUrl: match.license_url || null
        };
        openversePhotoCache.set(query.toLowerCase(), { photo, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
        return photo;
      }
      openversePhotoCache.set(query.toLowerCase(), { photo: null, expiresAt: Date.now() + 10 * 60 * 1000 });
    }
    return null;
  } catch { return null; }
};
const findRecipePhoto = async name => {
  const [mealDb, openverse, commons] = await Promise.all([findMealDbPhoto(name), findOpenverseRecipePhoto(name), findCommonsRecipePhoto(name)]);
  return mealDb || openverse || commons;
};
const fetchMealDbRecipes = async ({ ingredients, occasion, targetServings, avoidList, preferences, excludedNames = [] }) => {
  const baseUrl = 'https://www.themealdb.com/api/json/v1/1';
  const everyday = !occasion || occasion === 'everyday';
  const favoriteTerms = getFavoriteTerms(preferences);
  const occasionTerms = {
    eid: ['biryani', 'korma', 'kheer'], birthday: ['biryani', 'pilau', 'cake'], dawat: ['biryani', 'korma', 'curry']
  };
  const ingredientAliases = [
    ['chicken', 'chicken_breast'], ['rice', 'rice'], ['beef', 'beef'], ['mutton', 'lamb'], ['lamb', 'lamb'],
    ['potato', 'potato'], ['onion', 'onion'], ['lentil', 'lentils'], ['paneer', 'paneer'], ['fish', 'fish'],
    ['tomato', 'tomato'], ['egg', 'egg'], ['milk', 'milk'], ['carrot', 'carrot'], ['pea', 'peas'], ['chickpea', 'chickpeas']
  ];
  const inventoryFilters = ingredientAliases
    .filter(([term]) => !isStaple(term) && ingredients.some(item => pantryHas([item], term)))
    .map(([, filter]) => filter).slice(0, 4);
  const lookups = occasionTerms[occasion]
    ? occasionTerms[occasion].map(term => `${baseUrl}/search.php?s=${encodeURIComponent(term)}`)
    : inventoryFilters.map(term => `${baseUrl}/filter.php?i=${encodeURIComponent(term)}`);
  if (everyday && inventoryFilters.length === 0) return [];
  const getJson = async url => {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(5000) }); return response.ok ? await response.json() : null; }
    catch { return null; }
  };
  const lists = await Promise.all(lookups.map(getJson));
  const candidateMap = new Map();
  for (const list of lists) for (const meal of list?.meals || []) if (meal.idMeal) candidateMap.set(meal.idMeal, meal);
  const candidateMeals = [...candidateMap.values()]
    .sort((a, b) => {
      const regionalScore = meal => (/indian|bangladesh|pakistan|bengal/i.test(`${meal.strArea || ''} ${meal.strMeal || ''}`) ? 4 : 0)
        + (/biryani|pulao|pilau|korma|karahi|masala|daal|dal|roti|naan|curry|kebab/i.test(meal.strMeal || '') ? 2 : 0);
      return regionalScore(b) - regionalScore(a);
    }).slice(0, 20);
  const details = await Promise.all(candidateMeals.map(meal => getJson(`${baseUrl}/lookup.php?i=${meal.idMeal}`)));
  const vegetarianOnly = preferences.some(item => /vegetarian|vegan/i.test(String(item)));
  const veganOnly = preferences.some(item => /vegan/i.test(String(item)));
  const rankedRecipes = details.flatMap(result => (result?.meals || []).map(meal => {
    const recipeIngredients = Array.from({ length: 20 }, (_, index) => {
      const name = String(meal[`strIngredient${index + 1}`] || '').trim();
      const quantity = String(meal[`strMeasure${index + 1}`] || '').trim();
      return name ? { name, quantity: scaleQuantity(quantity || 'to taste', targetServings / 4) } : null;
    }).filter(Boolean);
    const ingredientText = recipeIngredients.map(item => item.name.toLowerCase()).join(' ');
    if (hasAvoidedIngredient(ingredientText, avoidList) || !isDietSafe(ingredientText, preferences)) return [];
    const inPantryCount = pantryOverlap(ingredients, recipeIngredients);
    const nonStaplePantryMatch = recipeIngredients.some(item => !isStaple(item.name) && pantryHas(ingredients, item.name));
    const missingNonStaples = recipeIngredients.filter(item => !isStaple(item.name) && !pantryHas(ingredients, item.name)).length;
    const nutrition = estimateNutrition(recipeIngredients, targetServings);
    if (everyday && (!nonStaplePantryMatch || missingNonStaples > 3 || !nutrition)) return [];
    return [{
      id: `mealdb-${meal.idMeal}`, mealDbId: meal.idMeal, source: 'TheMealDB', sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      name: meal.strMeal, description: `${meal.strArea || 'Family'} style ${meal.strCategory || 'meal'} recipe`,
      prepTime: 'See steps', cookTime: 'See steps', servings: String(targetServings), category: occasion ? occasion[0].toUpperCase() + occasion.slice(1) : meal.strCategory,
      image: meal.strMealThumb, nutrition, matchPercentage: Math.round((inPantryCount / Math.max(1, recipeIngredients.length)) * 100),
      ingredients: recipeIngredients.map(item => ({ ...item, inPantry: pantryHas(ingredients, item.name), substitute: null })),
      instructions: String(meal.strInstructions || '').split(/\r?\n+/).map(step => step.trim()).filter(Boolean)
    }];
  })).flat();
  return rankedRecipes
    .filter(recipe => !excludedNames.has(normalizeRecipeName(recipe.name)))
    .sort((a, b) => (b.matchPercentage + favoriteScore(b, favoriteTerms) * 5) - (a.matchPercentage + favoriteScore(a, favoriteTerms) * 5))
    .slice(0, 3);
};
const scaleQuantity = (quantity, factor) => {
  const match = String(quantity || '').match(/^\s*(\d+\s*\/\s*\d+|\d+(?:\.\d+)?|½|¼|¾)(.*)$/);
  if (!match || factor === 1) return quantity;
  const values = { '3/4': 0.75, '1/2': 0.5, '1/4': 0.25, '½': 0.5, '¼': 0.25, '¾': 0.75 };
  const amount = values[match[1]] ?? Number(match[1]);
  const scaled = Math.round(amount * factor * 4) / 4;
  const pretty = Number.isInteger(scaled) ? String(scaled) : String(scaled).replace('.25', '¼').replace('.5', '½').replace('.75', '¾');
  return `${pretty}${match[2]}`;
};

// 1. POST /api/ai/extract-groceries - Extract pantry items from grocery list/receipt
router.post('/extract-groceries/image', (req, res, next) => {
  receiptUpload.single('receipt')(req, res, error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Please use a bill photo smaller than 5 MB' : 'Choose one JPG, PNG, or WebP bill photo' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a bill photo first' });
  const signatures = {
    'image/jpeg': req.file.buffer[0] === 0xff && req.file.buffer[1] === 0xd8 && req.file.buffer[2] === 0xff,
    'image/png': req.file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': req.file.buffer.toString('ascii', 0, 4) === 'RIFF' && req.file.buffer.toString('ascii', 8, 12) === 'WEBP'
  };
  if (!signatures[req.file.mimetype]) return res.status(400).json({ error: 'That file is not a supported image. Choose a JPG, PNG, or WebP photo.' });

  if (!recipeAiEnabled()) {
    return res.status(503).json({ error: 'Bill photo reading is not configured yet. You can paste your grocery list below instead.' });
  }
  try {
    const prompt = `Read this grocery receipt or grocery bill. Extract only actual food, ingredient, and household pantry grocery line items. Ignore store details, dates, totals, taxes, discounts, payment information, and item codes. Use the quantity shown when readable, otherwise use "1 pack". Return a JSON object with an "items" array containing at most 100 objects in this shape: {"items":[{"ingredient":"clean item name","quantity":"amount and unit","category":"Produce|Dairy|Meat|Pantry|Spices|Bakery|Other"}]}. Do not guess an item if it is unreadable.`;
    const parsed = parseAiJson(await generateAiText(prompt, { json: true, image: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }));
    const extracted = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(extracted)) throw new Error('Expected an item list');
    const items = extracted.slice(0, 100).map(item => ({
      ingredient: String(item.ingredient || '').trim().slice(0, 100),
      quantity: String(item.quantity || '1 pack').trim().slice(0, 60),
      category: ['Produce', 'Dairy', 'Meat', 'Pantry', 'Spices', 'Bakery', 'Other'].includes(item.category) ? item.category : 'Other'
    })).filter(item => item.ingredient);
    res.json({ items });
  } catch (error) {
    console.error('Bill photo extraction failed:', error.message);
    res.status(422).json({ error: 'Could not read the items clearly. Try a brighter, closer photo or paste the list instead.' });
  }
});

router.post('/extract-groceries', async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || !String(rawText).trim()) {
      return res.status(400).json({ error: 'Please provide grocery text or receipt' });
    }
    if (String(rawText).length > 12000) return res.status(413).json({ error: 'Please keep the grocery note under 12,000 characters' });

    if (recipeAiEnabled()) {
      try {
        const prompt = `You are a kitchen grocery extractor. Extract all food items, groceries, and ingredients from the following text/receipt.
Return a JSON object with an "items" array using this schema:
{"items":[{"ingredient":"string (clean item name)","quantity":"string (e.g. 1 kg, 2 pcs, 500g, 1L)","category":"Produce|Dairy|Meat|Pantry|Spices|Bakery|Other"}]}
Input text:
${rawText}`;

        const parsed = parseAiJson(await generateAiText(prompt, { json: true }));
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        if (Array.isArray(items) && items.length > 0) {
          const cleanItems = items.slice(0, 100).map(item => ({
            ingredient: String(item.ingredient || '').trim().slice(0, 100),
            quantity: String(item.quantity || '1 pack').trim().slice(0, 60),
            category: ['Produce', 'Dairy', 'Meat', 'Pantry', 'Spices', 'Bakery', 'Other'].includes(item.category) ? item.category : 'Other'
          })).filter(item => item.ingredient);
          if (cleanItems.length) return res.json({ items: cleanItems });
        }
      } catch (aiErr) {
        console.warn('AI grocery extraction failed, using intelligent rule-based parser:', aiErr.message);
      }
    }

    // Intelligent Fallback Rule-Based Parser
    const lines = rawText.split(/[\n,;•\-\*\r]+/).map(l => l.trim()).filter(l => l.length > 1);
    const parsedItems = [];

    const categories = {
      produce: ['tomato', 'potato', 'onion', 'garlic', 'ginger', 'lemon', 'chili', 'carrot', 'spinach', 'apple', 'banana', 'cilantro', 'mint', 'peas', 'vegetable', 'cucumber'],
      dairy: ['milk', 'yogurt', 'cheese', 'butter', 'cream', 'ghee', 'paneer', 'egg', 'eggs'],
      meat: ['chicken', 'beef', 'mutton', 'meat', 'fish', 'prawn', 'qeema', 'lamb'],
      pantry: ['rice', 'flour', 'atta', 'oil', 'sugar', 'salt', 'dal', 'daal', 'lentil', 'pasta', 'sauce', 'noodle', 'tea', 'coffee'],
      spices: ['cumin', 'coriander', 'turmeric', 'chili powder', 'black pepper', 'garam masala', 'cinnamon', 'cardamom', 'clove']
    };

    lines.forEach(line => {
      // Remove leading receipt numbers or timestamps
      const clean = line.replace(/^\d+[\.\)\-]?\s*/, '').replace(/Rs\.?\s*\d+/gi, '').replace(/\$\d+(\.\d{2})?/g, '').trim();
      if (!clean) return;

      // Detect quantity
      const qtyMatch = clean.match(/(\d+(\.\d+)?\s*(kg|g|lbs|lb|liters|liter|l|ml|pcs|packet|packets|cup|cups|can|cans|dozen)?)/i);
      const quantity = qtyMatch ? qtyMatch[0].trim() : '1 pack';
      const ingredient = clean.replace(quantity, '').trim() || clean;

      const lower = ingredient.toLowerCase();
      let category = 'Pantry';
      if (categories.produce.some(k => lower.includes(k))) category = 'Produce';
      else if (categories.dairy.some(k => lower.includes(k))) category = 'Dairy';
      else if (categories.meat.some(k => lower.includes(k))) category = 'Meat';
      else if (categories.spices.some(k => lower.includes(k))) category = 'Spices';

      parsedItems.push({
        ingredient: ingredient.charAt(0).toUpperCase() + ingredient.slice(1),
        quantity,
        category
      });
    });

    res.json({ items: parsedItems, ...(parsedItems.length ? {} : { message: 'No grocery items were detected. Try writing one ingredient per line.' }) });
  } catch (error) {
    console.error('Extract groceries error:', error);
    res.status(500).json({ error: 'Failed to extract groceries' });
  }
});

// 2. POST /api/ai/suggest-recipes - Generate daily recipes matching inventory & avoiding allergens
router.post('/suggest-recipes', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.body.familyId, 10);
    let pantryOwnerId = req.user.id;
    let familyMembers = [];
    if (Number.isInteger(familyId)) {
      const [membership, family] = await Promise.all([
        prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId } } }),
        prisma.family.findUnique({ where: { id: familyId }, select: { creatorId: true } })
      ]);
      if (!membership || !family) return res.status(403).json({ error: 'Join this family to see its meal ideas' });
      pantryOwnerId = family.creatorId;
      familyMembers = await prisma.familyMember.findMany({ where: { familyId }, include: { user: { select: { allergies: true, dietaryPreferences: true, dislikes: true } } } });
    } else {
      const account = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
      if (account?.role !== 'maker') return res.status(403).json({ error: 'Join a family to get its pantry based meal ideas' });
    }
    const inventory = await prisma.inventory.findMany({ where: { userId: pantryOwnerId }, select: { ingredient: true, quantity: true } });
    const historyFrom = new Date();
    historyFrom.setDate(historyFrom.getDate() - 90);
    const historyWhere = Number.isInteger(familyId)
      ? { familyId, date: { gte: historyFrom } }
      : { familyId: null, userId: req.user.id, date: { gte: historyFrom } };
    const [recentMeals, recentRequests] = await Promise.all([
      prisma.weeklyMenu.findMany({ where: historyWhere, include: { recipe: { select: { name: true } }, event: { select: { name: true, eventType: true } } }, orderBy: { date: 'desc' }, take: 60 }),
      Number.isInteger(familyId)
        ? prisma.mealRequest.findMany({ where: { familyId, createdAt: { gte: historyFrom } }, include: { votes: { select: { selectedOption: true } } }, orderBy: { createdAt: 'desc' }, take: 30 })
        : Promise.resolve([])
    ]);
    const toList = value => {
      const rawItems = Array.isArray(value) ? value : String(value || '').split(/[\n,;]/);
      return rawItems.flatMap(item => {
        const text = String(item || '').trim();
        if (!text) return [];
        if (text.startsWith('[')) { try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* legacy plain text */ } }
        return [text];
      });
    };
    const familyValues = key => familyMembers.flatMap(member => toList(member.user[key]));
    const excludedNames = new Set(toList(req.body.excludeNames).map(normalizeRecipeName).filter(Boolean));
    const familyAllergies = familyValues('allergies');
    const preferences = familyValues('dietaryPreferences');
    const dislikes = familyValues('dislikes');
    const restrictions = [];
    const allergyItems = toList(familyAllergies);
    const restrictionItems = toList(restrictions);
    const preferenceItems = toList(preferences);
    const dislikeItems = toList(dislikes);
    const cookedHistory = recentMeals
      .filter(meal => ['completed', 'cooked'].includes(meal.status))
      .map(meal => ({ date: meal.date.toISOString().slice(0, 10), meal: meal.recipe?.name || 'Unknown meal', slot: meal.mealType, event: meal.event?.name || null }))
      .slice(0, 36);
    const mealVoteScores = new Map();
    for (const request of recentRequests) {
      const yes = request.votes.filter(vote => vote.selectedOption === 'yes').length;
      const no = request.votes.filter(vote => vote.selectedOption === 'no').length;
      mealVoteScores.set(request.mealName, (mealVoteScores.get(request.mealName) || 0) + yes - no);
    }
    const votedFavorites = [...mealVoteScores].filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
    const votedDislikes = [...mealVoteScores].filter(([, score]) => score < 0).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([name]) => name);
    const favoriteTerms = [...new Set([...getFavoriteTerms(preferenceItems), ...votedFavorites])];
    const requestedServings = Number.parseInt(req.body.servings, 10);
    const targetServings = Number.isInteger(requestedServings) ? Math.min(30, Math.max(1, requestedServings)) : 4;
    const occasionMap = {
      everyday: 'an everyday South Asian family meal', weekend: 'a relaxed weekend family meal', guests: 'a generous meal for family guests', celebration: 'a festive family gathering',
      eid: 'an Eid feast with suitable mains and, when appropriate, a festive dessert', birthday: 'a birthday family celebration meal', dawat: 'a traditional desi dawat for guests'
    };
    const occasion = occasionMap[req.body.occasion] || occasionMap.everyday;
    const invNames = inventory.map(i => (typeof i === 'string' ? i : i.ingredient || '').toLowerCase());
    const everyday = !req.body.occasion || req.body.occasion === 'everyday';
    const usablePantry = invNames.filter(name => !isStaple(name));
    if (everyday && usablePantry.length === 0) return res.json({ recipes: [], source: 'pantry', message: 'Add a main ingredient such as rice, lentils, eggs, vegetables, or meat to your pantry to get matched everyday recipes.' });
    const allergyList = [...allergyItems, ...restrictionItems].map(a => String(a).toLowerCase());
    const avoidList = [...allergyList, ...dislikeItems].map(a => String(a).toLowerCase());
    if (preferenceItems.some(item => /dairy.free|lactose.free/i.test(String(item)))) avoidList.push('dairy');
    if (preferenceItems.some(item => /gluten.free/i.test(String(item)))) avoidList.push('gluten');
    const vegetarianOnly = preferenceItems.some(item => /vegetarian|vegan/i.test(String(item)));
    const veganOnly = preferenceItems.some(item => /vegan/i.test(String(item)));

    const aiConfigured = recipeAiEnabled();
    let aiUnavailable = !aiConfigured;
    let acceptedAiRecipes = [];
    if (aiConfigured) {
      try {
        const prompt = `You are an expert South Asian family meal planner. Generate 6 distinct, genuinely cookable recipe candidates so the application can select the best 3 after checking pantry matches and family restrictions. Do not repeat these previously shown recipe names: ${[...excludedNames].join(', ') || 'None'}.
Available Kitchen Inventory (use these real items; do not invent pantry stock): ${invNames.join(', ')}
Family Allergies TO STRICTLY AVOID: ${allergyList.join(', ') || 'None'}
Dietary Preferences: ${preferenceItems.join(', ') || 'Healthy, Family Friendly'}
Family dislikes and restrictions to avoid: ${avoidList.join(', ') || 'None'}
Recently cooked dishes (most recent first; use these to avoid repetitive suggestions): ${JSON.stringify(cookedHistory) || '[]'}
Family vote history — dishes with more yes votes than no votes to favor: ${votedFavorites.join(', ') || 'No clear pattern yet'}. Dishes with more no votes to avoid: ${votedDislikes.join(', ') || 'No clear pattern yet'}.
        Make each recipe for exactly ${targetServings} people. Occasion: ${occasion}. Every everyday recipe must use pantry ingredients and need no more than 3 non-staple ingredients that are missing. For Eid, birthday, or dawat, suggest dishes suitable for that event, including a balanced mix of mains/sides/dessert where appropriate. Consider dietary restrictions in every dish.
Prioritize familiar South Asian home cooking (roti, daal, sabzi, rice, halal options), practical ingredients and mild-to-adjustable spice. Learn the family's preferences from actual cooked meals and votes: favor repeated traditions on their usual day/meal slot, avoid recently cooked dishes when there are good alternatives, and respect strong dislikes.

Return ONLY a JSON object with a top-level "recipes" array using this schema. Nutrition values must be approximate per-person values.
{"recipes":[
  {
    "name": "string",
    "description": "string",
    "prepTime": "string",
    "cookTime": "string",
    "servings": "string",
    "category": "Lunch|Dinner",
    "allergens": ["string"],
    "dietary": ["string"],
    "matchPercentage": number,
    "nutrition": { "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "fiberG": number },
    "ingredients": [
      { "name": "string", "quantity": "string", "inPantry": boolean, "substitute": "string or null" }
    ],
    "instructions": ["string"]
  }
]
}`;

        const parsed = parseAiJson(await generateAiText(prompt, { json: true }));
        const aiRecipes = Array.isArray(parsed) ? parsed : parsed.recipes;
        if (!Array.isArray(aiRecipes)) throw new Error('AI response did not contain a recipe list');
        if (aiRecipes.length > 0) {
          const safeRecipes = aiRecipes.filter(recipe => {
            const ingredientText = (recipe.ingredients || []).map(item => `${item.name || ''} ${item.quantity || ''}`).join(' ');
            const combined = `${ingredientText} ${(recipe.allergens || []).join(' ')}`;
            const hasPantryMatch = !everyday || (recipe.ingredients || []).some(item => !isStaple(item.name) && pantryHas(invNames, item.name));
            const missingPantryItems = (recipe.ingredients || []).filter(item => !isStaple(item.name) && !pantryHas(invNames, item.name)).length;
            return hasPantryMatch && (!everyday || missingPantryItems <= 3) && !excludedNames.has(normalizeRecipeName(recipe.name)) && !hasAvoidedIngredient(combined, avoidList) && isDietSafe(ingredientText, preferenceItems);
          }).sort((a,b) => (pantryOverlap(invNames, b.ingredients || []) + favoriteScore(b, favoriteTerms) * 5) - (pantryOverlap(invNames, a.ingredients || []) + favoriteScore(a, favoriteTerms) * 5));
          if (safeRecipes.length) {
            const normalized = await Promise.all(safeRecipes.slice(0, 3).map(async recipe => {
          const publicPhoto = await findRecipePhoto(recipe.name);
              return {
                ...recipe,
                servings: String(targetServings),
                image: publicPhoto?.image || null,
                sourceUrl: publicPhoto?.sourceUrl || recipe.sourceUrl,
                photoSource: publicPhoto?.photoSource || null,
                nutrition: estimateNutrition(recipe.ingredients, targetServings) || recipe.nutrition || null,
                ingredients: (recipe.ingredients || []).map(ingredient => ({ ...ingredient, inPantry: pantryHas(invNames, ingredient.name) }))
              };
            }));
            acceptedAiRecipes = normalized;
            if (acceptedAiRecipes.length >= 3) return res.json({ recipes: acceptedAiRecipes.slice(0, 3), source: 'ai' });
          }
        }
      } catch (aiErr) {
        aiUnavailable = true;
        console.warn('AI recipe suggestion failed, using library matcher:', aiErr.message);
      }
    }

    try {
      const mealDbRecipes = await fetchMealDbRecipes({ ingredients: invNames, occasion: req.body.occasion, targetServings, avoidList, preferences: preferenceItems, excludedNames });
      if (mealDbRecipes.length) {
        const combined = [...acceptedAiRecipes];
        const seen = new Set(combined.map(recipe => normalizeRecipeName(recipe.name)));
        for (const recipe of mealDbRecipes) {
          const name = normalizeRecipeName(recipe.name);
          if (!seen.has(name)) { combined.push(recipe); seen.add(name); }
          if (combined.length >= 3) break;
        }
        if (combined.length) return res.json({ recipes: combined.slice(0, 3), source: acceptedAiRecipes.length ? 'ai+TheMealDB' : 'TheMealDB', attribution: 'Recipe and photo from TheMealDB', aiUnavailable });
      }
    } catch (apiError) {
      console.warn('TheMealDB suggestions unavailable; using family recipe library:', apiError.message);
    }

    // Match recipes from built-in curated library
    const filteredRecipes = RECIPE_DATABASE.filter(recipe => {
      // Must NOT contain any family allergens
      const ingredientsText = recipe.ingredients.map(i => i.name).join(' ').toLowerCase();
      const dietTags = recipe.dietary.map(item => item.toLowerCase());
      const dietSafe = !vegetarianOnly || dietTags.some(tag => tag.includes('vegetarian') || tag.includes('vegan'));
      const veganSafe = !veganOnly || (dietTags.some(tag => tag.includes('vegan')) && !/milk|cheese|butter|cream|egg|honey|yogurt/.test(ingredientsText));
      const pantryOkay = !everyday || recipe.ingredients.some(ing => !isStaple(ing.name) && pantryHas(invNames, ing.name));
      const missingPantryItems = recipe.ingredients.filter(ing => !isStaple(ing.name) && !pantryHas(invNames, ing.name)).length;
      return pantryOkay && (!everyday || missingPantryItems <= 3) && dietSafe && veganSafe && isDietSafe(ingredientsText, preferenceItems) && !hasAvoidedIngredient(`${recipe.allergens.join(' ')} ${ingredientsText}`, avoidList);
    });

    const eventDishPatterns = {
      eid: /eid|biryani|sheer khurma|korma|qorma|pulao|kebab|halwa|dessert/i,
      birthday: /birthday|pulao|biryani|kebab|cake|dessert|karahi/i,
      dawat: /biryani|pulao|qorma|karahi|kebab|dawat|celebration/i
    };
    const eventPattern = eventDishPatterns[req.body.occasion];
    const occasionRecipes = eventPattern ? filteredRecipes.filter(recipe => eventPattern.test(`${recipe.name} ${recipe.category}`)) : filteredRecipes;
    const pool = occasionRecipes.length ? occasionRecipes : filteredRecipes;
    const evaluatedRecipes = pool.map(recipe => {
      let matchedCount = 0;
      const baseServings = Number.parseInt(recipe.servings, 10) || 4;
      const servingFactor = targetServings / baseServings;
      const evaluatedIngredients = recipe.ingredients.map(ing => {
        const lowerName = ing.name.toLowerCase();
        const inPantry = pantryHas(invNames, lowerName);
        if (inPantry) matchedCount++;

        // Find substitute if missing
        let substitute = null;
        for (const [key, sub] of Object.entries(INGREDIENT_SUBSTITUTES)) {
          if (lowerName.includes(key)) {
            substitute = sub;
            break;
          }
        }

        return {
          ...ing,
          quantity: scaleQuantity(ing.quantity, servingFactor),
          inPantry,
          substitute
        };
      });

      const matchPercentage = Math.min(100, Math.round((matchedCount / recipe.ingredients.length) * 100));

      return {
        ...recipe,
        image: null,
        servings: String(targetServings),
        nutrition: estimateNutrition(evaluatedIngredients, targetServings) || recipe.nutrition || ESTIMATED_NUTRITION[recipe.id],
        matchPercentage,
        ingredients: evaluatedIngredients
      };
    });

    // Sort by highest pantry match
    evaluatedRecipes.sort((a, b) => (b.matchPercentage + favoriteScore(b, favoriteTerms) * 5) - (a.matchPercentage + favoriteScore(a, favoriteTerms) * 5));
    const unseenRecipes = evaluatedRecipes.filter(recipe => !excludedNames.has(normalizeRecipeName(recipe.name)));
    const cycled = evaluatedRecipes.length > 0 && excludedNames.size > 0 && unseenRecipes.length === 0;
    const nextRecipes = unseenRecipes.length ? unseenRecipes : evaluatedRecipes;
    const recipesWithPhotos = await Promise.all(nextRecipes.slice(0, 3).map(async recipe => {
      const publicPhoto = await findRecipePhoto(recipe.name);
      return publicPhoto ? { ...recipe, ...publicPhoto, source: 'TheMealDB' } : recipe;
    }));
    const combinedRecipes = [...acceptedAiRecipes];
    const seenNames = new Set(combinedRecipes.map(recipe => normalizeRecipeName(recipe.name)));
    for (const recipe of recipesWithPhotos) {
      const name = normalizeRecipeName(recipe.name);
      if (!seenNames.has(name)) { combinedRecipes.push(recipe); seenNames.add(name); }
      if (combinedRecipes.length >= 3) break;
    }
    res.json({ recipes: combinedRecipes.slice(0, 3), source: acceptedAiRecipes.length ? 'ai+pantry-library' : 'pantry-library', cycled, aiUnavailable, message: combinedRecipes.length ? undefined : 'No recipes matched what is in the pantry and the family food rules. Add an ingredient or update preferences to see more ideas.' });
  } catch (error) {
    console.error('Suggest recipes error:', error);
    res.status(500).json({ error: 'Failed to suggest recipes' });
  }
});

router.get('/recipe-image', async (req, res) => {
  const name = String(req.query.name || '').trim().slice(0, 100);
  if (name.length < 2) return res.status(400).json({ error: 'Enter a recipe name first' });
  try {
    const photo = await findRecipePhoto(name);
    if (!photo?.image) return res.status(404).json({ error: 'No exact recipe photo was found online. You can upload a photo for this recipe.' });
    res.json(photo);
  } catch { res.status(503).json({ error: 'Photo search is unavailable. Please upload a photo instead.' }); }
});

const searchMealDbRecipes = async query => {
  try {
    const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const meals = (await response.json()).meals || [];
    return meals.slice(0, 12).flatMap(meal => {
      const ingredients = Array.from({ length: 20 }, (_, index) => {
        const name = String(meal[`strIngredient${index + 1}`] || '').trim();
        return name ? { name, quantity: String(meal[`strMeasure${index + 1}`] || 'to taste').trim() || 'to taste' } : null;
      }).filter(Boolean);
      const instructions = String(meal.strInstructions || '').split(/\r?\n+/).map(step => step.trim()).filter(Boolean);
      if (!meal.strMeal || !meal.strMealThumb || !ingredients.length || !instructions.length) return [];
      return [{
        id: `mealdb-${meal.idMeal}`, mealDbId: meal.idMeal, name: meal.strMeal,
        description: `${meal.strArea || 'Family'} style ${meal.strCategory || 'meal'} recipe`,
        category: meal.strCategory || 'Family meal', prepTime: 'See recipe', cookTime: 'See recipe', servings: '4',
        ingredients, instructions, image: meal.strMealThumb,
        sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
        photoSource: 'TheMealDB', source: 'TheMealDB'
      }];
    });
  } catch { return []; }
};

router.get('/search-recipes', async (req, res) => {
  const query = String(req.query.query || '').trim().slice(0, 80);
  if (query.length < 2) return res.status(400).json({ error: 'Enter at least two letters to search recipes' });
  try {
    const [catalogRecipes, aiResult] = await Promise.all([
      searchMealDbRecipes(query),
      (async () => {
        if (!recipeAiEnabled()) return { recipes: [], error: null };
        try {
          const prompt = `Create 8 distinct, practical recipes for the user's search: "${query}". Use the configured language model to write complete, usable recipes. Prefer familiar South Asian/desi home cooking when appropriate; respect the requested dish and do not switch to unrelated dishes. Include genuine variations of the requested dish, not unrelated recipes. Return only JSON: {"recipes":[{"name":"...","description":"...","category":"...","prepTime":"...","cookTime":"...","servings":"4","ingredients":[{"name":"...","quantity":"..."}],"instructions":["..."]}]}. Include realistic quantities for four servings and 4-10 clear cooking steps. No markdown, no commentary, no invented photo URLs.`;
          const parsed = parseAiJson(await generateAiText(prompt, { json: true, maxTokens: 6500, timeoutMs: 60000 }));
          const recipes = Array.isArray(parsed) ? parsed : parsed.recipes;
          return { recipes: Array.isArray(recipes) ? recipes : [], error: null };
        } catch (error) { return { recipes: [], error: error.message }; }
      })()
    ]);
    const generated = aiResult.recipes;
    const recipes = await Promise.all(generated.slice(0, 8).map(async (item, index) => {
      const name = String(item.name || '').trim().slice(0, 120);
      const ingredients = Array.isArray(item.ingredients) ? item.ingredients.slice(0, 40).map(ingredient => ({ name: String(ingredient.name || '').trim().slice(0, 100), quantity: String(ingredient.quantity || '').trim().slice(0, 60) })).filter(ingredient => ingredient.name) : [];
      const instructions = Array.isArray(item.instructions) ? item.instructions.slice(0, 20).map(step => String(step).trim().slice(0, 1000)).filter(Boolean) : [];
      if (!name || !ingredients.length || !instructions.length) return null;
      const photo = await findRecipePhoto(name);
      return {
        id: `ai-${Date.now()}-${index}`, name,
        description: String(item.description || '').slice(0, 400),
        category: String(item.category || 'Family meal').slice(0, 80),
        prepTime: String(item.prepTime || 'Not specified').slice(0, 40),
        cookTime: String(item.cookTime || 'Not specified').slice(0, 40),
        servings: String(item.servings || '4').slice(0, 40),
        ingredients, instructions,
        image: photo?.image || null,
        sourceUrl: photo?.sourceUrl || null,
        photoSource: photo?.photoSource || null,
        photoAttribution: photo?.photoAttribution || null,
        photoLicenseUrl: photo?.photoLicenseUrl || null,
        source: 'FamilyPlate AI'
      };
    }));
    const validRecipes = recipes.filter(Boolean);
    const merged = [...catalogRecipes, ...validRecipes];
    const unique = merged.filter((recipe, index) => merged.findIndex(item => normalizeRecipeName(item.name) === normalizeRecipeName(recipe.name)) === index);
    if (!unique.length) return res.status(aiResult.error ? 503 : 404).json({ error: aiResult.error || 'No recipes matched that search. Try another dish name.' });
    res.json({ recipes: unique, source: catalogRecipes.length && validRecipes.length ? 'TheMealDB+AI' : catalogRecipes.length ? 'TheMealDB' : 'AI' });
  } catch (error) {
    console.error('AI recipe search failed:', error.message);
    res.status(503).json({ error: error.message || 'AI recipe search is unavailable right now' });
  }
});

// 3. POST /api/ai/substitutes - Get smart culinary substitutes for missing ingredients
router.post('/substitutes', async (req, res) => {
  try {
    const { ingredients = [] } = req.body;
    const results = {};

    ingredients.forEach(item => {
      const name = (typeof item === 'string' ? item : item.name || '').toLowerCase().trim();
      let found = null;
      for (const [key, sub] of Object.entries(INGREDIENT_SUBSTITUTES)) {
        if (name.includes(key) || key.includes(name)) {
          found = sub;
          break;
        }
      }
      results[item.name || item] = found || "Can be omitted or substituted with similar seasoning/vegetable.";
    });

    res.json({ substitutes: results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get substitutes' });
  }
});

// 4. POST /api/ai/structure - Structure unstructured text or speech into a complete recipe
router.post('/structure', async (req, res) => {
  try {
    const rawText = String(req.body.rawText || '').trim();
    if (!rawText) return res.status(400).json({ error: 'Add or dictate your recipe first' });
    if (rawText.length > 12000) return res.status(413).json({ error: 'Please keep the recipe note under 12,000 characters' });

    const aiConfigured = recipeAiEnabled();
    let aiUnavailable = !aiConfigured;
    if (aiConfigured) {
      try {
        const system = 'You organize family recipe notes into accurate, editable recipe drafts. Preserve the user’s language and dish names, including Urdu, Roman Urdu, and mixed Urdu-English. Extract only details the speaker gave. Never silently invent ingredient quantities, serving size, or cooking times; use "Not specified" when absent. Split combined ingredient lines into separate ingredients. Put preparation steps in the order given, fix obvious transcription typos without changing the cooking meaning, and do not treat ingredient lists as cooking steps. Return one valid JSON object only.';
        const prompt = `Structure this spoken or typed recipe note. Return JSON with exactly these fields: {"name":"string","description":"short string or empty","ingredients":[{"name":"string","quantity":"string"}],"instructions":["one clear step per item"],"prepTime":"string","cookTime":"string","servings":"string"}. If the note does not give a quantity, time, or servings, use "Not specified" for that field. Do not omit ingredients or steps the user actually said. If there are no steps in the note, return an empty instructions array so the user can add them in review.\n\nRECIPE NOTE:\n${rawText}`;
        const text = await generateAiText(prompt, { json: true, system, maxTokens: 1400, timeoutMs: 60000 });
        const json = parseAiJson(text);
        const recipe = {
          name: String(json.name || '').trim().slice(0, 120),
          ingredients: Array.isArray(json.ingredients) ? json.ingredients.slice(0, 100).map(item => ({ name: String(item.name || '').trim().slice(0, 100), quantity: String(item.quantity || '').trim().slice(0, 60) })).filter(item => item.name) : [],
          instructions: Array.isArray(json.instructions) ? json.instructions.slice(0, 100).map(step => String(step).trim().slice(0, 1000)).filter(Boolean) : [],
          prepTime: String(json.prepTime || 'Not specified').slice(0, 40), cookTime: String(json.cookTime || 'Not specified').slice(0, 40),
          servings: String(json.servings || 'Not specified').slice(0, 40),
          description: String(json.description || '').trim().slice(0, 400),
          needsManualReview: !Array.isArray(json.ingredients) || !json.ingredients.length || !Array.isArray(json.instructions) || json.instructions.length < 2
        };
        if (!recipe.name || !recipe.ingredients.length) throw new Error('The AI response did not contain a usable recipe name and ingredient list');
        return res.json({ ...recipe, source: 'ai' });
      } catch (e) {
        aiUnavailable = true;
        console.warn('AI recipe structuring failed:', e.message);
      }
    }

    // Local structuring remains available when the configured AI provider is unavailable.
    return res.json({ ...structureRecipeLocally(rawText), aiUnavailable });
  } catch (error) {
    res.status(500).json({ error: 'Failed to structure recipe' });
  }
});

export default router;
