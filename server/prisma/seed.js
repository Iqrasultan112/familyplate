import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with realistic recipes, users, and community posts...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create or update 3 dummy community users
  const user1 = await prisma.user.upsert({
    where: { email: 'ayesha.chef@familyplate.com' },
    update: {},
    create: {
      name: 'Chef Ayesha Khan',
      email: 'ayesha.chef@familyplate.com',
      password: hashedPassword,
      role: 'maker',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      dietaryPreferences: JSON.stringify(['Halal', 'Low Spice Options']),
      allergies: JSON.stringify(['Shellfish'])
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'fatima.tariq@familyplate.com' },
    update: {},
    create: {
      name: 'Fatima Tariq',
      email: 'fatima.tariq@familyplate.com',
      password: hashedPassword,
      role: 'member',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      dietaryPreferences: JSON.stringify(['Halal', 'Vegetarian Friendly']),
      allergies: JSON.stringify(['Peanuts'])
    }
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'zain.ahmed@familyplate.com' },
    update: {},
    create: {
      name: 'Zain Ahmed',
      email: 'zain.ahmed@familyplate.com',
      password: hashedPassword,
      role: 'member',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      dietaryPreferences: JSON.stringify(['Halal', 'High Protein']),
      allergies: JSON.stringify([])
    }
  });

  console.log('Users created:', user1.name, user2.name, user3.name);

  // 2. Create high quality dummy recipes
  const recipesData = [
    {
      name: 'Authentic Desi Chicken Karahi',
      creatorId: user1.id,
      prepTime: '15',
      cookTime: '30',
      servings: '4',
      image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80',
      ingredients: JSON.stringify([
        { name: 'Chicken (bone-in pieces)', quantity: '800g' },
        { name: 'Fresh Tomatoes (sliced)', quantity: '4 large' },
        { name: 'Ginger-Garlic Paste', quantity: '2 tbsp' },
        { name: 'Green Chilies (julienned)', quantity: '4 pieces' },
        { name: 'Cooking Oil or Ghee', quantity: '1/2 cup' },
        { name: 'Black Pepper & Cumin powder', quantity: '1 tsp each' },
        { name: 'Fresh Coriander', quantity: 'for garnish' }
      ]),
      instructions: JSON.stringify([
        'Heat oil in a heavy-bottomed wok (karahi) over high flame.',
        'Add chicken and ginger-garlic paste. Fry for 5-7 minutes until the chicken turns pale golden.',
        'Add sliced tomatoes, cover and simmer on medium heat for 10 minutes until tomatoes soften into a rich gravy.',
        'Remove lid, turn heat to high, add green chilies, salt, black pepper, and roasted cumin powder. Bhunai until oil separates.',
        'Garnish with fresh ginger julienne and chopped coriander. Serve piping hot with tandoori roti or naan.'
      ])
    },
    {
      name: 'Shahi Mutton Dum Biryani',
      creatorId: user1.id,
      prepTime: '30',
      cookTime: '50',
      servings: '6',
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
      ingredients: JSON.stringify([
        { name: 'Long-grain Basmati Rice', quantity: '750g' },
        { name: 'Tender Mutton/Lamb', quantity: '1 kg' },
        { name: 'Yogurt (beaten)', quantity: '1 cup' },
        { name: 'Fried Onions (Birista)', quantity: '1 cup' },
        { name: 'Biryani Masala & Whole Spices', quantity: '2 tbsp' },
        { name: 'Saffron milk & Kewra water', quantity: '2 tbsp' }
      ]),
      instructions: JSON.stringify([
        'Marinate mutton with yogurt, ginger-garlic, biryani spices, and half of fried onions for at least 2 hours.',
        'Parboil basmati rice with whole spices (cinnamon, cloves, cardamom) until 70% cooked.',
        'Layer marinated mutton at the bottom of a heavy pot, top with fragrant parboiled rice.',
        'Drizzle saffron milk, mint leaves, kewra water, and ghee on top. Seal with dough or foil.',
        'Cook on high heat for 10 minutes, then place on a tawa (dum) for 35-40 minutes on lowest flame. Fluff gently and serve with raita.'
      ])
    },
    {
      name: 'Creamy Daal Makhani & Jeera Rice',
      creatorId: user2.id,
      prepTime: '20',
      cookTime: '45',
      servings: '4',
      image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
      ingredients: JSON.stringify([
        { name: 'Black Gram (Sabut Urad)', quantity: '1 cup (soaked)' },
        { name: 'Red Kidney Beans (Rajma)', quantity: '1/4 cup' },
        { name: 'Tomato Puree', quantity: '1 cup' },
        { name: 'Fresh Cream', quantity: '1/2 cup' },
        { name: 'Butter', quantity: '3 tbsp' },
        { name: 'Kasuri Methi', quantity: '1 tbsp' }
      ]),
      instructions: JSON.stringify([
        'Pressure cook soaked lentils and beans with salt and water until completely tender.',
        'In a pan, melt butter, saute ginger-garlic paste, and add spiced tomato puree.',
        'Pour in the cooked lentils, mash slightly, and simmer on low flame for 30 minutes to develop creaminess.',
        'Finish with fresh cream, crushed kasuri methi, and a dollop of butter.'
      ])
    },
    {
      name: 'Mediterranean Creamy Garlic Pasta',
      creatorId: user3.id,
      prepTime: '10',
      cookTime: '15',
      servings: '3',
      image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281045?w=800&auto=format&fit=crop&q=80',
      ingredients: JSON.stringify([
        { name: 'Penne or Fettuccine', quantity: '350g' },
        { name: 'Garlic Cloves (minced)', quantity: '5 cloves' },
        { name: 'Heavy Cream', quantity: '1 cup' },
        { name: 'Parmesan Cheese (grated)', quantity: '1/2 cup' },
        { name: 'Olive Oil & Butter', quantity: '2 tbsp each' },
        { name: 'Fresh Basil & Black Pepper', quantity: 'to taste' }
      ]),
      instructions: JSON.stringify([
        'Boil pasta in salted water until al dente. Reserve 1/2 cup pasta water.',
        'In a skillet, gently saute minced garlic in butter and olive oil until fragrant.',
        'Pour in heavy cream, simmer 2 minutes, then stir in parmesan until smooth and creamy.',
        'Toss boiled pasta in sauce with a splash of reserved water. Season with freshly ground black pepper and basil.'
      ])
    }
  ];

  const createdRecipes = [];
  for (const r of recipesData) {
    const existing = await prisma.recipe.findFirst({ where: { name: r.name } });
    if (!existing) {
      const created = await prisma.recipe.create({ data: r });
      createdRecipes.push(created);
    } else {
      createdRecipes.push(existing);
    }
  }

  console.log(`Populated ${createdRecipes.length} recipes.`);

  // 3. Populate realistic community posts
  const postsData = [
    {
      content: 'Cooked my signature Authentic Desi Chicken Karahi for tonight\'s family dinner! Secret tip: do not add water, let the ripe tomatoes form the whole silky gravy. Everyone at the table devoured it!',
      type: 'share',
      userId: user1.id,
      recipeId: createdRecipes[0]?.id
    },
    {
      content: 'Does anyone have a quick, high-protein weeknight recipe that takes under 20 minutes? Working late today and need something satisfying for 4 people!',
      type: 'request',
      userId: user2.id,
      recipeId: null
    },
    {
      content: 'Sunday lunch perfected with Shahi Mutton Dum Biryani! The aroma filled the entire house. Perfectly layered and grain-separated.',
      type: 'share',
      userId: user1.id,
      recipeId: createdRecipes[1]?.id
    },
    {
      content: 'Made this 15-minute Creamy Garlic Pasta tonight with extra crushed black pepper and basil. Perfect comfort meal after a long day!',
      type: 'share',
      userId: user3.id,
      recipeId: createdRecipes[3]?.id
    },
    {
      content: 'Requesting suggestions for traditional desserts for Eid/family gathering. What is your go-to crowd pleaser: Kheer, Sheer Khurma, or Shahi Tukray?',
      type: 'request',
      userId: user3.id,
      recipeId: null
    }
  ];

  for (const p of postsData) {
    const existing = await prisma.communityPost.findFirst({
      where: { content: p.content }
    });
    if (!existing) {
      const newPost = await prisma.communityPost.create({ data: p });

      // Add comments to posts
      if (p.type === 'share') {
        await prisma.comment.create({
          data: {
            content: 'Looks absolutely mouth-watering! Saving this to our weekly menu right now.',
            userId: user2.id,
            postId: newPost.id
          }
        });
        await prisma.comment.create({
          data: {
            content: 'The tomato trick is so true! Tried it last week and the flavor was next level.',
            userId: user3.id,
            postId: newPost.id
          }
        });
        // Add likes
        await prisma.like.create({ data: { userId: user2.id, postId: newPost.id } });
        await prisma.like.create({ data: { userId: user3.id, postId: newPost.id } });
      } else if (p.type === 'request') {
        await prisma.comment.create({
          data: {
            content: 'Try the Creamy Garlic Pasta recipe posted below! Takes just 15 minutes and super delicious.',
            userId: user1.id,
            postId: newPost.id
          }
        });
        await prisma.like.create({ data: { userId: user1.id, postId: newPost.id } });
      }
    }
  }

  console.log('Database successfully seeded with realistic users, recipes, and community feed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
