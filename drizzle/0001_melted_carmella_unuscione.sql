CREATE TABLE `collaborators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('administrator','collaborator') NOT NULL DEFAULT 'collaborator',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collaborators_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(80) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`deviceKey` varchar(120) NOT NULL,
	`status` enum('online','offline') NOT NULL DEFAULT 'offline',
	`wifi` varchar(120),
	`lastSeen` timestamp,
	`lastFeeding` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `feedings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`type` enum('manual','automatic') NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`scheduledTime` varchar(5),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`hour` int NOT NULL,
	`minute` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
