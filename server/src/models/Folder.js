import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    kind: {
      type: String,
      enum: ['system', 'custom'],
      default: 'custom',
    },

    systemKey: {
      type: String,
      enum: ['recents', 'memories', 'pictures', 'notes', 'videos', null],
      default: null,
    },
  },
  { timestamps: true },
);

folderSchema.index(
  { owner: 1, normalizedName: 1 },
  { unique: true },
);

folderSchema.index(
  { owner: 1, systemKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'system',
      systemKey: { $type: 'string' },
    },
  },
);

export const Folder = mongoose.model('Folder', folderSchema);