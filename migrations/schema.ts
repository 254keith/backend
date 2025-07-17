import { pgTable, unique, pgPolicy, serial, varchar, text, timestamp, foreignKey, integer, boolean, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 100 }).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("newsletter_subscriptions_email_unique").on(table.email),
	pgPolicy("select_policy", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() IS NOT NULL)` }),
	pgPolicy("insert_policy", { as: "permissive", for: "insert", to: ["public"] }),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text().notNull(),
	price: integer().notNull(),
	imageUrl: text("image_url").notNull(),
	categoryId: integer("category_id"),
	featured: boolean().default(false),
	rating: integer().default(0),
	reviewCount: integer("review_count").default(0),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "products_category_id_categories_id_fk"
		}),
	unique("products_slug_unique").on(table.slug),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	customerName: text("customer_name").notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	address: text().notNull(),
	items: jsonb().notNull(),
	total: integer().notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	statusHistory: jsonb("status_history").default([]),
	trackingNumber: text("tracking_number"),
	estimatedDelivery: timestamp("estimated_delivery", { mode: 'string' }),
	notes: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
}, (table) => [
	unique("categories_slug_unique").on(table.slug),
	pgPolicy("Authenticated users can update categories", { as: "permissive", for: "update", to: ["authenticated"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Authenticated users can select categories", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Authenticated users can insert categories", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can delete categories", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const cartItems = pgTable("cart_items", {
	id: serial().primaryKey().notNull(),
	cartId: text("cart_id").notNull(),
	productId: integer("product_id"),
	quantity: integer().default(1).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "cart_items_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const subscriptions = pgTable("subscriptions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	plan: text().notNull(),
	status: text().default('active').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).defaultNow(),
	endDate: timestamp("end_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 100 }).notNull(),
	password: text().notNull(),
	email: varchar({ length: 100 }).notNull(),
	fullName: varchar("full_name", { length: 150 }),
	phone: varchar({ length: 20 }),
	address: text(),
	isAdmin: boolean("is_admin").default(false),
	isVerified: boolean("is_verified").default(false),
	verificationCode: varchar("verification_code", { length: 6 }),
	verificationExpiry: timestamp("verification_expiry", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	notificationsEnabled: boolean("notifications_enabled").default(true),
}, (table) => [
	unique("username_idx").on(table.username),
	unique("users_username_unique").on(table.username),
	unique("email_idx").on(table.email),
	unique("users_email_unique").on(table.email),
]);
