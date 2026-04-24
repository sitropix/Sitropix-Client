import { ZodError } from "zod";

export function validate(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "validation_error", issues: error.flatten() });
      }
      return res.status(400).json({ error: "validation_error" });
    }
  };
}
