import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    privateAlbum: {
      enabled: {
        type: Boolean,
        default: false,
      },
      credentialType: {
        type: String,
        enum: ['pin', 'password'],
        default: null,
      },
      credentialHash: {
        type: String,
        default: null,
        select: false,
      },
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_document, returned) => {
    delete returned.privateAlbum?.credentialHash;
    delete returned.passwordHash;
    delete returned.__v;
    return returned;
  },
});

export const User = mongoose.model('User', userSchema);