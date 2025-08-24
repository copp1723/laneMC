CREATE TABLE "budget_pacing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_ads_account_id" varchar,
	"campaign_id" varchar,
	"date" timestamp NOT NULL,
	"budget_target" numeric(10, 2),
	"actual_spend" numeric(10, 2),
	"pacing_status" text,
	"recommendations" jsonb
);
--> statement-breakpoint
CREATE TABLE "campaign_briefs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"google_ads_account_id" varchar,
	"chat_session_id" varchar,
	"title" text NOT NULL,
	"objectives" jsonb,
	"target_audience" jsonb,
	"budget" numeric(10, 2),
	"timeline" jsonb,
	"status" text DEFAULT 'draft',
	"generated_campaign" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_ads_account_id" varchar,
	"google_campaign_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'PAUSED',
	"budget" numeric(10, 2),
	"bid_strategy" text,
	"target_locations" jsonb,
	"keywords" jsonb,
	"ad_groups" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"google_ads_account_id" varchar,
	"title" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_ads_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'USD',
	"timezone" text,
	"is_active" boolean DEFAULT true,
	"refresh_token" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "google_ads_accounts_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_ads_account_id" varchar,
	"campaign_id" varchar,
	"date" timestamp NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"cost" numeric(10, 2) DEFAULT '0',
	"revenue" numeric(10, 2),
	"ctr" numeric(5, 4),
	"cpc" numeric(10, 2),
	"conversion_rate" numeric(5, 4)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "budget_pacing" ADD CONSTRAINT "budget_pacing_google_ads_account_id_google_ads_accounts_id_fk" FOREIGN KEY ("google_ads_account_id") REFERENCES "public"."google_ads_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_pacing" ADD CONSTRAINT "budget_pacing_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_briefs" ADD CONSTRAINT "campaign_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_briefs" ADD CONSTRAINT "campaign_briefs_google_ads_account_id_google_ads_accounts_id_fk" FOREIGN KEY ("google_ads_account_id") REFERENCES "public"."google_ads_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_briefs" ADD CONSTRAINT "campaign_briefs_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_google_ads_account_id_google_ads_accounts_id_fk" FOREIGN KEY ("google_ads_account_id") REFERENCES "public"."google_ads_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_google_ads_account_id_google_ads_accounts_id_fk" FOREIGN KEY ("google_ads_account_id") REFERENCES "public"."google_ads_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_google_ads_account_id_google_ads_accounts_id_fk" FOREIGN KEY ("google_ads_account_id") REFERENCES "public"."google_ads_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;