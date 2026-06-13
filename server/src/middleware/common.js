/** Wrap async route handlers so thrown errors hit the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validate req.body against a zod schema. */
export const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: "Validation failed",
            details: result.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message
            })),
        });
    }
    req.body = result.data;
    next();
};

/** Central error handler. */
export function errorHandler(err, req, res, _next) {
    const status = err.status || 500;
    if (status >= 500) console.error("[error]", err);
    res.status(status).json({
        error: err.publicMessage || (status >= 500 ? "Internal server error" : err.message),
    });
}

export function notFound(req, res) {
    res.status(404).json({
        error: `Not found: ${req.method} ${req.path}`
    });
}