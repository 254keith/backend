CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"product_id" integer,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint

CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"items" jsonb NOT NULL,
	"total" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"image_url" text NOT NULL,
	"category_id" integer,
	"featured" boolean DEFAULT false,
	"rating" integer DEFAULT 0,
	"review_count" integer DEFAULT 0,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"password" text NOT NULL,
	"email" varchar(100) NOT NULL,
	"full_name" varchar(150),
	"phone" varchar(20),
	"address" text,
	"is_admin" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"verification_code" varchar(6),
	"verification_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "email_idx" UNIQUE("email"),
	CONSTRAINT "username_idx" UNIQUE("username")
);
--> statement-breakpoint

ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_product_id_products_id_fk"
FOREIGN KEY ("product_id")
REFERENCES "public"."products"("id")
ON DELETE CASCADE
ON UPDATE NO ACTION;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_user_id_users_id_fk"
FOREIGN KEY ("user_id")
REFERENCES "public"."users"("id")
ON DELETE CASCADE
ON UPDATE NO ACTION;

ALTER TABLE "products"
ADD CONSTRAINT "products_category_id_categories_id_fk"
FOREIGN KEY ("category_id")
REFERENCES "public"."categories"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;

ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE users
ADD COLUMN password_reset_token TEXT,
ADD COLUMN password_reset_token_expires TIMESTAMP;
-- Enable Row-Level Security on the table if not enabled
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create the missing select policy
CREATE POLICY select_policy ON newsletter_subscriptions
  FOR SELECT
  USING (true); -- Replace with your actual condition if needed
ALTER TABLE users
ADD COLUMN password_reset_token TEXT,
ADD COLUMN password_reset_token_expiry TIMESTAMP;
