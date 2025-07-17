import { relations } from "drizzle-orm/relations";
import { categories, products, users, orders, cartItems, subscriptions } from "./schema";

export const productsRelations = relations(products, ({one, many}) => ({
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	cartItems: many(cartItems),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	products: many(products),
}));

export const ordersRelations = relations(orders, ({one}) => ({
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	orders: many(orders),
	subscriptions: many(subscriptions),
}));

export const cartItemsRelations = relations(cartItems, ({one}) => ({
	product: one(products, {
		fields: [cartItems.productId],
		references: [products.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one}) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id]
	}),
}));