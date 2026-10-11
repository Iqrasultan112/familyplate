import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sharedDemoPassword = 'FamilyPlate@2026';
const dates = Array.from({ length: 14 }, (_, index) => new Date(Date.UTC(2026, 8, 14 + index)));

const households = [
  {
    key: 'aria', name: 'Aria Home', code: 'FPDEMOARIA26', members: [
      { name: 'Aria Khan', email: 'aria@familyplate.test', role: 'maker', likes: 'Anda paratha on Sundays, simple daal, seasonal vegetables', dislikes: 'Very spicy food' },
      { name: 'Hamza Khan', email: 'hamza@familyplate.test', likes: 'Chicken karahi, biryani, qeema' },
      { name: 'Zayan Khan', email: 'zayan@familyplate.test', likes: 'Aloo paratha, daal chawal', dislikes: 'Bitter gourd' },
      { name: 'Hiba Khan', email: 'hiba@familyplate.test', likes: 'Mild chicken pulao, omelette', dislikes: 'Green chilli' },
      { name: 'Salma Begum', email: 'salma@familyplate.test', likes: 'Palak, daal, home-style roti' }
    ],
    pantry: [['Atta', '8 kg'], ['Basmati rice', '5 kg'], ['Chicken', '4 kg'], ['Minced beef', '1.5 kg'], ['Eggs', '30 pieces'], ['Milk', '6 L'], ['Yogurt', '3 kg'], ['Potatoes', '5 kg'], ['Onions', '4 kg'], ['Tomatoes', '3 kg'], ['Moong daal', '1 kg'], ['Chana daal', '1 kg'], ['Spinach', '1 kg'], ['Cooking oil', '3 L'], ['Ghee', '750 g'], ['Ginger garlic paste', '500 g'], ['Cumin', '150 g'], ['Red chilli powder', '100 g'], ['Fresh coriander', '3 bunches']],
    meals: [
      ['Anda paratha', 'Daal chawal', 'Chicken karahi'], ['Aloo paratha', 'Leftover karahi with roti', 'Palak gosht'], ['Omelette and toast', 'Chana pulao', 'Qeema matar'], ['Paratha and chai', 'Daal roti', 'Mild chicken pulao'], ['Boiled eggs and toast', 'Aloo qeema', 'Mixed sabzi with roti'], ['Halwa puri', 'Chicken biryani dawat', 'Daal soup'], ['Anda paratha', 'Dawat leftovers', 'Chicken karahi'], ['Besan chilla', 'Daal chawal', 'Aloo palak'], ['Omelette and roti', 'Chicken pulao', 'Qeema aloo'], ['Aloo paratha', 'Chana daal roti', 'Chicken tikka'], ['Toast and egg', 'Sabzi pulao', 'Daal mash'], ['Paratha and dahi', 'Leftover pulao', 'Chicken karahi'], ['French toast', 'Chana chaat and roti', 'Aloo gobi'], ['Halwa puri', 'Chicken pulao', 'Daal chawal']
    ],
    events: [{ day: 5, name: 'Saturday family dawat', type: 'dawat', guests: 8 }, { day: 10, name: 'Rainy evening comfort meal', type: 'rainy-day', guests: 5 }],
    requests: [{ day: 0, member: 1, dish: 'Chicken karahi', votes: ['yes', 'yes', 'yes', 'no'] }, { day: 8, member: 2, dish: 'Qeema aloo', votes: ['yes', 'yes', 'no', 'yes'] }, { day: 10, member: 1, dish: 'Chicken karahi', votes: ['yes', 'yes', 'yes', 'yes'] }]
  },
  {
    key: 'sana', name: 'Sana and Bilal Family', code: 'FPDEMOSANA26', members: [
      { name: 'Sana Ahmed', email: 'sana@familyplate.test', role: 'maker', likes: 'Quick meals, bhindi, chicken pulao' },
      { name: 'Bilal Ahmed', email: 'bilal@familyplate.test', likes: 'Beef pulao, chicken tikka, karahi' },
      { name: 'Areeba Ahmed', email: 'areeba@familyplate.test', likes: 'Pasta, chicken, lunchbox leftovers' },
      { name: 'Musa Ahmed', email: 'musa@familyplate.test', likes: 'Daal chawal, mild chicken', dislikes: 'Green chilli, very spicy food' },
      { name: 'Farzana Ahmed', email: 'farzana@familyplate.test', likes: 'Khichri, bhindi, light meals' }
    ],
    pantry: [['Atta', '6 kg'], ['Basmati rice', '6 kg'], ['Chicken', '5 kg'], ['Beef', '2 kg'], ['Eggs', '24 pieces'], ['Milk', '8 L'], ['Yogurt', '2 kg'], ['Potatoes', '4 kg'], ['Onions', '3 kg'], ['Tomatoes', '4 kg'], ['Bhindi', '1.5 kg'], ['Masoor daal', '1 kg'], ['Chana daal', '1 kg'], ['Pasta', '1 kg'], ['Cooking oil', '3 L'], ['Ghee', '500 g'], ['Ginger garlic paste', '400 g'], ['Cumin', '100 g'], ['Black pepper', '80 g']],
    meals: [
      ['Omelette and toast', 'Chicken sandwich', 'Beef pulao'], ['Paratha and dahi', 'Daal chawal', 'Bhindi masala'], ['Boiled eggs and roti', 'Chicken pulao', 'Chicken pasta'], ['Aloo paratha', 'Leftover pasta', 'Masoor daal with roti'], ['Toast and omelette', 'Aloo qeema', 'Chicken tikka with rice'], ['Chana chaat', 'Daal chawal', 'Chicken biryani dawat'], ['Halwa puri', 'Dawat leftovers', 'Khichri'], ['Anda paratha', 'Chicken sandwich', 'Aloo gosht'], ['French toast', 'Bhindi with roti', 'Chicken karahi'], ['Omelette and toast', 'Pasta salad', 'Chicken karahi'], ['Paratha and chai', 'Daal roti', 'Beef qeema matar'], ['Boiled eggs and toast', 'Chicken pulao', 'Khichri'], ['Aloo paratha', 'Aloo chana', 'Chicken roast'], ['Chana chaat', 'Leftover chicken', 'Daal chawal']
    ],
    events: [{ day: 5, name: 'Bilal family Sunday dawat', type: 'dawat', guests: 10 }, { day: 9, name: 'Rainy day chicken soup and pakora', type: 'rainy-day', guests: 5 }],
    requests: [{ day: 2, member: 2, dish: 'Chicken pasta', votes: ['yes', 'yes', 'yes', 'no'] }, { day: 8, member: 1, dish: 'Aloo gosht', votes: ['yes', 'yes', 'no', 'yes'] }, { day: 9, member: 4, dish: 'Khichri', votes: ['yes', 'yes', 'yes', 'yes'] }]
  },
  {
    key: 'nadia', name: 'Nadia Home', code: 'FPDEMONADIA26', members: [
      { name: 'Nadia Siddiqui', email: 'nadia@familyplate.test', role: 'maker', likes: 'Seasonal vegetables, daal, practical family meals' },
      { name: 'Usman Siddiqui', email: 'usman@familyplate.test', likes: 'Nihari, karahi, barbecue' },
      { name: 'Maryam Siddiqui', email: 'maryam@familyplate.test', likes: 'Biryani, pasta', dislikes: 'Fish' },
      { name: 'Ibrahim Siddiqui', email: 'ibrahim@familyplate.test', likes: 'Mild chicken, eggs, rice', dislikes: 'Hot green chilli' }
    ],
    pantry: [['Atta', '5 kg'], ['Basmati rice', '4 kg'], ['Chicken', '3 kg'], ['Beef', '1.5 kg'], ['Eggs', '18 pieces'], ['Milk', '5 L'], ['Yogurt', '2 kg'], ['Potatoes', '3 kg'], ['Onions', '3 kg'], ['Tomatoes', '2 kg'], ['Bottle gourd', '1 kg'], ['Peas', '750 g'], ['Moong daal', '1 kg'], ['Chickpeas', '1 kg'], ['Cooking oil', '2.5 L'], ['Ghee', '500 g'], ['Ginger garlic paste', '350 g'], ['Cumin', '100 g']],
    meals: [
      ['Anda paratha', 'Moong daal chawal', 'Chicken karahi'], ['Aloo paratha', 'Aloo matar', 'Beef pulao'], ['Toast and omelette', 'Leftover pulao', 'Lauki chana daal'], ['Boiled egg and roti', 'Chicken pulao', 'Chicken pasta'], ['Paratha and chai', 'Chana chaat', 'Mild chicken tikka'], ['French toast', 'Daal chawal', 'Chicken biryani'], ['Halwa puri', 'Biryani leftovers', 'Moong daal khichri'], ['Anda paratha', 'Chicken sandwich', 'Aloo qeema'], ['Omelette and roti', 'Lauki chana daal', 'Lauki gosht'], ['Aloo paratha', 'Leftover pulao', 'Chicken karahi'], ['Toast and egg', 'Moong daal chawal', 'Matar pulao'], ['Paratha and dahi', 'Aloo chana', 'Beef qeema'], ['Chana chaat', 'Chicken pulao', 'Seasonal sabzi with roti'], ['Anda paratha', 'Leftover chicken pulao', 'Daal chawal']
    ],
    events: [{ day: 12, name: 'Saturday cousins dawat', type: 'dawat', guests: 7 }, { day: 8, name: 'Rainy evening lauki and pakora', type: 'rainy-day', guests: 4 }],
    requests: [{ day: 3, member: 2, dish: 'Chicken pasta', votes: ['yes', 'yes', 'yes'] }, { day: 6, member: 1, dish: 'Moong daal khichri', votes: ['yes', 'yes', 'no'] }, { day: 11, member: 1, dish: 'Beef qeema', votes: ['yes', 'yes', 'yes'] }]
  }
];

