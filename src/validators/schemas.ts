import Joi from 'joi'

/**
 * Session validation schemas
 */
export const sessionSchemas = {
    create: Joi.object({
        sessionId: Joi.string()
            .pattern(/^\+?[1-9]\d{1,14}$/)
            .required()
            .messages({
                'string.pattern.base': 'Session ID must be a valid phone number format',
                'any.required': 'Session ID is required'
            }),
        phoneNumber: Joi.string()
            .optional()
            .allow('')
    }),

    sessionId: Joi.object({
        sessionId: Joi.string()
            .required()
            .messages({
                'any.required': 'Session ID is required'
            })
    })
}

/**
 * Group configuration validation schemas
 */
export const groupSchemas = {
    add: Joi.object({
        sessionId: Joi.string().required(),
        locationId: Joi.number().integer().min(100).max(9999).required(),
        locationName: Joi.string().required(),
        groupJid: Joi.string()
            .pattern(/@g\.us$/)
            .required()
            .messages({
                'string.pattern.base': 'Group JID must end with @g.us',
                'any.required': 'Group JID is required'
            })
    }),

    list: Joi.object({
        sessionId: Joi.string().required()
    }),

    delete: Joi.object({
        id: Joi.string().required(),
        sessionId: Joi.string().optional()
    })
}

/**
 * User/Auth validation schemas
 */
export const authSchemas = {
    login: Joi.object({
        username: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.min': 'Username must be at least 3 characters',
                'string.max': 'Username cannot exceed 50 characters',
                'any.required': 'Username is required'
            }),
        password: Joi.string()
            .min(6)
            .required()
            .messages({
                'string.min': 'Password must be at least 6 characters',
                'any.required': 'Password is required'
            })
    }),

    register: Joi.object({
        username: Joi.string()
            .min(3)
            .max(50)
            .alphanum()
            .required(),
        password: Joi.string()
            .min(6)
            .required(),
        role: Joi.string()
            .valid('admin', 'manager')
            .default('manager')
    })
}

/**
 * Broadcast validation schema
 */
export const broadcastSchema = Joi.object({
    sessionId: Joi.string().required(),
    message: Joi.string().required().min(1).max(4096),
    groupJids: Joi.array().items(
        Joi.string().pattern(/@g\.us$/)
    ).optional(),
    schedule: Joi.date().optional().greater('now')
})

/**
 * Validate data against schema
 */
export function validate<T>(schema: Joi.ObjectSchema, data: any): { error?: string; value?: T } {
    const result = schema.validate(data, { abortEarly: false })

    if (result.error) {
        const errorMessage = result.error.details.map(d => d.message).join(', ')
        return { error: errorMessage }
    }

    return { value: result.value as T }
}
