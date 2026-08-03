CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_pushed_seq" integer DEFAULT 0 NOT NULL,
	"last_pulled_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" bigserial NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rejections" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"type" text,
	"payload" jsonb,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operations_seq_idx" ON "operations" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "operations_client_idx" ON "operations" USING btree ("client_id","seq");--> statement-breakpoint
CREATE INDEX "rejections_client_idx" ON "rejections" USING btree ("client_id","at");