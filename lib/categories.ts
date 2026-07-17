/** Smart grocery category detection for HomeOS */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Dairy: [
    "milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "ghee", "paneer",
    "curd", "eggs", "egg", "lassi", "ice cream",
  ],
  Vegetables: [
    "tomato", "tomatoes", "onion", "onions", "potato", "potatoes", "carrot",
    "spinach", "cabbage", "cauliflower", "broccoli", "cucumber", "pepper",
    "capsicum", "beans", "peas", "garlic", "ginger", "lettuce", "coriander",
    "cilantro", "mint", "lemon", "lime", "brinjal", "eggplant", "okra", "bhindi",
  ],
  Fruits: [
    "apple", "banana", "orange", "mango", "grape", "grapes", "watermelon",
    "papaya", "pineapple", "strawberry", "berries", "kiwi", "peach", "pear",
  ],
  Grains: [
    "rice", "wheat", "flour", "atta", "bread", "pasta", "noodles", "oats",
    "cereal", "quinoa", "dal", "lentil", "lentils", "chickpea", "chana", "rajma",
  ],
  Cooking: [
    "cooking oil", "olive oil", "mustard oil", "oil", "salt", "sugar", "spice",
    "spices", "masala", "turmeric", "cumin", "pepper", "vinegar", "sauce",
    "ketchup", "mustard", "mayonnaise", "honey", "peanut butter", "tomato sauce",
  ],
  Household: [
    "soap", "detergent", "shampoo", "toothpaste", "toothbrush", "tissue",
    "toilet paper", "toilet", "cleaner", "bleach", "sponge", "broom", "mop",
    "trash", "bag", "foil", "wrap", "napkin",
  ],
  Beverages: [
    "tea", "coffee", "juice", "soda", "water", "cola", "soft drink", "drink",
  ],
  Snacks: [
    "chips", "cookies", "biscuit", "biscuits", "chocolate", "candy", "nuts",
    "popcorn", "namkeen",
  ],
  Meat: [
    "chicken", "mutton", "fish", "beef", "pork", "sausage", "bacon", "shrimp",
  ],
  Medical: [
    "medicine", "tablet", "syrup", "bandage", "vitamin", "paracetamol",
    "ibuprofen", "antiseptic",
  ],
}

export const ALL_CATEGORIES = [
  "Dairy",
  "Vegetables",
  "Fruits",
  "Grains",
  "Cooking",
  "Household",
  "Beverages",
  "Snacks",
  "Meat",
  "Medical",
  "Other",
] as const

/** Longest-first grocery terms for voice splitting */
export function getGroceryTerms(): string[] {
  const terms = new Set<string>()
  for (const keywords of Object.values(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) terms.add(kw.toLowerCase())
  }
  return [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

export function detectCategory(title: string): string {
  const lower = title.toLowerCase().trim()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return "Other"
}
