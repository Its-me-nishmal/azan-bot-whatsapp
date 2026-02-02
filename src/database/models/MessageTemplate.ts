import mongoose, { Schema, Document } from 'mongoose'

export interface IMessageTemplate extends Document {
    name: string
    description: string
    content: string
    variables: string[]  // Available variables: {{location}}, {{prayer}}, {{time}}, {{district}}
    isDefault: boolean
    createdAt: Date
    updatedAt: Date
}

const messageTemplateSchema = new Schema<IMessageTemplate>({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    variables: [{
        type: String
    }],
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

export const MessageTemplate = mongoose.model<IMessageTemplate>('MessageTemplate', messageTemplateSchema)
