CREATE TYPE "public"."job_state" AS ENUM('ESTIMATE', 'ARTWORK_RECEIVED', 'PREFLIGHT', 'PROOFING', 'APPROVED', 'IMPOSED', 'PLATED', 'ON_PRESS', 'FINISHING', 'DESPATCHED', 'HELD', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."press_state" AS ENUM('MAKEREADY', 'RUNNING', 'WASHUP', 'IDLE');--> statement-breakpoint
CREATE TYPE "public"."proof_state" AS ENUM('NONE', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('customer', 'prepress', 'floor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."check_severity" AS ENUM('PASS', 'WARN', 'FAIL', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."waiver_kind" AS ENUM('WAIVED', 'OVERRIDDEN');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"role" "role",
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"payload" jsonb,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"contact" text NOT NULL,
	"city" text NOT NULL,
	"terms" text NOT NULL,
	"account" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imposition_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"job_reference" text NOT NULL,
	"plan" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"job_reference" text NOT NULL,
	"author" text NOT NULL,
	"role" "role" NOT NULL,
	"body" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_reference" text NOT NULL,
	"from_state" "job_state",
	"to_state" "job_state" NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_files" (
	"id" text PRIMARY KEY NOT NULL,
	"job_reference" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"bytes" integer NOT NULL,
	"content_hash" text NOT NULL,
	"storage_path" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"reference" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"description" text NOT NULL,
	"spec" jsonb NOT NULL,
	"state" "job_state" NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"proof_state" "proof_state" DEFAULT 'NONE' NOT NULL,
	"proof_at" timestamp with time zone,
	"preflight_report_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preflight_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"check_id" text NOT NULL,
	"label" text NOT NULL,
	"severity" "check_severity" NOT NULL,
	"measured" text NOT NULL,
	"tolerance" text NOT NULL,
	"finding" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"waiver" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preflight_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"job_reference" text NOT NULL,
	"file_name" text NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"ran_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "presses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"units" text NOT NULL,
	"max_sheet" text NOT NULL,
	"max_sheet_mm" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"state" "press_state" DEFAULT 'IDLE' NOT NULL,
	"job_reference" text,
	"sheets_run" integer DEFAULT 0 NOT NULL,
	"sheets_target" integer DEFAULT 0 NOT NULL,
	"waste_sheets" integer DEFAULT 0 NOT NULL,
	"sheets_per_hour" integer DEFAULT 0 NOT NULL,
	"operator" text DEFAULT '' NOT NULL,
	"shift" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_rates" (
	"group" text NOT NULL,
	"id" text NOT NULL,
	"label" text NOT NULL,
	"values" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_rates_group_id_pk" PRIMARY KEY("group","id")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"customer_id" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imposition_plans" ADD CONSTRAINT "imposition_plans_job_reference_jobs_reference_fk" FOREIGN KEY ("job_reference") REFERENCES "public"."jobs"("reference") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_comments" ADD CONSTRAINT "job_comments_job_reference_jobs_reference_fk" FOREIGN KEY ("job_reference") REFERENCES "public"."jobs"("reference") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_reference_jobs_reference_fk" FOREIGN KEY ("job_reference") REFERENCES "public"."jobs"("reference") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_files" ADD CONSTRAINT "job_files_job_reference_jobs_reference_fk" FOREIGN KEY ("job_reference") REFERENCES "public"."jobs"("reference") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preflight_checks" ADD CONSTRAINT "preflight_checks_report_id_preflight_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."preflight_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preflight_reports" ADD CONSTRAINT "preflight_reports_job_reference_jobs_reference_fk" FOREIGN KEY ("job_reference") REFERENCES "public"."jobs"("reference") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presses" ADD CONSTRAINT "presses_job_reference_jobs_reference_fk" FOREIGN KEY ("job_reference") REFERENCES "public"."jobs"("reference") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "imposition_plans_job_idx" ON "imposition_plans" USING btree ("job_reference");--> statement-breakpoint
CREATE INDEX "job_comments_job_idx" ON "job_comments" USING btree ("job_reference","at");--> statement-breakpoint
CREATE INDEX "job_events_job_idx" ON "job_events" USING btree ("job_reference","at");--> statement-breakpoint
CREATE INDEX "job_files_job_idx" ON "job_files" USING btree ("job_reference");--> statement-breakpoint
CREATE INDEX "job_files_hash_idx" ON "job_files" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "jobs_customer_idx" ON "jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "jobs_state_idx" ON "jobs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "preflight_checks_report_check_idx" ON "preflight_checks" USING btree ("report_id","check_id");--> statement-breakpoint
CREATE INDEX "preflight_checks_report_idx" ON "preflight_checks" USING btree ("report_id","sort_order");--> statement-breakpoint
CREATE INDEX "preflight_reports_job_idx" ON "preflight_reports" USING btree ("job_reference");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_customer_idx" ON "users" USING btree ("customer_id");