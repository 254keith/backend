import {
  Product,
  InsertProduct,
  Category,
  InsertCategory,
  CartItem,
  InsertCartItem,
  CartItemWithProduct,
  Order,
  InsertOrder,
  User,
  InsertUser,
  products,
  categories,
  cartItems,
  orders,
  users,
  Subscription,
  InsertSubscription,
  subscriptions,
  NewsletterSubscription,
  InsertNewsletterSubscription,
  newsletterSubscriptions
} from "./shared-schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session, { Store } from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { IStorage } from "./storage";

const scryptAsync = promisify(scrypt);

const userFieldsToSelect = {
  id: users.id,
  username: users.username,
  password: users.password,
  email: users.email,
  fullName: users.fullName,
  phone: users.phone,
  address: users.address,
  isAdmin: users.isAdmin,
  isVerified: users.isVerified,
  verificationCode: users.verificationCode,
  verificationExpiry: users.verificationExpiry,
  notificationsEnabled: users.notificationsEnabled,
  createdAt: users.createdAt,
};

export class DatabaseStorage implements IStorage {
  sessionStore: Store;
  
  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  // Products
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }
  
  async getProductById(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }
  
  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.slug, slug));
    return result[0];
  }
  
  async getFeaturedProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.featured, true));
  }
  
  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.categoryId, categoryId));
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }
  
  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Categories
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }
  
  async getCategoryById(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }
  
  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.slug, slug));
    return result[0];
  }
  
  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }
  
  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const result = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return result[0];
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Cart
  async getCartItems(cartId: string): Promise<CartItemWithProduct[]> {
    const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
    
    const result: CartItemWithProduct[] = [];
    for (const item of items) {
      const product = await this.getProductById(item.productId!);
      if (product) {
        result.push({
          ...item,
          productId: item.productId as number,
          product: { ...product, featured: product.featured ?? false, rating: product.rating ?? 0, reviewCount: product.reviewCount ?? 0 },
        });
      }
    }
    
    return result;
  }
  
  async getCartItem(id: number): Promise<CartItem | undefined> {
    const result = await db.select().from(cartItems).where(eq(cartItems.id, id));
    return result[0];
  }
  
  async getCartItemByProductId(cartId: string, productId: number): Promise<CartItem | undefined> {
    const result = await db.select().from(cartItems).where(
      and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.productId, productId)
      )
    );
    return result[0];
  }
  
  async createCartItem(cartItem: InsertCartItem): Promise<CartItem> {
    const result = await db.insert(cartItems).values(cartItem).returning();
    return result[0];
  }
  
  async updateCartItem(id: number, quantity: number): Promise<CartItem | undefined> {
    const result = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return result[0];
  }
  
  async deleteCartItem(id: number): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.id, id));
    return !!result;
  }
  
  async clearCart(cartId: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
    return !!result;
  }
  
  // Orders
  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }
  
  async getOrderById(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }
  
  async getOrdersByUserId(userId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }
  
  async getAllOrders(): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }
  
  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }
  
  async updateOrderStatus(id: number, status: string, trackingNumber?: string, estimatedDelivery?: Date, notes?: string): Promise<Order | undefined> {
    // Get current order to build status history
    const currentOrder = await this.getOrderById(id);
    if (!currentOrder) return undefined;
    
    // Build status history
    const statusHistory = Array.isArray(currentOrder.statusHistory) ? currentOrder.statusHistory : [];
    const newStatusEntry = {
      status,
      timestamp: new Date().toISOString(),
      trackingNumber,
      estimatedDelivery: estimatedDelivery?.toISOString(),
      notes,
    };
    
    // Add to history if status changed
    if (currentOrder.status !== status) {
      statusHistory.push(newStatusEntry);
    }
    
    // Update order
    const result = await db
      .update(orders)
      .set({
        status,
        statusHistory,
        trackingNumber: trackingNumber || currentOrder.trackingNumber,
        estimatedDelivery: estimatedDelivery || currentOrder.estimatedDelivery,
        notes: notes || currentOrder.notes,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    
    return result[0];
  }
  
  // Users
  async getAllUsers(): Promise<User[]> {
    const result = await db.select(userFieldsToSelect).from(users);
    return result as User[];
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    const result = await db.select(userFieldsToSelect).from(users).where(eq(users.id, id));
    return result[0] as User | undefined;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select(userFieldsToSelect).from(users).where(eq(users.username, username));
    return result[0] as User | undefined;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select(userFieldsToSelect).from(users).where(eq(users.email, email));
    return result[0] as User | undefined;
  }
  
  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return result[0];
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning(userFieldsToSelect);
    return result[0] as User;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const result = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return result[0];
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }
  
  async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  }

  // Subscriptions
  async getAllSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions);
  }

  async getSubscriptionById(id: number): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return result[0];
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(subscription).returning();
    return result[0];
  }

  async updateSubscription(id: number, subscriptionData: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const result = await db
      .update(subscriptions)
      .set(subscriptionData)
      .where(eq(subscriptions.id, id))
      .returning();
    return result[0];
  }
  
  // Newsletter Subscriptions
  async getAllNewsletterSubscriptions(): Promise<NewsletterSubscription[]> {
    return await db.select().from(newsletterSubscriptions);
  }

  async getNewsletterSubscriptionByEmail(email: string): Promise<NewsletterSubscription | undefined> {
    const result = await db.select().from(newsletterSubscriptions).where(eq(newsletterSubscriptions.email, email));
    return result[0];
  }

  async createNewsletterSubscription(subscription: InsertNewsletterSubscription): Promise<NewsletterSubscription> {
    const result = await db.insert(newsletterSubscriptions).values(subscription).returning();
    return result[0];
  }

  async updateNewsletterSubscription(email: string, subscriptionData: Partial<InsertNewsletterSubscription>): Promise<NewsletterSubscription | undefined> {
    const result = await db
      .update(newsletterSubscriptions)
      .set(subscriptionData)
      .where(eq(newsletterSubscriptions.email, email))
      .returning();
    return result[0];
  }
}