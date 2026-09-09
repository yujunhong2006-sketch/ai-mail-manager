CREATE TABLE "mail_insights" (
	"account_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"category" text NOT NULL,
	"category_override" text,
	"summary" text NOT NULL,
	"reasoning" text NOT NULL,
	"suggested_action" text,
	"deadline" text,
	"topic" text DEFAULT 'Other' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"draft_subject" text,
	"draft_body" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_insights_account_id_gmail_message_id_pk" PRIMARY KEY("account_id","gmail_message_id"),
	CONSTRAINT "mail_insights_category_check" CHECK ("mail_insights"."category" IN ('Important', 'Normal', 'Junk')),
	CONSTRAINT "mail_insights_category_override_check" CHECK ("mail_insights"."category_override" IN ('Important', 'Normal', 'Junk'))
);

--> statement-breakpoint
ALTER TABLE "mail_insights" ADD CONSTRAINT "mail_insights_account_id_gmail_message_id_messages_account_id_gmail_message_id_fk" FOREIGN KEY ("account_id","gmail_message_id") REFERENCES "public"."messages"("account_id","gmail_message_id") ON DELETE cascade ON UPDATE no action;
