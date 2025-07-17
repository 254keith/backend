import { z } from "zod";
export * from "./migrations/schema";

// Zod schemas for validation
export const insertCartItemSchema = z.object({
  cartId: z.string().min(1, "Cart ID is required"),
  productId: z.number().int().positive("Product ID must be a positive integer"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const insertOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
  })),
  total: z.number().int().min(0),
  notes: z.string().optional(),
});

export const insertProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().int().min(0, "Price must be non-negative"),
  imageUrl: z.string().min(1, "Image URL is required"),
  categoryId: z.number().int().optional(),
  featured: z.boolean().optional(),
  rating: z.number().int().optional(),
  reviewCount: z.number().int().optional(),
});

export const insertSubscriptionSchema = z.object({
  userId: z.number().int().positive(),
  plan: z.string().min(1, "Plan is required"),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const insertNewsletterSubscriptionSchema = z.object({
  email: z.string().email("Invalid email address"),
  status: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1, "Status is required"),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  notes: z.string().optional(),
});
