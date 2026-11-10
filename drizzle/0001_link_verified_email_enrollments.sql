ALTER TABLE `users` ADD `supabase_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_supabase_id_unique` ON `users` (`supabase_id`);