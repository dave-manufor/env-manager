export class EnvValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `EnvManager Validation Error:\n${errors.join("\n")}`
    );
    this.name = "EnvValidationError";
    this.errors = errors;
  }
}
