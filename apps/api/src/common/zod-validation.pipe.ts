import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, type ZodSchema } from "zod";

export type ZodValidationTarget = "body" | "query" | "params";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(
    private readonly schema?: ZodSchema,
    private readonly target?: ZodValidationTarget
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = this.schema ?? (metadata.metatype as unknown as ZodSchema | undefined);
    if (!schema || typeof schema.safeParse !== "function") {
      return value;
    }

    const source = this.target && value && typeof value === "object"
      ? (value as Record<string, unknown>)[this.target]
      : value;
    const result = schema.safeParse(source);
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error));
    }

    return result.data;
  }
}

function formatZodError(error: ZodError) {
  return {
    message: "Validation failed",
    issues: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message
    }))
  };
}
