import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
    username: string
    password: string // bcrypt hashed
    role: 'admin' | 'manager'
    createdAt: Date
    lastLogin?: Date
}

const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'manager'],
        default: 'manager'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
})

export const User = mongoose.model<IUser>('User', userSchema)
