import { ExceptionLayers, exceptionOf } from "@afora/core";
import type { SchemaIssue } from "@portfolio/shared";

/** Their HTTP statuses are set in the output (domain/output.ts). */

export const EntryNotFound = exceptionOf<{ what: string }>({
	layer: ExceptionLayers.UseCase,
	name: "NotFound",
	message: ({ what }) => `${what} not found`,
});

export const SlugTaken = exceptionOf<{ noun: string; slug: string }>({
	layer: ExceptionLayers.UseCase,
	name: "SlugTaken",
	message: ({ noun, slug }) => `Another ${noun} already uses the slug "${slug}"`,
});

/** Invalid data found past the input blueprint (a check across fields or entries): a 400 with issues. */
export const InvalidData = exceptionOf<{ issues: SchemaIssue[] }>({
	layer: ExceptionLayers.UseCase,
	name: "InvalidData",
	message: "Invalid data",
});

export const BadRequest = exceptionOf({
	layer: ExceptionLayers.UseCase,
	name: "BadRequest",
	message: "Bad request",
});

export const PushDisabled = exceptionOf({
	layer: ExceptionLayers.UseCase,
	name: "PushDisabled",
	message: "Push notifications are not configured (VAPID keys and PUBLIC_SITE_URL)",
});

/** GitHub refused the rebuild; 424 rather than a 5xx, whose detail the problem would hide. */
export const PublishFailed = exceptionOf({
	layer: ExceptionLayers.UseCase,
	name: "PublishFailed",
	message: "GitHub refused the rebuild",
});
