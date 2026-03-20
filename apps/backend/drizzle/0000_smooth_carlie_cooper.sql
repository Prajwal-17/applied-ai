CREATE TYPE "public"."Role" AS ENUM('AI', 'USER');--> statement-breakpoint
CREATE TABLE "Chats" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Item" (
	"id" text PRIMARY KEY NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "Messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chatId" text NOT NULL,
	"msgIndex" integer NOT NULL,
	"role" "Role" NOT NULL,
	"content" text NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_chatId_Chats_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chats"("id") ON DELETE no action ON UPDATE no action;