const recipeData = name => {
  const map = {
    'Anda paratha': [['Eggs', '2'], ['Atta', '1 cup'], ['Cooking oil', '1 tbsp']],
    'Halwa puri': [['Atta', '2 cups'], ['Semolina', '1 cup'], ['Sugar', '1 cup'], ['Cooking oil', 'as needed']],
    'Chicken biryani dawat': [['Chicken', '2 kg'], ['Basmati rice', '2 kg'], ['Yogurt', '500 g'], ['Onions', '4'], ['Tomatoes', '4']],
    'Chicken biryani': [['Chicken', '1 kg'], ['Basmati rice', '750 g'], ['Yogurt', '250 g'], ['Onions', '2']],
    'Beef biryani dawat': [['Beef', '2 kg'], ['Basmati rice', '2 kg'], ['Yogurt', '500 g'], ['Onions', '4']],
    'Chicken roast': [['Chicken', '1.5 kg'], ['Yogurt', '250 g'], ['Ginger garlic paste', '2 tbsp']],
    'Chicken karahi': [['Chicken', '1 kg'], ['Tomatoes', '500 g'], ['Onions', '2'], ['Ginger garlic paste', '2 tbsp']],
    'Mild chicken pulao': [['Chicken', '750 g'], ['Basmati rice', '500 g'], ['Onions', '1'], ['Yogurt', '150 g']],
    'Chicken pulao': [['Chicken', '750 g'], ['Basmati rice', '500 g'], ['Onions', '1'], ['Ginger garlic paste', '1 tbsp']],
    'Beef pulao': [['Beef', '750 g'], ['Basmati rice', '500 g'], ['Onions', '2']],
    'Palak gosht': [['Spinach', '500 g'], ['Beef', '500 g'], ['Onions', '1']],
    'Qeema matar': [['Minced beef', '500 g'], ['Peas', '250 g'], ['Onions', '1']],
    'Daal chawal': [['Moong daal', '250 g'], ['Basmati rice', '300 g'], ['Onions', '1']],
    'Masoor daal with roti': [['Masoor daal', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Moong daal khichri': [['Moong daal', '200 g'], ['Basmati rice', '200 g'], ['Ghee', '1 tbsp']],
    'Chicken pasta': [['Chicken', '400 g'], ['Pasta', '300 g'], ['Milk', '200 ml']],
    'Pasta salad': [['Pasta', '300 g'], ['Yogurt', '150 g'], ['Peas', '100 g']],
    'Bhindi masala': [['Bhindi', '500 g'], ['Onions', '1'], ['Tomatoes', '2']],
    'Lauki chana daal': [['Bottle gourd', '500 g'], ['Chana daal', '200 g'], ['Onions', '1']],
    'Lauki gosht': [['Bottle gourd', '500 g'], ['Beef', '400 g'], ['Tomatoes', '2']],
    'Chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Aloo paratha': [['Potatoes', '3'], ['Atta', '2 cups'], ['Yogurt', '100 g']],
    'Aloo qeema': [['Potatoes', '400 g'], ['Minced beef', '400 g'], ['Onions', '1']],
    'Qeema aloo': [['Potatoes', '400 g'], ['Minced beef', '400 g'], ['Tomatoes', '2']],
    'Qeema matar': [['Minced beef', '400 g'], ['Peas', '250 g'], ['Tomatoes', '2']],
    'Aloo gosht': [['Potatoes', '400 g'], ['Beef', '500 g'], ['Onions', '1']],
    'Aloo palak': [['Potatoes', '300 g'], ['Spinach', '400 g'], ['Onions', '1']],
    'Aloo gobi': [['Potatoes', '300 g'], ['Cauliflower', '500 g'], ['Tomatoes', '2']],
    'Aloo matar': [['Potatoes', '300 g'], ['Peas', '200 g'], ['Tomatoes', '2']],
    'Aloo chana': [['Potatoes', '300 g'], ['Chickpeas', '250 g'], ['Onions', '1']],
    'Chicken sandwich': [['Chicken', '300 g'], ['Bread', '8 slices'], ['Yogurt', '2 tbsp']],
    'Chicken roast': [['Chicken', '1.5 kg'], ['Yogurt', '250 g'], ['Ginger garlic paste', '2 tbsp']],
    'Daal soup': [['Moong daal', '200 g'], ['Onions', '1'], ['Tomatoes', '1']],
    'Daal mash': [['Chana daal', '250 g'], ['Onions', '1'], ['Ghee', '1 tbsp']],
    'Daal roti': [['Masoor daal', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Daal chawal': [['Moong daal', '250 g'], ['Basmati rice', '300 g'], ['Onions', '1']],
    'Khichri': [['Moong daal', '200 g'], ['Basmati rice', '200 g'], ['Ghee', '1 tbsp']],
    'Chicken soup and pakora': [['Chicken', '300 g'], ['Atta', '1 cup'], ['Onions', '1'], ['Eggs', '1']],
    'Chicken soup': [['Chicken', '300 g'], ['Carrots', '2'], ['Onions', '1']],
    'Chicken biryani dawat': [['Chicken', '2 kg'], ['Basmati rice', '2 kg'], ['Yogurt', '500 g'], ['Onions', '4']],
    'Chicken tikka, salad': [['Chicken', '750 g'], ['Tomatoes', '2'], ['Yogurt', '150 g']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Chana pulao': [['Chickpeas', '250 g'], ['Basmati rice', '400 g'], ['Onions', '1']],
    'Chana daal roti': [['Chana daal', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Chana chaat and roti': [['Chickpeas', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Chana chaat': [['Chickpeas', '250 g'], ['Tomatoes', '2'], ['Yogurt', '100 g']],
    'Chana chaat': [['Chickpeas', '250 g'], ['Tomatoes', '2'], ['Yogurt', '100 g']],
    'Beef qeema': [['Minced beef', '500 g'], ['Onions', '1'], ['Tomatoes', '2']],
    'Beef qeema matar': [['Minced beef', '500 g'], ['Peas', '250 g'], ['Onions', '1']],
    'Chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Mild chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Mixed sabzi with roti': [['Potatoes', '200 g'], ['Peas', '150 g'], ['Atta', '2 cups']],
    'Seasonal sabzi with roti': [['Bottle gourd', '300 g'], ['Potatoes', '200 g'], ['Atta', '2 cups']],
    'Chicken karahi': [['Chicken', '1 kg'], ['Tomatoes', '500 g'], ['Onions', '2']],
    'Matar pulao': [['Peas', '250 g'], ['Basmati rice', '400 g'], ['Onions', '1']],
    'Sabzi pulao': [['Peas', '200 g'], ['Basmati rice', '400 g'], ['Carrots', '2']],
    'Aloo gobi': [['Potatoes', '300 g'], ['Cauliflower', '500 g'], ['Tomatoes', '2']],
    'Aloo palak': [['Potatoes', '300 g'], ['Spinach', '400 g'], ['Onions', '1']],
    'Aloo matar': [['Potatoes', '300 g'], ['Peas', '200 g'], ['Tomatoes', '2']],
    'Aloo chana': [['Potatoes', '300 g'], ['Chickpeas', '250 g'], ['Onions', '1']],
    'Matar pulao': [['Peas', '250 g'], ['Basmati rice', '400 g'], ['Onions', '1']],
    'Beef pulao': [['Beef', '750 g'], ['Basmati rice', '500 g'], ['Onions', '2']],
    'Chicken roast': [['Chicken', '1.5 kg'], ['Yogurt', '250 g'], ['Ginger garlic paste', '2 tbsp']],
    'Halwa puri': [['Atta', '2 cups'], ['Semolina', '1 cup'], ['Sugar', '1 cup']],
    'French toast': [['Bread', '6 slices'], ['Eggs', '2'], ['Milk', '100 ml']],
    'Omelette and toast': [['Eggs', '3'], ['Bread', '4 slices'], ['Onions', '1']],
    'Toast and omelette': [['Eggs', '3'], ['Bread', '4 slices'], ['Onions', '1']],
    'Omelette and roti': [['Eggs', '3'], ['Atta', '1 cup'], ['Onions', '1']],
    'Toast and egg': [['Eggs', '2'], ['Bread', '4 slices'], ['Milk', '100 ml']],
    'Toast and omelette': [['Eggs', '3'], ['Bread', '4 slices'], ['Onions', '1']],
    'Boiled eggs and toast': [['Eggs', '4'], ['Bread', '4 slices']],
    'Boiled egg and roti': [['Eggs', '2'], ['Atta', '1 cup']],
    'Paratha and chai': [['Atta', '1 cup'], ['Milk', '200 ml'], ['Tea', '2 tsp']],
    'Paratha and dahi': [['Atta', '1 cup'], ['Yogurt', '100 g']],
    'Paratha and dahi': [['Atta', '1 cup'], ['Yogurt', '100 g']],
    'Paratha and chai': [['Atta', '1 cup'], ['Milk', '200 ml'], ['Tea', '2 tsp']],
    'Besan chilla': [['Besan', '1 cup'], ['Onions', '1'], ['Tomatoes', '1']],
    'French toast': [['Bread', '6 slices'], ['Eggs', '2'], ['Milk', '100 ml']],
    'Aloo qeema': [['Potatoes', '400 g'], ['Minced beef', '400 g'], ['Onions', '1']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Mild chicken pulao': [['Chicken', '750 g'], ['Basmati rice', '500 g'], ['Onions', '1']],
    'Aloo chana': [['Potatoes', '300 g'], ['Chickpeas', '250 g'], ['Onions', '1']],
    'Aloo gosht': [['Potatoes', '400 g'], ['Beef', '500 g'], ['Onions', '1']],
    'Chicken roast': [['Chicken', '1.5 kg'], ['Yogurt', '250 g'], ['Ginger garlic paste', '2 tbsp']],
    'Chicken soup': [['Chicken', '300 g'], ['Onions', '1'], ['Carrots', '2']],
    'Chicken tikka, salad': [['Chicken', '750 g'], ['Tomatoes', '2'], ['Yogurt', '150 g']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Chana pulao': [['Chickpeas', '250 g'], ['Basmati rice', '400 g'], ['Onions', '1']],
    'Beef pulao': [['Beef', '750 g'], ['Basmati rice', '500 g'], ['Onions', '2']],
    'Aloo palak': [['Potatoes', '300 g'], ['Spinach', '400 g'], ['Onions', '1']],
    'Aloo matar': [['Potatoes', '300 g'], ['Peas', '200 g'], ['Tomatoes', '2']],
    'Chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Chicken pasta': [['Chicken', '400 g'], ['Pasta', '300 g'], ['Milk', '200 ml']],
    'Pasta salad': [['Pasta', '300 g'], ['Yogurt', '150 g'], ['Peas', '100 g']],
    'Aloo qeema': [['Potatoes', '400 g'], ['Minced beef', '400 g'], ['Onions', '1']],
    'Qeema matar': [['Minced beef', '400 g'], ['Peas', '250 g'], ['Tomatoes', '2']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Beef qeema matar': [['Minced beef', '500 g'], ['Peas', '250 g'], ['Onions', '1']],
    'Daal chawal': [['Moong daal', '250 g'], ['Basmati rice', '300 g'], ['Onions', '1']],
    'Mild chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Chicken tikka, salad': [['Chicken', '750 g'], ['Tomatoes', '2'], ['Yogurt', '150 g']],
    'Chicken soup and pakora': [['Chicken', '300 g'], ['Atta', '1 cup'], ['Onions', '1']],
    'Khichri': [['Moong daal', '200 g'], ['Basmati rice', '200 g'], ['Ghee', '1 tbsp']],
    'Beef qeema': [['Minced beef', '500 g'], ['Onions', '1'], ['Tomatoes', '2']],
    'Chana chaat': [['Chickpeas', '250 g'], ['Tomatoes', '2'], ['Yogurt', '100 g']],
    'Dawat leftovers': [['Chicken', '500 g'], ['Basmati rice', '300 g'], ['Yogurt', '100 g']],
    'Chicken biryani dawat': [['Chicken', '2 kg'], ['Basmati rice', '2 kg'], ['Yogurt', '500 g'], ['Onions', '4']],
    'Dawat lunch leftovers': [['Chicken', '500 g'], ['Basmati rice', '300 g'], ['Yogurt', '100 g']],
    'Daal soup': [['Moong daal', '200 g'], ['Onions', '1'], ['Tomatoes', '1']],
    'Chicken pulao leftovers': [['Chicken', '300 g'], ['Basmati rice', '250 g'], ['Onions', '1']],
    'Chicken biryani': [['Chicken', '1 kg'], ['Basmati rice', '750 g'], ['Yogurt', '250 g']],
    'Mild chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Seasonal sabzi with roti': [['Bottle gourd', '300 g'], ['Potatoes', '200 g'], ['Atta', '2 cups']],
    'Mixed sabzi with roti': [['Potatoes', '200 g'], ['Peas', '150 g'], ['Atta', '2 cups']],
    'Chana daal roti': [['Chana daal', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Daal chawal': [['Moong daal', '250 g'], ['Basmati rice', '300 g'], ['Onions', '1']],
    'Daal roti': [['Masoor daal', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Daal mash': [['Chana daal', '250 g'], ['Onions', '1'], ['Ghee', '1 tbsp']],
    'Leftover chicken': [['Chicken', '300 g'], ['Onions', '1'], ['Atta', '1 cup']],
    'Leftover karahi with roti': [['Chicken', '400 g'], ['Atta', '2 cups'], ['Tomatoes', '1']],
    'Leftover pulao': [['Basmati rice', '300 g'], ['Chicken', '250 g'], ['Yogurt', '100 g']],
    'Leftover pasta': [['Pasta', '200 g'], ['Milk', '100 ml'], ['Chicken', '200 g']],
    'Leftover chicken pulao': [['Chicken', '300 g'], ['Basmati rice', '250 g'], ['Onions', '1']],
    'Leftover chicken': [['Chicken', '300 g'], ['Onions', '1'], ['Atta', '1 cup']],
    'Sabzi and roti': [['Bottle gourd', '300 g'], ['Potatoes', '200 g'], ['Atta', '2 cups']],
    'Seasonal vegetables': [['Bottle gourd', '300 g'], ['Peas', '150 g'], ['Potatoes', '200 g']],
    'Chicken karahi': [['Chicken', '1 kg'], ['Tomatoes', '500 g'], ['Onions', '2']],
    'Chicken roast': [['Chicken', '1.5 kg'], ['Yogurt', '250 g'], ['Ginger garlic paste', '2 tbsp']],
    'Chana chaat and roti': [['Chickpeas', '250 g'], ['Atta', '2 cups'], ['Tomatoes', '2']],
    'Daal soup': [['Moong daal', '200 g'], ['Onions', '1'], ['Tomatoes', '1']],
    'Dawat leftovers': [['Chicken', '500 g'], ['Basmati rice', '300 g'], ['Yogurt', '100 g']],
    'Beef biryani dawat': [['Beef', '2 kg'], ['Basmati rice', '2 kg'], ['Yogurt', '500 g'], ['Onions', '4']],
    'Mild chicken pulao': [['Chicken', '750 g'], ['Basmati rice', '500 g'], ['Onions', '1']],
    'Chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Chicken pulao': [['Chicken', '750 g'], ['Basmati rice', '500 g'], ['Onions', '1']],
    'Dawat leftovers': [['Chicken', '500 g'], ['Basmati rice', '300 g'], ['Yogurt', '100 g']],
    'Beef qeema': [['Minced beef', '500 g'], ['Onions', '1'], ['Tomatoes', '2']],
    'Aloo gobi': [['Potatoes', '300 g'], ['Cauliflower', '500 g'], ['Tomatoes', '2']],
    'Chicken pulao': [['Chicken', '750 g'], ['Basmati rice', '500 g'], ['Onions', '1']],
    'Mild chicken tikka': [['Chicken', '750 g'], ['Yogurt', '200 g'], ['Ginger garlic paste', '1 tbsp']],
    'Lauki chana daal': [['Bottle gourd', '500 g'], ['Chana daal', '200 g'], ['Onions', '1']],
    'Lauki gosht': [['Bottle gourd', '500 g'], ['Beef', '400 g'], ['Tomatoes', '2']],
    'Aloo matar': [['Potatoes', '300 g'], ['Peas', '200 g'], ['Tomatoes', '2']],
    'Matar pulao': [['Peas', '250 g'], ['Basmati rice', '400 g'], ['Onions', '1']],
    'Chicken sandwich': [['Chicken', '300 g'], ['Bread', '8 slices'], ['Yogurt', '2 tbsp']],
    'Aloo chana': [['Potatoes', '300 g'], ['Chickpeas', '250 g'], ['Onions', '1']],
    'Dawat leftovers': [['Chicken', '500 g'], ['Basmati rice', '300 g'], ['Yogurt', '100 g']],
    'Chicken tikka with rice': [['Chicken', '600 g'], ['Basmati rice', '300 g'], ['Yogurt', '150 g']],
    'Chicken pulao leftovers': [['Chicken', '300 g'], ['Basmati rice', '250 g'], ['Onions', '1']],
    'Beef qeema matar': [['Minced beef', '500 g'], ['Peas', '250 g'], ['Onions', '1']],
    'Daal chawal': [['Moong daal', '250 g'], ['Basmati rice', '300 g'], ['Onions', '1']],
    'Chana pulao': [['Chickpeas', '250 g'], ['Basmati rice', '400 g'], ['Onions', '1']],
    'Chicken soup and pakora': [['Chicken', '300 g'], ['Atta', '1 cup'], ['Onions', '1']],
    'Rainy evening comfort meal': [['Chicken', '300 g'], ['Moong daal', '200 g'], ['Atta', '1 cup']]
  };
  const ingredients = map[name] || [['Onions', '1'], ['Tomatoes', '2'], ['Cooking oil', '2 tbsp']];
  return {
    ingredients,
    instructions: [
      'Wash and prepare the ingredients; keep the spice level mild and let each person add chilli at the table.',
      'Heat oil in a pot, cook the onion and ginger garlic paste until fragrant, then add the main ingredients and spices.',
      'Add a little water, cover and cook until everything is tender; serve hot with roti or rice.'
    ]
  };
};

const main = async () => {
  const allEmails = households.flatMap(house => house.members.map(member => member.email));
  const existing = await prisma.user.findMany({ where: { email: { in: allEmails } }, select: { email: true } });
  if (existing.length) throw new Error(`Demo seed stopped: one or more demo emails already exist (${existing.map(user => user.email).join(', ')}). No records were changed.`);
  const passwordHash = await bcrypt.hash(sharedDemoPassword, 10);

  const summary = [];
  for (const house of households) {
    const users = [];
    for (const person of house.members) {
      const user = await prisma.user.create({ data: {
        name: person.name, email: person.email, password: passwordHash,
        role: person.role || 'member', dietaryPreferences: JSON.stringify([`favorite foods: ${person.likes}`]),
        dislikes: person.dislikes || null
      } });
      users.push(user);
    }
    const family = await prisma.family.create({ data: {
      name: house.name, code: house.code, expectedMembers: house.members.length, creatorId: users[0].id
    } });
    await prisma.familyMember.createMany({ data: users.map((user, index) => ({ userId: user.id, familyId: family.id, role: index === 0 ? 'maker' : 'member' })) });
    await prisma.inventory.createMany({ data: house.pantry.map(([ingredient, quantity]) => ({ ingredient, quantity, userId: users[0].id })) });

    const dishNames = [...new Set(house.meals.flat())];
    const recipeByName = new Map();
    for (const name of dishNames) {
      const data = recipeData(name);
      const recipe = await prisma.recipe.create({ data: {
        name,
        ingredients: JSON.stringify(data.ingredients.map(([ingredient, quantity]) => ({ name: ingredient, quantity }))),
        instructions: JSON.stringify(data.instructions), prepTime: '15 minutes', cookTime: name.toLowerCase().includes('biryani') ? '60 minutes' : '25 minutes',
        servings: String(house.members.length), creatorId: users[0].id
      } });
      recipeByName.set(name, recipe);
    }
    const events = new Map();
    for (const event of house.events) {
      const eventDate = dates[event.day];
      const created = await prisma.event.create({ data: {
        name: event.name, date: eventDate, description: event.type === 'dawat' ? `Hosted a family dawat for ${event.guests} guests.` : 'Rainy-weather special meal recorded in family history.',
        eventType: event.type, guestCount: event.guests, familyId: family.id
      } });
      events.set(event.day, created.id);
    }
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
    const menuRows = [];
    house.meals.forEach((dayMeals, dayIndex) => dayMeals.forEach((dish, slotIndex) => {
      const eventId = slotIndex === 2 ? (events.get(dayIndex) || null) : null;
      menuRows.push({
        date: dates[dayIndex], recipeId: recipeByName.get(dish).id, familyId: family.id, eventId,
        servings: eventId && house.events.find(event => event.day === dayIndex)?.type === 'dawat' ? house.events.find(event => event.day === dayIndex).guests : house.members.length,
        mealType: mealTypes[slotIndex], status: 'completed',
        cookedAt: new Date(dates[dayIndex].getTime() + (slotIndex === 0 ? 3 : slotIndex === 1 ? 8 : 14) * 60 * 60 * 1000)
      });
    }));
    await prisma.weeklyMenu.createMany({ data: menuRows });

    for (const requestInfo of house.requests) {
      const requestedAt = new Date(dates[requestInfo.day].getTime() + 10 * 60 * 60 * 1000);
      const request = await prisma.mealRequest.create({ data: {
        mealName: requestInfo.dish, recipeId: recipeByName.get(requestInfo.dish)?.id || null,
        requestedDate: dates[requestInfo.day], message: 'Historical demo vote; included to help personalize family suggestions.',
        status: 'approved', isApproved: true, approvedBy: users[0].id, userId: users[requestInfo.member].id,
        familyId: family.id, createdAt: requestedAt, updatedAt: requestedAt
      } });
      await prisma.vote.createMany({ data: requestInfo.votes.map((choice, voteIndex) => ({
        selectedOption: choice, userId: users[voteIndex + 1]?.id || users[0].id, requestId: request.id,
        createdAt: new Date(requestedAt.getTime() + voteIndex * 60000)
      })) });
    }
    summary.push({ familyId: family.id, name: family.name, code: family.code, memberCount: users.length, menuHistoryCount: menuRows.length, eventCount: house.events.length, requestCount: house.requests.length, members: users.map(user => ({ userId: user.id, name: user.name, email: user.email })) });
  }
  console.log(JSON.stringify({ dateRange: '2026-09-14 through 2026-09-27', households: summary }, null, 2));
};

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
