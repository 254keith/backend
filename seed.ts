import { db } from "./db";
import { categories, products, users, orders } from "./shared-schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function seed() {
  try {
    // Seed categories
    const categoriesData = [
      { name: "Cupcakes", slug: "cupcakes" },
      { name: "Donuts", slug: "donuts" },
      { name: "Cakes", slug: "cakes" },
      { name: "Cookies", slug: "cookies" },
      { name: "Macarons", slug: "macarons" },
    ];

    console.log("Seeding categories...");
    for (const category of categoriesData) {
      await db.insert(categories).values(category).onConflictDoNothing();
    }

    // Seed products
    const productsData = [
      {
        name: "Pink Celebration Cupcake",
        slug: "pink-celebration-cupcake",
        description: "Vanilla cupcake with strawberry frosting and rainbow sprinkles.",
        price: 25000, // Ksh 250
        imageUrl: "https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=500",
        categoryId: 1, // Cupcakes
        featured: true,
        rating: 45, // 4.5 stars
        reviewCount: 42,
      },
      {
        name: "Pastel Macaron Collection",
        slug: "pastel-macaron-collection",
        description: "Set of 6 macarons in assorted flavors. Perfect for gifting!",
        price: 60000, // Ksh 600
        imageUrl: "https://images.unsplash.com/photo-1558326567-98ae2405596b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=500",
        categoryId: 5, // Macarons
        featured: true,
        rating: 50, // 5 stars
        reviewCount: 28,
      },
      {
        name: "Sprinkle Donut Delight",
        slug: "sprinkle-donut-delight",
        description: "Soft donut with sweet glaze and colorful sprinkles.",
        price: 18000, // Ksh 180
        imageUrl: "https://images.unsplash.com/photo-1514517604298-cf80e0fb7f1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=500",
        categoryId: 2, // Donuts
        featured: true,
        rating: 45, // 4.5 stars
        reviewCount: 36,
      },
    ];

    console.log("Seeding products...");
    for (const product of productsData) {
      await db.insert(products).values(product).onConflictDoNothing();
    }

    // Seed admin user
    const adminUser = {
      username: "admin",
      password: await hashPassword("admin123"),
      email: "admin@sweettreats.com",
      fullName: "Admin User",
      isAdmin: true,
      isVerified: true,
    };

    console.log("Seeding admin user...");
    await db.insert(users).values(adminUser).onConflictDoNothing();

    // Seed sample orders
    const sampleOrders = [
      {
        customerName: "John Doe",
        email: "john@example.com",
        phone: "+254700123456",
        address: "123 Main Street, Nairobi, Kenya",
        items: [
          {
            productId: 1,
            productName: "Pink Celebration Cupcake",
            price: 25000,
            quantity: 2,
          },
        ],
        total: 50000, // Ksh 500
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date().toISOString(),
            notes: "Order placed",
          },
        ],
      },
      {
        customerName: "Jane Smith",
        email: "jane@example.com",
        phone: "+254700789012",
        address: "456 Oak Avenue, Mombasa, Kenya",
        items: [
          {
            productId: 2,
            productName: "Pastel Macaron Collection",
            price: 60000,
            quantity: 1,
          },
          {
            productId: 3,
            productName: "Sprinkle Donut Delight",
            price: 18000,
            quantity: 3,
          },
        ],
        total: 114000, // Ksh 1140
        status: "shipped",
        trackingNumber: "TRK123456789",
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            notes: "Order placed",
          },
          {
            status: "confirmed",
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            notes: "Order confirmed",
          },
          {
            status: "processing",
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            notes: "Order being prepared",
          },
          {
            status: "shipped",
            timestamp: new Date().toISOString(),
            trackingNumber: "TRK123456789",
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            notes: "Order shipped via express delivery",
          },
        ],
      },
    ];

    console.log("Seeding sample orders...");
    for (const order of sampleOrders) {
      await db.insert(orders).values(order).onConflictDoNothing();
    }

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed(); 