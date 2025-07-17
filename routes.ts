import { Router } from "express";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertCartItemSchema, insertOrderSchema, insertProductSchema, insertSubscriptionSchema, insertNewsletterSubscriptionSchema, updateOrderStatusSchema } from "./shared-schema";
import { setupAuth } from "./auth";
import { upload, handleUploadError, getFileUrl } from "./upload";
import path from "path";
import passport from "passport";
import { sendOrderNotificationToAdmin } from "./email";

// Schema for creating a new category
const insertCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes and middleware
  setupAuth(app);

  // Google OAuth routes
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth' }),
    (req, res) => {
      // Successful authentication, redirect home or wherever you want
      res.redirect('/');
    }
  );

  const apiRouter = Router();

  // Serve uploaded files statically
  app.use('/uploads', (req, res, next) => {
    // Restrict CORS in production
    const allowedOrigin = process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    // Security headers
    res.header('Content-Security-Policy', "default-src 'none';");
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'no-referrer');
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));

  // Image upload endpoint
  apiRouter.post("/upload", (req, res, next) => {
    // Always return JSON for auth errors
    if (!req.isAuthenticated || typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated", error: "NOT_AUTHENTICATED" });
    }
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required for uploads", error: "NOT_ADMIN" });
    }
    upload.single('image')(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded. Please select an image file.",
          error: "NO_FILE"
        });
      }
      const fileUrl = getFileUrl(req.file.filename);
      res.status(200).json({
        message: "File uploaded successfully",
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl
      });
    });
  });

  // Products endpoints
  apiRouter.get("/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch {
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  apiRouter.get("/products/featured", async (req, res) => {
    try {
      const featuredProducts = await storage.getFeaturedProducts();
      res.json(featuredProducts);
    } catch {
      res.status(500).json({ message: "Error fetching featured products" });
    }
  });

  apiRouter.get("/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });

      const product = await storage.getProductById(id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      res.json(product);
    } catch {
      res.status(500).json({ message: "Error fetching product" });
    }
  });

  apiRouter.get("/products/slug/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const product = await storage.getProductBySlug(slug);
      if (!product) return res.status(404).json({ message: "Product not found" });

      res.json(product);
    } catch {
      res.status(500).json({ message: "Error fetching product" });
    }
  });

  // Add POST endpoint for creating products
  apiRouter.post("/products", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const productData = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(productData);
      res.status(201).json(newProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating product" });
    }
  });

  // Add PUT endpoint for updating products
  apiRouter.put("/products/:id", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });

      const productData = insertProductSchema.parse(req.body);
      const updatedProduct = await storage.updateProduct(id, productData);
      if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

      res.json(updatedProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // Add DELETE endpoint for deleting products
  apiRouter.delete("/products/:id", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });

      const success = await storage.deleteProduct(id);
      if (!success) return res.status(404).json({ message: "Product not found" });

      res.status(204).end();
    } catch {
      res.status(500).json({ message: "Error deleting product" });
    }
  });

  // Categories endpoints
  apiRouter.get("/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch {
      res.status(500).json({ message: "Error fetching categories" });
    }
  });

  apiRouter.get("/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid category ID" });

      const category = await storage.getCategoryById(id);
      if (!category) return res.status(404).json({ message: "Category not found" });

      res.json(category);
    } catch {
      res.status(500).json({ message: "Error fetching category" });
    }
  });

  apiRouter.get("/categories/:id/products", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid category ID" });

      const category = await storage.getCategoryById(id);
      if (!category) return res.status(404).json({ message: "Category not found" });

      const products = await storage.getProductsByCategory(id);
      res.json(products);
    } catch {
      res.status(500).json({ message: "Error fetching products by category" });
    }
  });

  // ✅ POST /categories - Create a new category
  apiRouter.post("/categories", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const categoryData = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(categoryData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating category" });
    }
  });

  // Add PUT endpoint for updating categories
  apiRouter.put("/categories/:id", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid category ID" });

      const categoryData = insertCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateCategory(id, categoryData);
      if (!updatedCategory) return res.status(404).json({ message: "Category not found" });

      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating category" });
    }
  });

  // Add DELETE endpoint for deleting categories
  apiRouter.delete("/categories/:id", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid category ID" });

      const success = await storage.deleteCategory(id);
      if (!success) return res.status(404).json({ message: "Category not found" });

      res.status(204).end();
    } catch {
      res.status(500).json({ message: "Error deleting category" });
    }
  });

  // Cart endpoints
  apiRouter.get("/cart/:cartId", async (req, res) => {
    try {
      const { cartId } = req.params;
      const cartItems = await storage.getCartItems(cartId);
      res.json(cartItems);
    } catch {
      res.status(500).json({ message: "Error fetching cart items" });
    }
  });

  apiRouter.post("/cart", async (req, res) => {
    try {
      const cartItemData = insertCartItemSchema.parse(req.body);
      if (!cartItemData.productId || !cartItemData.quantity) {
        return res.status(400).json({ message: "Product ID and quantity are required" });
      }
      const existingCartItem = await storage.getCartItemByProductId(
        cartItemData.cartId,
        cartItemData.productId
      );

      if (existingCartItem) {
        const updatedCartItem = await storage.updateCartItem(
          existingCartItem.id,
          existingCartItem.quantity + cartItemData.quantity
        );
        return res.json(updatedCartItem);
      }

      const cartItem = await storage.createCartItem(cartItemData);
      res.status(201).json(cartItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cart item data", errors: error.errors });
      }
      res.status(500).json({ message: "Error adding item to cart" });
    }
  });

  apiRouter.put("/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid cart item ID" });

      const { quantity } = req.body;
      if (typeof quantity !== "number" || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      const updatedCartItem = await storage.updateCartItem(id, quantity);
      if (!updatedCartItem) return res.status(404).json({ message: "Cart item not found" });

      res.json(updatedCartItem);
    } catch {
      res.status(500).json({ message: "Error updating cart item" });
    }
  });

  apiRouter.delete("/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid cart item ID" });

      const success = await storage.deleteCartItem(id);
      if (!success) return res.status(404).json({ message: "Cart item not found" });

      res.status(204).end();
    } catch {
      res.status(500).json({ message: "Error removing item from cart" });
    }
  });

  apiRouter.delete("/cart/clear/:cartId", async (req, res) => {
    try {
      const { cartId } = req.params;
      await storage.clearCart(cartId);
      res.status(204).end();
    } catch {
      res.status(500).json({ message: "Error clearing cart" });
    }
  });

  // Orders endpoints
  apiRouter.post("/orders", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const orderData = insertOrderSchema.parse(req.body);
      // Attach the userId from the session
      const order = await storage.createOrder({ ...orderData, userId: req.user.id });

      // Send order notification to admin
      await sendOrderNotificationToAdmin(order);

      if (req.body.cartId) {
        await storage.clearCart(req.body.cartId);
      }

      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid order data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating order" });
    }
  });

  // Custom Orders endpoint
  apiRouter.post("/custom-orders", async (req, res) => {
    try {
      // Accept custom order details from the request body
      const customOrder = req.body;
      // Send order notification to admin
      await sendOrderNotificationToAdmin(customOrder);
      res.status(201).json({ message: "Your custom order has been sent to the admin!" });
    } catch (error) {
      console.error("Error sending custom order to admin:", error);
      res.status(500).json({ message: "Error sending custom order. Please try again later." });
    }
  });

  apiRouter.get("/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order ID" });

      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      res.json(order);
    } catch {
      res.status(500).json({ message: "Error fetching order" });
    }
  });

  // User endpoint to update their own order
  apiRouter.put("/orders/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order ID" });
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.userId !== req.user.id) {
        return res.status(403).json({ message: "You can only update your own orders" });
      }
      // Only allow editing if not completed/cancelled
      if (["completed", "cancelled", "delivered"].includes(order.status)) {
        return res.status(400).json({ message: "Cannot edit a completed or cancelled order" });
      }
      // Only allow updating address, phone, items
      const { address, phone, items } = req.body;
      const updatedOrder = await storage.updateOrder(id, { address, phone, items });
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Error updating order" });
    }
  });

  // Admin endpoint to get all orders
  apiRouter.get("/admin/orders", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch {
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  // Admin endpoint to update order status
  apiRouter.put("/admin/orders/:id/status", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order ID" });

      const statusData = updateOrderStatusSchema.parse(req.body);
      
      const updatedOrder = await storage.updateOrderStatus(
        id, 
        statusData.status,
        statusData.trackingNumber,
        statusData.estimatedDelivery ? new Date(statusData.estimatedDelivery) : undefined,
        statusData.notes
      );
      
      if (!updatedOrder) return res.status(404).json({ message: "Order not found" });

      res.json(updatedOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating order status" });
    }
  });

  // Users endpoints
  apiRouter.get("/users", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Add PUT endpoint for updating users
  apiRouter.put("/users/:id", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const userData = req.body;
      const updatedUser = await storage.updateUser(id, userData);
      if (!updatedUser) return res.status(404).json({ message: "User not found" });

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error updating user" });
    }
  });

  // Add DELETE endpoint for deleting users
  apiRouter.delete("/users/:id", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user is admin
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      // Prevent admin from deleting themselves
      if (id === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const success = await storage.deleteUser(id);
      if (!success) return res.status(404).json({ message: "User not found" });

      res.status(200).json({ message: "User deleted successfully." });
    } catch {
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  apiRouter.get("/subscriptions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const subscriptions = await storage.getAllSubscriptions();
      res.json(subscriptions);
    } catch {
      res.status(500).json({ message: "Error fetching subscriptions" });
    }
  });

  apiRouter.post("/subscriptions", async (req, res) => {
    try {
      const subscriptionData = insertSubscriptionSchema.parse(req.body);
      const newSubscription = await storage.createSubscription(subscriptionData);
      res.status(201).json(newSubscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating subscription" });
    }
  });

  apiRouter.get("/subscriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid subscription ID" });

      const subscription = await storage.getSubscriptionById(id);
      if (!subscription) return res.status(404).json({ message: "Subscription not found" });

      res.json(subscription);
    } catch {
      res.status(500).json({ message: "Error fetching subscription" });
    }
  });

  apiRouter.put("/subscriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid subscription ID" });

      const subscriptionData = insertSubscriptionSchema.partial().parse(req.body);
      const updatedSubscription = await storage.updateSubscription(id, subscriptionData);
      if (!updatedSubscription) return res.status(404).json({ message: "Subscription not found" });

      res.json(updatedSubscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating subscription" });
    }
  });

  apiRouter.get("/newsletter-subscriptions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const subscriptions = await storage.getAllNewsletterSubscriptions();
      res.json(subscriptions);
    } catch {
      res.status(500).json({ message: "Error fetching newsletter subscriptions" });
    }
  });

  apiRouter.post("/newsletter-subscriptions", async (req, res) => {
    try {
      const subscriptionData = insertNewsletterSubscriptionSchema.parse(req.body);
      const newSubscription = await storage.createNewsletterSubscription(subscriptionData);
      res.status(201).json(newSubscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid newsletter subscription data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating newsletter subscription" });
    }
  });

  apiRouter.get("/newsletter-subscriptions/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const subscription = await storage.getNewsletterSubscriptionByEmail(email);
      if (!subscription) return res.status(404).json({ message: "Newsletter subscription not found" });

      res.json(subscription);
    } catch {
      res.status(500).json({ message: "Error fetching newsletter subscription" });
    }
  });

  apiRouter.put("/newsletter-subscriptions/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const subscriptionData = insertNewsletterSubscriptionSchema.partial().parse(req.body);
      const updatedSubscription = await storage.updateNewsletterSubscription(email, subscriptionData);
      if (!updatedSubscription) return res.status(404).json({ message: "Newsletter subscription not found" });

      res.json(updatedSubscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid newsletter subscription data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating newsletter subscription" });
    }
  });
  app.use("/api", apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
