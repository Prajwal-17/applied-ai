CREATE TABLE "Item_Details" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"text_chunk" text,
	"page_no" integer,
	"embedding" vector(3072)
);
--> statement-breakpoint
CREATE TABLE "Items" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text,
	"name" text
);
--> statement-breakpoint
DROP TABLE "Item" CASCADE;--> statement-breakpoint
ALTER TABLE "Item_Details" ADD CONSTRAINT "Item_Details_item_id_Items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."Items"("id") ON DELETE cascade ON UPDATE no action;